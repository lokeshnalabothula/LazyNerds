from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.finding import Finding, Verification, Assessment
from app.models.engagement import Engagement
from app.models.asset import Asset
from app.models.user import User
from app.schemas.finding import FindingCreate, FindingUpdate, VerificationCreate
from app.services.audit_service import log_audit
from app.services.automation_engine import dispatch_event


def create_finding(db: Session, finding_in: FindingCreate, current_user: User) -> Finding:
    # 1. Validate engagement exists
    engagement = db.query(Engagement).filter(Engagement.id == finding_in.engagement_id).first()
    if not engagement:
        raise ValueError("Referenced engagement does not exist.")

    # 2. Validate asset if provided
    if finding_in.asset_id:
        asset = db.query(Asset).filter(Asset.id == finding_in.asset_id).first()
        if not asset:
            raise ValueError("Referenced asset does not exist.")
        if asset.client_id != engagement.client_id:
            raise ValueError("Asset does not belong to the engagement's client.")

    # 3. Validate assessment if provided
    if finding_in.assessment_id:
        assessment = db.query(Assessment).filter(Assessment.id == finding_in.assessment_id).first()
        if not assessment:
            raise ValueError("Referenced assessment does not exist.")

    finding = Finding(
        engagement_id=finding_in.engagement_id,
        asset_id=finding_in.asset_id,
        assessment_id=finding_in.assessment_id,
        title=finding_in.title,
        severity=finding_in.severity,
        cvss_score=finding_in.cvss_score,
        status=finding_in.status,
        cve_id=finding_in.cve_id,
        description=finding_in.description,
        impact=finding_in.impact,
        remediation_guidance=finding_in.remediation_guidance,
        evidence=finding_in.evidence,
        references_url=finding_in.references_url,
        remediation_notes=finding_in.remediation_notes,
        remediation_deadline=finding_in.remediation_deadline,
        assigned_to=finding_in.assigned_to,
    )
    db.add(finding)
    db.commit()
    db.refresh(finding)

    log_audit(
        db=db,
        user_email=current_user.email,
        action="CREATE_FINDING",
        resource_type="finding",
        resource_id=finding.id,
        details=f"Created finding '{finding.title}' ({finding.severity}) in engagement '{engagement.name}'",
    )

    # Dispatch automation trigger
    dispatch_event(
        db=db,
        event_type="on_finding_created",
        context={
            "finding_id": finding.id,
            "title": finding.title,
            "severity": finding.severity,
            "engagement_id": finding.engagement_id,
            "asset_id": finding.asset_id,
            "cve_id": finding.cve_id,
            "assigned_to": finding.assigned_to,
        },
        trigger_source=f"finding:{finding.title}",
    )
    return finding


def get_finding_by_id(db: Session, finding_id: str) -> Optional[Finding]:
    return db.query(Finding).filter(Finding.id == finding_id).first()


def get_findings(
    db: Session,
    engagement_id: Optional[str] = None,
    asset_id: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[List[Finding], int]:
    query = db.query(Finding)
    if engagement_id:
        query = query.filter(Finding.engagement_id == engagement_id)
    if asset_id:
        query = query.filter(Finding.asset_id == asset_id)
    if severity:
        query = query.filter(Finding.severity == severity)
    if status:
        query = query.filter(Finding.status == status)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            (Finding.title.ilike(search_term))
            | (Finding.description.ilike(search_term))
            | (Finding.cve_id.ilike(search_term))
        )

    total = query.count()
    items = (
        query.order_by(desc(Finding.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def update_finding(
    db: Session, finding_id: str, finding_in: FindingUpdate, current_user: User
) -> Finding:
    finding = get_finding_by_id(db, finding_id)
    if not finding:
        raise ValueError("Finding not found.")

    update_data = finding_in.model_dump(exclude_unset=True)

    # Module E Enforcement: Prevent marking verified_fixed without a passed verification
    if update_data.get("status") == "verified_fixed":
        has_passed_verification = (
            db.query(Verification)
            .filter(
                Verification.finding_id == finding.id,
                Verification.result == "passed",
            )
            .count()
            > 0
        )
        if not has_passed_verification:
            raise ValueError(
                "Remediation verification policy: A finding cannot be marked as 'verified_fixed' "
                "without a documented and verified test result. Please record a verification check first."
            )

    for field, value in update_data.items():
        setattr(finding, field, value)

    db.commit()
    db.refresh(finding)

    log_audit(
        db=db,
        user_email=current_user.email,
        action="UPDATE_FINDING",
        resource_type="finding",
        resource_id=finding.id,
        details=f"Updated finding '{finding.title}' fields: {list(update_data.keys())}",
    )
    return finding


def add_verification(
    db: Session, finding_id: str, verif_in: VerificationCreate, current_user: User
) -> Verification:
    finding = get_finding_by_id(db, finding_id)
    if not finding:
        raise ValueError("Finding not found.")

    verification = Verification(
        finding_id=finding.id,
        verified_by=current_user.email,
        result=verif_in.result,
        verification_method=verif_in.verification_method,
        notes=verif_in.notes,
    )
    db.add(verification)

    # Update finding status based on verification outcome
    if verif_in.result == "passed":
        finding.status = "verified_fixed"
    elif verif_in.result == "failed":
        finding.status = "in_remediation"
    elif verif_in.result == "partially_resolved":
        finding.status = "in_remediation"

    db.commit()
    db.refresh(verification)
    db.refresh(finding)

    log_audit(
        db=db,
        user_email=current_user.email,
        action="RECORD_VERIFICATION",
        resource_type="verification",
        resource_id=verification.id,
        details=f"Recorded verification {verif_in.result} ({verif_in.verification_method}) for finding '{finding.title}'",
    )

    dispatch_event(
        db=db,
        event_type="on_remediation_requested",
        context={
            "finding_id": finding.id,
            "title": finding.title,
            "verification_result": verif_in.result,
            "verified_by": current_user.email,
            "status": finding.status,
            "engagement_id": finding.engagement_id,
        },
        trigger_source=f"verification:{finding.title}",
    )
    return verification
