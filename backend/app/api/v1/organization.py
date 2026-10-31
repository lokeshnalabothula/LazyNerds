import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_owner, require_worker_or_owner
from app.core.config import settings
from app.db.session import get_db
from app.models.organization import Organization
from app.models.user import User, DEFAULT_WORKER_PERMISSIONS
from app.schemas.organization import (
    OrganizationOut,
    OrganizationMemberOut,
    PromoteMemberRequest,
    DemoteMemberRequest,
    UpdateMemberPermissionsRequest,
    UpdateMemberStatusRequest,
)
from app.services.audit_service import log_audit

router = APIRouter()


@router.get("", response_model=OrganizationOut)
def get_current_organization(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves profile and details of the authenticated user's organization."""
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not associated with an organization.",
        )
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found.",
        )
    return OrganizationOut.model_validate(org)


@router.get("/members", response_model=List[OrganizationMemberOut])
def list_organization_members(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """
    Lists all members within the authenticated user's organization.
    Restricted to Owner (Founder).
    Never exposes members of other organizations.
    """
    members = (
        db.query(User)
        .filter(User.organization_id == current_user.organization_id)
        .order_by(User.full_name.asc())
        .all()
    )
    return [OrganizationMemberOut.model_validate(m) for m in members]


@router.get("/members/{user_id}", response_model=OrganizationMemberOut)
def get_organization_member(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """
    Retrieves member details for a specific user in the caller's organization.
    Returns 404 if user does not exist or belongs to another organization.
    """
    member = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == current_user.organization_id)
        .first()
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization member not found.",
        )
    return OrganizationMemberOut.model_validate(member)


@router.post("/members/{user_id}/promote", response_model=OrganizationMemberOut)
def promote_member_to_worker(
    user_id: str,
    payload: Optional[PromoteMemberRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """
    Promotes a registered Client to a Worker within the organization.
    Owner-only operation.
    Enforces tenant scoping: cannot promote users outside caller's organization.
    Assigns initial worker permissions and logs an immutable audit event.
    """
    # 1. Target user lookup scoped to caller's organization
    target = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == current_user.organization_id)
        .first()
    )
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target member not found in your organization.",
        )

    if target.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot promote yourself: you already possess Organization Owner privileges.",
        )

    if target.is_owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target user is already an Organization Owner.",
        )

    old_role = target.role
    target.role = "worker"

    # Set initial permissions
    perms = payload.permissions if (payload and payload.permissions is not None) else DEFAULT_WORKER_PERMISSIONS
    target.permissions = json.dumps(perms)
    target.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(target)

    # 2. Immutable audit log
    log_audit(
        db=db,
        user_email=current_user.email,
        action="PROMOTE_TO_WORKER",
        resource_type="user",
        resource_id=target.id,
        details=f"Owner '{current_user.email}' promoted '{target.email}' from '{old_role}' to 'worker' with permissions: {perms}",
    )

    return OrganizationMemberOut.model_validate(target)


@router.post("/members/{user_id}/demote", response_model=OrganizationMemberOut)
def demote_worker_to_client(
    user_id: str,
    _payload: Optional[DemoteMemberRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """
    Demotes a Worker back to Client within the organization.
    Owner-only operation.
    Guards:
    - Cannot demote founder account.
    - Cannot demote last active owner.
    - Cannot demote cross-tenant users.
    Revokes worker permissions and logs an immutable audit event.
    """
    target = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == current_user.organization_id)
        .first()
    )
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target member not found in your organization.",
        )

    # Prevent demoting founder
    founder_email = settings.INITIAL_ADMIN_EMAIL.strip().lower()
    if target.email.strip().lower() == founder_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Protected account: The primary founder cannot be demoted.",
        )

    # Prevent demoting the last active Owner
    if target.is_owner:
        active_owners = (
            db.query(User)
            .filter(
                User.organization_id == current_user.organization_id,
                User.role.in_(["owner", "founder", "admin"]),
                User.is_active == True,
            )
            .count()
        )
        if active_owners <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last active Organization Owner.",
            )

    old_role = target.role
    target.role = "client"
    target.permissions = json.dumps([])
    target.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(target)

    # Immutable audit log
    log_audit(
        db=db,
        user_email=current_user.email,
        action="DEMOTE_TO_CLIENT",
        resource_type="user",
        resource_id=target.id,
        details=f"Owner '{current_user.email}' demoted '{target.email}' from '{old_role}' to 'client'.",
    )

    return OrganizationMemberOut.model_validate(target)


@router.put("/members/{user_id}/permissions", response_model=OrganizationMemberOut)
def update_worker_permissions(
    user_id: str,
    payload: UpdateMemberPermissionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """
    Assigns or revokes granular worker permissions.
    Owner-only operation.
    Validates permissions against allowlist and records audit log.
    """
    target = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == current_user.organization_id)
        .first()
    )
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target member not found in your organization.",
        )

    if not target.is_worker:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Granular worker permissions can only be configured for accounts with 'worker' role.",
        )

    old_perms = target.get_permissions_list()
    target.permissions = json.dumps(payload.permissions)
    target.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(target)

    log_audit(
        db=db,
        user_email=current_user.email,
        action="UPDATE_WORKER_PERMISSIONS",
        resource_type="user",
        resource_id=target.id,
        details=f"Owner '{current_user.email}' updated permissions for '{target.email}' from {old_perms} to {payload.permissions}.",
    )

    return OrganizationMemberOut.model_validate(target)


@router.post("/members/{user_id}/status", response_model=OrganizationMemberOut)
def update_member_status(
    user_id: str,
    payload: UpdateMemberStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """
    Activates or deactivates a member account within the organization.
    Owner-only operation.
    Guards against deactivating the founder or the last active Owner.
    """
    target = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == current_user.organization_id)
        .first()
    )
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target member not found in your organization.",
        )

    founder_email = settings.INITIAL_ADMIN_EMAIL.strip().lower()
    if not payload.is_active:
        if target.email.strip().lower() == founder_email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Protected account: The primary founder account cannot be deactivated.",
            )
        if target.is_owner:
            active_owners = (
                db.query(User)
                .filter(
                    User.organization_id == current_user.organization_id,
                    User.role.in_(["owner", "founder", "admin"]),
                    User.is_active == True,
                )
                .count()
            )
            if active_owners <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot deactivate the last active Organization Owner.",
                )

    target.is_active = payload.is_active
    target.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(target)

    action_label = "ACTIVATE_MEMBER" if payload.is_active else "DEACTIVATE_MEMBER"
    log_audit(
        db=db,
        user_email=current_user.email,
        action=action_label,
        resource_type="user",
        resource_id=target.id,
        details=f"Owner '{current_user.email}' set status of '{target.email}' to is_active={payload.is_active}.",
    )

    return OrganizationMemberOut.model_validate(target)
