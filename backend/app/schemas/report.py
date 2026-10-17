from datetime import datetime
from typing import Optional, List, Literal, Any, Dict
from pydantic import BaseModel, Field, field_serializer
from app.schemas.common import serialize_utc_datetime


ReportTypeLiteral = Literal[
    "executive_summary",
    "technical_findings",
    "full_assessment",
    "remediation_audit",
]
ReportStatusLiteral = Literal["draft", "generated", "archived"]


class ReportCreate(BaseModel):
    engagement_id: str = Field(..., min_length=36, max_length=36)
    title: str = Field(..., min_length=1, max_length=255)
    report_type: ReportTypeLiteral = "full_assessment"
    summary_content: Optional[str] = None


class ReportOut(BaseModel):
    id: str
    engagement_id: str
    engagement_name: Optional[str] = None
    title: str
    report_type: str
    status: str
    summary_content: Optional[str] = None
    findings_snapshot: Optional[str] = None
    metrics_snapshot: Optional[str] = None
    generated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at", "updated_at", when_used="json")
    def serialize_dt(self, dt: datetime) -> str:
        return serialize_utc_datetime(dt)


class ReportListResponse(BaseModel):
    items: List[ReportOut]
    total: int
    page: int
    page_size: int
    total_pages: int
