from typing import List, Optional, Union
import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
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
    CompleteRegistrationRequest,
    ForgotPasswordRequest,
    SendForgotPasswordOtpResponse,
    VerifyForgotPasswordOtpRequest,
    VerifyForgotPasswordOtpResponse,
    ResetPasswordWithOtpRequest,
    LoginRequest,
    ResetPasswordRequest,
    SendRegistrationOtpRequest,
    SendRegistrationOtpResponse,
    TokenResponse,
    UserOut,
    VerifyRegistrationOtpRequest,
    VerifyRegistrationOtpResponse,
    VerifyResetTokenRequest,
    VerifyResetTokenResponse,
    ResendRegistrationOtpRequest,
)
from app.services import auth_service, audit_service, password_reset_service, email_service, email_verification_service
from app.services.auth_service import authenticate_user

logger = logging.getLogger("fixops.auth")

router = APIRouter()


@router.post("/register/send-code", response_model=SendRegistrationOtpResponse)
@router.post("/register/send-otp", response_model=SendRegistrationOtpResponse)
def send_registration_code(
    data: SendRegistrationOtpRequest,
    db: Session = Depends(get_db),
):
    """
    Step 1: Initiates email verification for new user registration.
    Enforces resend cooldown, hourly rate limiting, and email dispatch.
    Asks only for email (and optional full name). Does not accept a password.
    In production, ensures email service is configured.
    """
    if settings.ENVIRONMENT == "production":
        provider = email_service.get_active_email_provider()
        if provider not in ("resend", "smtp"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Registration verification is temporarily unavailable because email delivery is not yet configured. Please contact the administrator.",
            )

    try:
        raw_code, verif_record = email_verification_service.request_registration_verification(
            db=db,
            email=data.email,
            full_name=data.full_name,
        )
        dispatch_result = email_service.send_verification_code_email(
            to_email=data.email,
            code=raw_code,
            expires_in_minutes=15,
        )
        if not dispatch_result.get("success") and dispatch_result.get("provider") in ("resend", "smtp"):
            err = dispatch_result.get("error") or "Email service unavailable"
            logger.error(f"Registration email delivery failed for {data.email}: {err}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Unable to dispatch verification email: {err}. Please verify email configuration.",
            )

        return SendRegistrationOtpResponse(
            message="A 6-digit verification code has been dispatched to your email address.",
            cooldown_seconds=60,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/register/verify-code", response_model=Union[TokenResponse, VerifyRegistrationOtpResponse])
@router.post("/register/verify-otp", response_model=Union[TokenResponse, VerifyRegistrationOtpResponse])
def verify_registration_code(
    data: VerifyRegistrationOtpRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Step 2: Validates single-use 6-digit verification code.
    - If password is provided (legacy / direct path): activates user immediately and returns TokenResponse.
    - If password is NOT provided (standard 4-step sequence): validates OTP and returns
      a single-use cryptographic registration token (VerifyRegistrationOtpResponse) so the user
      can proceed to Step 3 (password creation). The user account is NOT created yet.
    """
    try:
        # If password is provided, perform direct activation (backwards compatibility)
        if data.password and data.password.strip():
            user = email_verification_service.verify_registration_code_and_activate(
                db=db,
                email=data.email,
                code=data.code,
                password=data.password,
                full_name=data.full_name,
            )
            access_token = create_access_token(
                subject=user.id,
                extra_claims={"email": user.email, "role": user.role}
            )

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

        # Standard Step 2: Validate OTP and issue registration session token
        raw_token, record = email_verification_service.verify_registration_otp_and_issue_token(
            db=db,
            email=data.email,
            code=data.code,
        )
        return VerifyRegistrationOtpResponse(
            valid=True,
            registration_token=raw_token,
            email=data.email,
            full_name=record.full_name,
            message="Verification code confirmed. You may now create your password.",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/register/complete", response_model=TokenResponse)
@router.post("/register/complete-with-token", response_model=TokenResponse)
def complete_registration(
    data: CompleteRegistrationRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Step 4: Validates the verified registration session token and creates/activates
    the user account with their chosen password. Sets secure session cookie and returns TokenResponse.
    Unverified emails or invalid/expired session tokens are rejected.
    """
    try:
        user = email_verification_service.complete_registration_with_token(
            db=db,
            email=data.email,
            registration_token=data.registration_token,
            password=data.password,
            full_name=data.full_name,
        )
        access_token = create_access_token(
            subject=user.id,
            extra_claims={"email": user.email, "role": user.role}
        )

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
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/register/resend-code", response_model=SendRegistrationOtpResponse)
@router.post("/register/resend-otp", response_model=SendRegistrationOtpResponse)
def resend_registration_code(
    data: ResendRegistrationOtpRequest,
    db: Session = Depends(get_db),
):
    """
    Resends a new verification code, enforcing cooldown and rate limits.
    """
    if settings.ENVIRONMENT == "production":
        provider = email_service.get_active_email_provider()
        if provider not in ("resend", "smtp"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Email verification service is temporarily unavailable in production.",
            )

    try:
        raw_code, verif_record = email_verification_service.request_registration_verification(
            db=db,
            email=data.email,
            full_name=data.full_name,
        )
        dispatch_result = email_service.send_verification_code_email(
            to_email=data.email,
            code=raw_code,
            expires_in_minutes=15,
        )
        if not dispatch_result.get("success") and dispatch_result.get("provider") in ("resend", "smtp"):
            err = dispatch_result.get("error") or "Email service unavailable"
            logger.error(f"Registration OTP resend delivery failed for {data.email}: {err}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Unable to resend verification email: {err}. Please verify email configuration.",
            )

        return SendRegistrationOtpResponse(
            message="A new 6-digit verification code has been dispatched to your email address.",
            cooldown_seconds=60,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/login", response_model=TokenResponse)
def login(
    login_data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Authenticates authorized personnel and issues a JWT token.
    Sets a secure HttpOnly cookie for browser sessions.
    Unverified or inactive accounts are rejected.
    """
    user = authenticate_user(db, email=login_data.email, password=login_data.password)
    if not user:
        clean_email = login_data.email.strip().lower()

        # Check if an inactive / unverified user exists
        inactive_user = (
            db.query(User)
            .filter(func.lower(func.trim(User.email)) == clean_email, User.is_active == False)
            .first()
        )
        if inactive_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has not completed email verification. Please verify your email before signing in.",
            )

        # Check if an applicant registration exists for this email
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
                    detail="Registration is pending email verification. Please complete verification to activate your account.",
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
    """Lists system personnel within the founder's organization, filtered by role."""
    query = db.query(User).filter(
        User.is_active == True,
        User.organization_id == current_user.organization_id,
    )
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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Initiates password recovery.
    Always returns a generic 200 response to prevent account enumeration.
    Generates a secure, hashed, single-use token with 30-minute expiration.
    Dispatches a branded password reset email with the recovery URL asynchronously
    via FastAPI BackgroundTasks to eliminate account-existence timing side-channels.
    """
    if settings.ENVIRONMENT == "production":
        provider = email_service.get_active_email_provider()
        if provider not in ("resend", "smtp"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Password recovery service is temporarily unavailable because email delivery is not yet configured on this environment. Please contact the administrator.",
            )

    reset_info = password_reset_service.initiate_password_reset(db, email=data.email)
    
    if reset_info:
        raw_token, target_user = reset_info
        reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={raw_token}"
        background_tasks.add_task(
            email_service.send_password_reset_email,
            to_email=target_user.email,
            recipient_name=target_user.full_name,
            reset_url=reset_url,
        )

    # Audit event without exposing token or leaking delivery latency
    audit_service.log_audit(
        db=db,
        user_email=str(data.email).strip().lower(),
        action="FORGOT_PASSWORD_REQUEST",
        resource_type="user",
        resource_id="auth",
        details=f"Password recovery requested for {data.email}.",
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


@router.post("/forgot-password/send-otp", response_model=SendForgotPasswordOtpResponse)
def forgot_password_send_otp(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Sends a 6-digit OTP code to the provided email for password recovery.
    Always returns generic 200 response to prevent email enumeration.
    Enforces cooldown and hourly rate limits.
    """
    if settings.ENVIRONMENT == "production":
        provider = email_service.get_active_email_provider()
        if provider not in ("resend", "smtp"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Password recovery service is temporarily unavailable because email delivery is not yet configured on this environment. Please contact the administrator.",
            )

    try:
        raw_code, record, user = password_reset_service.request_password_reset_otp(db, email=data.email)
        if user and record:
            dispatch_result = email_service.send_password_reset_otp_email(
                to_email=user.email,
                recipient_name=user.full_name,
                code=raw_code,
                expires_in_minutes=15,
            )
            if not dispatch_result.get("success") and dispatch_result.get("provider") in ("resend", "smtp"):
                err = dispatch_result.get("error") or "Mail delivery failure"
                logger.error(f"Password reset email delivery failed for {user.email}: {err}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Unable to dispatch password recovery email: {err}. Please verify mail settings.",
                )

        audit_service.log_audit(
            db=db,
            user_email=str(data.email).strip().lower(),
            action="FORGOT_PASSWORD_OTP_REQUESTED",
            resource_type="auth",
            resource_id="password_reset_code",
            details=f"Password recovery OTP requested for {data.email}.",
        )

        return SendForgotPasswordOtpResponse(
            message="If an account matches that email address, a 6-digit password recovery code has been dispatched.",
            cooldown_seconds=60,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/forgot-password/verify-otp", response_model=VerifyForgotPasswordOtpResponse)
def forgot_password_verify_otp(
    data: VerifyForgotPasswordOtpRequest,
    db: Session = Depends(get_db),
):
    """
    Verifies the 6-digit OTP code for password reset.
    Returns a single-use session reset token valid for 15 minutes.
    """
    try:
        reset_token = password_reset_service.verify_password_reset_otp(
            db=db,
            email=data.email,
            code=data.code,
        )
        audit_service.log_audit(
            db=db,
            user_email=str(data.email).strip().lower(),
            action="FORGOT_PASSWORD_OTP_VERIFIED",
            resource_type="auth",
            resource_id="password_reset_code",
            details=f"Password recovery OTP verified successfully for {data.email}.",
        )
        return VerifyForgotPasswordOtpResponse(
            reset_token=reset_token,
            message="Verification code confirmed. You may now set your new password.",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/forgot-password/reset-password", status_code=status.HTTP_200_OK)
def forgot_password_reset_password(
    data: ResetPasswordWithOtpRequest,
    db: Session = Depends(get_db),
):
    """
    Resets user password using the single-use reset token obtained after verifying OTP.
    """
    try:
        user = password_reset_service.reset_password_with_verified_otp(
            db=db,
            email=data.email,
            reset_token=data.reset_token,
            new_password=data.new_password,
        )
        audit_service.log_audit(
            db=db,
            user_email=user.email,
            action="RESET_PASSWORD_WITH_OTP_SUCCESS",
            resource_type="user",
            resource_id=user.id,
            details=f"Password successfully reset via verified OTP for '{user.email}'",
        )
        return {"message": "Your password has been successfully reset. You may now sign in with your new credentials."}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

