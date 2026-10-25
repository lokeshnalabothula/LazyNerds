from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_founder, require_employee_or_founder
from app.db.session import get_db
from app.models.client import Client
from app.models.user import User
from app.schemas.client import (
    BulkArchiveRequest,
    BulkArchiveResponse,
    BulkRestoreRequest,
    BulkRestoreResponse,
    ClientCreate,
    ClientListResponse,
    ClientOut,
    ClientUpdate,
)
from app.services.client_service import (
    SORT_FIELDS_ALLOWLIST,
    archive_client,
    bulk_archive_clients,
    bulk_restore_clients,
    create_client,
    get_client_by_id,
    list_clients,
    restore_client,
    update_client,
)
from app.services.audit_service import log_audit

router = APIRouter()


class AssignClientRequest(BaseModel):
    employee_id: Optional[str] = None


@router.get("", response_model=ClientListResponse)
def read_clients(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for company name, contact, or email"),
    status_filter: Optional[str] = Query("active", alias="status", description="Status filter: active, archived, or all"),
    sort_by: str = Query("created_at", description="Field to sort by: company_name, created_at, updated_at"),
    sort_order: str = Query("desc", description="Sort direction: asc or desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns a paginated list of client records.
    Enforces role-based isolation:
    - Clients can only see their own organization.
    - Employees see assigned clients (or all approved clients if unassigned).
    - Founders see all company clients.
    """
    if sort_by not in SORT_FIELDS_ALLOWLIST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid sort field '{sort_by}'. Allowed fields: {', '.join(SORT_FIELDS_ALLOWLIST.keys())}",
        )

    if sort_order.lower() not in ["asc", "desc"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sort order must be 'asc' or 'desc'.",
        )

    items, total, total_pages = list_clients(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        status=status_filter,
        sort_by=sort_by,
        sort_order=sort_order,
        user=current_user,
    )

    return ClientListResponse(
        items=[ClientOut.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
def create_new_client(
    client_in: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    """
    Creates a new client record.
    Transactionally committed in PostgreSQL. Requires internal team membership.
    """
    new_client = create_client(db, client_in=client_in)
    log_audit(
        db=db,
        user_email=current_user.email,
        action="CREATE_CLIENT",
        resource_type="client",
        resource_id=new_client.id,
        details=f"Client '{new_client.company_name}' onboarded by {current_user.email}",
    )
    return ClientOut.model_validate(new_client)


@router.post("/bulk-archive", response_model=BulkArchiveResponse)
def bulk_archive(
    data: BulkArchiveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    """
    Bulk archives multiple selected clients transactionally.
    Preserves all historical engagements, assets, and reports.
    """
    if current_user.role == "employee":
        disallowed = db.query(Client).filter(
            Client.id.in_(data.client_ids),
            Client.assigned_employee_id.isnot(None),
            Client.assigned_employee_id != current_user.id,
        ).first()
        if disallowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not assigned to one or more selected client records.",
            )

    archived = bulk_archive_clients(db, client_ids=data.client_ids)
    for c in archived:
        log_audit(
            db=db,
            user_email=current_user.email,
            action="ARCHIVE_CLIENT",
            resource_type="client",
            resource_id=c.id,
            details=f"Client '{c.company_name}' bulk-archived by {current_user.email}",
        )
    return BulkArchiveResponse(
        archived_count=len(archived),
        client_ids=[c.id for c in archived],
        message=f"Successfully archived {len(archived)} client(s).",
    )


@router.post("/bulk-restore", response_model=BulkRestoreResponse)
def bulk_restore(
    data: BulkRestoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    """
    Bulk restores multiple archived clients to active status.
    """
    if current_user.role == "employee":
        disallowed = db.query(Client).filter(
            Client.id.in_(data.client_ids),
            Client.assigned_employee_id.isnot(None),
            Client.assigned_employee_id != current_user.id,
        ).first()
        if disallowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not assigned to one or more selected client records.",
            )

    restored = bulk_restore_clients(db, client_ids=data.client_ids)
    for c in restored:
        log_audit(
            db=db,
            user_email=current_user.email,
            action="RESTORE_CLIENT",
            resource_type="client",
            resource_id=c.id,
            details=f"Client '{c.company_name}' restored to active by {current_user.email}",
        )
    return BulkRestoreResponse(
        restored_count=len(restored),
        client_ids=[c.id for c in restored],
        message=f"Successfully restored {len(restored)} client(s).",
    )


@router.get("/{client_id}", response_model=ClientOut)
def read_client_by_id(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetches a specific client profile by UUID.
    Enforces authorization check to prevent cross-client reads.
    """
    if current_user.role == "client" and current_user.client_id != client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not authorized to view another organization's records.",
        )

    client = get_client_by_id(db, client_id=client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This client could not be found.",
        )

    if current_user.role == "employee" and client.assigned_employee_id and client.assigned_employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not assigned to this client record.",
        )

    return ClientOut.model_validate(client)


@router.patch("/{client_id}", response_model=ClientOut)
def update_existing_client(
    client_id: str,
    client_in: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    """
    Performs a partial update of a client record.
    Preserves unchanged fields and updates timestamps.
    """
    client = get_client_by_id(db, client_id=client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This client could not be found.",
        )

    if current_user.role == "employee" and client.assigned_employee_id and client.assigned_employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not assigned to this client record.",
        )

    updated = update_client(db, client=client, client_in=client_in)
    log_audit(
        db=db,
        user_email=current_user.email,
        action="UPDATE_CLIENT",
        resource_type="client",
        resource_id=updated.id,
        details=f"Client '{updated.company_name}' updated by {current_user.email}",
    )
    return ClientOut.model_validate(updated)


@router.patch("/{client_id}/assign", response_model=ClientOut)
def assign_client_employee(
    client_id: str,
    data: AssignClientRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_founder),
):
    """
    Assigns an approved client to a specific internal employee.
    Founder-only administrative operation.
    """
    client = get_client_by_id(db, client_id=client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This client could not be found.",
        )

    if data.employee_id:
        emp = db.query(User).filter(User.id == data.employee_id, User.role.in_(["employee", "founder", "admin"])).first()
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Specified employee user does not exist or lacks internal employee role.",
            )

    client.assigned_employee_id = data.employee_id
    db.commit()
    db.refresh(client)
    log_audit(
        db=db,
        user_email=current_user.email,
        action="ASSIGN_CLIENT",
        resource_type="client",
        resource_id=client.id,
        details=f"Client '{client.company_name}' assigned to user {data.employee_id or 'None'}",
    )
    return ClientOut.model_validate(client)


@router.post("/{client_id}/archive", response_model=ClientOut)
def archive_existing_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    """
    Archives a client record, preserving all identifiers and history.
    """
    client = get_client_by_id(db, client_id=client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This client could not be found.",
        )

    if current_user.role == "employee" and client.assigned_employee_id and client.assigned_employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not assigned to this client record.",
        )

    archived = archive_client(db, client=client)
    log_audit(
        db=db,
        user_email=current_user.email,
        action="ARCHIVE_CLIENT",
        resource_type="client",
        resource_id=archived.id,
        details=f"Client '{archived.company_name}' archived by {current_user.email}",
    )
    return ClientOut.model_validate(archived)


@router.post("/{client_id}/restore", response_model=ClientOut)
def restore_existing_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    """
    Restores an archived client to active status.
    """
    client = get_client_by_id(db, client_id=client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This client could not be found.",
        )

    if current_user.role == "employee" and client.assigned_employee_id and client.assigned_employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not assigned to this client record.",
        )

    restored = restore_client(db, client=client)
    log_audit(
        db=db,
        user_email=current_user.email,
        action="RESTORE_CLIENT",
        resource_type="client",
        resource_id=restored.id,
        details=f"Client '{restored.company_name}' restored to active status by {current_user.email}",
    )
    return ClientOut.model_validate(restored)

