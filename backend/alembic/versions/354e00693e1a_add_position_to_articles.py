"""add position to articles

Revision ID: 354e00693e1a
Revises: 88e1b28d6ccd
Create Date: 2026-02-12 16:43:11.493739

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '354e00693e1a'
down_revision: Union[str, Sequence[str], None] = '88e1b28d6ccd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('articles', sa.Column('position', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('articles', 'position')
