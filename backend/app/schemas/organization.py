from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer, model_validator
from app.schemas.common import serialize_utc_datetime


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    owner_id: Optional[str] = None
    created_at: datetime

    @field_serializer("created_at", when_used="json")
    def serialize_dt(self, dt: datetime) -> str:
        return serialize_utc_datetime(dt)


class OrganizationMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str
    role: str
    permissions: List[str] = Field(default_factory=list)
    organization_id: Optional[str] = None
    client_id: Optional[str] = None
    is_active: bool
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def extract_permissions(cls, data):
        if hasattr(data, "get_permissions_list"):
            return {
                "id": data.id,
                "email": data.email,
                "full_name": data.full_name,
                "role": data.role,
                "organization_id": data.organization_id,
                "client_id": data.client_id,
                "is_active": data.is_active,
                "created_at": data.created_at,
                "permissions": data.get_permissions_list(),
            }
        return data

    @field_serializer("created_at", when_used="json")
    def serialize_dt(self, dt: datetime) -> str:
        return serialize_utc_datetime(dt)


class PromoteMemberRequest(BaseModel):
    permissions: Optional[List[str]] = Field(
        None,
        description="Optional initial granular permissions. Defaults to standard worker permissions.",
    )


class DemoteMemberRequest(BaseModel):
    pass


class UpdateMemberPermissionsRequest(BaseModel):
    permissions: List[str] = Field(
        ...,
        description="Granular permission strings (e.g. ['clients:read', 'engagements:read', 'scans:launch']).",
    )


class UpdateMemberStatusRequest(BaseModel):
    is_active: bool = Field(..., description="Whether the member account is active and permitted to sign in.")
