import re
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer, field_validator
from app.schemas.common import serialize_utc_datetime


class ClientRegisterInput(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255, description="Primary contact full name")
    email: EmailStr = Field(..., description="Corporate or work email address")
    password: str = Field(..., min_length=8, max_length=128, description="Account password")
    phone: Optional[str] = Field(None, max_length=50)
    job_title: Optional[str] = Field(None, max_length=100)
    company_name: str = Field(..., min_length=1, max_length=255, description="Legal company name")
    website: Optional[str] = Field(None, max_length=500)
    industry: Optional[str] = Field(None, max_length=100)
    company_size: Optional[str] = Field(None, max_length=50)
    country: Optional[str] = Field(None, max_length=100)
    requested_services: Optional[str] = Field(None, max_length=2000)
    scope_description: Optional[str] = Field(None, max_length=4000)
    primary_domains: Optional[str] = Field(None, max_length=2000)

    @field_validator("full_name", "company_name")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field must not be empty or whitespace only.")
        return s

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

    @field_validator("website")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        stripped = v.strip()
        if not (stripped.startswith("http://") or stripped.startswith("https://")):
            stripped = "https://" + stripped
        return stripped


class RegistrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    job_title: Optional[str] = None
    company_name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    country: Optional[str] = None
    requested_services: Optional[str] = None
    scope_description: Optional[str] = None
    primary_domains: Optional[str] = None
    status: str
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    client_id: Optional[str] = None
    user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("reviewed_at", "created_at", "updated_at", when_used="json")
    def serialize_dt(self, dt: Optional[datetime]) -> Optional[str]:
        return serialize_utc_datetime(dt)


class RegistrationListResponse(BaseModel):
    items: List[RegistrationOut]
    total: int
    pending_count: int


class RegistrationReviewInput(BaseModel):
    action: str = Field(..., pattern="^(approve|reject|request_info)$", description="Review decision")
    reason: Optional[str] = Field(None, max_length=2000, description="Notes, rejection reason, or info request details")
    assign_employee_id: Optional[str] = Field(None, description="Optional employee UUID to assign approved client to")


class RegistrationStatusCheckResponse(BaseModel):
    email: str
    company_name: str
    status: str
    message: str
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: str
