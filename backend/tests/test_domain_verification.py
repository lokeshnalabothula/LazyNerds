from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch
import dns.exception
import dns.resolver
import pytest
from fastapi import status

from app.core.security import create_access_token
from app.models.client import Client
from app.models.domain import Domain
from app.models.user import User
from app.schemas.auth import UserCreate
from app.services.auth_service import create_user
from app.services.domain_service import (
    RECORD_NAME_PREFIX,
    RECORD_VALUE_PREFIX,
    generate_verification_token,
    hash_verification_token,
    validate_and_normalize_domain,
)


@pytest.fixture
def test_client_org(db_session):
    """Creates a test client organization."""
    client = Client(
        company_name="Apex Security Labs",
        primary_contact_name="Alice Vance",
        primary_contact_email="alice@apexsec.io",
        website="https://apexsec.io",
        status="active",
    )
    db_session.add(client)
    db_session.commit()
    db_session.refresh(client)
    return client


@pytest.fixture
def other_client_org(db_session):
    """Creates a second client organization for cross-tenant isolation testing."""
    client = Client(
        company_name="Beta Dynamics Corp",
        primary_contact_name="Bob Miller",
        primary_contact_email="bob@betadyn.io",
        website="https://betadyn.io",
        status="active",
    )
    db_session.add(client)
    db_session.commit()
    db_session.refresh(client)
    return client


@pytest.fixture
def client_user(db_session, test_client_org):
    """Creates an authenticated customer/client user tied to test_client_org."""
    user = create_user(
        db_session,
        UserCreate(
            email="alice@apexsec.io",
            password="ClientSecure2026!",
            full_name="Alice Vance",
            role="client",
            client_id=test_client_org.id,
        ),
    )
    return user


@pytest.fixture
def other_client_user(db_session, other_client_org):
    """Creates an authenticated customer user tied to other_client_org."""
    user = create_user(
        db_session,
        UserCreate(
            email="bob@betadyn.io",
            password="OtherSecure2026!",
            full_name="Bob Miller",
            role="client",
            client_id=other_client_org.id,
        ),
    )
    return user


@pytest.fixture
def client_auth_headers(client_user):
    token = create_access_token(
        subject=client_user.id,
        extra_claims={"email": client_user.email, "role": client_user.role, "client_id": client_user.client_id},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_client_auth_headers(other_client_user):
    token = create_access_token(
        subject=other_client_user.id,
        extra_claims={"email": other_client_user.email, "role": other_client_user.role, "client_id": other_client_user.client_id},
    )
    return {"Authorization": f"Bearer {token}"}


class MockTxtRdata:
    """Mock dnspython rdata representing a TXT record with byte strings chunks."""
    def __init__(self, string_chunks: list[bytes]):
        self.strings = string_chunks


# ---------------------------------------------------------------------------
# DOMAIN VALIDATION UNIT TESTS
# ---------------------------------------------------------------------------

def test_domain_validation_syntax():
    valid_domains = [
        ("example.com", "example.com"),
        ("EXAMPLE.COM.", "example.com"),
        ("sub.domain.co.uk", "sub.domain.co.uk"),
        ("my-app.io", "my-app.io"),
        ("test123.org", "test123.org"),
    ]
    for raw, expected in valid_domains:
        ok, norm, err = validate_and_normalize_domain(raw)
        assert ok is True, f"Expected {raw} to be valid, got error: {err}"
        assert norm == expected

    invalid_domains = [
        ("", "must be a non-empty string"),
        ("   ", "cannot be empty"),
        ("https://example.com", "URLs and protocol schemes are not allowed"),
        ("http://test.io", "URLs and protocol schemes are not allowed"),
        ("example.com/path", "Paths are not allowed"),
        ("example.com:8080", "Port numbers are not allowed"),
        ("user@example.com", "Email addresses and user credentials are not allowed"),
        ("192.168.1.1", "IP addresses are not supported"),
        ("::1", "IP addresses are not supported"),
        ("localhost", "Must include at least a domain name and a top-level domain"),
        ("-example.com", "cannot start or end with a hyphen"),
        ("example-.com", "cannot start or end with a hyphen"),
        ("example..com", "Empty label"),
        ("example.123", "TLD cannot be purely numeric"),
        ("a" * 64 + ".com", "exceeds maximum length of 63 characters"),
    ]
    for raw, expected_err in invalid_domains:
        ok, norm, err = validate_and_normalize_domain(raw)
        assert ok is False, f"Expected {raw} to be invalid"
        assert expected_err.lower() in err.lower()


# ---------------------------------------------------------------------------
# API TESTS
# ---------------------------------------------------------------------------

def test_register_domain_success(client, client_auth_headers, test_client_org, db_session):
    resp = client.post(
        "/api/v1/domains",
        json={"domain": "apexsec.io"},
        headers=client_auth_headers,
    )
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert "token" in data
    assert len(data["token"]) >= 32
    assert "dns_instructions" in data
    assert data["dns_instructions"]["record_name"] == "_lazynerds-verification.apexsec.io"
    assert data["dns_instructions"]["record_host"] == "_lazynerds-verification"
    assert data["dns_instructions"]["record_value"] == f"lazynerds-verification={data['token']}"
    assert data["domain"]["verification_status"] == "pending"
    assert data["domain"]["normalized_domain"] == "apexsec.io"
    assert data["domain"]["client_id"] == test_client_org.id

    # Verify token is NOT stored in plaintext in the database
    domain_row = db_session.query(Domain).filter(Domain.id == data["domain"]["id"]).first()
    assert domain_row is not None
    assert domain_row.verification_token_hash == hash_verification_token(data["token"])
    assert data["token"] not in domain_row.verification_token_hash
    # Ensure verification_token_hash is never exposed in response
    assert "verification_token_hash" not in str(data)


def test_register_domain_direct_api_prefix(client, client_auth_headers):
    """Verifies that /api/domains alias works identically to /api/v1/domains."""
    resp = client.post(
        "/api/domains",
        json={"domain": "direct-prefix.io"},
        headers=client_auth_headers,
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.json()["domain"]["normalized_domain"] == "direct-prefix.io"


def test_register_domain_invalid_syntax(client, client_auth_headers):
    resp = client.post(
        "/api/v1/domains",
        json={"domain": "https://malformed-url.com/path"},
        headers=client_auth_headers,
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "URLs and protocol schemes are not allowed" in resp.json()["detail"]


def test_register_duplicate_domain_same_tenant(client, client_auth_headers):
    resp1 = client.post(
        "/api/v1/domains",
        json={"domain": "unique-tenant.io"},
        headers=client_auth_headers,
    )
    assert resp1.status_code == status.HTTP_201_CREATED

    resp2 = client.post(
        "/api/v1/domains",
        json={"domain": "UNIQUE-TENANT.IO."},
        headers=client_auth_headers,
    )
    assert resp2.status_code == status.HTTP_409_CONFLICT
    assert "already registered" in resp2.json()["detail"]


def test_list_domains_tenant_scoped(client, client_auth_headers, other_client_auth_headers):
    # Customer A registers domain
    client.post("/api/v1/domains", json={"domain": "tenant-a.com"}, headers=client_auth_headers)

    # Customer B registers domain
    client.post("/api/v1/domains", json={"domain": "tenant-b.com"}, headers=other_client_auth_headers)

    # Customer A lists domains
    resp_a = client.get("/api/v1/domains", headers=client_auth_headers)
    assert resp_a.status_code == status.HTTP_200_OK
    domains_a = [d["normalized_domain"] for d in resp_a.json()["items"]]
    assert "tenant-a.com" in domains_a
    assert "tenant-b.com" not in domains_a

    # Customer B lists domains
    resp_b = client.get("/api/v1/domains", headers=other_client_auth_headers)
    assert resp_b.status_code == status.HTTP_200_OK
    domains_b = [d["normalized_domain"] for d in resp_b.json()["items"]]
    assert "tenant-b.com" in domains_b
    assert "tenant-a.com" not in domains_b


def test_get_domain_details(client, client_auth_headers):
    create_resp = client.post(
        "/api/v1/domains",
        json={"domain": "audit-details.org"},
        headers=client_auth_headers,
    )
    domain_id = create_resp.json()["domain"]["id"]

    resp = client.get(f"/api/v1/domains/{domain_id}", headers=client_auth_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["id"] == domain_id
    assert data["normalized_domain"] == "audit-details.org"
    assert "verification_token_hash" not in data
    # In details, record_value should be None to prevent exposing challenge
    assert data["dns_instructions"]["record_value"] is None
    assert data["dns_instructions"]["record_name"] == "_lazynerds-verification.audit-details.org"


def test_verify_domain_exact_token_match(client, client_auth_headers):
    create_resp = client.post(
        "/api/v1/domains",
        json={"domain": "verify-success.com"},
        headers=client_auth_headers,
    )
    domain_id = create_resp.json()["domain"]["id"]
    token = create_resp.json()["token"]

    expected_record = f"lazynerds-verification={token}"
    mock_rdata = MockTxtRdata([expected_record.encode("utf-8")])

    with patch("dns.resolver.Resolver.resolve", return_value=[mock_rdata]):
        resp = client.post(f"/api/v1/domains/{domain_id}/verify", headers=client_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        result = resp.json()
        assert result["verified"] is True
        assert result["status"] == "verified"
        assert result["domain"]["verified_at"] is not None
        assert "Domain ownership successfully verified" in result["message"]

    # Re-verifying idempotent check
    resp_reverify = client.post(f"/api/v1/domains/{domain_id}/verify", headers=client_auth_headers)
    assert resp_reverify.status_code == status.HTTP_200_OK
    assert resp_reverify.json()["verified"] is True


def test_verify_domain_token_mismatch(client, client_auth_headers):
    create_resp = client.post(
        "/api/v1/domains",
        json={"domain": "verify-mismatch.com"},
        headers=client_auth_headers,
    )
    domain_id = create_resp.json()["domain"]["id"]

    wrong_record = "lazynerds-verification=totally-wrong-token-abc-123"
    mock_rdata = MockTxtRdata([wrong_record.encode("utf-8")])

    with patch("dns.resolver.Resolver.resolve", return_value=[mock_rdata]):
        resp = client.post(f"/api/v1/domains/{domain_id}/verify", headers=client_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        result = resp.json()
        assert result["verified"] is False
        assert result["status"] == "failed"
        assert "does not match" in result["message"]


def test_verify_domain_nxdomain(client, client_auth_headers):
    create_resp = client.post(
        "/api/v1/domains",
        json={"domain": "nxdomain-test.com"},
        headers=client_auth_headers,
    )
    domain_id = create_resp.json()["domain"]["id"]

    with patch("dns.resolver.Resolver.resolve", side_effect=dns.resolver.NXDOMAIN()):
        resp = client.post(f"/api/v1/domains/{domain_id}/verify", headers=client_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        result = resp.json()
        assert result["verified"] is False
        assert result["status"] == "failed"
        assert "NXDOMAIN" in result["message"] or "not found" in result["message"]


def test_verify_domain_timeout(client, client_auth_headers):
    create_resp = client.post(
        "/api/v1/domains",
        json={"domain": "timeout-test.com"},
        headers=client_auth_headers,
    )
    domain_id = create_resp.json()["domain"]["id"]

    with patch("dns.resolver.Resolver.resolve", side_effect=dns.resolver.Timeout()):
        resp = client.post(f"/api/v1/domains/{domain_id}/verify", headers=client_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        result = resp.json()
        assert result["verified"] is False
        assert result["status"] == "failed"
        assert "timed out" in result["message"]


def test_verify_domain_multiple_txt_records(client, client_auth_headers):
    """Ensures FixOps correctly extracts its verification token among multiple TXT records."""
    create_resp = client.post(
        "/api/v1/domains",
        json={"domain": "multi-txt.com"},
        headers=client_auth_headers,
    )
    domain_id = create_resp.json()["domain"]["id"]
    token = create_resp.json()["token"]

    rdatas = [
        MockTxtRdata([b"v=spf1 include:_spf.google.com ~all"]),
        MockTxtRdata([b"google-site-verification=someGoogleToken123"]),
        MockTxtRdata([f"lazynerds-verification={token}".encode("utf-8")]),
    ]

    with patch("dns.resolver.Resolver.resolve", return_value=rdatas):
        resp = client.post(f"/api/v1/domains/{domain_id}/verify", headers=client_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        result = resp.json()
        assert result["verified"] is True
        assert result["status"] == "verified"


def test_verify_domain_split_txt_strings(client, client_auth_headers):
    """Ensures RFC 1035 split strings (byte chunks) are concatenated and verified correctly."""
    create_resp = client.post(
        "/api/v1/domains",
        json={"domain": "split-strings.io"},
        headers=client_auth_headers,
    )
    domain_id = create_resp.json()["domain"]["id"]
    token = create_resp.json()["token"]

    part1 = b"lazynerds-verification="
    part2 = token.encode("utf-8")
    split_rdata = MockTxtRdata([part1, part2])

    with patch("dns.resolver.Resolver.resolve", return_value=[split_rdata]):
        resp = client.post(f"/api/v1/domains/{domain_id}/verify", headers=client_auth_headers)
        assert resp.status_code == status.HTTP_200_OK
        result = resp.json()
        assert result["verified"] is True
        assert result["status"] == "verified"


def test_verify_domain_expired_challenge(client, client_auth_headers, db_session):
    create_resp = client.post(
        "/api/v1/domains",
        json={"domain": "expired-domain.com"},
        headers=client_auth_headers,
    )
    domain_id = create_resp.json()["domain"]["id"]

    # Force challenge to be expired (e.g. 25 hours ago)
    domain_row = db_session.query(Domain).filter(Domain.id == domain_id).first()
    past_time = datetime.now(timezone.utc) - timedelta(hours=25)
    domain_row.challenge_expires_at = past_time
    db_session.commit()

    resp = client.post(f"/api/v1/domains/{domain_id}/verify", headers=client_auth_headers)
    assert resp.status_code == status.HTTP_200_OK
    result = resp.json()
    assert result["verified"] is False
    assert result["status"] == "expired"
    assert "expired" in result["message"].lower()


def test_regenerate_domain_challenge(client, client_auth_headers, db_session):
    create_resp = client.post(
        "/api/v1/domains",
        json={"domain": "regen-domain.com"},
        headers=client_auth_headers,
    )
    domain_id = create_resp.json()["domain"]["id"]
    first_token = create_resp.json()["token"]

    regen_resp = client.post(f"/api/v1/domains/{domain_id}/regenerate", headers=client_auth_headers)
    assert regen_resp.status_code == status.HTTP_200_OK
    regen_data = regen_resp.json()
    new_token = regen_data["token"]

    assert new_token != first_token
    assert regen_data["dns_instructions"]["record_value"] == f"lazynerds-verification={new_token}"
    assert regen_data["domain"]["verification_status"] == "pending"

    # Old token fails to verify
    old_rdata = MockTxtRdata([f"lazynerds-verification={first_token}".encode("utf-8")])
    with patch("dns.resolver.Resolver.resolve", return_value=[old_rdata]):
        resp_old = client.post(f"/api/v1/domains/{domain_id}/verify", headers=client_auth_headers)
        assert resp_old.json()["verified"] is False

    # Fast forward time to avoid 5-second rate limit
    domain_row = db_session.query(Domain).filter(Domain.id == domain_id).first()
    domain_row.last_verification_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    db_session.commit()

    # New token verifies successfully
    new_rdata = MockTxtRdata([f"lazynerds-verification={new_token}".encode("utf-8")])
    with patch("dns.resolver.Resolver.resolve", return_value=[new_rdata]):
        resp_new = client.post(f"/api/v1/domains/{domain_id}/verify", headers=client_auth_headers)
        assert resp_new.json()["verified"] is True


def test_rate_limiting_verification_attempts(client, client_auth_headers):
    create_resp = client.post(
        "/api/v1/domains",
        json={"domain": "rate-limit-test.com"},
        headers=client_auth_headers,
    )
    domain_id = create_resp.json()["domain"]["id"]

    mock_rdata = MockTxtRdata([b"wrong-token"])
    with patch("dns.resolver.Resolver.resolve", return_value=[mock_rdata]):
        # First attempt executes
        resp1 = client.post(f"/api/v1/domains/{domain_id}/verify", headers=client_auth_headers)
        assert resp1.status_code == status.HTTP_200_OK

        # Immediate second attempt within 5 seconds gets rate limited
        resp2 = client.post(f"/api/v1/domains/{domain_id}/verify", headers=client_auth_headers)
        assert resp2.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert "wait at least" in resp2.json()["detail"].lower()


def test_cross_tenant_isolation(client, client_auth_headers, other_client_auth_headers):
    """Ensures customer cannot access, verify, regenerate or delete another customer's domain."""
    create_resp = client.post(
        "/api/v1/domains",
        json={"domain": "victim-company.com"},
        headers=client_auth_headers,
    )
    domain_id = create_resp.json()["domain"]["id"]

    # Other customer tries to view
    resp_get = client.get(f"/api/v1/domains/{domain_id}", headers=other_client_auth_headers)
    assert resp_get.status_code == status.HTTP_404_NOT_FOUND

    # Other customer tries to verify
    resp_verify = client.post(f"/api/v1/domains/{domain_id}/verify", headers=other_client_auth_headers)
    assert resp_verify.status_code == status.HTTP_404_NOT_FOUND

    # Other customer tries to regenerate
    resp_regen = client.post(f"/api/v1/domains/{domain_id}/regenerate", headers=other_client_auth_headers)
    assert resp_regen.status_code == status.HTTP_404_NOT_FOUND

    # Other customer tries to delete
    resp_del = client.delete(f"/api/v1/domains/{domain_id}", headers=other_client_auth_headers)
    assert resp_del.status_code == status.HTTP_404_NOT_FOUND


def test_delete_domain_success(client, client_auth_headers):
    create_resp = client.post(
        "/api/v1/domains",
        json={"domain": "delete-me.org"},
        headers=client_auth_headers,
    )
    domain_id = create_resp.json()["domain"]["id"]

    del_resp = client.delete(f"/api/v1/domains/{domain_id}", headers=client_auth_headers)
    assert del_resp.status_code == status.HTTP_204_NO_CONTENT

    # Verify 404 after deletion
    get_resp = client.get(f"/api/v1/domains/{domain_id}", headers=client_auth_headers)
    assert get_resp.status_code == status.HTTP_404_NOT_FOUND


def test_public_challenge_endpoint(client):
    """Verifies that public challenge endpoint generates tokens and instructions for all 3 methods."""
    resp = client.post("/api/v1/domains/public-challenge", json={"domain": "https://example.com/foo"})
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["normalized_domain"] == "example.com"
    assert len(data["token"]) >= 32
    # DNS instructions
    assert data["dns_instructions"]["record_name"] == "_lazynerds-verification.example.com"
    assert data["dns_instructions"]["record_value"] == f"lazynerds-verification={data['token']}"
    # File instructions
    assert data["file_instructions"]["file_name"] == "fixops-verification.txt"
    assert data["file_instructions"]["expected_content"] == f"lazynerds-verification={data['token']}"
    # Meta instructions
    assert data["meta_instructions"]["meta_tag"] == "fixops-verification"
    assert f'content="{data["token"]}"' in data["meta_instructions"]["snippet"]


def test_public_verify_dns_method(client):
    """Tests public DNS verification with mocked resolver and signed proof token generation."""
    token = "test_token_1234567890abcdef"
    mock_rdata = MagicMock()
    mock_rdata.strings = [f"lazynerds-verification={token}".encode("utf-8")]

    with patch("dns.resolver.Resolver.resolve", return_value=[mock_rdata]):
        resp = client.post(
            "/api/v1/domains/public-verify",
            json={"domain": "example.com", "method": "dns", "token": token},
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["verified"] is True
        assert data["status"] == "verified"
        assert "verified via DNS TXT" in data["message"]
        assert data["verification_proof"] is not None
        assert len(data["verification_proof"]) > 20


def test_public_verify_file_method(client):
    """Tests public file upload verification with mocked safe_http_fetch response and proof token."""
    token = "test_file_token_1234567890abcdef"
    file_content = f"lazynerds-verification={token}"

    with patch("app.services.domain_service.safe_http_fetch", return_value=(200, {}, file_content, "https://example.com/.well-known/fixops-verification.txt")):
        resp = client.post(
            "/api/v1/domains/public-verify",
            json={"domain": "example.com", "method": "file", "token": token},
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["verified"] is True
        assert data["status"] == "verified"
        assert "verified via HTTP file" in data["message"]
        assert data["verification_proof"] is not None


def test_public_verify_meta_method(client):
    """Tests public HTML meta tag verification with mocked safe_http_fetch response and proof token."""
    token = "test_meta_token_1234567890abcdef"
    html_content = f'<html><head><meta name="fixops-verification" content="{token}"></head><body>Hello</body></html>'

    with patch("app.services.domain_service.safe_http_fetch", return_value=(200, {}, html_content, "https://example.com/")):
        resp = client.post(
            "/api/v1/domains/public-verify",
            json={"domain": "example.com", "method": "meta", "token": token},
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["verified"] is True
        assert data["status"] == "verified"
        assert "verified via HTML meta tag" in data["message"]
        assert data["verification_proof"] is not None


def test_security_score_endpoint_rejects_unverified_domain(client):
    """Verifies that the server does NOT trust unverified requests or query flags like verified=true."""
    # Attempt 1: Direct request without token
    resp = client.get("/api/v1/domains/security-score?domain=example.com")
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["status"] == "failed"
    assert data["score"] is None
    assert data["posture"] == "Score Unavailable"
    assert "Domain ownership not verified" in data["error"]

    # Attempt 2: Caller passes verified=true query flag (which must be ignored)
    resp_flag = client.get("/api/v1/domains/security-score?domain=example.com&verified=true")
    assert resp_flag.status_code == status.HTTP_200_OK
    data_flag = resp_flag.json()
    assert data_flag["status"] == "failed"
    assert data_flag["score"] is None
    assert data_flag["posture"] == "Score Unavailable"


def test_security_score_endpoint_rejects_tampered_or_domain_mismatch_proof(client):
    """Verifies that tokens issued for another domain or tampered tokens are rejected."""
    from app.core.security import create_domain_verification_proof

    token_for_other = create_domain_verification_proof("other-site.com", "dns")

    resp = client.get(f"/api/v1/domains/security-score?domain=target-site.com&token={token_for_other}")
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["status"] == "failed"
    assert data["score"] is None
    assert "Domain ownership not verified" in data["error"]


def test_security_score_endpoint_completed_with_valid_proof(client):
    """Tests security score calculation succeeds when valid cryptographic proof is provided."""
    from app.core.security import create_domain_verification_proof

    proof = create_domain_verification_proof("example.com", "dns")
    mock_findings = [
        {"id": "f1", "title": "Missing HSTS Header", "severity": "medium", "cvss_score": 5.3},
        {"id": "f2", "title": "Missing CSP Header", "severity": "low", "cvss_score": 3.7},
    ]
    mock_meta = {"target_url": "https://example.com", "duration_ms": 120}

    with patch("app.services.web_audit_engine.audit_web_target", return_value=(mock_findings, mock_meta)):
        resp = client.get(f"/api/v1/domains/security-score?domain=example.com&token={proof}")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["status"] == "completed"
        # 100 - (8 for medium + 3 for low) = 89
        assert data["score"] == 89
        assert data["posture"] == "Good Posture"
        assert data["findings_count"] == 2
        assert data["severity_counts"]["medium"] == 1
        assert data["severity_counts"]["low"] == 1


def test_security_score_endpoint_failure_shows_unavailable(client):
    """Tests that a scan failure returns status failed and score None (never a fabricated score)."""
    from app.core.security import create_domain_verification_proof
    proof = create_domain_verification_proof("unreachable-domain.invalid", "dns")

    with patch("app.services.web_audit_engine.audit_web_target", side_effect=RuntimeError("DNS resolution failed")):
        resp = client.get(f"/api/v1/domains/security-score?domain=unreachable-domain.invalid&token={proof}")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["status"] == "failed"
        assert data["score"] is None
        assert data["posture"] == "Score Unavailable"
        assert "DNS resolution failed" in data["error"]


def test_ssrf_protection_on_public_verification(client):
    """Tests that public verification strictly rejects localhost, private IPs, and cloud metadata."""
    token = "test_ssrf_token_1234567890abcdef"
    
    # 1. Localhost attempt
    resp_local = client.post(
        "/api/v1/domains/public-verify",
        json={"domain": "127.0.0.1", "method": "file", "token": token},
    )
    assert resp_local.status_code == status.HTTP_200_OK
    assert resp_local.json()["verified"] is False

    # 2. Cloud metadata IP attempt
    resp_meta = client.post(
        "/api/v1/domains/public-verify",
        json={"domain": "169.254.169.254", "method": "file", "token": token},
    )
    assert resp_meta.status_code == status.HTTP_200_OK
    assert resp_meta.json()["verified"] is False


def test_redirect_ssrf_protection(client):
    """Tests that redirecting to metadata or internal IP is blocked by safe_http_fetch."""
    from app.core.security import safe_http_fetch

    # Mock response that redirects to AWS metadata endpoint
    mock_resp_1 = MagicMock()
    mock_resp_1.status_code = 302
    mock_resp_1.headers = {"location": "http://169.254.169.254/latest/meta-data/"}
    mock_resp_1.iter_bytes.return_value = [b""]

    with patch("httpx.Client.stream") as mock_stream:
        mock_stream.return_value.__enter__.return_value = mock_resp_1
        with pytest.raises(ValueError, match="SSRF violation"):
            safe_http_fetch("https://attacker.com/verify.txt", allow_lab=False)


def test_response_size_capping():
    """Tests that safe_http_fetch caps response size and stops streaming after max_bytes."""
    from app.core.security import safe_http_fetch

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "text/plain"}
    # Yield 10 chunks of 100 bytes = 1000 bytes
    mock_resp.iter_bytes.return_value = [b"a" * 100] * 10

    with patch("app.core.security.validate_target_url_ssrf", return_value=(True, "")):
        with patch("socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 443))]):
            with patch("httpx.Client.stream") as mock_stream:
                mock_stream.return_value.__enter__.return_value = mock_resp
                status, headers, text, final_url = safe_http_fetch(
                    "https://example.com/test",
                    max_bytes=250,
                    allow_lab=False,
                )
                assert status == 200
                assert len(text) == 250


def test_error_sanitization_removes_internal_paths_and_ips():
    """Tests that sanitize_assessment_error scrubs sensitive system paths, IPs, and credentials."""
    from app.core.security import sanitize_assessment_error

    raw_err = "Error at /Users/loki/Projects/LazyNerds/backend/app/main.py: failed to connect to postgresql://admin:secret123@10.0.1.5:5432/db"
    clean = sanitize_assessment_error(raw_err)
    assert "/Users/loki" not in clean
    assert "secret123" not in clean
    assert "10.0.1.5" not in clean
    assert "[internal-ip]" in clean or "[internal path]" in clean


def test_assessment_concurrency_semaphore_limits_capacity():
    """Tests that acquire_assessment_slot raises when capacity is saturated."""
    from app.core.security import acquire_assessment_slot, ASSESSMENT_CONCURRENCY_SEMAPHORE

    # Drain all 3 slots
    acquired_locks = []
    for _ in range(3):
        assert ASSESSMENT_CONCURRENCY_SEMAPHORE.acquire(blocking=False)
        acquired_locks.append(True)

    try:
        with pytest.raises(RuntimeError, match="Assessment capacity reached"):
            with acquire_assessment_slot(timeout=0.05):
                pass
    finally:
        # Release acquired slots
        for _ in acquired_locks:
            ASSESSMENT_CONCURRENCY_SEMAPHORE.release()


def test_rate_limiter_sliding_window():
    """Tests SlidingWindowRateLimiter properly rejects requests exceeding maximum."""
    from app.core.security import SlidingWindowRateLimiter

    limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=60)
    ip = "203.0.113.195"

    assert limiter.check_and_record(ip) is True
    assert limiter.check_and_record(ip) is True
    assert limiter.check_and_record(ip) is True
    # 4th request must be rejected
    assert limiter.check_and_record(ip) is False



