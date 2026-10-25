import pytest
from datetime import datetime, timezone, timedelta
from fastapi import status

from app.core.config import settings
from app.core.security import create_access_token
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.asset import Asset
from app.models.finding import Finding, Assessment
from app.models.report import Report
from app.models.user import User
from app.models.registration import ClientRegistration
from app.schemas.auth import UserCreate
from app.services.auth_service import create_user
from app.services import registration_service


def test_stored_xss_prevention_in_report_download(client, auth_headers, db_session):
    """Verifies that malicious HTML/JavaScript tags in reports are escaped in HTML download format."""
    client_rec = Client(
        company_name="XSS Test Corp",
        primary_contact_name="Alice Sec",
        primary_contact_email="alice@xsstest.com",
        status="active",
    )
    db_session.add(client_rec)
    db_session.commit()

    eng = Engagement(
        client_id=client_rec.id,
        name="Security Audit <script>alert('eng')</script>",
        assessment_type="Web App Pen Test",
        status="in_progress",
        authorization_status="confirmed",
    )
    db_session.add(eng)
    db_session.commit()

    malicious_title = 'Report Title </title><script>alert("xss-title")</script>'
    malicious_content = '# Report\nFinding: </pre><script>alert("xss-body")</script><img src=x onerror=alert(1)>'
    report = Report(
        engagement_id=eng.id,
        title=malicious_title,
        report_type="executive_summary",
        status="generated",
        summary_content=malicious_content,
        generated_by="Founder Test",
    )
    db_session.add(report)
    db_session.commit()

    res = client.get(f"/api/v1/reports/{report.id}/download?format=html", headers=auth_headers)
    assert res.status_code == status.HTTP_200_OK
    assert "<!DOCTYPE html>" in res.text
    # Unescaped closing tag or raw script tag must NOT exist in the response
    assert '</title><script>alert("xss-title")</script>' not in res.text
    assert '&lt;/title&gt;&lt;script&gt;alert(&quot;xss-title&quot;)&lt;/script&gt;' in res.text
    assert '</pre><script>alert("xss-body")</script>' not in res.text
    assert '&lt;/pre&gt;&lt;script&gt;alert(&quot;xss-body&quot;)&lt;/script&gt;' in res.text
    assert '<img src=x onerror=alert(1)>' not in res.text
    assert '&lt;img src=x onerror=alert(1)&gt;' in res.text


def test_forgot_password_no_enumeration_in_production(client, test_user, monkeypatch):
    """Verifies that in production mode with unconfigured email, existing and non-existing accounts return 503 identically."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "RESEND_API_KEY", None)
    monkeypatch.setattr(settings, "SMTP_HOST", None)
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "auto")

    # Known existing user
    res1 = client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})
    assert res1.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert "temporarily unavailable" in res1.json()["detail"].lower()

    # Unknown non-existing email
    res2 = client.post("/api/v1/auth/forgot-password", json={"email": "nonexistent-ghost-account@lazynerds.com"})
    assert res2.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert res1.json() == res2.json()


def test_scan_import_rejects_cross_client_asset(client, auth_headers, db_session):
    """Verifies that scan import rejects linking an asset that belongs to a different client."""
    c1 = Client(company_name="Client One Org", primary_contact_name="Contact 1", primary_contact_email="c1@one.com")
    c2 = Client(company_name="Client Two Org", primary_contact_name="Contact 2", primary_contact_email="c2@two.com")
    db_session.add_all([c1, c2])
    db_session.commit()

    eng1 = Engagement(client_id=c1.id, name="Client 1 Audit", assessment_type="Web App Pen Test", status="in_progress", authorization_status="confirmed")
    asset2 = Asset(client_id=c2.id, name="Client 2 Asset", asset_type="api", target="https://api.two.com", in_scope=True, authorization_status="verified")
    db_session.add_all([eng1, asset2])
    db_session.commit()

    # Attempt to import scan with eng1 and asset2 (different clients)
    res = client.post(
        "/api/v1/findings/import-scan",
        json={
            "engagement_id": eng1.id,
            "target_asset_id": asset2.id,
            "tool_name": "nuclei",
            "scan_data": "[]",
            "auto_create_findings": False,
        },
        headers=auth_headers,
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "target asset does not belong" in res.json()["detail"].lower()


def test_scan_import_and_finding_creation_reject_terminal_engagements(client, auth_headers, db_session):
    """Verifies that completed or cancelled engagements cannot have findings or scans added."""
    c = Client(company_name="Terminal Client Org", primary_contact_name="Terminal Lead", primary_contact_email="term@client.com")
    db_session.add(c)
    db_session.commit()

    eng_completed = Engagement(client_id=c.id, name="Completed Audit", assessment_type="Web App Pen Test", status="completed", authorization_status="confirmed")
    eng_cancelled = Engagement(client_id=c.id, name="Cancelled Audit", assessment_type="Web App Pen Test", status="cancelled", authorization_status="confirmed")
    db_session.add_all([eng_completed, eng_cancelled])
    db_session.commit()

    # 1. Finding creation on completed engagement
    res_f1 = client.post(
        "/api/v1/findings",
        json={
            "engagement_id": eng_completed.id,
            "title": "Post-Audit Injected Vulnerability",
            "severity": "high",
        },
        headers=auth_headers,
    )
    assert res_f1.status_code == status.HTTP_400_BAD_REQUEST
    assert "completed" in res_f1.json()["detail"].lower()

    # 2. Finding creation on cancelled engagement
    res_f2 = client.post(
        "/api/v1/findings",
        json={
            "engagement_id": eng_cancelled.id,
            "title": "Cancelled Audit Finding",
            "severity": "low",
        },
        headers=auth_headers,
    )
    assert res_f2.status_code == status.HTTP_400_BAD_REQUEST
    assert "cancelled" in res_f2.json()["detail"].lower()

    # 3. Scan import on completed engagement
    res_s1 = client.post(
        "/api/v1/findings/import-scan",
        json={
            "engagement_id": eng_completed.id,
            "tool_name": "nuclei",
            "scan_data": "[]",
        },
        headers=auth_headers,
    )
    assert res_s1.status_code == status.HTTP_400_BAD_REQUEST
    assert "completed" in res_s1.json()["detail"].lower()


def test_update_finding_validates_asset_client_ownership(client, auth_headers, db_session):
    """Verifies that updating finding.asset_id requires the asset to exist and belong to the same client."""
    c1 = Client(company_name="Alpha Client", primary_contact_name="Alpha Contact", primary_contact_email="a@alpha.com")
    c2 = Client(company_name="Beta Client", primary_contact_name="Beta Contact", primary_contact_email="b@beta.com")
    db_session.add_all([c1, c2])
    db_session.commit()

    eng1 = Engagement(client_id=c1.id, name="Alpha Engagement", assessment_type="Web App Pen Test", status="in_progress", authorization_status="confirmed")
    asset_alpha = Asset(client_id=c1.id, name="Alpha Asset", asset_type="web_application", target="https://alpha.com", in_scope=True)
    asset_beta = Asset(client_id=c2.id, name="Beta Asset", asset_type="web_application", target="https://beta.com", in_scope=True)
    db_session.add_all([eng1, asset_alpha, asset_beta])
    db_session.commit()

    finding = Finding(
        engagement_id=eng1.id,
        asset_id=asset_alpha.id,
        title="SQL Injection",
        severity="critical",
        status="open",
    )
    db_session.add(finding)
    db_session.commit()

    # Attempt to update finding with asset belonging to Beta Client
    res_bad = client.patch(
        f"/api/v1/findings/{finding.id}",
        json={"asset_id": asset_beta.id},
        headers=auth_headers,
    )
    assert res_bad.status_code == status.HTTP_400_BAD_REQUEST
    assert "does not belong to the engagement's client" in res_bad.json()["detail"].lower()

    # Attempt to update with nonexistent asset_id
    res_none = client.patch(
        f"/api/v1/findings/{finding.id}",
        json={"asset_id": "00000000-0000-0000-0000-000000000000"},
        headers=auth_headers,
    )
    assert res_none.status_code == status.HTTP_400_BAD_REQUEST
    assert "referenced asset does not exist" in res_none.json()["detail"].lower()


def test_finding_not_found_returns_404(client, auth_headers):
    """Verifies that modifying a non-existent finding returns 404 Not Found."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    res_patch = client.patch(f"/api/v1/findings/{fake_id}", json={"title": "Updated Title"}, headers=auth_headers)
    assert res_patch.status_code == status.HTTP_404_NOT_FOUND
    assert "not found" in res_patch.json()["detail"].lower()

    res_verif = client.post(
        f"/api/v1/findings/{fake_id}/verifications",
        json={"result": "passed", "verification_method": "manual_verification"},
        headers=auth_headers,
    )
    assert res_verif.status_code == status.HTTP_404_NOT_FOUND
    assert "not found" in res_verif.json()["detail"].lower()


def test_overview_metrics_counts_findings_without_assets(client, db_session):
    """Verifies that findings without an assigned asset (asset_id=None) are counted in client overview metrics."""
    c = Client(company_name="Unassigned Asset Client", primary_contact_name="Lead", primary_contact_email="lead@unassigned.com")
    db_session.add(c)
    db_session.commit()

    eng = Engagement(client_id=c.id, name="Platform Audit", assessment_type="Security Audit", status="in_progress", authorization_status="confirmed")
    db_session.add(eng)
    db_session.commit()

    # Finding with asset_id=None
    f1 = Finding(engagement_id=eng.id, asset_id=None, title="Finding Without Asset", severity="high", status="open")
    db_session.add(f1)
    db_session.commit()

    client_user = create_user(
        db_session,
        UserCreate(
            email="portal@unassigned.com",
            password="SecurePassword2026!",
            full_name="Portal User",
            role="client",
            client_id=c.id,
        ),
    )
    token = create_access_token(
        subject=client_user.id,
        extra_claims={"email": client_user.email, "role": client_user.role, "client_id": client_user.client_id},
    )
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/overview/metrics", headers=headers)
    assert res.status_code == status.HTTP_200_OK
    metrics = res.json()
    assert metrics["findings_total"] == 1
    assert metrics["findings_open"] == 1
    assert metrics["high_findings_open"] == 1
    assert metrics["severity_distribution"]["high"] == 1


def test_employee_assignment_isolated_on_archive_and_engagement_mutations(client, db_session):
    """Verifies that an employee cannot mutate clients or engagements assigned to a different employee."""
    emp1 = create_user(db_session, UserCreate(email="emp1@lazynerds.com", password="Password2026!", full_name="Emp One", role="employee"))
    emp2 = create_user(db_session, UserCreate(email="emp2@lazynerds.com", password="Password2026!", full_name="Emp Two", role="employee"))

    # Client assigned to emp2
    client_emp2 = Client(company_name="Emp2 Organization", primary_contact_name="Lead", primary_contact_email="lead@emp2.com", assigned_employee_id=emp2.id)
    db_session.add(client_emp2)
    db_session.commit()

    eng_emp2 = Engagement(client_id=client_emp2.id, name="Emp2 Audit", assessment_type="Web App Pen Test", status="in_progress", authorization_status="confirmed")
    asset_emp2 = Asset(client_id=client_emp2.id, name="Emp2 Asset", asset_type="web_application", target="https://emp2.com")
    db_session.add_all([eng_emp2, asset_emp2])
    db_session.commit()

    token1 = create_access_token(subject=emp1.id, extra_claims={"email": emp1.email, "role": emp1.role})
    headers1 = {"Authorization": f"Bearer {token1}"}

    # 1. Emp1 cannot archive Client assigned to Emp2
    res_arch = client.post(f"/api/v1/clients/{client_emp2.id}/archive", headers=headers1)
    assert res_arch.status_code == status.HTTP_403_FORBIDDEN
    assert "not assigned" in res_arch.json()["detail"].lower()

    # 2. Emp1 cannot bulk-archive client assigned to Emp2
    res_bulk = client.post("/api/v1/clients/bulk-archive", json={"client_ids": [client_emp2.id]}, headers=headers1)
    assert res_bulk.status_code == status.HTTP_403_FORBIDDEN
    assert "not assigned" in res_bulk.json()["detail"].lower()

    # 3. Emp1 cannot create engagement for client assigned to Emp2
    res_create_eng = client.post(
        "/api/v1/engagements",
        json={"client_id": client_emp2.id, "name": "Emp1 Stolen Engagement", "assessment_type": "Security Audit"},
        headers=headers1,
    )
    assert res_create_eng.status_code == status.HTTP_403_FORBIDDEN
    assert "not assigned" in res_create_eng.json()["detail"].lower()

    # 4. Emp1 cannot update engagement for client assigned to Emp2
    res_update_eng = client.patch(f"/api/v1/engagements/{eng_emp2.id}", json={"name": "Tampered Eng"}, headers=headers1)
    assert res_update_eng.status_code == status.HTTP_403_FORBIDDEN
    assert "not assigned" in res_update_eng.json()["detail"].lower()

    # 5. Emp1 cannot delete asset for client assigned to Emp2
    res_del_asset = client.delete(f"/api/v1/assets/{asset_emp2.id}", headers=headers1)
    assert res_del_asset.status_code == status.HTTP_403_FORBIDDEN
    assert "not assigned" in res_del_asset.json()["detail"].lower()


def test_registration_approval_does_not_overwrite_internal_account(client, auth_headers, db_session):
    """Verifies that approving a client registration with an existing internal staff email fails safely."""
    internal_emp = create_user(
        db_session,
        UserCreate(email="engineer@lazynerds.com", password="EmployeePassword2026!", full_name="Sec Engineer", role="employee")
    )

    reg = ClientRegistration(
        full_name="Impostor Engineer",
        email="engineer@lazynerds.com",
        hashed_password="some_hashed_password",
        company_name="Impostor Entity",
        status="pending",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(reg)
    db_session.commit()

    # Founder attempts to approve registration with engineer email
    res = client.post(
        f"/api/v1/registrations/{reg.id}/review",
        json={"action": "approve", "reason": "Accidental approval"},
        headers=auth_headers,
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "existing internal account" in res.json()["detail"].lower()

    # Verify user record role was untouched
    db_session.refresh(internal_emp)
    assert internal_emp.role == "employee"


def test_asset_target_rejects_dangerous_schemes_and_metadata(client, auth_headers, db_session):
    """Verifies asset creation rejects dangerous URL schemes (javascript:, file:) and cloud metadata targets."""
    c = Client(company_name="Asset Validation Org", primary_contact_name="Lead", primary_contact_email="lead@assetval.com")
    db_session.add(c)
    db_session.commit()

    bad_targets = [
        "javascript:alert(1)",
        "file:///etc/passwd",
        "data:text/html,test",
        "http://169.254.169.254/latest/meta-data/",
        "http://metadata.google.internal/computeMetadata/v1/",
    ]

    for bad in bad_targets:
        res = client.post(
            "/api/v1/assets",
            json={
                "client_id": c.id,
                "name": f"Asset {bad[:10]}",
                "asset_type": "api",
                "target": bad,
            },
            headers=auth_headers,
        )
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY, f"Expected 422 for target: {bad}"


def test_forgot_password_timing_defense_and_background_dispatch(client, test_user, monkeypatch):
    """Verifies that forgot-password uses background tasks to dispatch email and returns immediately."""
    dispatched_calls = []

    def mock_send_email(to_email, recipient_name, reset_url):
        dispatched_calls.append({
            "to_email": to_email,
            "recipient_name": recipient_name,
            "reset_url": reset_url,
        })
        return {"success": True, "provider": "mock", "message_id": "test-msg"}

    from app.services import email_service
    monkeypatch.setattr(email_service, "send_password_reset_email", mock_send_email)

    # 1. Existing user: Background task must be queued and executed by client
    res1 = client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})
    assert res1.status_code == status.HTTP_200_OK
    assert "instructions have been dispatched" in res1.json()["message"]
    assert len(dispatched_calls) == 1
    assert dispatched_calls[0]["to_email"] == test_user.email
    assert "/reset-password?token=" in dispatched_calls[0]["reset_url"]

    # 2. Nonexistent user: Returns 200 without queueing email dispatch
    res2 = client.post("/api/v1/auth/forgot-password", json={"email": "nonexistent-user@lazynerds.com"})
    assert res2.status_code == status.HTTP_200_OK
    assert res2.json() == res1.json()
    assert len(dispatched_calls) == 1  # No additional calls


def test_ingest_scan_results_rejects_terminal_engagement(client, db_session, monkeypatch):
    """Verifies that running scans cannot ingest findings if engagement transitioned to completed/cancelled."""
    c = Client(company_name="Audit Immutability Org", primary_contact_name="Lead", primary_contact_email="lead@audit.com")
    db_session.add(c)
    db_session.commit()

    # Create engagement initially in progress
    eng = Engagement(
        client_id=c.id,
        name="Terminal Engagement Audit",
        assessment_type="Web App Pen Test",
        status="in_progress",
        authorization_status="confirmed",
    )
    db_session.add(eng)
    db_session.commit()

    asset = Asset(
        client_id=c.id,
        name="Target Asset",
        asset_type="web_application",
        target="https://target.corp",
        in_scope=True,
        authorization_status="verified",
    )
    db_session.add(asset)
    db_session.commit()

    assessment = Assessment(
        name="Nuclei Automated Scan",
        engagement_id=eng.id,
        assessment_tool="nuclei",
        status="running",
        worker_id="worker-theta",
        claimed_at=datetime.now(timezone.utc),
        last_heartbeat_at=datetime.now(timezone.utc),
    )
    db_session.add(assessment)
    db_session.commit()

    # Now transition engagement to completed before ingestion
    eng.status = "completed"
    db_session.commit()

    from app.services.scanner_service import ingest_scan_results
    sample_findings = [
        {
            "title": "SQL Injection in Search",
            "severity": "high",
            "cvss_score": 8.5,
            "description": "SQL injection vulnerability in query parameter.",
            "impact": "Data breach",
            "remediation_guidance": "Use parameterized queries.",
        }
    ]

    updated_assessment = ingest_scan_results(
        db=db_session,
        assessment_id=assessment.id,
        parsed_findings=sample_findings,
        raw_output_obj={"results": sample_findings},
        user_email="worker:worker-theta",
        expected_worker_id="worker-theta",
    )

    # Assessment must be failed, and 0 findings ingested into database
    assert updated_assessment.status == "failed"
    assert updated_assessment.completed_at is not None
    db_session.refresh(assessment)
    assert assessment.status == "failed"

    # Zero findings created for this assessment
    finding_count = db_session.query(Finding).filter(Finding.assessment_id == assessment.id).count()
    assert finding_count == 0

    # Test via worker API endpoint as well on a cancelled engagement
    eng2 = Engagement(
        client_id=c.id,
        name="Cancelled Engagement Audit",
        assessment_type="Web App Pen Test",
        status="in_progress",
        authorization_status="confirmed",
    )
    db_session.add(eng2)
    db_session.commit()

    assessment2 = Assessment(
        name="Nuclei Automated Scan 2",
        engagement_id=eng2.id,
        assessment_tool="nuclei",
        status="running",
        worker_id="worker-theta",
        claimed_at=datetime.now(timezone.utc),
        last_heartbeat_at=datetime.now(timezone.utc),
    )
    db_session.add(assessment2)
    db_session.commit()

    # Worker token auth
    worker_headers = {"X-Worker-Token": settings.FIXOPS_WORKER_TOKEN}

    # Cancel engagement
    eng2.status = "cancelled"
    db_session.commit()

    complete_res = client.post(
        f"/api/v1/workers/jobs/{assessment2.id}/complete",
        json={
            "worker_id": "worker-theta",
            "findings": sample_findings,
            "raw_output": {},
        },
        headers=worker_headers,
    )
    assert complete_res.status_code == status.HTTP_200_OK
    data = complete_res.json()
    assert data["status"] == "failed"
    assert data["findings_ingested"] == 0

    # Ensure zero findings exist
    assert db_session.query(Finding).filter(Finding.assessment_id == assessment2.id).count() == 0
