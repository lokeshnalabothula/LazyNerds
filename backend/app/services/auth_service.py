import json
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.security import hash_password, verify_password
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import UserCreate


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Finds a user by email (robust case-insensitive and trimmed lookup)."""
    if not email:
        return None
    clean_email = email.strip().lower()
    return db.query(User).filter(func.lower(func.trim(User.email)) == clean_email).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    """Finds a user by ID."""
    return db.query(User).filter(User.id == user_id).first()


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Verifies credentials and returns User if valid, else None."""
    if not email or not password:
        return None
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


def create_user(db: Session, user_in: UserCreate) -> User:
    """Creates a new authorized user with a bcrypt hashed password and assigns an organization."""
    org_id = user_in.organization_id
    if not org_id:
        primary_org = db.query(Organization).filter(Organization.slug == "lazy-nerds").first()
        if primary_org:
            org_id = primary_org.id
        else:
            primary_org = Organization(
                name="Lazy Nerds",
                slug="lazy-nerds",
            )
            db.add(primary_org)
            db.flush()
            org_id = primary_org.id

    perms_json = None
    if user_in.permissions:
        perms_json = json.dumps(user_in.permissions)

    db_user = User(
        email=user_in.email.strip().lower(),
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name.strip(),
        role=user_in.role or "client",
        organization_id=org_id,
        permissions=perms_json,
        client_id=user_in.client_id,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def change_user_password(db: Session, user: User, current_password: str, new_password: str) -> User:
    """Verifies current password and updates to new bcrypt hashed password."""
    if not verify_password(current_password, user.hashed_password):
        raise ValueError("Current password verification failed.")

    if len(new_password) < 10:
        raise ValueError("New password must be at least 10 characters long.")

    user.hashed_password = hash_password(new_password)
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def bootstrap_founder_account(db: Session) -> User:
    """
    Explicit administrative bootstrap mechanism for the founder and primary organization.
    Ensures:
    1. Primary organization 'Lazy Nerds' exists.
    2. Founder account matching INITIAL_ADMIN_EMAIL exists with role='owner'.
    3. Founder is designated as the organization owner.
    4. Founder possesses all permissions ('*').
    Never assumes arbitrary public registrants are owners.
    """
    from app.core.config import settings

    now = datetime.now(timezone.utc)
    founder_email = settings.INITIAL_ADMIN_EMAIL.strip().lower()

    # 1. Ensure primary organization exists
    primary_org = db.query(Organization).filter(Organization.slug == "lazy-nerds").first()
    if not primary_org:
        primary_org = Organization(
            name="Lazy Nerds",
            slug="lazy-nerds",
            created_at=now,
            updated_at=now,
        )
        db.add(primary_org)
        db.flush()

    # 2. Look for existing founder account
    founder = db.query(User).filter(func.lower(func.trim(User.email)) == founder_email).first()
    if founder:
        founder.role = "owner"
        founder.organization_id = primary_org.id
        founder.is_active = True
        founder.permissions = json.dumps(["*"])
        founder.updated_at = now
        primary_org.owner_id = founder.id
    else:
        # Create founder user if absent
        founder = User(
            email=founder_email,
            hashed_password=hash_password(settings.INITIAL_ADMIN_PASSWORD),
            full_name=settings.INITIAL_ADMIN_NAME,
            role="owner",
            organization_id=primary_org.id,
            permissions=json.dumps(["*"]),
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(founder)
        db.flush()
        primary_org.owner_id = founder.id

    db.commit()
    db.refresh(founder)
    return founder
