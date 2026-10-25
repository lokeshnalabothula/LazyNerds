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
