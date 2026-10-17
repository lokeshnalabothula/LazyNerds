from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.notification import Notification


def create_notification(
    db: Session,
    recipient_email: str,
    title: str,
    message: str,
    notification_type: str = "system",
    link: Optional[str] = None,
) -> Notification:
    """Creates an in-app notification for a user."""
    notif = Notification(
        recipient_email=recipient_email,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
        is_read=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def get_user_notifications(
    db: Session,
    recipient_email: str,
    limit: int = 50,
) -> tuple[List[Notification], int, int]:
    base_query = db.query(Notification).filter(Notification.recipient_email == recipient_email)
    total = base_query.count()
    unread_count = base_query.filter(Notification.is_read.is_(False)).count()
    items = base_query.order_by(desc(Notification.created_at)).limit(limit).all()
    return items, total, unread_count


def mark_notification_read(db: Session, notification_id: str, recipient_email: str) -> Optional[Notification]:
    notif = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.recipient_email == recipient_email,
        )
        .first()
    )
    if notif:
        notif.is_read = True
        db.commit()
        db.refresh(notif)
    return notif


def mark_all_read(db: Session, recipient_email: str) -> int:
    updated = (
        db.query(Notification)
        .filter(
            Notification.recipient_email == recipient_email,
            Notification.is_read.is_(False),
        )
        .update({"is_read": True})
    )
    db.commit()
    return updated
