from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DnsRecordInstructions(BaseModel):
    record_type: str = Field("TXT", description="DNS record type to configure")
    record_name: str = Field(..., description="Full DNS name to query (e.g., _lazynerds-verification.example.com)")
    record_host: str = Field(..., description="Subdomain / host field for DNS provider (e.g., _lazynerds-verification)")
    record_value: Optional[str] = Field(None, description="Exact record value to configure (only populated during challenge creation or rotation)")
    expected_format: str = Field("lazynerds-verification=<generated-token>", description="Format of the TXT record value")
    ttl: int = Field(300, description="Recommended DNS TTL in seconds")


class DomainCreate(BaseModel):
    domain: str = Field(..., min_length=3, max_length=255, description="Domain name to register (e.g. example.com)")
    client_id: Optional[str] = Field(None, description="Client/tenant ID (only editable by internal staff; client users are strictly auto-scoped)")


class DomainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    domain: str
    normalized_domain: str
    verification_status: str
    challenge_created_at: datetime
    challenge_expires_at: datetime
    verified_at: Optional[datetime] = None
    last_verification_attempt_at: Optional[datetime] = None
    verification_attempt_count: int = 0
    failure_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    dns_instructions: DnsRecordInstructions


class DomainCreateResponse(BaseModel):
    domain: DomainOut
    token: str = Field(..., description="Cryptographically secure verification token (shown only once upon registration)")
    dns_instructions: DnsRecordInstructions


class DomainRegenerateResponse(BaseModel):
    domain: DomainOut
    token: str = Field(..., description="Newly generated verification token")
    dns_instructions: DnsRecordInstructions


class DomainVerificationResult(BaseModel):
    verified: bool
    status: str
    message: str
    domain: DomainOut


class DomainListResponse(BaseModel):
    items: List[DomainOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class FileRecordInstructions(BaseModel):
    file_name: str = Field("fixops-verification.txt", description="File name to place on web server")
    relative_path: str = Field("/.well-known/fixops-verification.txt", description="Preferred relative URL path")
    fallback_path: str = Field("/fixops-verification.txt", description="Fallback relative URL path")
    expected_content: str = Field(..., description="File content to serve")


class MetaRecordInstructions(BaseModel):
    meta_tag: str = Field("fixops-verification", description="Meta tag name attribute")
    snippet: str = Field(..., description="Complete HTML snippet to embed in <head>")


class PublicDomainChallengeRequest(BaseModel):
    domain: str = Field(..., min_length=3, max_length=255, description="Domain to verify")


class PublicDomainChallengeResponse(BaseModel):
    domain: str
    normalized_domain: str
    token: str
    dns_instructions: DnsRecordInstructions
    file_instructions: FileRecordInstructions
    meta_instructions: MetaRecordInstructions


class PublicDomainVerifyRequest(BaseModel):
    domain: str = Field(..., min_length=3, max_length=255)
    method: str = Field(..., description="Verification method: dns, file, or meta")
    token: str = Field(..., min_length=16, description="Verification challenge token")


class PublicDomainVerifyResponse(BaseModel):
    verified: bool
    status: str
    message: str
    domain: str
    method: str
    verification_proof: Optional[str] = Field(None, description="Cryptographically signed proof of domain ownership")


class DomainSecurityScoreResponse(BaseModel):
    status: str = Field(..., description="Scan status: completed, scanning, or failed")
    domain: str
    score: Optional[int] = Field(None, description="Calculated security score 0-100")
    posture: Optional[str] = Field(None, description="Security posture label: Good Posture, Moderate Risk, Critical Risk, or Score Unavailable")
    findings_count: Optional[int] = Field(None, description="Total genuine findings discovered")
    severity_counts: Optional[dict] = Field(None, description="Breakdown by critical, high, medium, low, info")
    findings: Optional[List[dict]] = Field(None, description="Discovered security findings")
    metadata: Optional[dict] = Field(None, description="Technical audit metadata")
    error: Optional[str] = Field(None, description="Error reason if assessment failed or unavailable")

