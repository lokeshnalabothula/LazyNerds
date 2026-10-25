import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.asset import Asset
from app.models.engagement import Engagement
from app.models.finding import Assessment
from app.services.audit_service import log_audit
from app.services.scanner_service import (
    ingest_scan_results,
    update_assessment_progress,
    recover_abandoned_assessments,
)

logger = logging.getLogger("fixops.workers_api")

router = APIRouter()


# ---------------------------------------------------------------------------
# Worker Authentication Guard
# ---------------------------------------------------------------------------
def verify_worker_auth(
    x_worker_token: Optional[str] = Header(None, alias="X-Worker-Token"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> str:
    """
    Validates worker shared secret token.
    Supports either 'X-Worker-Token: <token>' or 'Authorization: Bearer <token>'.
    """
    provided_token = None
    if x_worker_token:
        provided_token = x_worker_token.strip()
    elif authorization and authorization.startswith("Bearer "):
        provided_token = authorization.replace("Bearer ", "", 1).strip()

    expected_token = settings.FIXOPS_WORKER_TOKEN.strip()
    if not provided_token or provided_token != expected_token:
        logger.warning("Unauthorized worker access attempt with invalid or missing worker token.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid worker authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return provided_token


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class WorkerHeartbeatRequest(BaseModel):
    worker_id: str = Field(..., min_length=1, max_length=100)
    hostname: Optional[str] = None
    status: str = Field(default="online")
    docker_available: bool = True
    nuclei_available: bool = True
    shannon_available: bool = True
    active_jobs_count: int = Field(default=0, ge=0)
    max_concurrent_jobs: int = Field(default=2, ge=1)
    version: str = "1.0.0"
    active_job_ids: Optional[List[str]] = None


class WorkerClaimRequest(BaseModel):
    worker_id: str = Field(..., min_length=1, max_length=100)


class WorkerJobHeartbeatRequest(BaseModel):
    worker_id: str = Field(..., min_length=1, max_length=100)


class WorkerRecoveryRequest(BaseModel):
    max_retries: Optional[int] = None
    lease_seconds: Optional[int] = None


class WorkerProgressRequest(BaseModel):
    worker_id: str = Field(..., min_length=1, max_length=100)
    phase: str
    progress_percent: int = Field(..., ge=0, le=100)
    current_status: str
    active_agent: Optional[str] = None
    log_chunk: Optional[str] = None


class WorkerCompleteRequest(BaseModel):
    worker_id: str = Field(..., min_length=1, max_length=100)
    findings: List[Dict[str, Any]] = Field(default_factory=list)
    raw_output: Optional[Any] = None
    deliverables: Optional[Dict[str, Any]] = None


class WorkerFailRequest(BaseModel):
    worker_id: str = Field(..., min_length=1, max_length=100)
    error_message: str
    error_logs: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/heartbeat", status_code=status.HTTP_200_OK)
def worker_heartbeat(
    payload: WorkerHeartbeatRequest,
    _token: str = Depends(verify_worker_auth),
    db: Session = Depends(get_db),
):
    """
    Worker telemetry heartbeat: reports worker online status, hardware capabilities, and current job load.
    Optionally extends lease for active jobs owned by this worker.
    """
    now = datetime.now(timezone.utc)
    lease_seconds = getattr(settings, "WORKER_LEASE_SECONDS", 300)
    renewed_jobs = []

    if payload.active_job_ids:
        for job_id in payload.active_job_ids:
            query = db.query(Assessment).filter(
                Assessment.id == job_id,
                Assessment.worker_id == payload.worker_id,
                Assessment.status == "running",
            )
            try:
                query = query.with_for_update()
            except Exception:
                pass
            assessment = query.first()
            if assessment:
                assessment.last_heartbeat_at = now
                assessment.lease_expires_at = now + timedelta(seconds=lease_seconds)
                renewed_jobs.append(job_id)
        if renewed_jobs:
            db.commit()

    queued_count = db.query(Assessment).filter(Assessment.status == "queued").count()
    return {
        "status": "acknowledged",
        "worker_id": payload.worker_id,
        "renewed_jobs": renewed_jobs,
        "pending_jobs_count": queued_count,
        "server_time": now.isoformat(),
    }


@router.get("/jobs/pending", status_code=status.HTTP_200_OK)
def get_pending_jobs(
    limit: int = Query(default=5, ge=1, le=20),
    auto_recover: bool = Query(default=True),
    _token: str = Depends(verify_worker_auth),
    db: Session = Depends(get_db),
):
    """
    Retrieves queued scan assessments awaiting execution by an authorized worker.
    Automatically checks and recovers abandoned jobs whose lease has expired before dispatching.
    """
    if auto_recover:
        try:
            recover_abandoned_assessments(db=db)
        except Exception as e:
            logger.warning(f"Auto-recovery during pending jobs poll encountered warning: {e}")

    queued = (
        db.query(Assessment)
        .filter(Assessment.status == "queued")
        .order_by(Assessment.created_at.asc())
        .limit(limit)
        .all()
    )

    jobs = []
    for a in queued:
        target_url = None
        source_repo = None
        scan_mode = "blackbox"
        benchmark_mode = False

        if a.execution_summary:
            try:
                summary = json.loads(a.execution_summary)
                target_url = summary.get("target_url")
                source_repo = summary.get("source_repo")
                scan_mode = summary.get("scan_mode", "blackbox")
                benchmark_mode = summary.get("benchmark_mode", False)
            except Exception:
                pass

        if not target_url and a.target_asset_ids:
            try:
                ids = json.loads(a.target_asset_ids)
                if ids:
                    asset = db.query(Asset).filter(Asset.id == ids[0]).first()
                    if asset:
                        target_url = asset.target
            except Exception:
                pass

        jobs.append({
            "id": a.id,
            "engagement_id": a.engagement_id,
            "name": a.name,
            "assessment_tool": a.assessment_tool,
            "scan_mode": scan_mode,
            "target_url": target_url,
            "source_repo": source_repo,
            "benchmark_mode": benchmark_mode,
            "retry_count": a.retry_count,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    return {"pending_count": len(jobs), "jobs": jobs}


@router.post("/jobs/{assessment_id}/claim", status_code=status.HTTP_200_OK)
def claim_job(
    assessment_id: str,
    payload: WorkerClaimRequest,
    _token: str = Depends(verify_worker_auth),
    db: Session = Depends(get_db),
):
    """
    Atomically claims a queued scan job for execution by this worker node.
    Enforces worker ownership and sets an initial lease expiration.
    """
    query = db.query(Assessment).filter(Assessment.id == assessment_id)
    try:
        query = query.with_for_update()
    except Exception:
        pass
    assessment = query.first()

    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found.")

    if assessment.status != "queued":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job {assessment_id} is already in state '{assessment.status}' and cannot be claimed.",
        )

    if assessment.worker_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job {assessment_id} is already claimed by worker '{assessment.worker_id}'.",
        )

    now = datetime.now(timezone.utc)
    lease_seconds = getattr(settings, "WORKER_LEASE_SECONDS", 300)

    assessment.status = "running"
    assessment.started_at = now
    assessment.worker_id = payload.worker_id
    assessment.claimed_at = now
    assessment.last_heartbeat_at = now
    assessment.lease_expires_at = now + timedelta(seconds=lease_seconds)

    update_assessment_progress(
        assessment_id=assessment.id,
        phase="claimed",
        progress_percent=5,
        message=f"Job claimed by worker {payload.worker_id}. Initializing isolated sandbox container...",
        active_agent="worker-daemon",
        log_line=f"Worker {payload.worker_id} claimed assessment. Lease expires at {assessment.lease_expires_at.isoformat()}.",
        db=db,
        commit=False,
    )

    log_audit(
        db=db,
        user_email=f"worker:{payload.worker_id}",
        action="WORKER_CLAIM_JOB",
        resource_type="assessment",
        resource_id=assessment.id,
        details=f"Worker node {payload.worker_id} claimed job {assessment.name}.",
        commit=False,
    )
    db.commit()
    db.refresh(assessment)

    # Return full dispatch payload
    target_url = None
    source_repo = None
    scan_mode = "blackbox"
    benchmark_mode = False

    if assessment.execution_summary:
        try:
            summary = json.loads(assessment.execution_summary)
            target_url = summary.get("target_url")
            source_repo = summary.get("source_repo")
            scan_mode = summary.get("scan_mode", "blackbox")
            benchmark_mode = summary.get("benchmark_mode", False)
        except Exception:
            pass

    return {
        "status": "claimed",
        "id": assessment.id,
        "assessment_id": assessment.id,
        "engagement_id": assessment.engagement_id,
        "name": assessment.name,
        "assessment_tool": assessment.assessment_tool,
        "scan_mode": scan_mode,
        "target_url": target_url,
        "source_repo": source_repo,
        "benchmark_mode": benchmark_mode,
        "worker_id": assessment.worker_id,
        "claimed_at": assessment.claimed_at.isoformat() if assessment.claimed_at else None,
        "lease_expires_at": assessment.lease_expires_at.isoformat() if assessment.lease_expires_at else None,
    }


@router.post("/jobs/{assessment_id}/heartbeat", status_code=status.HTTP_200_OK)
def heartbeat_job(
    assessment_id: str,
    payload: WorkerJobHeartbeatRequest,
    _token: str = Depends(verify_worker_auth),
    db: Session = Depends(get_db),
):
    """
    Extends the worker lease on a specific running assessment.
    Only the claimant worker can renew the job lease.
    """
    query = db.query(Assessment).filter(Assessment.id == assessment_id)
    try:
        query = query.with_for_update()
    except Exception:
        pass
    assessment = query.first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found.")

    if assessment.status != "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot extend lease for job {assessment_id}: current status is '{assessment.status}' (expected 'running').",
        )

    if not assessment.worker_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot extend lease for job {assessment_id}: job has not been claimed.",
        )

    if assessment.worker_id != payload.worker_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Worker '{payload.worker_id}' is not the claimant of job {assessment_id} (claimed by '{assessment.worker_id}').",
        )

    now = datetime.now(timezone.utc)
    lease_seconds = getattr(settings, "WORKER_LEASE_SECONDS", 300)
    assessment.last_heartbeat_at = now
    assessment.lease_expires_at = now + timedelta(seconds=lease_seconds)
    db.commit()

    return {
        "status": "renewed",
        "assessment_id": assessment_id,
        "worker_id": assessment.worker_id,
        "lease_expires_at": assessment.lease_expires_at.isoformat(),
    }


@router.post("/jobs/{assessment_id}/progress", status_code=status.HTTP_200_OK)
def update_job_progress(
    assessment_id: str,
    payload: WorkerProgressRequest,
    _token: str = Depends(verify_worker_auth),
    db: Session = Depends(get_db),
):
    """
    Updates live scan progress telemetry from the executing worker daemon.
    Strictly restricted to the current claimant worker and valid 'running' status.
    Refreshes the worker lease on every progress report.
    """
    query = db.query(Assessment).filter(Assessment.id == assessment_id)
    try:
        query = query.with_for_update()
    except Exception:
        pass
    assessment = query.first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found.")

    if assessment.status != "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot update progress for job {assessment_id}: current status is '{assessment.status}' (expected 'running').",
        )

    if not assessment.worker_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot update progress for job {assessment_id}: job has not been claimed.",
        )

    if assessment.worker_id != payload.worker_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Worker '{payload.worker_id}' is not the claimant of job {assessment_id} (claimed by '{assessment.worker_id}').",
        )

    now = datetime.now(timezone.utc)
    lease_seconds = getattr(settings, "WORKER_LEASE_SECONDS", 300)
    assessment.last_heartbeat_at = now
    assessment.lease_expires_at = now + timedelta(seconds=lease_seconds)

    update_assessment_progress(
        assessment_id=assessment.id,
        phase=payload.phase,
        progress_percent=payload.progress_percent,
        message=payload.current_status,
        active_agent=payload.active_agent,
        log_line=payload.log_chunk,
        db=db,
        commit=False,
    )
    db.commit()

    return {
        "status": "ok",
        "assessment_id": assessment_id,
        "phase": payload.phase,
        "lease_expires_at": assessment.lease_expires_at.isoformat(),
    }


@router.post("/jobs/{assessment_id}/complete", status_code=status.HTTP_200_OK)
def complete_job(
    assessment_id: str,
    payload: WorkerCompleteRequest,
    _token: str = Depends(verify_worker_auth),
    db: Session = Depends(get_db),
):
    """
    Ingests final scan findings and deliverables from the worker, marking the assessment complete.
    Strictly restricted to the claiming worker and valid 'running' state with row-level lock retention.
    """
    try:
        updated = ingest_scan_results(
            db=db,
            assessment_id=assessment_id,
            parsed_findings=payload.findings,
            raw_output_obj=payload.raw_output,
            user_email=f"worker:{payload.worker_id}",
            deliverables=payload.deliverables,
            expected_worker_id=payload.worker_id,
        )
        return {
            "status": updated.status,
            "assessment_id": updated.id,
            "findings_ingested": updated.findings_count or 0,
        }
    except PermissionError as pe:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(pe),
        )
    except ValueError as ve:
        err_msg = str(ve)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err_msg)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to ingest worker findings for {assessment_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest scan findings: {str(e)}",
        )


@router.post("/jobs/{assessment_id}/fail", status_code=status.HTTP_200_OK)
def fail_job(
    assessment_id: str,
    payload: WorkerFailRequest,
    _token: str = Depends(verify_worker_auth),
    db: Session = Depends(get_db),
):
    """
    Marks an assessment failed with diagnostic error details from the worker daemon.
    Strictly restricted to the claiming worker and valid 'running' state with row-level lock retention.
    """
    query = db.query(Assessment).filter(Assessment.id == assessment_id)
    try:
        query = query.with_for_update()
    except Exception:
        pass
    assessment = query.first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found.")

    if assessment.status != "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot fail job {assessment_id}: current status is '{assessment.status}' (expected 'running').",
        )

    if not assessment.worker_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot fail job {assessment_id}: job has not been claimed.",
        )

    if assessment.worker_id != payload.worker_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Worker '{payload.worker_id}' is not the claimant of job {assessment_id} (claimed by '{assessment.worker_id}').",
        )

    now = datetime.now(timezone.utc)
    assessment.status = "failed"
    assessment.completed_at = now

    update_assessment_progress(
        assessment_id=assessment.id,
        phase="failed",
        progress_percent=100,
        message=f"Worker error: {payload.error_message}",
        log_line=f"Failure encountered on {payload.worker_id}: {payload.error_message}. Logs: {payload.error_logs or 'None'}",
        db=db,
        commit=False,
    )

    log_audit(
        db=db,
        user_email=f"worker:{payload.worker_id}",
        action="WORKER_FAIL_JOB",
        resource_type="assessment",
        resource_id=assessment.id,
        details=f"Worker {payload.worker_id} reported failure: {payload.error_message[:200]}",
        commit=False,
    )
    db.commit()

    return {"status": "failed", "assessment_id": assessment.id}


@router.post("/jobs/recover-abandoned", status_code=status.HTTP_200_OK)
def trigger_recovery(
    payload: Optional[WorkerRecoveryRequest] = None,
    _token: str = Depends(verify_worker_auth),
    db: Session = Depends(get_db),
):
    """
    Explicit endpoint to recover assessments abandoned by disconnected or lost workers.
    Re-queues assessments within retry limits or transitions them to failed.
    """
    max_retries = payload.max_retries if payload else None
    lease_seconds = payload.lease_seconds if payload else None

    recovered = recover_abandoned_assessments(
        db=db,
        max_retries=max_retries,
        lease_seconds=lease_seconds,
    )
    return {
        "status": "ok",
        "recovered_count": len(recovered),
        "recovered": recovered,
    }
