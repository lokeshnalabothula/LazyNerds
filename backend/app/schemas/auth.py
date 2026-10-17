from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer
from app.schemas.common import serialize_utc_datetime


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "founder"


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="User password (min 8 characters)")


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    is_active: bool
    created_at: datetime

    @field_serializer("created_at", when_used="json")
    def serialize_dt(self, dt: datetime) -> str:
        return serialize_utc_datetime(dt)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=10, max_length=128, description="New password (minimum 10 characters)")
