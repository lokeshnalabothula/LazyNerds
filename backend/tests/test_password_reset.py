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
