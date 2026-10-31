import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    Index,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.models.organization import PRIMARY_ORGANIZATION_ID


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Domain(Base):
    """
    Represents a customer-registered domain requiring DNS TXT ownership verification.
    Stores cryptographically secure verification challenges without persisting plaintext tokens.
    """
    __tablename__ = "domains"

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
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    domain = Column(String(255), nullable=False)
    normalized_domain = Column(String(255), nullable=False, index=True)
    verification_status = Column(
        String(50),
        nullable=False,
        default="pending",
        index=True,
    )
    verification_token_hash = Column(String(64), nullable=False)
    challenge_created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    challenge_expires_at = Column(DateTime(timezone=True), nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    last_verification_attempt_at = Column(DateTime(timezone=True), nullable=True)
    verification_attempt_count = Column(Integer, default=0, nullable=False)
    failure_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    organization = relationship("Organization", foreign_keys=[organization_id], back_populates="domains")
    client = relationship("Client", back_populates="domains")

    __table_args__ = (
        UniqueConstraint("client_id", "normalized_domain", name="uq_client_normalized_domain"),
        CheckConstraint(
            "verification_status IN ('pending', 'verified', 'failed', 'expired')",
            name="check_domain_verification_status",
        ),
        Index("idx_domains_client_status", "client_id", "verification_status"),
        Index("idx_domains_org_status", "organization_id", "verification_status"),
        Index("idx_domains_normalized_domain", "normalized_domain"),
    )

    def __repr__(self) -> str:
        return f"<Domain(id='{self.id}', domain='{self.normalized_domain}', status='{self.verification_status}', org='{self.organization_id}')>"
