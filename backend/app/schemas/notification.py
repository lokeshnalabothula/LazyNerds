from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, field_serializer
from app.schemas.common import serialize_utc_datetime


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

    @field_serializer("created_at", when_used="json")
    def serialize_dt(self, dt: datetime) -> str:
        return serialize_utc_datetime(dt)


class NotificationListResponse(BaseModel):
    items: List[NotificationOut]
    total: int
    unread_count: int
