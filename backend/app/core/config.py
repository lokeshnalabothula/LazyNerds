import json
import os
from typing import List, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_DEV_SECRET = "insecure-dev-secret-key-change-in-production-lazy-nerds-fixops-2026"

DEFAULT_DEV_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[".env", ".env.local", "../.env.local"],
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    PROJECT_NAME: str = "Lazy Nerds FixOps Client Manager"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Security
    SECRET_KEY: str = INSECURE_DEV_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/fixops"
    )
    DATABASE_URL_UNPOOLED: str | None = os.getenv("DATABASE_URL_UNPOOLED")

    # Neon Object Storage (S3-compatible)
    AWS_ACCESS_KEY_ID: str | None = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: str | None = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_ENDPOINT_URL_S3: str | None = os.getenv("AWS_ENDPOINT_URL_S3")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-2")
    NEON_OBJECT_STORAGE_BUCKET: str = "assets"

    # CORS Allowed Origins
    ALLOWED_ORIGINS: Union[str, List[str]] = DEFAULT_DEV_ORIGINS

    # Initial Admin Seed (used ONLY in non-production environments when DB is empty)
    INITIAL_ADMIN_EMAIL: str = "lokeshnalabothula@gmail.com"
    INITIAL_ADMIN_PASSWORD: str = os.getenv("INITIAL_ADMIN_PASSWORD", "dev-temporary-seed-only")
    INITIAL_ADMIN_NAME: str = "Lokesh Nalabothula"

    # Email Dispatch & Password Recovery Configuration
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://lazynerds.vercel.app")
    EMAIL_PROVIDER: str = os.getenv("EMAIL_PROVIDER", "auto")  # "auto", "resend", "smtp", "mock"
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "Lazy Nerds FixOps <noreply@lazynerds.com>")
    RESEND_API_KEY: str | None = os.getenv("RESEND_API_KEY")
    SMTP_HOST: str | None = os.getenv("SMTP_HOST")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str | None = os.getenv("SMTP_USER")
    SMTP_PASSWORD: str | None = os.getenv("SMTP_PASSWORD")
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "true").lower() in ("true", "1", "yes")
    SMTP_SSL: bool = os.getenv("SMTP_SSL", "false").lower() in ("true", "1", "yes")

    # Scanner & Distributed Worker Dispatch Configuration
    FIXOPS_WORKER_TOKEN: str = os.getenv("FIXOPS_WORKER_TOKEN", "fixops_worker_secret_token_dev_2026")
    WORKER_DISPATCH_MODE: str = os.getenv("WORKER_DISPATCH_MODE", "auto")  # "auto", "distributed", "embedded"
    ALLOW_EMBEDDED_DOCKER: bool = os.getenv("ALLOW_EMBEDDED_DOCKER", "false").lower() in ("true", "1", "yes")
    ALLOW_LAB_TESTING: bool = os.getenv("ALLOW_LAB_TESTING", "true").lower() in ("true", "1", "yes")
    DOCKER_MAX_CPUS: float = float(os.getenv("DOCKER_MAX_CPUS", "2.0"))
    DOCKER_MAX_MEMORY: str = os.getenv("DOCKER_MAX_MEMORY", "2g")
    WORKER_LEASE_SECONDS: int = int(os.getenv("WORKER_LEASE_SECONDS", "300"))
    WORKER_HEARTBEAT_TIMEOUT_SECONDS: int = int(os.getenv("WORKER_HEARTBEAT_TIMEOUT_SECONDS", "180"))
    WORKER_MAX_RETRIES: int = int(os.getenv("WORKER_MAX_RETRIES", "2"))
    GIT_COMMIT: str = os.getenv("RENDER_GIT_COMMIT", os.getenv("VERCEL_GIT_COMMIT_SHA", os.getenv("GIT_COMMIT", "94fafa4")))


    @field_validator("DATABASE_URL", "DATABASE_URL_UNPOOLED", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str | None) -> str | None:
        if not v:
            return v
        # Normalize postgres:// to postgresql+psycopg:// if needed
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+psycopg://", 1)
        if v.startswith("postgresql://") and not v.startswith("postgresql+"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Union[str, List[str], None]) -> List[str]:
        if v is None:
            return DEFAULT_DEV_ORIGINS.copy()
        if isinstance(v, str):
            stripped = v.strip()
            if not stripped:
                return []
            # If JSON array: e.g. ["https://example.com"]
            if stripped.startswith("[") and stripped.endswith("]"):
                try:
                    parsed = json.loads(stripped)
                    if isinstance(parsed, list):
                        origins = [str(item).strip().strip("'\"") for item in parsed if str(item).strip()]
                        if any(o == "*" for o in origins):
                            raise ValueError("Wildcard '*' is prohibited in ALLOWED_ORIGINS when credentials are enabled.")
                        return origins
                except json.JSONDecodeError:
                    pass
            # Comma-separated: "https://example.com, https://app.example.com"
            origins = [item.strip().strip("'\"") for item in stripped.split(",") if item.strip()]
            if any(o == "*" for o in origins):
                raise ValueError("Wildcard '*' is prohibited in ALLOWED_ORIGINS when credentials are enabled.")
            return origins
        elif isinstance(v, list):
            origins = [str(item).strip().strip("'\"") for item in v if str(item).strip()]
            if any(o == "*" for o in origins):
                raise ValueError("Wildcard '*' is prohibited in ALLOWED_ORIGINS when credentials are enabled.")
            return origins
        return DEFAULT_DEV_ORIGINS.copy()

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        env = (self.ENVIRONMENT or "").strip().lower()
        if env == "production":
            insecure_defaults = {
                INSECURE_DEV_SECRET,
                "secret",
                "changeme",
                "change-me",
                "insecure-secret",
                "production",
                "password",
            }
            sec_key = (self.SECRET_KEY or "").strip()
            if not sec_key or sec_key in insecure_defaults or len(sec_key) < 32:
                raise ValueError(
                    "Production startup aborted: A secure, strong SECRET_KEY of at least 32 characters "
                    "must be explicitly configured via environment variables. "
                    "Default development or trivially short secrets are strictly prohibited in production."
                )

            origins = self.ALLOWED_ORIGINS
            if not origins:
                raise ValueError(
                    "Production startup aborted: ALLOWED_ORIGINS must be explicitly configured with at least one "
                    "valid production origin (e.g. 'https://lazynerds.vercel.app'). "
                    "Missing or empty ALLOWED_ORIGINS is prohibited in production."
                )

            has_production_origin = any(
                not (o.startswith("http://localhost") or o.startswith("http://127.0.0.1"))
                for o in origins
            )
            if not has_production_origin:
                raise ValueError(
                    "Production startup aborted: ALLOWED_ORIGINS must contain at least one non-localhost production origin. "
                    "Only localhost origins were detected."
                )
        else:
            # In development/test, if ALLOWED_ORIGINS was empty or unset, restore dev defaults
            if not self.ALLOWED_ORIGINS:
                self.ALLOWED_ORIGINS = DEFAULT_DEV_ORIGINS.copy()
        return self


settings = Settings()
