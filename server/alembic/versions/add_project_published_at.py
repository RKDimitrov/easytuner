"""Add published_at to projects for library feature

Revision ID: add_published_at
Revises: 6ba2e143f0af
Create Date: 2025-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'add_published_at'
down_revision: Union[str, Sequence[str], None] = '6ba2e143f0af'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'projects',
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index('idx_projects_published_at', 'projects', ['published_at'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_projects_published_at', table_name='projects')
    op.drop_column('projects', 'published_at')
