import uuid
import pytest
from fastapi.testclient import TestClient

from app.models.client import Client
from app.models.engagement import Engagement
from app.models.asset import Asset
from app.models.finding import Assessment


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
