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
from app.models.organization import PRIMARY_ORGANIZATION_ID


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Asset(Base):
    __tablename__ = "assets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(
        String(36),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        default=PRIMARY_ORGANIZATION_ID,
        index=True,
    )
    client_id = Column(
        String(36),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    engagement_id = Column(
        String(36),
        ForeignKey("engagements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name = Column(String(255), nullable=False)
    asset_type = Column(String(50), nullable=False, index=True)
    target = Column(String(500), nullable=False)
    environment = Column(String(50), nullable=False, default="production")
    criticality = Column(String(20), nullable=False, default="medium")
    in_scope = Column(Boolean, nullable=False, default=True)
    authorization_status = Column(String(50), nullable=False, default="verified")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    organization = relationship("Organization", foreign_keys=[organization_id], back_populates="assets")
    client = relationship("Client", back_populates="assets")
    engagement = relationship("Engagement", back_populates="assets")
    findings = relationship("Finding", back_populates="asset", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "asset_type IN ('domain', 'ip_address', 'web_application', 'api', 'cloud_resource', 'network_range')",
            name="check_asset_type",
        ),
        CheckConstraint(
            "environment IN ('production', 'staging', 'development')",
            name="check_asset_environment",
        ),
        CheckConstraint(
            "criticality IN ('critical', 'high', 'medium', 'low')",
            name="check_asset_criticality",
        ),
        CheckConstraint(
            "authorization_status IN ('verified', 'pending', 'unauthorized')",
            name="check_asset_authorization_status",
        ),
        Index("idx_assets_client_scope", "client_id", "in_scope"),
        Index("idx_assets_org_scope", "organization_id", "in_scope"),
        Index("idx_assets_engagement", "engagement_id"),
        Index("idx_assets_criticality", "criticality"),
    )

    @property
    def client_company_name(self) -> str | None:
        return self.client.company_name if self.client else None

    @property
    def engagement_name(self) -> str | None:
        return self.engagement.name if self.engagement else None

    def __repr__(self) -> str:
        return f"<Asset(id='{self.id}', name='{self.name}', type='{self.asset_type}', in_scope={self.in_scope}, org='{self.organization_id}')>"
