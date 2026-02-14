from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.api.articles import get_current_user
from src.models.user import User
from src.models.memory import Memory
from pydantic import BaseModel
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

router = APIRouter()

class MemoryResponse(BaseModel):
    id: UUID
    key: str
    value: Dict[str, Any]
    category: str
    is_locked: bool
    confidence: str
    created_at: Any
    updated_at: Any
    updated_by: Optional[str] = None
    
    class Config:
        from_attributes = True

class MemoryCreate(BaseModel):
    content: str
    category: str = "Knowledge"
    confidence: str = "low"
    emoji: str = "📝"

class MemoryUpdate(BaseModel):
    is_locked: Optional[bool] = None
    content: Optional[str] = None
    confidence: Optional[str] = None
    category: Optional[str] = None
    emoji: Optional[str] = None

import re

def generate_key(content: str) -> str:
    # Simple slugify: lowercase, remove non-alphanumeric, replace spaces with underscores
    # Limit to 50 chars
    slug = re.sub(r'[^a-z0-9\s]', '', content.lower())
    slug = re.sub(r'\s+', '_', slug)
    if not slug:
        return f"memory_{uuid4().hex[:8]}"
    return slug[:50]

@router.post("/", response_model=MemoryResponse)
def create_memory(memory_in: MemoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Generate key automatically
    key = generate_key(memory_in.content)
    
    # Ensure key uniqueness for user? 
    # Usually keys should be unique, but if we generate from content, duplicates might occur.
    # We can append random suffix if exists, but let's assume duplication is allowed or handled by overwriting?
    # No, we should probably make it unique.
    existing = db.query(Memory).filter(Memory.user_id == current_user.id, Memory.key == key).first()
    if existing:
        key = f"{key}_{uuid4().hex[:4]}"
    
    new_memory = Memory(
        user_id=current_user.id,
        key=key,
        value={"content": memory_in.content, "emoji": memory_in.emoji},
        category=memory_in.category,
        confidence=memory_in.confidence,
        updated_by="user",
        is_locked=False
    )
    db.add(new_memory)
    db.commit()
    db.refresh(new_memory)
    return new_memory

@router.get("/", response_model=list[MemoryResponse])
def get_memories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Memory).filter(Memory.user_id == current_user.id).all()

@router.put("/{memory_id}", response_model=MemoryResponse)
def update_memory(memory_id: UUID, update: MemoryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    memory = db.query(Memory).filter(Memory.id == memory_id, Memory.user_id == current_user.id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    if update.is_locked is not None:
        memory.is_locked = update.is_locked
    
    if update.content is not None or update.emoji is not None:
        # Create a new value dict to trigger SQLAlchemy change tracking
        new_value = dict(memory.value)
        if update.content is not None:
            new_value['content'] = update.content
        if update.emoji is not None:
            new_value['emoji'] = update.emoji
        memory.value = new_value
        memory.updated_by = "user" # Mark as manually updated
        # If user manually edits, we might want to lock it automatically or just update it.
        # Let's keep is_locked independent unless specified.
        
    if update.confidence is not None:
        if update.confidence in ['high', 'medium', 'low']:
            memory.confidence = update.confidence
    
    if update.category is not None:
        memory.category = update.category
    
    db.commit()
    db.refresh(memory)
    return memory

@router.delete("/{memory_id}")
def delete_memory(memory_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    memory = db.query(Memory).filter(Memory.id == memory_id, Memory.user_id == current_user.id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    db.delete(memory)
    db.commit()
    return {"message": "Memory deleted successfully"}
