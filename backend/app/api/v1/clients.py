from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.client import (
    ClientCreate,
    ClientListResponse,
    ClientOut,
    ClientUpdate,
)
from app.services.client_service import (
    SORT_FIELDS_ALLOWLIST,
    archive_client,
    create_client,
    get_client_by_id,
    list_clients,
    restore_client,
    update_client,
)

router = APIRouter()


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
    Requires an authenticated user session.
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
    current_user: User = Depends(get_current_user),
):
    """
    Creates a new client record.
    Transactionally committed in PostgreSQL.
    """
    new_client = create_client(db, client_in=client_in)
    return ClientOut.model_validate(new_client)


@router.get("/{client_id}", response_model=ClientOut)
def read_client_by_id(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetches a specific client profile by UUID.
    Returns 404 if not found.
    """
    client = get_client_by_id(db, client_id=client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This client could not be found.",
        )
    return ClientOut.model_validate(client)


@router.patch("/{client_id}", response_model=ClientOut)
def update_existing_client(
    client_id: str,
    client_in: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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

    updated = update_client(db, client=client, client_in=client_in)
    return ClientOut.model_validate(updated)


@router.post("/{client_id}/archive", response_model=ClientOut)
def archive_existing_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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

    archived = archive_client(db, client=client)
    return ClientOut.model_validate(archived)


@router.post("/{client_id}/restore", response_model=ClientOut)
def restore_existing_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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

    restored = restore_client(db, client=client)
    return ClientOut.model_validate(restored)
