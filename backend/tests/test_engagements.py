import time
from datetime import date, timedelta
from app.models.client import Client
from app.schemas.client import ClientCreate
from app.services.client_service import create_client, archive_client


def _create_test_client(db_session, company_name="CyberAcme Defense Corp"):
    client_in = ClientCreate(
        company_name=company_name,
        primary_contact_name="Alice Security",
        primary_contact_email="alice@cyberacme.com",
    )
    return create_client(db_session, client_in)


def test_unauthorized_endpoints(client):
    """Protected engagement endpoints must strictly reject unauthenticated calls."""
    res_list = client.get("/api/v1/engagements")
    assert res_list.status_code == 401

    res_create = client.post("/api/v1/engagements", json={})
    assert res_create.status_code == 401

    res_get = client.get("/api/v1/engagements/some-uuid")
    assert res_get.status_code == 401

    res_patch = client.patch("/api/v1/engagements/some-uuid", json={})
    assert res_patch.status_code == 401

    res_archive = client.post("/api/v1/engagements/some-uuid/archive")
    assert res_archive.status_code == 401

    res_restore = client.post("/api/v1/engagements/some-uuid/restore")
    assert res_restore.status_code == 401


def test_create_engagement_success(auth_client, db_session):
    """Creates a valid engagement and returns fully populated response."""
    test_client = _create_test_client(db_session)

    payload = {
        "client_id": test_client.id,
        "name": "Q4 Web App Pen Test",
        "assessment_type": "Web App Pen Test",
        "status": "draft",
        "start_date": "2026-11-01",
        "due_date": "2026-11-15",
        "description": "Black-box penetration test for web applications.",
        "scope_summary": "https://app.cyberacme.com, https://api.cyberacme.com",
        "authorization_status": "not_confirmed",
        "assigned_to": "assessor@lazynerds.com",
    }
    response = auth_client.post("/api/v1/engagements", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["name"] == "Q4 Web App Pen Test"
    assert data["client_id"] == test_client.id
    assert data["client_company_name"] == "CyberAcme Defense Corp"
    assert data["assessment_type"] == "Web App Pen Test"
    assert data["status"] == "draft"
    assert data["start_date"] == "2026-11-01"
    assert data["due_date"] == "2026-11-15"
    assert data["authorization_status"] == "not_confirmed"
    assert data["created_at"].endswith("Z")
    assert data["updated_at"].endswith("Z")


def test_create_engagement_invalid_client(auth_client):
    """Rejects engagement creation when referenced client does not exist."""
    payload = {
        "client_id": "00000000-0000-0000-0000-000000000000",
        "name": "Ghost Engagement",
        "assessment_type": "Security Audit",
    }
    response = auth_client.post("/api/v1/engagements", json=payload)
    assert response.status_code == 400
    assert "does not exist" in response.json()["detail"]


def test_create_engagement_archived_client(auth_client, db_session):
    """Rejects engagement creation for an archived client."""
    test_client = _create_test_client(db_session, company_name="Archived Target Corp")
    archive_client(db_session, test_client)

    payload = {
        "client_id": test_client.id,
        "name": "Archived Client Engagement",
        "assessment_type": "Cloud Security Assessment",
    }
    response = auth_client.post("/api/v1/engagements", json=payload)
    assert response.status_code == 400
    assert "archived" in response.json()["detail"].lower()


def test_create_engagement_empty_name(auth_client, db_session):
    """Rejects empty or whitespace-only engagement name."""
    test_client = _create_test_client(db_session)
    payload = {
        "client_id": test_client.id,
        "name": "   ",
        "assessment_type": "Web App Pen Test",
    }
    response = auth_client.post("/api/v1/engagements", json=payload)
    assert response.status_code in [400, 422]


def test_create_engagement_invalid_assessment_type(auth_client, db_session):
    """Rejects unsupported assessment types."""
    test_client = _create_test_client(db_session)
    payload = {
        "client_id": test_client.id,
        "name": "Invalid Assessment Type Test",
        "assessment_type": "Arbitrary Hackathon Type",
    }
    response = auth_client.post("/api/v1/engagements", json=payload)
    assert response.status_code in [400, 422]


def test_create_engagement_invalid_date_order(auth_client, db_session):
    """Rejects engagements where due_date precedes start_date."""
    test_client = _create_test_client(db_session)
    payload = {
        "client_id": test_client.id,
        "name": "Time Travel Engagement",
        "assessment_type": "External Network Pen Test",
        "start_date": "2026-11-20",
        "due_date": "2026-11-10",
    }
    response = auth_client.post("/api/v1/engagements", json=payload)
    assert response.status_code in [400, 422]
    error_detail = str(response.json())
    assert "precede" in error_detail.lower()


def test_create_engagement_custom_timestamp(auth_client, db_session):
    """Accepts timezone-aware created_at and normalizes to UTC."""
    test_client = _create_test_client(db_session)
    custom_ts = "2026-05-10T15:30:00+05:30"
    payload = {
        "client_id": test_client.id,
        "name": "Historical Onboarded Engagement",
        "assessment_type": "Security Audit",
        "created_at": custom_ts,
    }
    response = auth_client.post("/api/v1/engagements", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["created_at"] == "2026-05-10T10:00:00Z"


def test_created_at_is_immutable_after_creation(auth_client, db_session):
    """Ensures created_at and client_id cannot be overwritten via update."""
    test_client = _create_test_client(db_session)
    create_res = auth_client.post(
        "/api/v1/engagements",
        json={
            "client_id": test_client.id,
            "name": "Immutable Field Test",
            "assessment_type": "Vulnerability Assessment",
        },
    )
    engagement_id = create_res.json()["id"]
    original_created_at = create_res.json()["created_at"]

    patch_res = auth_client.patch(
        f"/api/v1/engagements/{engagement_id}",
        json={
            "created_at": "1999-01-01T00:00:00Z",
            "client_id": "malicious-client-replacement-id",
            "name": "Renamed Test",
        },
    )
    assert patch_res.status_code == 200
    patched_data = patch_res.json()
    assert patched_data["created_at"] == original_created_at
    assert patched_data["client_id"] == test_client.id
    assert patched_data["name"] == "Renamed Test"


def test_updated_at_only_advances_on_successful_modification(auth_client, db_session):
    """updated_at is updated only when real changes occur."""
    test_client = _create_test_client(db_session)
    create_res = auth_client.post(
        "/api/v1/engagements",
        json={
            "client_id": test_client.id,
            "name": "Timestamp Modification Test",
            "assessment_type": "Configuration Review",
        },
    )
    engagement_id = create_res.json()["id"]
    original_updated_at = create_res.json()["updated_at"]

    time.sleep(0.05)

    # Patch with identical data
    noop_res = auth_client.patch(
        f"/api/v1/engagements/{engagement_id}",
        json={"name": "Timestamp Modification Test"},
    )
    assert noop_res.status_code == 200
    assert noop_res.json()["updated_at"] == original_updated_at

    # Patch with real modification
    real_res = auth_client.patch(
        f"/api/v1/engagements/{engagement_id}",
        json={"name": "Updated Timestamp Modification Test"},
    )
    assert real_res.status_code == 200
    assert real_res.json()["updated_at"] != original_updated_at


def test_get_engagement_by_id(auth_client, db_session):
    """Fetches engagement profile by UUID."""
    test_client = _create_test_client(db_session, company_name="Omega Bank InfoSec")
    create_res = auth_client.post(
        "/api/v1/engagements",
        json={
            "client_id": test_client.id,
            "name": "Omega Core Banking Pen Test",
            "assessment_type": "Internal Network Pen Test",
        },
    )
    engagement_id = create_res.json()["id"]

    get_res = auth_client.get(f"/api/v1/engagements/{engagement_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == engagement_id
    assert get_res.json()["client_company_name"] == "Omega Bank InfoSec"


def test_get_engagement_unknown_id(auth_client):
    """Returns 404 for nonexistent engagement."""
    res = auth_client.get("/api/v1/engagements/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404
    assert "could not be found" in res.json()["detail"].lower()


def test_lifecycle_status_transitions(auth_client, db_session):
    """Validates operational lifecycle rules."""
    test_client = _create_test_client(db_session)
    create_res = auth_client.post(
        "/api/v1/engagements",
        json={
            "client_id": test_client.id,
            "name": "Lifecycle Engine Test",
            "assessment_type": "Red Team Assessment",
            "status": "draft",
        },
    )
    eng_id = create_res.json()["id"]

    # Draft -> Planned (Valid)
    res_planned = auth_client.patch(f"/api/v1/engagements/{eng_id}", json={"status": "planned"})
    assert res_planned.status_code == 200
    assert res_planned.json()["status"] == "planned"

    # Planned -> In Progress (Valid)
    res_in_prog = auth_client.patch(f"/api/v1/engagements/{eng_id}", json={"status": "in_progress"})
    assert res_in_prog.status_code == 200
    assert res_in_prog.json()["status"] == "in_progress"

    # In Progress -> Completed (Valid)
    res_comp = auth_client.patch(f"/api/v1/engagements/{eng_id}", json={"status": "completed"})
    assert res_comp.status_code == 200
    assert res_comp.json()["status"] == "completed"

    # Completed -> In Progress (Invalid terminal status)
    res_invalid = auth_client.patch(f"/api/v1/engagements/{eng_id}", json={"status": "in_progress"})
    assert res_invalid.status_code == 400
    assert "Invalid status transition" in res_invalid.json()["detail"]


def test_archive_and_restore_engagement(auth_client, db_session):
    """Tests archival to cancelled and reopening back to draft."""
    test_client = _create_test_client(db_session)
    create_res = auth_client.post(
        "/api/v1/engagements",
        json={
            "client_id": test_client.id,
            "name": "Archive Lifecycle Target",
            "assessment_type": "Security Audit",
            "status": "draft",
        },
    )
    eng_id = create_res.json()["id"]

    # Archive
    arch_res = auth_client.post(f"/api/v1/engagements/{eng_id}/archive")
    assert arch_res.status_code == 200
    assert arch_res.json()["status"] == "cancelled"

    # Restore
    rest_res = auth_client.post(f"/api/v1/engagements/{eng_id}/restore")
    assert rest_res.status_code == 200
    assert rest_res.json()["status"] == "draft"


def test_completed_engagement_cannot_be_archived_or_restored(auth_client, db_session):
    """Verifies that a completed engagement is terminal and cannot be archived, cancelled, or restored."""
    test_client = _create_test_client(db_session)
    create_res = auth_client.post(
        "/api/v1/engagements",
        json={
            "client_id": test_client.id,
            "name": "Terminal Completed Engagement Target",
            "assessment_type": "Security Audit",
            "status": "draft",
        },
    )
    eng_id = create_res.json()["id"]

    # Transition Draft -> Planned -> In Progress -> Completed
    auth_client.patch(f"/api/v1/engagements/{eng_id}", json={"status": "planned"})
    auth_client.patch(f"/api/v1/engagements/{eng_id}", json={"status": "in_progress"})
    comp_res = auth_client.patch(f"/api/v1/engagements/{eng_id}", json={"status": "completed"})
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "completed"

    # Attempt to archive completed engagement -> Must fail with 400 Bad Request
    arch_res = auth_client.post(f"/api/v1/engagements/{eng_id}/archive")
    assert arch_res.status_code == 400
    assert "Cannot archive or cancel a completed engagement" in arch_res.json()["detail"]

    # Attempt to patch status directly to cancelled -> Must fail with 400 Bad Request
    patch_res = auth_client.patch(f"/api/v1/engagements/{eng_id}", json={"status": "cancelled"})
    assert patch_res.status_code == 400
    assert "Invalid status transition" in patch_res.json()["detail"]

    # Attempt to restore completed engagement -> Must fail with 400 Bad Request
    rest_res = auth_client.post(f"/api/v1/engagements/{eng_id}/restore")
    assert rest_res.status_code == 400
    assert "Cannot restore a completed engagement" in rest_res.json()["detail"]

    # Confirm status is preserved as completed
    get_res = auth_client.get(f"/api/v1/engagements/{eng_id}")
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "completed"


def test_list_engagements_filtering_and_search(auth_client, db_session):
    """Verifies listing, search across name & client company, and multi-field filtering."""
    client_a = _create_test_client(db_session, company_name="Alpha Global FinTech")
    client_b = _create_test_client(db_session, company_name="Beta Healthcare Systems")

    auth_client.post(
        "/api/v1/engagements",
        json={
            "client_id": client_a.id,
            "name": "Alpha SOC2 Readiness Assessment",
            "assessment_type": "Security Audit",
            "status": "planned",
            "authorization_status": "confirmed",
        },
    )
    auth_client.post(
        "/api/v1/engagements",
        json={
            "client_id": client_b.id,
            "name": "Beta API Vulnerability Assessment",
            "assessment_type": "API Security Assessment",
            "status": "in_progress",
            "authorization_status": "pending",
        },
    )

    # Search by engagement name
    res_search_name = auth_client.get("/api/v1/engagements?search=SOC2")
    assert res_search_name.status_code == 200
    assert len(res_search_name.json()["items"]) == 1
    assert res_search_name.json()["items"][0]["name"] == "Alpha SOC2 Readiness Assessment"

    # Search by client company name
    res_search_client = auth_client.get("/api/v1/engagements?search=Healthcare")
    assert res_search_client.status_code == 200
    assert len(res_search_client.json()["items"]) == 1
    assert res_search_client.json()["items"][0]["client_company_name"] == "Beta Healthcare Systems"

    # Filter by client_id
    res_filter_client = auth_client.get(f"/api/v1/engagements?client_id={client_a.id}")
    assert res_filter_client.status_code == 200
    for item in res_filter_client.json()["items"]:
        assert item["client_id"] == client_a.id

    # Filter by assessment_type
    res_filter_type = auth_client.get("/api/v1/engagements?assessment_type=API Security Assessment")
    assert res_filter_type.status_code == 200
    assert len(res_filter_type.json()["items"]) == 1
    assert res_filter_type.json()["items"][0]["assessment_type"] == "API Security Assessment"

    # Filter by status
    res_filter_status = auth_client.get("/api/v1/engagements?status=in_progress")
    assert res_filter_status.status_code == 200
    for item in res_filter_status.json()["items"]:
        assert item["status"] == "in_progress"


def test_sorting_and_allowlist(auth_client, db_session):
    """Verifies strict sorting allowlist and direction control."""
    client_a = _create_test_client(db_session, company_name="Sort Test Client")
    auth_client.post(
        "/api/v1/engagements",
        json={
            "client_id": client_a.id,
            "name": "AAA Engagement",
            "assessment_type": "Vulnerability Assessment",
        },
    )
    auth_client.post(
        "/api/v1/engagements",
        json={
            "client_id": client_a.id,
            "name": "ZZZ Engagement",
            "assessment_type": "Vulnerability Assessment",
        },
    )

    # Valid sort asc
    res_asc = auth_client.get("/api/v1/engagements?sort_by=name&sort_order=asc")
    assert res_asc.status_code == 200
    items = res_asc.json()["items"]
    assert items[0]["name"] <= items[-1]["name"]

    # Invalid sort field
    res_bad_sort = auth_client.get("/api/v1/engagements?sort_by=nonexistent_column")
    assert res_bad_sort.status_code == 400
    assert "Invalid sort field" in res_bad_sort.json()["detail"]

    # Invalid sort order
    res_bad_order = auth_client.get("/api/v1/engagements?sort_order=sideways")
    assert res_bad_order.status_code == 400
    assert "Sort order must be 'asc' or 'desc'" in res_bad_order.json()["detail"]
