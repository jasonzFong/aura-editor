from sqlalchemy.orm import Session
from src.models.article import Article
from src.schemas.article import ArticleCreate, ArticleUpdate
from uuid import UUID

class ArticleService:
    def create_article(self, db: Session, article: ArticleCreate, user_id: UUID):
        db_article = Article(**article.model_dump(), user_id=user_id)
        db.add(db_article)
        db.commit()
        db.refresh(db_article)
        return db_article

    def get_articles(self, db: Session, user_id: UUID, skip: int = 0, limit: int = 100, search: str = None):
        query = db.query(Article).filter(Article.user_id == user_id, Article.is_deleted == False)
        if search:
            query = query.filter(Article.title.ilike(f"%{search}%"))
        return query.order_by(Article.position.asc(), Article.updated_at.desc()).offset(skip).limit(limit).all()

    def get_article(self, db: Session, article_id: UUID, user_id: UUID):
        return db.query(Article).filter(Article.id == article_id, Article.user_id == user_id, Article.is_deleted == False).first()

    def update_article(self, db: Session, article_id: UUID, article_update: ArticleUpdate, user_id: UUID):
        db_article = self.get_article(db, article_id, user_id)
        if not db_article:
            return None
        update_data = article_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_article, key, value)
        db.commit()
        db.refresh(db_article)
        return db_article

    def delete_article(self, db: Session, article_id: UUID, user_id: UUID):
        db_article = self.get_article(db, article_id, user_id)
        if not db_article:
            return None
        db_article.is_deleted = True
        db.commit()
        return db_article

    def reorder_articles(self, db: Session, user_id: UUID, article_ids: list[UUID]):
        # Batch update positions
        # Using a case statement or just iterating. Iterating is fine for 100 items.
        # But to be safer/faster, we can update in transaction.
        # Note: We do NOT update 'updated_at' here, as reordering is a meta-operation.
        # SQLAlchemy's `onupdate` usually triggers on any update, but `update()` method might bypass it unless configured otherwise.
        # However, to be explicit, we can just update the position column.
        for index, article_id in enumerate(article_ids):
             db.query(Article).filter(Article.id == article_id, Article.user_id == user_id).update({"position": index}, synchronize_session=False)
        db.commit()
        return True

article_service = ArticleService()
