const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "storage.json");

const siteContent = {
  hero: {
    eyebrow: "Autonomous Treasury Infrastructure",
    title: "Section 43B(h) Compliance, Liquidity, and Audit Defense in One System",
    subtitle:
      "KredXcel connects ERP payment data, computes compliance exposure in real time, and generates evidence-backed reporting workflows."
  },
  phases: [
    { phase: "Phase 1", title: "Deep-ERP Ingestion", text: "Ingest vendors and invoices through ERP connectors or API import jobs." },
    { phase: "Phase 2", title: "Compliance Watchdog", text: "Track 15/45-day timelines and identify dues that are approaching breach." },
    { phase: "Phase 3", title: "Liquidity Bridge", text: "Prioritize at-risk invoices for financing or accelerated settlement routes." },
    { phase: "Phase 4", title: "Audit Vault", text: "Prepare evidence packets with settlement timelines and transaction references." }
  ],
  capabilities: [
    "GSTN-Udyam Verification Workflows",
    "Agreement-aware 15/45 day due-date computation",
    "Real-time exposure and overdue tracking",
    "What-if delay simulation for tax impact",
    "Structured compliance evidence outputs"
  ]
};

function defaultDb() {
  return {
    vendors: [],
    invoices: [],
    connectors: [
      { connectorId: "tally", name: "Tally", mode: "file", endpoint: "", authType: "none", connected: false, lastSyncAt: "" },
      { connectorId: "sap", name: "SAP", mode: "api", endpoint: "", authType: "token", connected: false, lastSyncAt: "" },
      { connectorId: "oracle", name: "Oracle", mode: "api", endpoint: "", authType: "token", connected: false, lastSyncAt: "" }
    ],
    ingestionLogs: [],
    auctions: [],
    settlements: [],
    auditCertificates: [],
    verificationLogs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function ensureShape(db) {
  return {
    vendors: Array.isArray(db.vendors) ? db.vendors : [],
    invoices: Array.isArray(db.invoices) ? db.invoices : [],
    connectors: Array.isArray(db.connectors) && db.connectors.length > 0 ? db.connectors : defaultDb().connectors,
    ingestionLogs: Array.isArray(db.ingestionLogs) ? db.ingestionLogs : [],
    auctions: Array.isArray(db.auctions) ? db.auctions : [],
    settlements: Array.isArray(db.settlements) ? db.settlements : [],
    auditCertificates: Array.isArray(db.auditCertificates) ? db.auditCertificates : [],
    verificationLogs: Array.isArray(db.verificationLogs) ? db.verificationLogs : [],
    createdAt: db.createdAt || new Date().toISOString(),
    updatedAt: db.updatedAt || new Date().toISOString()
  };
}

function readDb() {
  if (fs.existsSync(DB_PATH) === false) {
    const seed = defaultDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
    return seed;
  }

  const raw = fs.readFileSync(DB_PATH, "utf8");
  try {
    return ensureShape(JSON.parse(raw));
  } catch (_err) {
    const seed = defaultDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
    return seed;
  }
}

function writeDb(next) {
  const payload = ensureShape({ ...next, updatedAt: new Date().toISOString() });
  fs.writeFileSync(DB_PATH, JSON.stringify(payload, null, 2));
  return payload;
}

module.exports = { siteContent, readDb, writeDb };
