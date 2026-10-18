from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_founder
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.models.registration import ClientRegistration
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
    VerifyResetTokenRequest,
    VerifyResetTokenResponse,
)
from app.services import auth_service, audit_service, password_reset_service, email_service
from app.services.auth_service import authenticate_user

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(
    login_data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Authenticates authorized personnel and issues a JWT token.
    Sets a secure HttpOnly cookie for browser sessions.
    If an applicant has a pending registration, provides actionable status context.
    """
    user = authenticate_user(db, email=login_data.email, password=login_data.password)
    if not user:
        # Check if an applicant registration exists for this email
        clean_email = login_data.email.strip().lower()
        reg = (
            db.query(ClientRegistration)
            .filter(func.lower(func.trim(ClientRegistration.email)) == clean_email)
            .order_by(ClientRegistration.created_at.desc())
            .first()
        )

        if reg:
            if reg.status == "pending":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Your client registration for '{reg.company_name}' is currently pending founder review. You will be notified once approved.",
                )
            elif reg.status == "needs_information":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Registration update required: {reg.review_notes or 'Please provide additional authorized scope information.'}",
                )
            elif reg.status == "rejected":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Registration was not approved. Reason: {reg.rejection_reason or 'Criteria not met.'}",
                )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials.",
        )

    access_token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "role": user.role}
    )

    # Set secure cookie
    is_prod = settings.ENVIRONMENT == "production"
    response.set_cookie(
        key="fixops_access_token",
        value=access_token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    """Returns profile information for the currently authenticated user."""
    return UserOut.model_validate(current_user)


@router.get("/users", response_model=List[UserOut])
def list_users(
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_founder),
):
    """Lists system personnel, filtered by role (founder-only)."""
    query = db.query(User).filter(User.is_active == True)
    if role:
        query = query.filter(User.role == role)
    return [UserOut.model_validate(u) for u in query.order_by(User.full_name.asc()).all()]


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(response: Response):
    """Logs out user by clearing authentication session cookie."""
    is_prod = settings.ENVIRONMENT == "production"
    response.delete_cookie(
        key="fixops_access_token",
        httponly=True,
        secure=is_prod,
        samesite="lax",
    )
    return {"message": "Successfully signed out."}


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Securely updates the authenticated user's password."""
    try:
        auth_service.change_user_password(
            db=db,
            user=current_user,
            current_password=data.current_password,
            new_password=data.new_password,
        )
        audit_service.log_audit(
            db=db,
            user_email=current_user.email,
            action="CHANGE_PASSWORD",
            resource_type="user",
            resource_id=current_user.id,
            details=f"User '{current_user.email}' updated their account password.",
        )
        return {"message": "Password updated successfully."}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Initiates password recovery.
    Always returns a generic 200 response to prevent account enumeration.
    Generates a secure, hashed, single-use token with 30-minute expiration.
    Dispatches a branded password reset email with the recovery URL.
    """
    reset_info = password_reset_service.initiate_password_reset(db, email=data.email)
    
    email_status = "not_sent_no_account"
    if reset_info:
        raw_token, target_user = reset_info
        reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={raw_token}"
        dispatch_result = email_service.send_password_reset_email(
            to_email=target_user.email,
            recipient_name=target_user.full_name,
            reset_url=reset_url,
        )
        if dispatch_result.get("success"):
            provider = dispatch_result.get("provider")
            msg_id = dispatch_result.get("message_id")
            email_status = f"dispatched_{provider}" + (f"_id_{msg_id}" if msg_id else "")
        else:
            email_status = f"failed_{dispatch_result.get('provider')}: {dispatch_result.get('error')}"

    # Audit event without exposing token
    audit_service.log_audit(
        db=db,
        user_email=str(data.email).strip().lower(),
        action="FORGOT_PASSWORD_REQUEST",
        resource_type="user",
        resource_id="auth",
        details=f"Password recovery requested for {data.email}. Outcome: {email_status}",
    )

    return {
        "message": "If an account matches that email address, password recovery instructions have been dispatched."
    }


@router.post("/verify-reset-token", response_model=VerifyResetTokenResponse)
def verify_reset_token(
    data: VerifyResetTokenRequest,
    db: Session = Depends(get_db),
):
    """
    Validates token validity, expiration, and unused status before rendering the reset form.
    """
    verified = password_reset_service.verify_password_reset_token(db, raw_token=data.token)
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password recovery link is invalid, expired, or has already been used.",
        )
    _, user = verified
    email_parts = user.email.split("@")
    masked_email = f"{email_parts[0][:2]}***@{email_parts[1]}" if len(email_parts) == 2 else "***"
    return VerifyResetTokenResponse(
        valid=True,
        email_masked=masked_email,
        message="Token is valid.",
    )


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Executes password reset using a verified, single-use token.
    Invalidates the token and other active recovery tokens for the user.
    """
    try:
        user = password_reset_service.reset_user_password(
            db=db,
            raw_token=data.token,
            new_password=data.new_password,
        )
        audit_service.log_audit(
            db=db,
            user_email=user.email,
            action="RESET_PASSWORD_SUCCESS",
            resource_type="user",
            resource_id=user.id,
            details=f"Password successfully reset via single-use token for '{user.email}'",
        )
        return {"message": "Your password has been successfully reset. You may now sign in."}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

