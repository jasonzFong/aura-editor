from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "Aura"
    API_V1_STR: str = "/api/v1"
    
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "aura"
    DATABASE_URL: str | None = None

    SECRET_KEY: str = "YOUR_SECRET_KEY_HERE"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200 # 30 days
    
    AI_PROVIDER: str = "deepseek"
    DEEPSEEK_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    AI_MODEL: str = ""

    class Config:
        env_file = ".env"

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        # Fallback to SQLite for easier local testing if Postgres env vars aren't set/working
        return "sqlite:///./sql_app.db"

@lru_cache
def get_settings():
    return Settings()

settings = get_settings()
