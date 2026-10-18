#!/usr/bin/env python3
"""
Lazy Nerds FixOps — Production Founder Password Recovery Script
==============================================================
Secure, controlled one-time administrative password recovery script.
Prompts for a new password using masked input (getpass), validates
password complexity, confirms account role as 'founder', and updates
the bcrypt password hash within an atomic transaction.

Never logs, prints, or exposes plaintext passwords, tokens, or credentials.
"""

import getpass
import os
import sys
from datetime import datetime, timezone

# Ensure backend package is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine, func, text
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password, validate_password_strength, verify_password
from app.models.user import User
from app.models.audit import AuditLog

FOUNDER_EMAIL = "lokeshnalabothula@gmail.com"


def get_db_url() -> str:
    # 1. Environment variable
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return db_url

    # 2. Check .env.local
    env_local_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env.local"))
    if os.path.exists(env_local_path):
        with open(env_local_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("DATABASE_URL="):
                    return line.split("=", 1)[1].strip().strip("\"'")

    return ""


def normalize_db_url(url: str) -> str:
    clean = url.strip()
    if clean.startswith("postgres://"):
        clean = clean.replace("postgres://", "postgresql+psycopg://", 1)
    elif clean.startswith("postgresql://") and not clean.startswith("postgresql+"):
        clean = clean.replace("postgresql://", "postgresql+psycopg://", 1)
    return clean


def test_connection(db_url: str) -> bool:
    try:
        norm = normalize_db_url(db_url)
        engine = create_engine(norm, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def main():
    print("===================================================================")
    print("LAZY NERDS FIXOPS — SECURE FOUNDER PASSWORD RECOVERY")
    print("===================================================================")
    print(f"Target Account: {FOUNDER_EMAIL}")
    print("Role: founder")
    print("-------------------------------------------------------------------")

    db_url = get_db_url()
    if not db_url or not test_connection(db_url):
        print("\n[!] The default database connection string from environment or .env.local")
        print("    could not authenticate against the production database.")
        print("    (The database credentials may have been rotated on Neon/Render).")
        print("\nPlease enter the active Neon DATABASE_URL (from Render or Neon console):")
        db_url = getpass.getpass("Active DATABASE_URL (input hidden): ").strip()

        if not db_url:
            print("\n[-] Aborted: No database connection provided.")
            sys.exit(1)

        if not test_connection(db_url):
            print("\n[-] Error: Unable to authenticate to PostgreSQL with the provided URL.")
            print("    Please verify the connection string and try again.")
            sys.exit(1)

        # Update .env.local with working URL
        env_local_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env.local"))
        try:
            lines = []
            if os.path.exists(env_local_path):
                with open(env_local_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if not line.startswith("DATABASE_URL="):
                            lines.append(line)
            lines.insert(0, f"DATABASE_URL=\"{db_url}\"\n")
            with open(env_local_path, "w", encoding="utf-8") as f:
                f.writelines(lines)
            print("[+] Saved verified DATABASE_URL to .env.local.")
        except Exception:
            pass

    normalized_url = normalize_db_url(db_url)
    engine = create_engine(normalized_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Confirm target account in database
        target_user = (
            session.query(User)
            .filter(func.lower(func.trim(User.email)) == FOUNDER_EMAIL)
            .first()
        )

        if not target_user:
            print(f"\n[-] Error: Account '{FOUNDER_EMAIL}' not found in the database.")
            sys.exit(1)

        if target_user.role != "founder":
            print(f"\n[-] Error: Account role is '{target_user.role}', expected 'founder'.")
            sys.exit(1)

        if not target_user.is_active:
            print(f"\n[-] Error: Founder account '{FOUNDER_EMAIL}' is inactive.")
            sys.exit(1)

        print(f"[+] Verified active founder account: {target_user.full_name} ({target_user.id})")
        print("\nPlease enter the new password for the founder account.")
        print("Requirements: Minimum 10 characters, at least 1 uppercase, 1 lowercase, 1 number.")

        while True:
            pwd1 = getpass.getpass("\nNew password (hidden): ")
            if not pwd1:
                print("Password cannot be empty.")
                continue

            valid, err_msg = validate_password_strength(pwd1)
            if not valid:
                print(f"[-] Password does not meet security policy: {err_msg}")
                continue

            pwd2 = getpass.getpass("Confirm new password (hidden): ")
            if pwd1 != pwd2:
                print("[-] Passwords do not match. Please try again.")
                continue

            break

        # Compute hash using production bcrypt configuration
        hashed = hash_password(pwd1)

        # Update user within atomic transaction
        target_user.hashed_password = hashed
        target_user.updated_at = datetime.now(timezone.utc)

        # Record audit log
        audit = AuditLog(
            user_email=FOUNDER_EMAIL,
            action="FOUNDER_PASSWORD_RECOVERY",
            resource_type="user",
            resource_id=target_user.id,
            details="Founder password successfully updated via administrative recovery script.",
            created_at=datetime.now(timezone.utc),
        )
        session.add(audit)
        session.commit()

        # Verify hash
        session.refresh(target_user)
        if not verify_password(pwd1, target_user.hashed_password):
            print("[-] Integrity error: Newly saved hash failed local verification.")
            sys.exit(1)

        print("\n===================================================================")
        print("[SUCCESS] Founder password successfully updated and verified!")
        print("===================================================================")
        print(f"User: {target_user.email}")
        print(f"Role: {target_user.role}")
        print("Status: Active")
        print("\nYou can now sign in at: https://lazynerds.vercel.app/login")

    except Exception as e:
        session.rollback()
        print(f"\n[-] Error during password update: {e}")
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
