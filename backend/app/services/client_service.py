import math
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import or_, desc, asc
from sqlalchemy.orm import Session
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientUpdate, ClientStatus

SORT_FIELDS_ALLOWLIST = {
    "company_name": Client.company_name,
    "created_at": Client.created_at,
    "updated_at": Client.updated_at,
    "primary_contact_name": Client.primary_contact_name,
}


def list_clients(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    search: Optional[str] = None,
    status: Optional[str] = "active",
    sort_by: str = "created_at",
    sort_order: str = "desc"
) -> Tuple[List[Client], int, int]:
    """
    Retrieves a paginated list of clients with search, filtering, and strict sorting.
    Returns (items, total_count, total_pages).
    """
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 10

    query = db.query(Client)

    # Status filtering
    if status and status.lower() != "all":
        valid_status = status.lower()
        if valid_status in ["active", "archived"]:
            query = query.filter(Client.status == valid_status)

    # Search filtering (company name, contact name, contact email)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Client.company_name.ilike(search_term),
                Client.primary_contact_name.ilike(search_term),
                Client.primary_contact_email.ilike(search_term),
            )
        )

    total_count = query.count()
    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1

    # Sorting with strict allowlist
    sort_column = SORT_FIELDS_ALLOWLIST.get(sort_by, Client.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    # Pagination
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()

    return items, total_count, total_pages


def get_client_by_id(db: Session, client_id: str) -> Optional[Client]:
    """Fetches a client record by ID."""
    return db.query(Client).filter(Client.id == client_id).first()


def create_client(db: Session, client_in: ClientCreate) -> Client:
    """Creates a new client transactionally, respecting custom client onboarding timestamps."""
    created_ts = client_in.created_at if client_in.created_at is not None else datetime.now(timezone.utc)
    if created_ts.tzinfo is None:
        created_ts = created_ts.replace(tzinfo=timezone.utc)

    client = Client(
        company_name=client_in.company_name,
        primary_contact_name=client_in.primary_contact_name,
        primary_contact_email=client_in.primary_contact_email,
        website=client_in.website,
        phone=client_in.phone,
        industry=client_in.industry,
        notes=client_in.notes,
        status=ClientStatus.ACTIVE.value,
        created_at=created_ts,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def update_client(db: Session, client: Client, client_in: ClientUpdate) -> Client:
    """Applies a partial update to an existing client record."""
    update_data = client_in.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field == "created_at" and value is not None:
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
        setattr(client, field, value)
    
    client.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(client)
    return client


def archive_client(db: Session, client: Client) -> Client:
    """Archives a client record without deleting historical data."""
    client.status = ClientStatus.ARCHIVED.value
    client.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(client)
    return client


def restore_client(db: Session, client: Client) -> Client:
    """Restores an archived client to active status."""
    client.status = ClientStatus.ACTIVE.value
    client.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(client)
    return client
