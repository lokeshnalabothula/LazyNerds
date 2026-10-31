import hashlib
import hmac
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash, validate_password_strength
from app.models.user import User
from app.models.password_reset import PasswordResetToken, PasswordResetCode


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensures datetime is timezone-aware UTC, safe across SQLite and PostgreSQL."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def generate_reset_otp_code() -> str:
    """Generates a cryptographically secure 6-digit numeric verification code."""
    return "".join(secrets.choice("0123456789") for _ in range(6))


def hash_reset_code(email: str, code: str) -> str:
    """
    Computes HMAC-SHA256 hash of the 6-digit code bound to the email address and SECRET_KEY.
    """
    normalized_email = email.strip().lower()
    cleaned_code = code.strip()
    key = settings.SECRET_KEY.encode("utf-8")
    msg = f"reset_otp:{normalized_email}:{cleaned_code}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def hash_reset_token(email: str, token: str) -> str:
    """
    Computes HMAC-SHA256 hash of the single-use reset session token bound to the email.
    """
    normalized_email = email.strip().lower()
    cleaned_token = token.strip()
    key = settings.SECRET_KEY.encode("utf-8")
    msg = f"reset_token:{normalized_email}:{cleaned_token}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()



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


def request_password_reset_otp(
    db: Session,
    email: str,
) -> Tuple[str, Optional[PasswordResetCode], Optional[User]]:
    """
    Initiates password recovery via 6-digit OTP.
    - Rate limits: 60s cooldown, max 5 requests per hour.
    - If user exists and is active, stores HMAC-SHA256 hashed code.
    - If user does not exist or is inactive, returns simulated code without storing record
      to prevent timing side-channels and account enumeration.
    """
    if not email:
        raise ValueError("Email is required.")
    normalized_email = email.strip().lower()
    now = utc_now()

    user = (
        db.query(User)
        .filter(func.lower(func.trim(User.email)) == normalized_email)
        .first()
    )

    # Enforce resend cooldown (60s) across any active reset code for this email
    recent_active_code = (
        db.query(PasswordResetCode)
        .filter(
            func.lower(func.trim(PasswordResetCode.email)) == normalized_email,
            PasswordResetCode.used_at.is_(None),
        )
        .order_by(PasswordResetCode.created_at.desc())
        .first()
    )
    if recent_active_code and ensure_utc(recent_active_code.resend_available_at) > now:
        remaining_seconds = max(1, int((ensure_utc(recent_active_code.resend_available_at) - now).total_seconds()))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {remaining_seconds} seconds before requesting a new verification code.",
        )

    # Enforce hourly rate limit (max 5 requests per hour per email)
    one_hour_ago = now - timedelta(hours=1)
    all_recent = (
        db.query(PasswordResetCode)
        .filter(
            func.lower(func.trim(PasswordResetCode.email)) == normalized_email,
        )
        .all()
    )
    hourly_count = sum(1 for c in all_recent if ensure_utc(c.created_at) >= one_hour_ago)
    if hourly_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests for this email address. Please try again in an hour.",
        )

    raw_code = generate_reset_otp_code()

    if not user or not user.is_active:
        return raw_code, None, None

    # Invalidate previous unused codes for this email
    db.query(PasswordResetCode).filter(
        func.lower(func.trim(PasswordResetCode.email)) == normalized_email,
        PasswordResetCode.used_at.is_(None),
    ).update({"used_at": now})

    code_hash = hash_reset_code(normalized_email, raw_code)
    expires_at = now + timedelta(minutes=15)
    resend_available_at = now + timedelta(seconds=60)

    record = PasswordResetCode(
        email=normalized_email,
        user_id=user.id,
        code_hash=code_hash,
        expires_at=expires_at,
        resend_available_at=resend_available_at,
        attempts=0,
        created_at=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return raw_code, record, user


def verify_password_reset_otp(
    db: Session,
    email: str,
    code: str,
) -> str:
    """
    Validates single-use 6-digit OTP code for password reset.
    - Enforces code expiration (15m), max 5 attempts, and single-use invalidation.
    - On success: marks code as used and issues a single-use cryptographic reset session token.
    - Returns the reset token string.
    """
    if not email or not code:
        raise ValueError("Email and verification code are required.")

    normalized_email = email.strip().lower()
    cleaned_code = code.strip()

    if len(cleaned_code) != 6 or not cleaned_code.isdigit():
        raise ValueError("Verification code must be a 6-digit numeric string.")

    now = utc_now()

    record = (
        db.query(PasswordResetCode)
        .filter(
            func.lower(func.trim(PasswordResetCode.email)) == normalized_email,
            PasswordResetCode.used_at.is_(None),
        )
        .order_by(PasswordResetCode.created_at.desc())
        .first()
    )

    if not record:
        raise ValueError("Invalid or expired verification code. Please request a new code.")

    if ensure_utc(record.expires_at) < now:
        record.used_at = now
        db.commit()
        raise ValueError("Verification code has expired. Please request a new code.")

    if record.attempts >= 5:
        record.used_at = now
        db.commit()
        raise ValueError("Too many incorrect attempts. This code has been invalidated. Please request a new code.")

    expected_hash = hash_reset_code(normalized_email, cleaned_code)
    if not hmac.compare_digest(record.code_hash, expected_hash):
        record.attempts += 1
        db.commit()
        remaining = 5 - record.attempts
        if remaining <= 0:
            record.used_at = now
            db.commit()
            raise ValueError("Too many incorrect attempts. This code has been invalidated. Please request a new code.")
        raise ValueError(f"Invalid verification code. {remaining} attempt{'s' if remaining > 1 else ''} remaining.")

    # Mark OTP as used
    record.used_at = now

    # Issue single-use reset token valid for 15 minutes
    reset_token = secrets.token_urlsafe(32)
    record.reset_token_hash = hash_reset_token(normalized_email, reset_token)
    record.reset_token_expires_at = now + timedelta(minutes=15)

    db.commit()
    return reset_token


def reset_password_with_verified_otp(
    db: Session,
    email: str,
    reset_token: str,
    new_password: str,
) -> User:
    """
    Resets the user's password using the verified single-use reset session token.
    - Validates token hash, expiration, and single-use status.
    - Enforces password complexity rules.
    - Invalidates session token immediately.
    """
    if not email or not reset_token or not new_password:
        raise ValueError("Email, reset token, and new password are required.")

    normalized_email = email.strip().lower()
    cleaned_token = reset_token.strip()
    now = utc_now()

    # Enforce password policy
    is_valid, err_msg = validate_password_strength(new_password)
    if not is_valid:
        raise ValueError(err_msg)

    expected_token_hash = hash_reset_token(normalized_email, cleaned_token)

    record = (
        db.query(PasswordResetCode)
        .filter(
            func.lower(func.trim(PasswordResetCode.email)) == normalized_email,
            PasswordResetCode.reset_token_hash == expected_token_hash,
            PasswordResetCode.reset_token_expires_at > now,
        )
        .first()
    )

    if not record:
        raise ValueError("Invalid, expired, or already-used password reset session. Please request a new code.")

    user = (
        db.query(User)
        .filter(func.lower(func.trim(User.email)) == normalized_email)
        .first()
    )

    if not user or not user.is_active:
        raise ValueError("Account not found or inactive.")

    # Update password
    user.hashed_password = get_password_hash(new_password)
    user.updated_at = now

    # Invalidate this reset session token (single-use)
    record.reset_token_hash = None
    record.reset_token_expires_at = None

    # Invalidate any other active reset codes or legacy tokens for this user
    db.query(PasswordResetCode).filter(
        func.lower(func.trim(PasswordResetCode.email)) == normalized_email,
        PasswordResetCode.id != record.id,
        PasswordResetCode.used_at.is_(None),
    ).update({"used_at": now})

    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": now})

    db.commit()
    db.refresh(user)
    return user
