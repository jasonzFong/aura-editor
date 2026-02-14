from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List

from src.core.database import get_db
from src.api.deps import get_current_user
from src.models.user import User
from src.models.event import Event
from src.schemas.event import EventCreate, Event as EventSchema

router = APIRouter()

@router.post("/", response_model=EventSchema)
def create_event(
    event: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_event = Event(
        user_id=current_user.id,
        title=event.title,
        description=event.description,
        start_time=event.start_time,
        end_time=event.end_time,
        is_all_day=event.is_all_day,
        color=event.color
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event

@router.get("/", response_model=List[EventSchema])
def get_events(
    start: datetime,
    end: datetime,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch events in range
    events = db.query(Event).filter(
        Event.user_id == current_user.id,
        Event.start_time >= start,
        Event.start_time <= end
    ).all()
    return events

@router.put("/{event_id}", response_model=EventSchema)
def update_event(
    event_id: int,
    event_update: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    event = db.query(Event).filter(Event.id == event_id, Event.user_id == current_user.id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event.title = event_update.title
    event.description = event_update.description
    event.start_time = event_update.start_time
    event.end_time = event_update.end_time
    event.is_all_day = event_update.is_all_day
    event.color = event_update.color
    
    db.commit()
    db.refresh(event)
    return event

@router.delete("/{event_id}")
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    event = db.query(Event).filter(Event.id == event_id, Event.user_id == current_user.id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    db.delete(event)
    db.commit()
    return {"ok": True}
