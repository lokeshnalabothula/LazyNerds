from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api.deps import get_current_user, require_employee_or_founder
from app.db.session import get_db
from app.models.user import User
from app.models.engagement import Engagement
from app.models.finding import Assessment
from app.schemas.finding import (
    FindingCreate,
    FindingListResponse,
    FindingOut,
    FindingUpdate,
    VerificationCreate,
    VerificationOut,
    ScanImportRequest,
    AssessmentOut,
    AssessmentListResponse,
)
from app.services import finding_service, scan_adapters

router = APIRouter()


@router.get("", response_model=FindingListResponse)
def list_findings(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    engagement_id: Optional[str] = Query(None),
    asset_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client_id_filter = current_user.client_id if current_user.role == "client" else None
    if current_user.role == "client" and not current_user.client_id:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 1,
        }

    items, total = finding_service.get_findings(
        db=db,
        engagement_id=engagement_id,
        asset_id=asset_id,
        severity=severity,
        status=status_filter,
        search=search,
        client_id=client_id_filter,
        page=page,
        page_size=page_size,
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.post("", response_model=FindingOut, status_code=status.HTTP_201_CREATED)
def create_finding(
    finding_in: FindingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    try:
        return finding_service.create_finding(db, finding_in, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/assessments", response_model=AssessmentListResponse)
def list_assessments(
    engagement_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Assessment)
    if current_user.role == "client":
        if not current_user.client_id:
            return {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 1,
            }
        query = query.join(Engagement).filter(Engagement.client_id == current_user.client_id)
        if engagement_id:
            query = query.filter(Assessment.engagement_id == engagement_id)
    else:
        if engagement_id:
            query = query.filter(Assessment.engagement_id == engagement_id)

    total = query.count()
    items = (
        query.order_by(desc(Assessment.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 1,
    }


@router.get("/assessments/{assessment_id}", response_model=AssessmentOut)
def get_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found.")
    if current_user.role == "client":
        if not assessment.engagement or assessment.engagement.client_id != current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not authorized to view another organization's assessment.",
            )
    return assessment


@router.post("/import-scan", response_model=AssessmentOut, status_code=status.HTTP_201_CREATED)
def import_scan(
    req: ScanImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    try:
        return scan_adapters.run_or_import_scan(
            db=db,
            engagement_id=req.engagement_id,
            tool_name=req.tool_name,
            scan_data=req.scan_data,
            target_asset_id=req.target_asset_id,
            auto_create_findings=req.auto_create_findings,
            current_user_email=current_user.email,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{finding_id}", response_model=FindingOut)
def get_finding(
    finding_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = finding_service.get_finding_by_id(db, finding_id)
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding with ID '{finding_id}' not found.",
        )
    if current_user.role == "client":
        if not finding.engagement or finding.engagement.client_id != current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not authorized to view another organization's findings.",
            )
    return finding


@router.patch("/{finding_id}", response_model=FindingOut)
def update_finding(
    finding_id: str,
    finding_in: FindingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Client accounts may not directly alter vulnerability finding records.",
        )
    try:
        return finding_service.update_finding(db, finding_id, finding_in, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{finding_id}/verifications", response_model=VerificationOut, status_code=status.HTTP_201_CREATED)
def add_verification(
    finding_id: str,
    verif_in: VerificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    try:
        return finding_service.add_verification(db, finding_id, verif_in, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
