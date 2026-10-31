import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", backref="password_reset_tokens")

    __table_args__ = (
        Index("idx_pwd_reset_token_hash", "token_hash"),
        Index("idx_pwd_reset_user_expires", "user_id", "expires_at"),
    )

    def __repr__(self) -> str:
        return f"<PasswordResetToken(id='{self.id}', user_id='{self.user_id}', used={self.used_at is not None})>"


class PasswordResetCode(Base):
    __tablename__ = "password_reset_codes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    code_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    resend_available_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    reset_token_hash = Column(String(255), nullable=True, index=True)
    reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", backref="password_reset_codes")

    __table_args__ = (
        Index("idx_pwd_reset_code_email_expires", "email", "expires_at"),
        Index("idx_pwd_reset_code_email_used", "email", "used_at"),
    )

    def __repr__(self) -> str:
        return f"<PasswordResetCode(id='{self.id}', email='{self.email}', used={self.used_at is not None})>"
