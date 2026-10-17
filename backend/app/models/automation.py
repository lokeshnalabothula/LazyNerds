import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    CheckConstraint,
)
from sqlalchemy.orm import relationship
from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    trigger_event = Column(String(100), nullable=False, index=True)
    conditions = Column(Text, nullable=True)  # JSON-encoded dict: e.g. {"severity": ["critical", "high"]}
    action_type = Column(String(100), nullable=False, index=True)
    action_config = Column(Text, nullable=True)  # JSON-encoded dict
    is_active = Column(Boolean, default=True, nullable=False)
    requires_approval = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    executions = relationship(
        "AutomationExecution",
        back_populates="rule",
        cascade="all, delete-orphan",
        order_by="desc(AutomationExecution.executed_at)",
    )

    __table_args__ = (
        CheckConstraint(
            "trigger_event IN ('on_finding_created', 'on_engagement_created', 'on_remediation_requested', 'scheduled_check')",
            name="check_rule_trigger_event",
        ),
        CheckConstraint(
            "action_type IN ('send_notification', 'assign_remediation_task', 'require_human_approval', 'generate_summary_report', 'trigger_adapter_scan')",
            name="check_rule_action_type",
        ),
        Index("idx_rules_trigger_active", "trigger_event", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<AutomationRule(id='{self.id}', name='{self.name}', active={self.is_active})>"


class AutomationExecution(Base):
    __tablename__ = "automation_executions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rule_id = Column(
        String(36),
        ForeignKey("automation_rules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    trigger_source = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="completed")
    input_payload = Column(Text, nullable=True)
    output_result = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    approved_by = Column(String(255), nullable=True)
    executed_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    rule = relationship("AutomationRule", back_populates="executions")

    __table_args__ = (
        CheckConstraint(
            "status IN ('completed', 'failed', 'pending_approval', 'rejected')",
            name="check_execution_status",
        ),
        Index("idx_executions_rule_status", "rule_id", "status"),
        Index("idx_executions_executed_at", "executed_at"),
    )

    @property
    def rule_name(self) -> str | None:
        return self.rule.name if self.rule else None

    def __repr__(self) -> str:
        return f"<AutomationExecution(id='{self.id}', rule_id='{self.rule_id}', status='{self.status}')>"
