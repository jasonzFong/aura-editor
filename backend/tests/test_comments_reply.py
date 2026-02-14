
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.main import app
from src.core.database import Base, get_db
from src.models.user import User
from src.models.article import Article
from src.models.comment import Comment
from src.api.articles import get_current_user
import uuid
from unittest.mock import MagicMock, patch

# Mock AI Analysis Service
mock_analysis_service = MagicMock()
async def mock_reply_generator(*args, **kwargs):
    yield "Here "
    yield "is "
    yield "a "
    yield "reply."

mock_analysis_service.reply_to_comment.side_effect = mock_reply_generator

from sqlalchemy.pool import StaticPool

# Shared DB Setup
engine = create_engine(
    "sqlite:///:memory:", 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture
def db_session():
    # Return a session for test setup
    db = TestingSessionLocal()
    yield db
    db.close()
    # Optionally clean up tables
    # Base.metadata.drop_all(bind=engine)
    # Base.metadata.create_all(bind=engine)

@pytest.fixture
def test_user(db_session):
    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        password_hash="hashed_secret",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    return user

@pytest.fixture
def test_article(db_session, test_user):
    article = Article(
        id=uuid.uuid4(),
        title="Test Article",
        content={"type": "doc", "content": []},
        user_id=test_user.id
    )
    db_session.add(article)
    db_session.commit()
    return article

@pytest.fixture
def test_comment(db_session, test_article, test_user):
    comment = Comment(
        id=uuid.uuid4(),
        article_id=test_article.id,
        user_id=test_user.id,
        content="AI Suggestion",
        quote="Original Text",
        reply=[] # Start empty
    )
    db_session.add(comment)
    db_session.commit()
    return comment

def test_reply_comment_flow(db_session):
    # Setup data
    user = User(id=uuid.uuid4(), email="test2@example.com", password_hash="pw", is_active=True)
    db_session.add(user)
    db_session.commit()
    
    article = Article(id=uuid.uuid4(), title="T", content={}, user_id=user.id)
    db_session.add(article)
    db_session.commit()
    
    comment = Comment(id=uuid.uuid4(), article_id=article.id, user_id=user.id, content="Sug", quote="Q", reply=[])
    db_session.add(comment)
    db_session.commit()
    
    # Override get_current_user
    app.dependency_overrides[get_current_user] = lambda: user

# ... (imports)

# ... (mocks)

def test_reply_comment_flow(db_session):
    # Setup data
    user = User(id=uuid.uuid4(), email="test2@example.com", password_hash="pw", is_active=True)
    db_session.add(user)
    db_session.commit()
    
    article = Article(id=uuid.uuid4(), title="T", content={}, user_id=user.id)
    db_session.add(article)
    db_session.commit()
    
    comment = Comment(id=uuid.uuid4(), article_id=article.id, user_id=user.id, content="Sug", quote="Q", reply=[])
    db_session.add(comment)
    db_session.commit()
    
    # Override get_current_user
    app.dependency_overrides[get_current_user] = lambda: user
    
    try:
        # We need to patch the imported analysis_service instance in src.api.comments
        with patch("src.api.comments.analysis_service", mock_analysis_service):
            response = client.post(
                f"/api/v1/comments/{comment.id}/reply",
                json={"content": "My reply"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "replied"
            assert data["ai_response"] == "Here is a reply."
            
            # Verify history structure
            history = data["reply_list"]
            assert len(history) == 2
            assert history[0]["role"] == "user"
            assert history[0]["content"] == "My reply"
            assert history[1]["role"] == "ai"
            assert history[1]["content"] == "Here is a reply."
    finally:
        # Clean up overrides
        del app.dependency_overrides[get_current_user]


