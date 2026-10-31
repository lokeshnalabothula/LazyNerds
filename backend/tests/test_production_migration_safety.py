import pytest
from unittest.mock import MagicMock, patch
from app.core.config import settings
from app.main import app, lifespan, init_db_and_seed_admin, _sanitize_db_error


def test_sanitize_db_error_redacts_credentials():
    raw_error = "psycopg.OperationalError: could not connect to server postgresql://admin_user:SuperSecretPassword123@db.neon.tech:5432/fixops"
    sanitized = _sanitize_db_error(raw_error)
    assert "SuperSecretPassword123" not in sanitized
    assert "admin_user:***@" in sanitized
    assert "db.neon.tech:5432/fixops" in sanitized


def test_production_migration_failure_aborts_startup_and_redacts_secrets(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    leak_prone_error = "Connection failed for postgresql://prod_user:SensitiveToken999@aws-neon-proxy:5432/prod"

    with patch("alembic.command.upgrade", side_effect=Exception(leak_prone_error)):
        with pytest.raises(RuntimeError) as exc_info:
            init_db_and_seed_admin()

        err_text = str(exc_info.value)
        assert "Database migration failed in production" in err_text
        assert "SensitiveToken999" not in err_text
        assert "prod_user:***@" in err_text


@pytest.mark.asyncio
async def test_production_lifespan_aborts_on_migration_failure(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    with patch("alembic.command.upgrade", side_effect=Exception("Alembic transaction locked")):
        with pytest.raises(RuntimeError, match="Database migration failed in production"):
            async with lifespan(app):
                pytest.fail("FastAPI lifespan should have aborted before yielding.")


def test_development_migration_warning_does_not_abort_startup(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    with patch("alembic.command.upgrade", side_effect=Exception("Dev SQLite warning")):
        # Should not raise; proceeds to local dev fallback
        init_db_and_seed_admin()


def test_production_successful_migration_skips_inspector_fallback(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    with patch("alembic.command.upgrade") as mock_upgrade, \
         patch("app.db.session.Base.metadata.create_all") as mock_create_all:
        init_db_and_seed_admin()

        mock_upgrade.assert_called_once()
        # In production, manual DDL fallback must be skipped to avoid unversioned schema drift
        mock_create_all.assert_not_called()
