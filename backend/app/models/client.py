import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, Index, CheckConstraint, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.models.organization import PRIMARY_ORGANIZATION_ID


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Client(Base):
    __tablename__ = "clients"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, default=PRIMARY_ORGANIZATION_ID, index=True)
    company_name = Column(String(255), nullable=False, index=True)
    primary_contact_name = Column(String(255), nullable=False)
    primary_contact_email = Column(String(255), nullable=False, index=True)
    website = Column(String(500), nullable=True)
    phone = Column(String(50), nullable=True)
    industry = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="active", index=True)
    assigned_employee_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL", use_alter=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    organization = relationship("Organization", foreign_keys=[organization_id], back_populates="clients")
    engagements = relationship("Engagement", back_populates="client")
    assets = relationship("Asset", back_populates="client")
    domains = relationship("Domain", back_populates="client", cascade="all, delete-orphan")
    users = relationship("User", foreign_keys="User.client_id", back_populates="client")
    assigned_employee = relationship("User", foreign_keys=[assigned_employee_id], backref="assigned_clients")

    __table_args__ = (
        CheckConstraint("status IN ('active', 'archived')", name="check_client_status"),
        Index("idx_clients_status_created", "status", "created_at"),
        Index("idx_clients_company_status", "company_name", "status"),
        Index("idx_clients_org_status", "organization_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<Client(id='{self.id}', company='{self.company_name}', org='{self.organization_id}', status='{self.status}')>"
