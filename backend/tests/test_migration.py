import os
import tempfile
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect


def test_alembic_migrations_upgrade_and_downgrade():
    """Validates that Alembic migrations run cleanly up to head, downgrade, and upgrade again."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_db_path = tmp.name

    try:
        sqlite_url = f"sqlite:///{tmp_db_path}"
        os.environ["DATABASE_URL"] = sqlite_url
        os.environ["DATABASE_URL_UNPOOLED"] = sqlite_url

        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        alembic_ini_path = os.path.join(backend_dir, "alembic.ini")
        alembic_cfg = Config(alembic_ini_path)
        alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "migrations"))
        alembic_cfg.set_main_option("sqlalchemy.url", sqlite_url)

        # 1. Upgrade to head
        command.upgrade(alembic_cfg, "head")

        # Verify tables created
        engine = create_engine(sqlite_url)
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        assert "clients" in table_names
        assert "users" in table_names
        assert "engagements" in table_names

        columns = [c["name"] for c in inspector.get_columns("engagements")]
        assert "id" in columns
        assert "client_id" in columns
        assert "name" in columns
        assert "assessment_type" in columns
        assert "status" in columns
        assert "start_date" in columns
        assert "due_date" in columns
        assert "scope_summary" in columns
        assert "authorization_status" in columns
        assert "created_at" in columns
        assert "updated_at" in columns

        # 2. Downgrade to 001_initial_schema
        command.downgrade(alembic_cfg, "001_initial_schema")
        inspector = inspect(engine)
        assert "engagements" not in inspector.get_table_names()
        assert "clients" in inspector.get_table_names()

        # 3. Upgrade back to head
        command.upgrade(alembic_cfg, "head")
        inspector = inspect(engine)
        assert "engagements" in inspector.get_table_names()
        assert "assessments" in inspector.get_table_names()

        # Verify worker ownership and lease columns from migration 005 exist on assessments
        assessment_cols = [c["name"] for c in inspector.get_columns("assessments")]
        assert "worker_id" in assessment_cols
        assert "claimed_at" in assessment_cols
        assert "last_heartbeat_at" in assessment_cols
        assert "lease_expires_at" in assessment_cols
        assert "retry_count" in assessment_cols

        engine.dispose()
    finally:
        if os.path.exists(tmp_db_path):
            os.remove(tmp_db_path)


def test_all_migration_revision_ids_fit_in_alembic_version_table():
    """
    PostgreSQL creates the `alembic_version.version_num` column as VARCHAR(32).
    Any revision ID exceeding 32 characters causes StringDataRightTruncation,
    breaking migrations and leaving runtime schemas out of date.
    """
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    versions_dir = os.path.join(backend_dir, "migrations", "versions")

    import importlib.util
    for filename in os.listdir(versions_dir):
        if filename.endswith(".py") and not filename.startswith("__"):
            file_path = os.path.join(versions_dir, filename)
            spec = importlib.util.spec_from_file_location(filename[:-3], file_path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)

            rev = getattr(mod, "revision", None)
            assert rev is not None, f"Migration {filename} missing 'revision' identifier"
            assert len(rev) <= 32, (
                f"Migration revision ID '{rev}' in {filename} is {len(rev)} chars long, "
                f"which exceeds PostgreSQL alembic_version.version_num VARCHAR(32) limit."
            )
