from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: str
    user_email: str
    action: str
    resource_type: str
    resource_id: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: List[AuditLogOut]
    total: int
    page: int
    page_size: int
    total_pages: int
