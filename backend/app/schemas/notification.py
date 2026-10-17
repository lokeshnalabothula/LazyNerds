from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


NotificationTypeLiteral = Literal[
    "finding_alert",
    "engagement_due",
    "automation_alert",
    "verification_result",
    "system",
]


class NotificationCreate(BaseModel):
    recipient_email: str = Field(..., min_length=1, max_length=255)
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    notification_type: NotificationTypeLiteral = "system"
    link: Optional[str] = None


class NotificationOut(BaseModel):
    id: str
    recipient_email: str
    title: str
    message: str
    notification_type: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: List[NotificationOut]
    total: int
    unread_count: int
