from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.api.articles import get_current_user
from src.models.user import User
from src.schemas.user import UserSettingsUpdate, UserSettingsResponse

router = APIRouter()

@router.get("/settings", response_model=UserSettingsResponse)
def get_user_settings(current_user: User = Depends(get_current_user)):
    # Ensure default structure if empty
    settings = current_user.settings or {}
    default_settings = {"ai_enabled": True, "ai_frequency": "medium"}
    # Merge defaults
    final_settings = {**default_settings, **settings}
    return {"settings": final_settings, "is_scanning": current_user.is_scanning_memories}

@router.put("/settings", response_model=UserSettingsResponse)
def update_user_settings(update_data: UserSettingsUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_settings = current_user.settings or {}
    new_settings = {**current_settings, **update_data.settings}
    
    current_user.settings = new_settings
    # Explicitly flag modified for SQLAlchemy JSON tracking
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(current_user, "settings")
    
    db.commit()
    db.refresh(current_user)
    return {"settings": current_user.settings, "is_scanning": current_user.is_scanning_memories}
