import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    SECRET_KEY: str = "insecure-dev-secret-key-change-in-production-lazy-nerds-fixops-2026"
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

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # Initial Admin Seed
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


settings = Settings()
