import pytest
from datetime import datetime, timezone, timedelta
from fastapi import status


@pytest.fixture
def setup_client_and_engagement(client, auth_headers):
    # 1. Create client
    c_resp = client.post(
        "/api/v1/clients",
        headers=auth_headers,
        json={
            "company_name": "Acme Cyber Corp",
            "primary_contact_name": "Alice Smith",
            "primary_contact_email": "alice@acme.com",
            "industry": "FinTech",
        },
    )
    assert c_resp.status_code == status.HTTP_201_CREATED
    client_data = c_resp.json()

    # 2. Create engagement
    e_resp = client.post(
        "/api/v1/engagements",
        headers=auth_headers,
        json={
            "client_id": client_data["id"],
            "name": "Q4 Penetration Test",
            "assessment_type": "Web App Pen Test",
            "status": "draft",
            "authorization_status": "confirmed",
        },
    )
    assert e_resp.status_code == status.HTTP_201_CREATED
    engagement_data = e_resp.json()

    return client_data, engagement_data


def test_asset_management_and_scope_enforcement(client, auth_headers, setup_client_and_engagement):
    c_data, engagement = setup_client_and_engagement

    # 1. Create in-scope asset
    in_scope_resp = client.post(
        "/api/v1/assets",
        headers=auth_headers,
        json={
            "client_id": c_data["id"],
            "engagement_id": engagement["id"],
            "name": "Acme Payment Gateway API",
            "asset_type": "api",
            "target": "https://api.acme.com/v1",
            "environment": "production",
            "criticality": "critical",
            "in_scope": True,
            "authorization_status": "verified",
        },
    )
    assert in_scope_resp.status_code == status.HTTP_201_CREATED
    in_scope_asset = in_scope_resp.json()
    assert in_scope_asset["in_scope"] is True
    assert in_scope_asset["criticality"] == "critical"

    # 2. Create out-of-scope asset
    out_scope_resp = client.post(
        "/api/v1/assets",
        headers=auth_headers,
        json={
            "client_id": c_data["id"],
            "engagement_id": engagement["id"],
            "name": "Acme Third-Party Partner Portal",
            "asset_type": "web_application",
            "target": "https://partners.acme.com",
            "environment": "production",
            "criticality": "high",
            "in_scope": False,
            "authorization_status": "unauthorized",
        },
    )
    assert out_scope_resp.status_code == status.HTTP_201_CREATED
    out_scope_asset = out_scope_resp.json()
    assert out_scope_asset["in_scope"] is False

    # 3. List assets with filter
    list_resp = client.get(
        f"/api/v1/assets?client_id={c_data['id']}&in_scope=true",
        headers=auth_headers,
    )
    assert list_resp.status_code == status.HTTP_200_OK
    assert list_resp.json()["total"] == 1
    assert list_resp.json()["items"][0]["id"] == in_scope_asset["id"]

    # 4. Attempt scan against out-of-scope asset: MUST BE REJECTED
    scan_payload = {
        "engagement_id": engagement["id"],
        "tool_name": "nuclei",
        "target_asset_id": out_scope_asset["id"],
        "scan_data": "{\"template-id\":\"git-config\",\"info\":{\"name\":\"Git Config Exposure\",\"severity\":\"high\"},\"matched-at\":\"https://partners.acme.com/.git/config\"}",
    }
    scan_reject_resp = client.post(
        "/api/v1/findings/import-scan",
        headers=auth_headers,
        json=scan_payload,
    )
    assert scan_reject_resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "out-of-scope" in scan_reject_resp.json()["detail"].lower()


def test_scan_adapter_nuclei_import(client, auth_headers, setup_client_and_engagement):
    c_data, engagement = setup_client_and_engagement

    # Register in-scope asset
    asset_resp = client.post(
        "/api/v1/assets",
        headers=auth_headers,
        json={
            "client_id": c_data["id"],
            "engagement_id": engagement["id"],
            "name": "Auth API",
            "asset_type": "api",
            "target": "https://auth.acme.com",
            "in_scope": True,
        },
    )
    asset = asset_resp.json()

    # Import Nuclei scan output
    nuclei_json = (
        '{"template-id":"cve-2023-12345","info":{"name":"SQL Injection in Auth","severity":"critical",'
        '"classification":{"cve-id":["CVE-2023-12345"],"cvss-score":9.8},'
        '"description":"Unauthenticated SQL injection allows remote code execution.",'
        '"remediation":"Upgrade auth-service to v2.4.1 or apply parameterized query patches."}'
        ',"matched-at":"https://auth.acme.com/api/login","curl-command":"curl -X POST https://auth.acme.com/api/login -d user=admin"}'
    )
    scan_resp = client.post(
        "/api/v1/findings/import-scan",
        headers=auth_headers,
        json={
            "engagement_id": engagement["id"],
            "tool_name": "nuclei",
            "target_asset_id": asset["id"],
            "scan_data": nuclei_json,
            "auto_create_findings": True,
        },
    )
    assert scan_resp.status_code == status.HTTP_201_CREATED
    assessment = scan_resp.json()
    assert assessment["findings_count"] == 1

    # Verify created finding
    findings_resp = client.get(
        f"/api/v1/findings?engagement_id={engagement['id']}",
        headers=auth_headers,
    )
    assert findings_resp.status_code == status.HTTP_200_OK
    items = findings_resp.json()["items"]
    assert len(items) == 1
    f = items[0]
    assert f["severity"] == "critical"
    assert f["cve_id"] == "CVE-2023-12345"
    assert f["cvss_score"] == 9.8
    assert f["status"] == "open"


def test_remediation_and_verification_workflow(client, auth_headers, setup_client_and_engagement):
    c_data, engagement = setup_client_and_engagement

    # 1. Create a manual finding
    f_resp = client.post(
        "/api/v1/findings",
        headers=auth_headers,
        json={
            "engagement_id": engagement["id"],
            "title": "Cross-Site Scripting (Reflected)",
            "severity": "medium",
            "cvss_score": 6.1,
            "status": "open",
            "description": "Unescaped user input rendered in profile view.",
        },
    )
    assert f_resp.status_code == status.HTTP_201_CREATED
    finding = f_resp.json()

    # 2. Module E Rule: Attempting to mark 'verified_fixed' without verification must FAIL
    patch_fail = client.patch(
        f"/api/v1/findings/{finding['id']}",
        headers=auth_headers,
        json={"status": "verified_fixed"},
    )
    assert patch_fail.status_code == status.HTTP_400_BAD_REQUEST
    assert "verification" in patch_fail.json()["detail"].lower()

    # 3. Record verification test (passed)
    verif_resp = client.post(
        f"/api/v1/findings/{finding['id']}/verifications",
        headers=auth_headers,
        json={
            "result": "passed",
            "verification_method": "manual_verification",
            "notes": "Verified HTML entity escaping applied to profile bio field.",
        },
    )
    assert verif_resp.status_code == status.HTTP_201_CREATED
    verif = verif_resp.json()
    assert verif["result"] == "passed"

    # 4. Confirm finding status transitioned to 'verified_fixed'
    updated_f = client.get(f"/api/v1/findings/{finding['id']}", headers=auth_headers).json()
    assert updated_f["status"] == "verified_fixed"
    assert len(updated_f["verifications"]) == 1


def test_automation_engine_workflows(client, auth_headers, setup_client_and_engagement):
    c_data, engagement = setup_client_and_engagement

    # 1. Create automation rule with notification action
    rule_resp = client.post(
        "/api/v1/automation/rules",
        headers=auth_headers,
        json={
            "name": "Auto-Assign & Notify on Critical Findings",
            "trigger_event": "on_finding_created",
            "conditions": {"severity": "critical"},
            "action_type": "send_notification",
            "action_config": {
                "recipient": "security-lead@lazynerds.com",
                "title": "URGENT: Critical Finding Discovered",
                "message": "A critical vulnerability was identified and requires immediate remediation.",
            },
            "is_active": True,
            "requires_approval": False,
        },
    )
    assert rule_resp.status_code == status.HTTP_201_CREATED
    rule = rule_resp.json()

    # 2. Trigger rule by creating a critical finding
    f_resp = client.post(
        "/api/v1/findings",
        headers=auth_headers,
        json={
            "engagement_id": engagement["id"],
            "title": "Remote Code Execution via Log4Shell",
            "severity": "critical",
            "cvss_score": 10.0,
            "status": "open",
        },
    )
    assert f_resp.status_code == status.HTTP_201_CREATED

    # 3. Check execution history
    exec_resp = client.get(
        f"/api/v1/automation/executions?rule_id={rule['id']}",
        headers=auth_headers,
    )
    assert exec_resp.status_code == status.HTTP_200_OK
    execs = exec_resp.json()["items"]
    assert len(execs) >= 1
    assert execs[0]["status"] == "completed"

    # 4. Create an approval-gated rule
    gated_rule_resp = client.post(
        "/api/v1/automation/rules",
        headers=auth_headers,
        json={
            "name": "Sensitive Rescan Gate",
            "trigger_event": "on_remediation_requested",
            "action_type": "trigger_adapter_scan",
            "is_active": True,
            "requires_approval": True,
        },
    )
    gated_rule = gated_rule_resp.json()

    # Manual dispatch to test approval queue
    dispatch_resp = client.post(
        "/api/v1/automation/dispatch",
        headers=auth_headers,
        json={"rule_id": gated_rule["id"], "payload": {"engagement_id": engagement["id"]}},
    )
    assert dispatch_resp.status_code == status.HTTP_201_CREATED
    queued_exec = dispatch_resp.json()
    assert queued_exec["status"] == "pending_approval"

    # Approve the execution
    approve_resp = client.post(
        f"/api/v1/automation/executions/{queued_exec['id']}/approve",
        headers=auth_headers,
        json={"action": "approve", "notes": "Approved rescan authorization."},
    )
    assert approve_resp.status_code == status.HTTP_200_OK
    assert approve_resp.json()["status"] == "completed"


def test_reporting_and_evidence_generation(client, auth_headers, setup_client_and_engagement):
    c_data, engagement = setup_client_and_engagement

    # Generate Report
    rep_resp = client.post(
        "/api/v1/reports",
        headers=auth_headers,
        json={
            "engagement_id": engagement["id"],
            "title": "Final Pentest Audit Report - Acme",
            "report_type": "full_assessment",
        },
    )
    assert rep_resp.status_code == status.HTTP_201_CREATED
    report = rep_resp.json()
    assert report["status"] == "generated"
    assert "Executive Cybersecurity Assessment Report" in report["summary_content"]

    # Download HTML
    download_resp = client.get(
        f"/api/v1/reports/{report['id']}/download?format=html",
        headers=auth_headers,
    )
    assert download_resp.status_code == status.HTTP_200_OK
    assert "<!DOCTYPE html>" in download_resp.text


def test_overview_metrics_endpoint(client, auth_headers, setup_client_and_engagement):
    metrics_resp = client.get("/api/v1/overview/metrics", headers=auth_headers)
    assert metrics_resp.status_code == status.HTTP_200_OK
    metrics = metrics_resp.json()
    assert metrics["clients_total"] >= 1
    assert metrics["engagements_total"] >= 1
    assert "critical" in metrics["severity_distribution"]
    assert "recent_activity" in metrics
