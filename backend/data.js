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
    {
      phase: "Phase 1",
      title: "Deep-ERP Ingestion",
      text: "Ingest vendors and invoices through ERP connectors or API import jobs."
    },
    {
      phase: "Phase 2",
      title: "Compliance Watchdog",
      text: "Track 15/45-day timelines and identify dues that are approaching breach."
    },
    {
      phase: "Phase 3",
      title: "Liquidity Bridge",
      text: "Prioritize at-risk invoices for financing or accelerated settlement routes."
    },
    {
      phase: "Phase 4",
      title: "Audit Vault",
      text: "Prepare evidence packets with settlement timelines and transaction references."
    }
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    const seed = defaultDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
    return seed;
  }

  const raw = fs.readFileSync(DB_PATH, "utf8");
  try {
    return JSON.parse(raw);
  } catch (_err) {
    const seed = defaultDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
    return seed;
  }
}

function writeDb(next) {
  const payload = {
    ...next,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(payload, null, 2));
  return payload;
}

module.exports = {
  siteContent,
  readDb,
  writeDb
};
