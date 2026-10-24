import json
import pytest
from datetime import datetime, timezone
from app.core.config import settings
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.asset import Asset
from app.models.finding import Assessment, Finding
from app.services import scanner_service


@pytest.fixture
def test_setup_for_worker(db_session, test_user):
    c = Client(
        company_name="Worker Test Corp",
        primary_contact_name="Alice Smith",
        primary_contact_email="alice@workertest.com",
    )
    db_session.add(c)
    db_session.commit()

    eng = Engagement(
        client_id=c.id,
        name="Worker Q3 Assessment",
        assessment_type="web_penetration_test",
        status="in_progress",
        authorization_status="confirmed",
        assigned_to=test_user.email,
    )
    db_session.add(eng)
    db_session.commit()

    asset = Asset(
        client_id=c.id,
        engagement_id=eng.id,
        name="Worker Test Web Target",
        target="http://127.0.0.1:8888",
        asset_type="web_application",
        in_scope=True,
        authorization_status="verified",
    )
    db_session.add(asset)
    db_session.commit()

    return {"client": c, "engagement": eng, "asset": asset}


def test_worker_auth_unauthorized(client):
    # Calling worker endpoints with no token or wrong token returns 401
    resp = client.post("/api/v1/workers/heartbeat", json={"worker_id": "test-wkr-01"})
    assert resp.status_code == 401
    assert "Invalid worker authentication token" in resp.json()["detail"]

    resp = client.post(
        "/api/v1/workers/heartbeat",
        headers={"X-Worker-Token": "invalid-token-here"},
        json={"worker_id": "test-wkr-01"},
    )
    assert resp.status_code == 401


def test_worker_heartbeat_success(client):
    token = settings.FIXOPS_WORKER_TOKEN
    resp = client.post(
        "/api/v1/workers/heartbeat",
        headers={"X-Worker-Token": token},
        json={
            "worker_id": "test-wkr-01",
            "hostname": "test-node",
            "status": "online",
            "docker_available": True,
            "nuclei_available": True,
            "shannon_available": False,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "acknowledged"
    assert data["worker_id"] == "test-wkr-01"
    assert "pending_jobs_count" in data


def test_worker_claim_and_lifecycle(client, db_session, test_user, test_setup_for_worker):
    token = settings.FIXOPS_WORKER_TOKEN
    eng = test_setup_for_worker["engagement"]
    asset = test_setup_for_worker["asset"]

    # 1. Queue an assessment via launch_scan with sync_execution=False
    # Temporarily set WORKER_DISPATCH_MODE="distributed" to ensure it queues
    orig_mode = settings.WORKER_DISPATCH_MODE
    try:
        settings.WORKER_DISPATCH_MODE = "distributed"
        assessment = scanner_service.launch_scan(
            db=db_session,
            engagement_id=eng.id,
            target_asset_id=asset.id,
            scan_mode="blackbox",
            current_user=test_user,
            sync_execution=False,
        )
        assert assessment.status == "queued"
        assessment_id = assessment.id

        # 2. Worker polls pending jobs
        resp = client.get("/api/v1/workers/jobs/pending", headers={"X-Worker-Token": token})
        assert resp.status_code == 200
        pending = resp.json()
        assert pending["pending_count"] >= 1
        job_ids = [j["id"] for j in pending["jobs"]]
        assert assessment_id in job_ids

        # 3. Worker claims the job
        claim_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "wkr-node-1"},
        )
        assert claim_resp.status_code == 200
        claim_data = claim_resp.json()
        assert claim_data["status"] == "claimed"
        assert claim_data["assessment_id"] == assessment_id

        # Claiming again returns 409 Conflict
        second_claim = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "wkr-node-2"},
        )
        assert second_claim.status_code == 409

        # 4. Worker reports progress
        prog_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/progress",
            headers={"X-Worker-Token": token},
            json={
                "worker_id": "wkr-node-1",
                "phase": "vuln_analysis",
                "progress_percent": 65,
                "current_status": "Executing Nuclei CVE templates in Docker...",
                "active_agent": "nuclei-scanner",
                "log_chunk": "Matched exposed admin panel",
            },
        )
        assert prog_resp.status_code == 200

        # Verify assessment in DB updated
        db_session.expire_all()
        refreshed = db_session.query(Assessment).filter(Assessment.id == assessment_id).first()
        assert refreshed.status == "running"
        summary = json.loads(refreshed.execution_summary)
        assert summary["phase"] == "vuln_analysis"
        assert summary["progress_percent"] == 65
        assert any("Matched exposed admin panel" in log.get("message", "") for log in summary.get("logs", []))

        # 5. Worker completes job and ingests findings
        comp_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/complete",
            headers={"X-Worker-Token": token},
            json={
                "worker_id": "wkr-node-1",
                "findings": [
                    {
                        "title": "CORS Misconfiguration on Search API",
                        "severity": "medium",
                        "cvss_score": 5.3,
                        "cve_id": "CWE-942",
                        "description": "Permissive CORS origin reflection.",
                        "impact": "Potential client session leakage.",
                        "remediation_guidance": "Restrict allowed origins.",
                        "evidence": "Access-Control-Allow-Origin: evil.com",
                        "references_url": "https://portswigger.net/web-security/cors",
                    }
                ],
                "raw_output": {"engine": "nuclei", "matched": 1},
                "deliverables": {"report_format": "sarif"},
            },
        )
        assert comp_resp.status_code == 200
        comp_data = comp_resp.json()
        assert comp_data["status"] == "completed"
        assert comp_data["findings_ingested"] == 1

        # Verify DB entities created
        db_session.expire_all()
        final_assessment = db_session.query(Assessment).filter(Assessment.id == assessment_id).first()
        assert final_assessment.status == "completed"
        assert final_assessment.findings_count == 1

        db_findings = db_session.query(Finding).filter(Finding.assessment_id == assessment_id).all()
        assert len(db_findings) == 1
        assert db_findings[0].title == "CORS Misconfiguration on Search API"
        assert db_findings[0].severity == "medium"
        assert db_findings[0].cve_id == "CWE-942"
        assert "[Source: Nuclei Black-Box Scanner]" in db_findings[0].remediation_notes

    finally:
        settings.WORKER_DISPATCH_MODE = orig_mode


def test_worker_fail_reporting(client, db_session, test_user, test_setup_for_worker):
    token = settings.FIXOPS_WORKER_TOKEN
    eng = test_setup_for_worker["engagement"]
    asset = test_setup_for_worker["asset"]

    orig_mode = settings.WORKER_DISPATCH_MODE
    try:
        settings.WORKER_DISPATCH_MODE = "distributed"
        assessment = scanner_service.launch_scan(
            db=db_session,
            engagement_id=eng.id,
            target_asset_id=asset.id,
            scan_mode="blackbox",
            current_user=test_user,
            sync_execution=False,
        )
        assessment_id = assessment.id

        # Worker claims then reports failure
        client.post(
            f"/api/v1/workers/jobs/{assessment_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "wkr-node-1"},
        )

        fail_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/fail",
            headers={"X-Worker-Token": token},
            json={
                "worker_id": "wkr-node-1",
                "error_message": "Target connection timeout after 300 seconds",
                "error_logs": "Traceback: TimeoutError on TCP connect",
            },
        )
        assert fail_resp.status_code == 200

        db_session.expire_all()
        refreshed = db_session.query(Assessment).filter(Assessment.id == assessment_id).first()
        assert refreshed.status == "failed"
        summary = json.loads(refreshed.execution_summary)
        assert summary["phase"] == "failed"
        assert "Target connection timeout" in summary["current_status"]
    finally:
        settings.WORKER_DISPATCH_MODE = orig_mode
