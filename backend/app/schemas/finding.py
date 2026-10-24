from datetime import datetime, date
from typing import Optional, List, Literal, Any, Dict
from pydantic import BaseModel, Field, field_validator, field_serializer
from app.schemas.common import serialize_utc_datetime


SeverityType = Literal["critical", "high", "medium", "low", "info"]
FindingStatusType = Literal[
    "open",
    "in_remediation",
    "verification_pending",
    "verified_fixed",
    "accepted_risk",
    "false_positive",
]
AssessmentStatusType = Literal["queued", "running", "completed", "failed"]
VerificationResultType = Literal["passed", "failed", "partially_resolved"]
VerificationMethodType = Literal["automated_rescan", "manual_verification", "code_review"]


# 1. Finding Schemas
class FindingBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    severity: SeverityType
    cvss_score: Optional[float] = Field(None, ge=0.0, le=10.0)
    status: FindingStatusType = "open"
    cve_id: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    impact: Optional[str] = None
    remediation_guidance: Optional[str] = None
    evidence: Optional[str] = None
    references_url: Optional[str] = None
    remediation_notes: Optional[str] = None
    remediation_deadline: Optional[date] = None
    assigned_to: Optional[str] = Field(None, max_length=255)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: str) -> str:
        if isinstance(v, str):
            stripped = v.strip()
            if not stripped:
                raise ValueError("Finding title cannot be empty.")
            return stripped
        return v


class FindingCreate(FindingBase):
    engagement_id: str = Field(..., min_length=36, max_length=36)
    asset_id: Optional[str] = Field(None, min_length=36, max_length=36)
    assessment_id: Optional[str] = Field(None, min_length=36, max_length=36)


class FindingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    severity: Optional[SeverityType] = None
    cvss_score: Optional[float] = Field(None, ge=0.0, le=10.0)
    status: Optional[FindingStatusType] = None
    cve_id: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    impact: Optional[str] = None
    remediation_guidance: Optional[str] = None
    evidence: Optional[str] = None
    references_url: Optional[str] = None
    remediation_notes: Optional[str] = None
    remediation_deadline: Optional[date] = None
    assigned_to: Optional[str] = Field(None, max_length=255)
    asset_id: Optional[str] = None


class VerificationOut(BaseModel):
    id: str
    finding_id: str
    verified_by: str
    result: str
    verification_method: str
    notes: Optional[str] = None
    verified_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("verified_at", when_used="json")
    def serialize_dt(self, dt: datetime) -> str:
        return serialize_utc_datetime(dt)


class FindingOut(BaseModel):
    id: str
    engagement_id: str
    asset_id: Optional[str] = None
    assessment_id: Optional[str] = None
    title: str
    severity: str
    cvss_score: Optional[float] = None
    status: str
    cve_id: Optional[str] = None
    description: Optional[str] = None
    impact: Optional[str] = None
    remediation_guidance: Optional[str] = None
    evidence: Optional[str] = None
    references_url: Optional[str] = None
    remediation_notes: Optional[str] = None
    remediation_deadline: Optional[date] = None
    assigned_to: Optional[str] = None
    engagement_name: Optional[str] = None
    asset_name: Optional[str] = None
    verifications: List[VerificationOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at", "updated_at", when_used="json")
    def serialize_dt(self, dt: datetime) -> str:
        return serialize_utc_datetime(dt)


class FindingListResponse(BaseModel):
    items: List[FindingOut]
    total: int
    page: int
    page_size: int
    total_pages: int


# 2. Assessment Schemas
class AssessmentCreate(BaseModel):
    engagement_id: str = Field(..., min_length=36, max_length=36)
    name: str = Field(..., min_length=1, max_length=255)
    assessment_tool: str = Field(..., min_length=1, max_length=100)
    target_asset_ids: Optional[List[str]] = None
    execution_summary: Optional[str] = None
    raw_output: Optional[str] = None


class AssessmentOut(BaseModel):
    id: str
    engagement_id: str
    name: str
    assessment_tool: str
    status: str
    target_asset_ids: Optional[str] = None
    findings_count: int
    execution_summary: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("started_at", "completed_at", "created_at", "updated_at", when_used="json")
    def serialize_dt(self, dt: Optional[datetime]) -> Optional[str]:
        return serialize_utc_datetime(dt)


class AssessmentListResponse(BaseModel):
    items: List[AssessmentOut]
    total: int
    page: int
    page_size: int
    total_pages: int


# 3. Verification Schemas
class VerificationCreate(BaseModel):
    result: VerificationResultType
    verification_method: VerificationMethodType
    notes: Optional[str] = None


# 4. Scan Adapter Import Schema
class ScanImportRequest(BaseModel):
    engagement_id: str = Field(..., min_length=36, max_length=36)
    tool_name: str = Field(..., min_length=1, max_length=100)
    target_asset_id: Optional[str] = None
    scan_data: Any = Field(..., description="Raw output text or parsed JSON structure from scan tool")
    auto_create_findings: bool = True


# 5. Live Scan Launcher Schema
class ScanLaunchRequest(BaseModel):
    engagement_id: str = Field(..., min_length=36, max_length=36)
    target_asset_id: str = Field(..., min_length=36, max_length=36)
    scan_mode: Literal["source_assisted", "blackbox"] = "source_assisted"
    source_repo: Optional[str] = Field(None, max_length=1000)
    is_mock_run: bool = False

