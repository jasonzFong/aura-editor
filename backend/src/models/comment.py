from sqlalchemy import Column, String, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from src.core.database import Base

class Comment(Base):
    __tablename__ = "comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    article_id = Column(UUID(as_uuid=True), ForeignKey("articles.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    quote = Column(String, nullable=True)
    range = Column(JSON, nullable=True) # {from: int, to: int}
    content = Column(String, nullable=False)
    type = Column(String, default="suggestion") # praise, criticism, suggestion
    status = Column(String, default="active")
    reply = Column(JSON, default=[]) # [{role: "user" | "ai", content: str, timestamp: str}]
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("User", back_populates="comments")
