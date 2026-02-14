from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.services.ai.analysis import analysis_service
from src.api.articles import get_current_user
from src.models.user import User

router = APIRouter()

from typing import List, Optional

class AnalysisRequest(BaseModel):
    text: str
    context: str = ""
    existing_quotes: Optional[List[str]] = []

@router.post("/analyze/stream")
async def stream_analysis(request: AnalysisRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return StreamingResponse(analysis_service.analyze_text(request.text, request.context, user, db, request.existing_quotes), media_type="text/event-stream")
