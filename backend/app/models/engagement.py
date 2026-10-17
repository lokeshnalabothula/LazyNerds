import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Date,
    DateTime,
    ForeignKey,
    Index,
    CheckConstraint,
)
from sqlalchemy.orm import relationship
from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Engagement(Base):
    __tablename__ = "engagements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = Column(
        String(36),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    assessment_type = Column(String(100), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="draft", index=True)
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    scope_summary = Column(Text, nullable=True)
    authorization_status = Column(String(50), nullable=False, default="not_confirmed")
    assigned_to = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    client = relationship("Client", back_populates="engagements")
    assets = relationship("Asset", back_populates="engagement")
    assessments = relationship("Assessment", back_populates="engagement", cascade="all, delete-orphan")
    findings = relationship("Finding", back_populates="engagement", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="engagement", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'planned', 'in_progress', 'on_hold', 'completed', 'cancelled')",
            name="check_engagement_status",
        ),
        CheckConstraint(
            "authorization_status IN ('not_confirmed', 'pending', 'confirmed')",
            name="check_engagement_auth_status",
        ),
        Index("idx_engagements_client_status", "client_id", "status"),
        Index("idx_engagements_created_at", "created_at"),
        Index("idx_engagements_assessment_type", "assessment_type"),
    )

    @property
    def client_company_name(self) -> str | None:
        return self.client.company_name if self.client else None

    @property
    def client_status(self) -> str | None:
        return self.client.status if self.client else None

    def __repr__(self) -> str:
        return f"<Engagement(id='{self.id}', name='{self.name}', status='{self.status}', client_id='{self.client_id}')>"
