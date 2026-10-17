import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    ForeignKey,
    Index,
    CheckConstraint,
)
from sqlalchemy.orm import relationship
from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    engagement_id = Column(
        String(36),
        ForeignKey("engagements.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    report_type = Column(String(50), nullable=False, default="full_assessment")
    status = Column(String(50), nullable=False, default="generated")
    summary_content = Column(Text, nullable=True)
    findings_snapshot = Column(Text, nullable=True)  # JSON-encoded array of findings
    metrics_snapshot = Column(Text, nullable=True)  # JSON-encoded summary metrics
    generated_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    engagement = relationship("Engagement", back_populates="reports")

    __table_args__ = (
        CheckConstraint(
            "report_type IN ('executive_summary', 'technical_findings', 'full_assessment', 'remediation_audit')",
            name="check_report_type",
        ),
        CheckConstraint(
            "status IN ('draft', 'generated', 'archived')",
            name="check_report_status",
        ),
        Index("idx_reports_engagement", "engagement_id"),
        Index("idx_reports_created_at", "created_at"),
    )

    @property
    def engagement_name(self) -> str | None:
        return self.engagement.name if self.engagement else None

    def __repr__(self) -> str:
        return f"<Report(id='{self.id}', title='{self.title}', type='{self.report_type}')>"
