import uuid
from sqlalchemy import Column, String, Float, DateTime, Enum as SAEnum, func
from sqlalchemy.dialects.sqlite import TEXT
from app.database import Base
import enum


class Direction(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class SignalStatus(str, enum.Enum):
    OPEN = "OPEN"
    TARGET_HIT = "TARGET_HIT"
    STOPLOSS_HIT = "STOPLOSS_HIT"
    EXPIRED = "EXPIRED"


class Signal(Base):
    __tablename__ = "signals"

    id = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    symbol = Column(String(20), nullable=False)
    direction = Column(SAEnum(Direction), nullable=False)
    entry_price = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=False)
    target_price = Column(Float, nullable=False)
    entry_time = Column(DateTime(timezone=True), nullable=False)
    expiry_time = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(SAEnum(SignalStatus), default=SignalStatus.OPEN, nullable=False)
    realized_roi = Column(Float, nullable=True)
