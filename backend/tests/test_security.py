import pytest
from fastapi import status
from app.core.config import Settings, INSECURE_DEV_SECRET
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


def test_production_rejects_insecure_default_secret_key():
    """Tests that production environment strictly aborts startup if using known default secret key."""
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(ENVIRONMENT="production", SECRET_KEY=INSECURE_DEV_SECRET)


def test_production_rejects_short_secret_key():
    """Tests that production environment strictly aborts startup if SECRET_KEY is shorter than 32 characters."""
    with pytest.raises(ValueError, match="at least 32 characters"):
        Settings(ENVIRONMENT="production", SECRET_KEY="short-secret-key-1234")


def test_production_accepts_strong_secret_key():
    """Tests that production environment succeeds with a sufficiently strong secret key."""
    strong_key = "a" * 48
    s = Settings(ENVIRONMENT="production", SECRET_KEY=strong_key, ALLOWED_ORIGINS="https://lazynerds.vercel.app")
    assert s.SECRET_KEY == strong_key


def test_allowed_origins_parsing_comma_separated():
    """Tests that ALLOWED_ORIGINS parses comma-separated URLs cleanly."""
    origins = Settings.parse_allowed_origins("https://lazynerds.vercel.app, https://preview.lazynerds.vercel.app")
    assert origins == ["https://lazynerds.vercel.app", "https://preview.lazynerds.vercel.app"]


def test_allowed_origins_parsing_json_array():
    """Tests that ALLOWED_ORIGINS parses JSON array strings cleanly."""
    origins = Settings.parse_allowed_origins('["https://lazynerds.vercel.app", "https://lazynerds-backend.onrender.com"]')
    assert origins == ["https://lazynerds.vercel.app", "https://lazynerds-backend.onrender.com"]


def test_allowed_origins_rejects_wildcard():
    """Tests that wildcard '*' is strictly prohibited when credentials are enabled."""
    with pytest.raises(ValueError, match="Wildcard"):
        Settings.parse_allowed_origins("https://example.com, *")


def test_production_rejects_missing_allowed_origins():
    """Tests that production environment strictly aborts if ALLOWED_ORIGINS is empty or missing."""
    strong_key = "a" * 48
    with pytest.raises(ValueError, match="ALLOWED_ORIGINS must be explicitly configured"):
        Settings(ENVIRONMENT="production", SECRET_KEY=strong_key, ALLOWED_ORIGINS="")


def test_production_rejects_localhost_only_origins():
    """Tests that production environment strictly aborts if ALLOWED_ORIGINS only contains localhost."""
    strong_key = "a" * 48
    with pytest.raises(ValueError, match="at least one non-localhost production origin"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY=strong_key,
            ALLOWED_ORIGINS="http://localhost:3000, http://127.0.0.1:8000"
        )


def test_production_accepts_valid_production_origins():
    """Tests that production succeeds when non-localhost origins are provided."""
    strong_key = "a" * 48
    s = Settings(
        ENVIRONMENT="production",
        SECRET_KEY=strong_key,
        ALLOWED_ORIGINS="https://lazynerds.vercel.app, https://preview.lazynerds.vercel.app"
    )
    assert s.ALLOWED_ORIGINS == ["https://lazynerds.vercel.app", "https://preview.lazynerds.vercel.app"]


def test_basesettings_real_env_var_comma_separated(monkeypatch):
    """Verifies that BaseSettings accurately decodes a comma-separated env var through the real settings initialization path."""
    strong_key = "k" * 36
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", strong_key)
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://lazynerds.vercel.app, https://preview.lazynerds.vercel.app")
    s = Settings()
    assert s.ALLOWED_ORIGINS == ["https://lazynerds.vercel.app", "https://preview.lazynerds.vercel.app"]


def test_basesettings_real_env_var_json_array(monkeypatch):
    """Verifies that BaseSettings accurately decodes a JSON-array env var through the real settings initialization path."""
    strong_key = "k" * 36
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", strong_key)
    monkeypatch.setenv("ALLOWED_ORIGINS", '["https://lazynerds.vercel.app", "https://lazynerds-backend.onrender.com"]')
    s = Settings()
    assert s.ALLOWED_ORIGINS == ["https://lazynerds.vercel.app", "https://lazynerds-backend.onrender.com"]


def test_development_fallback_when_origins_unset(monkeypatch):
    """Verifies that development preserves default localhost origins when ALLOWED_ORIGINS is empty or unset."""
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    s = Settings()
    assert "http://localhost:3000" in s.ALLOWED_ORIGINS
    assert "http://127.0.0.1:8000" in s.ALLOWED_ORIGINS
