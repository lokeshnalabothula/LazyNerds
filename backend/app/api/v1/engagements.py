from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_employee_or_founder
from app.db.session import get_db
from app.models.client import Client
from app.models.user import User
from app.schemas.engagement import (
    EngagementCreate,
    EngagementListResponse,
    EngagementOut,
    EngagementUpdate,
)
from app.services.engagement_service import (
    SORT_FIELDS_ALLOWLIST,
    archive_engagement,
    create_engagement,
    get_engagement_by_id,
    list_engagements,
    restore_engagement,
    update_engagement,
)

router = APIRouter()


@router.get("", response_model=EngagementListResponse)
def read_engagements(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for name, description, scope, or client"),
    status_filter: Optional[str] = Query(None, alias="status", description="Status filter: draft, planned, in_progress, on_hold, completed, cancelled, or all"),
    assessment_type: Optional[str] = Query(None, description="Assessment type filter"),
    client_id: Optional[str] = Query(None, description="Filter by client UUID"),
    authorization_status: Optional[str] = Query(None, description="Filter by authorization status: not_confirmed, pending, confirmed"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", description="Sort direction: asc or desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns a paginated list of engagement records with search and filtering.
    Requires an authenticated user session. Enforces organization isolation for clients.
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

    # Scoping for client role: clients only see their own organization's engagements
    if current_user.role == "client":
        if not current_user.client_id:
            return EngagementListResponse(
                items=[], total=0, page=page, page_size=page_size, total_pages=0
            )
        client_id = current_user.client_id

    items, total, total_pages = list_engagements(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        status=status_filter,
        assessment_type=assessment_type,
        client_id=client_id,
        authorization_status=authorization_status,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return EngagementListResponse(
        items=[EngagementOut.model_validate(e) for e in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=EngagementOut, status_code=status.HTTP_201_CREATED)
def create_new_engagement(
    engagement_in: EngagementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    """
    Creates a new engagement linked to a valid client.
    Transactionally committed in PostgreSQL. Restricted to employees and founders.
    """
    if current_user.role == "employee":
        client = db.query(Client).filter(Client.id == engagement_in.client_id).first()
        if client and client.assigned_employee_id and client.assigned_employee_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not assigned to this client record.",
            )

    try:
        new_engagement = create_engagement(db, engagement_in=engagement_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return EngagementOut.model_validate(new_engagement)


@router.get("/{engagement_id}", response_model=EngagementOut)
def read_engagement_by_id(
    engagement_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetches a specific engagement by UUID.
    Enforces tenant scoping for client accounts.
    """
    engagement = get_engagement_by_id(db, engagement_id=engagement_id)
    if not engagement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This engagement could not be found.",
        )

    if current_user.role == "client" and engagement.client_id != current_user.client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not authorized to view another organization's engagement.",
        )

    return EngagementOut.model_validate(engagement)


@router.patch("/{engagement_id}", response_model=EngagementOut)
def update_existing_engagement(
    engagement_id: str,
    engagement_in: EngagementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    """
    Performs a partial update of an engagement record.
    Restricted to internal staff (employees and founders).
    """
    if engagement_in.status is not None:
        try:
            bind = db.get_bind()
            eng_lock = db.query(Engagement.id).filter(Engagement.id == engagement_id)
            if bind and bind.dialect.name == "postgresql":
                eng_lock = eng_lock.with_for_update()
            else:
                eng_lock = eng_lock.with_for_update()
            eng_lock.first()
        except Exception:
            pass

    engagement = get_engagement_by_id(db, engagement_id=engagement_id)
    if not engagement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This engagement could not be found.",
        )

    if current_user.role == "employee" and engagement.client and engagement.client.assigned_employee_id and engagement.client.assigned_employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not assigned to this client record.",
        )

    try:
        updated = update_engagement(db, engagement=engagement, engagement_in=engagement_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return EngagementOut.model_validate(updated)


@router.post("/{engagement_id}/archive", response_model=EngagementOut)
def archive_existing_engagement(
    engagement_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    """
    Cancels/archives an engagement record, preserving audit history.
    """
    try:
        bind = db.get_bind()
        eng_lock = db.query(Engagement.id).filter(Engagement.id == engagement_id)
        if bind and bind.dialect.name == "postgresql":
            eng_lock = eng_lock.with_for_update()
        else:
            eng_lock = eng_lock.with_for_update()
        eng_lock.first()
    except Exception:
        pass

    engagement = get_engagement_by_id(db, engagement_id=engagement_id)
    if not engagement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This engagement could not be found.",
        )

    if current_user.role == "employee" and engagement.client and engagement.client.assigned_employee_id and engagement.client.assigned_employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not assigned to this client record.",
        )

    try:
        archived = archive_engagement(db, engagement=engagement)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return EngagementOut.model_validate(archived)


@router.post("/{engagement_id}/restore", response_model=EngagementOut)
def restore_existing_engagement(
    engagement_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    """
    Reopens a cancelled engagement back to draft status for replanning.
    """
    engagement = get_engagement_by_id(db, engagement_id=engagement_id)
    if not engagement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This engagement could not be found.",
        )

    if current_user.role == "employee" and engagement.client and engagement.client.assigned_employee_id and engagement.client.assigned_employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not assigned to this client record.",
        )

    try:
        restored = restore_engagement(db, engagement=engagement)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return EngagementOut.model_validate(restored)
