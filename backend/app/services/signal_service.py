from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, List
import logging

from app.models.signal import Signal, SignalStatus, Direction
from app.schemas.signal import SignalCreate
from app.services.binance_service import get_current_price, get_prices_bulk

logger = logging.getLogger(__name__)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _make_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def calculate_roi(direction: Direction, entry_price: float, current_price: float) -> float:
    """Calculate ROI % to 2 decimal places."""
    if direction == Direction.BUY:
        roi = (current_price - entry_price) / entry_price * 100
    else:
        roi = (entry_price - current_price) / entry_price * 100
    return round(roi, 2)


def determine_status(
    direction: Direction,
    entry_price: float,
    stop_loss: float,
    target_price: float,
    current_price: float,
    expiry_time: datetime,
    entry_time: datetime,
) -> SignalStatus:
    """Determine signal status based on live price and time."""
    now = _now_utc()
    expiry_utc = _make_aware(expiry_time)
    entry_utc = _make_aware(entry_time)

    # Signal not active yet
    if now < entry_utc:
        return SignalStatus.OPEN

    # Check expiry first — expired signals never change
    if now >= expiry_utc:
        return SignalStatus.EXPIRED

    # Price-based checks
    if direction == Direction.BUY:
        if current_price >= target_price:
            return SignalStatus.TARGET_HIT
        if current_price <= stop_loss:
            return SignalStatus.STOPLOSS_HIT
    else:  # SELL
        if current_price <= target_price:
            return SignalStatus.TARGET_HIT
        if current_price >= stop_loss:
            return SignalStatus.STOPLOSS_HIT

    return SignalStatus.OPEN


# ──────────────────────────────────────────────────────────────────────────────
# CRUD
# ──────────────────────────────────────────────────────────────────────────────

def create_signal(db: Session, data: SignalCreate) -> Signal:
    import uuid
    signal = Signal(
        id=str(uuid.uuid4()),
        symbol=data.symbol,
        direction=data.direction,
        entry_price=data.entry_price,
        stop_loss=data.stop_loss,
        target_price=data.target_price,
        entry_time=_make_aware(data.entry_time),
        expiry_time=_make_aware(data.expiry_time),
        status=SignalStatus.OPEN,
        realized_roi=None,
    )
    db.add(signal)
    db.commit()
    db.refresh(signal)
    return signal


def get_all_signals(db: Session) -> List[Signal]:
    return db.query(Signal).order_by(Signal.created_at.desc()).all()


def get_signal_by_id(db: Session, signal_id: str) -> Optional[Signal]:
    return db.query(Signal).filter(Signal.id == signal_id).first()


def delete_signal(db: Session, signal_id: str) -> bool:
    signal = get_signal_by_id(db, signal_id)
    if not signal:
        return False
    db.delete(signal)
    db.commit()
    return True


async def get_live_status(db: Session, signal_id: str) -> Optional[dict]:
    signal = get_signal_by_id(db, signal_id)
    if not signal:
        return None

    now = _now_utc()
    expiry_utc = _make_aware(signal.expiry_time)
    time_remaining = max(0.0, (expiry_utc - now).total_seconds())

    # If already terminal and expired, do not re-evaluate
    if signal.status == SignalStatus.EXPIRED:
        return {
            "id": signal.id,
            "symbol": signal.symbol,
            "status": signal.status,
            "current_price": None,
            "realized_roi": signal.realized_roi,
            "time_remaining_seconds": 0.0,
        }

    current_price = await get_current_price(signal.symbol)

    if current_price is None:
        return {
            "id": signal.id,
            "symbol": signal.symbol,
            "status": signal.status,
            "current_price": None,
            "realized_roi": signal.realized_roi,
            "time_remaining_seconds": time_remaining,
        }

    new_status = determine_status(
        signal.direction,
        signal.entry_price,
        signal.stop_loss,
        signal.target_price,
        current_price,
        signal.expiry_time,
        signal.entry_time,
    )

    roi = calculate_roi(signal.direction, signal.entry_price, current_price)

    # Persist status changes and ROI for terminal states
    if new_status != signal.status:
        # Never change away from EXPIRED
        if signal.status != SignalStatus.EXPIRED:
            signal.status = new_status
            if new_status in (SignalStatus.TARGET_HIT, SignalStatus.STOPLOSS_HIT, SignalStatus.EXPIRED):
                signal.realized_roi = roi
            db.commit()
            db.refresh(signal)

    return {
        "id": signal.id,
        "symbol": signal.symbol,
        "status": signal.status,
        "current_price": current_price,
        "realized_roi": signal.realized_roi if signal.realized_roi is not None else roi,
        "time_remaining_seconds": time_remaining,
    }


async def refresh_all_signal_statuses(db: Session):
    """Background task: update all OPEN signals."""
    open_signals = db.query(Signal).filter(Signal.status == SignalStatus.OPEN).all()
    if not open_signals:
        return

    symbols = list({s.symbol for s in open_signals})
    prices = await get_prices_bulk(symbols)

    for signal in open_signals:
        current_price = prices.get(signal.symbol)
        if current_price is None:
            continue

        new_status = determine_status(
            signal.direction,
            signal.entry_price,
            signal.stop_loss,
            signal.target_price,
            current_price,
            signal.expiry_time,
            signal.entry_time,
        )

        if new_status != signal.status:
            signal.status = new_status
            roi = calculate_roi(signal.direction, signal.entry_price, current_price)
            if new_status in (SignalStatus.TARGET_HIT, SignalStatus.STOPLOSS_HIT, SignalStatus.EXPIRED):
                signal.realized_roi = roi

    db.commit()
