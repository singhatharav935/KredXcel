# KredXcel

KredXcel is an AI-driven autonomous treasury platform for Section 43B(h) compliance, liquidity action, and audit-ready evidence workflows.

## What Is Live Now

- Connector hub with configuration and sync endpoints
- CSV import pipeline for vendors and invoices
- Real computed compliance metrics from stored records
- Real exposure table and what-if delay simulation
- Ingestion logs for every accepted import operation

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
- `POST /api/connectors/config`
- `POST /api/connectors/:connectorId/sync`
- `POST /api/import/csv/vendors`
- `POST /api/import/csv/invoices`
- `GET /api/ingestion/logs`
- `GET /api/treasury/metrics`
- `GET /api/treasury/exposure`
- `POST /api/simulate/exposure`
- `POST /api/contact`

## CSV Headers

Vendors CSV headers:
`vendorId,name,enterpriseType,gstin,udyam`

Invoices CSV headers:
`invoiceId,vendorId,amount,invoiceDate,acceptanceDate,hasWrittenAgreement,paymentDate,utrNumber`

## Data Note

`backend/storage.json` is git-ignored so local operational data is not pushed to GitHub.
