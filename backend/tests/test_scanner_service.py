import json
import pytest
from datetime import datetime, timezone
from app.core.config import settings
from app.core.security import validate_target_url_ssrf
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.asset import Asset
from app.models.finding import Assessment, Finding
from app.services.scan_adapters import parse_shannon_sarif, parse_shannon_json, run_or_import_scan
from app.services import scanner_service


def test_ssrf_validation_blocks_cloud_metadata():
    # Cloud metadata (AWS, GCP, Azure, OpenStack) must ALWAYS be blocked unconditionally
    is_safe, msg = validate_target_url_ssrf("http://169.254.169.254/latest/meta-data/", allow_lab_testing=True)
    assert not is_safe
    assert "cloud metadata" in msg.lower() or "ssrf" in msg.lower()

    is_safe, msg = validate_target_url_ssrf("http://169.254.170.2/v2/metadata", allow_lab_testing=True)
    assert not is_safe


def test_ssrf_validation_blocks_internal_ips_in_production():
    # RFC 1918 private subnets must be blocked in production
    is_safe, msg = validate_target_url_ssrf("http://10.0.0.1/internal-dashboard", allow_lab_testing=False)
    assert not is_safe
    assert "ssrf" in msg.lower() or "disallowed" in msg.lower()

    is_safe, msg = validate_target_url_ssrf("http://192.168.1.100:8080/api", allow_lab_testing=False)
    assert not is_safe


def test_ssrf_validation_rejects_non_http_schemes():
    is_safe, msg = validate_target_url_ssrf("ftp://example.com/file", allow_lab_testing=True)
    assert not is_safe
    assert "scheme" in msg.lower()

    is_safe, msg = validate_target_url_ssrf("file:///etc/passwd", allow_lab_testing=True)
    assert not is_safe


def test_ssrf_validation_allows_localhost_in_lab_mode():
    is_safe, msg = validate_target_url_ssrf("http://127.0.0.1:8888/health", allow_lab_testing=True)
    assert is_safe
    assert msg == ""


def test_parse_shannon_sarif_extraction():
    sample_sarif = {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "Shannon",
                        "rules": [
                            {
                                "id": "shannon/injection",
                                "name": "SQL Injection",
                                "help": {"text": "Use parameterized queries."}
                            }
                        ]
                    }
                },
                "results": [
                    {
                        "ruleId": "shannon/injection",
                        "level": "error",
                        "message": {
                            "markdown": "**SQL Injection in Coupon API**\n\nThe parameter is vulnerable to stacked queries.\n\n**Impact**\n\nFull database compromise.\n\n**Remediation**\n\nSanitize and bind parameters.\n\nFull exploitation evidence: `Security-Assessment-Report.pdf`",
                            "text": "SQL Injection in Coupon API"
                        },
                        "locations": [
                            {
                                "physicalLocation": {
                                    "artifactLocation": {"uri": "api/shop.go"},
                                    "region": {"startLine": 45}
                                }
                            }
                        ],
                        "webRequest": {
                            "method": "POST",
                            "target": "https://target.local/api/shop"
                        },
                        "properties": {
                            "findingId": "INJ-01",
                            "parameter": "coupon",
                            "status": "exploited",
                            "sastRuleId": "CWE-89"
                        }
                    }
                ]
            }
        ]
    }

    findings = parse_shannon_sarif(sample_sarif)
    assert len(findings) == 1
    f = findings[0]
    assert f["title"] == "SQL Injection in Coupon API"
    assert f["severity"] == "critical"
    assert f["cvss_score"] == 9.0
    assert f["cve_id"] == "CWE-89"
    assert "Full database compromise" in f["impact"]
    assert "Sanitize and bind parameters" in f["remediation_guidance"]
    assert "api/shop.go:45" in f["evidence"]
    assert "INJ-01" in f["evidence"]


def test_parse_shannon_json_extraction():
    sample_json = {
        "exploitFindings": [
            {
                "id": "AUTHZ-01",
                "title": "BOLA / IDOR in User Profile",
                "severity": "Critical",
                "owaspCategory": "A01:2025",
                "summary": {
                    "vulnerableLocation": "/api/users/profile",
                    "overview": "Missing tenant check allows horizontal privilege escalation.",
                    "impact": "Account takeover."
                },
                "remediation": "Assert caller identity matches resource owner.",
                "exploitationSteps": [
                    {
                        "number": 1,
                        "title": "Query private user profile",
                        "items": [
                            {"kind": "prose", "text": "Send GET request without auth headers"},
                            {"kind": "code", "block": {"language": "bash", "content": "curl http://localhost/api/users/2"}}
                        ]
                    }
                ]
            }
        ]
    }

    findings = parse_shannon_json(sample_json)
    assert len(findings) == 1
    f = findings[0]
    assert f["title"] == "BOLA / IDOR in User Profile"
    assert f["severity"] == "critical"
    assert f["cve_id"] == "A01:2025"
    assert "Account takeover" in f["impact"]
    assert "curl http://localhost/api/users/2" in f["evidence"]


@pytest.fixture
def test_client_record(db_session):
    client_rec = Client(
        company_name="Acme Security Lab Corp",
        primary_contact_name="Alice Smith",
        primary_contact_email="alice@acme-security-lab.internal",
    )
    db_session.add(client_rec)
    db_session.commit()
    db_session.refresh(client_rec)
    return client_rec


def test_scope_enforcement_blocks_out_of_scope_asset(db_session, test_client_record):
    eng = Engagement(
        client_id=test_client_record.id,
        name="Scope Test Engagement",
        status="in_progress",
        authorization_status="confirmed",
        assessment_type="whitebox_audit",
    )
    db_session.add(eng)
    db_session.commit()

    asset = Asset(
        client_id=test_client_record.id,
        engagement_id=eng.id,
        name="Out of Scope Asset",
        asset_type="web_application",
        target="https://internal-unauthorized.example.com",
        in_scope=False,
        authorization_status="verified",
    )
    db_session.add(asset)
    db_session.commit()

    with pytest.raises(ValueError) as excinfo:
        scanner_service.launch_scan(
            db=db_session,
            engagement_id=eng.id,
            target_asset_id=asset.id,
            scan_mode="source_assisted",
            source_repo="lab/vulnerable_app",
        )
    assert "out-of-scope" in str(excinfo.value).lower()


def test_authorization_enforcement_blocks_unauthorized_asset(db_session, test_client_record):
    eng = Engagement(
        client_id=test_client_record.id,
        name="Auth Status Test Engagement",
        status="in_progress",
        authorization_status="confirmed",
        assessment_type="whitebox_audit",
    )
    db_session.add(eng)
    db_session.commit()

    asset = Asset(
        client_id=test_client_record.id,
        engagement_id=eng.id,
        name="Pending Auth Asset",
        asset_type="web_application",
        target="https://staging.example.com",
        in_scope=True,
        authorization_status="unauthorized",
    )
    db_session.add(asset)
    db_session.commit()

    with pytest.raises(ValueError) as excinfo:
        scanner_service.launch_scan(
            db=db_session,
            engagement_id=eng.id,
            target_asset_id=asset.id,
            scan_mode="source_assisted",
            source_repo="lab/vulnerable_app",
        )
    assert "authorization status" in str(excinfo.value).lower()


def test_launch_scan_and_progress_tracking(db_session, test_client_record):
    eng = Engagement(
        client_id=test_client_record.id,
        name="Active Lab Engagement",
        status="in_progress",
        authorization_status="confirmed",
        assessment_type="whitebox_audit",
    )
    db_session.add(eng)
    db_session.commit()

    asset = Asset(
        client_id=test_client_record.id,
        engagement_id=eng.id,
        name="Lab Target App",
        asset_type="web_application",
        target="http://127.0.0.1:8888",
        in_scope=True,
        authorization_status="verified",
    )
    db_session.add(asset)
    db_session.commit()

    assessment = scanner_service.launch_scan(
        db=db_session,
        engagement_id=eng.id,
        target_asset_id=asset.id,
        scan_mode="source_assisted",
        source_repo="lab/vulnerable_app",
        is_mock_run=True,
    )

    assert assessment.id is not None
    assert assessment.status in ("queued", "running", "completed")
    assert assessment.assessment_tool == "shannon"
    summary = json.loads(assessment.execution_summary)
    assert summary["scan_mode"] == "source_assisted"
    assert summary["target_url"] == "http://127.0.0.1:8888"


def test_cancel_scan_lifecycle(db_session, test_client_record):
    eng = Engagement(
        client_id=test_client_record.id,
        name="Cancellation Test Engagement",
        status="in_progress",
        authorization_status="confirmed",
        assessment_type="whitebox_audit",
    )
    db_session.add(eng)
    db_session.commit()

    asset = Asset(
        client_id=test_client_record.id,
        engagement_id=eng.id,
        name="Cancel Target",
        asset_type="web_application",
        target="http://127.0.0.1:8888",
        in_scope=True,
        authorization_status="verified",
    )
    db_session.add(asset)
    db_session.commit()

    assessment = scanner_service.launch_scan(
        db=db_session,
        engagement_id=eng.id,
        target_asset_id=asset.id,
        scan_mode="source_assisted",
        source_repo="lab/vulnerable_app",
        sync_execution=False,
    )

    cancelled = scanner_service.cancel_scan(
        db=db_session,
        assessment_id=assessment.id,
        current_user_email="auditor@lazynerds.com",
    )
    assert cancelled.status == "failed"
    summary = json.loads(cancelled.execution_summary)
    assert "cancelled" in summary["current_status"].lower()


def test_ssrf_validation_blocks_sensitive_infrastructure_ports():
    # Ports 22 (SSH), 5432 (Postgres), 6379 (Redis) must be blocked
    is_safe, msg = validate_target_url_ssrf("http://example.com:22/", allow_lab_testing=False)
    assert not is_safe
    assert "infrastructure port" in msg.lower() or "ssrf" in msg.lower()

    is_safe, msg = validate_target_url_ssrf("http://example.com:5432/", allow_lab_testing=False)
    assert not is_safe

    is_safe, msg = validate_target_url_ssrf("http://example.com:6379/", allow_lab_testing=False)
    assert not is_safe


def test_ssrf_validation_blocks_metadata_hostnames():
    is_safe, msg = validate_target_url_ssrf("http://metadata.google.internal/computeMetadata/v1/")
    assert not is_safe
    assert "metadata" in msg.lower()

    is_safe, msg = validate_target_url_ssrf("http://instance-data/latest/meta-data/")
    assert not is_safe


def test_nuclei_deduplication():
    from app.services.scan_adapters import parse_nuclei_records
    duplicate_records = [
        {
            "template-id": "cors-wildcard",
            "info": {
                "name": "CORS Wildcard Detected",
                "severity": "medium",
                "classification": {"cwe-id": ["CWE-942"], "cvss-score": 5.0}
            },
            "matched-at": "http://127.0.0.1:8888/api/products",
        },
        {
            "template-id": "cors-wildcard",
            "info": {
                "name": "CORS Wildcard Detected",
                "severity": "medium",
                "classification": {"cwe-id": ["CWE-942"], "cvss-score": 5.0}
            },
            "matched-at": "http://127.0.0.1:8888/api/products",
        },
        {
            "template-id": "cors-wildcard",
            "info": {
                "name": "CORS Wildcard Detected",
                "severity": "medium",
                "classification": {"cwe-id": ["CWE-942"], "cvss-score": 5.0}
            },
            "matched-at": "http://127.0.0.1:8888/api/users",
        }
    ]
    parsed = parse_nuclei_records(duplicate_records)
    # The two identical matches on /api/products must be deduplicated into 1
    assert len(parsed) == 2
    matched_urls = [p["evidence"] for p in parsed]
    assert any("/api/products" in u for u in matched_urls)
    assert any("/api/users" in u for u in matched_urls)


def test_blackbox_scan_flow_with_benchmark_labeling(db_session, test_client_record):
    eng = Engagement(
        client_id=test_client_record.id,
        name="Blackbox Audit Engagement",
        status="in_progress",
        authorization_status="confirmed",
        assessment_type="blackbox_pentest",
    )
    db_session.add(eng)
    db_session.commit()

    asset = Asset(
        client_id=test_client_record.id,
        engagement_id=eng.id,
        name="Perimeter Web Target",
        asset_type="web_application",
        target="http://127.0.0.1:8888",
        in_scope=True,
        authorization_status="verified",
    )
    db_session.add(asset)
    db_session.commit()

    assessment = scanner_service.launch_scan(
        db=db_session,
        engagement_id=eng.id,
        target_asset_id=asset.id,
        scan_mode="blackbox",
        is_mock_run=True,
        sync_execution=True,
    )

    assert assessment.status == "completed"
    assert assessment.assessment_tool == "nuclei"
    assert "[SIMULATED LAB BENCHMARK]" in assessment.name
    assert assessment.findings_count > 0

    findings = db_session.query(Finding).filter(Finding.assessment_id == assessment.id).all()
    assert len(findings) == assessment.findings_count
    for f in findings:
        assert f.title.startswith("[LAB BENCHMARK]")
        assert f.status == "verification_pending"
        assert "[LAB BENCHMARK]" in f.remediation_notes


def test_live_scan_fails_honestly_when_no_ai_credits(db_session, test_client_record, monkeypatch):
    eng = Engagement(
        client_id=test_client_record.id,
        name="Live Scan Without Credits",
        status="in_progress",
        authorization_status="confirmed",
        assessment_type="whitebox_audit",
    )
    db_session.add(eng)
    db_session.commit()

    asset = Asset(
        client_id=test_client_record.id,
        engagement_id=eng.id,
        name="Test Asset",
        asset_type="web_application",
        target="http://127.0.0.1:8888",
        in_scope=True,
        authorization_status="verified",
    )
    db_session.add(asset)
    db_session.commit()

    # Clear all AI keys from env to simulate zero credits / unconfigured provider
    monkeypatch.delenv("SHANNON_AI_API_KEY", raising=False)
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    assessment = scanner_service.launch_scan(
        db=db_session,
        engagement_id=eng.id,
        target_asset_id=asset.id,
        scan_mode="source_assisted",
        source_repo="lab/vulnerable_app",
        is_mock_run=False,
        sync_execution=True,
    )

    # Must fail cleanly and honestly without generating fake/simulated findings
    assert assessment.status == "failed"
    assert assessment.findings_count == 0
    summary = json.loads(assessment.execution_summary)
    assert "LLM provider credits" in summary["current_status"] or "credits configured" in summary["current_status"]
    
    # Confirm zero findings created in database for this failed assessment
    findings = db_session.query(Finding).filter(Finding.assessment_id == assessment.id).all()
    assert len(findings) == 0


@pytest.mark.integration
def test_real_nuclei_execution_in_docker(db_session, test_client_record):
    import shutil
    import subprocess
    import urllib.request
    docker_bin = shutil.which("docker")
    if not docker_bin:
        pytest.skip("Docker is not installed on this host")
    try:
        check = subprocess.run([docker_bin, "info"], capture_output=True, timeout=5)
        if check.returncode != 0:
            pytest.skip("Docker daemon is not responsive; skipping live container test")
    except Exception:
        pytest.skip("Docker daemon health check timed out; skipping live container test")

    # Verify lab target server is actively reachable prior to launching real container scan
    try:
        req = urllib.request.Request("http://127.0.0.1:8888", headers={"User-Agent": "FixOps-Probe"})
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pytest.skip("Local lab test server at http://127.0.0.1:8888 is not running or unreachable")

    eng = Engagement(
        client_id=test_client_record.id,
        name="Real Nuclei Test Engagement",
        status="in_progress",
        authorization_status="confirmed",
        assessment_type="blackbox_pentest",
    )
    db_session.add(eng)
    db_session.commit()

    asset = Asset(
        client_id=test_client_record.id,
        engagement_id=eng.id,
        name="Live Local Lab Target",
        asset_type="web_application",
        target="http://127.0.0.1:8888",
        in_scope=True,
        authorization_status="verified",
    )
    db_session.add(asset)
    db_session.commit()

    assessment = scanner_service.launch_scan(
        db=db_session,
        engagement_id=eng.id,
        target_asset_id=asset.id,
        scan_mode="blackbox",
        is_mock_run=False,
        sync_execution=True,
    )

    assert assessment.status == "completed"
    assert assessment.assessment_tool == "nuclei"
    assert "[SIMULATED LAB BENCHMARK]" not in assessment.name
    summary = json.loads(assessment.execution_summary)
    assert summary["scan_mode"] == "blackbox"
    assert summary["benchmark_mode"] is False


def test_concurrency_limit_enforced(db_session, test_client_record, monkeypatch):
    import threading
    eng = Engagement(
        client_id=test_client_record.id,
        name="Concurrency Test",
        status="in_progress",
        authorization_status="confirmed",
        assessment_type="whitebox_audit",
    )
    db_session.add(eng)
    db_session.commit()

    asset = Asset(
        client_id=test_client_record.id,
        engagement_id=eng.id,
        name="Target Asset",
        asset_type="web_application",
        target="http://127.0.0.1:8888",
        in_scope=True,
        authorization_status="verified",
    )
    db_session.add(asset)
    db_session.commit()

    # Create dummy alive threads to saturate capacity
    class MockThread:
        def is_alive(self):
            return True

    mock_threads = {
        "job-1": MockThread(),
        "job-2": MockThread(),
        "job-3": MockThread(),
    }
    monkeypatch.setattr(scanner_service, "ACTIVE_SCAN_THREADS", mock_threads)

    with pytest.raises(ValueError) as excinfo:
        scanner_service.launch_scan(
            db=db_session,
            engagement_id=eng.id,
            target_asset_id=asset.id,
            scan_mode="source_assisted",
            source_repo="lab/vulnerable_app",
            is_mock_run=True,
        )
    assert "concurrency limit reached" in str(excinfo.value).lower()


def test_launch_scan_production_mode_blocks_lab_target_even_with_flag_true(
    db_session, test_client_record, monkeypatch
):
    """
    Regression test for LNA-14: Fail-closed production SSRF guard on scanner_service.launch_scan.
    Verifies that when ENVIRONMENT='production', even if ALLOW_LAB_TESTING is explicitly set True,
    targeting loopback / local lab (http://127.0.0.1:8888) raises a ValueError SSRF violation.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "ALLOW_LAB_TESTING", True)

    eng = Engagement(
        client_id=test_client_record.id,
        name="Prod Lab Scan Attempt",
        status="in_progress",
        authorization_status="confirmed",
        assessment_type="blackbox_pentest",
    )
    db_session.add(eng)
    db_session.commit()

    asset = Asset(
        client_id=test_client_record.id,
        engagement_id=eng.id,
        name="Lab Target in Prod",
        asset_type="web_application",
        target="http://127.0.0.1:8888",
        in_scope=True,
        authorization_status="verified",
    )
    db_session.add(asset)
    db_session.commit()

    with pytest.raises(ValueError) as excinfo:
        scanner_service.launch_scan(
            db=db_session,
            engagement_id=eng.id,
            target_asset_id=asset.id,
            scan_mode="blackbox",
        )
    assert "ssrf" in str(excinfo.value).lower() or "disallowed" in str(excinfo.value).lower()


def test_findings_launch_scan_endpoint_production_mode_blocks_lab_target(
    auth_client, db_session, test_client_record, monkeypatch
):
    """
    Regression test for LNA-14: Fail-closed production guard on /findings/launch-scan entry point.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "ALLOW_LAB_TESTING", True)

    eng = Engagement(
        client_id=test_client_record.id,
        name="Prod Findings Launch Scan",
        status="in_progress",
        authorization_status="confirmed",
        assessment_type="blackbox_pentest",
    )
    db_session.add(eng)
    db_session.commit()

    asset = Asset(
        client_id=test_client_record.id,
        engagement_id=eng.id,
        name="Lab Target via API",
        asset_type="web_application",
        target="http://127.0.0.1:8888",
        in_scope=True,
        authorization_status="verified",
    )
    db_session.add(asset)
    db_session.commit()

    payload = {
        "engagement_id": eng.id,
        "target_asset_id": asset.id,
        "scan_mode": "blackbox",
        "is_mock_run": True,
    }
    resp = auth_client.post("/api/v1/findings/launch-scan", json=payload)
    assert resp.status_code == 400
    detail = resp.json()["detail"].lower()
    assert "ssrf" in detail or "disallowed" in detail


def test_launch_scan_rejects_git_urls_for_source_repo(db_session, test_client_record):
    """
    Regression test for LNA-14: Rejects direct Git URLs for source-assisted bind mounts.
    Direct Git URLs cannot be mounted as host directories.
    """
    eng = Engagement(
        client_id=test_client_record.id,
        name="Git URL Source Pentest",
        status="in_progress",
        authorization_status="confirmed",
        assessment_type="whitebox_audit",
    )
    db_session.add(eng)
    db_session.commit()

    asset = Asset(
        client_id=test_client_record.id,
        engagement_id=eng.id,
        name="Public App Target",
        asset_type="web_application",
        target="https://example.com",
        in_scope=True,
        authorization_status="verified",
    )
    db_session.add(asset)
    db_session.commit()

    with pytest.raises(ValueError) as excinfo:
        scanner_service.launch_scan(
            db=db_session,
            engagement_id=eng.id,
            target_asset_id=asset.id,
            scan_mode="source_assisted",
            source_repo="https://github.com/lazynerds/vulnerable-lab.git",
        )
    assert "direct git repository url" in str(excinfo.value).lower() or "cannot be directly mounted" in str(excinfo.value).lower()


def test_validate_target_url_ssrf_restricts_lab_to_owned_port_8888(monkeypatch):
    """
    Verifies that in non-production with ALLOW_LAB_TESTING=True,
    loopback is permitted EXCLUSIVELY on the owned lab port 8888.
    All other loopback ports (80, 443, 8000, 3000, etc.) are rejected.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ALLOW_LAB_TESTING", True)

    # Owned lab port 8888 is permitted
    is_safe, _ = validate_target_url_ssrf("http://127.0.0.1:8888", allow_lab_testing=True)
    assert is_safe

    # Default web port 80 on loopback is rejected
    is_safe, msg = validate_target_url_ssrf("http://127.0.0.1", allow_lab_testing=True)
    assert not is_safe
    assert "ssrf" in msg.lower() or "disallowed" in msg.lower()

    # Port 8000 (FixOps internal backend) on loopback is rejected
    is_safe, msg = validate_target_url_ssrf("http://127.0.0.1:8000/api/v1/health", allow_lab_testing=True)
    assert not is_safe
    assert "ssrf" in msg.lower() or "infrastructure port" in msg.lower() or "disallowed" in msg.lower()
