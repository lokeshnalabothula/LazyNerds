import math
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import or_, desc, asc
from sqlalchemy.orm import Session, joinedload
from app.models.client import Client
from app.models.engagement import Engagement
from app.schemas.engagement import (
    EngagementCreate,
    EngagementUpdate,
    EngagementStatus,
    VALID_STATUS_TRANSITIONS,
)

SORT_FIELDS_ALLOWLIST = {
    "name": Engagement.name,
    "created_at": Engagement.created_at,
    "updated_at": Engagement.updated_at,
    "start_date": Engagement.start_date,
    "due_date": Engagement.due_date,
    "status": Engagement.status,
    "assessment_type": Engagement.assessment_type,
    "client_company_name": Client.company_name,
}


def list_engagements(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    search: Optional[str] = None,
    status: Optional[str] = None,
    assessment_type: Optional[str] = None,
    client_id: Optional[str] = None,
    authorization_status: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> Tuple[List[Engagement], int, int]:
    """
    Retrieves a paginated list of engagements with search, filters, and allowlisted sorting.
    Returns (items, total_count, total_pages).
    """
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 10

    query = (
        db.query(Engagement)
        .join(Client, Engagement.client_id == Client.id)
        .options(joinedload(Engagement.client))
    )

    # Filter by specific client ID
    if client_id:
        query = query.filter(Engagement.client_id == client_id.strip())

    # Filter by lifecycle status
    if status and status.lower() != "all":
        valid_status = status.lower().strip()
        query = query.filter(Engagement.status == valid_status)

    # Filter by assessment type
    if assessment_type and assessment_type.lower() != "all":
        query = query.filter(Engagement.assessment_type == assessment_type.strip())

    # Filter by authorization status
    if authorization_status and authorization_status.lower() != "all":
        query = query.filter(Engagement.authorization_status == authorization_status.lower().strip())

    # Search filtering (engagement name, description, scope summary, or client company name)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Engagement.name.ilike(search_term),
                Engagement.description.ilike(search_term),
                Engagement.scope_summary.ilike(search_term),
                Client.company_name.ilike(search_term),
            )
        )

    total_count = query.count()
    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1

    # Sorting with strict allowlist
    sort_column = SORT_FIELDS_ALLOWLIST.get(sort_by, Engagement.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    # Pagination
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()

    return items, total_count, total_pages


def get_engagement_by_id(db: Session, engagement_id: str) -> Optional[Engagement]:
    """Fetches an engagement record by ID with associated client data."""
    return (
        db.query(Engagement)
        .options(joinedload(Engagement.client))
        .filter(Engagement.id == engagement_id)
        .first()
    )


def create_engagement(db: Session, engagement_in: EngagementCreate) -> Engagement:
    """Creates a new engagement transactionally linked to an active, existing client."""
    client = db.query(Client).filter(Client.id == engagement_in.client_id).first()
    if not client:
        raise ValueError(f"Client with id '{engagement_in.client_id}' does not exist.")
    if client.status == "archived":
        raise ValueError("Cannot create an engagement for an archived client. Please restore the client first.")

    now_utc = datetime.now(timezone.utc)
    if engagement_in.created_at is not None:
        if engagement_in.created_at.tzinfo is None:
            raise ValueError("Naive timestamps without timezone information are not permitted.")
        created_ts = engagement_in.created_at.astimezone(timezone.utc)
    else:
        created_ts = now_utc

    assessment_type_val = (
        engagement_in.assessment_type.value
        if hasattr(engagement_in.assessment_type, "value")
        else str(engagement_in.assessment_type)
    )
    status_val = (
        engagement_in.status.value
        if hasattr(engagement_in.status, "value")
        else str(engagement_in.status)
    )
    auth_status_val = (
        engagement_in.authorization_status.value
        if hasattr(engagement_in.authorization_status, "value")
        else str(engagement_in.authorization_status)
    )

    engagement = Engagement(
        client_id=client.id,
        name=engagement_in.name,
        assessment_type=assessment_type_val,
        status=status_val,
        start_date=engagement_in.start_date,
        due_date=engagement_in.due_date,
        description=engagement_in.description,
        scope_summary=engagement_in.scope_summary,
        authorization_status=auth_status_val,
        assigned_to=engagement_in.assigned_to,
        created_at=created_ts,
        updated_at=now_utc,
    )
    db.add(engagement)
    db.commit()
    db.refresh(engagement)
    return engagement


def update_engagement(
    db: Session,
    engagement: Engagement,
    engagement_in: EngagementUpdate,
) -> Engagement:
    """Applies a partial update to an engagement. created_at, id, and client_id are strictly immutable."""
    update_data = engagement_in.model_dump(exclude_unset=True)
    # Immutable keys
    update_data.pop("created_at", None)
    update_data.pop("id", None)
    update_data.pop("client_id", None)

    # Validate lifecycle status transition and lock row for update
    if "status" in update_data and update_data["status"] is not None:
        new_status = update_data["status"]
        if hasattr(new_status, "value"):
            new_status = new_status.value
        update_data["status"] = new_status
        current_status = engagement.status
        allowed = VALID_STATUS_TRANSITIONS.get(current_status, {current_status})
        if new_status not in allowed:
            raise ValueError(f"Invalid status transition from '{current_status}' to '{new_status}'.")
        try:
            bind = db.get_bind()
            eng_lock = db.query(Engagement.id).filter(Engagement.id == engagement.id)
            if bind and bind.dialect.name == "postgresql":
                eng_lock = eng_lock.with_for_update()
            else:
                eng_lock = eng_lock.with_for_update()
            eng_lock.first()
        except Exception:
            pass

    # Unpack enums
    if "assessment_type" in update_data and update_data["assessment_type"] is not None:
        at = update_data["assessment_type"]
        update_data["assessment_type"] = at.value if hasattr(at, "value") else at
    if "authorization_status" in update_data and update_data["authorization_status"] is not None:
        auth_st = update_data["authorization_status"]
        update_data["authorization_status"] = auth_st.value if hasattr(auth_st, "value") else auth_st

    # Cross-field date validation against resulting values
    new_start = update_data.get("start_date", engagement.start_date)
    new_due = update_data.get("due_date", engagement.due_date)
    if new_start is not None and new_due is not None and new_due < new_start:
        raise ValueError("Due date cannot precede start date.")

    has_changes = False
    for field, value in update_data.items():
        if hasattr(engagement, field):
            current_val = getattr(engagement, field)
            if current_val != value:
                setattr(engagement, field, value)
                has_changes = True

    if has_changes:
        engagement.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(engagement)
    return engagement


def archive_engagement(db: Session, engagement: Engagement) -> Engagement:
    """Cancels/archives an engagement record. Preserves historical data."""
    try:
        bind = db.get_bind()
        eng_lock = db.query(Engagement.id).filter(Engagement.id == engagement.id)
        if bind and bind.dialect.name == "postgresql":
            eng_lock = eng_lock.with_for_update()
        else:
            eng_lock = eng_lock.with_for_update()
        eng_lock.first()
    except Exception:
        pass
    if engagement.status == EngagementStatus.COMPLETED.value:
        raise ValueError("Cannot archive or cancel a completed engagement.")
    if engagement.status != EngagementStatus.CANCELLED.value:
        engagement.status = EngagementStatus.CANCELLED.value
        engagement.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(engagement)
    return engagement


def restore_engagement(db: Session, engagement: Engagement) -> Engagement:
    """Reopens a cancelled engagement back to draft status for replanning."""
    try:
        bind = db.get_bind()
        eng_lock = db.query(Engagement.id).filter(Engagement.id == engagement.id)
        if bind and bind.dialect.name == "postgresql":
            eng_lock = eng_lock.with_for_update()
        else:
            eng_lock = eng_lock.with_for_update()
        eng_lock.first()
    except Exception:
        pass
    if engagement.status == EngagementStatus.COMPLETED.value:
        raise ValueError("Cannot restore a completed engagement.")
    if engagement.status == EngagementStatus.CANCELLED.value:
        engagement.status = EngagementStatus.DRAFT.value
        engagement.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(engagement)
    return engagement
