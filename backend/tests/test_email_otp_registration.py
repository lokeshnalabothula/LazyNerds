import time
from datetime import datetime, timezone, timedelta
import pytest
from app.models.user import User
from app.models.email_verification import EmailVerificationCode
from app.services.email_verification_service import (
    request_registration_verification,
    verify_registration_code_and_activate,
    hash_verification_code,
)


def test_successful_email_verification_and_automatic_account_creation(client, db_session):
    """
    Tests that a user can request an email verification code, verify it,
    and have their account automatically created and activated without founder approval.
    """
    test_email = "newoperator@example.com"
    
    # 1. Request verification code
    send_res = client.post("/api/v1/auth/register/send-code", json={"email": test_email})
    assert send_res.status_code == 200
    data = send_res.json()
    assert "verification code has been dispatched" in data["message"]
    assert data["cooldown_seconds"] == 60

    # 2. Retrieve the active code record from DB
    verif = (
        db_session.query(EmailVerificationCode)
        .filter(EmailVerificationCode.email == test_email, EmailVerificationCode.used_at.is_(None))
        .first()
    )
    assert verif is not None
    assert verif.attempts == 0
    assert verif.used_at is None

    # Find the actual 6-digit code by matching the hash against 100000..999999 or by checking mock / test helper
    # Since hash is HMAC-SHA256, test can verify with the code that produced it
    # We can also test direct service helper:
    raw_code, record = request_registration_verification(db_session, "operator_svc@example.com")
    assert len(raw_code) == 6
    assert raw_code.isdigit()

    # 3. Verify code via endpoint
    verify_res = client.post(
        "/api/v1/auth/register/verify-code",
        json={
            "email": "operator_svc@example.com",
            "code": raw_code,
            "password": "SecurePassword123!",
            "full_name": "Test Operator",
        },
    )
    assert verify_res.status_code == 200
    res_data = verify_res.json()
    assert "access_token" in res_data
    assert res_data["token_type"] == "bearer"
    assert res_data["user"]["email"] == "operator_svc@example.com"
    assert res_data["user"]["full_name"] == "Test Operator"
    assert res_data["user"]["is_active"] is True
    assert res_data["user"]["role"] == "client"

    # Verify session cookie was set
    assert "fixops_access_token" in verify_res.cookies

    # 4. Verify user can now immediately sign in with credentials
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "operator_svc@example.com", "password": "SecurePassword123!"},
    )
    assert login_res.status_code == 200
    assert login_res.json()["user"]["email"] == "operator_svc@example.com"


def test_incorrect_expired_reused_and_bruteforced_codes(client, db_session):
    """
    Tests security controls on verification codes:
    - Incorrect code increases attempt count and reports remaining attempts
    - 5 incorrect attempts invalidates code (brute force protection)
    - Expired codes are rejected
    - Reused codes are rejected
    """
    email = "security_test@example.com"
    raw_code, record = request_registration_verification(db_session, email)

    # 1. Incorrect code
    res = client.post(
        "/api/v1/auth/register/verify-code",
        json={"email": email, "code": "000000" if raw_code != "000000" else "111111"},
    )
    assert res.status_code == 400
    assert "Invalid verification code" in res.json()["detail"]
    assert "4 attempts remaining" in res.json()["detail"]

    # 2. Brute force attempts up to 5
    for i in range(4):
        bad_code = f"99999{i}"
        client.post(
            "/api/v1/auth/register/verify-code",
            json={"email": email, "code": bad_code},
        )

    # Now the code must be invalidated (marked used/invalidated)
    brute_force_res = client.post(
        "/api/v1/auth/register/verify-code",
        json={"email": email, "code": raw_code},
    )
    assert brute_force_res.status_code == 400
    assert (
        "invalidated" in brute_force_res.json()["detail"]
        or "Invalid or expired" in brute_force_res.json()["detail"]
    )

    # 3. Expired code
    email_exp = "expired_test@example.com"
    code_exp, record_exp = request_registration_verification(db_session, email_exp)
    # Manually expire the code
    record_exp.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()

    exp_res = client.post(
        "/api/v1/auth/register/verify-code",
        json={"email": email_exp, "code": code_exp},
    )
    assert exp_res.status_code == 400
    assert "expired" in exp_res.json()["detail"]

    # 4. Reused code
    email_reuse = "reuse_test@example.com"
    code_reuse, record_reuse = request_registration_verification(db_session, email_reuse)
    ok_res = client.post(
        "/api/v1/auth/register/verify-code",
        json={"email": email_reuse, "code": code_reuse},
    )
    assert ok_res.status_code == 200

    # Attempt to reuse code
    reuse_res = client.post(
        "/api/v1/auth/register/verify-code",
        json={"email": email_reuse, "code": code_reuse},
    )
    assert reuse_res.status_code == 400
    assert "Invalid or expired" in reuse_res.json()["detail"]


def test_resend_cooldown_and_rate_limiting(client, db_session):
    """
    Tests that requesting another verification code enforces a 60-second cooldown,
    and exceeding hourly rate limits is blocked with 429.
    """
    email = "cooldown_test@example.com"

    # First send is successful
    res1 = client.post("/api/v1/auth/register/send-code", json={"email": email})
    assert res1.status_code == 200

    # Immediate second send must trigger 429 cooldown
    res2 = client.post("/api/v1/auth/register/send-code", json={"email": email})
    assert res2.status_code == 429
    assert "Please wait" in res2.json()["detail"]

    # Immediate resend endpoint also triggers 429
    res_resend = client.post("/api/v1/auth/register/resend-code", json={"email": email})
    assert res_resend.status_code == 429

    # Advance cooldown in DB
    records = db_session.query(EmailVerificationCode).filter(EmailVerificationCode.email == email).all()
    for r in records:
        r.resend_available_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()

    # Now resend succeeds
    res3 = client.post("/api/v1/auth/register/resend-code", json={"email": email})
    assert res3.status_code == 200

    # Test hourly rate limiting (5 per hour)
    email_limit = "ratelimit_test@example.com"
    for i in range(5):
        # Create records directly with cooldown passed
        verif = EmailVerificationCode(
            email=email_limit,
            code_hash="fakehash",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
            resend_available_at=datetime.now(timezone.utc) - timedelta(seconds=10),
            attempts=0,
            used_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc) - timedelta(minutes=i * 5),
        )
        db_session.add(verif)
    db_session.commit()

    limit_res = client.post("/api/v1/auth/register/send-code", json={"email": email_limit})
    assert limit_res.status_code == 429
    assert "Too many verification code requests" in limit_res.json()["detail"]


def test_duplicate_email_registration_and_authentication_attempts_before_verification(client, db_session):
    """
    Tests:
    - Attempting registration for an already registered active email is rejected
    - Attempting login before verification is completed is rejected with 401 or 403
    """
    email = "existing_user@example.com"
    raw_code, _ = request_registration_verification(db_session, email)
    verify_res = client.post(
        "/api/v1/auth/register/verify-code",
        json={"email": email, "code": raw_code, "password": "Password123!"},
    )
    assert verify_res.status_code == 200

    # 1. Attempting duplicate registration send-code
    dup_res = client.post("/api/v1/auth/register/send-code", json={"email": email})
    assert dup_res.status_code == 400
    assert "already registered" in dup_res.json()["detail"]

    # 2. Login before verification
    unverified_email = "unverified_operator@example.com"
    request_registration_verification(db_session, unverified_email)

    unverif_login = client.post(
        "/api/v1/auth/login",
        json={"email": unverified_email, "password": "SomePassword123!"},
    )
    # Unverified user account does not exist or cannot authenticate
    assert unverif_login.status_code in (401, 403)


def test_four_step_registration_flow_end_to_end(client, db_session):
    """
    Tests the strict 4-step registration sequence:
    Step 1: Request OTP with Full Name & Email only (no password).
    Step 2: Verify 6-digit OTP -> obtains registration_token; account NOT yet created.
    Step 3/4: Complete registration with registration_token and password.
    Security checks:
    - Attempting completion with bad token fails.
    - Token replay is prevented (single-use).
    - User account and tenant created and active.
    - Session cookie and access token issued.
    """
    email = "cadet.ripley@weyland.corp"
    full_name = "Ellen Ripley"

    # Step 1: Send OTP (no password provided)
    step1_res = client.post(
        "/api/v1/auth/register/send-otp",
        json={"email": email, "full_name": full_name},
    )
    assert step1_res.status_code == 200
    assert step1_res.json()["cooldown_seconds"] == 60

    # Retrieve issued OTP code
    record = (
        db_session.query(EmailVerificationCode)
        .filter(EmailVerificationCode.email == email, EmailVerificationCode.used_at.is_(None))
        .first()
    )
    assert record is not None
    assert record.full_name == full_name

    # Find matching 6-digit code for testing
    raw_code = None
    for c in range(100000, 1000000):
        c_str = str(c)
        if hash_verification_code(email, c_str) == record.code_hash:
            raw_code = c_str
            break
    assert raw_code is not None

    # Step 2: Verify OTP (no password provided)
    step2_res = client.post(
        "/api/v1/auth/register/verify-otp",
        json={"email": email, "code": raw_code},
    )
    assert step2_res.status_code == 200
    step2_data = step2_res.json()
    assert step2_data["valid"] is True
    assert "registration_token" in step2_data
    assert step2_data["email"] == email
    registration_token = step2_data["registration_token"]

    # Verify user is NOT yet created in database
    user_early = db_session.query(User).filter(User.email == email).first()
    assert user_early is None

    # Step 3/4 failure: Bad token fails
    bad_token_res = client.post(
        "/api/v1/auth/register/complete",
        json={
            "email": email,
            "registration_token": "invalid_token_12345678",
            "password": "NostromoSecurity2026!",
            "full_name": full_name,
        },
    )
    assert bad_token_res.status_code == 400
    assert "Invalid or expired registration session" in bad_token_res.json()["detail"]

    # Step 3/4 failure: Weak password fails
    weak_pwd_res = client.post(
        "/api/v1/auth/register/complete",
        json={
            "email": email,
            "registration_token": registration_token,
            "password": "weak",
            "full_name": full_name,
        },
    )
    assert weak_pwd_res.status_code in (400, 422)

    # Step 4: Valid completion
    complete_res = client.post(
        "/api/v1/auth/register/complete",
        json={
            "email": email,
            "registration_token": registration_token,
            "password": "NostromoSecurity2026!",
            "full_name": full_name,
        },
    )
    assert complete_res.status_code == 200
    comp_data = complete_res.json()
    assert comp_data["token_type"] == "bearer"
    assert comp_data["user"]["email"] == email
    assert comp_data["user"]["full_name"] == full_name
    assert comp_data["user"]["is_active"] is True
    assert "fixops_access_token" in complete_res.cookies

    # Step 4 replay: Token cannot be reused
    replay_res = client.post(
        "/api/v1/auth/register/complete",
        json={
            "email": email,
            "registration_token": registration_token,
            "password": "NostromoSecurity2026!",
            "full_name": full_name,
        },
    )
    assert replay_res.status_code == 400
    assert "already been used" in replay_res.json()["detail"]

    # Verify user can sign in with new password
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "NostromoSecurity2026!"},
    )
    assert login_res.status_code == 200
    assert login_res.json()["user"]["email"] == email
