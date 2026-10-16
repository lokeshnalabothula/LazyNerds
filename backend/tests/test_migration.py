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

        alembic_cfg = Config("alembic.ini")
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

        engine.dispose()
    finally:
        if os.path.exists(tmp_db_path):
            os.remove(tmp_db_path)
