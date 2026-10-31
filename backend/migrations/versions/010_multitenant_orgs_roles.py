"""multitenant organizations, role hierarchy, and resource scoping

Revision ID: 010_multitenant_organizations_and_roles
Revises: 009_registration_tokens
Create Date: 2026-10-31 23:30:00.000000

"""
from typing import Sequence, Union
import uuid
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa


revision: str = "010_multitenant_orgs_roles"
down_revision: Union[str, None] = "009_registration_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PRIMARY_ORG_ID = "00000000-0000-4000-a000-000000000001"


def upgrade() -> None:
    now = datetime.now(timezone.utc)

    # 1. Create organizations table
    op.create_table(
        "organizations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_organizations"),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)
    op.create_index("idx_organizations_owner", "organizations", ["owner_id"])

    # 2. Add organization_id and permissions to users
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("organization_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("permissions", sa.Text(), nullable=True))
        batch_op.create_foreign_key(
            "fk_users_organization_id",
            "organizations",
            ["organization_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index("idx_users_organization_id", ["organization_id"])

    # 3. Add organization_id to clients
    with op.batch_alter_table("clients") as batch_op:
        batch_op.add_column(sa.Column("organization_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_clients_organization_id",
            "organizations",
            ["organization_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index("idx_clients_organization_id", ["organization_id"])
        batch_op.create_index("idx_clients_org_status", ["organization_id", "status"])

    # 4. Add organization_id to engagements
    with op.batch_alter_table("engagements") as batch_op:
        batch_op.add_column(sa.Column("organization_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_engagements_organization_id",
            "organizations",
            ["organization_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index("idx_engagements_organization_id", ["organization_id"])
        batch_op.create_index("idx_engagements_org_status", ["organization_id", "status"])

    # 5. Add organization_id to assets
    with op.batch_alter_table("assets") as batch_op:
        batch_op.add_column(sa.Column("organization_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_assets_organization_id",
            "organizations",
            ["organization_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index("idx_assets_organization_id", ["organization_id"])
        batch_op.create_index("idx_assets_org_scope", ["organization_id", "in_scope"])

    # 6. Add organization_id to domains
    with op.batch_alter_table("domains") as batch_op:
        batch_op.add_column(sa.Column("organization_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_domains_organization_id",
            "organizations",
            ["organization_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index("idx_domains_organization_id", ["organization_id"])
        batch_op.create_index("idx_domains_org_status", ["organization_id", "verification_status"])

    # 7. Add organization_id to audit_logs
    with op.batch_alter_table("audit_logs") as batch_op:
        batch_op.add_column(sa.Column("organization_id", sa.String(length=36), nullable=True))
        batch_op.create_index("idx_audit_logs_organization_id", ["organization_id"])
        batch_op.create_index("idx_audit_logs_org_created", ["organization_id", "created_at"])

    # 8. Add organization_id to client_registrations
    with op.batch_alter_table("client_registrations") as batch_op:
        batch_op.add_column(sa.Column("organization_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_client_reg_organization_id",
            "organizations",
            ["organization_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("idx_client_reg_organization_id", ["organization_id"])
        batch_op.create_index("idx_client_reg_org_status", ["organization_id", "status"])

    # 9. Seed primary organization and backfill existing data safely
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at) "
            "VALUES (:id, :name, :slug, NULL, :created_at, :updated_at)"
        ),
        {
            "id": PRIMARY_ORG_ID,
            "name": "Lazy Nerds",
            "slug": "lazy-nerds",
            "created_at": now,
            "updated_at": now,
        },
    )

    # Associate founder account using explicit, stable identifier
    conn.execute(
        sa.text(
            "UPDATE users SET organization_id = :org_id, role = 'owner' "
            "WHERE email = 'lokeshnalabothula@gmail.com' OR role IN ('founder', 'admin')"
        ),
        {"org_id": PRIMARY_ORG_ID},
    )
    conn.execute(
        sa.text(
            "UPDATE organizations SET owner_id = ("
            "  SELECT id FROM users "
            "  WHERE organization_id = :org_id AND role = 'owner' "
            "  ORDER BY (email = 'lokeshnalabothula@gmail.com') DESC, created_at ASC LIMIT 1"
            ") WHERE id = :org_id"
        ),
        {"org_id": PRIMARY_ORG_ID},
    )

    # Backfill remaining users and clients to primary organization safely
    conn.execute(
        sa.text("UPDATE users SET organization_id = :org_id WHERE organization_id IS NULL"),
        {"org_id": PRIMARY_ORG_ID},
    )
    conn.execute(
        sa.text("UPDATE clients SET organization_id = :org_id WHERE organization_id IS NULL"),
        {"org_id": PRIMARY_ORG_ID},
    )
    conn.execute(
        sa.text(
            "UPDATE engagements SET organization_id = ("
            "  SELECT organization_id FROM clients WHERE clients.id = engagements.client_id"
            ") WHERE organization_id IS NULL"
        )
    )
    conn.execute(
        sa.text("UPDATE engagements SET organization_id = :org_id WHERE organization_id IS NULL"),
        {"org_id": PRIMARY_ORG_ID},
    )
    conn.execute(
        sa.text(
            "UPDATE assets SET organization_id = ("
            "  SELECT organization_id FROM clients WHERE clients.id = assets.client_id"
            ") WHERE organization_id IS NULL"
        )
    )
    conn.execute(
        sa.text("UPDATE assets SET organization_id = :org_id WHERE organization_id IS NULL"),
        {"org_id": PRIMARY_ORG_ID},
    )
    conn.execute(
        sa.text(
            "UPDATE domains SET organization_id = ("
            "  SELECT organization_id FROM clients WHERE clients.id = domains.client_id"
            ") WHERE organization_id IS NULL"
        )
    )
    conn.execute(
        sa.text("UPDATE domains SET organization_id = :org_id WHERE organization_id IS NULL"),
        {"org_id": PRIMARY_ORG_ID},
    )


def downgrade() -> None:
    with op.batch_alter_table("client_registrations") as batch_op:
        batch_op.drop_index("idx_client_reg_org_status")
        batch_op.drop_index("idx_client_reg_organization_id")
        batch_op.drop_constraint("fk_client_reg_organization_id", type_="foreignkey")
        batch_op.drop_column("organization_id")

    with op.batch_alter_table("audit_logs") as batch_op:
        batch_op.drop_index("idx_audit_logs_org_created")
        batch_op.drop_index("idx_audit_logs_organization_id")
        batch_op.drop_column("organization_id")

    with op.batch_alter_table("domains") as batch_op:
        batch_op.drop_index("idx_domains_org_status")
        batch_op.drop_index("idx_domains_organization_id")
        batch_op.drop_constraint("fk_domains_organization_id", type_="foreignkey")
        batch_op.drop_column("organization_id")

    with op.batch_alter_table("assets") as batch_op:
        batch_op.drop_index("idx_assets_org_scope")
        batch_op.drop_index("idx_assets_organization_id")
        batch_op.drop_constraint("fk_assets_organization_id", type_="foreignkey")
        batch_op.drop_column("organization_id")

    with op.batch_alter_table("engagements") as batch_op:
        batch_op.drop_index("idx_engagements_org_status")
        batch_op.drop_index("idx_engagements_organization_id")
        batch_op.drop_constraint("fk_engagements_organization_id", type_="foreignkey")
        batch_op.drop_column("organization_id")

    with op.batch_alter_table("clients") as batch_op:
        batch_op.drop_index("idx_clients_org_status")
        batch_op.drop_index("idx_clients_organization_id")
        batch_op.drop_constraint("fk_clients_organization_id", type_="foreignkey")
        batch_op.drop_column("organization_id")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index("idx_users_organization_id")
        batch_op.drop_constraint("fk_users_organization_id", type_="foreignkey")
        batch_op.drop_column("permissions")
        batch_op.drop_column("organization_id")

    op.drop_index("idx_organizations_owner", table_name="organizations")
    op.drop_index("ix_organizations_slug", table_name="organizations")
    op.drop_table("organizations")
