import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, Index, CheckConstraint
from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Client(Base):
    __tablename__ = "clients"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_name = Column(String(255), nullable=False, index=True)
    primary_contact_name = Column(String(255), nullable=False)
    primary_contact_email = Column(String(255), nullable=False, index=True)
    website = Column(String(500), nullable=True)
    phone = Column(String(50), nullable=True)
    industry = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="active", index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        CheckConstraint("status IN ('active', 'archived')", name="check_client_status"),
        Index("idx_clients_status_created", "status", "created_at"),
        Index("idx_clients_company_status", "company_name", "status"),
    )

    def __repr__(self) -> str:
        return f"<Client(id='{self.id}', company='{self.company_name}', status='{self.status}')>"
