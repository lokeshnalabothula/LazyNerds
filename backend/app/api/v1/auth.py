from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse, UserOut
from app.services import auth_service, audit_service
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
    """
    user = authenticate_user(db, email=login_data.email, password=login_data.password)
    if not user:
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
