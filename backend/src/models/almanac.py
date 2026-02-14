from sqlalchemy import Column, Integer, String, JSON, Date, DateTime
from sqlalchemy.sql import func
from src.core.database import Base

class Almanac(Base):
    __tablename__ = "almanacs"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, index=True) # The date this almanac is for
    yi = Column(JSON) # List of suitable activities (English strings)
    ji = Column(JSON) # List of avoid activities (English strings)
    icon = Column(String, default="🌙") # AI generated icon for the day
    created_at = Column(DateTime(timezone=True), server_default=func.now())
