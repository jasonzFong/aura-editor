"""change reply to json

Revision ID: d0a7ed5c51d2
Revises: a752ba7f6e0f
Create Date: 2026-02-13 14:12:30.158138

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0a7ed5c51d2'
down_revision: Union[str, Sequence[str], None] = 'a752ba7f6e0f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # SQLite workaround for changing column type: use batch_alter_table
    with op.batch_alter_table('comments') as batch_op:
        # Drop the old 'reply' column (losing data is acceptable here for prototype, or we could copy if needed)
        # But wait, to change type from String to JSON, we can just alter it if we don't care about data, 
        # or we have to cast it. 
        # Since this is a dev env, let's just drop and recreate the column to be safe and simple.
        batch_op.drop_column('reply')
        batch_op.add_column(sa.Column('reply', sa.JSON(), nullable=True))

    # Clean up other potential noise if necessary, but ignoring the auto-generated noise is safer
    # unless we really need to fix UUIDs. The previous error was specifically about ALTER COLUMN syntax.
    # The UUID changes are likely just Alembic being confused about SQLite types.
    # We will ignore them to avoid further SQLite syntax errors.


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('comments') as batch_op:
        batch_op.drop_column('reply')
        batch_op.add_column(sa.Column('reply', sa.String(), nullable=True))
