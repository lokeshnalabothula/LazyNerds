import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.session import Base


from app.models.organization import PRIMARY_ORGANIZATION_ID


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


DEFAULT_WORKER_PERMISSIONS = [
    "clients:read",
    "clients:write",
    "engagements:read",
    "engagements:write",
    "assets:read",
    "assets:write",
    "findings:read",
    "findings:write",
    "scans:launch",
    "scans:read",
    "reports:read",
    "reports:write",
    "domains:read",
]


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="client", server_default="client", nullable=False)
    permissions = Column(Text, nullable=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, default=PRIMARY_ORGANIZATION_ID, index=True)
    client_id = Column(String(36), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    organization = relationship("Organization", foreign_keys=[organization_id], back_populates="members")
    client = relationship("Client", foreign_keys=[client_id], back_populates="users")

    @property
    def is_owner(self) -> bool:
        return self.role in ("owner", "founder", "admin")

    @property
    def is_worker(self) -> bool:
        return self.role in ("worker", "employee")

    @property
    def is_client(self) -> bool:
        return self.role == "client"

    def get_permissions_list(self) -> List[str]:
        if self.is_owner:
            return ["*"]
        if self.permissions:
            try:
                parsed = json.loads(self.permissions)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
        if self.is_worker:
            return list(DEFAULT_WORKER_PERMISSIONS)
        return []

    def set_permissions_list(self, perms: List[str]) -> None:
        self.permissions = json.dumps(perms)

    def has_permission(self, perm: str) -> bool:
        if self.is_owner:
            return True
        perms = self.get_permissions_list()
        return "*" in perms or perm in perms

    def __repr__(self) -> str:
        return f"<User(id='{self.id}', email='{self.email}', role='{self.role}', org='{self.organization_id}')>"
