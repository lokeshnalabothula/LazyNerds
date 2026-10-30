from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
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
)
from app.services import domain_service
from app.services.domain_service import build_dns_instructions, domain_to_out

router = APIRouter()


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
