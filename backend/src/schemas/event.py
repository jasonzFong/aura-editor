from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID

class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    is_all_day: bool = False
    color: str = "blue"

class EventCreate(EventBase):
    pass

class Event(EventBase):
    id: int
    user_id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True
