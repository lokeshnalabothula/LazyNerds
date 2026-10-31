import os
import sys
import tempfile
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup an isolated temporary directory and SQLite database file per test run (isolated per xdist worker).
worker_id = os.environ.get("PYTEST_XDIST_WORKER", "main")
_test_db_key = f"TEST_DB_URL_{worker_id}"
_test_dir_key = f"TEST_TEMP_DIR_{worker_id}"

_test_db_url = os.environ.get(_test_db_key)
if not _test_db_url:
    _test_dir = tempfile.mkdtemp(prefix=f"fixops_test_db_{worker_id}_")
    _test_db_path = os.path.join(_test_dir, "isolated_fixops.db")
    _test_db_url = f"sqlite:///{_test_db_path}"
    os.environ[_test_db_key] = _test_db_url
    os.environ[_test_dir_key] = _test_dir
    os.environ["TEST_TEMP_DIR"] = _test_dir

TEST_DB_URL = _test_db_url

# Ensure test environment
os.environ["ENVIRONMENT"] = "testing"
os.environ["ALLOW_LAB_TESTING"] = "true"
os.environ["WORKER_DISPATCH_MODE"] = "distributed"
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["SECRET_KEY"] = "test-secret-key-lazy-nerds-fixops-super-secure-2026"

import bcrypt
_orig_gensalt = bcrypt.gensalt
bcrypt.gensalt = lambda rounds=4, prefix=b"2b": _orig_gensalt(4, prefix)

from app.core import security
security.bcrypt.gensalt = lambda rounds=4, prefix=b"2b": _orig_gensalt(4, prefix)

from app.core.config import settings
from app.core.security import create_access_token
import app.db.session as session_module
from app.db.session import Base, get_db
import app.main as main_module
import app.models as _all_models  # Ensures all model tables are registered in Base.metadata
from app.main import app
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.user import User
from app.schemas.auth import UserCreate
from app.services.auth_service import create_user

# Bind settings and database session modules to the isolated test database
settings.DATABASE_URL = TEST_DB_URL
settings.WORKER_DISPATCH_MODE = "distributed"


@pytest.fixture(autouse=True)
def mock_email_dispatch_in_tests(monkeypatch):
    """Ensures automated unit/integration tests do not hit live Resend/SMTP endpoints."""
    from app.services import email_service
    monkeypatch.setattr(email_service, "get_active_email_provider", lambda: "mock")

from sqlalchemy import event

test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})

@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA synchronous = OFF")
    cursor.execute("PRAGMA journal_mode = MEMORY")
    cursor.close()
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Patch session and main module singletons so lifespan, dependencies, and background tasks
# unconditionally use the test engine and cannot connect to host PostgreSQL or disk files.
session_module.engine = test_engine
session_module.SessionLocal = TestingSessionLocal
main_module.engine = test_engine
main_module.SessionLocal = TestingSessionLocal


def _is_lab_server_running(host: str = "127.0.0.1", port: int = 8888) -> bool:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


@pytest.fixture(scope="session", autouse=True)
def ensure_lab_server():
    """
    Ensures that the deliberately vulnerable lab server on http://127.0.0.1:8888
    is available for blackbox scanner and website audit test cases.
    If the port is not bound, launches the lab process and terminates it on exit.
    """
    proc = None
    if not _is_lab_server_running():
        import subprocess
        import time
        lab_script = Path(__file__).resolve().parent.parent.parent / "lab" / "vulnerable_app" / "main.py"
        if lab_script.exists():
            proc = subprocess.Popen(
                [sys.executable, str(lab_script)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            for _ in range(30):
                if _is_lab_server_running():
                    break
                time.sleep(0.1)
    yield
    if proc:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except Exception:
            proc.kill()


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create test tables at beginning of test run and clean up at end."""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    with TestingSessionLocal() as init_s:
        from app.models.organization import Organization, PRIMARY_ORGANIZATION_ID
        if not init_s.query(Organization).filter(Organization.id == PRIMARY_ORGANIZATION_ID).first():
            init_s.merge(Organization(
                id=PRIMARY_ORGANIZATION_ID,
                name="Lazy Nerds",
                slug="lazy-nerds",
            ))
            init_s.commit()
    yield
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()
    test_temp_dir = os.environ.get("TEST_TEMP_DIR")
    if test_temp_dir and os.path.exists(test_temp_dir):
        try:
            import shutil
            shutil.rmtree(test_temp_dir, ignore_errors=True)
        except Exception:
            pass


@pytest.fixture
def db_session():
    """Provides a fresh database session per test, rolling back mutations."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    # Guarantee primary organization exists for test isolation
    from app.models.organization import Organization, PRIMARY_ORGANIZATION_ID
    if not session.query(Organization).filter(Organization.id == PRIMARY_ORGANIZATION_ID).first():
        session.merge(Organization(
            id=PRIMARY_ORGANIZATION_ID,
            name="Lazy Nerds",
            slug="lazy-nerds",
        ))
        session.flush()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    """Unauthenticated TestClient."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """Creates a known authorized founder user in the test database."""
    user = create_user(
        db_session,
        UserCreate(
            email="founder-test@lazynerds.com",
            password="TestPassword2026!",
            full_name="Founder Test",
            role="founder",
        )
    )
    return user


@pytest.fixture
def auth_headers(test_user):
    """Bearer authorization header for test user."""
    token = create_access_token(
        subject=test_user.id,
        extra_claims={"email": test_user.email, "role": test_user.role}
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_client(client, auth_headers):
    """Test client with pre-configured Authorization header."""
    client.headers.update(auth_headers)
    return client
