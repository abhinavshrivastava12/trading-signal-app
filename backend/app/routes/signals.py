from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas.signal import SignalCreate, SignalResponse, SignalStatusResponse
from app.services import signal_service

router = APIRouter(prefix="/api/signals", tags=["signals"])


@router.post("", response_model=SignalResponse, status_code=status.HTTP_201_CREATED)
def create_signal(data: SignalCreate, db: Session = Depends(get_db)):
    signal = signal_service.create_signal(db, data)
    return signal


@router.get("", response_model=List[SignalResponse])
def list_signals(db: Session = Depends(get_db)):
    return signal_service.get_all_signals(db)


@router.get("/{signal_id}", response_model=SignalResponse)
def get_signal(signal_id: str, db: Session = Depends(get_db)):
    signal = signal_service.get_signal_by_id(db, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    return signal


@router.delete("/{signal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_signal(signal_id: str, db: Session = Depends(get_db)):
    deleted = signal_service.delete_signal(db, signal_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Signal not found")
    return None


@router.get("/{signal_id}/status", response_model=SignalStatusResponse)
async def get_signal_status(signal_id: str, db: Session = Depends(get_db)):
    result = await signal_service.get_live_status(db, signal_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Signal not found")
    return result
