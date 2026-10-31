import hashlib
import hmac
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, validate_password_strength
from app.models.organization import Organization
from app.models.client import Client
from app.models.user import User
from app.models.registration import ClientRegistration
from app.models.email_verification import EmailVerificationCode
from app.services.audit_service import log_audit


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensures datetime is timezone-aware UTC, safe for SQLite and PostgreSQL."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def generate_verification_code() -> str:
    """Generates a cryptographically secure 6-digit numeric verification code."""
    return "".join(secrets.choice("0123456789") for _ in range(6))



def hash_verification_code(email: str, code: str) -> str:
    """
    Computes HMAC-SHA256 hash of the code bound to the email address and system SECRET_KEY.
    Ensures codes stored in the database cannot be inverted or reused across accounts.
    """
    normalized_email = email.strip().lower()
    cleaned_code = code.strip()
    key = settings.SECRET_KEY.encode("utf-8")
    msg = f"{normalized_email}:{cleaned_code}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def hash_registration_token(email: str, token: str) -> str:
    """
    Computes HMAC-SHA256 hash of single-use registration session token bound to email and SECRET_KEY.
    """
    normalized_email = email.strip().lower()
    cleaned_token = token.strip()
    key = settings.SECRET_KEY.encode("utf-8")
    msg = f"reg-token:{normalized_email}:{cleaned_token}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def request_registration_verification(
    db: Session,
    email: str,
    full_name: Optional[str] = None,
) -> Tuple[str, EmailVerificationCode]:
    """
    Initiates an email OTP verification for new user registration.
    - Validates email.
    - Prevents duplicate registration if an active account already exists.
    - Enforces resend cooldown (60 seconds) and hourly rate limits (5 per hour).
    - Invalidates existing active unused codes.
    - Stores HMAC-SHA256 hashed code with 15-minute expiration.
    Returns (raw_code, record).
    """
    if not email or "@" not in email:
        raise ValueError("A valid email address is required.")

    normalized_email = email.strip().lower()

    # Prevent duplicate registration of active accounts
    existing_user = (
        db.query(User)
        .filter(func.lower(func.trim(User.email)) == normalized_email)
        .first()
    )
    if existing_user and existing_user.is_active:
        raise ValueError("An account is already registered with this email address. Please sign in.")

    now = utc_now()

    # Enforce resend cooldown (60s)
    recent_active_code = (
        db.query(EmailVerificationCode)
        .filter(
            func.lower(func.trim(EmailVerificationCode.email)) == normalized_email,
            EmailVerificationCode.used_at.is_(None),
        )
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )
    if recent_active_code and ensure_utc(recent_active_code.resend_available_at) > now:
        remaining_seconds = max(1, int((ensure_utc(recent_active_code.resend_available_at) - now).total_seconds()))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {remaining_seconds} seconds before requesting a new verification code.",
        )

    # Enforce hourly rate limiting (maximum 5 requests per hour per email)
    one_hour_ago = now - timedelta(hours=1)
    all_recent = (
        db.query(EmailVerificationCode)
        .filter(
            func.lower(func.trim(EmailVerificationCode.email)) == normalized_email,
        )
        .all()
    )
    hourly_count = sum(1 for c in all_recent if ensure_utc(c.created_at) >= one_hour_ago)
    if hourly_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification code requests for this email address. Please try again in an hour.",
        )

    # Invalidate existing unused codes for this email
    db.query(EmailVerificationCode).filter(
        func.lower(func.trim(EmailVerificationCode.email)) == normalized_email,
        EmailVerificationCode.used_at.is_(None),
    ).update({"used_at": now})

    raw_code = generate_verification_code()
    code_hash = hash_verification_code(normalized_email, raw_code)

    expires_at = now + timedelta(minutes=15)
    resend_available_at = now + timedelta(seconds=60)

    verif_record = EmailVerificationCode(
        email=normalized_email,
        full_name=(full_name or "").strip() or None,
        code_hash=code_hash,
        expires_at=expires_at,
        resend_available_at=resend_available_at,
        attempts=0,
        created_at=now,
    )
    db.add(verif_record)
    db.commit()
    db.refresh(verif_record)

    log_audit(
        db=db,
        user_email=normalized_email,
        action="REGISTRATION_OTP_REQUESTED",
        resource_type="auth",
        resource_id=verif_record.id,
        details=f"Email OTP code issued for {normalized_email}",
    )

    return raw_code, verif_record


def verify_registration_code_and_activate(
    db: Session,
    email: str,
    code: str,
    password: Optional[str] = None,
    full_name: Optional[str] = None,
) -> User:
    """
    Validates the single-use OTP code and automatically creates and activates the user account.
    - Enforces code expiration, attempt limits (max 5), and single-use invalidation.
    - Prevents concurrent race conditions when creating account.
    - Activates user immediately without manual administrator approval.
    """
    if not email or not code:
        raise ValueError("Email and verification code are required.")

    normalized_email = email.strip().lower()
    cleaned_code = code.strip()

    if len(cleaned_code) != 6 or not cleaned_code.isdigit():
        raise ValueError("Verification code must be a 6-digit numeric string.")

    now = utc_now()

    # Query active code
    record = (
        db.query(EmailVerificationCode)
        .filter(
            func.lower(func.trim(EmailVerificationCode.email)) == normalized_email,
            EmailVerificationCode.used_at.is_(None),
        )
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )

    if not record:
        raise ValueError("Invalid or expired verification code. Please request a new code.")

    # Check expiration
    if ensure_utc(record.expires_at) < now:
        record.used_at = now
        db.commit()
        raise ValueError("Verification code has expired. Please request a new code.")

    # Check brute-force attempts
    if record.attempts >= 5:
        record.used_at = now
        db.commit()
        raise ValueError("Too many incorrect attempts. This code has been invalidated. Please request a new code.")

    # Verify cryptographic hash
    expected_hash = hash_verification_code(normalized_email, cleaned_code)
    if not hmac.compare_digest(record.code_hash, expected_hash):
        record.attempts += 1
        db.commit()
        remaining = 5 - record.attempts
        if remaining <= 0:
            record.used_at = now
            db.commit()
            raise ValueError("Too many incorrect attempts. This code has been invalidated. Please request a new code.")
        raise ValueError(f"Invalid verification code. {remaining} attempt{'s' if remaining > 1 else ''} remaining.")

    # Code is valid! Mark as used immediately to guarantee single use
    record.used_at = now

    # Check for existing user (guard against concurrent creation)
    existing_user = (
        db.query(User)
        .filter(func.lower(func.trim(User.email)) == normalized_email)
        .first()
    )
    if existing_user:
        if existing_user.is_active:
            db.commit()
            raise ValueError("An account is already registered with this email address. Please sign in.")
        else:
            # Activate previously inactive user
            existing_user.is_active = True
            existing_user.updated_at = now
            if not existing_user.organization_id:
                primary_org = db.query(Organization).filter(Organization.slug == "lazy-nerds").first()
                if not primary_org:
                    primary_org = Organization(name="Lazy Nerds", slug="lazy-nerds", created_at=now, updated_at=now)
                    db.add(primary_org)
                    db.flush()
                existing_user.organization_id = primary_org.id
            if existing_user.role not in ("owner", "founder"):
                existing_user.role = "client"
            if password:
                existing_user.hashed_password = hash_password(password)
            db.commit()
            db.refresh(existing_user)
            log_audit(
                db=db,
                user_email=normalized_email,
                action="USER_ACTIVATED_VIA_EMAIL_OTP",
                resource_type="user",
                resource_id=existing_user.id,
                details=f"User '{normalized_email}' activated via email OTP.",
            )
            return existing_user

    # Determine display name
    clean_name = (full_name or "").strip()
    if not clean_name:
        prefix = normalized_email.split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ")
        clean_name = prefix.title() or "FixOps Operator"

    # Password setup: if user entered password, validate strength and hash it; otherwise generate random secure token
    if password and password.strip():
        valid_pwd, pwd_err = validate_password_strength(password.strip())
        if not valid_pwd:
            raise ValueError(pwd_err)
        final_password = password.strip()
    else:
        final_password = secrets.token_urlsafe(32)
    hashed_pwd = hash_password(final_password)

    # Establish Client tenant for the user
    domain_part = normalized_email.split("@")[1]
    org_name = f"{domain_part.split('.')[0].title()} Organization" if domain_part not in ("gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "proton.me", "protonmail.com") else f"{clean_name}'s Workspace"
    
    primary_org = db.query(Organization).filter(Organization.slug == "lazy-nerds").first()
    if not primary_org:
        primary_org = Organization(name="Lazy Nerds", slug="lazy-nerds", created_at=now, updated_at=now)
        db.add(primary_org)
        db.flush()

    client_record = Client(
        organization_id=primary_org.id,
        company_name=org_name,
        primary_contact_name=clean_name,
        primary_contact_email=normalized_email,
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(client_record)
    db.flush()

    new_user = User(
        email=normalized_email,
        full_name=clean_name,
        role="client",
        organization_id=primary_org.id,
        is_active=True,
        client_id=client_record.id,
        hashed_password=hashed_pwd,
        created_at=now,
        updated_at=now,
    )
    db.add(new_user)
    db.flush()

    # If any legacy ClientRegistration was pending for this email, mark approved
    legacy_reg = (
        db.query(ClientRegistration)
        .filter(func.lower(func.trim(ClientRegistration.email)) == normalized_email)
        .first()
    )
    if legacy_reg:
        legacy_reg.status = "approved"
        legacy_reg.user_id = new_user.id
        legacy_reg.client_id = client_record.id
        legacy_reg.reviewed_at = now
        legacy_reg.review_notes = "Automatically verified via Email OTP."
        legacy_reg.updated_at = now

    db.commit()
    db.refresh(new_user)

    log_audit(
        db=db,
        user_email=normalized_email,
        action="USER_REGISTERED_VIA_EMAIL_OTP",
        resource_type="user",
        resource_id=new_user.id,
        details=f"User '{normalized_email}' registered and automatically activated via email OTP.",
    )

    return new_user


def verify_registration_otp_and_issue_token(
    db: Session,
    email: str,
    code: str,
) -> Tuple[str, EmailVerificationCode]:
    """
    Step 2: Validates the 6-digit OTP code on the backend and issues a cryptographically
    secure, single-use registration session token (valid for 15 minutes).
    The account is NOT yet created - creation only happens after password setup in Step 4.
    """
    if not email or not code:
        raise ValueError("Email and verification code are required.")

    normalized_email = email.strip().lower()
    cleaned_code = code.strip()

    if len(cleaned_code) != 6 or not cleaned_code.isdigit():
        raise ValueError("Verification code must be a 6-digit numeric string.")

    now = utc_now()

    # Query active code
    record = (
        db.query(EmailVerificationCode)
        .filter(
            func.lower(func.trim(EmailVerificationCode.email)) == normalized_email,
            EmailVerificationCode.used_at.is_(None),
        )
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )

    if not record:
        raise ValueError("Invalid or expired verification code. Please request a new code.")

    # Check expiration
    if ensure_utc(record.expires_at) < now:
        record.used_at = now
        db.commit()
        raise ValueError("Verification code has expired. Please request a new code.")

    # Check brute-force attempts
    if record.attempts >= 5:
        record.used_at = now
        db.commit()
        raise ValueError("Too many incorrect attempts. This code has been invalidated. Please request a new code.")

    # Verify cryptographic hash
    expected_hash = hash_verification_code(normalized_email, cleaned_code)
    if not hmac.compare_digest(record.code_hash, expected_hash):
        record.attempts += 1
        db.commit()
        remaining = 5 - record.attempts
        if remaining <= 0:
            record.used_at = now
            db.commit()
            raise ValueError("Too many incorrect attempts. This code has been invalidated. Please request a new code.")
        raise ValueError(f"Invalid verification code. {remaining} attempt{'s' if remaining > 1 else ''} remaining.")

    # Code is valid! Mark OTP code used so it cannot be re-verified
    record.used_at = now

    # Generate single-use registration token (32 bytes URL-safe = 256 bits entropy)
    raw_token = secrets.token_urlsafe(32)
    record.registration_token_hash = hash_registration_token(normalized_email, raw_token)
    record.registration_token_expires_at = now + timedelta(minutes=15)
    record.registration_token_used_at = None
    db.commit()
    db.refresh(record)

    log_audit(
        db=db,
        user_email=normalized_email,
        action="REGISTRATION_OTP_VERIFIED",
        resource_type="auth",
        resource_id=record.id,
        details=f"Email OTP verified; registration session token issued for {normalized_email}",
    )

    return raw_token, record


def complete_registration_with_token(
    db: Session,
    email: str,
    registration_token: str,
    password: str,
    full_name: Optional[str] = None,
) -> User:
    """
    Step 4: Validates the single-use registration token, validates password strength,
    hashes the password, creates/activates user account, and marks token as used.
    """
    if not email or not registration_token:
        raise ValueError("Email and registration session token are required.")
    if not password:
        raise ValueError("Password is required to complete registration.")

    normalized_email = email.strip().lower()
    cleaned_token = registration_token.strip()

    now = utc_now()

    # Find the verification record by email
    records = (
        db.query(EmailVerificationCode)
        .filter(
            func.lower(func.trim(EmailVerificationCode.email)) == normalized_email,
            EmailVerificationCode.registration_token_hash.isnot(None),
        )
        .order_by(EmailVerificationCode.created_at.desc())
        .all()
    )

    expected_hash = hash_registration_token(normalized_email, cleaned_token)
    matching_record = None
    for r in records:
        if r.registration_token_hash and hmac.compare_digest(r.registration_token_hash, expected_hash):
            matching_record = r
            break

    if not matching_record:
        raise ValueError("Invalid or expired registration session. Please verify your email again.")

    if matching_record.registration_token_used_at is not None:
        raise ValueError("This registration session has already been used. Please sign in.")

    if ensure_utc(matching_record.registration_token_expires_at) < now:
        raise ValueError("Registration session has expired. Please verify your email again.")

    # Validate password strength
    valid_pwd, pwd_err = validate_password_strength(password)
    if not valid_pwd:
        raise ValueError(pwd_err)

    # Check for existing active user
    existing_user = (
        db.query(User)
        .filter(func.lower(func.trim(User.email)) == normalized_email)
        .first()
    )
    if existing_user and existing_user.is_active:
        raise ValueError("An account is already registered with this email address. Please sign in.")

    # Mark token used immediately to prevent replay
    matching_record.registration_token_used_at = now

    # Determine display name
    clean_name = (full_name or matching_record.full_name or "").strip()
    if not clean_name:
        prefix = normalized_email.split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ")
        clean_name = prefix.title() or "FixOps Operator"

    hashed_pwd = hash_password(password.strip())

    if existing_user:
        primary_org = db.query(Organization).filter(Organization.slug == "lazy-nerds").first()
        if not primary_org:
            primary_org = Organization(name="Lazy Nerds", slug="lazy-nerds", created_at=now, updated_at=now)
            db.add(primary_org)
            db.flush()
        existing_user.is_active = True
        existing_user.full_name = clean_name
        existing_user.hashed_password = hashed_pwd
        if not existing_user.organization_id:
            existing_user.organization_id = primary_org.id
        if existing_user.role not in ("owner", "founder"):
            existing_user.role = "client"
        existing_user.updated_at = now
        db.commit()
        db.refresh(existing_user)
        log_audit(
            db=db,
            user_email=normalized_email,
            action="USER_REGISTERED_VIA_EMAIL_OTP",
            resource_type="user",
            resource_id=existing_user.id,
            details=f"User '{normalized_email}' completed registration with verified email.",
        )
        return existing_user

    # Create Client tenant organization
    domain_part = normalized_email.split("@")[1]
    org_name = (
        f"{domain_part.split('.')[0].title()} Organization"
        if domain_part not in ("gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "proton.me", "protonmail.com")
        else f"{clean_name}'s Workspace"
    )

    primary_org = db.query(Organization).filter(Organization.slug == "lazy-nerds").first()
    if not primary_org:
        primary_org = Organization(name="Lazy Nerds", slug="lazy-nerds", created_at=now, updated_at=now)
        db.add(primary_org)
        db.flush()

    client_record = Client(
        organization_id=primary_org.id,
        company_name=org_name,
        primary_contact_name=clean_name,
        primary_contact_email=normalized_email,
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(client_record)
    db.flush()

    new_user = User(
        email=normalized_email,
        full_name=clean_name,
        role="client",
        organization_id=primary_org.id,
        is_active=True,
        client_id=client_record.id,
        hashed_password=hashed_pwd,
        created_at=now,
        updated_at=now,
    )
    db.add(new_user)
    db.flush()

    # Legacy registration approval if applicable
    legacy_reg = (
        db.query(ClientRegistration)
        .filter(func.lower(func.trim(ClientRegistration.email)) == normalized_email)
        .first()
    )
    if legacy_reg:
        legacy_reg.status = "approved"
        legacy_reg.user_id = new_user.id
        legacy_reg.client_id = client_record.id
        legacy_reg.reviewed_at = now
        legacy_reg.review_notes = "Automatically verified via Email OTP."
        legacy_reg.updated_at = now

    db.commit()
    db.refresh(new_user)

    log_audit(
        db=db,
        user_email=normalized_email,
        action="USER_REGISTERED_VIA_EMAIL_OTP",
        resource_type="user",
        resource_id=new_user.id,
        details=f"User '{normalized_email}' registered with verified email and created password.",
    )

    return new_user
