from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.core.config import settings
from src.api import auth, articles, ai, comments, user, memories, almanac, events

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from src.core.database import SessionLocal, Base, engine
from src.services.ai.background_scanner import background_scanner
from src.services import almanac_service
import asyncio
import logging

# Configure logging to show INFO level logs in the console
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    force=True
)

app = FastAPI(title=settings.PROJECT_NAME)

scheduler = AsyncIOScheduler()

async def run_background_scan():
    # Create a new DB session for the background task
    db = SessionLocal()
    try:
        await background_scanner.scan_all_users(db)
    finally:
        db.close()

@app.on_event("startup")
async def start_scheduler():
    Base.metadata.create_all(bind=engine)
    
    # Run scan every 5 minutes (or configurable globally, but user settings control if it actually does anything)
    # The requirement says "configure how often scanning occurs". 
    # If users have different intervals, we should run frequently and check validity inside the scanner.
    scheduler.add_job(run_background_scan, 'interval', minutes=1)
    
    # Run daily almanac update at 00:01
    scheduler.add_job(almanac_service.run_daily_almanac_job, 'cron', hour=0, minute=1)
    # Run once now for testing/initialization
    scheduler.add_job(almanac_service.run_daily_almanac_job)
    
    scheduler.start()

@app.on_event("shutdown")
async def shutdown_scheduler():
    scheduler.shutdown()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Vite default
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(articles.router, prefix=f"{settings.API_V1_STR}/articles", tags=["articles"])
app.include_router(ai.router, prefix=f"{settings.API_V1_STR}/ai", tags=["ai"])
app.include_router(comments.router, prefix=f"{settings.API_V1_STR}/comments", tags=["comments"])
app.include_router(user.router, prefix=f"{settings.API_V1_STR}/user", tags=["user"])
app.include_router(memories.router, prefix=f"{settings.API_V1_STR}/memories", tags=["memories"])
app.include_router(almanac.router, prefix=f"{settings.API_V1_STR}/almanac", tags=["almanac"])
app.include_router(events.router, prefix=f"{settings.API_V1_STR}/events", tags=["events"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Aura API"}
