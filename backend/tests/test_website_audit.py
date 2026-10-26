import socket
import uuid
import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.asset import Asset
from app.models.finding import Assessment
from app.schemas.auth import UserCreate
from app.services.auth_service import create_user


@pytest.fixture(autouse=True)
def mock_deterministic_dns(monkeypatch):
    """
    Deterministically resolves domain names to a public IP in tests,
    ensuring test suites do not depend on external network DNS resolution.
    Known metadata/loopback hostnames or direct IP literals pass through unmodified.
    """
    real_getaddrinfo = socket.getaddrinfo

    def fake_getaddrinfo(host, port, *args, **kwargs):
        # Deterministically resolve standard public domain targets to real IANA public IPv4
        if host in ("example.com", "archived.testapp.io", "portal.securecorp.internal", "somewebsite.io"):
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port or 80))]
        return real_getaddrinfo(host, port, *args, **kwargs)

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    monkeypatch.setattr("app.core.security.socket.getaddrinfo", fake_getaddrinfo)


@pytest.fixture
def active_client(db_session):
    client = Client(
        id=str(uuid.uuid4()),
        company_name="Acme Cyber Defense Corp",
        primary_contact_name="Alice Cyber",
        primary_contact_email="alice@acme-defense.io",
        status="active",
    )
    db_session.add(client)
    db_session.commit()
    db_session.refresh(client)
    return client


@pytest.fixture
def archived_client(db_session):
    client = Client(
        id=str(uuid.uuid4()),
        company_name="Archived Legacy Ltd",
        primary_contact_name="Bob Legacy",
        primary_contact_email="bob@legacy.io",
        status="archived",
    )
    db_session.add(client)
    db_session.commit()
    db_session.refresh(client)
    return client


def test_submit_website_audit_success(auth_client: TestClient, active_client, db_session):
    payload = {
        "url": "https://example.com",
        "client_id": active_client.id,
        "scan_mode": "blackbox",
        "confirmed_authorization": True,
        "notes": "Pre-deployment audit request.",
    }
    resp = auth_client.post("/api/v1/engagements/website-audit", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()

    assert data["status"] == "success"
    assert data["target_url"] == "https://example.com"
    assert "assessment_id" in data
    assert "engagement_id" in data
    assert "asset_id" in data

    # Verify database objects
    eng = db_session.query(Engagement).filter(Engagement.id == data["engagement_id"]).first()
    assert eng is not None
    assert eng.client_id == active_client.id
    assert eng.authorization_status == "confirmed"

    asset = db_session.query(Asset).filter(Asset.id == data["asset_id"]).first()
    assert asset is not None
    assert asset.target == "https://example.com"
    assert asset.asset_type == "web_application"
    assert asset.in_scope is True

    assessment = db_session.query(Assessment).filter(Assessment.id == data["assessment_id"]).first()
    assert assessment is not None
    assert assessment.engagement_id == eng.id
    import json
    assert asset.id in json.loads(assessment.target_asset_ids)


def test_submit_website_audit_unconfirmed_authorization_rejected(auth_client: TestClient, active_client):
    payload = {
        "url": "https://portal.securecorp.internal",
        "client_id": active_client.id,
        "confirmed_authorization": False,
    }
    resp = auth_client.post("/api/v1/engagements/website-audit", json=payload)
    assert resp.status_code == 400
    assert "requires confirmed written authorization" in resp.json()["detail"]


def test_submit_website_audit_ssrf_metadata_blocked(auth_client: TestClient, active_client):
    payload = {
        "url": "http://169.254.169.254/latest/meta-data/",
        "client_id": active_client.id,
        "confirmed_authorization": True,
    }
    resp = auth_client.post("/api/v1/engagements/website-audit", json=payload)
    assert resp.status_code == 400
    assert "metadata" in resp.json()["detail"].lower() or "blocked" in resp.json()["detail"].lower()


def test_submit_website_audit_ssrf_loopback_blocked(auth_client: TestClient, active_client):
    payload = {
        "url": "http://127.0.0.1:8000/api/v1/secret",
        "client_id": active_client.id,
        "confirmed_authorization": True,
    }
    resp = auth_client.post("/api/v1/engagements/website-audit", json=payload)
    assert resp.status_code == 400
    detail = resp.json()["detail"].lower()
    assert "ssrf" in detail or "disallowed" in detail or "loopback" in detail or "blocked" in detail


def test_submit_website_audit_production_mode_blocks_lab_target_even_with_flag_true(
    auth_client: TestClient, active_client, monkeypatch
):
    """
    Regression test for LNA-14: Fail-closed production SSRF guard on Website Audit.
    Verifies that when ENVIRONMENT='production', even if ALLOW_LAB_TESTING is explicitly set True,
    targeting loopback or the local lab target (http://127.0.0.1:8888) is strictly rejected with HTTP 400.
    """
    from app.core.config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "ALLOW_LAB_TESTING", True)

    payload = {
        "url": "http://127.0.0.1:8888",
        "client_id": active_client.id,
        "scan_mode": "blackbox",
        "confirmed_authorization": True,
    }
    resp = auth_client.post("/api/v1/engagements/website-audit", json=payload)
    assert resp.status_code == 400
    detail = resp.json()["detail"].lower()
    assert "ssrf" in detail or "disallowed" in detail or "loopback" in detail


def test_submit_website_audit_invalid_scheme_rejected(auth_client: TestClient, active_client):
    payload = {
        "url": "javascript:alert(1)",
        "client_id": active_client.id,
        "confirmed_authorization": True,
    }
    resp = auth_client.post("/api/v1/engagements/website-audit", json=payload)
    assert resp.status_code == 422 or resp.status_code == 400


def test_submit_website_audit_archived_client_rejected(auth_client: TestClient, active_client, archived_client):
    payload = {
        "url": "https://archived.testapp.io",
        "client_id": archived_client.id,
        "confirmed_authorization": True,
    }
    resp = auth_client.post("/api/v1/engagements/website-audit", json=payload)
    assert resp.status_code == 400
    assert "archived" in resp.json()["detail"]


def test_submit_website_audit_nonexistent_client_rejected(auth_client: TestClient):
    payload = {
        "url": "https://somewebsite.io",
        "client_id": str(uuid.uuid4()),
        "confirmed_authorization": True,
    }
    resp = auth_client.post("/api/v1/engagements/website-audit", json=payload)
    assert resp.status_code == 404


def test_submit_website_audit_unassigned_employee_rejected_403(client: TestClient, db_session):
    """
    Verifies that an employee user cannot submit a website audit for a client
    assigned to a different employee.
    Enforces that zero engagement, asset, or assessment records are created.
    """
    emp1 = create_user(
        db_session,
        UserCreate(
            email="emp1-audit@lazynerds.com",
            password="EmployeePassword2026!",
            full_name="Employee One",
            role="employee",
        ),
    )
    emp2 = create_user(
        db_session,
        UserCreate(
            email="emp2-audit@lazynerds.com",
            password="EmployeePassword2026!",
            full_name="Employee Two",
            role="employee",
        ),
    )

    client_assigned_emp2 = Client(
        id=str(uuid.uuid4()),
        company_name="Emp2 Secured Portal Corp",
        primary_contact_name="Lead Emp2",
        primary_contact_email="lead@emp2-corp.io",
        status="active",
        assigned_employee_id=emp2.id,
    )
    db_session.add(client_assigned_emp2)
    db_session.commit()

    token1 = create_access_token(
        subject=emp1.id, extra_claims={"email": emp1.email, "role": emp1.role}
    )
    headers_emp1 = {"Authorization": f"Bearer {token1}"}

    payload = {
        "url": "https://example.com",
        "client_id": client_assigned_emp2.id,
        "scan_mode": "blackbox",
        "confirmed_authorization": True,
        "notes": "Attempted unauthorized submission by employee 1",
    }

    resp = client.post("/api/v1/engagements/website-audit", json=payload, headers=headers_emp1)
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert "not assigned to this client record" in resp.json()["detail"].lower()

    # Verify no Engagement, Asset, or Assessment was created
    created_eng = (
        db_session.query(Engagement).filter(Engagement.client_id == client_assigned_emp2.id).first()
    )
    assert created_eng is None

    created_asset = (
        db_session.query(Asset).filter(Asset.client_id == client_assigned_emp2.id).first()
    )
    assert created_asset is None

    created_assessments = (
        db_session.query(Assessment)
        .filter(Assessment.assessment_tool == "shannon_network_web_scanner")
        .all()
    )
    for a in created_assessments:
        assert a.engagement_id != (created_eng.id if created_eng else None)


def test_submit_website_audit_assigned_employee_allowed_201(client: TestClient, db_session):
    """
    Verifies that the assigned employee CAN submit a website audit for their assigned client.
    """
    emp = create_user(
        db_session,
        UserCreate(
            email="assigned-emp@lazynerds.com",
            password="EmployeePassword2026!",
            full_name="Assigned Employee",
            role="employee",
        ),
    )

    assigned_client = Client(
        id=str(uuid.uuid4()),
        company_name="Assigned Client Corp",
        primary_contact_name="Contact Assigned",
        primary_contact_email="contact@assigned-corp.io",
        status="active",
        assigned_employee_id=emp.id,
    )
    db_session.add(assigned_client)
    db_session.commit()

    token = create_access_token(
        subject=emp.id, extra_claims={"email": emp.email, "role": emp.role}
    )
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "url": "https://example.com",
        "client_id": assigned_client.id,
        "scan_mode": "blackbox",
        "confirmed_authorization": True,
    }

    resp = client.post("/api/v1/engagements/website-audit", json=payload, headers=headers)
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.json()["status"] == "success"

    # Confirm records exist
    eng = db_session.query(Engagement).filter(Engagement.client_id == assigned_client.id).first()
    assert eng is not None
    assert eng.authorization_status == "confirmed"


def test_submit_website_audit_founder_allowed_on_assigned_client(auth_client: TestClient, db_session):
    """
    Verifies that founder users have global access to submit website audits,
    even when a client has an assigned employee.
    """
    emp = create_user(
        db_session,
        UserCreate(
            email="some-other-emp@lazynerds.com",
            password="EmployeePassword2026!",
            full_name="Other Employee",
            role="employee",
        ),
    )

    client_with_emp = Client(
        id=str(uuid.uuid4()),
        company_name="Staff Managed Enterprise",
        primary_contact_name="VIP Contact",
        primary_contact_email="vip@enterprise.io",
        status="active",
        assigned_employee_id=emp.id,
    )
    db_session.add(client_with_emp)
    db_session.commit()

    payload = {
        "url": "https://example.com",
        "client_id": client_with_emp.id,
        "scan_mode": "blackbox",
        "confirmed_authorization": True,
    }

    resp = auth_client.post("/api/v1/engagements/website-audit", json=payload)
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.json()["status"] == "success"


def test_submit_website_audit_ssrf_private_ip_resolved_blocked(auth_client: TestClient, active_client, monkeypatch):
    """
    Proves that a domain resolving via DNS to a private RFC 1918 address (e.g. 10.0.0.1)
    is rejected with 400 Bad Request by SSRF protection.
    """
    def fake_private_dns(host, port, *args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.1", port or 80))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_private_dns)
    monkeypatch.setattr("app.core.security.socket.getaddrinfo", fake_private_dns)

    payload = {
        "url": "https://intranet.corporate.com",
        "client_id": active_client.id,
        "confirmed_authorization": True,
    }
    resp = auth_client.post("/api/v1/engagements/website-audit", json=payload)
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    detail = resp.json()["detail"].lower()
    assert "private" in detail or "ssrf" in detail or "restricted" in detail


def test_submit_website_audit_authorizes_before_dns_resolution(auth_client: TestClient, client: TestClient, db_session, monkeypatch):
    """
    Proves that client existence and employee-assignment authorization are enforced
    BEFORE attempting any outbound DNS resolution.
    Even when DNS resolution fails with socket.gaierror, unassigned employees receive 403
    and nonexistent clients receive 404 without hitting DNS.
    """
    def broken_dns(host, port, *args, **kwargs):
        raise socket.gaierror(-2, "Name or service not known")

    monkeypatch.setattr(socket, "getaddrinfo", broken_dns)
    monkeypatch.setattr("app.core.security.socket.getaddrinfo", broken_dns)

    # 1. Nonexistent client returns 404 even with failing DNS
    resp_404 = auth_client.post(
        "/api/v1/engagements/website-audit",
        json={
            "url": "https://unresolvable-broken-domain-999.io",
            "client_id": str(uuid.uuid4()),
            "confirmed_authorization": True,
        },
    )
    assert resp_404.status_code == status.HTTP_404_NOT_FOUND

    # 2. Unassigned employee returns 403 even with failing DNS
    emp1 = create_user(
        db_session,
        UserCreate(
            email="emp-no-dns@lazynerds.com",
            password="EmployeePassword2026!",
            full_name="Emp No DNS",
            role="employee",
        ),
    )
    emp2 = create_user(
        db_session,
        UserCreate(
            email="emp2-dns-owner@lazynerds.com",
            password="EmployeePassword2026!",
            full_name="Emp2 Owner",
            role="employee",
        ),
    )
    client_assigned = Client(
        id=str(uuid.uuid4()),
        company_name="DNS Isolated Org",
        primary_contact_name="Lead",
        primary_contact_email="lead@dns-isolated.io",
        status="active",
        assigned_employee_id=emp2.id,
    )
    db_session.add(client_assigned)
    db_session.commit()

    token1 = create_access_token(subject=emp1.id, extra_claims={"email": emp1.email, "role": emp1.role})
    resp_403 = client.post(
        "/api/v1/engagements/website-audit",
        json={
            "url": "https://unresolvable-broken-domain-999.io",
            "client_id": client_assigned.id,
            "confirmed_authorization": True,
        },
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert resp_403.status_code == status.HTTP_403_FORBIDDEN
    assert "not assigned to this client record" in resp_403.json()["detail"].lower()


def test_website_audit_end_to_end_genuine_findings_retrieval(auth_client: TestClient, active_client, monkeypatch, db_session):
    """
    Verifies the complete end-to-end Website Audit pipeline:
    1. User submits target URL to /api/v1/engagements/website-audit.
    2. Scanner executes real checks (HTTP response, TLS, security headers).
    3. Assessment completes with real execution summary.
    4. GET /api/v1/findings?assessment_id=... returns genuine findings directly for in-page display.
    """
    from app.core.config import settings
    monkeypatch.setattr(settings, "ALLOW_LAB_TESTING", True)
    monkeypatch.setattr(settings, "WORKER_DISPATCH_MODE", "embedded")

    payload = {
        "url": "http://127.0.0.1:8888",
        "client_id": active_client.id,
        "scan_mode": "blackbox",
        "confirmed_authorization": True,
        "notes": "Automated end-to-end integration test.",
    }
    resp = auth_client.post("/api/v1/engagements/website-audit", json=payload)
    assert resp.status_code == 201, resp.text
    audit_data = resp.json()
    assessment_id = audit_data["assessment_id"]

    check_resp = auth_client.get(f"/api/v1/findings/assessments/{assessment_id}")
    assert check_resp.status_code == 200
    assessment_data = check_resp.json()
    assert assessment_data["status"] == "completed"
    assert assessment_data["findings_count"] > 0

    # Retrieve findings specifically for this assessment
    findings_resp = auth_client.get(f"/api/v1/findings?assessment_id={assessment_id}")
    assert findings_resp.status_code == 200
    findings_list = findings_resp.json()
    assert findings_list["total"] == assessment_data["findings_count"]

    # Verify that findings are genuine security observations
    titles = [f["title"] for f in findings_list["items"]]
    assert any("Content-Security-Policy" in t for t in titles)
    assert any("X-Frame-Options" in t or "Clickjacking" in t for t in titles)
    for f in findings_list["items"]:
        assert f["evidence"] is not None and len(f["evidence"]) > 0
        assert f["remediation_guidance"] is not None
        assert "[Source:" in f["remediation_notes"]

