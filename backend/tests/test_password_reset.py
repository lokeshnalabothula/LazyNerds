import pytest
from app.models.user import User
from app.models.password_reset import PasswordResetToken
from app.services import password_reset_service
from app.core.security import verify_password


def test_forgot_password_generic_response(client, db_session, test_user):
    """Verifies that forgot-password returns 200 without exposing account existence."""
    # Known user
    res1 = client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})
    assert res1.status_code == 200
    assert "password recovery instructions have been dispatched" in res1.json()["message"]
    # Verify no raw token is exposed in the API response
    assert "token" not in res1.json()

    # Unknown user
    res2 = client.post("/api/v1/auth/forgot-password", json={"email": "nonexistent@lazynerds.com"})
    assert res2.status_code == 200
    assert res1.json() == res2.json()


def test_password_reset_flow_end_to_end(client, db_session, test_user):
    """Tests token generation, verification, password updating, and single-use invalidation."""
    raw_token = password_reset_service.request_password_reset(db_session, email=test_user.email)
    assert raw_token is not None
    assert len(raw_token) > 20

    # Token hash must be stored, NOT plaintext
    token_record = db_session.query(PasswordResetToken).filter(PasswordResetToken.user_id == test_user.id).first()
    assert token_record is not None
    assert token_record.token_hash != raw_token
    assert token_record.used_at is None

    # Verify token endpoint
    verify_res = client.post("/api/v1/auth/verify-reset-token", json={"token": raw_token})
    assert verify_res.status_code == 200
    assert verify_res.json()["valid"] is True

    # Invalid token check
    invalid_res = client.post("/api/v1/auth/verify-reset-token", json={"token": "invalid_fake_token_12345"})
    assert invalid_res.status_code == 400

    # Reset password with weak password (rejected)
    weak_res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_token, "new_password": "short"}
    )
    assert weak_res.status_code == 422  # validation min_length=10

    # Reset password with strong password (success)
    new_password = "BrandNewSecurePassword2026!"
    success_res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_token, "new_password": new_password}
    )
    assert success_res.status_code == 200
    assert "successfully reset" in success_res.json()["message"]

    # Verify token is now marked as used
    db_session.refresh(token_record)
    assert token_record.used_at is not None

    # Single-use enforcement: re-using the same token fails
    reuse_res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_token, "new_password": "AnotherNewPassword2026!"}
    )
    assert reuse_res.status_code == 400
    assert "invalid, expired, or already-used" in reuse_res.json()["detail"].lower()

    # Login with new password succeeds
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": new_password}
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


def test_forgot_password_case_insensitive_lookup(client, db_session, test_user):
    """Verifies that forgot-password matches accounts regardless of case or surrounding spaces."""
    mixed_case_email = f"  {test_user.email.upper()}  "
    res = client.post("/api/v1/auth/forgot-password", json={"email": mixed_case_email})
    assert res.status_code == 200

    # Ensure a valid token was generated and associated with the user
    token_record = (
        db_session.query(PasswordResetToken)
        .filter(PasswordResetToken.user_id == test_user.id)
        .order_by(PasswordResetToken.created_at.desc())
        .first()
    )
    assert token_record is not None
    assert token_record.used_at is None


def test_password_reset_long_password_bcrypt_safe(client, db_session, test_user):
    """Verifies passwords longer than 72 bytes do not crash bcrypt and authenticate reliably."""
    raw_token = password_reset_service.request_password_reset(db_session, email=test_user.email)
    assert raw_token is not None

    # An 80-character password with mixed requirements
    long_pwd = "VeryLongPassphraseSecureFixOps2026!" + "A" * 40
    assert len(long_pwd.encode("utf-8")) > 72

    res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_token, "new_password": long_pwd}
    )
    assert res.status_code == 200

    # Login with long password succeeds
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": long_pwd}
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


def test_email_service_templates_and_dispatch():
    """Unit test for email templates and mock dispatch service."""
    from app.services.email_service import (
        build_password_reset_html,
        build_password_reset_plaintext,
        send_password_reset_email,
    )

    url = "https://lazynerds.vercel.app/reset-password?token=test-token-xyz-123"
    html = build_password_reset_html("Lokesh Nalabothula", "lokesh@example.com", url)
    text = build_password_reset_plaintext("Lokesh Nalabothula", "lokesh@example.com", url)

    assert "Lazy Nerds FixOps" in html
    assert url in html
    assert "30 minutes" in html
    assert "Lokesh Nalabothula" in html

    assert "Lazy Nerds FixOps" in text
    assert url in text
    assert "30 minutes" in text

    # Dispatch via mock provider
    result = send_password_reset_email("lokesh@example.com", "Lokesh Nalabothula", url)
    assert result["success"] is True
    assert result["provider"] in ("mock", "resend", "smtp")


def test_production_unconfigured_email_fails_safely(client, test_user, monkeypatch):
    """Verifies that in production mode, an unconfigured email provider returns HTTP 503 instead of deceptive 200."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "RESEND_API_KEY", None)
    monkeypatch.setattr(settings, "SMTP_HOST", None)
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "auto")

    res = client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})
    assert res.status_code == 503
    assert "temporarily unavailable" in res.json()["detail"].lower()


def test_forgot_password_otp_flow_end_to_end(client, db_session, test_user):
    """
    Tests the complete OTP-based password reset flow:
    1. Request OTP via /forgot-password/send-otp
    2. Unknown email returns identical generic response
    3. 60s cooldown is enforced on immediate resend
    4. Verify OTP via /forgot-password/verify-otp
    5. Reset password via /forgot-password/reset-password
    6. Single-use session token invalidation
    7. Sign in with updated credentials
    """
    from app.models.password_reset import PasswordResetCode

    # 1. Unknown user returns generic response without error or account leaking
    res_unknown = client.post(
        "/api/v1/auth/forgot-password/send-otp",
        json={"email": "nobody_exists@lazynerds.com"}
    )
    assert res_unknown.status_code == 200
    assert "password recovery code has been dispatched" in res_unknown.json()["message"]
    assert res_unknown.json()["cooldown_seconds"] == 60

    # 2. Known user requests OTP
    res_known = client.post(
        "/api/v1/auth/forgot-password/send-otp",
        json={"email": test_user.email}
    )
    assert res_known.status_code == 200
    assert "password recovery code has been dispatched" in res_known.json()["message"]

    # 3. Cooldown enforcement: immediate second request returns 429
    res_cooldown = client.post(
        "/api/v1/auth/forgot-password/send-otp",
        json={"email": test_user.email}
    )
    assert res_cooldown.status_code == 429
    assert "Please wait" in res_cooldown.json()["detail"]

    # 4. Use service helper on another test email for deterministic OTP verification
    reset_email = "otp_reset_user@lazynerds.com"
    from app.services.auth_service import create_user
    from app.schemas.auth import UserCreate
    other_user = create_user(
        db_session,
        UserCreate(
            email=reset_email,
            password="OldPassword123!",
            full_name="OTP Reset User",
            role="client",
        ),
    )

    raw_code, record, user = password_reset_service.request_password_reset_otp(db_session, reset_email)
    assert len(raw_code) == 6
    assert raw_code.isdigit()
    assert record is not None
    assert record.user_id == other_user.id

    # 5. Incorrect OTP increments attempt count
    bad_res = client.post(
        "/api/v1/auth/forgot-password/verify-otp",
        json={"email": reset_email, "code": "000000" if raw_code != "000000" else "111111"}
    )
    assert bad_res.status_code == 400
    assert "Invalid verification code" in bad_res.json()["detail"]
    assert "4 attempts remaining" in bad_res.json()["detail"]

    # 6. Correct OTP verifies and returns single-use session reset token
    verify_res = client.post(
        "/api/v1/auth/forgot-password/verify-otp",
        json={"email": reset_email, "code": raw_code}
    )
    assert verify_res.status_code == 200
    reset_token = verify_res.json()["reset_token"]
    assert len(reset_token) > 20

    # 7. Weak password is rejected
    weak_res = client.post(
        "/api/v1/auth/forgot-password/reset-password",
        json={"email": reset_email, "reset_token": reset_token, "new_password": "weak"}
    )
    assert weak_res.status_code == 422  # validation min_length=10

    # 8. Valid password succeeds
    new_password = "BrandNewOtpPassword2026!"
    reset_res = client.post(
        "/api/v1/auth/forgot-password/reset-password",
        json={"email": reset_email, "reset_token": reset_token, "new_password": new_password}
    )
    assert reset_res.status_code == 200
    assert "successfully reset" in reset_res.json()["message"]

    # 9. Reset token is single-use: reuse fails
    reuse_res = client.post(
        "/api/v1/auth/forgot-password/reset-password",
        json={"email": reset_email, "reset_token": reset_token, "new_password": "AnotherNewPassword2026!"}
    )
    assert reuse_res.status_code == 400
    assert "invalid, expired, or already-used" in reuse_res.json()["detail"].lower()

    # 10. Sign in with updated credentials succeeds
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": reset_email, "password": new_password}
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()



