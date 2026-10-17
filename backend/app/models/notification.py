import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    DateTime,
    Index,
    CheckConstraint,
)
from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recipient_email = Column(String(255), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False, default="system")
    link = Column(String(500), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "notification_type IN ('finding_alert', 'engagement_due', 'automation_alert', 'verification_result', 'system')",
            name="check_notification_type",
        ),
        Index("idx_notifications_user_read", "recipient_email", "is_read"),
        Index("idx_notifications_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Notification(id='{self.id}', title='{self.title}', read={self.is_read})>"
