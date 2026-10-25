from fastapi import status


def test_create_client_success(auth_client):
    """Tests client creation with all valid fields."""
    payload = {
        "company_name": "CyberDefense Labs",
        "primary_contact_name": "Sarah Connor",
        "primary_contact_email": "sarah@cyberdefense.io",
        "website": "https://cyberdefense.io",
        "phone": "+1-800-555-0199",
        "industry": "Cybersecurity",
        "notes": "Authorized scope includes external perimeter testing only.",
    }
    response = auth_client.post("/api/v1/clients", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["company_name"] == "CyberDefense Labs"
    assert data["primary_contact_name"] == "Sarah Connor"
    assert data["primary_contact_email"] == "sarah@cyberdefense.io"
    assert data["website"] == "https://cyberdefense.io"
    assert data["status"] == "active"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_client_with_custom_timestamp(auth_client):
    """Tests that a client can be created with an exact historical or custom onboarding timestamp."""
    custom_time = "2025-06-15T14:30:00Z"
    payload = {
        "company_name": "Historical Client Ltd",
        "primary_contact_name": "Arthur Pendelton",
        "primary_contact_email": "arthur@historical.org",
        "created_at": custom_time,
    }
    response = auth_client.post("/api/v1/clients", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["company_name"] == "Historical Client Ltd"
    assert data["created_at"].startswith("2025-06-15T14:30:00")

    # Verify retrieval preserves the custom timestamp
    get_res = auth_client.get(f"/api/v1/clients/{data['id']}")
    assert get_res.status_code == status.HTTP_200_OK
    assert get_res.json()["created_at"].startswith("2025-06-15T14:30:00")


def test_created_at_is_immutable_after_creation(auth_client):
    """Tests that created_at cannot be altered after record creation."""
    initial_time = "2025-06-15T14:30:00Z"
    create_res = auth_client.post(
        "/api/v1/clients",
        json={
            "company_name": "Immutable Corp",
            "primary_contact_name": "Tina Time",
            "primary_contact_email": "tina@immutable.io",
            "created_at": initial_time,
        },
    )
    assert create_res.status_code == status.HTTP_201_CREATED
    client_id = create_res.json()["id"]
    original_created_at = create_res.json()["created_at"]
    assert original_created_at.startswith("2025-06-15T14:30:00")

    # Attempt to alter created_at via PATCH
    attempted_new_time = "2020-01-01T00:00:00Z"
    update_res = auth_client.patch(
        f"/api/v1/clients/{client_id}",
        json={"created_at": attempted_new_time, "phone": "+1-555-0100"},
    )
    assert update_res.status_code == status.HTTP_200_OK
    data = update_res.json()
    assert data["created_at"] == original_created_at, "created_at must remain strictly immutable"
    assert data["phone"] == "+1-555-0100"

    # Verify retrieval confirms immutability
    get_res = auth_client.get(f"/api/v1/clients/{client_id}")
    assert get_res.status_code == status.HTTP_200_OK
    assert get_res.json()["created_at"] == original_created_at


def test_updated_at_only_advances_on_successful_modification(auth_client):
    """Tests that updated_at only changes when actual modifications occur."""
    create_res = auth_client.post(
        "/api/v1/clients",
        json={
            "company_name": "Modification Check Ltd",
            "primary_contact_name": "Marcus Modification",
            "primary_contact_email": "marcus@modcheck.io",
        },
    )
    client_id = create_res.json()["id"]
    initial_updated_at = create_res.json()["updated_at"]

    # 1. No-op update with identical data
    noop_res = auth_client.patch(
        f"/api/v1/clients/{client_id}",
        json={"company_name": "Modification Check Ltd"},
    )
    assert noop_res.status_code == status.HTTP_200_OK
    assert noop_res.json()["updated_at"] == initial_updated_at, "No-op update must not advance updated_at"

    # 2. Actual modification with different field
    mod_res = auth_client.patch(
        f"/api/v1/clients/{client_id}",
        json={"company_name": "Modification Check Renamed Corp"},
    )
    assert mod_res.status_code == status.HTTP_200_OK
    assert mod_res.json()["company_name"] == "Modification Check Renamed Corp"
    assert mod_res.json()["updated_at"] >= initial_updated_at


def test_create_rejects_naive_timestamp(auth_client):
    """Tests that creating a client with a naive datetime (lacking timezone) is rejected."""
    payload = {
        "company_name": "Naive Date Corp",
        "primary_contact_name": "Noah Timezone",
        "primary_contact_email": "noah@naive.com",
        "created_at": "2025-06-15T14:30:00",  # No Z or offset
    }
    response = auth_client.post("/api/v1/clients", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    err_detail = str(response.json())
    assert "timezone" in err_detail.lower()


def test_create_accepts_timezone_offset_and_converts_to_utc(auth_client):
    """Tests that timezone-aware timestamps with non-UTC offset (e.g. IST +05:30) are cleanly converted to UTC."""
    # 20:00:00 IST is 14:30:00 UTC
    ist_timestamp = "2025-06-15T20:00:00+05:30"
    payload = {
        "company_name": "IST Onboarding Corp",
        "primary_contact_name": "Rohan Sharma",
        "primary_contact_email": "rohan@istonboarding.in",
        "created_at": ist_timestamp,
    }
    response = auth_client.post("/api/v1/clients", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["created_at"].startswith("2025-06-15T14:30:00")
    assert data["created_at"].endswith("Z")

    # Read back ensures identical UTC timestamp
    get_res = auth_client.get(f"/api/v1/clients/{data['id']}")
    assert get_res.status_code == status.HTTP_200_OK
    assert get_res.json()["created_at"] == data["created_at"]



def test_get_client_by_id(auth_client):
    """Tests retrieving an existing client by ID."""
    create_res = auth_client.post(
        "/api/v1/clients",
        json={
            "company_name": "Acme Sentinel Corp",
            "primary_contact_name": "Alice Sentinel",
            "primary_contact_email": "alice@sentinel.com",
        },
    )
    client_id = create_res.json()["id"]

    response = auth_client.get(f"/api/v1/clients/{client_id}")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["id"] == client_id
    assert response.json()["company_name"] == "Acme Sentinel Corp"


def test_get_client_unknown_id(auth_client):
    """Tests 404 when querying a nonexistent client ID."""
    response = auth_client.get("/api/v1/clients/00000000-0000-0000-0000-000000000000")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "This client could not be found."


def test_update_client_partial(auth_client):
    """Tests partial update preserves unchanged fields."""
    create_res = auth_client.post(
        "/api/v1/clients",
        json={
            "company_name": "Original Name Inc",
            "primary_contact_name": "Bob Smith",
            "primary_contact_email": "bob@original.com",
            "industry": "Finance",
        },
    )
    client_id = create_res.json()["id"]

    update_res = auth_client.patch(
        f"/api/v1/clients/{client_id}",
        json={"company_name": "Renamed Entity Ltd", "phone": "+1-555-4321"},
    )
    assert update_res.status_code == status.HTTP_200_OK
    data = update_res.json()
    assert data["company_name"] == "Renamed Entity Ltd"
    assert data["phone"] == "+1-555-4321"
    assert data["primary_contact_name"] == "Bob Smith"  # Preserved
    assert data["industry"] == "Finance"  # Preserved


def test_archive_and_restore_flow(auth_client):
    """Tests archiving, exclusion from default list, and restoration."""
    create_res = auth_client.post(
        "/api/v1/clients",
        json={
            "company_name": "Temporary Client LLC",
            "primary_contact_name": "Tom Temporary",
            "primary_contact_email": "tom@temp.com",
        },
    )
    client_id = create_res.json()["id"]

    # 1. Archive
    archive_res = auth_client.post(f"/api/v1/clients/{client_id}/archive")
    assert archive_res.status_code == status.HTTP_200_OK
    assert archive_res.json()["status"] == "archived"

    # 2. Check exclusion from default active list
    list_res = auth_client.get("/api/v1/clients?status=active")
    ids = [c["id"] for c in list_res.json()["items"]]
    assert client_id not in ids

    # 3. Check presence in archived list
    archived_list_res = auth_client.get("/api/v1/clients?status=archived")
    archived_ids = [c["id"] for c in archived_list_res.json()["items"]]
    assert client_id in archived_ids

    # 4. Repeated archive operation is safe and idempotent
    repeat_archive = auth_client.post(f"/api/v1/clients/{client_id}/archive")
    assert repeat_archive.status_code == status.HTTP_200_OK
    assert repeat_archive.json()["status"] == "archived"

    # 5. Restore
    restore_res = auth_client.post(f"/api/v1/clients/{client_id}/restore")
    assert restore_res.status_code == status.HTTP_200_OK
    assert restore_res.json()["status"] == "active"

    # 6. Verify returned to active list
    restored_list_res = auth_client.get("/api/v1/clients?status=active")
    restored_ids = [c["id"] for c in restored_list_res.json()["items"]]
    assert client_id in restored_ids


def test_client_search_behavior(auth_client):
    """Tests search matches across company name, contact name, and email."""
    auth_client.post(
        "/api/v1/clients",
        json={
            "company_name": "Spectre Intelligence Group",
            "primary_contact_name": "James Bond",
            "primary_contact_email": "agent007@mi6.gov.uk",
        },
    )

    # Search by partial company name
    res1 = auth_client.get("/api/v1/clients?search=Spectre")
    assert any(c["company_name"] == "Spectre Intelligence Group" for c in res1.json()["items"])

    # Search by partial contact name
    res2 = auth_client.get("/api/v1/clients?search=James")
    assert any(c["primary_contact_name"] == "James Bond" for c in res2.json()["items"])

    # Search by partial email
    res3 = auth_client.get("/api/v1/clients?search=mi6.gov")
    assert any(c["primary_contact_email"] == "agent007@mi6.gov.uk" for c in res3.json()["items"])

    # Search for nonexistent term
    res4 = auth_client.get("/api/v1/clients?search=NonExistentTerm999")
    assert res4.json()["total"] == 0
    assert len(res4.json()["items"]) == 0


def test_sorting_and_allowlist(auth_client):
    """Tests sorting by allowed fields and rejection of unsupported fields."""
    # Valid sort fields
    res1 = auth_client.get("/api/v1/clients?sort_by=company_name&sort_order=asc")
    assert res1.status_code == status.HTTP_200_OK

    res2 = auth_client.get("/api/v1/clients?sort_by=created_at&sort_order=desc")
    assert res2.status_code == status.HTTP_200_OK

    # Unsupported sort field rejected with 400
    res3 = auth_client.get("/api/v1/clients?sort_by=malicious_field_or_sql")
    assert res3.status_code == status.HTTP_400_BAD_REQUEST
    assert "Invalid sort field" in res3.json()["detail"]


def test_unauthorized_endpoints(client):
    """Tests that unauthenticated visitors receive 401 across all client endpoints."""
    assert client.get("/api/v1/clients").status_code == status.HTTP_401_UNAUTHORIZED
    assert client.post("/api/v1/clients", json={}).status_code == status.HTTP_401_UNAUTHORIZED
    assert client.get("/api/v1/clients/dummy-id").status_code == status.HTTP_401_UNAUTHORIZED
    assert client.patch("/api/v1/clients/dummy-id", json={}).status_code == status.HTTP_401_UNAUTHORIZED
    assert client.post("/api/v1/clients/dummy-id/archive").status_code == status.HTTP_401_UNAUTHORIZED
    assert client.post("/api/v1/clients/dummy-id/restore").status_code == status.HTTP_401_UNAUTHORIZED


def test_client_with_internal_or_lab_domain_email_serializes_cleanly(auth_client):
    """
    Verifies that client records with internal, lab, or test domains (e.g. lab@fixops.local)
    are accepted and serialized by ClientOut without throwing Pydantic validation errors (HTTP 500).
    """
    internal_emails = [
        "lab@fixops.local",
        "sec-lead@cyberrange.internal",
        "operator@pentest.test",
    ]
    for email in internal_emails:
        create_res = auth_client.post(
            "/api/v1/clients",
            json={
                "company_name": f"Internal Org {email.split('@')[1]}",
                "primary_contact_name": "Lab Operator",
                "primary_contact_email": email,
            },
        )
        assert create_res.status_code == status.HTTP_201_CREATED, f"Failed for {email}: {create_res.text}"
        data = create_res.json()
        assert data["primary_contact_email"] == email

    # List clients and ensure they serialize cleanly
    list_res = auth_client.get("/api/v1/clients")
    assert list_res.status_code == status.HTTP_200_OK
    emails_in_list = {c["primary_contact_email"] for c in list_res.json()["items"]}
    for email in internal_emails:
        assert email in emails_in_list
