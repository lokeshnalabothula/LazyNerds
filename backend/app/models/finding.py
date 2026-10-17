import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Date,
    DateTime,
    Float,
    Integer,
    ForeignKey,
    Index,
    CheckConstraint,
)
from sqlalchemy.orm import relationship
from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    engagement_id = Column(
        String(36),
        ForeignKey("engagements.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    assessment_tool = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default="completed")
    target_asset_ids = Column(Text, nullable=True)  # JSON-encoded array of asset UUIDs
    findings_count = Column(Integer, default=0, nullable=False)
    execution_summary = Column(Text, nullable=True)
    raw_output = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    engagement = relationship("Engagement", back_populates="assessments")
    findings = relationship("Finding", back_populates="assessment")

    __table_args__ = (
        CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed')",
            name="check_assessment_status",
        ),
        Index("idx_assessments_engagement_status", "engagement_id", "status"),
        Index("idx_assessments_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Assessment(id='{self.id}', name='{self.name}', status='{self.status}')>"


class Finding(Base):
    __tablename__ = "findings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    engagement_id = Column(
        String(36),
        ForeignKey("engagements.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    asset_id = Column(
        String(36),
        ForeignKey("assets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assessment_id = Column(
        String(36),
        ForeignKey("assessments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title = Column(String(255), nullable=False)
    severity = Column(String(20), nullable=False, index=True)
    cvss_score = Column(Float, nullable=True)
    status = Column(String(50), nullable=False, default="open", index=True)
    cve_id = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    impact = Column(Text, nullable=True)
    remediation_guidance = Column(Text, nullable=True)
    evidence = Column(Text, nullable=True)
    references_url = Column(Text, nullable=True)
    remediation_notes = Column(Text, nullable=True)
    remediation_deadline = Column(Date, nullable=True)
    assigned_to = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    engagement = relationship("Engagement", back_populates="findings")
    asset = relationship("Asset", back_populates="findings")
    assessment = relationship("Assessment", back_populates="findings")
    verifications = relationship(
        "Verification",
        back_populates="finding",
        cascade="all, delete-orphan",
        order_by="desc(Verification.verified_at)",
    )

    __table_args__ = (
        CheckConstraint(
            "severity IN ('critical', 'high', 'medium', 'low', 'info')",
            name="check_finding_severity",
        ),
        CheckConstraint(
            "status IN ('open', 'in_remediation', 'verification_pending', 'verified_fixed', 'accepted_risk', 'false_positive')",
            name="check_finding_status",
        ),
        Index("idx_findings_engagement_severity", "engagement_id", "severity"),
        Index("idx_findings_status_severity", "status", "severity"),
        Index("idx_findings_created_at", "created_at"),
    )

    @property
    def engagement_name(self) -> str | None:
        return self.engagement.name if self.engagement else None

    @property
    def asset_name(self) -> str | None:
        return self.asset.name if self.asset else None

    def __repr__(self) -> str:
        return f"<Finding(id='{self.id}', title='{self.title}', severity='{self.severity}', status='{self.status}')>"


class Verification(Base):
    __tablename__ = "verifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    finding_id = Column(
        String(36),
        ForeignKey("findings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    verified_by = Column(String(255), nullable=False)
    result = Column(String(50), nullable=False)
    verification_method = Column(String(100), nullable=False)
    notes = Column(Text, nullable=True)
    verified_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    finding = relationship("Finding", back_populates="verifications")

    __table_args__ = (
        CheckConstraint(
            "result IN ('passed', 'failed', 'partially_resolved')",
            name="check_verification_result",
        ),
        CheckConstraint(
            "verification_method IN ('automated_rescan', 'manual_verification', 'code_review')",
            name="check_verification_method",
        ),
        Index("idx_verifications_finding_date", "finding_id", "verified_at"),
    )

    def __repr__(self) -> str:
        return f"<Verification(id='{self.id}', result='{self.result}', finding_id='{self.finding_id}')>"
