"""Add user_maps table for user-defined maps.

Revision ID: add_user_maps
Revises: add_project_vehicle_model
Create Date: 2026-03-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "add_user_maps"
down_revision: Union[str, Sequence[str], None] = "add_user_profile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema. Skip if table already exists (e.g. created by init_db or previous run)."""
    conn = op.get_bind()
    insp = inspect(conn)
    if "user_maps" in insp.get_table_names():
        return
    op.create_table(
        "user_maps",
        sa.Column("user_map_id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("file_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("type", sa.String(length=10), nullable=False),
        sa.Column("byte_offset_start", sa.BigInteger(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("data_type", sa.String(length=20), nullable=False),
        sa.Column(
            "dimensions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "config",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.project_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["file_id"], ["firmware_files.file_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_map_id"),
    )
    op.create_index(
        "idx_user_maps_project_id", "user_maps", ["project_id"], unique=False
    )
    op.create_index("idx_user_maps_file_id", "user_maps", ["file_id"], unique=False)
    op.create_index("idx_user_maps_user_id", "user_maps", ["user_id"], unique=False)
    op.create_index(
        "idx_user_maps_file_offset",
        "user_maps",
        ["file_id", "byte_offset_start"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_user_maps_file_offset", table_name="user_maps")
    op.drop_index("idx_user_maps_user_id", table_name="user_maps")
    op.drop_index("idx_user_maps_file_id", table_name="user_maps")
    op.drop_index("idx_user_maps_project_id", table_name="user_maps")
    op.drop_table("user_maps")

