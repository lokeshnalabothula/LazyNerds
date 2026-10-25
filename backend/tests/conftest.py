import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure test environment
os.environ["ENVIRONMENT"] = "testing"
os.environ["ALLOW_LAB_TESTING"] = "true"
os.environ["DATABASE_URL"] = "sqlite:///./test_fixops.db"
os.environ["SECRET_KEY"] = "test-secret-key-lazy-nerds-fixops-super-secure-2026"

from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import Base, get_db
from app.main import app
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.user import User
from app.schemas.auth import UserCreate
from app.services.auth_service import create_user

TEST_DB_URL = "sqlite:///./test_fixops.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create test tables at beginning of test run and clean up at end."""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./test_fixops.db"):
        os.remove("./test_fixops.db")


@pytest.fixture
def db_session():
    """Provides a fresh database session per test, rolling back mutations."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

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
