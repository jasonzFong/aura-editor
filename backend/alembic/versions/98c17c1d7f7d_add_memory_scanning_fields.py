"""Add memory scanning fields

Revision ID: 98c17c1d7f7d
Revises: 87c17c1d7f7c
Create Date: 2026-02-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '98c17c1d7f7d'
down_revision: Union[str, Sequence[str], None] = '87c17c1d7f7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch_alter_table for SQLite compatibility
    with op.batch_alter_table('articles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('last_scanned_at', sa.DateTime(), nullable=True))
    
    with op.batch_alter_table('memories', schema=None) as batch_op:
        batch_op.add_column(sa.Column('category', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('is_locked', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('source_article_id', sa.UUID(), nullable=True))
        batch_op.create_foreign_key('fk_memories_articles', 'articles', ['source_article_id'], ['id'])
    
    # Set default values for existing rows if needed
    op.execute("UPDATE memories SET category = 'knowledge' WHERE category IS NULL")
    op.execute("UPDATE memories SET is_locked = FALSE WHERE is_locked IS NULL")


def downgrade() -> None:
    with op.batch_alter_table('memories', schema=None) as batch_op:
        batch_op.drop_constraint('fk_memories_articles', type_='foreignkey')
        batch_op.drop_column('source_article_id')
        batch_op.drop_column('is_locked')
        batch_op.drop_column('category')

    with op.batch_alter_table('articles', schema=None) as batch_op:
        batch_op.drop_column('last_scanned_at')
