from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.client import Client
from app.models.engagement import Engagement
from app.models.asset import Asset
from app.models.finding import Finding, Assessment
from app.models.automation import AutomationRule, AutomationExecution
from app.models.audit_log import AuditLog
from app.models.registration import ClientRegistration
from app.models.user import User
from app.schemas.overview import OverviewMetrics
from app.schemas.audit_log import AuditLogOut


def get_overview_metrics(db: Session, user: Optional[User] = None) -> OverviewMetrics:
    user_role = getattr(user, "role", "founder") if user else "founder"
    client_id = getattr(user, "client_id", None) if user else None
    user_id = getattr(user, "id", None) if user else None
    org_id = getattr(user, "organization_id", None) if user else None

    # Base queries scoped by organization and role
    client_q = db.query(Client)
    engagement_q = db.query(Engagement)
    asset_q = db.query(Asset)
    finding_q = db.query(Finding).join(Engagement, Finding.engagement_id == Engagement.id)
    audit_q = db.query(AuditLog)

    if org_id:
        client_q = client_q.filter(Client.organization_id == org_id)
        engagement_q = engagement_q.filter(Engagement.organization_id == org_id)
        asset_q = asset_q.filter(Asset.organization_id == org_id)
        finding_q = finding_q.filter(Engagement.organization_id == org_id)
        audit_q = audit_q.filter(AuditLog.organization_id == org_id)

    is_client_user = getattr(user, "is_client", False) or user_role == "client"
    is_worker_user = getattr(user, "is_worker", False) or user_role in ("employee", "worker")
    is_owner_user = getattr(user, "is_owner", False) or user_role in ("founder", "admin", "owner")

    if is_client_user:
        if client_id:
            client_q = client_q.filter(Client.id == client_id)
            engagement_q = engagement_q.filter(Engagement.client_id == client_id)
            asset_q = asset_q.filter(Asset.client_id == client_id)
            finding_q = finding_q.filter(Engagement.client_id == client_id)
            audit_q = audit_q.filter(AuditLog.user_email == user.email)
        else:
            client_q = client_q.filter(Client.id == "none")
            engagement_q = engagement_q.filter(Engagement.id == "none")
            asset_q = asset_q.filter(Asset.id == "none")
            finding_q = finding_q.filter(Finding.id == "none")
            audit_q = audit_q.filter(AuditLog.user_email == "none")
    elif is_worker_user:
        # Scoped to assigned clients if any
        assigned_count = db.query(Client).filter(Client.assigned_employee_id == user_id).count()
        if assigned_count > 0:
            assigned_ids = [c.id for c in db.query(Client.id).filter(Client.assigned_employee_id == user_id).all()]
            client_q = client_q.filter(Client.id.in_(assigned_ids))
            engagement_q = engagement_q.filter(Engagement.client_id.in_(assigned_ids))
            asset_q = asset_q.filter(Asset.client_id.in_(assigned_ids))
            finding_q = finding_q.filter(Engagement.client_id.in_(assigned_ids))
        # Workers cannot view founder-level registration review audit logs
        audit_q = audit_q.filter(~AuditLog.action.like("%REGISTRATION%"))

    # 1. Clients
    clients_total = client_q.count()
    clients_active = client_q.filter(Client.status == "active").count()

    # 2. Engagements
    engagements_total = engagement_q.count()
    engagements_active = (
        engagement_q.filter(Engagement.status.in_(["planned", "in_progress"]))
        .count()
    )

    # 3. Assets
    assets_total = asset_q.count()
    assets_in_scope = asset_q.filter(Asset.in_scope.is_(True)).count()

    # 4. Findings
    findings_total = finding_q.count()
    findings_open = finding_q.filter(Finding.status == "open").count()
    findings_in_remediation = finding_q.filter(Finding.status == "in_remediation").count()
    findings_verified_fixed = finding_q.filter(Finding.status == "verified_fixed").count()
    critical_findings_open = finding_q.filter(Finding.status == "open", Finding.severity == "critical").count()
    high_findings_open = finding_q.filter(Finding.status == "open", Finding.severity == "high").count()

    # Severity distribution
    severity_rows = (
        finding_q.with_entities(Finding.severity, func.count(Finding.id))
        .group_by(Finding.severity)
        .all()
    )
    severity_distribution = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for sev, count in severity_rows:
        if sev in severity_distribution:
            severity_distribution[sev] = count

    # 5. Automation & Operational Alerts
    automation_rules_active = (
        db.query(AutomationRule).filter(AutomationRule.is_active.is_(True)).count()
        if (is_owner_user or is_worker_user)
        else 0
    )
    automation_executions_total = (
        db.query(AutomationExecution).count()
        if (is_owner_user or is_worker_user)
        else 0
    )
    pending_approvals_total = (
        db.query(AutomationExecution)
        .filter(AutomationExecution.status == "pending_approval")
        .count()
        if is_owner_user
        else 0
    )
    recent_failures_total = (
        db.query(AutomationExecution).filter(AutomationExecution.status == "failed").count()
        if (is_owner_user or is_worker_user)
        else 0
    )

    # 6. Registrations (Owner-only; strictly 0 for workers and clients)
    reg_q = db.query(ClientRegistration).filter(ClientRegistration.status == "pending")
    if org_id:
        reg_q = reg_q.filter(ClientRegistration.organization_id == org_id)
    pending_registrations_total = (
        reg_q.count()
        if is_owner_user
        else 0
    )

    # 7. Assessments
    assessment_q = db.query(Assessment).join(Engagement, Assessment.engagement_id == Engagement.id).filter(Assessment.status == "in_progress")
    if org_id:
        assessment_q = assessment_q.filter(Engagement.organization_id == org_id)
    if is_client_user:
        if client_id:
            assessment_q = assessment_q.filter(Engagement.client_id == client_id)
        else:
            assessment_q = assessment_q.filter(Assessment.id == "none")
    active_assessments_total = assessment_q.count()

    # 8. Recent Audit Activities
    recent_logs = (
        audit_q.order_by(desc(AuditLog.created_at))
        .limit(10)
        .all()
    )
    recent_activity = [AuditLogOut.model_validate(log) for log in recent_logs]

    return OverviewMetrics(
        clients_total=clients_total,
        clients_active=clients_active,
        engagements_total=engagements_total,
        engagements_active=engagements_active,
        assets_total=assets_total,
        assets_in_scope=assets_in_scope,
        findings_total=findings_total,
        findings_open=findings_open,
        findings_in_remediation=findings_in_remediation,
        findings_verified_fixed=findings_verified_fixed,
        critical_findings_open=critical_findings_open,
        high_findings_open=high_findings_open,
        severity_distribution=severity_distribution,
        automation_rules_active=automation_rules_active,
        automation_executions_total=automation_executions_total,
        pending_approvals_total=pending_approvals_total,
        recent_failures_total=recent_failures_total,
        pending_registrations_total=pending_registrations_total,
        active_assessments_total=active_assessments_total,
        user_role=user_role,
        recent_activity=recent_activity,
    )

