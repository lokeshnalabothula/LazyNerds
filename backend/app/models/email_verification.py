import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Integer, Index
from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), nullable=False, index=True)
    code_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    resend_available_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        Index("idx_email_verif_email_expires", "email", "expires_at"),
        Index("idx_email_verif_email_used", "email", "used_at"),
    )

    def __repr__(self) -> str:
        return f"<EmailVerificationCode(id='{self.id}', email='{self.email}', used={self.used_at is not None})>"
