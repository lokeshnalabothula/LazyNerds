from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.audit_log import AuditLog


def log_audit(
    db: Session,
    user_email: str,
    action: str,
    resource_type: str,
    resource_id: str,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
    organization_id: Optional[str] = None,
    commit: bool = True,
) -> AuditLog:
    """Safely records an audit trail event for sensitive platform operations."""
    entry = AuditLog(
        organization_id=organization_id,
        user_email=user_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    if commit:
        db.commit()
        db.refresh(entry)
    return entry


def get_audit_logs(
    db: Session,
    organization_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    user_email: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[List[AuditLog], int]:
    query = db.query(AuditLog)
    if organization_id:
        query = query.filter(AuditLog.organization_id == organization_id)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if user_email:
        query = query.filter(AuditLog.user_email == user_email)

    total = query.count()
    items = (
        query.order_by(desc(AuditLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total
