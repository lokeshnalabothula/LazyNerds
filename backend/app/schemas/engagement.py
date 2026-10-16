from datetime import date, datetime, timezone
from enum import Enum
from typing import List, Optional
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)


class AssessmentType(str, Enum):
    WEB_APP = "Web App Pen Test"
    EXTERNAL_NETWORK = "External Network Pen Test"
    INTERNAL_NETWORK = "Internal Network Pen Test"
    API_SECURITY = "API Security Assessment"
    CLOUD_SECURITY = "Cloud Security Assessment"
    VULNERABILITY_ASSESSMENT = "Vulnerability Assessment"
    MOBILE_APP = "Mobile App Security Assessment"
    SECURITY_AUDIT = "Security Audit"
    CONFIGURATION_REVIEW = "Configuration Review"
    RED_TEAM = "Red Team Assessment"
    OTHER = "Other"


class EngagementStatus(str, Enum):
    DRAFT = "draft"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AuthorizationStatus(str, Enum):
    NOT_CONFIRMED = "not_confirmed"
    PENDING = "pending"
    CONFIRMED = "confirmed"


VALID_STATUS_TRANSITIONS = {
    EngagementStatus.DRAFT.value: {
        EngagementStatus.DRAFT.value,
        EngagementStatus.PLANNED.value,
        EngagementStatus.CANCELLED.value,
    },
    EngagementStatus.PLANNED.value: {
        EngagementStatus.PLANNED.value,
        EngagementStatus.IN_PROGRESS.value,
        EngagementStatus.DRAFT.value,
        EngagementStatus.CANCELLED.value,
    },
    EngagementStatus.IN_PROGRESS.value: {
        EngagementStatus.IN_PROGRESS.value,
        EngagementStatus.ON_HOLD.value,
        EngagementStatus.COMPLETED.value,
        EngagementStatus.CANCELLED.value,
    },
    EngagementStatus.ON_HOLD.value: {
        EngagementStatus.ON_HOLD.value,
        EngagementStatus.IN_PROGRESS.value,
        EngagementStatus.CANCELLED.value,
    },
    EngagementStatus.COMPLETED.value: {
        EngagementStatus.COMPLETED.value,
    },
    EngagementStatus.CANCELLED.value: {
        EngagementStatus.CANCELLED.value,
        EngagementStatus.DRAFT.value,
    },
}


class EngagementBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Engagement title or name")
    assessment_type: AssessmentType = Field(..., description="Assessment type classification")
    status: EngagementStatus = Field(default=EngagementStatus.DRAFT, description="Operational lifecycle status")
    start_date: Optional[date] = Field(None, description="Scheduled start date (YYYY-MM-DD)")
    due_date: Optional[date] = Field(None, description="Scheduled completion or due date (YYYY-MM-DD)")
    description: Optional[str] = Field(None, max_length=10000, description="Detailed engagement narrative / scope notes")
    scope_summary: Optional[str] = Field(None, max_length=10000, description="Summary of authorized target scope (IPs, URLs, repos, cloud environments)")
    authorization_status: AuthorizationStatus = Field(
        default=AuthorizationStatus.NOT_CONFIRMED,
        description="Client written authorization status",
    )
    assigned_to: Optional[str] = Field(None, max_length=255, description="Lead assessor or team member identifier")

    @field_validator("name")
    @classmethod
    def validate_non_whitespace(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Engagement name must not be empty or whitespace only.")
        return stripped

    @field_validator("description", "scope_summary", "assigned_to")
    @classmethod
    def strip_optional_strings(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        stripped = v.strip()
        return stripped if stripped else None

    @model_validator(mode="after")
    def validate_dates(self) -> "EngagementBase":
        if self.start_date is not None and self.due_date is not None:
            if self.due_date < self.start_date:
                raise ValueError("Due date cannot precede start date.")
        return self


class EngagementCreate(EngagementBase):
    client_id: str = Field(..., min_length=1, max_length=36, description="UUID of associated client")
    created_at: Optional[datetime] = Field(None, description="Custom creation timestamp (UTC timezone-aware)")

    @field_validator("client_id")
    @classmethod
    def validate_client_id(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("client_id must not be empty or whitespace only.")
        return stripped

    @field_validator("created_at")
    @classmethod
    def validate_timezone_aware(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is None:
            return None
        if v.tzinfo is None:
            raise ValueError(
                "created_at must be a timezone-aware ISO-8601 datetime (e.g. ending with 'Z' or a timezone offset). "
                "Naive datetimes without timezone information are not permitted."
            )
        return v.astimezone(timezone.utc)


class EngagementUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    assessment_type: Optional[AssessmentType] = None
    status: Optional[EngagementStatus] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    description: Optional[str] = None
    scope_summary: Optional[str] = None
    authorization_status: Optional[AuthorizationStatus] = None
    assigned_to: Optional[str] = Field(None, max_length=255)

    @field_validator("name")
    @classmethod
    def validate_non_whitespace(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("Engagement name must not be empty or whitespace only.")
        return stripped

    @field_validator("description", "scope_summary", "assigned_to")
    @classmethod
    def strip_optional_strings(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        stripped = v.strip()
        return stripped if stripped else None

    @model_validator(mode="after")
    def validate_update_dates(self) -> "EngagementUpdate":
        if self.start_date is not None and self.due_date is not None:
            if self.due_date < self.start_date:
                raise ValueError("Due date cannot precede start date.")
        return self


class EngagementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    client_company_name: Optional[str] = None
    client_status: Optional[str] = None
    name: str
    assessment_type: str
    status: str
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    description: Optional[str] = None
    scope_summary: Optional[str] = None
    authorization_status: str
    assigned_to: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at", when_used="json")
    def serialize_dt(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        iso = dt.isoformat()
        if iso.endswith("+00:00"):
            return iso[:-6] + "Z"
        return iso


class EngagementListResponse(BaseModel):
    items: List[EngagementOut]
    total: int
    page: int
    page_size: int
    total_pages: int
