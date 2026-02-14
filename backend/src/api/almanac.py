from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional, List
from pydantic import BaseModel

from src.core.database import get_db
from src.services import almanac_service

router = APIRouter()

class AlmanacResponse(BaseModel):
    date: date
    yi: List[str]
    ji: List[str]
    icon: Optional[str] = "🌙"

@router.get("/", response_model=AlmanacResponse)
def get_almanac(target_date: Optional[date] = None, db: Session = Depends(get_db)):
    if not target_date:
        target_date = date.today()
        
    almanac = almanac_service.get_almanac(db, target_date)
    if not almanac:
        # User requested to "hide good/bad" if error. 
        # API can return 404 or empty list.
        # Let's return 404 so frontend can handle it by hiding.
        raise HTTPException(status_code=404, detail="Almanac not available")
        
    return almanac
