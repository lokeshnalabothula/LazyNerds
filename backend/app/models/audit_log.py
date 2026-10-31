import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    Index,
)
from app.db.session import Base
from app.models.organization import PRIMARY_ORGANIZATION_ID


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), nullable=True, default=PRIMARY_ORGANIZATION_ID, index=True)
    user_email = Column(String(255), nullable=False, index=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False, index=True)
    resource_id = Column(String(36), nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        Index("idx_audit_logs_user_action", "user_email", "action"),
        Index("idx_audit_logs_created_at", "created_at"),
        Index("idx_audit_logs_org_created", "organization_id", "created_at"),
        Index("idx_audit_logs_resource", "resource_type", "resource_id"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog(id='{self.id}', user='{self.user_email}', org='{self.organization_id}', action='{self.action}', resource='{self.resource_type}')>"
