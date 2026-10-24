import json
import time
import pytest
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.asset import Asset
from app.models.finding import Assessment, Finding
from app.models.user import User
from app.schemas.report import ReportCreate
from app.services import scanner_service, report_service


def test_e2e_shannon_fixops_scan_and_report_flow(db_session):
    """
    End-to-End Proof of Concept:
    1. Register client & confirmed engagement
    2. Add authorized in-scope lab asset (http://127.0.0.1:8888)
    3. Launch source-assisted AI pentest via FixOps backend
    4. Validate SARIF ingestion & automatic finding generation
    5. Compile customer-facing executive report under Lazy Nerds FixOps branding
    """
    # 1. Setup Client
    client = Client(
        company_name="Apex Defense Systems Ltd",
        primary_contact_name="Marcus Vance",
        primary_contact_email="mvance@apexdefense.internal",
        industry="Defense & Aerospace",
    )
    db_session.add(client)
    db_session.commit()
    db_session.refresh(client)

    # 2. Setup Confirmed Engagement
    engagement = Engagement(
        client_id=client.id,
        name="Q4 2026 Comprehensive Application Security Assessment",
        assessment_type="whitebox_audit",
        status="in_progress",
        authorization_status="confirmed",
        scope_summary="Full whitebox audit of Core API & Web Services at http://127.0.0.1:8888",
    )
    db_session.add(engagement)
    db_session.commit()
    db_session.refresh(engagement)

    # 3. Setup In-Scope Authorized Asset
    asset = Asset(
        client_id=client.id,
        engagement_id=engagement.id,
        name="Core Web API Sandbox",
        asset_type="web_application",
        target="http://127.0.0.1:8888",
        environment="staging",
        criticality="critical",
        in_scope=True,
        authorization_status="verified",
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    # Assessor User
    assessor = User(
        email="lead-auditor@lazynerds.com",
        hashed_password="fakehashedpassword123",
        full_name="Lead Security Assessor",
        role="founder",
        is_active=True,
    )
    db_session.add(assessor)
    db_session.commit()

    # 4. Launch Scan via Scanner Service (sync_execution=True for in-memory test transaction)
    assessment = scanner_service.launch_scan(
        db=db_session,
        engagement_id=engagement.id,
        target_asset_id=asset.id,
        scan_mode="source_assisted",
        source_repo="lab/vulnerable_app",
        current_user=assessor,
        is_mock_run=True,
        sync_execution=True,
    )

    assert assessment.id is not None
    assert assessment.assessment_tool == "shannon"
    assert assessment.status == "completed"
    assert assessment.findings_count == 3

    # 5. Verify Findings Created in FixOps
    findings = db_session.query(Finding).filter(Finding.assessment_id == assessment.id).all()
    assert len(findings) == 3

    # Verify specific vulnerabilities
    titles = [f.title for f in findings]
    assert any("SQL Injection" in t for t in titles)
    assert any("Authorization" in t or "BOLA" in t for t in titles)
    assert any("Server-Side Request Forgery" in t or "SSRF" in t for t in titles)

    sql_finding = next(f for f in findings if "SQL Injection" in f.title)
    assert sql_finding.severity == "critical"
    assert sql_finding.cve_id == "CWE-89"
    assert sql_finding.status == "verification_pending"
    assert "[LAB BENCHMARK]" in sql_finding.remediation_notes
    assert "INJ-01" in sql_finding.evidence
    assert "lab/vulnerable_app/main.py:74" in sql_finding.evidence
    assert "parameterized" in sql_finding.remediation_guidance.lower()

    # 6. Generate Customer-Facing Branded FixOps Report
    report_in = ReportCreate(
        engagement_id=engagement.id,
        title="Executive Security Assessment & Remediation Report",
        report_type="full_assessment",
    )

    report = report_service.generate_report(
        db=db_session,
        report_in=report_in,
        current_user=assessor,
    )

    assert report.id is not None
    assert "Executive Cybersecurity Assessment Report" in report.summary_content
    assert "Apex Defense Systems Ltd" in report.summary_content
    assert "Lead Security Assessor" in report.summary_content
    assert "SQL Injection via Product Search Parameter" in report.summary_content
    assert "Server-Side Request Forgery" in report.summary_content
    assert "Broken Object-Level Authorization" in report.summary_content

    # Metrics snapshot check
    metrics = json.loads(report.metrics_snapshot)
    assert metrics["total_findings"] == 3
    assert metrics["severity_breakdown"]["critical"] >= 2
