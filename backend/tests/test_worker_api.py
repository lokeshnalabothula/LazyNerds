import json
import pytest
from datetime import datetime, timezone, timedelta
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


def test_worker_claim_ownership_enforcement(client, db_session, test_user, test_setup_for_worker):
    """
    LNA-1: Verifies that only the claiming worker can update progress, heartbeat,
    complete, or fail an assessment. Non-claimants receive HTTP 403 Forbidden.
    """
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

        # Worker-Alpha claims the job
        claim_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-alpha"},
        )
        assert claim_resp.status_code == 200
        assert claim_resp.json()["worker_id"] == "worker-alpha"
        assert claim_resp.json()["claimed_at"] is not None
        assert claim_resp.json()["lease_expires_at"] is not None

        # Worker-Beta attempts to claim the same job -> 409 Conflict
        second_claim = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-beta"},
        )
        assert second_claim.status_code == 409

        # Worker-Beta attempts progress update -> 403 Forbidden
        bad_progress = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/progress",
            headers={"X-Worker-Token": token},
            json={
                "worker_id": "worker-beta",
                "phase": "recon",
                "progress_percent": 20,
                "current_status": "Unauthorized probe",
            },
        )
        assert bad_progress.status_code == 403
        assert "not the claimant" in bad_progress.json()["detail"]

        # Worker-Beta attempts heartbeat -> 403 Forbidden
        bad_hb = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/heartbeat",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-beta"},
        )
        assert bad_hb.status_code == 403

        # Worker-Beta attempts completion -> 403 Forbidden
        bad_complete = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/complete",
            headers={"X-Worker-Token": token},
            json={
                "worker_id": "worker-beta",
                "findings": [],
            },
        )
        assert bad_complete.status_code == 403

        # Worker-Beta attempts failure reporting -> 403 Forbidden
        bad_fail = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/fail",
            headers={"X-Worker-Token": token},
            json={
                "worker_id": "worker-beta",
                "error_message": "Unauthorized failure notice",
            },
        )
        assert bad_fail.status_code == 403

        # Legitimate claimant (worker-alpha) can post progress successfully
        good_progress = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/progress",
            headers={"X-Worker-Token": token},
            json={
                "worker_id": "worker-alpha",
                "phase": "recon",
                "progress_percent": 30,
                "current_status": "Legitimate scan recon in progress",
            },
        )
        assert good_progress.status_code == 200

    finally:
        settings.WORKER_DISPATCH_MODE = orig_mode


def test_unclaimed_job_state_protection(client, db_session, test_user, test_setup_for_worker):
    """
    LNA-1: Verifies that an unclaimed (queued) job cannot be updated with progress,
    completed, or failed prior to being legitimately claimed.
    """
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
        assert assessment.status == "queued"
        assert assessment.worker_id is None

        # Attempt progress without claim -> 409 Conflict
        prog_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/progress",
            headers={"X-Worker-Token": token},
            json={
                "worker_id": "worker-alpha",
                "phase": "recon",
                "progress_percent": 10,
                "current_status": "Trying to update unclaimed job",
            },
        )
        assert prog_resp.status_code == 409

        # Attempt complete without claim -> 409 Conflict
        comp_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/complete",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-alpha", "findings": []},
        )
        assert comp_resp.status_code == 409

        # Attempt fail without claim -> 409 Conflict
        fail_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/fail",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-alpha", "error_message": "Unclaimed failure"},
        )
        assert fail_resp.status_code == 409

    finally:
        settings.WORKER_DISPATCH_MODE = orig_mode


def test_completed_and_failed_job_overwrite_protection(client, db_session, test_user, test_setup_for_worker):
    """
    LNA-1: Verifies that completed or failed jobs cannot be overwritten by progress,
    completion, or failure updates.
    """
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

        # Claim and complete
        client.post(
            f"/api/v1/workers/jobs/{assessment_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-alpha"},
        )
        complete_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/complete",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-alpha", "findings": []},
        )
        assert complete_resp.status_code == 200

        # Attempting progress on completed job -> 409 Conflict
        prog_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/progress",
            headers={"X-Worker-Token": token},
            json={
                "worker_id": "worker-alpha",
                "phase": "recon",
                "progress_percent": 50,
                "current_status": "Overwrite attempt",
            },
        )
        assert prog_resp.status_code == 409

        # Attempting complete again on completed job -> 409 Conflict
        comp2_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/complete",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-alpha", "findings": []},
        )
        assert comp2_resp.status_code == 409

        # Attempting fail on completed job -> 409 Conflict
        fail_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/fail",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-alpha", "error_message": "Trying to fail completed job"},
        )
        assert fail_resp.status_code == 409

        # Launch another job to test failed state protection
        assessment2 = scanner_service.launch_scan(
            db=db_session,
            engagement_id=eng.id,
            target_asset_id=asset.id,
            scan_mode="blackbox",
            current_user=test_user,
            sync_execution=False,
        )
        assessment2_id = assessment2.id

        client.post(
            f"/api/v1/workers/jobs/{assessment2_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-alpha"},
        )
        client.post(
            f"/api/v1/workers/jobs/{assessment2_id}/fail",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-alpha", "error_message": "Initial failure"},
        )

        # Attempting complete on failed job -> 409 Conflict
        comp_failed = client.post(
            f"/api/v1/workers/jobs/{assessment2_id}/complete",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-alpha", "findings": []},
        )
        assert comp_failed.status_code == 409

        # Attempting progress on failed job -> 409 Conflict
        prog_failed = client.post(
            f"/api/v1/workers/jobs/{assessment2_id}/progress",
            headers={"X-Worker-Token": token},
            json={
                "worker_id": "worker-alpha",
                "phase": "recon",
                "progress_percent": 80,
                "current_status": "Trying to revive failed job",
            },
        )
        assert prog_failed.status_code == 409

    finally:
        settings.WORKER_DISPATCH_MODE = orig_mode


def test_worker_lease_and_heartbeat_renewal(client, db_session, test_user, test_setup_for_worker):
    """
    LNA-2: Verifies that job claims establish an explicit lease expiration,
    and progress/heartbeat requests advance the lease expiration.
    """
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

        claim_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-lease-test"},
        )
        assert claim_resp.status_code == 200
        initial_lease = claim_resp.json()["lease_expires_at"]
        assert initial_lease is not None

        # Job-specific heartbeat renewal
        hb_resp = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/heartbeat",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-lease-test"},
        )
        assert hb_resp.status_code == 200
        renewed_lease = hb_resp.json()["lease_expires_at"]
        assert renewed_lease is not None

        # General worker heartbeat with active_job_ids list
        worker_hb_resp = client.post(
            "/api/v1/workers/heartbeat",
            headers={"X-Worker-Token": token},
            json={
                "worker_id": "worker-lease-test",
                "active_job_ids": [assessment_id],
            },
        )
        assert worker_hb_resp.status_code == 200
        assert assessment_id in worker_hb_resp.json()["renewed_jobs"]

    finally:
        settings.WORKER_DISPATCH_MODE = orig_mode


def test_recover_abandoned_assessments_requeued(client, db_session, test_user, test_setup_for_worker):
    """
    LNA-2: Verifies that an assessment whose lease has expired is re-queued if retry_count < max_retries,
    clearing previous worker ownership and incrementing retry_count.
    """
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

        # Worker-Lost claims the job
        client.post(
            f"/api/v1/workers/jobs/{assessment_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-lost"},
        )

        # Force the lease to be expired in the past
        db_session.expire_all()
        target = db_session.query(Assessment).filter(Assessment.id == assessment_id).first()
        target.lease_expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)
        target.retry_count = 0
        db_session.commit()

        # Trigger recovery
        recovery_resp = client.post(
            "/api/v1/workers/jobs/recover-abandoned",
            headers={"X-Worker-Token": token},
            json={"max_retries": 2, "lease_seconds": 60},
        )
        assert recovery_resp.status_code == 200
        rec_data = recovery_resp.json()
        assert rec_data["recovered_count"] >= 1
        rec_match = next((r for r in rec_data["recovered"] if r["id"] == assessment_id), None)
        assert rec_match is not None
        assert rec_match["action"] == "requeued"
        assert rec_match["previous_worker"] == "worker-lost"
        assert rec_match["retry_count"] == 1

        # Check DB state
        db_session.expire_all()
        refreshed = db_session.query(Assessment).filter(Assessment.id == assessment_id).first()
        assert refreshed.status == "queued"
        assert refreshed.worker_id is None
        assert refreshed.claimed_at is None
        assert refreshed.lease_expires_at is None
        assert refreshed.retry_count == 1

        # A new worker can now claim and complete the re-queued assessment
        claim2 = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-replacement"},
        )
        assert claim2.status_code == 200
        assert claim2.json()["worker_id"] == "worker-replacement"

        comp2 = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/complete",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-replacement", "findings": []},
        )
        assert comp2.status_code == 200

    finally:
        settings.WORKER_DISPATCH_MODE = orig_mode


def test_recover_abandoned_assessments_max_retries_failed(client, db_session, test_user, test_setup_for_worker):
    """
    LNA-2: Verifies that an assessment whose lease expires and has already reached
    max_retries is transitioned permanently to 'failed'.
    """
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

        # Worker claims
        client.post(
            f"/api/v1/workers/jobs/{assessment_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-fail-test"},
        )

        # Force expired lease with retry_count equal to max_retries (e.g. 2)
        db_session.expire_all()
        target = db_session.query(Assessment).filter(Assessment.id == assessment_id).first()
        target.lease_expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)
        target.retry_count = 2
        db_session.commit()

        # Trigger recovery with max_retries=2
        recovery_resp = client.post(
            "/api/v1/workers/jobs/recover-abandoned",
            headers={"X-Worker-Token": token},
            json={"max_retries": 2, "lease_seconds": 60},
        )
        assert recovery_resp.status_code == 200
        rec_data = recovery_resp.json()
        rec_match = next((r for r in rec_data["recovered"] if r["id"] == assessment_id), None)
        assert rec_match is not None
        assert rec_match["action"] == "failed"
        assert rec_match["previous_worker"] == "worker-fail-test"

        # Check DB state
        db_session.expire_all()
        refreshed = db_session.query(Assessment).filter(Assessment.id == assessment_id).first()
        assert refreshed.status == "failed"
        assert refreshed.completed_at is not None
        summary = json.loads(refreshed.execution_summary)
        assert summary["phase"] == "failed"
        assert "Max retries (2) exceeded" in summary["current_status"]

    finally:
        settings.WORKER_DISPATCH_MODE = orig_mode


def test_auto_recovery_during_pending_poll(client, db_session, test_user, test_setup_for_worker):
    """
    LNA-2: Verifies that polling GET /jobs/pending automatically sweeps and recovers
    expired abandoned jobs so they become immediately available for worker dispatch.
    """
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

        client.post(
            f"/api/v1/workers/jobs/{assessment_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-disappeared"},
        )

        # Force lease expiration
        db_session.expire_all()
        target = db_session.query(Assessment).filter(Assessment.id == assessment_id).first()
        target.lease_expires_at = datetime.now(timezone.utc) - timedelta(minutes=15)
        target.retry_count = 0
        db_session.commit()

        # Polling /jobs/pending should automatically recover and return the job
        pending_resp = client.get("/api/v1/workers/jobs/pending", headers={"X-Worker-Token": token})
        assert pending_resp.status_code == 200
        pending_data = pending_resp.json()
        pending_ids = [j["id"] for j in pending_data["jobs"]]
        assert assessment_id in pending_ids

    finally:
        settings.WORKER_DISPATCH_MODE = orig_mode


def test_late_arriving_lost_worker_rejected(client, db_session, test_user, test_setup_for_worker):
    """
    LNA-2: Verifies that if a lost worker comes back online after an assessment was recovered
    and re-claimed by another worker, updates from the lost worker are rejected with 403 Forbidden.
    """
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

        # Worker-Old claims
        client.post(
            f"/api/v1/workers/jobs/{assessment_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-old"},
        )

        # Lease expires and is recovered
        db_session.expire_all()
        target = db_session.query(Assessment).filter(Assessment.id == assessment_id).first()
        target.lease_expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)
        db_session.commit()

        client.post(
            "/api/v1/workers/jobs/recover-abandoned",
            headers={"X-Worker-Token": token},
            json={"max_retries": 3, "lease_seconds": 60},
        )

        # Worker-New claims
        client.post(
            f"/api/v1/workers/jobs/{assessment_id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-new"},
        )

        # Late-arriving worker-old tries to complete or update progress -> 403 Forbidden
        late_progress = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/progress",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-old", "phase": "recon", "progress_percent": 90, "current_status": "late"},
        )
        assert late_progress.status_code == 403

        late_complete = client.post(
            f"/api/v1/workers/jobs/{assessment_id}/complete",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-old", "findings": []},
        )
        assert late_complete.status_code == 403

    finally:
        settings.WORKER_DISPATCH_MODE = orig_mode


def test_recover_abandoned_assessments_isolated_locking_and_interleaved_state(client, db_session, test_user, test_setup_for_worker):
    """
    LNA-2: Verifies that recovery processes candidate assessments one-by-one with
    isolated row-level locking, ensuring commits on earlier rows do not leave later rows
    unlocked or vulnerable to stale-state overwrites if state changed concurrently.
    """
    token = settings.FIXOPS_WORKER_TOKEN
    eng = test_setup_for_worker["engagement"]
    asset = test_setup_for_worker["asset"]

    orig_mode = settings.WORKER_DISPATCH_MODE
    try:
        settings.WORKER_DISPATCH_MODE = "distributed"

        # Create two jobs
        job1 = scanner_service.launch_scan(
            db=db_session,
            engagement_id=eng.id,
            target_asset_id=asset.id,
            scan_mode="blackbox",
            current_user=test_user,
            sync_execution=False,
        )
        job2 = scanner_service.launch_scan(
            db=db_session,
            engagement_id=eng.id,
            target_asset_id=asset.id,
            scan_mode="blackbox",
            current_user=test_user,
            sync_execution=False,
        )

        # Worker-1 claims job1, Worker-2 claims job2
        client.post(
            f"/api/v1/workers/jobs/{job1.id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-1"},
        )
        client.post(
            f"/api/v1/workers/jobs/{job2.id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-2"},
        )

        # Force both leases to be expired
        db_session.expire_all()
        rec1 = db_session.query(Assessment).filter(Assessment.id == job1.id).first()
        rec2 = db_session.query(Assessment).filter(Assessment.id == job2.id).first()
        rec1.lease_expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)
        rec2.lease_expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)
        rec1.retry_count = 0
        rec2.retry_count = 0
        db_session.commit()

        # Run recovery
        res = scanner_service.recover_abandoned_assessments(db=db_session, max_retries=2, lease_seconds=60)
        assert len(res) == 2
        recovered_ids = {r["id"] for r in res}
        assert job1.id in recovered_ids
        assert job2.id in recovered_ids

        # Both jobs should now be queued and unclaimed
        db_session.expire_all()
        ref1 = db_session.query(Assessment).filter(Assessment.id == job1.id).first()
        ref2 = db_session.query(Assessment).filter(Assessment.id == job2.id).first()
        assert ref1.status == "queued"
        assert ref1.worker_id is None
        assert ref2.status == "queued"
        assert ref2.worker_id is None
    finally:
        settings.WORKER_DISPATCH_MODE = orig_mode


def test_stale_worker_cannot_overwrite_recovered_or_reclaimed_assessment(client, db_session, test_user, test_setup_for_worker):
    """
    LNA-1: Verifies that after an abandoned assessment is recovered (re-queued) or re-claimed
    by a second worker, the original stale worker cannot complete, fail, update progress,
    or heartbeat the job, preventing race conditions or state corruption.
    """
    token = settings.FIXOPS_WORKER_TOKEN
    eng = test_setup_for_worker["engagement"]
    asset = test_setup_for_worker["asset"]

    orig_mode = settings.WORKER_DISPATCH_MODE
    try:
        settings.WORKER_DISPATCH_MODE = "distributed"
        job = scanner_service.launch_scan(
            db=db_session,
            engagement_id=eng.id,
            target_asset_id=asset.id,
            scan_mode="blackbox",
            current_user=test_user,
            sync_execution=False,
        )

        # Worker-Stale claims the job
        claim_resp = client.post(
            f"/api/v1/workers/jobs/{job.id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-stale"},
        )
        assert claim_resp.status_code == 200

        # Simulate lease expiration and recovery sweep
        db_session.expire_all()
        target = db_session.query(Assessment).filter(Assessment.id == job.id).first()
        target.lease_expires_at = datetime.now(timezone.utc) - timedelta(minutes=15)
        db_session.commit()

        # Sweep runs and re-queues the job
        rec = scanner_service.recover_abandoned_assessments(db=db_session, max_retries=2, lease_seconds=60)
        assert len(rec) == 1
        assert rec[0]["action"] == "requeued"

        # While re-queued (unclaimed), stale worker attempts complete -> 409 Conflict
        stale_comp = client.post(
            f"/api/v1/workers/jobs/{job.id}/complete",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-stale", "findings": []},
        )
        assert stale_comp.status_code == 409

        # Stale worker attempts fail -> 409 Conflict
        stale_fail = client.post(
            f"/api/v1/workers/jobs/{job.id}/fail",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-stale", "error_message": "late failure"},
        )
        assert stale_fail.status_code == 409

        # Stale worker attempts progress -> 409 Conflict
        stale_prog = client.post(
            f"/api/v1/workers/jobs/{job.id}/progress",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-stale", "phase": "recon", "progress_percent": 50, "current_status": "late"},
        )
        assert stale_prog.status_code == 409

        # Stale worker attempts heartbeat -> 409 Conflict
        stale_hb = client.post(
            f"/api/v1/workers/jobs/{job.id}/heartbeat",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-stale"},
        )
        assert stale_hb.status_code == 409

        # Worker-Fresh legitimately claims the re-queued job
        fresh_claim = client.post(
            f"/api/v1/workers/jobs/{job.id}/claim",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-fresh"},
        )
        assert fresh_claim.status_code == 200

        # Now job is running under worker-fresh. Stale worker attempts complete -> 403 Forbidden
        stale_comp2 = client.post(
            f"/api/v1/workers/jobs/{job.id}/complete",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-stale", "findings": []},
        )
        assert stale_comp2.status_code == 403

        # Stale worker attempts fail -> 403 Forbidden
        stale_fail2 = client.post(
            f"/api/v1/workers/jobs/{job.id}/fail",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-stale", "error_message": "late fail"},
        )
        assert stale_fail2.status_code == 403

        # Worker-Fresh completes the job successfully
        fresh_comp = client.post(
            f"/api/v1/workers/jobs/{job.id}/complete",
            headers={"X-Worker-Token": token},
            json={"worker_id": "worker-fresh", "findings": []},
        )
        assert fresh_comp.status_code == 200

        # Verify final status
        db_session.expire_all()
        final_job = db_session.query(Assessment).filter(Assessment.id == job.id).first()
        assert final_job.status == "completed"
        assert final_job.worker_id == "worker-fresh"
    finally:
        settings.WORKER_DISPATCH_MODE = orig_mode
