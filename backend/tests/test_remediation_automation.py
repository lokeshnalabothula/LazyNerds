import json
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models.finding import Finding
from app.models.engagement import Engagement
from app.models.client import Client
from app.models.notification import Notification
from app.models.user import User
from app.schemas.auth import UserCreate
from app.services.auth_service import create_user


def test_remediation_reminder_automation_end_to_end(
    client: TestClient,
    auth_headers: dict,
    db_session: Session,
):
    # 1. Create a test client and engagement
    test_client = Client(
        company_name="Reminder Target Corp",
        primary_contact_name="Bob Security",
        primary_contact_email="bob@remindertarget.com",
    )
    db_session.add(test_client)
    db_session.commit()

    test_eng = Engagement(
        client_id=test_client.id,
        name="Q4 Security Follow-up Assessment",
        assessment_type="External Penetration Test",
        status="in_progress",
        authorization_status="confirmed",
    )
    db_session.add(test_eng)
    db_session.commit()

    today = datetime.now(timezone.utc).date()

    # 2. Create 3 findings:
    # Finding 1: Due in 2 days (Approaching deadline -> Should trigger reminder)
    f_due_soon = Finding(
        engagement_id=test_eng.id,
        title="SQL Injection in API Gateway",
        severity="critical",
        status="in_remediation",
        assigned_to="lead-engineer@lazynerds.com",
        remediation_deadline=today + timedelta(days=2),
    )
    # Finding 2: Overdue by 3 days (Overdue -> Should trigger reminder)
    f_overdue = Finding(
        engagement_id=test_eng.id,
        title="Unauthenticated S3 Bucket Policy",
        severity="high",
        status="open",
        assigned_to="lead-engineer@lazynerds.com",
        remediation_deadline=today - timedelta(days=3),
    )
    # Finding 3: Due in 20 days (Far future -> Should NOT trigger reminder)
    f_future = Finding(
        engagement_id=test_eng.id,
        title="TLS 1.1 Enabled on Backup Server",
        severity="low",
        status="open",
        assigned_to="lead-engineer@lazynerds.com",
        remediation_deadline=today + timedelta(days=20),
    )
    db_session.add_all([f_due_soon, f_overdue, f_future])
    db_session.commit()

    # 3. Trigger Remediation Reminder Automation via API
    response = client.post(
        "/api/v1/automation/remediation-reminders/run?reminder_window_days=3",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["reminders_sent"] == 2
    assert data["duplicates_skipped"] == 0

    # Verify notifications were created
    notifs = (
        db_session.query(Notification)
        .filter(Notification.recipient_email == "lead-engineer@lazynerds.com")
        .all()
    )
    assert len(notifs) >= 2
    titles = [n.title for n in notifs]
    assert any("SQL Injection in API Gateway" in t for t in titles)
    assert any("Unauthenticated S3 Bucket Policy" in t for t in titles)

    # 4. DUPLICATE PREVENTION: Run again immediately -> Must NOT send duplicate notifications!
    response2 = client.post(
        "/api/v1/automation/remediation-reminders/run?reminder_window_days=3",
        headers=auth_headers,
    )
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["reminders_sent"] == 0
    assert data2["duplicates_skipped"] == 2

    # Verify notification count did not increase
    notifs_after = (
        db_session.query(Notification)
        .filter(Notification.recipient_email == "lead-engineer@lazynerds.com")
        .all()
    )
    assert len(notifs_after) == len(notifs)

    # 5. Check Status Telemetry endpoint
    status_res = client.get(
        "/api/v1/automation/remediation-reminders/status",
        headers=auth_headers,
    )
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["status"] == "active"
    assert status_data["last_status"] == "completed"
    assert status_data["open_findings_with_deadlines"] >= 3
    assert status_data["overdue_count"] >= 1


def test_remediation_reminder_client_role_forbidden(
    client: TestClient,
    db_session: Session,
):
    # Create client user
    client_user = create_user(
        db_session,
        UserCreate(
            email="client-test@remindertarget.com",
            password="TestPassword2026!",
            full_name="Client Test",
            role="client",
        ),
    )
    token = create_access_token(
        subject=client_user.id,
        extra_claims={"email": client_user.email, "role": client_user.role},
    )
    client_headers = {"Authorization": f"Bearer {token}"}

    # Clients are strictly forbidden from triggering platform automation
    response = client.post(
        "/api/v1/automation/remediation-reminders/run",
        headers=client_headers,
    )
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"] or "Client accounts may not manually trigger" in response.json()["detail"]


def test_remediation_reminder_skips_cancelled_engagement_and_missing_owners(
    client: TestClient,
    auth_headers: dict,
    db_session: Session,
):
    """
    Verifies that findings in cancelled engagements or with missing owners/deadlines
    are not processed by the remediation reminder engine.
    """
    test_client = Client(
        company_name="Cancelled Eng Corp",
        primary_contact_name="Alice Security",
        primary_contact_email="alice@cancelledeng.com",
    )
    db_session.add(test_client)
    db_session.commit()

    # Cancelled engagement
    cancelled_eng = Engagement(
        client_id=test_client.id,
        name="Cancelled Security Audit",
        assessment_type="Web App Pentest",
        status="cancelled",
        authorization_status="not_confirmed",
    )
    db_session.add(cancelled_eng)
    db_session.commit()

    today = datetime.now(timezone.utc).date()

    # Finding in cancelled engagement - should NOT send reminder
    f_cancelled = Finding(
        engagement_id=cancelled_eng.id,
        title="Cancelled Eng Finding",
        severity="critical",
        status="open",
        assigned_to="alice@cancelledeng.com",
        remediation_deadline=today - timedelta(days=1),
    )
    db_session.add(f_cancelled)
    db_session.commit()

    response = client.post(
        "/api/v1/automation/remediation-reminders/run?reminder_window_days=3",
        headers=auth_headers,
    )
    assert response.status_code == 200

    # Check that Alice received NO notifications
    alice_notifs = (
        db_session.query(Notification)
        .filter(Notification.recipient_email == "alice@cancelledeng.com")
        .all()
    )
    assert len(alice_notifs) == 0


def test_standalone_scheduler_main_task(monkeypatch, db_session):
    """
    Verifies that the standalone background task runner `app.tasks.run_remediation_scheduler.main`
    executes cleanly and records execution logs.
    """
    from app.tasks.run_remediation_scheduler import main as scheduler_main
    # Patch SessionLocal to return db_session
    monkeypatch.setattr("app.tasks.run_remediation_scheduler.SessionLocal", lambda: db_session)
    exit_code = scheduler_main()
    assert exit_code == 0
