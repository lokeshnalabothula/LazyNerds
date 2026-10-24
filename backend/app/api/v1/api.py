from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.clients import router as clients_router
from app.api.v1.engagements import router as engagements_router
from app.api.v1.assets import router as assets_router
from app.api.v1.findings import router as findings_router
from app.api.v1.automation import router as automation_router
from app.api.v1.reports import router as reports_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.audit_logs import router as audit_logs_router
from app.api.v1.overview import router as overview_router
from app.api.v1.health import router as health_router
from app.api.v1.registrations import router as registrations_router
from app.api.v1.workers import router as workers_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["Health"])
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(registrations_router, prefix="/registrations", tags=["Registrations"])
api_router.include_router(clients_router, prefix="/clients", tags=["Clients"])
api_router.include_router(engagements_router, prefix="/engagements", tags=["Engagements"])
api_router.include_router(assets_router, prefix="/assets", tags=["Assets"])
api_router.include_router(findings_router, prefix="/findings", tags=["Findings"])
api_router.include_router(workers_router, prefix="/workers", tags=["Workers"])
api_router.include_router(automation_router, prefix="/automation", tags=["Automation"])
api_router.include_router(reports_router, prefix="/reports", tags=["Reports"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(audit_logs_router, prefix="/audit-logs", tags=["Audit Logs"])
api_router.include_router(overview_router, prefix="/overview", tags=["Overview"])

