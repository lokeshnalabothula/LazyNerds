import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_employee_or_founder
from app.core.config import settings
from app.core.security import validate_target_url_ssrf
from app.db.session import get_db
from app.models.asset import Asset
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.user import User
from app.schemas.engagement import (
    AssessmentType,
    EngagementCreate,
    EngagementListResponse,
    EngagementOut,
    EngagementStatus,
    AuthorizationStatus,
    EngagementUpdate,
    WebsiteAuditRequest,
    WebsiteAuditResponse,
)
from app.services import scanner_service
from app.services.audit_service import log_audit
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


@router.post("/website-audit", response_model=WebsiteAuditResponse, status_code=status.HTTP_201_CREATED)
def submit_website_audit(
    req: WebsiteAuditRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submits a website URL for automated security auditing and scanner dispatch.
    Enforces strict SSRF protection, scope boundaries, and explicit written RoE authorization.
    """
    # 1. Mandatory written authorization check
    if not req.confirmed_authorization:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security testing requires confirmed written authorization from the domain owner.",
        )

    # 2. Strict SSRF and URL validation (rejects localhost, private IPs, cloud metadata)
    is_valid, err_msg = validate_target_url_ssrf(req.url, allow_lab_testing=False)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"URL validation failed: {err_msg}",
        )

    parsed = urlparse(req.url.strip())
    hostname = parsed.hostname or req.url.strip()

    # 3. Client existence & multi-tenant isolation
    client = db.query(Client).filter(Client.id == req.client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Referenced client organization does not exist.",
        )
    if client.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot audit assets for an archived client organization.",
        )

    # Role permission check: client users can only audit for their own organization
    if current_user.role == "client" and current_user.client_id != req.client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Cannot submit audits for other client organizations.",
        )

    # Employee assignment check: employees cannot audit clients assigned to another employee
    if (
        current_user.role == "employee"
        and client.assigned_employee_id
        and client.assigned_employee_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not assigned to this client record.",
        )

    # 4. Resolve or create Engagement
    if req.engagement_id:
        eng = db.query(Engagement).filter(Engagement.id == req.engagement_id).first()
        if not eng:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Referenced engagement does not exist.",
            )
        if eng.client_id != req.client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Referenced engagement belongs to a different client organization.",
            )
        if eng.status in ("completed", "cancelled"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot launch audit on an engagement with status '{eng.status}'.",
            )
        eng.authorization_status = "confirmed"
        if eng.status == "draft":
            eng.status = "in_progress"
        db.flush()
    else:
        now_dt = datetime.now(timezone.utc)
        eng = Engagement(
            id=str(uuid.uuid4()),
            client_id=req.client_id,
            name=f"Website Audit: {hostname}",
            assessment_type=AssessmentType.WEB_APP.value,
            status=EngagementStatus.IN_PROGRESS.value,
            authorization_status=AuthorizationStatus.CONFIRMED.value,
            start_date=now_dt.date(),
            due_date=now_dt.date() + timedelta(days=7),
            description=f"Automated on-demand website security audit for {req.url.strip()} initiated by {current_user.email}.",
            scope_summary=f"Target URL: {req.url.strip()}",
            assigned_to=current_user.full_name or current_user.email,
            created_at=now_dt,
            updated_at=now_dt,
        )
        db.add(eng)
        db.flush()

    # 5. Resolve or create Asset
    clean_target = req.url.strip()
    asset = (
        db.query(Asset)
        .filter(Asset.client_id == req.client_id, Asset.target == clean_target)
        .first()
    )
    if not asset:
        now_dt = datetime.now(timezone.utc)
        asset = Asset(
            id=str(uuid.uuid4()),
            client_id=req.client_id,
            engagement_id=eng.id,
            name=f"Web: {hostname}",
            asset_type="web_application",
            target=clean_target,
            environment="production",
            criticality="high",
            in_scope=True,
            authorization_status="verified",
            notes=req.notes or "Registered via Website Audit submission flow.",
            created_at=now_dt,
            updated_at=now_dt,
        )
        db.add(asset)
        db.flush()
    else:
        asset.engagement_id = eng.id
        asset.in_scope = True
        asset.authorization_status = "verified"
        db.flush()

    # 6. Launch or register scan via existing scanner pipeline
    try:
        assessment = scanner_service.launch_scan(
            db=db,
            engagement_id=eng.id,
            target_asset_id=asset.id,
            scan_mode=req.scan_mode,
            current_user=current_user,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scanner dispatch failed: {str(e)}",
        )

    # 7. Record security audit log
    import json
    log_audit(
        db=db,
        user_email=current_user.email,
        action="website_audit_launched",
        resource_type="assessment",
        resource_id=assessment.id,
        details=json.dumps({
            "target_url": clean_target,
            "client_id": req.client_id,
            "engagement_id": eng.id,
            "asset_id": asset.id,
            "scan_mode": req.scan_mode,
        }),
        commit=False,
    )

    db.commit()

    return WebsiteAuditResponse(
        status="success",
        message="Website security audit successfully initiated.",
        assessment_id=assessment.id,
        engagement_id=eng.id,
        asset_id=asset.id,
        target_url=clean_target,
        scan_mode=req.scan_mode,
        assessment_status=assessment.status,
        assessment_tool=assessment.assessment_tool,
        findings_count=assessment.findings_count,
        created_at=assessment.created_at,
    )
