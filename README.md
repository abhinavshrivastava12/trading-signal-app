# Trading Signal Tracker

A full-stack trading signal tracker with live Binance price integration, automated status transitions, and a real-time dashboard.

---

## Live Demo
- Frontend: https://trading-signal-frontend-s6hd.onrender.com
- Backend API: https://trading-signal-backend-3f4g.onrender.com/docs

## Demo Video Link 
- https://drive.google.com/file/d/1v92RWVyk3fQ0mDmwMUmZqXA8jZBQdn2z/view?usp=drivesdk


## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Backend   | Python · FastAPI · SQLAlchemy     |
| Database  | SQLite (drop-in PostgreSQL ready) |
| Frontend  | React · Axios                     |
| Prices    | Binance REST API (public, no key) |

---

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API will be available at `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm start
```

App will open at `http://localhost:3000`

### Environment Variables (optional)

| Variable         | Default                     | Description          |
|------------------|-----------------------------|----------------------|
| `DATABASE_URL`   | `sqlite:///./signals.db`    | SQLAlchemy URL       |
| `REACT_APP_API_URL` | `http://localhost:8000`  | Backend base URL     |

---

## Database Setup

SQLite database (`signals.db`) is auto-created on first startup — no manual setup needed.

To use PostgreSQL:
```bash
export DATABASE_URL="postgresql://user:pass@localhost/signals"
```

### Schema

```sql
CREATE TABLE signals (
    id          TEXT PRIMARY KEY,
    symbol      VARCHAR(20)   NOT NULL,
    direction   ENUM('BUY','SELL') NOT NULL,
    entry_price DECIMAL       NOT NULL,
    stop_loss   DECIMAL       NOT NULL,
    target_price DECIMAL      NOT NULL,
    entry_time  TIMESTAMP     NOT NULL,
    expiry_time TIMESTAMP     NOT NULL,
    created_at  TIMESTAMP     NOT NULL DEFAULT NOW(),
    status      ENUM('OPEN','TARGET_HIT','STOPLOSS_HIT','EXPIRED') DEFAULT 'OPEN',
    realized_roi DECIMAL      -- nullable, set on resolution
);
```

---

## API Documentation

### `POST /api/signals`
Create a new trading signal.

**Request body:**
```json
{
  "symbol": "BTCUSDT",
  "direction": "BUY",
  "entry_price": 65000,
  "stop_loss": 63000,
  "target_price": 70000,
  "entry_time": "2026-06-18T10:00:00Z",
  "expiry_time": "2026-06-19T10:00:00Z"
}
```

**Validation rules:**
- BUY: `stop_loss < entry_price < target_price`
- SELL: `target_price < entry_price < stop_loss`
- `expiry_time` must be after `entry_time`
- Invalid inputs return HTTP 400 with field-level error details

**Response:** `201 Created` → Signal object

---

### `GET /api/signals`
List all signals ordered by creation time (newest first).

**Response:** `200 OK` → Array of signal objects

---

### `GET /api/signals/:id`
Get a single signal by ID.

**Response:** `200 OK` → Signal object · `404` if not found

---

### `DELETE /api/signals/:id`
Delete a signal.

**Response:** `204 No Content` · `404` if not found

---

### `GET /api/signals/:id/status` *(Recommended)*
Fetch live status with current Binance price and ROI.

**Response:**
```json
{
  "id": "uuid",
  "symbol": "BTCUSDT",
  "status": "OPEN",
  "current_price": 66200.50,
  "realized_roi": 1.85,
  "time_remaining_seconds": 82341.0
}
```

---

## Architecture

```
trading-signal-app/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, startup tasks
│   ├── requirements.txt
│   └── app/
│       ├── database.py            # SQLAlchemy engine + session factory
│       ├── models/
│       │   └── signal.py          # ORM model + enums (Direction, SignalStatus)
│       ├── schemas/
│       │   └── signal.py          # Pydantic request/response schemas + validation
│       ├── services/
│       │   ├── binance_service.py # Async Binance REST price fetching
│       │   └── signal_service.py  # Business logic: CRUD, status engine, ROI
│       └── routes/
│           └── signals.py         # HTTP layer → delegates to service layer
│
└── frontend/
    ├── public/
    └── src/
        ├── App.js                 # Root layout + tab navigation
        ├── styles.css             # Full dark-theme CSS
        ├── services/
        │   └── api.js             # Axios API client
        └── components/
            ├── Dashboard.js       # Signal table + auto-refresh every 15s
            └── CreateSignalForm.js # Signal creation form + client validation
```

### Key Design Decisions

**Status Engine (`signal_service.py → determine_status`):**
The status logic is direction-aware and time-guarded. Expired signals are checked first and can never transition to any other state. For active signals, target/stoploss hits are evaluated against the live Binance price. All status transitions are persisted immediately to the database.

**ROI Calculation:**
```
BUY ROI  = (current − entry) / entry × 100
SELL ROI = (entry − current) / entry × 100
```
ROI is calculated live for OPEN signals, and locked (realized_roi) upon terminal status transition.

**Background Refresh:**
A background asyncio task runs every 15 seconds on the server, polling Binance for all OPEN signals in bulk and persisting any status transitions. The frontend also refreshes every 15 seconds for live UI updates.

**Separation of Concerns:**
- `routes/` — HTTP interface only (status codes, request parsing, delegation)
- `services/` — all business logic, Binance calls, and DB mutations
- `models/` — ORM schema and enum definitions
- `schemas/` — Pydantic validation (request) and serialization (response)

---

## Evaluation Criteria Checklist

| Criterion           | Implementation                                                   |
|---------------------|------------------------------------------------------------------|
| Code Structure      | 4-layer architecture: routes → services → models/schemas        |
| Business Logic      | Direction-aware validation, expiry-guarded status transitions    |
| API Design          | REST conventions, proper HTTP status codes, 400 error details    |
| Database Schema     | Typed columns, nullable `realized_roi`, UUID primary key         |
| Time Handling       | UTC-aware timestamps, expiry enforcement, 24hr historical support|
| Frontend Integration| Live prices, 15s auto-refresh, validation feedback, ROI to 2dp  |
