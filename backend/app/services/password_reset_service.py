import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, validate_password_strength
from app.models.user import User
from app.models.password_reset import PasswordResetToken


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def initiate_password_reset(db: Session, email: str) -> Optional[Tuple[str, User]]:
    """
    Initiates password reset for the specified email.
    Generates a cryptographically secure URL-safe token.
    Stores only the SHA-256 hash in the database.
    Returns (raw_token, user) if account exists and is active, else None.
    """
    if not email:
        return None
    normalized_email = email.strip().lower()
    user = (
        db.query(User)
        .filter(func.lower(func.trim(User.email)) == normalized_email)
        .first()
    )
    if not user or not user.is_active:
        return None

    # Invalidate previous unused reset tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": utc_now()})

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = utc_now() + timedelta(minutes=30)

    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        created_at=utc_now(),
    )
    db.add(reset_record)
    db.commit()
    return raw_token, user


def request_password_reset(db: Session, email: str) -> Optional[str]:
    """
    Initiates password reset for the specified email and returns the raw token string.
    Backwards-compatible wrapper around initiate_password_reset.
    """
    result = initiate_password_reset(db, email=email)
    if not result:
        return None
    raw_token, _ = result
    return raw_token



def verify_password_reset_token(db: Session, raw_token: str) -> Optional[Tuple[PasswordResetToken, User]]:
    """
    Validates token existence, expiration, and single-use status.
    Returns (token_record, user) if valid, otherwise None.
    """
    if not raw_token or len(raw_token) < 16:
        return None

    token_hash = hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()
    record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > utc_now(),
        )
        .first()
    )
    if not record or not record.user or not record.user.is_active:
        return None
    return record, record.user


def reset_user_password(db: Session, raw_token: str, new_password: str) -> User:
    """
    Verifies reset token, applies password policy, securely hashes the new password,
    marks the token as used, and invalidates any other active reset tokens.
    """
    verified = verify_password_reset_token(db, raw_token)
    if not verified:
        raise ValueError("Invalid, expired, or already-used password reset link. Please request a new link.")

    record, user = verified

    # Enforce password policy
    is_valid, err_msg = validate_password_strength(new_password)
    if not is_valid:
        raise ValueError(err_msg)

    user.hashed_password = get_password_hash(new_password)
    user.updated_at = utc_now()
    record.used_at = utc_now()

    # Invalidate all other unused tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.id != record.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": utc_now()})

    db.commit()
    db.refresh(user)
    return user
