from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.services.auth_service import get_user_by_id

security = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Extracts JWT from Bearer Authorization header or HttpOnly cookie.
    Validates token and returns current active authorized User.
    """
    token = None
    if auth_header and auth_header.credentials:
        token = auth_header.credentials
    elif "fixops_access_token" in request.cookies:
        token = request.cookies.get("fixops_access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to access client records.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload["sub"]
    user = get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorized user record not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact the system administrator.",
        )

    return user


def require_founder(
    current_user: User = Depends(get_current_user),
) -> User:
    """Enforces Founder role privileges for executive administration, registration reviews, and company settings."""
    if current_user.role not in ("founder", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Founder privileges required for this operation.",
        )
    return current_user


def require_employee_or_founder(
    current_user: User = Depends(get_current_user),
) -> User:
    """Enforces internal team membership (Employee or Founder) for accessing internal workspace tools."""
    if current_user.role not in ("founder", "admin", "employee"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Internal FixOps operations privileges required.",
        )
    return current_user


def require_client(
    current_user: User = Depends(get_current_user),
) -> User:
    """Enforces client account role for customer portal access."""
    if current_user.role != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Client portal privileges required.",
        )
    return current_user


# Alias for backwards compatibility
require_admin = require_founder

