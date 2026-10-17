from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, field_validator


AssetType = Literal[
    "domain",
    "ip_address",
    "web_application",
    "api",
    "cloud_resource",
    "network_range",
]
EnvironmentType = Literal["production", "staging", "development"]
CriticalityType = Literal["critical", "high", "medium", "low"]
AuthorizationStatusType = Literal["verified", "pending", "unauthorized"]


class AssetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    asset_type: AssetType
    target: str = Field(..., min_length=1, max_length=500)
    environment: EnvironmentType = "production"
    criticality: CriticalityType = "medium"
    in_scope: bool = True
    authorization_status: AuthorizationStatusType = "verified"
    notes: Optional[str] = None

    @field_validator("name", "target", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        if isinstance(v, str):
            stripped = v.strip()
            if not stripped:
                raise ValueError("Field cannot be empty or whitespace only.")
            return stripped
        return v


class AssetCreate(AssetBase):
    client_id: str = Field(..., min_length=36, max_length=36)
    engagement_id: Optional[str] = Field(None, min_length=36, max_length=36)


class AssetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    asset_type: Optional[AssetType] = None
    target: Optional[str] = Field(None, min_length=1, max_length=500)
    environment: Optional[EnvironmentType] = None
    criticality: Optional[CriticalityType] = None
    in_scope: Optional[bool] = None
    authorization_status: Optional[AuthorizationStatusType] = None
    engagement_id: Optional[str] = None
    notes: Optional[str] = None


class AssetOut(BaseModel):
    id: str
    client_id: str
    engagement_id: Optional[str] = None
    name: str
    asset_type: str
    target: str
    environment: str
    criticality: str
    in_scope: bool
    authorization_status: str
    notes: Optional[str] = None
    client_company_name: Optional[str] = None
    engagement_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssetListResponse(BaseModel):
    items: List[AssetOut]
    total: int
    page: int
    page_size: int
    total_pages: int
