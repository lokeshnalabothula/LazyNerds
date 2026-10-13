from fastapi import status


def test_missing_required_fields(auth_client):
    """Tests 422 when required fields are missing."""
    response = auth_client.post("/api/v1/clients", json={})
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = response.json()
    assert "detail" in data
    assert "errors" in data
    fields = [err["field"] for err in data["errors"]]
    assert "company_name" in fields
    assert "primary_contact_name" in fields
    assert "primary_contact_email" in fields


def test_whitespace_only_company_name(auth_client):
    """Tests rejection of whitespace-only company name."""
    response = auth_client.post(
        "/api/v1/clients",
        json={
            "company_name": "    ",
            "primary_contact_name": "Valid Name",
            "primary_contact_email": "valid@email.com",
        },
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = response.json()
    assert any("company_name" in err["field"] for err in data["errors"])


def test_invalid_email_format(auth_client):
    """Tests rejection of malformed email addresses."""
    invalid_emails = [
        "notanemail",
        "@missinguser.com",
        "missingatsign.com",
        "spaces in@email.com",
    ]
    for bad_email in invalid_emails:
        response = auth_client.post(
            "/api/v1/clients",
            json={
                "company_name": "Test Company",
                "primary_contact_name": "Valid Name",
                "primary_contact_email": bad_email,
            },
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY, f"Failed for {bad_email}"


def test_invalid_website_schemes(auth_client):
    """Tests rejection of dangerous or non-HTTP/HTTPS website schemes."""
    dangerous_urls = [
        "javascript:alert(document.cookie)",
        "data:text/html,<script>alert(1)</script>",
        "file:///etc/passwd",
        "ftp://files.example.com",
        "not a url at all",
    ]
    for bad_url in dangerous_urls:
        response = auth_client.post(
            "/api/v1/clients",
            json={
                "company_name": "Test Company",
                "primary_contact_name": "Valid Name",
                "primary_contact_email": "test@example.com",
                "website": bad_url,
            },
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY, f"Should reject {bad_url}"


def test_valid_website_accepted(auth_client):
    """Tests acceptance of standard HTTP and HTTPS websites."""
    valid_urls = [
        "https://example.com",
        "http://sub.domain.co.uk/path",
        "https://127.0.0.1:8080/test",
    ]
    for url in valid_urls:
        response = auth_client.post(
            "/api/v1/clients",
            json={
                "company_name": f"Company {url}",
                "primary_contact_name": "Valid Name",
                "primary_contact_email": "test@example.com",
                "website": url,
            },
        )
        assert response.status_code == status.HTTP_201_CREATED


def test_email_normalization_to_lowercase(auth_client):
    """Tests that contact emails are normalized to lowercase."""
    response = auth_client.post(
        "/api/v1/clients",
        json={
            "company_name": "Case Sensitivity Labs",
            "primary_contact_name": "John Doe",
            "primary_contact_email": "JoHn.DoE@ExAmPlE.CoM",
        },
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["primary_contact_email"] == "john.doe@example.com"
