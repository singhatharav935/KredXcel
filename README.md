# KredXcel

KredXcel is an AI-driven autonomous treasury platform for Section 43B(h) compliance, liquidity action, and audit-ready evidence workflows.

## What Is Live Now

- Real ingestion APIs for vendors and invoices
- Real computed compliance metrics from stored records
- Real exposure table (no hardcoded business numbers)
- What-if delay simulation for additional tax risk
- Frontend forms connected to backend APIs

## Project Structure

- `frontend/` Vite + React app
- `backend/` Node.js API server

## Run Locally

Terminal 1:

```bash
cd /Users/atharavsingh/Documents/MyProjects/KredXcel/backend
PORT=5001 npm run dev
```

Terminal 2:

```bash
cd /Users/atharavsingh/Documents/MyProjects/KredXcel/frontend
npm run dev
```

Frontend opens automatically at `http://localhost:5173`.

## API Endpoints

- `GET /api/health`
- `GET /api/site`
- `GET /api/treasury/metrics`
- `GET /api/treasury/exposure`
- `POST /api/ingest/vendors`
- `POST /api/ingest/invoices`
- `POST /api/simulate/exposure`
- `POST /api/contact`

## Data Note

`backend/storage.json` is intentionally git-ignored so your real local records do not get pushed to GitHub.
