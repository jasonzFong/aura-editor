import sys
import os
sys.path.append(os.getcwd())

from src.core.database import SessionLocal
from src.models.user import User
from src.services.auth import auth_service
from src.core.database import Base, engine

def create_test_user():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "test@example.com").first()
        if not user:
            print("Creating test user: test@example.com / password123")
            hashed_pw = auth_service.get_password_hash("password123")
            new_user = User(
                email="test@example.com",
                password_hash=hashed_pw,
                is_active=True
            )
            db.add(new_user)
            db.commit()
            print("User created successfully.")
        else:
            print("Test user already exists.")
    except Exception as e:
        print(f"Error creating user: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_test_user()
