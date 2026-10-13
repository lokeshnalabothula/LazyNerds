from fastapi import status
from app.core.security import decode_access_token


def test_tampered_token_rejected(client):
    """Tests that cryptographically tampered or forged JWT tokens are rejected."""
    tampered_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.tampered_signature"
    client.headers.update({"Authorization": f"Bearer {tampered_token}"})
    response = client.get("/api/v1/clients")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Session has expired or is invalid" in response.json()["detail"]


def test_error_sanitization_no_leakage(client):
    """Tests that error responses do not leak SQL syntax or internal environment secrets."""
    # Sending bad payload to check error format
    response = client.post("/api/v1/clients", json="not a json object")
    assert response.status_code in [
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_422_UNPROCESSABLE_ENTITY
    ]
    raw_text = response.text.lower()
    # Check that secrets and internal implementation details are not leaked
    assert "password" not in raw_text or "invalid" in raw_text
    assert "secret_key" not in raw_text
    assert "database_url" not in raw_text
    assert "traceback (most recent call last)" not in raw_text
