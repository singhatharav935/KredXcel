# KredXcel

KredXcel is an AI-driven autonomous treasury platform for Section 43B(h) compliance, liquidity action, and audit-ready evidence workflows.

## What Is Live Now

- Connector hub with configuration and sync endpoints
- CSV import pipeline for vendors and invoices
- Real computed compliance metrics from stored records
- Auction launch endpoint from live open invoices
- Settlement flow that updates invoice payment state
- Audit certificate generation on settlement
- Ingestion and operations logs from real actions

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

Frontend opens at `http://localhost:5173`.

## API Endpoints

- `GET /api/health`
- `GET /api/site`
- `GET /api/connectors`
- `GET /api/vendors`
- `GET /api/vendors/verification-summary`
- `GET /api/vendors/verification-logs`
- `POST /api/connectors/config`
- `POST /api/connectors/:connectorId/sync`
- `POST /api/vendors/:vendorId/verify`
- `POST /api/vendors/verify-all`
- `POST /api/import/csv/vendors`
- `POST /api/import/csv/invoices`
- `GET /api/ingestion/logs`
- `GET /api/treasury/metrics`
- `GET /api/treasury/exposure`
- `POST /api/simulate/exposure`
- `GET /api/auctions`
- `POST /api/auctions/start`
- `POST /api/auctions/:auctionId/settle`
- `GET /api/settlements`
- `GET /api/audit/certificates`
- `GET /api/audit/export?format=json|csv`
- `GET /api/optimizer/advance-tax?quarterEnd=YYYY-MM-DD`
- `POST /api/contact`

## CSV Headers

Vendors CSV:
`vendorId,name,enterpriseType,gstin,udyam`

Invoices CSV:
`invoiceId,vendorId,amount,invoiceDate,acceptanceDate,hasWrittenAgreement,paymentDate,utrNumber`

## Auction Bids Input (Frontend)

Each line in bids textarea:
`lender,annualRate,processingFeePct`

Example:
`Axis Bank,9.2,0.8`

## Data Note

`backend/storage.json` is git-ignored so local operational data is not pushed to GitHub.


## Audit Export

- `format=json` returns settlements + certificate bundle.
- `format=csv` returns certificate rows as downloadable CSV.
- Advance-tax optimizer computes quarter-end exposure from real stored invoice and vendor records.


## Vendor Verification (Live APIs)

Set these backend env vars to use real GSTIN/Udyam services:

- `GSTIN_VERIFY_URL`
- `GSTIN_VERIFY_KEY`
- `GSTIN_VERIFY_PARAM` (optional, default `gstin`)
- `UDYAM_VERIFY_URL`
- `UDYAM_VERIFY_KEY`
- `UDYAM_VERIFY_PARAM` (optional, default `udyam`)

Then call `POST /api/vendors/:vendorId/verify` to fetch and persist live verification data.

Use `backend/.env.example` as the template for local environment setup.

Verification logs are stored in backend state and exposed via `GET /api/vendors/verification-logs`.
