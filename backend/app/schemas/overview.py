from typing import Dict, List, Any
from pydantic import BaseModel
from app.schemas.audit_log import AuditLogOut


class OverviewMetrics(BaseModel):
    clients_total: int
    clients_active: int
    engagements_total: int
    engagements_active: int
    assets_total: int
    assets_in_scope: int
    findings_total: int
    findings_open: int
    findings_in_remediation: int
    findings_verified_fixed: int
    severity_distribution: Dict[str, int]
    automation_rules_active: int
    automation_executions_total: int
    pending_approvals_total: int
    recent_activity: List[AuditLogOut]
