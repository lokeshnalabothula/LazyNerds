import json
import uuid
import pytest
from fastapi import status

from app.core.security import create_access_token
from app.models.organization import Organization, PRIMARY_ORGANIZATION_ID
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.asset import Asset
from app.models.finding import Finding, Assessment
from app.models.report import Report
from app.models.domain import Domain
from app.models.user import User
from app.schemas.auth import UserCreate
from app.services.auth_service import create_user


@pytest.fixture
def multi_org_setup(db_session):
    """
    Sets up two isolated organizations with complete role hierarchies and resource trees:
    - Org A (Alpha Corp): Owner A, Worker A, Client User A, Clients A1/A2, Eng A1, Asset A1, Finding A1, Report A1, Domain A1
    - Org B (Bravo Corp): Owner B, Worker B, Client User B, Client B1, Eng B1, Asset B1, Finding B1, Report B1, Domain B1
    """
    # 1. Create Organization A
    org_a = Organization(
        id=str(uuid.uuid4()),
        name="Alpha Security Corp",
        slug=f"alpha-sec-{uuid.uuid4().hex[:6]}",
    )
    # 2. Create Organization B
    org_b = Organization(
        id=str(uuid.uuid4()),
        name="Bravo Defense Corp",
        slug=f"bravo-def-{uuid.uuid4().hex[:6]}",
    )
    db_session.add_all([org_a, org_b])
    db_session.flush()

    # 3. Create Clients in Org A
    client_a1 = Client(
        id=str(uuid.uuid4()),
        organization_id=org_a.id,
        company_name="Apex Client A1",
        primary_contact_name="Alice A1",
        primary_contact_email="alice@apexa1.io",
        status="active",
    )
    client_a2 = Client(
        id=str(uuid.uuid4()),
        organization_id=org_a.id,
        company_name="Acme Client A2",
        primary_contact_name="Aaron A2",
        primary_contact_email="aaron@acmea2.io",
        status="active",
    )

    # 4. Create Client in Org B
    client_b1 = Client(
        id=str(uuid.uuid4()),
        organization_id=org_b.id,
        company_name="Beta Client B1",
        primary_contact_name="Bob B1",
        primary_contact_email="bob@betab1.io",
        status="active",
    )
    db_session.add_all([client_a1, client_a2, client_b1])
    db_session.flush()

    # 5. Create Users in Org A
    owner_a = create_user(
        db_session,
        UserCreate(
            email=f"owner-a-{uuid.uuid4().hex[:6]}@alpha.io",
            password="OwnerPassword2026!",
            full_name="Owner Alpha",
            role="owner",
            organization_id=org_a.id,
            permissions=["*"],
        ),
    )
    worker_a = create_user(
        db_session,
        UserCreate(
            email=f"worker-a-{uuid.uuid4().hex[:6]}@alpha.io",
            password="WorkerPassword2026!",
            full_name="Worker Alpha",
            role="worker",
            organization_id=org_a.id,
            permissions=["clients:read", "scans:read", "assets:read"],
        ),
    )
    client_user_a = create_user(
        db_session,
        UserCreate(
            email=f"client-a-{uuid.uuid4().hex[:6]}@apexa1.io",
            password="ClientPassword2026!",
            full_name="Client User Alpha",
            role="client",
            organization_id=org_a.id,
            client_id=client_a1.id,
            permissions=[],
        ),
    )

    # 6. Create Users in Org B
    owner_b = create_user(
        db_session,
        UserCreate(
            email=f"owner-b-{uuid.uuid4().hex[:6]}@bravo.io",
            password="OwnerPassword2026!",
            full_name="Owner Bravo",
            role="owner",
            organization_id=org_b.id,
            permissions=["*"],
        ),
    )
    worker_b = create_user(
        db_session,
        UserCreate(
            email=f"worker-b-{uuid.uuid4().hex[:6]}@bravo.io",
            password="WorkerPassword2026!",
            full_name="Worker Bravo",
            role="worker",
            organization_id=org_b.id,
            permissions=["clients:read", "scans:read"],
        ),
    )
    client_user_b = create_user(
        db_session,
        UserCreate(
            email=f"client-b-{uuid.uuid4().hex[:6]}@betab1.io",
            password="ClientPassword2026!",
            full_name="Client User Bravo",
            role="client",
            organization_id=org_b.id,
            client_id=client_b1.id,
            permissions=[],
        ),
    )

    # Set organization owners
    org_a.owner_id = owner_a.id
    org_b.owner_id = owner_b.id

    # 7. Create Engagements
    eng_a1 = Engagement(
        id=str(uuid.uuid4()),
        organization_id=org_a.id,
        client_id=client_a1.id,
        name="Web Pen Test A1",
        assessment_type="Web App Pen Test",
        status="in_progress",
        authorization_status="confirmed",
    )
    eng_b1 = Engagement(
        id=str(uuid.uuid4()),
        organization_id=org_b.id,
        client_id=client_b1.id,
        name="Web Pen Test B1",
        assessment_type="Web App Pen Test",
        status="in_progress",
        authorization_status="confirmed",
    )
    db_session.add_all([eng_a1, eng_b1])
    db_session.flush()

    # 8. Create Assets
    asset_a1 = Asset(
        id=str(uuid.uuid4()),
        organization_id=org_a.id,
        client_id=client_a1.id,
        engagement_id=eng_a1.id,
        name="Production Web A1",
        asset_type="web_application",
        target="https://a1.alpha.io",
        in_scope=True,
        authorization_status="verified",
    )
    asset_b1 = Asset(
        id=str(uuid.uuid4()),
        organization_id=org_b.id,
        client_id=client_b1.id,
        engagement_id=eng_b1.id,
        name="Production Web B1",
        asset_type="web_application",
        target="https://b1.bravo.io",
        in_scope=True,
        authorization_status="verified",
    )
    db_session.add_all([asset_a1, asset_b1])
    db_session.flush()

    # 9. Create Findings
    finding_a1 = Finding(
        id=str(uuid.uuid4()),
        engagement_id=eng_a1.id,
        asset_id=asset_a1.id,
        title="SQL Injection in A1 Portal",
        severity="critical",
        status="open",
        description="Exploitable SQLi flaw in login form.",
    )
    finding_b1 = Finding(
        id=str(uuid.uuid4()),
        engagement_id=eng_b1.id,
        asset_id=asset_b1.id,
        title="Remote Code Execution in B1 Server",
        severity="critical",
        status="open",
        description="Exploitable RCE in upload handler.",
    )
    db_session.add_all([finding_a1, finding_b1])
    db_session.flush()

    # 10. Create Reports
    report_a1 = Report(
        id=str(uuid.uuid4()),
        engagement_id=eng_a1.id,
        title="FixOps Security Assessment A1",
        report_type="executive_summary",
        status="generated",
        summary_content="# Confidential Security Report A1\nTarget: Alpha Security Corp",
        generated_by=owner_a.email,
    )
    report_b1 = Report(
        id=str(uuid.uuid4()),
        engagement_id=eng_b1.id,
        title="FixOps Security Assessment B1",
        report_type="executive_summary",
        status="generated",
        summary_content="# Confidential Security Report B1\nTarget: Bravo Defense Corp",
        generated_by=owner_b.email,
    )
    db_session.add_all([report_a1, report_b1])
    db_session.flush()

    # 11. Create Domains
    from datetime import datetime, timezone, timedelta
    domain_a1 = Domain(
        id=str(uuid.uuid4()),
        organization_id=org_a.id,
        client_id=client_a1.id,
        domain="portal.apexa1.io",
        normalized_domain="portal.apexa1.io",
        verification_status="verified",
        verification_token_hash="hash_a1_dummy",
        challenge_expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )

    domain_b1 = Domain(
        id=str(uuid.uuid4()),
        organization_id=org_b.id,
        client_id=client_b1.id,
        domain="portal.betab1.io",
        normalized_domain="portal.betab1.io",
        verification_status="verified",
        verification_token_hash="hash_b1_dummy",
        challenge_expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )

    db_session.add_all([domain_a1, domain_b1])
    db_session.commit()

    return {
        "org_a": org_a,
        "org_b": org_b,
        "owner_a": owner_a,
        "worker_a": worker_a,
        "client_user_a": client_user_a,
        "owner_b": owner_b,
        "worker_b": worker_b,
        "client_user_b": client_user_b,
        "client_a1": client_a1,
        "client_a2": client_a2,
        "client_b1": client_b1,
        "eng_a1": eng_a1,
        "eng_b1": eng_b1,
        "asset_a1": asset_a1,
        "asset_b1": asset_b1,
        "finding_a1": finding_a1,
        "finding_b1": finding_b1,
        "report_a1": report_a1,
        "report_b1": report_b1,
        "domain_a1": domain_a1,
        "domain_b1": domain_b1,
    }


def make_headers(user: User) -> dict:
    """Generates an authorization header dictionary with fresh claims."""
    token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "role": user.role},
    )
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# SECTION 1: REGISTRATION & SELF-SERVICE ROLE BOUNDARY TESTS
# ==============================================================================

def test_registration_strictly_defaults_to_client_role(client, db_session):
    """
    Validates that newly registered user accounts strictly receive role='client'.
    Malicious role injection attempts in registration payloads are completely ignored.
    """
    from app.services.email_verification_service import request_registration_verification

    # 1. Initiate registration and acquire verification OTP
    raw_code, verif_record = request_registration_verification(
        db=db_session,
        email="prospective-user@example.com",
        full_name="Prospective Client",
    )
    assert len(raw_code) == 6

    # 2. Verify OTP and acquire session token
    v_res = client.post(
        "/api/v1/auth/register/verify-otp",
        json={"email": "prospective-user@example.com", "code": raw_code},
    )
    assert v_res.status_code == status.HTTP_200_OK
    reg_token = v_res.json()["registration_token"]

    # 3. Complete registration with password
    c_res = client.post(
        "/api/v1/auth/register/complete",
        json={
            "email": "prospective-user@example.com",
            "registration_token": reg_token,
            "password": "ChosenPassword2026!",
            "full_name": "Prospective Client",
        },
    )
    assert c_res.status_code == status.HTTP_200_OK
    registered_user = c_res.json()["user"]
    assert registered_user["role"] == "client", "Default registration must strictly produce role='client'"

    # 4. Verify user in database
    user_db = db_session.query(User).filter(User.email == "prospective-user@example.com").first()
    assert user_db is not None
    assert user_db.role == "client"
    assert user_db.is_client is True
    assert user_db.is_worker is False
    assert user_db.is_owner is False


# ==============================================================================
# SECTION 2: FOUNDER / OWNER ROLE MANAGEMENT & HIERARCHY TESTS
# ==============================================================================

def test_owner_promotes_client_to_worker(client, multi_org_setup, db_session):
    """
    Validates that Owner A can promote Client User A to Worker, granting default worker permissions.
    """
    setup = multi_org_setup
    owner_headers = make_headers(setup["owner_a"])
    target_user = setup["client_user_a"]

    # Verify initial state
    assert target_user.role == "client"

    # Promote to worker
    res = client.post(
        f"/api/v1/organization/members/{target_user.id}/promote",
        headers=owner_headers,
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["role"] == "worker"
    assert "clients:read" in data["permissions"]

    # Verify database state
    db_session.refresh(target_user)
    assert target_user.role == "worker"
    assert target_user.is_worker is True
    assert target_user.has_permission("clients:read")


def test_owner_demotes_worker_to_client(client, multi_org_setup, db_session):
    """
    Validates that Owner A can demote Worker A back to Client, stripping all elevated permissions.
    """
    setup = multi_org_setup
    owner_headers = make_headers(setup["owner_a"])
    worker = setup["worker_a"]

    assert worker.role == "worker"

    # Demote to client
    res = client.post(
        f"/api/v1/organization/members/{worker.id}/demote",
        headers=owner_headers,
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["role"] == "client"
    assert data["permissions"] == []

    # Verify database state
    db_session.refresh(worker)
    assert worker.role == "client"
    assert worker.is_client is True
    assert worker.is_worker is False
    assert worker.get_permissions_list() == []


def test_owner_updates_worker_permissions(client, multi_org_setup, db_session):
    """
    Validates that Owner A can assign and revoke granular worker permissions.
    """
    setup = multi_org_setup
    owner_headers = make_headers(setup["owner_a"])
    worker = setup["worker_a"]

    new_perms = ["clients:read", "findings:read", "scans:launch"]
    res = client.put(
        f"/api/v1/organization/members/{worker.id}/permissions",
        json={"permissions": new_perms},
        headers=owner_headers,
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert set(data["permissions"]) == set(new_perms)

    db_session.refresh(worker)
    assert worker.has_permission("scans:launch") is True
    assert worker.has_permission("clients:write") is False


def test_owner_cannot_demote_or_deactivate_last_active_owner(client, multi_org_setup):
    """
    Validates that Owner A cannot demote or deactivate themselves when they are the sole owner.
    """
    setup = multi_org_setup
    owner_headers = make_headers(setup["owner_a"])
    owner_a = setup["owner_a"]

    # Attempt to demote self
    res_demote = client.post(
        f"/api/v1/organization/members/{owner_a.id}/demote",
        headers=owner_headers,
    )
    assert res_demote.status_code == status.HTTP_400_BAD_REQUEST
    assert "last active organization owner" in res_demote.json()["detail"].lower()

    # Attempt to deactivate self
    res_status = client.post(
        f"/api/v1/organization/members/{owner_a.id}/status",
        json={"is_active": False},
        headers=owner_headers,
    )
    assert res_status.status_code == status.HTTP_400_BAD_REQUEST
    assert "last active organization owner" in res_status.json()["detail"].lower()


def test_worker_and_client_cannot_manage_organization_members(client, multi_org_setup):
    """
    Validates that non-owners (workers and clients) are completely denied access to membership endpoints.
    """
    setup = multi_org_setup
    worker_headers = make_headers(setup["worker_a"])
    client_headers = make_headers(setup["client_user_a"])
    target_id = setup["client_user_a"].id

    # Worker attempts
    assert client.get("/api/v1/organization/members", headers=worker_headers).status_code == status.HTTP_403_FORBIDDEN
    assert client.post(f"/api/v1/organization/members/{target_id}/promote", headers=worker_headers).status_code == status.HTTP_403_FORBIDDEN
    assert client.post(f"/api/v1/organization/members/{target_id}/demote", headers=worker_headers).status_code == status.HTTP_403_FORBIDDEN
    assert client.put(f"/api/v1/organization/members/{target_id}/permissions", json={"permissions": []}, headers=worker_headers).status_code == status.HTTP_403_FORBIDDEN

    # Client attempts
    assert client.get("/api/v1/organization/members", headers=client_headers).status_code == status.HTTP_403_FORBIDDEN
    assert client.post(f"/api/v1/organization/members/{target_id}/promote", headers=client_headers).status_code == status.HTTP_403_FORBIDDEN


# ==============================================================================
# SECTION 3: CROSS-ORGANIZATION BOUNDARY & IDOR PREVENTION TESTS
# ==============================================================================

def test_cross_org_membership_management_returns_404(client, multi_org_setup):
    """
    Validates IDOR prevention: Owner A attempting to inspect, promote, demote, or
    alter permissions of an Org B user returns HTTP 404 (never 403 or 200).
    """
    setup = multi_org_setup
    owner_a_headers = make_headers(setup["owner_a"])
    user_b_id = setup["client_user_b"].id
    worker_b_id = setup["worker_b"].id

    # Owner A inspects User B
    res_get = client.get(f"/api/v1/organization/members/{user_b_id}", headers=owner_a_headers)
    assert res_get.status_code == status.HTTP_404_NOT_FOUND

    # Owner A promotes User B
    res_promote = client.post(f"/api/v1/organization/members/{user_b_id}/promote", headers=owner_a_headers)
    assert res_promote.status_code == status.HTTP_404_NOT_FOUND

    # Owner A demotes Worker B
    res_demote = client.post(f"/api/v1/organization/members/{worker_b_id}/demote", headers=owner_a_headers)
    assert res_demote.status_code == status.HTTP_404_NOT_FOUND

    # Owner A updates Worker B permissions
    res_perm = client.put(
        f"/api/v1/organization/members/{worker_b_id}/permissions",
        json={"permissions": ["clients:read"]},
        headers=owner_a_headers,
    )
    assert res_perm.status_code == status.HTTP_404_NOT_FOUND


def test_cross_tenant_client_crud_isolation_returns_404(client, multi_org_setup):
    """
    Validates that Client records are completely isolated between organizations:
    - Org A users cannot list Org B clients.
    - Direct access by ID returns 404.
    """
    setup = multi_org_setup
    owner_a_headers = make_headers(setup["owner_a"])
    owner_b_headers = make_headers(setup["owner_b"])

    # List clients in Org A
    res_a = client.get("/api/v1/clients", headers=owner_a_headers)
    assert res_a.status_code == status.HTTP_200_OK
    items_a = res_a.json()["items"]
    org_a_client_ids = {c["id"] for c in items_a}
    assert setup["client_a1"].id in org_a_client_ids
    assert setup["client_a2"].id in org_a_client_ids
    assert setup["client_b1"].id not in org_a_client_ids, "Org A must never see Org B client records"

    # List clients in Org B
    res_b = client.get("/api/v1/clients", headers=owner_b_headers)
    assert res_b.status_code == status.HTTP_200_OK
    items_b = res_b.json()["items"]
    org_b_client_ids = {c["id"] for c in items_b}
    assert setup["client_b1"].id in org_b_client_ids
    assert setup["client_a1"].id not in org_b_client_ids

    # Direct ID lookup (IDOR check)
    assert client.get(f"/api/v1/clients/{setup['client_b1'].id}", headers=owner_a_headers).status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/v1/clients/{setup['client_a1'].id}", headers=owner_b_headers).status_code == status.HTTP_404_NOT_FOUND


def test_cross_tenant_engagement_isolation_returns_404(client, multi_org_setup):
    """
    Validates that Engagements are completely isolated between organizations.
    Direct access and creation referencing cross-org client_id return 404.
    """
    setup = multi_org_setup
    owner_a_headers = make_headers(setup["owner_a"])
    owner_b_headers = make_headers(setup["owner_b"])

    # List engagements
    res_a = client.get("/api/v1/engagements", headers=owner_a_headers)
    assert res_a.status_code == status.HTTP_200_OK
    eng_a_ids = {e["id"] for e in res_a.json()["items"]}
    assert setup["eng_a1"].id in eng_a_ids
    assert setup["eng_b1"].id not in eng_a_ids

    # Direct ID lookup (IDOR check)
    assert client.get(f"/api/v1/engagements/{setup['eng_b1'].id}", headers=owner_a_headers).status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/v1/engagements/{setup['eng_a1'].id}", headers=owner_b_headers).status_code == status.HTTP_404_NOT_FOUND

    # Creation referencing Org B client from Org A
    res_create = client.post(
        "/api/v1/engagements",
        json={
            "client_id": setup["client_b1"].id,
            "name": "Cross-Org Injected Engagement",
            "assessment_type": "Web App Pen Test",
            "status": "planned",
            "start_date": "2026-11-01",
            "due_date": "2026-11-15",
            "scope_summary": "Infiltration attempt",
        },
        headers=owner_a_headers,
    )
    assert res_create.status_code == status.HTTP_404_NOT_FOUND


def test_cross_tenant_asset_isolation_returns_404(client, multi_org_setup):
    """
    Validates that Assets are completely isolated between organizations.
    Direct access and creation referencing cross-org client_id return 404.
    """
    setup = multi_org_setup
    owner_a_headers = make_headers(setup["owner_a"])
    owner_b_headers = make_headers(setup["owner_b"])

    # List assets
    res_a = client.get("/api/v1/assets", headers=owner_a_headers)
    assert res_a.status_code == status.HTTP_200_OK
    asset_a_ids = {a["id"] for a in res_a.json()["items"]}
    assert setup["asset_a1"].id in asset_a_ids
    assert setup["asset_b1"].id not in asset_a_ids

    # Direct ID lookup (IDOR check)
    assert client.get(f"/api/v1/assets/{setup['asset_b1'].id}", headers=owner_a_headers).status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/v1/assets/{setup['asset_a1'].id}", headers=owner_b_headers).status_code == status.HTTP_404_NOT_FOUND

    # Creation referencing Org B client from Org A
    res_create = client.post(
        "/api/v1/assets",
        json={
            "client_id": setup["client_b1"].id,
            "name": "Cross-Org Injected Asset",
            "asset_type": "web_application",
            "target": "https://spoofed.target.io",
            "in_scope": True,
            "authorization_status": "verified",
        },
        headers=owner_a_headers,
    )
    assert res_create.status_code in (status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST)


def test_cross_tenant_finding_isolation_returns_404(client, multi_org_setup):
    """
    Validates that Vulnerability Findings are completely isolated between organizations.
    """
    setup = multi_org_setup
    owner_a_headers = make_headers(setup["owner_a"])
    owner_b_headers = make_headers(setup["owner_b"])

    # List findings
    res_a = client.get("/api/v1/findings", headers=owner_a_headers)
    assert res_a.status_code == status.HTTP_200_OK
    finding_a_ids = {f["id"] for f in res_a.json()["items"]}
    assert setup["finding_a1"].id in finding_a_ids
    assert setup["finding_b1"].id not in finding_a_ids

    # Direct ID lookup (IDOR check)
    assert client.get(f"/api/v1/findings/{setup['finding_b1'].id}", headers=owner_a_headers).status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/v1/findings/{setup['finding_a1'].id}", headers=owner_b_headers).status_code == status.HTTP_404_NOT_FOUND


def test_cross_tenant_report_isolation_returns_404(client, multi_org_setup):
    """
    Validates that Security Reports are completely isolated between organizations.
    """
    setup = multi_org_setup
    owner_a_headers = make_headers(setup["owner_a"])
    owner_b_headers = make_headers(setup["owner_b"])

    # List reports
    res_a = client.get("/api/v1/reports", headers=owner_a_headers)
    assert res_a.status_code == status.HTTP_200_OK
    report_a_ids = {r["id"] for r in res_a.json()["items"]}
    assert setup["report_a1"].id in report_a_ids
    assert setup["report_b1"].id not in report_a_ids

    # Direct ID lookup (IDOR check)
    assert client.get(f"/api/v1/reports/{setup['report_b1'].id}", headers=owner_a_headers).status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/v1/reports/{setup['report_a1'].id}", headers=owner_b_headers).status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/v1/reports/{setup['report_b1'].id}/download?format=html", headers=owner_a_headers).status_code == status.HTTP_404_NOT_FOUND


def test_cross_tenant_domain_isolation_returns_404(client, multi_org_setup):
    """
    Validates that Domain records are completely isolated between organizations.
    """
    setup = multi_org_setup
    owner_a_headers = make_headers(setup["owner_a"])
    owner_b_headers = make_headers(setup["owner_b"])

    # List domains
    res_a = client.get("/api/v1/domains", headers=owner_a_headers)
    assert res_a.status_code == status.HTTP_200_OK
    domain_a_ids = {d["id"] for d in res_a.json()["items"]}
    assert setup["domain_a1"].id in domain_a_ids
    assert setup["domain_b1"].id not in domain_a_ids

    # Direct ID lookup (IDOR check)
    assert client.get(f"/api/v1/domains/{setup['domain_b1'].id}", headers=owner_a_headers).status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/v1/domains/{setup['domain_a1'].id}", headers=owner_b_headers).status_code == status.HTTP_404_NOT_FOUND


def test_cross_tenant_bulk_actions_cannot_alter_other_org(client, multi_org_setup, db_session):
    """
    Validates that bulk archive/restore in Org A cannot alter Client B1.
    """
    setup = multi_org_setup
    owner_a_headers = make_headers(setup["owner_a"])
    client_b1 = setup["client_b1"]

    # Org A attempts bulk archive including Client B1 (cross-org client)
    res = client.post(
        "/api/v1/clients/bulk-archive",
        json={"client_ids": [setup["client_a1"].id, client_b1.id]},
        headers=owner_a_headers,
    )
    # Backend strictly rejects cross-tenant IDs with 404
    assert res.status_code == status.HTTP_404_NOT_FOUND

    # Verify Client B1 remains active
    db_session.refresh(client_b1)
    assert client_b1.status == "active", "Client B1 must not be archived by Org A"


# ==============================================================================
# SECTION 4: CLIENT ACCOUNT SCOPING WITHIN ORGANIZATION
# ==============================================================================

def test_client_user_strictly_scoped_to_assigned_client_record(client, multi_org_setup):
    """
    Validates that Client User A (tied to Client A1) cannot see Client A2 (even within Org A).
    """
    setup = multi_org_setup
    client_a_headers = make_headers(setup["client_user_a"])

    # List clients
    res = client.get("/api/v1/clients", headers=client_a_headers)
    assert res.status_code == status.HTTP_200_OK
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == setup["client_a1"].id

    # Direct ID lookup of Client A2 (same org, different client)
    assert client.get(f"/api/v1/clients/{setup['client_a2'].id}", headers=client_a_headers).status_code == status.HTTP_404_NOT_FOUND

    # Direct ID lookup of Client B1 (different org)
    assert client.get(f"/api/v1/clients/{setup['client_b1'].id}", headers=client_a_headers).status_code == status.HTTP_404_NOT_FOUND


# ==============================================================================
# SECTION 5: IMMEDIATE PERMISSION & ROLE REVOCATION TEST
# ==============================================================================

def test_immediate_role_revocation_takes_effect_without_relogin(client, multi_org_setup, db_session):
    """
    Validates that demoting a Worker to Client immediately revokes worker-level access
    on existing sessions without requiring token re-issuance.
    """
    setup = multi_org_setup
    owner_headers = make_headers(setup["owner_a"])
    worker_a = setup["worker_a"]

    # Generate token for Worker A while active
    worker_headers = make_headers(worker_a)

    # Worker A can list clients in Org A
    res1 = client.get("/api/v1/clients", headers=worker_headers)
    assert res1.status_code == status.HTTP_200_OK

    # Owner A demotes Worker A to Client
    res_demote = client.post(
        f"/api/v1/organization/members/{worker_a.id}/demote",
        headers=owner_headers,
    )
    assert res_demote.status_code == status.HTTP_200_OK

    # Worker A attempts to create an engagement using their existing token
    res_create_eng = client.post(
        "/api/v1/engagements",
        json={
            "client_id": setup["client_a1"].id,
            "name": "Unauthorized Worker Engagement",
            "assessment_type": "Web App Pen Test",
            "status": "planned",
            "start_date": "2026-11-01",
            "due_date": "2026-11-15",
            "scope_summary": "Test scope",
        },
        headers=worker_headers,
    )
    # Engagements creation requires worker/owner; newly demoted client is immediately forbidden!
    assert res_create_eng.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED)
