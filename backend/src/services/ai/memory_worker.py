from sqlalchemy.orm import Session
from src.models.memory import Memory
from uuid import UUID

class MemoryService:
    def get_memories(self, db: Session, user_id: UUID):
        return db.query(Memory).filter(Memory.user_id == user_id).all()

    def add_memory(self, db: Session, user_id: UUID, key: str, value: any, confidence: str = "medium", category: str = "knowledge", source_article_id: UUID = None):
        # Check if memory exists
        existing = db.query(Memory).filter(Memory.user_id == user_id, Memory.key == key).first()
        if existing:
            if existing.is_locked:
                return existing # Do not update if locked
            
            # Update only if source article is newer (handled by caller logic usually, but here we just update)
            # Or if we want to enforce conflict resolution here.
            # For now, just update.
            existing.value = value
            existing.confidence = confidence
            existing.category = category
            if source_article_id:
                existing.source_article_id = source_article_id
            db.commit()
            return existing
        
        new_memory = Memory(
            user_id=user_id, 
            key=key, 
            value=value, 
            confidence=confidence,
            category=category,
            source_article_id=source_article_id
        )
        db.add(new_memory)
        db.commit()
        db.refresh(new_memory)
        return new_memory

memory_service = MemoryService()
