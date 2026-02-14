from pydantic import BaseModel
from typing import Dict, Any

class UserSettingsUpdate(BaseModel):
    settings: Dict[str, Any]

class UserSettingsResponse(BaseModel):
    settings: Dict[str, Any]
    is_scanning: bool = False
