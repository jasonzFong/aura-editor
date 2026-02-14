from sqlalchemy import Column, String, Boolean, JSON, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from src.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    auth_provider = Column(String, default="email")
    is_active = Column(Boolean, default=True)
    # settings structure: { "ai_enabled": bool, "ai_frequency": "low"|"medium"|"high" }
    settings = Column(JSON, default={"ai_enabled": True, "ai_frequency": "medium"})
    is_scanning_memories = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    comments = relationship("Comment", back_populates="author")
    memories = relationship("Memory", back_populates="owner")
    events = relationship("Event", back_populates="owner")
