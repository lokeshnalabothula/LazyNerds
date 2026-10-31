import logging
import os
from pathlib import Path
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.api import api_router
from app.api.v1.domains import router as domains_router
from app.core.config import settings
import app.db.session as db_session
from app.db.session import Base, SessionLocal, engine
from app.models.user import User
from app.schemas.auth import UserCreate
from app.services.auth_service import create_user, get_user_by_email

# Configure structured logging (redacted, no sensitive tokens)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("fixops")


def _sanitize_db_error(error_msg: str) -> str:
    """Removes sensitive credentials (e.g. user:password) from database connection errors."""
    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", str(error_msg))


def init_db_and_seed_admin():
    """Initializes tables, applies schema migrations, and seeds initial authorized founder if absent."""
    active_engine = getattr(db_session, "engine", engine)

    # 1. Apply Alembic migrations
    try:
        from alembic import command
        from alembic.config import Config

        base_dir = Path(__file__).resolve().parent.parent
        alembic_ini_path = base_dir / "alembic.ini"
        alembic_cfg = Config(str(alembic_ini_path) if alembic_ini_path.exists() else "alembic.ini")
        command.upgrade(alembic_cfg, "head")
        logger.info("Alembic schema migrations applied successfully.")
    except Exception as e:
        safe_msg = _sanitize_db_error(str(e))
        if settings.ENVIRONMENT == "production":
            logger.critical(f"Production database schema migration failed: {safe_msg}")
            raise RuntimeError(f"Database migration failed in production: {safe_msg}") from e
        logger.warning(f"Alembic auto-upgrade notice in {settings.ENVIRONMENT}: {safe_msg}")

    # 2. In production, Alembic is strictly authoritative. Exit early to prevent unversioned DDL drift.
    if settings.ENVIRONMENT == "production":
        return

    # 3. Schema safety net for non-production environments (SQLite local dev / testing)
    try:
        from sqlalchemy import inspect, text
        Base.metadata.create_all(bind=active_engine)
        inspector = inspect(active_engine)
        existing_tables = set(inspector.get_table_names())

        is_pg = "postgres" in str(active_engine.url).lower()
        col_type = "TIMESTAMP" if is_pg else "DATETIME"

        with active_engine.connect() as conn:
            # Synchronize email_verification_codes table columns
            if "email_verification_codes" in existing_tables:
                evc_cols = {col["name"] for col in inspector.get_columns("email_verification_codes")}
                if "full_name" not in evc_cols:
                    conn.execute(text("ALTER TABLE email_verification_codes ADD COLUMN full_name VARCHAR(255)"))
                if "registration_token_hash" not in evc_cols:
                    conn.execute(text("ALTER TABLE email_verification_codes ADD COLUMN registration_token_hash VARCHAR(255)"))
                if "registration_token_expires_at" not in evc_cols:
                    conn.execute(text(f"ALTER TABLE email_verification_codes ADD COLUMN registration_token_expires_at {col_type}"))
                if "registration_token_used_at" not in evc_cols:
                    conn.execute(text(f"ALTER TABLE email_verification_codes ADD COLUMN registration_token_used_at {col_type}"))

            # Synchronize password_reset_codes table columns
            if "password_reset_codes" in existing_tables:
                prc_cols = {col["name"] for col in inspector.get_columns("password_reset_codes")}
                if "reset_token_hash" not in prc_cols:
                    conn.execute(text("ALTER TABLE password_reset_codes ADD COLUMN reset_token_hash VARCHAR(255)"))
                if "reset_token_expires_at" not in prc_cols:
                    conn.execute(text(f"ALTER TABLE password_reset_codes ADD COLUMN reset_token_expires_at {col_type}"))

            # Synchronize organization_id and permissions for multi-tenant isolation
            tables_with_org_id = ["users", "clients", "engagements", "assets", "domains", "audit_logs", "client_registrations"]
            for tbl in tables_with_org_id:
                if tbl in existing_tables:
                    cols = {col["name"] for col in inspector.get_columns(tbl)}
                    if "organization_id" not in cols:
                        conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN organization_id VARCHAR(36)"))
            if "users" in existing_tables:
                user_cols = {col["name"] for col in inspector.get_columns("users")}
                if "permissions" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN permissions TEXT"))

            conn.commit()
        logger.info("Database schema synchronized successfully for non-production environment.")
    except Exception as e:
        logger.error(f"Non-production schema synchronization check failed: {e}", exc_info=True)

    # 4. Seed initial founder and primary organization if not present (development and test environments only)
    try:
        active_sessionmaker = getattr(db_session, "SessionLocal", SessionLocal)
        db = active_sessionmaker()
        from app.services.auth_service import bootstrap_founder_account
        bootstrap_founder_account(db)
        logger.info(f"Initialized authorized founder and primary organization for {settings.INITIAL_ADMIN_EMAIL}")
        db.close()
    except Exception as e:
        logger.warning(f"Admin seeding check skipped or deferred: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT}]")
    init_db_and_seed_admin()
    yield
    # Shutdown
    logger.info("Shutting down FixOps Client Manager.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Client relationship and engagement management foundation for Lazy Nerds cybersecurity services.",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# Global Validation Error Handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = " -> ".join(str(loc) for loc in err.get("loc", []) if loc != "body")
        errors.append({
            "field": field,
            "message": err.get("msg", "Invalid value"),
        })
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation failed for the submitted data.",
            "errors": errors,
        },
    )


# Global Exception Handler (Never leak stack traces or SQL strings)
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected server error occurred. Please try again later.",
        },
    )


# Mount versioned API
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(domains_router, prefix="/api/domains", tags=["Domains (Direct)"])


@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": f"{settings.API_V1_STR}/docs" if settings.ENVIRONMENT != "production" else "restricted",
    }


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=settings.ENVIRONMENT != "production")
