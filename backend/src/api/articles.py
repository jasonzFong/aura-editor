from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from src.core.database import get_db
from src.services.article import article_service
from src.schemas.article import Article, ArticleCreate, ArticleUpdate
from src.models.user import User
from src.api.deps import get_current_user

router = APIRouter()

@router.put("/reorder")
def reorder_articles(article_ids: List[UUID] = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    article_service.reorder_articles(db, current_user.id, article_ids)
    return {"status": "success"}

@router.post("/", response_model=Article)
def create_article(article: ArticleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return article_service.create_article(db, article, current_user.id)

@router.get("/", response_model=List[Article])
def read_articles(skip: int = 0, limit: int = 100, search: str = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return article_service.get_articles(db, current_user.id, skip, limit, search)

@router.get("/{article_id}", response_model=Article)
def read_article(article_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    article = article_service.get_article(db, article_id, current_user.id)
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return article

@router.put("/{article_id}", response_model=Article)
def update_article(article_id: UUID, article: ArticleUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    updated_article = article_service.update_article(db, article_id, article, current_user.id)
    if updated_article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return updated_article

@router.delete("/{article_id}", response_model=Article)
def delete_article(article_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    deleted_article = article_service.delete_article(db, article_id, current_user.id)
    if deleted_article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return deleted_article
