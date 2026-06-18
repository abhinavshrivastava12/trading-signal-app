from pydantic import BaseModel, field_validator, model_validator
from datetime import datetime, timezone
from typing import Optional
from app.models.signal import Direction, SignalStatus


class SignalCreate(BaseModel):
    symbol: str
    direction: Direction
    entry_price: float
    stop_loss: float
    target_price: float
    entry_time: datetime
    expiry_time: datetime

    @field_validator("symbol")
    @classmethod
    def symbol_upper(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("entry_price", "stop_loss", "target_price")
    @classmethod
    def prices_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Price must be positive")
        return v

    @model_validator(mode="after")
    def validate_logic(self) -> "SignalCreate":
        # Expiry must be after entry
        if self.expiry_time <= self.entry_time:
            raise ValueError("expiry_time must be after entry_time")

        # Entry cannot be more than 24 hrs in the past from now
        now = datetime.now(timezone.utc)
        entry_utc = self.entry_time
        if entry_utc.tzinfo is None:
            from datetime import timedelta
            # Treat naive as UTC
            entry_utc = entry_utc.replace(tzinfo=timezone.utc)

        # Direction-aware price validation
        if self.direction == Direction.BUY:
            if self.stop_loss >= self.entry_price:
                raise ValueError("BUY: stop_loss must be less than entry_price")
            if self.target_price <= self.entry_price:
                raise ValueError("BUY: target_price must be greater than entry_price")
        else:  # SELL
            if self.stop_loss <= self.entry_price:
                raise ValueError("SELL: stop_loss must be greater than entry_price")
            if self.target_price >= self.entry_price:
                raise ValueError("SELL: target_price must be less than entry_price")

        return self


class SignalResponse(BaseModel):
    id: str
    symbol: str
    direction: Direction
    entry_price: float
    stop_loss: float
    target_price: float
    entry_time: datetime
    expiry_time: datetime
    created_at: datetime
    status: SignalStatus
    realized_roi: Optional[float] = None

    model_config = {"from_attributes": True}


class SignalStatusResponse(BaseModel):
    id: str
    symbol: str
    status: SignalStatus
    current_price: Optional[float] = None
    realized_roi: Optional[float] = None
    time_remaining_seconds: Optional[float] = None
