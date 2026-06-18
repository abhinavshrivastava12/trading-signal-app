from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
import asyncio
import logging

from app.database import engine, SessionLocal, Base
from app.routes.signals import router as signals_router
from app.services.signal_service import refresh_all_signal_statuses

# Create tables
Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Trading Signal Tracker API",
    description="Live trading signal tracker with Binance integration",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","https://trading-signal-frontend-s6hd.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(signals_router)


# ── Global validation error handler ──────────────────────────────────────────
@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=400,
        content={"detail": exc.errors()},
    )


# ── Background task: refresh open signals every 15 seconds ───────────────────
async def background_status_refresh():
    while True:
        try:
            db = SessionLocal()
            await refresh_all_signal_statuses(db)
            db.close()
        except Exception as e:
            logger.error(f"Background refresh error: {e}")
        await asyncio.sleep(15)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(background_status_refresh())
    logger.info("Trading Signal Tracker API started")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Trading Signal Tracker"}
