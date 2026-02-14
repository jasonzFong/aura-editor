from sqlalchemy.orm import Session
from src.models.almanac import Almanac
from datetime import date, datetime, timedelta
import json
from src.core.config import settings
from openai import OpenAI
from sqlalchemy.exc import IntegrityError
import logging

logger = logging.getLogger(__name__)

client = OpenAI(
    api_key=settings.DEEPSEEK_API_KEY, 
    base_url="https://api.deepseek.com"
)

def get_almanac(db: Session, target_date: date):
    # Check DB
    existing = db.query(Almanac).filter(Almanac.date == target_date).first()
    if existing:
        return existing
    
    # Fetch from AI
    try:
        logger.info(f"Fetching almanac for {target_date} from AI...")
        almanac_data = fetch_almanac_from_ai(target_date)
        new_almanac = Almanac(
            date=target_date,
            yi=almanac_data.get('yi', []),
            ji=almanac_data.get('ji', []),
            icon=almanac_data.get('icon', '🌙')
        )
        db.add(new_almanac)
        db.commit()
        db.refresh(new_almanac)
        logger.info(f"Almanac for {target_date} saved.")
        return new_almanac
    except IntegrityError:
        logger.warning(f"Almanac for {target_date} already exists (race condition), rolling back.")
        db.rollback()
        return db.query(Almanac).filter(Almanac.date == target_date).first()
    except Exception as e:
        logger.error(f"Error fetching almanac: {e}")
        db.rollback() # Ensure rollback on any error
        return None

def fetch_almanac_from_ai(target_date: date):
    prompt = f"""
    Generate the traditional Chinese Almanac (Suitable/Avoid activities) for date: {target_date.strftime('%Y-%m-%d')}.
    Return a JSON object with three keys:
    1. "yi" (list of suitable activities)
    2. "ji" (list of avoid activities)
    3. "icon" (a single emoji representing the day's luck or theme, e.g. 🏮, 🧧, 🐉. Default to 🌙 if unsure).
    Translate all terms into concise English.
    Example: {{"yi": ["Wedding", "Travel"], "ji": ["Funeral"], "icon": "🧧"}}
    """
    
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": "You are a Chinese Almanac expert. Return only JSON."},
            {"role": "user", "content": prompt}
        ],
        response_format={ "type": "json_object" }
    )
    
    content = response.choices[0].message.content
    return json.loads(content)

def run_daily_almanac_job():
    # Triggered by scheduler
    # Fetch for today and next 2 days to be safe
    from src.core.database import SessionLocal
    db = SessionLocal()
    try:
        today = date.today()
        # Fetch for today and next 2 days to be safe
        for i in range(3):
            d = today + timedelta(days=i)
            get_almanac(db, d)
    finally:
        db.close()
