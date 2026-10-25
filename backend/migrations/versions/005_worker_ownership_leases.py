"""scanner worker ownership and lease recovery

Revision ID: 005_worker_ownership_leases
Revises: 004_roles_registrations_auth
Create Date: 2026-10-25 11:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "005_worker_ownership_leases"
down_revision: Union[str, None] = "004_roles_registrations_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("assessments") as batch_op:
        batch_op.add_column(sa.Column("worker_id", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"))
        batch_op.create_index("idx_assessments_worker_id", ["worker_id"])
        batch_op.create_index("idx_assessments_lease_expires_at", ["lease_expires_at"])


def downgrade() -> None:
    with op.batch_alter_table("assessments") as batch_op:
        batch_op.drop_index("idx_assessments_lease_expires_at")
        batch_op.drop_index("idx_assessments_worker_id")
        batch_op.drop_column("retry_count")
        batch_op.drop_column("lease_expires_at")
        batch_op.drop_column("last_heartbeat_at")
        batch_op.drop_column("claimed_at")
        batch_op.drop_column("worker_id")
