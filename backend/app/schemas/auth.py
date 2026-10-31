from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer
from app.schemas.common import serialize_utc_datetime


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "founder"
    client_id: Optional[str] = None


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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class SendForgotPasswordOtpResponse(BaseModel):
    message: str
    cooldown_seconds: int = 60


class VerifyForgotPasswordOtpRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")


class VerifyForgotPasswordOtpResponse(BaseModel):
    reset_token: str
    message: str


class ResetPasswordWithOtpRequest(BaseModel):
    email: EmailStr
    reset_token: str = Field(..., min_length=16, description="Cryptographic single-use reset session token")
    new_password: str = Field(..., min_length=10, max_length=128, description="New password (minimum 10 characters)")


class VerifyResetTokenRequest(BaseModel):
    token: str = Field(..., min_length=16, description="Cryptographic reset token")


class VerifyResetTokenResponse(BaseModel):
    valid: bool
    email_masked: Optional[str] = None
    message: str


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=16, description="Cryptographic reset token")
    new_password: str = Field(..., min_length=10, max_length=128, description="New password (minimum 10 characters)")


class SendRegistrationOtpRequest(BaseModel):
    email: EmailStr


class SendRegistrationOtpResponse(BaseModel):
    message: str
    cooldown_seconds: int = 60


class VerifyRegistrationOtpRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")
    password: Optional[str] = Field(None, min_length=8, max_length=128, description="Optional account password")
    full_name: Optional[str] = Field(None, max_length=255, description="Optional user full name")


class ResendRegistrationOtpRequest(BaseModel):
    email: EmailStr


