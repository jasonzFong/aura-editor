from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel
from typing import Optional, List
from src.core.database import get_db
from src.models.comment import Comment
from src.api.articles import get_current_user
from src.models.user import User

router = APIRouter()

class CommentCreate(BaseModel):
    article_id: UUID
    content: str
    quote: Optional[str] = None
    range: Optional[dict] = None
    type: str = "suggestion"

class CommentReplyRequest(BaseModel):
    content: str

@router.post("/", response_model=dict)
def create_comment(comment: CommentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if content is NO_COMMENT
    if comment.content.strip() == ">> NO_COMMENT" or comment.content.strip() == "NO_COMMENT":
        return {"status": "skipped", "reason": "no_comment"}

    new_comment = Comment(
        article_id=comment.article_id,
        user_id=current_user.id,
        content=comment.content,
        quote=comment.quote,
        range=comment.range,
        type=comment.type,
        status="active"
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    return {
        "id": str(new_comment.id),
        "content": new_comment.content,
        "type": new_comment.type,
        "quote": new_comment.quote,
        "range": new_comment.range,
        "status": new_comment.status,
        "reply": new_comment.reply,
        "created_at": new_comment.created_at
    }

@router.get("/article/{article_id}")
def get_article_comments(article_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    comments = db.query(Comment).filter(
        Comment.article_id == article_id,
        Comment.user_id == current_user.id
    ).order_by(Comment.created_at.desc()).all()
    
    return [
        {
            "id": str(c.id),
            "content": c.content,
            "type": c.type,
            "quote": c.quote,
            "range": c.range,
            "status": c.status,
            "reply": c.reply,
            "created_at": c.created_at
        }
        for c in comments
    ]

@router.put("/{comment_id}/resolve")
def resolve_comment(comment_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.user_id == current_user.id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    comment.status = "resolved"
    db.commit()
    return {"status": "resolved"}

from src.services.ai.analysis import analysis_service
import datetime

@router.post("/{comment_id}/reply")
async def reply_comment(comment_id: UUID, reply: CommentReplyRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.user_id == current_user.id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Initialize reply list if it's None (due to migration)
    if comment.reply is None:
        comment.reply = []
    
    # Ensure comment.reply is a list (it should be JSON now)
    if isinstance(comment.reply, str):
        # Fallback/Migration: convert old string format to list if any
        comment.reply = [{"role": "user", "content": comment.reply, "timestamp": datetime.datetime.utcnow().isoformat()}] if comment.reply else []

    # 1. Append User's reply
    user_message = {
        "role": "user",
        "content": reply.content,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    # We need to create a new list to trigger SQLAlchemy detection of mutation on JSON column
    new_history = list(comment.reply)
    new_history.append(user_message)
    comment.reply = new_history
    db.commit()
    
    # 2. Trigger AI Response
    try:
        context_data = {
            "quote": comment.quote,
            "original_suggestion": comment.content
        }
        
        full_response = ""
        # Use the new reply_to_comment method
        async for chunk in analysis_service.reply_to_comment(new_history, context_data, current_user, db):
            full_response += chunk
            
        # 3. Append AI's response
        ai_message = {
            "role": "ai",
            "content": full_response,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
        
        updated_history = list(comment.reply)
        updated_history.append(ai_message)
        comment.reply = updated_history
        db.commit()
        
        return {
            "status": "replied", 
            "ai_response": full_response,
            "reply_list": comment.reply
        }
        
    except Exception as e:
        print(f"AI Generation failed: {e}")
        # Even if AI fails, the user message is saved.
        return {"status": "saved_user_reply_only", "error": str(e), "reply_list": comment.reply}
