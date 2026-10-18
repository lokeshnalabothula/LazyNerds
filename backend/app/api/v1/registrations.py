from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_founder
from app.db.session import get_db
from app.models.user import User
from app.schemas.registration import (
    ClientRegisterInput,
    RegistrationListResponse,
    RegistrationOut,
    RegistrationReviewInput,
    RegistrationStatusCheckResponse,
)
from app.services import registration_service

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
def submit_client_registration(
    data: ClientRegisterInput,
    db: Session = Depends(get_db),
):
    """
    Public self-registration endpoint for prospective clients.
    Stores application in pending state; strictly isolated from employee directories.
    """
    try:
        reg = registration_service.register_client(db, reg_in=data)
        return {
            "status": "pending",
            "registration_id": reg.id,
            "company_name": reg.company_name,
            "message": "Your client onboarding registration has been submitted and is pending founder review.",
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/status", response_model=RegistrationStatusCheckResponse)
def check_registration_status(
    email: str = Query(..., description="Applicant work email"),
    db: Session = Depends(get_db),
):
    """
    Public status lookup for client applicants.
    Allows applicants to check the progress of their onboarding request safely.
    """
    reg = registration_service.get_registration_status_by_email(db, email=email)
    if not reg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registration submission found for this email address.",
        )

    status_messages = {
        "pending": "Your application is in queue and awaiting executive review by Lazy Nerds leadership.",
        "needs_information": f"Additional details required: {reg.review_notes or 'Please provide authorized scope clarification.'}",
        "approved": "Your organization has been approved! You may now sign in using your registered credentials.",
        "rejected": f"Your application was not approved. Reason: {reg.rejection_reason or 'Criteria not met.'}",
        "suspended": "This registration has been suspended. Please contact Lazy Nerds security operations.",
    }

    return RegistrationStatusCheckResponse(
        email=reg.email,
        company_name=reg.company_name,
        status=reg.status,
        message=status_messages.get(reg.status, "Status processing."),
        review_notes=reg.review_notes,
        rejection_reason=reg.rejection_reason,
        created_at=reg.created_at.isoformat(),
    )


@router.get("", response_model=RegistrationListResponse)
def list_pending_registrations(
    status_filter: Optional[str] = Query("pending", alias="status", description="Status filter: pending, needs_information, approved, rejected, all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_founder),
):
    """
    Founder-only endpoint to list client registration submissions.
    Employees do not have access to this route or pending client data.
    """
    items, total, pending_count = registration_service.list_registrations(db, status=status_filter)
    return RegistrationListResponse(
        items=[RegistrationOut.model_validate(r) for r in items],
        total=total,
        pending_count=pending_count,
    )


@router.get("/{reg_id}", response_model=RegistrationOut)
def get_registration_details(
    reg_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_founder),
):
    """
    Founder-only endpoint to inspect full onboarding submission details.
    """
    reg = registration_service.get_registration_by_id(db, reg_id=reg_id)
    if not reg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration submission not found.",
        )
    return RegistrationOut.model_validate(reg)


@router.post("/{reg_id}/review", response_model=RegistrationOut)
def review_registration_submission(
    reg_id: str,
    data: RegistrationReviewInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_founder),
):
    """
    Founder-only decision endpoint:
    - approve: activates client organization, user account, and links them.
    - reject: records rejection reason.
    - request_info: requests additional information from applicant.
    """
    try:
        reviewed = registration_service.review_registration(
            db=db,
            reg_id=reg_id,
            action=data.action,
            reason=data.reason,
            founder=current_user,
            assign_employee_id=data.assign_employee_id,
        )
        return RegistrationOut.model_validate(reviewed)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
