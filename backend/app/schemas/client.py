import re
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer, field_validator


class ClientStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class ClientBase(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255, description="Official company or organization name")
    primary_contact_name: str = Field(..., min_length=1, max_length=255, description="Primary contact full name")
    primary_contact_email: EmailStr = Field(..., description="Primary contact email address")
    website: Optional[str] = Field(None, max_length=500, description="Company website URL (HTTP/HTTPS only)")
    phone: Optional[str] = Field(None, max_length=50, description="Contact phone number")
    industry: Optional[str] = Field(None, max_length=100, description="Business sector / industry")
    notes: Optional[str] = Field(None, max_length=5000, description="Confidential engagement notes")

    @field_validator("company_name", "primary_contact_name")
    @classmethod
    def validate_non_whitespace(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Field must not be empty or whitespace only.")
        return stripped

    @field_validator("primary_contact_email")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

    @field_validator("website")
    @classmethod
    def validate_website_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            return None
        # Must be valid http/https URL, reject javascript:, data:, or other schemes
        url_pattern = re.compile(
            r"^https?://"  # http:// or https://
            r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}\.?|"  # domain...
            r"localhost|"  # localhost...
            r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"  # ...or ip
            r"(?::\d+)?"  # optional port
            r"(?:/?|[/?]\S+)$",
            re.IGNORECASE
        )
        if not url_pattern.match(stripped):
            raise ValueError("Website must be a valid HTTP or HTTPS URL.")
        return stripped

    @field_validator("phone", "industry", "notes")
    @classmethod
    def strip_optional_strings(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        stripped = v.strip()
        return stripped if stripped else None


class ClientCreate(ClientBase):
    created_at: Optional[datetime] = Field(None, description="Custom creation / onboarding timestamp (UTC)")

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


class ClientUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    company_name: Optional[str] = Field(None, min_length=1, max_length=255)
    primary_contact_name: Optional[str] = Field(None, min_length=1, max_length=255)
    primary_contact_email: Optional[EmailStr] = None
    website: Optional[str] = Field(None, max_length=500)
    phone: Optional[str] = Field(None, max_length=50)
    industry: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=5000)

    @field_validator("company_name", "primary_contact_name")
    @classmethod
    def validate_non_whitespace(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("Field must not be empty or whitespace only.")
        return stripped

    @field_validator("primary_contact_email")
    @classmethod
    def normalize_email(cls, v: Optional[EmailStr]) -> Optional[str]:
        if v is None:
            return None
        return str(v).strip().lower()

    @field_validator("website")
    @classmethod
    def validate_website_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            return None
        url_pattern = re.compile(
            r"^https?://"
            r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}\.?|"
            r"localhost|"
            r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"
            r"(?::\d+)?"
            r"(?:/?|[/?]\S+)$",
            re.IGNORECASE
        )
        if not url_pattern.match(stripped):
            raise ValueError("Website must be a valid HTTP or HTTPS URL.")
        return stripped


class ClientOut(ClientBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: ClientStatus
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


class ClientListResponse(BaseModel):
    items: List[ClientOut]
    total: int
    page: int
    page_size: int
    total_pages: int
