from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationListResponse,
    NotificationOut,
)
from app.services import notification_service

router = APIRouter()


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total, unread_count = notification_service.get_user_notifications(
        db=db,
        recipient_email=current_user.email,
        limit=limit,
    )
    return {
        "items": items,
        "total": total,
        "unread_count": unread_count,
    }


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = notification_service.mark_notification_read(
        db=db,
        notification_id=notification_id,
        recipient_email=current_user.email,
    )
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
    return notif


@router.post("/read-all", status_code=status.HTTP_200_OK)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = notification_service.mark_all_read(db=db, recipient_email=current_user.email)
    return {"marked_read": count}
