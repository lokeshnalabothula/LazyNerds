from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.overview import OverviewMetrics
from app.services import overview_service

router = APIRouter()


@router.get("/metrics", response_model=OverviewMetrics)
def get_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return overview_service.get_overview_metrics(db)
