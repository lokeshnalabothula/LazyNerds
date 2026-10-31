from html import escape
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.report import (
    ReportCreate,
    ReportListResponse,
    ReportOut,
)
from app.services import report_service

router = APIRouter()


@router.get("", response_model=ReportListResponse)
def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    engagement_id: Optional[str] = Query(None),
    report_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client_id_filter = current_user.client_id if current_user.is_client else None
    if current_user.is_client and not current_user.client_id:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 1,
        }

    items, total = report_service.get_reports(
        db=db,
        organization_id=current_user.organization_id,
        engagement_id=engagement_id,
        report_type=report_type,
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


@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def create_report(
    report_in: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_client:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Client users may not generate assessment reports.",
        )
    try:
        return report_service.generate_report(db, report_in, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{report_id}", response_model=ReportOut)
def get_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = report_service.get_report_by_id(
        db, report_id, organization_id=current_user.organization_id
    )
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    if current_user.is_client:
        if not report.engagement or report.engagement.client_id != current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view or access reports for another organization.",
            )
    return report


@router.get("/{report_id}/download")
def download_report(
    report_id: str,
    format: str = Query("html", pattern="^(html|markdown)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = report_service.get_report_by_id(
        db, report_id, organization_id=current_user.organization_id
    )
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    if current_user.is_client:
        if not report.engagement or report.engagement.client_id != current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view or access reports for another organization.",
            )

    if format == "markdown":
        return PlainTextResponse(
            content=report.summary_content or "",
            headers={"Content-Disposition": f'attachment; filename="FixOps_Report_{report.id[:8]}.md"'},
        )

    safe_title = escape(report.title or "FixOps Security Report")
    safe_content = escape(report.summary_content or "")

    # Clean, professional print-ready HTML
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{safe_title} - Lazy Nerds FixOps</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #18181b; max-width: 850px; margin: 40px auto; padding: 0 20px; }}
  h1 {{ font-size: 26px; border-bottom: 2px solid #e4e4e7; padding-bottom: 12px; margin-bottom: 8px; color: #09090b; }}
  h2 {{ font-size: 18px; margin-top: 32px; border-bottom: 1px solid #f4f4f5; padding-bottom: 6px; color: #27272a; }}
  h3 {{ font-size: 15px; margin-top: 20px; color: #3f3f46; }}
  code {{ background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: monospace; }}
  pre {{ background: #f4f4f5; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 13px; }}
  .header-meta {{ font-size: 13px; color: #71717a; margin-bottom: 24px; }}
  .badge {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }}
  @media print {{ body {{ margin: 0; padding: 0; }} }}
</style>
</head>
<body>
<div class="header-meta">Lazy Nerds FixOps Platform &bull; Confidential Security Assessment Document</div>
<pre style="white-space: pre-wrap; font-family: inherit; background: transparent; padding: 0;">{safe_content}</pre>
</body>
</html>"""
    return HTMLResponse(
        content=html_content,
        headers={"Content-Disposition": f'inline; filename="FixOps_Report_{report.id[:8]}.html"'},
    )
