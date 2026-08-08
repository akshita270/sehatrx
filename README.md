# SehatRx

AI-assisted consultation & prescription app for Indian clinics. A doctor records a
consultation, gets it transcribed via Whisper, reviews a GPT-4o-drafted prescription,
approves it, and it appears instantly in the patient's portal.

## Prerequisites

- Python 3.11 (3.14 is too new for some pinned deps as of this writing)
- Node.js 18+
- Docker (for local Postgres)
- An OpenAI API key with access to Whisper and GPT-4o

## 1. Start Postgres

```bash
cd backend
cp .env.example .env   # then fill in OPENAI_API_KEY
docker compose up -d
```

## 2. Backend

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

The demo doctor and patients are seeded automatically on startup:

- Doctor: `doctor@demo.com` / `demo123`
- Patients: `patient@demo.com`, `sunita@demo.com`, `aman@demo.com` (all `demo123`)

## 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173.

## Running backend tests

```bash
cd backend
source venv/bin/activate
python -m pytest tests/ -v
```

Tests run against a separate `sehatrx_test` Postgres database (auto-created on the same
Docker Postgres instance) and never touch your dev data — each test runs in its own
transaction that's rolled back afterward. OpenAI calls are mocked, so no API key or
network access is needed to run them.

## Notes

- `OPENAI_API_KEY` must be set in `backend/.env` for real transcription (`/transcribe`)
  and prescription drafting (`/draft-rx`) to work — without it those two AI endpoints
  will return a clear error in the UI ("Couldn't transcribe..." / "Couldn't generate a
  draft...") with a retry option, everything else in the app works without it.
- Recording requires a real browser with microphone access (`MediaRecorder` +
  `getUserMedia`) — it won't work in a sandboxed/headless preview.
- Rate limits: `/transcribe` and `/draft-rx` are capped at 20 requests/hour per client.
