from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.client import Client
from app.models.engagement import Engagement
from app.models.asset import Asset
from app.models.finding import Finding
from app.models.automation import AutomationRule, AutomationExecution
from app.models.audit_log import AuditLog
from app.schemas.overview import OverviewMetrics
from app.schemas.audit_log import AuditLogOut


def get_overview_metrics(db: Session) -> OverviewMetrics:
    # 1. Clients
    clients_total = db.query(Client).count()
    clients_active = db.query(Client).filter(Client.status == "active").count()

    # 2. Engagements
    engagements_total = db.query(Engagement).count()
    engagements_active = (
        db.query(Engagement)
        .filter(Engagement.status.in_(["planned", "in_progress"]))
        .count()
    )

    # 3. Assets
    assets_total = db.query(Asset).count()
    assets_in_scope = db.query(Asset).filter(Asset.in_scope.is_(True)).count()

    # 4. Findings
    findings_total = db.query(Finding).count()
    findings_open = db.query(Finding).filter(Finding.status == "open").count()
    findings_in_remediation = db.query(Finding).filter(Finding.status == "in_remediation").count()
    findings_verified_fixed = db.query(Finding).filter(Finding.status == "verified_fixed").count()

    # Severity distribution
    severity_rows = (
        db.query(Finding.severity, func.count(Finding.id))
        .group_by(Finding.severity)
        .all()
    )
    severity_distribution = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for sev, count in severity_rows:
        if sev in severity_distribution:
            severity_distribution[sev] = count

    # 5. Automation
    automation_rules_active = (
        db.query(AutomationRule).filter(AutomationRule.is_active.is_(True)).count()
    )
    automation_executions_total = db.query(AutomationExecution).count()
    pending_approvals_total = (
        db.query(AutomationExecution)
        .filter(AutomationExecution.status == "pending_approval")
        .count()
    )

    # 6. Recent Audit Activities
    recent_logs = (
        db.query(AuditLog)
        .order_by(desc(AuditLog.created_at))
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
        severity_distribution=severity_distribution,
        automation_rules_active=automation_rules_active,
        automation_executions_total=automation_executions_total,
        pending_approvals_total=pending_approvals_total,
        recent_activity=recent_activity,
    )
