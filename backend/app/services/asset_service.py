from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.asset import Asset
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.user import User
from app.schemas.asset import AssetCreate, AssetUpdate
from app.services.audit_service import log_audit
from app.services.automation_engine import dispatch_event


def create_asset(db: Session, asset_in: AssetCreate, current_user: User) -> Asset:
    # 1. Validate parent client exists
    client = db.query(Client).filter(Client.id == asset_in.client_id).first()
    if not client:
        raise ValueError("Referenced client does not exist.")

    # 2. Validate engagement if provided
    if asset_in.engagement_id:
        engagement = db.query(Engagement).filter(Engagement.id == asset_in.engagement_id).first()
        if not engagement:
            raise ValueError("Referenced engagement does not exist.")
        if engagement.client_id != asset_in.client_id:
            raise ValueError("Referenced engagement does not belong to the selected client.")

    asset = Asset(
        client_id=asset_in.client_id,
        engagement_id=asset_in.engagement_id,
        name=asset_in.name,
        asset_type=asset_in.asset_type,
        target=asset_in.target,
        environment=asset_in.environment,
        criticality=asset_in.criticality,
        in_scope=asset_in.in_scope,
        authorization_status=asset_in.authorization_status,
        notes=asset_in.notes,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    log_audit(
        db=db,
        user_email=current_user.email,
        action="CREATE_ASSET",
        resource_type="asset",
        resource_id=asset.id,
        details=f"Created asset '{asset.name}' ({asset.asset_type}) for client '{client.company_name}'",
    )

    # Dispatch automation event
    dispatch_event(
        db=db,
        event_type="on_asset_registered",
        context={
            "asset_id": asset.id,
            "name": asset.name,
            "asset_type": asset.asset_type,
            "target": asset.target,
            "criticality": asset.criticality,
            "in_scope": asset.in_scope,
            "client_id": asset.client_id,
            "engagement_id": asset.engagement_id,
        },
        trigger_source=f"asset:{asset.name}",
    )
    return asset


def get_asset_by_id(db: Session, asset_id: str) -> Optional[Asset]:
    return db.query(Asset).filter(Asset.id == asset_id).first()


def get_assets(
    db: Session,
    client_id: Optional[str] = None,
    engagement_id: Optional[str] = None,
    asset_type: Optional[str] = None,
    in_scope: Optional[bool] = None,
    criticality: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[List[Asset], int]:
    query = db.query(Asset)
    if client_id:
        query = query.filter(Asset.client_id == client_id)
    if engagement_id:
        query = query.filter(Asset.engagement_id == engagement_id)
    if asset_type:
        query = query.filter(Asset.asset_type == asset_type)
    if in_scope is not None:
        query = query.filter(Asset.in_scope == in_scope)
    if criticality:
        query = query.filter(Asset.criticality == criticality)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            (Asset.name.ilike(search_term)) | (Asset.target.ilike(search_term))
        )

    total = query.count()
    items = (
        query.order_by(desc(Asset.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def update_asset(
    db: Session, asset_id: str, asset_in: AssetUpdate, current_user: User
) -> Asset:
    asset = get_asset_by_id(db, asset_id)
    if not asset:
        raise ValueError("Asset not found.")

    update_data = asset_in.model_dump(exclude_unset=True)
    if "engagement_id" in update_data and update_data["engagement_id"]:
        eng = db.query(Engagement).filter(Engagement.id == update_data["engagement_id"]).first()
        if not eng:
            raise ValueError("Referenced engagement does not exist.")
        if eng.client_id != asset.client_id:
            raise ValueError("Engagement does not belong to the asset's client.")

    for field, value in update_data.items():
        setattr(asset, field, value)

    db.commit()
    db.refresh(asset)

    log_audit(
        db=db,
        user_email=current_user.email,
        action="UPDATE_ASSET",
        resource_type="asset",
        resource_id=asset.id,
        details=f"Updated asset '{asset.name}' fields: {list(update_data.keys())}",
    )
    return asset


def delete_asset(db: Session, asset_id: str, current_user: User) -> None:
    asset = get_asset_by_id(db, asset_id)
    if not asset:
        raise ValueError("Asset not found.")

    asset_name = asset.name
    db.delete(asset)
    db.commit()

    log_audit(
        db=db,
        user_email=current_user.email,
        action="DELETE_ASSET",
        resource_type="asset",
        resource_id=asset_id,
        details=f"Deleted asset '{asset_name}'",
    )
