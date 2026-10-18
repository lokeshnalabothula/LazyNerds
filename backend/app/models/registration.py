import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index, CheckConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ClientRegistration(Base):
    __tablename__ = "client_registrations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    job_title = Column(String(100), nullable=True)
    company_name = Column(String(255), nullable=False, index=True)
    website = Column(String(500), nullable=True)
    industry = Column(String(100), nullable=True)
    company_size = Column(String(50), nullable=True)
    country = Column(String(100), nullable=True)
    requested_services = Column(Text, nullable=True)
    scope_description = Column(Text, nullable=True)
    primary_domains = Column(Text, nullable=True)

    # Status: pending, needs_information, approved, rejected, suspended
    status = Column(String(50), nullable=False, default="pending", index=True)
    review_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    reviewed_by = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    client_id = Column(String(36), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    client = relationship("Client", foreign_keys=[client_id])
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'needs_information', 'approved', 'rejected', 'suspended')",
            name="check_registration_status",
        ),
        Index("idx_client_reg_status_created", "status", "created_at"),
        Index("idx_client_reg_email_status", "email", "status"),
    )

    def __repr__(self) -> str:
        return f"<ClientRegistration(id='{self.id}', email='{self.email}', company='{self.company_name}', status='{self.status}')>"
