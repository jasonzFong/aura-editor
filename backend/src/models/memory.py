from sqlalchemy import Column, String, JSON, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from src.core.database import Base

class Memory(Base):
    __tablename__ = "memories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    key = Column(String, index=True, nullable=False) # e.g., "writing_style_preference"
    value = Column(JSON, nullable=False) # e.g., {"content": "...", "emoji": "..."}
    category = Column(String, default="knowledge", index=True) # preferences, knowledge, concept
    is_locked = Column(Boolean, default=False)
    confidence = Column(String, default="low") # low, medium, high
    source_comment_id = Column(UUID(as_uuid=True), ForeignKey("comments.id"), nullable=True)
    source_article_id = Column(UUID(as_uuid=True), ForeignKey("articles.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(String, default="system") # system, user

    owner = relationship("User", back_populates="memories")
