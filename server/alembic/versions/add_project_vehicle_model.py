"""Add vehicle_model to projects for map assistant

Revision ID: add_vehicle_model
Revises: add_published_at
Create Date: 2025-03-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'add_vehicle_model'
down_revision: Union[str, Sequence[str], None] = 'add_published_at'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'projects',
        sa.Column('vehicle_model', sa.String(255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('projects', 'vehicle_model')
