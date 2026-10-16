"""
End-to-end integration test verifying Section 23 28-step acceptance scenario
for Lazy Nerds FixOps Phase 2 Engagement Management.
"""
import time
import pytest
from fastapi import status


def test_complete_engagement_acceptance_scenario_28_steps(client, test_user):
    # Step 1: Log in using the existing authentication flow
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "founder-test@lazynerds.com", "password": "TestPassword2026!"},
    )
    assert login_res.status_code == status.HTTP_200_OK, "Step 1: Auth login must succeed"
    token = login_res.json()["access_token"]
    auth_header = {"Authorization": f"Bearer {token}"}

    # Step 2: Open the Engagements directory
    dir_res = client.get("/api/v1/engagements", headers=auth_header)
    assert dir_res.status_code == status.HTTP_200_OK, "Step 2: Directory must return 200"

    # Step 3 & 4: Load and select an existing eligible client
    client_res = client.post(
        "/api/v1/clients",
        json={
            "company_name": "Acme Cyber Defense Corp",
            "primary_contact_name": "Sarah Connor",
            "primary_contact_email": "sconnor@acme-cyber.com",
            "website": "https://acme-cyber.com",
        },
        headers=auth_header,
    )
    assert client_res.status_code == status.HTTP_201_CREATED, "Step 4: Active client creation must succeed"
    client_id = client_res.json()["id"]

    # Step 5 - 10: Create Engagement with name, type, dates, status, authorization
    create_payload = {
        "client_id": client_id,
        "name": "Q4 Web Application Penetration Test",
        "assessment_type": "Web App Pen Test",
        "start_date": "2026-11-01",
        "due_date": "2026-11-15",
        "status": "draft",
        "authorization_status": "not_confirmed",
        "description": "Black-box pentest of client web assets.",
        "scope_summary": "https://portal.acme-cyber.com, https://api.acme-cyber.com",
        "assigned_to": "assessor@lazynerds.com",
    }
    create_res = client.post("/api/v1/engagements", json=create_payload, headers=auth_header)
    assert create_res.status_code == status.HTTP_201_CREATED, "Step 10: Submission must succeed"
    eng_data = create_res.json()
    eng_id = eng_data["id"]

    # Step 11: Verify the backend persists the engagement
    assert eng_data["name"] == "Q4 Web Application Penetration Test"
    assert eng_data["client_id"] == client_id
    assert eng_data["client_company_name"] == "Acme Cyber Defense Corp"
    assert eng_data["assessment_type"] == "Web App Pen Test"
    assert eng_data["status"] == "draft"
    assert eng_data["authorization_status"] == "not_confirmed"
    assert eng_data["created_at"].endswith("Z")
    assert eng_data["updated_at"].endswith("Z")

    # Step 12: Verify the new engagement appears in the directory
    list_res = client.get("/api/v1/engagements", headers=auth_header)
    assert list_res.status_code == status.HTTP_200_OK
    dir_ids = [e["id"] for e in list_res.json()["items"]]
    assert eng_id in dir_ids, "Step 12: New engagement must be present in directory"

    # Step 13: Refresh the page (re-query database) and confirm it remains
    refresh_res = client.get(f"/api/v1/engagements/{eng_id}", headers=auth_header)
    assert refresh_res.status_code == status.HTTP_200_OK
    assert refresh_res.json()["name"] == "Q4 Web Application Penetration Test", "Step 13: Must persist after re-query"

    # Step 14 & 15: Open detail page and verify linked client and all fields
    detail = refresh_res.json()
    assert detail["client_id"] == client_id
    assert detail["client_company_name"] == "Acme Cyber Defense Corp"
    assert detail["scope_summary"] == "https://portal.acme-cyber.com, https://api.acme-cyber.com"
    initial_created_at = detail["created_at"]
    initial_updated_at = detail["updated_at"]

    time.sleep(0.05)

    # Step 16 & 17: Edit the engagement name, save, and verify updated value persists
    edit_payload = {"name": "Q4 Web Application & API Security Assessment"}
    patch_res = client.patch(f"/api/v1/engagements/{eng_id}", json=edit_payload, headers=auth_header)
    assert patch_res.status_code == status.HTTP_200_OK, "Step 16: Patch must succeed"
    updated_data = patch_res.json()
    assert updated_data["name"] == "Q4 Web Application & API Security Assessment"

    # Step 18: Verify created_at remains unchanged and updated_at advances
    assert updated_data["created_at"] == initial_created_at, "Step 18: created_at must be immutable"
    assert updated_data["updated_at"] != initial_updated_at, "Step 18: updated_at must advance on real modification"

    # Step 19: Search for the engagement by name
    search_res = client.get("/api/v1/engagements?search=API+Security", headers=auth_header)
    assert search_res.status_code == status.HTTP_200_OK
    search_ids = [e["id"] for e in search_res.json()["items"]]
    assert eng_id in search_ids, "Step 19: Search by name must return engagement"

    # Step 20: Filter by its status and assessment type
    filter_res = client.get(
        "/api/v1/engagements?status=draft&assessment_type=Web+App+Pen+Test",
        headers=auth_header,
    )
    assert filter_res.status_code == status.HTTP_200_OK
    filter_ids = [e["id"] for e in filter_res.json()["items"]]
    assert eng_id in filter_ids, "Step 20: Filter by status & type must match"

    # Step 21 & 22: Navigate to client profile and verify engagement appears in client's engagement list
    client_engs_res = client.get(f"/api/v1/engagements?client_id={client_id}", headers=auth_header)
    assert client_engs_res.status_code == status.HTTP_200_OK
    client_eng_ids = [e["id"] for e in client_engs_res.json()["items"]]
    assert eng_id in client_eng_ids, "Step 22: Engagement must appear in client's engagement list"

    # Step 23: Open a nonexistent engagement ID and verify a proper not-found response
    bad_id_res = client.get("/api/v1/engagements/00000000-0000-0000-0000-000000000000", headers=auth_header)
    assert bad_id_res.status_code == status.HTTP_404_NOT_FOUND, "Step 23: Unknown ID must return 404"
    assert "could not be found" in bad_id_res.json()["detail"].lower()

    # Step 24: Submit an invalid date combination and verify validation
    bad_date_payload = {
        "client_id": client_id,
        "name": "Invalid Date Engagement",
        "assessment_type": "Cloud Security Assessment",
        "start_date": "2026-11-20",
        "due_date": "2026-11-10",
    }
    bad_date_res = client.post("/api/v1/engagements", json=bad_date_payload, headers=auth_header)
    assert bad_date_res.status_code in [400, 422], "Step 24: Invalid date combination must be rejected"

    # Step 25: Attempt protected API access without authentication and verify denial
    client.cookies.clear()
    unauth_res = client.get("/api/v1/engagements")
    assert unauth_res.status_code == status.HTTP_401_UNAUTHORIZED, "Step 25: Unauthenticated access denied"

    # Step 26: Verify that an invalid client reference cannot be persisted
    bad_client_payload = {
        "client_id": "00000000-0000-0000-0000-000000000000",
        "name": "Orphan Engagement",
        "assessment_type": "Security Audit",
    }
    bad_client_res = client.post("/api/v1/engagements", json=bad_client_payload, headers=auth_header)
    assert bad_client_res.status_code == status.HTTP_400_BAD_REQUEST, "Step 26: Invalid client rejected"
    assert "does not exist" in bad_client_res.json()["detail"]

    # Step 27: Test archive and restore complete lifecycle
    archive_res = client.post(f"/api/v1/engagements/{eng_id}/archive", headers=auth_header)
    assert archive_res.status_code == status.HTTP_200_OK, "Step 27: Archive must succeed"
    assert archive_res.json()["status"] == "cancelled"

    restore_res = client.post(f"/api/v1/engagements/{eng_id}/restore", headers=auth_header)
    assert restore_res.status_code == status.HTTP_200_OK, "Step 27: Restore must succeed"
    assert restore_res.json()["status"] == "draft"

    # Step 28: Verify existing Client Manager workflows still pass regression
    client_check_res = client.get(f"/api/v1/clients/{client_id}", headers=auth_header)
    assert client_check_res.status_code == status.HTTP_200_OK, "Step 28: Existing client profile intact"
    assert client_check_res.json()["company_name"] == "Acme Cyber Defense Corp"
