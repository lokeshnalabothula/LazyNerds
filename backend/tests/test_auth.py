from fastapi import status


def test_login_successful(client, test_user):
    """Tests successful login with correct email and password."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "founder-test@lazynerds.com", "password": "TestPassword2026!"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "founder-test@lazynerds.com"
    assert data["user"]["role"] == "founder"
    # Ensure cookie was set
    assert "fixops_access_token" in response.cookies


def test_login_invalid_password(client, test_user):
    """Tests rejected login with incorrect password."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "founder-test@lazynerds.com", "password": "WrongPassword!"},
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid email or password" in response.json()["detail"]


def test_login_unknown_email(client):
    """Tests rejected login with unregistered email."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@lazynerds.com", "password": "AnyPassword!"},
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_current_user_authenticated(auth_client, test_user):
    """Tests fetching current user profile with valid token."""
    response = auth_client.get("/api/v1/auth/me")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["email"] == "founder-test@lazynerds.com"
    assert data["id"] == test_user.id


def test_get_current_user_unauthorized(client):
    """Tests 401 when accessing protected /me without credentials."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_logout(client):
    """Tests logout clears authentication cookie."""
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "Successfully signed out."
