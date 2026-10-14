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
    INITIAL_ADMIN_EMAIL: str = "founder@lazynerds.com"
    INITIAL_ADMIN_PASSWORD: str = "AdminFixOps2026!"
    INITIAL_ADMIN_NAME: str = "Lazy Nerds Founder"

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
                        origins = [str(item).strip() for item in parsed if str(item).strip()]
                        if any(o == "*" for o in origins):
                            raise ValueError("Wildcard '*' is prohibited in ALLOWED_ORIGINS when credentials are enabled.")
                        return origins
                except json.JSONDecodeError:
                    pass
            # Comma-separated: "https://example.com, https://app.example.com"
            origins = [item.strip() for item in stripped.split(",") if item.strip()]
            if any(o == "*" for o in origins):
                raise ValueError("Wildcard '*' is prohibited in ALLOWED_ORIGINS when credentials are enabled.")
            return origins
        elif isinstance(v, list):
            origins = [str(item).strip() for item in v if str(item).strip()]
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
                    "valid production origin (e.g. 'https://lokeshnalabothula.in, https://your-app.vercel.app'). "
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
