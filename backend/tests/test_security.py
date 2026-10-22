import pytest
from fastapi import status
from app.core.config import Settings, INSECURE_DEV_SECRET
from app.core.security import decode_access_token, create_access_token


def test_tampered_token_rejected(client):
    """Tests that cryptographically tampered or forged JWT tokens are rejected."""
    tampered_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.tampered_signature"
    client.headers.update({"Authorization": f"Bearer {tampered_token}"})
    response = client.get("/api/v1/clients")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Session has expired or is invalid" in response.json()["detail"]


def test_error_sanitization_no_leakage(client):
    """Tests that error responses do not leak SQL syntax or internal environment secrets."""
    # Sending bad payload to check error format
    response = client.post("/api/v1/clients", json="not a json object")
    assert response.status_code in [
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_422_UNPROCESSABLE_ENTITY
    ]
    raw_text = response.text.lower()
    # Check that secrets and internal implementation details are not leaked
    assert "password" not in raw_text or "invalid" in raw_text
    assert "secret_key" not in raw_text
    assert "database_url" not in raw_text
    assert "traceback (most recent call last)" not in raw_text


def test_production_rejects_insecure_default_secret_key():
    """Tests that production environment strictly aborts startup if using known default secret key."""
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(ENVIRONMENT="production", SECRET_KEY=INSECURE_DEV_SECRET)


def test_production_rejects_short_secret_key():
    """Tests that production environment strictly aborts startup if SECRET_KEY is shorter than 32 characters."""
    with pytest.raises(ValueError, match="at least 32 characters"):
        Settings(ENVIRONMENT="production", SECRET_KEY="short-secret-key-1234")


def test_production_accepts_strong_secret_key():
    """Tests that production environment succeeds with a sufficiently strong secret key."""
    strong_key = "a" * 48
    s = Settings(ENVIRONMENT="production", SECRET_KEY=strong_key, ALLOWED_ORIGINS="https://lazynerds.vercel.app")
    assert s.SECRET_KEY == strong_key


def test_allowed_origins_parsing_comma_separated():
    """Tests that ALLOWED_ORIGINS parses comma-separated URLs cleanly."""
    origins = Settings.parse_allowed_origins("https://lazynerds.vercel.app, https://preview.lazynerds.vercel.app")
    assert origins == ["https://lazynerds.vercel.app", "https://preview.lazynerds.vercel.app"]


def test_allowed_origins_parsing_json_array():
    """Tests that ALLOWED_ORIGINS parses JSON array strings cleanly."""
    origins = Settings.parse_allowed_origins('["https://lazynerds.vercel.app", "https://lazynerds-backend.onrender.com"]')
    assert origins == ["https://lazynerds.vercel.app", "https://lazynerds-backend.onrender.com"]


def test_allowed_origins_rejects_wildcard():
    """Tests that wildcard '*' is strictly prohibited when credentials are enabled."""
    with pytest.raises(ValueError, match="Wildcard"):
        Settings.parse_allowed_origins("https://example.com, *")


def test_production_rejects_missing_allowed_origins():
    """Tests that production environment strictly aborts if ALLOWED_ORIGINS is empty or missing."""
    strong_key = "a" * 48
    with pytest.raises(ValueError, match="ALLOWED_ORIGINS must be explicitly configured"):
        Settings(ENVIRONMENT="production", SECRET_KEY=strong_key, ALLOWED_ORIGINS="")


def test_production_rejects_localhost_only_origins():
    """Tests that production environment strictly aborts if ALLOWED_ORIGINS only contains localhost."""
    strong_key = "a" * 48
    with pytest.raises(ValueError, match="at least one non-localhost production origin"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY=strong_key,
            ALLOWED_ORIGINS="http://localhost:3000, http://127.0.0.1:8000"
        )


def test_production_accepts_valid_production_origins():
    """Tests that production succeeds when non-localhost origins are provided."""
    strong_key = "a" * 48
    s = Settings(
        ENVIRONMENT="production",
        SECRET_KEY=strong_key,
        ALLOWED_ORIGINS="https://lazynerds.vercel.app, https://preview.lazynerds.vercel.app"
    )
    assert s.ALLOWED_ORIGINS == ["https://lazynerds.vercel.app", "https://preview.lazynerds.vercel.app"]


def test_basesettings_real_env_var_comma_separated(monkeypatch):
    """Verifies that BaseSettings accurately decodes a comma-separated env var through the real settings initialization path."""
    strong_key = "k" * 36
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", strong_key)
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://lazynerds.vercel.app, https://preview.lazynerds.vercel.app")
    s = Settings()
    assert s.ALLOWED_ORIGINS == ["https://lazynerds.vercel.app", "https://preview.lazynerds.vercel.app"]


def test_basesettings_real_env_var_json_array(monkeypatch):
    """Verifies that BaseSettings accurately decodes a JSON-array env var through the real settings initialization path."""
    strong_key = "k" * 36
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", strong_key)
    monkeypatch.setenv("ALLOWED_ORIGINS", '["https://lazynerds.vercel.app", "https://lazynerds-backend.onrender.com"]')
    s = Settings()
    assert s.ALLOWED_ORIGINS == ["https://lazynerds.vercel.app", "https://lazynerds-backend.onrender.com"]


def test_development_fallback_when_origins_unset(monkeypatch):
    """Verifies that development preserves default localhost origins when ALLOWED_ORIGINS is empty or unset."""
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    s = Settings()
    assert "http://localhost:3000" in s.ALLOWED_ORIGINS
    assert "http://127.0.0.1:8000" in s.ALLOWED_ORIGINS


def test_query_param_token_rejected_for_security(client, auth_headers):
    """
    Verifies that JWT tokens provided via query string (?token=...) are strictly rejected.
    Tokens in URLs leak through browser history, proxy/access logs, and Referer headers (OWASP API2:2023).
    Only Authorization: Bearer or HttpOnly cookies are permitted.
    """
    # Extract raw JWT from Authorization header
    raw_token = auth_headers["Authorization"].split("Bearer ")[1]

    # Request without Authorization header, passing token only in query params
    response = client.get(f"/api/v1/clients?token={raw_token}")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Authentication required" in response.json()["detail"]


def test_client_report_and_finding_authorization_boundaries(client, db_session):
    """
    Verifies multi-tenant data isolation:
    Client A cannot read or download Client B's reports or findings,
    and client users cannot generate arbitrary reports.
    """
    from app.models.client import Client
    from app.models.engagement import Engagement
    from app.models.report import Report
    from app.models.finding import Finding
    from app.models.user import User
    from app.schemas.auth import UserCreate
    from app.services.auth_service import create_user

    # 1. Create Client Organization B and its Engagement, Report, Finding
    client_b = Client(
        company_name="Client B Financial",
        primary_contact_name="Bob Banker",
        primary_contact_email="bob@clientb.com",
    )
    db_session.add(client_b)
    db_session.commit()

    eng_b = Engagement(
        client_id=client_b.id,
        name="Client B Annual Pentest",
        assessment_type="External Penetration Test",
        status="completed",
        authorization_status="confirmed",
    )
    db_session.add(eng_b)
    db_session.commit()

    report_b = Report(
        engagement_id=eng_b.id,
        title="Client B Vulnerability Report",
        report_type="full_assessment",
        status="generated",
        summary_content="# Confidential Findings for Client B",
    )
    finding_b = Finding(
        engagement_id=eng_b.id,
        title="Confidential Payment Gateway Flaw",
        severity="critical",
        status="open",
        assigned_to="lead@lazynerds.com",
    )
    db_session.add_all([report_b, finding_b])
    db_session.commit()

    # 2. Create Client User A belonging to Client Organization A
    client_a = Client(
        company_name="Client A Retail",
        primary_contact_name="Alice Owner",
        primary_contact_email="alice@clienta.com",
    )
    db_session.add(client_a)
    db_session.commit()

    user_a = create_user(
        db_session,
        UserCreate(
            email="alice@clienta.com",
            password="SecurePassword2026!",
            full_name="Alice Owner",
            role="client",
            client_id=client_a.id,
        ),
    )
    token_a = create_access_token(
        subject=user_a.id,
        extra_claims={"email": user_a.email, "role": user_a.role, "client_id": user_a.client_id},
    )
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 3. Test: Client A attempts to fetch Client B's report -> 403 Forbidden
    res = client.get(f"/api/v1/reports/{report_b.id}", headers=headers_a)
    assert res.status_code == status.HTTP_403_FORBIDDEN
    assert "not authorized" in res.json()["detail"].lower()

    # 4. Test: Client A attempts to download Client B's report -> 403 Forbidden
    res_dl = client.get(f"/api/v1/reports/{report_b.id}/download?format=html", headers=headers_a)
    assert res_dl.status_code == status.HTTP_403_FORBIDDEN
    assert "not authorized" in res_dl.json()["detail"].lower()

    # 5. Test: Client A attempts to view Client B's finding -> 403 Forbidden
    res_f = client.get(f"/api/v1/findings/{finding_b.id}", headers=headers_a)
    assert res_f.status_code == status.HTTP_403_FORBIDDEN
    assert "not authorized" in res_f.json()["detail"].lower()

    # 6. Test: Client A attempts to generate a report -> 403 Forbidden
    res_gen = client.post(
        "/api/v1/reports",
        json={"engagement_id": eng_b.id, "title": "Malicious Report", "report_type": "executive_summary"},
        headers=headers_a,
    )
    assert res_gen.status_code == status.HTTP_403_FORBIDDEN
    assert "may not generate" in res_gen.json()["detail"].lower()

    # 7. Test: Client A listing reports does NOT disclose Client B's report
    res_list = client.get("/api/v1/reports", headers=headers_a)
    assert res_list.status_code == status.HTTP_200_OK
    items = res_list.json()["items"]
    assert not any(r["id"] == report_b.id for r in items)


def test_client_asset_tenant_isolation(client, db_session):
    """
    Verifies multi-tenant isolation on digital assets:
    - Client A cannot list, read, or update Client B's assets.
    - A forged client_id query param is overridden to the caller's organization.
    - Client A cannot create or delete assets for Client B.
    """
    from app.models.client import Client
    from app.models.engagement import Engagement
    from app.models.asset import Asset
    from app.schemas.auth import UserCreate
    from app.services.auth_service import create_user

    # 1. Setup Client Org B with an Asset
    client_b = Client(
        company_name="Organization B Systems",
        primary_contact_name="Bob Admin",
        primary_contact_email="bob@orgb.com",
    )
    db_session.add(client_b)
    db_session.commit()

    eng_b = Engagement(
        client_id=client_b.id,
        name="Org B Scope Engagement",
        assessment_type="Cloud Penetration Test",
        status="completed",
        authorization_status="confirmed",
    )
    db_session.add(eng_b)
    db_session.commit()

    asset_b = Asset(
        client_id=client_b.id,
        engagement_id=eng_b.id,
        name="Org B Confidential Database Cluster",
        asset_type="cloud_resource",
        target="10.200.0.50",
        environment="production",
        criticality="critical",
        in_scope=True,
    )
    db_session.add(asset_b)
    db_session.commit()

    # 2. Setup Client Org A with an Asset and a Client User
    client_a = Client(
        company_name="Organization A Retail",
        primary_contact_name="Alice Director",
        primary_contact_email="alice@orga.com",
    )
    db_session.add(client_a)
    db_session.commit()

    asset_a = Asset(
        client_id=client_a.id,
        name="Org A Public Storefront",
        asset_type="web_application",
        target="https://shop.orga.com",
        environment="production",
        criticality="high",
        in_scope=True,
    )
    db_session.add(asset_a)
    db_session.commit()

    user_a = create_user(
        db_session,
        UserCreate(
            email="alice@orga.com",
            password="SecurePassword2026!",
            full_name="Alice Director",
            role="client",
            client_id=client_a.id,
        ),
    )
    token_a = create_access_token(
        subject=user_a.id,
        extra_claims={"email": user_a.email, "role": user_a.role, "client_id": user_a.client_id},
    )
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Test 1: Client A listing assets only sees Client A's assets
    list_res = client.get("/api/v1/assets", headers=headers_a)
    assert list_res.status_code == status.HTTP_200_OK
    items = list_res.json()["items"]
    assert any(item["id"] == asset_a.id for item in items)
    assert not any(item["id"] == asset_b.id for item in items)

    # Test 2: Forged client_id query param is safely overridden to user's client_id
    forged_list = client.get(f"/api/v1/assets?client_id={client_b.id}", headers=headers_a)
    assert forged_list.status_code == status.HTTP_200_OK
    forged_items = forged_list.json()["items"]
    assert not any(item["id"] == asset_b.id for item in forged_items)

    # Test 3: Direct GET /assets/{id} for Client B's asset -> 403 Forbidden
    get_res = client.get(f"/api/v1/assets/{asset_b.id}", headers=headers_a)
    assert get_res.status_code == status.HTTP_403_FORBIDDEN
    assert "not authorized to view another organization's assets" in get_res.json()["detail"].lower()

    # Test 4: Direct PATCH /assets/{id} for Client B's asset -> 403 Forbidden
    patch_res = client.patch(
        f"/api/v1/assets/{asset_b.id}",
        json={"name": "Hacked Asset Name"},
        headers=headers_a,
    )
    assert patch_res.status_code == status.HTTP_403_FORBIDDEN
    assert "not authorized to modify another organization's assets" in patch_res.json()["detail"].lower()

    # Verify db record was untouched
    db_session.refresh(asset_b)
    assert asset_b.name == "Org B Confidential Database Cluster"

    # Test 5: Direct DELETE /assets/{id} for Client B's asset -> 403 Forbidden
    del_res = client.delete(f"/api/v1/assets/{asset_b.id}", headers=headers_a)
    assert del_res.status_code == status.HTTP_403_FORBIDDEN
    assert "not authorized to delete another organization's assets" in del_res.json()["detail"].lower()

    # Test 6: POST /assets with forged client_id belonging to Org B -> 403 Forbidden
    post_res = client.post(
        "/api/v1/assets",
        json={
            "client_id": client_b.id,
            "name": "Injected Org B Asset",
            "asset_type": "api",
            "target": "https://injected.orgb.com",
        },
        headers=headers_a,
    )
    assert post_res.status_code == status.HTTP_403_FORBIDDEN
    assert "not authorized to create assets for another organization" in post_res.json()["detail"].lower()

    # Test 7: Legitimate update on Client A's own asset succeeds
    legit_patch = client.patch(
        f"/api/v1/assets/{asset_a.id}",
        json={"name": "Org A Public Storefront v2"},
        headers=headers_a,
    )
    assert legit_patch.status_code == status.HTTP_200_OK
    assert legit_patch.json()["name"] == "Org A Public Storefront v2"


def test_client_assessment_tenant_isolation(client, db_session):
    """
    Verifies multi-tenant isolation on assessments:
    - Client A cannot read Client B's assessment records.
    - Assessment listing for Client A does not disclose Client B's assessments.
    """
    from app.models.client import Client
    from app.models.engagement import Engagement
    from app.models.finding import Assessment
    from app.schemas.auth import UserCreate
    from app.services.auth_service import create_user

    # Setup Org B and Assessment
    client_b = Client(
        company_name="Org B Enterprise",
        primary_contact_name="Bob Enterprise",
        primary_contact_email="b@enterprise.com",
    )
    db_session.add(client_b)
    db_session.commit()

    eng_b = Engagement(client_id=client_b.id, name="Org B Assessment Scope", assessment_type="Web App Pentest")
    db_session.add(eng_b)
    db_session.commit()

    asmt_b = Assessment(
        engagement_id=eng_b.id,
        name="Org B Automated Vulnerability Assessment",
        assessment_tool="nuclei",
        status="completed",
        findings_count=3,
    )
    db_session.add(asmt_b)
    db_session.commit()

    # Setup Org A, Engagement, Assessment, and User
    client_a = Client(
        company_name="Org A Logistics",
        primary_contact_name="Alice Logistics",
        primary_contact_email="a@logistics.com",
    )
    db_session.add(client_a)
    db_session.commit()

    eng_a = Engagement(client_id=client_a.id, name="Org A Assessment Scope", assessment_type="API Pentest")
    db_session.add(eng_a)
    db_session.commit()

    asmt_a = Assessment(
        engagement_id=eng_a.id,
        name="Org A Assessment Scan",
        assessment_tool="owasp_zap",
        status="completed",
        findings_count=1,
    )
    db_session.add(asmt_a)
    db_session.commit()

    user_a = create_user(
        db_session,
        UserCreate(
            email="ops@logistics.com",
            password="SecurePassword2026!",
            full_name="Alice Ops",
            role="client",
            client_id=client_a.id,
        ),
    )
    token_a = create_access_token(
        subject=user_a.id,
        extra_claims={"email": user_a.email, "role": user_a.role, "client_id": user_a.client_id},
    )
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Cross-tenant GET /findings/assessments/{id} -> 403 Forbidden
    res_b = client.get(f"/api/v1/findings/assessments/{asmt_b.id}", headers=headers_a)
    assert res_b.status_code == status.HTTP_403_FORBIDDEN
    assert "not authorized to view another organization's assessment" in res_b.json()["detail"].lower()

    # Legitimate GET /findings/assessments/{id} -> 200 OK
    res_a = client.get(f"/api/v1/findings/assessments/{asmt_a.id}", headers=headers_a)
    assert res_a.status_code == status.HTTP_200_OK
    assert res_a.json()["id"] == asmt_a.id

    # List assessments scoped to Org A
    list_res = client.get("/api/v1/findings/assessments", headers=headers_a)
    assert list_res.status_code == status.HTTP_200_OK
    items = list_res.json()["items"]
    assert any(i["id"] == asmt_a.id for i in items)
    assert not any(i["id"] == asmt_b.id for i in items)


def test_client_blocked_from_employee_only_finding_mutations(client, db_session):
    """
    Verifies that client accounts cannot create findings, import scans, or add verification records,
    as these are restricted to employees and founders.
    """
    from app.models.client import Client
    from app.models.engagement import Engagement
    from app.models.finding import Finding
    from app.schemas.auth import UserCreate
    from app.services.auth_service import create_user

    client_a = Client(
        company_name="Org A Tech",
        primary_contact_name="Alice Tech",
        primary_contact_email="a@tech.com",
    )
    db_session.add(client_a)
    db_session.commit()

    eng_a = Engagement(client_id=client_a.id, name="Org A Web Scope", assessment_type="Web App Pentest")
    db_session.add(eng_a)
    db_session.commit()

    finding_a = Finding(
        engagement_id=eng_a.id,
        title="Valid Finding",
        severity="medium",
        status="open",
        assigned_to="staff@lazynerds.com",
    )
    db_session.add(finding_a)
    db_session.commit()

    user_a = create_user(
        db_session,
        UserCreate(
            email="client@tech.com",
            password="SecurePassword2026!",
            full_name="Tech Client",
            role="client",
            client_id=client_a.id,
        ),
    )
    token_a = create_access_token(
        subject=user_a.id,
        extra_claims={"email": user_a.email, "role": user_a.role, "client_id": user_a.client_id},
    )
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 1. POST /findings -> 403 Forbidden
    create_res = client.post(
        "/api/v1/findings",
        json={"engagement_id": eng_a.id, "title": "Injected Finding", "severity": "low"},
        headers=headers_a,
    )
    assert create_res.status_code == status.HTTP_403_FORBIDDEN
    assert "internal fixops operations privileges required" in create_res.json()["detail"].lower()

    # 2. POST /findings/import-scan -> 403 Forbidden
    scan_res = client.post(
        "/api/v1/findings/import-scan",
        json={"engagement_id": eng_a.id, "tool_name": "nuclei", "scan_data": "{}"},
        headers=headers_a,
    )
    assert scan_res.status_code == status.HTTP_403_FORBIDDEN
    assert "internal fixops operations privileges required" in scan_res.json()["detail"].lower()

    # 3. POST /findings/{id}/verifications -> 403 Forbidden
    verif_res = client.post(
        f"/api/v1/findings/{finding_a.id}/verifications",
        json={"status": "passed", "verification_type": "manual", "notes": "Faked pass"},
        headers=headers_a,
    )
    assert verif_res.status_code == status.HTTP_403_FORBIDDEN
    assert "internal fixops operations privileges required" in verif_res.json()["detail"].lower()


def test_client_blocked_from_internal_automation_management(client, auth_headers, db_session):
    """
    Verifies that client accounts receive 403 Forbidden when accessing internal automation endpoints,
    while employee/founder credentials succeed.
    """
    from app.models.client import Client
    from app.schemas.auth import UserCreate
    from app.services.auth_service import create_user

    client_a = Client(
        company_name="Org A Cloud",
        primary_contact_name="Alice Cloud",
        primary_contact_email="a@cloud.com",
    )
    db_session.add(client_a)
    db_session.commit()

    user_a = create_user(
        db_session,
        UserCreate(
            email="user@cloud.com",
            password="SecurePassword2026!",
            full_name="Cloud User",
            role="client",
            client_id=client_a.id,
        ),
    )
    token_a = create_access_token(
        subject=user_a.id,
        extra_claims={"email": user_a.email, "role": user_a.role, "client_id": user_a.client_id},
    )
    client_headers = {"Authorization": f"Bearer {token_a}"}

    # 1. GET /automation/rules -> 403
    r = client.get("/api/v1/automation/rules", headers=client_headers)
    assert r.status_code == status.HTTP_403_FORBIDDEN

    # 2. POST /automation/rules -> 403
    r = client.post(
        "/api/v1/automation/rules",
        json={"name": "Malicious Rule", "trigger_event": "on_finding_created", "action_type": "webhook"},
        headers=client_headers,
    )
    assert r.status_code == status.HTTP_403_FORBIDDEN

    # 3. GET /automation/executions -> 403
    r = client.get("/api/v1/automation/executions", headers=client_headers)
    assert r.status_code == status.HTTP_403_FORBIDDEN

    # 4. POST /automation/dispatch -> 403
    r = client.post(
        "/api/v1/automation/dispatch",
        json={"rule_id": "non-existent-rule-id"},
        headers=client_headers,
    )
    assert r.status_code == status.HTTP_403_FORBIDDEN

    # 5. GET /automation/remediation-reminders/status -> 403
    r = client.get("/api/v1/automation/remediation-reminders/status", headers=client_headers)
    assert r.status_code == status.HTTP_403_FORBIDDEN

    # 6. POST /automation/remediation-reminders/run -> 403
    r = client.post("/api/v1/automation/remediation-reminders/run", headers=client_headers)
    assert r.status_code == status.HTTP_403_FORBIDDEN

    # 7. Internal staff (auth_headers) succeeds accessing rules and status
    internal_rules = client.get("/api/v1/automation/rules", headers=auth_headers)
    assert internal_rules.status_code == status.HTTP_200_OK

    internal_status = client.get("/api/v1/automation/remediation-reminders/status", headers=auth_headers)
    assert internal_status.status_code == status.HTTP_200_OK


def test_remediation_engine_rollback_on_candidate_failure(monkeypatch):
    """
    Verifies that if an individual finding triggers an error during reminder evaluation,
    an explicit db.rollback() restores the session so subsequent findings and the
    final execution record are successfully processed.
    """
    from datetime import datetime, timezone, timedelta
    from tests.conftest import TestingSessionLocal
    from app.models.client import Client
    from app.models.engagement import Engagement
    from app.models.finding import Finding
    from app.services import automation_engine, notification_service

    db = TestingSessionLocal()
    try:
        client_record = Client(
            company_name="Batch Test Inc",
            primary_contact_name="Batch Contact",
            primary_contact_email="b@batch.com",
        )
        db.add(client_record)
        db.commit()

        eng = Engagement(
            client_id=client_record.id,
            name="Batch Follow-up Eng",
            assessment_type="Network Test",
            status="in_progress",
            authorization_status="confirmed",
        )
        db.add(eng)
        db.commit()

        today = datetime.now(timezone.utc).date()
        finding_fail = Finding(
            engagement_id=eng.id,
            title="Finding That Fails",
            severity="high",
            status="open",
            assigned_to="fail@lazynerds.com",
            remediation_deadline=today + timedelta(days=1),
        )
        finding_success = Finding(
            engagement_id=eng.id,
            title="Finding That Succeeds",
            severity="medium",
            status="open",
            assigned_to="success@lazynerds.com",
            remediation_deadline=today + timedelta(days=2),
        )
        db.add_all([finding_fail, finding_success])
        db.commit()

        original_create = notification_service.create_notification

        def mock_create_notification(db, recipient_email, title, message, notification_type="system", link=None):
            if "fail@lazynerds.com" in recipient_email:
                # Simulate a database constraint failure or operational error
                raise RuntimeError("Simulated transient database/notification error")
            return original_create(db, recipient_email, title, message, notification_type, link)

        monkeypatch.setattr(automation_engine, "create_notification", mock_create_notification)

        # Run the remediation engine
        result = automation_engine.run_remediation_followup_reminders(
            db=db,
            reminder_window_days=3,
            operator_email="runner@lazynerds.com",
        )

        # Both findings were evaluated
        assert result["findings_checked"] >= 2
        # The failing finding was caught and counted as error
        assert result["errors"] == 1
        # Because db.rollback() cleaned up the failed transaction, the second finding succeeded!
        assert result["reminders_sent"] >= 1
        assert result["status"] == "completed"
    finally:
        db.close()
