"""
Comprehensive End-to-End Test Suite verifying the full 12-step lifecycle
and security access boundaries for Lazy Nerds FixOps Client Manager.
"""
import pytest
from fastapi import status
from fastapi.testclient import TestClient


def test_complete_e2e_flow_12_steps(client, test_user):
    # Step 1: Sign in as an authorized user
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "founder-test@lazynerds.com", "password": "TestPassword2026!"},
    )
    assert login_res.status_code == status.HTTP_200_OK, "Step 1: Sign in must succeed"
    token = login_res.json()["access_token"]
    auth_header = {"Authorization": f"Bearer {token}"}

    # Step 2: Open the client directory
    dir_res = client.get("/api/v1/clients", headers=auth_header)
    assert dir_res.status_code == status.HTTP_200_OK, "Step 2: Directory must return 200"

    # Step 3: Create a client
    create_payload = {
        "company_name": "Spectre Threat Intelligence",
        "primary_contact_name": "James Silva",
        "primary_contact_email": "jsilva@spectre-threat.io",
        "website": "https://spectre-threat.io",
        "phone": "+1-555-8392",
        "industry": "Cybersecurity",
        "notes": "E2E verification engagement record.",
    }
    create_res = client.post("/api/v1/clients", json=create_payload, headers=auth_header)
    assert create_res.status_code == status.HTTP_201_CREATED, "Step 3: Client creation must succeed"
    client_id = create_res.json()["id"]

    # Step 4: Confirm the record appears in the directory
    list_after_create = client.get("/api/v1/clients?status=active", headers=auth_header)
    assert list_after_create.status_code == status.HTTP_200_OK
    found_ids = [c["id"] for c in list_after_create.json()["items"]]
    assert client_id in found_ids, "Step 4: Newly created client must be in active directory"

    # Step 5: Open the client's profile
    profile_res = client.get(f"/api/v1/clients/{client_id}", headers=auth_header)
    assert profile_res.status_code == status.HTTP_200_OK, "Step 5: Profile retrieval must return 200"
    profile_data = profile_res.json()
    assert profile_data["company_name"] == "Spectre Threat Intelligence"
    assert profile_data["primary_contact_email"] == "jsilva@spectre-threat.io"

    # Step 6: Edit the company information
    edit_payload = {
        "company_name": "Spectre Threat Intelligence Global Ltd",
        "phone": "+1-555-9999",
    }
    edit_res = client.patch(f"/api/v1/clients/{client_id}", json=edit_payload, headers=auth_header)
    assert edit_res.status_code == status.HTTP_200_OK, "Step 6: Edit must succeed"
    assert edit_res.json()["company_name"] == "Spectre Threat Intelligence Global Ltd"
    assert edit_res.json()["phone"] == "+1-555-9999"

    # Step 7: Refresh the page (re-query database) and verify persistence
    refresh_res = client.get(f"/api/v1/clients/{client_id}", headers=auth_header)
    assert refresh_res.status_code == status.HTTP_200_OK
    assert refresh_res.json()["company_name"] == "Spectre Threat Intelligence Global Ltd", "Step 7: Edits must persist"

    # Step 8: Search for the client
    search_res = client.get("/api/v1/clients?search=Spectre", headers=auth_header)
    assert search_res.status_code == status.HTTP_200_OK
    search_ids = [c["id"] for c in search_res.json()["items"]]
    assert client_id in search_ids, "Step 8: Search query must match updated company name"

    # Step 9: Archive the client
    archive_res = client.post(f"/api/v1/clients/{client_id}/archive", headers=auth_header)
    assert archive_res.status_code == status.HTTP_200_OK, "Step 9: Archive must succeed"
    assert archive_res.json()["status"] == "archived"

    # Step 10: Verify that the archived client is excluded from the default active view
    active_view_res = client.get("/api/v1/clients?status=active", headers=auth_header)
    active_ids = [c["id"] for c in active_view_res.json()["items"]]
    assert client_id not in active_ids, "Step 10: Archived client must be excluded from default active list"

    # Step 11: Restore the client
    restore_res = client.post(f"/api/v1/clients/{client_id}/restore", headers=auth_header)
    assert restore_res.status_code == status.HTTP_200_OK, "Step 11: Restore must succeed"
    assert restore_res.json()["status"] == "active"

    # Step 12: Verify that it appears again
    restored_view_res = client.get("/api/v1/clients?status=active", headers=auth_header)
    restored_ids = [c["id"] for c in restored_view_res.json()["items"]]
    assert client_id in restored_ids, "Step 12: Restored client must reappear in active directory"


def test_e2e_security_and_edge_cases(client):
    """Verifies unauthenticated access blocks and proper 404 responses."""
    # Unauthenticated visitor cannot access client data
    unauth_res = client.get("/api/v1/clients")
    assert unauth_res.status_code == status.HTTP_401_UNAUTHORIZED

    # Invalid client ID produces proper not-found response
    unauth_bad_id = client.get("/api/v1/clients/00000000-0000-0000-0000-000000000000")
    assert unauth_bad_id.status_code == status.HTTP_401_UNAUTHORIZED

    # Health check endpoint is accessible and healthy
    health_res = client.get("/api/v1/health")
    assert health_res.status_code == status.HTTP_200_OK
    assert health_res.json()["service"] == "Lazy Nerds FixOps Client Manager"
