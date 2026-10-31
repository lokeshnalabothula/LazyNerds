from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_current_user_optional
from app.core.security import (
    acquire_assessment_slot,
    public_challenge_limiter,
    public_verify_limiter,
    public_score_limiter,
)
from app.db.session import get_db
from app.models.client import Client
from app.models.user import User
from app.schemas.domain import (
    DomainCreate,
    DomainCreateResponse,
    DomainListResponse,
    DomainOut,
    DomainRegenerateResponse,
    DomainVerificationResult,
    DomainSecurityScoreResponse,
    PublicDomainChallengeRequest,
    PublicDomainChallengeResponse,
    PublicDomainVerifyRequest,
    PublicDomainVerifyResponse,
)
from app.services import domain_service
from app.services.domain_service import (
    build_dns_instructions,
    build_file_instructions,
    build_meta_instructions,
    calculate_domain_security_score,
    domain_to_out,
    generate_verification_token,
    validate_and_normalize_domain,
    verify_public_domain_ownership,
)

router = APIRouter()


def get_client_ip(request: Request) -> str:
    """Extracts client IP address supporting reverse proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@router.post("/public-challenge", response_model=PublicDomainChallengeResponse)
def get_public_domain_challenge(req: PublicDomainChallengeRequest, request: Request):
    """
    Generates verification instructions and high-entropy challenge tokens across
    all three verification methods (DNS TXT, HTML file upload, HTML meta tag)
    for public perimeter validation.
    Enforces IP-based rate limiting.
    """
    client_ip = get_client_ip(request)
    if not public_challenge_limiter.check_and_record(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many challenge requests. Please wait a minute before requesting another verification challenge.",
            headers={"Retry-After": "60"},
        )

    raw = req.domain.strip()
    if "://" in raw:
        from urllib.parse import urlparse
        parsed = urlparse(raw)
        raw = parsed.hostname or raw
    elif "/" in raw:
        raw = raw.split("/")[0]

    is_valid, normalized, err_msg = validate_and_normalize_domain(raw)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    token = generate_verification_token()
    dns_inst = build_dns_instructions(normalized, token)
    file_inst = build_file_instructions(normalized, token)
    meta_inst = build_meta_instructions(normalized, token)

    return PublicDomainChallengeResponse(
        domain=req.domain.strip(),
        normalized_domain=normalized,
        token=token,
        dns_instructions=dns_inst,
        file_instructions=file_inst,
        meta_instructions=meta_inst,
    )


@router.post("/public-verify", response_model=PublicDomainVerifyResponse)
def verify_public_domain(req: PublicDomainVerifyRequest, request: Request):
    """
    Verifies domain ownership in real-time across DNS TXT, HTML file upload, or
    HTML meta tag without requiring pre-registered tenant records.
    Returns a cryptographically signed verification proof token upon success.
    Enforces IP-based rate limiting.
    """
    client_ip = get_client_ip(request)
    if not public_verify_limiter.check_and_record(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification attempts. Please wait a minute before retrying verification.",
            headers={"Retry-After": "60"},
        )

    verified, message, normalized, proof = verify_public_domain_ownership(
        domain_str=req.domain,
        method=req.method,
        token=req.token,
    )
    return PublicDomainVerifyResponse(
        verified=verified,
        status="verified" if verified else "failed",
        message=message,
        domain=normalized,
        method=req.method,
        verification_proof=proof,
    )


@router.get("/security-score", response_model=DomainSecurityScoreResponse)
def get_domain_security_score(
    request: Request,
    domain: str = Query(..., min_length=3, max_length=255),
    token: Optional[str] = Query(None, description="Cryptographic proof token issued upon successful domain verification"),
    verification_token: Optional[str] = Query(None, description="Alias for verification proof token"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Executes actual, non-destructive perimeter security audit and returns the
    calculated security score, posture, and findings summary.
    Enforces server-side domain ownership validation: does NOT trust client-supplied
    flags or arbitrary unverified domains.
    Enforces IP-based rate limiting and process concurrency limits.
    """
    client_ip = get_client_ip(request)
    if not public_score_limiter.check_and_record(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many assessment requests. Please wait a minute before requesting another security assessment.",
            headers={"Retry-After": "60"},
        )

    proof = token or verification_token
    try:
        with acquire_assessment_slot(timeout=1.0):
            result = calculate_domain_security_score(
                domain_str=domain,
                verification_proof=proof,
                db=db,
                current_user=current_user,
            )
    except RuntimeError as cap_err:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(cap_err),
            headers={"Retry-After": "5"},
        )

    return DomainSecurityScoreResponse(**result)



@router.post("", response_model=DomainCreateResponse, status_code=status.HTTP_201_CREATED)
def create_domain(
    domain_in: DomainCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Registers a new domain for DNS TXT ownership verification.
    Returns the initial verification challenge token and DNS instructions.
    """
    target_client_id: Optional[str] = None

    if current_user.role == "client":
        if not current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User account is not associated with an authorized client organization.",
            )
        if domain_in.client_id and domain_in.client_id != current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot register domain for another organization.",
            )
        target_client_id = current_user.client_id
    elif current_user.role == "employee":
        if not domain_in.client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="client_id is required to register a domain.",
            )
        client = db.query(Client).filter(Client.id == domain_in.client_id).first()
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Client with ID '{domain_in.client_id}' does not exist.",
            )
        if client.assigned_employee_id and client.assigned_employee_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not assigned to this client record.",
            )
        target_client_id = domain_in.client_id
    else:
        # Founder or Admin
        if domain_in.client_id:
            target_client_id = domain_in.client_id
        elif current_user.client_id:
            target_client_id = current_user.client_id
        else:
            first_client = db.query(Client).filter(Client.status == "active").first()
            if not first_client:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="client_id is required. No active client organizations exist.",
                )
            target_client_id = first_client.id

    domain, token = domain_service.register_domain(
        db=db,
        domain_str=domain_in.domain,
        client_id=target_client_id,
        current_user=current_user,
    )
    dns_instructions = build_dns_instructions(domain.normalized_domain, token)
    return DomainCreateResponse(
        domain=domain_to_out(domain, token),
        token=token,
        dns_instructions=dns_instructions,
    )


@router.get("", response_model=DomainListResponse)
def list_domains(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    client_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lists domains registered by the authenticated user's organization.
    """
    items, total = domain_service.get_domains(
        db=db,
        current_user=current_user,
        client_id=client_id,
        status_filter=status,
        search=search,
        page=page,
        page_size=page_size,
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return DomainListResponse(
        items=[domain_to_out(d) for d in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{domain_id}", response_model=DomainOut)
def get_domain(
    domain_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves verification status and DNS details for a specific registered domain.
    """
    domain = domain_service.get_domain_by_id(db, domain_id, current_user)
    return domain_to_out(domain)


@router.post("/{domain_id}/verify", response_model=DomainVerificationResult)
def verify_domain_ownership(
    domain_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Performs real-time DNS TXT resolution to verify domain ownership.
    """
    verified, message, domain = domain_service.verify_domain(
        db=db,
        domain_id=domain_id,
        current_user=current_user,
    )
    return DomainVerificationResult(
        verified=verified,
        status=domain.verification_status,
        message=message,
        domain=domain_to_out(domain),
    )


@router.post("/{domain_id}/regenerate", response_model=DomainRegenerateResponse)
def regenerate_verification_challenge(
    domain_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates a new verification challenge token for an expired or compromised domain challenge.
    """
    domain, new_token = domain_service.regenerate_domain_challenge(
        db=db,
        domain_id=domain_id,
        current_user=current_user,
    )
    dns_instructions = build_dns_instructions(domain.normalized_domain, new_token)
    return DomainRegenerateResponse(
        domain=domain_to_out(domain, new_token),
        token=new_token,
        dns_instructions=dns_instructions,
    )


@router.delete("/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_domain_registration(
    domain_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Removes a domain registration record from the customer's organization.
    """
    domain_service.delete_domain(db, domain_id, current_user)
    return None
