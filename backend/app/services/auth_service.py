from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.auth import UserCreate


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Finds a user by email (case-insensitive lookup)."""
    return db.query(User).filter(User.email == email.strip().lower()).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    """Finds a user by ID."""
    return db.query(User).filter(User.id == user_id).first()


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Verifies credentials and returns User if valid, else None."""
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


def create_user(db: Session, user_in: UserCreate) -> User:
    """Creates a new authorized user with a bcrypt hashed password."""
    db_user = User(
        email=user_in.email.strip().lower(),
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name.strip(),
        role=user_in.role,
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
