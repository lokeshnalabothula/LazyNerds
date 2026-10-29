import pytest
from app.models.client import Client
from app.models.user import User
from app.models.registration import ClientRegistration
from app.core.security import create_access_token
from app.services.auth_service import create_user
from app.schemas.auth import UserCreate


@pytest.fixture
def employee_user(db_session):
    return create_user(
        db_session,
        UserCreate(
            email="employee1@lazynerds.com",
            password="EmployeePassword2026!",
            full_name="Operations Specialist",
            role="employee",
        )
    )


@pytest.fixture
def employee_headers(employee_user):
    token = create_access_token(
        subject=employee_user.id,
        extra_claims={"email": employee_user.email, "role": employee_user.role}
    )
    return {"Authorization": f"Bearer {token}"}


def test_client_self_registration_and_status(client, db_session):
    """Tests public registration submission and applicant status check."""
    reg_payload = {
        "full_name": "Alice Target",
        "email": "alice@cybercorp.io",
        "password": "SecurePassword2026!",
        "company_name": "CyberCorp Global",
        "website": "https://cybercorp.io",
        "industry": "FinTech",
        "requested_services": "External Attack Surface Penetration Test",
        "scope_description": "cybercorp.io web properties and APIs",
    }
    res = client.post("/api/v1/registrations/register", json=reg_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "pending"
    assert data["company_name"] == "CyberCorp Global"

    # Status lookup
    status_res = client.get("/api/v1/registrations/status?email=alice@cybercorp.io")
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "pending"
    assert "awaiting executive review" in status_res.json()["message"]

    # Pending applicant login attempt gives actionable status context (unverified)
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@cybercorp.io", "password": "SecurePassword2026!"}
    )
    assert login_res.status_code == 403
    assert "pending email verification" in login_res.json()["detail"]



def test_employee_cannot_access_unapproved_registrations(client, employee_headers):
    """
    CRITICAL SECURITY CHECK:
    Employees must NOT be able to access client registration endpoints.
    """
    client.headers.update(employee_headers)
    res = client.get("/api/v1/registrations")
    assert res.status_code == 403
    assert "founder privileges required" in res.json()["detail"].lower()


def test_founder_review_and_approval_workflow(client, auth_headers, db_session):
    """
    Tests founder listing registrations, reviewing details, and approving client.
    Verifies that approval activates Client and User(role='client').
    """
    # 0. Submit a client registration
    client.headers.clear()
    reg_payload = {
        "full_name": "Alice Target",
        "email": "alice@cybercorp.io",
        "password": "SecurePassword2026!",
        "company_name": "CyberCorp Global",
        "website": "https://cybercorp.io",
        "industry": "FinTech",
        "requested_services": "External Attack Surface Penetration Test",
        "scope_description": "cybercorp.io web properties and APIs",
    }
    client.post("/api/v1/registrations/register", json=reg_payload)

    # 1. Founder lists pending registrations
    client.headers.update(auth_headers)
    list_res = client.get("/api/v1/registrations?status=pending")
    assert list_res.status_code == 200
    regs = list_res.json()["items"]
    assert len(regs) >= 1
    target_reg = [r for r in regs if r["email"] == "alice@cybercorp.io"][0]

    # 2. Founder views details
    detail_res = client.get(f"/api/v1/registrations/{target_reg['id']}")
    assert detail_res.status_code == 200
    assert detail_res.json()["company_name"] == "CyberCorp Global"

    # 3. Founder approves registration
    review_res = client.post(
        f"/api/v1/registrations/{target_reg['id']}/review",
        json={"action": "approve", "reason": "Authorized engagement scope confirmed."}
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "approved"

    # 4. Verify Client and User records created in database
    created_client = db_session.query(Client).filter(Client.company_name == "CyberCorp Global").first()
    assert created_client is not None
    assert created_client.status == "active"

    client_user = db_session.query(User).filter(User.email == "alice@cybercorp.io").first()
    assert client_user is not None
    assert client_user.role == "client"
    assert client_user.client_id == created_client.id

    # 5. Approved client signs in successfully
    client.headers.clear()
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@cybercorp.io", "password": "SecurePassword2026!"}
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    assert login_res.json()["user"]["role"] == "client"

    # 6. Client portal isolation: client can only see their own client record
    client.headers.update({"Authorization": f"Bearer {token}"})
    clients_res = client.get("/api/v1/clients")
    assert clients_res.status_code == 200
    assert len(clients_res.json()["items"]) == 1
    assert clients_res.json()["items"][0]["id"] == created_client.id


def test_bulk_archive_and_restore(client, auth_headers, db_session):
    """Tests multi-client bulk archive and restore workflow."""
    client.headers.update(auth_headers)

    # Create two test clients
    c1 = Client(company_name="Batch Client One", primary_contact_name="Contact 1", primary_contact_email="c1@test.com", status="active")
    c2 = Client(company_name="Batch Client Two", primary_contact_name="Contact 2", primary_contact_email="c2@test.com", status="active")
    db_session.add_all([c1, c2])
    db_session.commit()
    db_session.refresh(c1)
    db_session.refresh(c2)

    # Bulk archive
    archive_res = client.post(
        "/api/v1/clients/bulk-archive",
        json={"client_ids": [c1.id, c2.id]}
    )
    assert archive_res.status_code == 200
    assert archive_res.json()["archived_count"] == 2

    db_session.refresh(c1)
    db_session.refresh(c2)
    assert c1.status == "archived"
    assert c2.status == "archived"

    # Bulk restore
    restore_res = client.post(
        "/api/v1/clients/bulk-restore",
        json={"client_ids": [c1.id, c2.id]}
    )
    assert restore_res.status_code == 200
    assert restore_res.json()["restored_count"] == 2

    db_session.refresh(c1)
    db_session.refresh(c2)
    assert c1.status == "active"
    assert c2.status == "active"


def test_client_role_engagement_isolation(client, db_session):
    """Verifies that client users can only see their own engagements and cannot mutate them."""
    from app.models.engagement import Engagement

    # Create two clients
    c1 = Client(company_name="Client Alpha", primary_contact_name="Alpha Lead", primary_contact_email="lead@alpha.io", status="active")
    c2 = Client(company_name="Client Beta", primary_contact_name="Beta Lead", primary_contact_email="lead@beta.io", status="active")
    db_session.add_all([c1, c2])
    db_session.commit()
    db_session.refresh(c1)
    db_session.refresh(c2)

    # Create an engagement for each client
    eng1 = Engagement(
        client_id=c1.id,
        name="Alpha Vulnerability Audit",
        assessment_type="Web App Pen Test",
        status="in_progress",
        authorization_status="confirmed",
    )
    eng2 = Engagement(
        client_id=c2.id,
        name="Beta Perimeter Scan",
        assessment_type="Cloud Security Review",
        status="planned",
        authorization_status="confirmed",
    )
    db_session.add_all([eng1, eng2])
    db_session.commit()
    db_session.refresh(eng1)
    db_session.refresh(eng2)

    # Create a client user bound to Client Alpha
    user_alpha = create_user(
        db_session,
        UserCreate(
            email="portal@alpha.io",
            password="SecurePassword2026!",
            full_name="Alpha Portal User",
            role="client",
            client_id=c1.id,
        ),
    )

    token = create_access_token(
        subject=user_alpha.id,
        extra_claims={"email": user_alpha.email, "role": user_alpha.role, "client_id": user_alpha.client_id},
    )
    client.headers.update({"Authorization": f"Bearer {token}"})

    # 1. Listing engagements returns only Alpha's engagement
    list_res = client.get("/api/v1/engagements")
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == eng1.id
    assert items[0]["client_id"] == c1.id

    # 2. Reading Alpha's own engagement succeeds
    get_alpha_res = client.get(f"/api/v1/engagements/{eng1.id}")
    assert get_alpha_res.status_code == 200
    assert get_alpha_res.json()["id"] == eng1.id

    # 3. Reading Beta's engagement is rejected with 403 Forbidden
    get_beta_res = client.get(f"/api/v1/engagements/{eng2.id}")
    assert get_beta_res.status_code == 403
    assert "Access denied" in get_beta_res.json()["detail"]

    # 4. Attempting to create an engagement is rejected with 403 Forbidden
    create_res = client.post(
        "/api/v1/engagements",
        json={
            "client_id": c1.id,
            "name": "Unauthorized Client Engagement",
            "assessment_type": "Network Pen Test",
            "status": "draft",
            "authorization_status": "confirmed",
        },
    )
    assert create_res.status_code == 403

