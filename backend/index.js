const http = require("http");
const { URL } = require("url");
const { readDb, siteContent, writeDb } = require("./data");

const PORT = Number(process.env.PORT || 5000);
const TAX_RATE = 0.3;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4e6) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (_err) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(fromDate, toDateValue) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((toDateValue - fromDate) / dayMs);
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const text = String(value || "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes" || text === "y";
}

function normalizeVendor(input) {
  return {
    vendorId: String(input.vendorId || "").trim(),
    name: String(input.name || "").trim(),
    enterpriseType: String(input.enterpriseType || "unknown").toLowerCase(),
    gstin: String(input.gstin || "").trim(),
    udyam: String(input.udyam || "").trim(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeInvoice(input) {
  const hasWrittenAgreement = parseBoolean(input.hasWrittenAgreement);
  return {
    invoiceId: String(input.invoiceId || "").trim(),
    vendorId: String(input.vendorId || "").trim(),
    amount: Number(input.amount || 0),
    invoiceDate: String(input.invoiceDate || "").trim(),
    acceptanceDate: String(input.acceptanceDate || input.invoiceDate || "").trim(),
    paymentDate: input.paymentDate ? String(input.paymentDate).trim() : "",
    hasWrittenAgreement,
    dueDays: hasWrittenAgreement ? 45 : 15,
    utrNumber: input.utrNumber ? String(input.utrNumber).trim() : "",
    updatedAt: new Date().toISOString()
  };
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function parseCsv(csvText) {
  const lines = String(csvText || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    return row;
  });
}

function ingestVendors(db, items, source) {
  const map = new Map(db.vendors.map((v) => [v.vendorId, v]));
  let accepted = 0;
  items.map(normalizeVendor).forEach((vendor) => {
    if (!vendor.vendorId || !vendor.name) return;
    map.set(vendor.vendorId, vendor);
    accepted += 1;
  });
  const log = { id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`, type: "vendors", source, accepted, timestamp: new Date().toISOString() };
  return { ...db, vendors: [...map.values()], ingestionLogs: [log, ...db.ingestionLogs].slice(0, 100) };
}

function ingestInvoices(db, items, source) {
  const map = new Map(db.invoices.map((v) => [v.invoiceId, v]));
  let accepted = 0;
  items.map(normalizeInvoice).forEach((invoice) => {
    if (!invoice.invoiceId || !invoice.vendorId || !invoice.invoiceDate || invoice.amount <= 0) return;
    map.set(invoice.invoiceId, invoice);
    accepted += 1;
  });
  const log = { id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`, type: "invoices", source, accepted, timestamp: new Date().toISOString() };
  return { ...db, invoices: [...map.values()], ingestionLogs: [log, ...db.ingestionLogs].slice(0, 100) };
}

function getInvoiceDueDate(invoice) {
  const acceptance = toDate(invoice.acceptanceDate);
  if (!acceptance) return null;
  const dueDate = new Date(acceptance);
  dueDate.setDate(dueDate.getDate() + Number(invoice.dueDays || 15));
  return dueDate;
}

function computeExposure(db) {
  const now = new Date();
  const vendors = new Map(db.vendors.map((v) => [v.vendorId, v]));
  const analyzed = db.invoices.map((inv) => {
    const vendor = vendors.get(inv.vendorId);
    const acceptance = toDate(inv.acceptanceDate);
    if (!acceptance) return null;
    const dueDate = getInvoiceDueDate(inv);
    const paid = Boolean(inv.paymentDate);
    const paymentDate = inv.paymentDate ? toDate(inv.paymentDate) : null;
    const referenceDate = paid && paymentDate ? paymentDate : now;
    const overdueDays = dueDate ? daysBetween(dueDate, now) : 0;
    const isOverdue = !paid && overdueDays > 0;
    return {
      invoiceId: inv.invoiceId,
      vendorId: inv.vendorId,
      vendorName: vendor?.name || "Unknown Vendor",
      enterpriseType: vendor?.enterpriseType || "unknown",
      amount: inv.amount,
      dueDays: inv.dueDays,
      invoiceDate: inv.invoiceDate,
      acceptanceDate: inv.acceptanceDate,
      dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : "",
      paymentDate: inv.paymentDate || null,
      status: paid ? "paid" : isOverdue ? "overdue" : "open",
      daysElapsed: Math.max(0, daysBetween(acceptance, referenceDate)),
      daysToDue: dueDate ? daysBetween(now, dueDate) : 0,
      overdueDays: isOverdue ? overdueDays : 0,
      taxAtRisk: isOverdue ? inv.amount * TAX_RATE : 0
    };
  }).filter(Boolean);

  const open = analyzed.filter((r) => r.status === "open");
  const overdue = analyzed.filter((r) => r.status === "overdue");
  const paid = analyzed.filter((r) => r.status === "paid");

  return {
    analyzed,
    summary: {
      vendors: db.vendors.length,
      invoices: analyzed.length,
      openInvoices: open.length,
      overdueInvoices: overdue.length,
      paidInvoices: paid.length,
      totalOutstanding: [...open, ...overdue].reduce((s, x) => s + x.amount, 0),
      totalTaxAtRisk: overdue.reduce((s, x) => s + x.taxAtRisk, 0)
    }
  };
}

function computeSimulation(rows, payload) {
  const delayDays = Number(payload.delayDays || 0);
  const targetType = payload.enterpriseType ? String(payload.enterpriseType).toLowerCase() : "";
  if (delayDays <= 0) return { delayDays: 0, impactedInvoices: 0, additionalTaxRisk: 0, impactedInvoiceIds: [] };
  const candidates = rows.filter((r) => r.status === "open" && (!targetType || r.enterpriseType === targetType));
  const impacted = candidates.filter((r) => r.daysToDue - delayDays < 0);
  return {
    delayDays,
    enterpriseType: targetType || "all",
    impactedInvoices: impacted.length,
    additionalTaxRisk: impacted.reduce((s, x) => s + x.amount * TAX_RATE, 0),
    impactedInvoiceIds: impacted.map((x) => x.invoiceId)
  };
}

function normalizeBid(bid) {
  return {
    lender: String(bid.lender || "").trim(),
    annualRate: Number(bid.annualRate || 0),
    processingFeePct: Number(bid.processingFeePct || 0)
  };
}

function buildAuction(db, payload) {
  const invoiceId = String(payload.invoiceId || "").trim();
  if (!invoiceId) throw new Error("invoiceId is required");
  const invoice = db.invoices.find((i) => i.invoiceId === invoiceId);
  if (!invoice) throw new Error("invoice not found");
  if (invoice.paymentDate) throw new Error("invoice already settled");
  if (!Array.isArray(payload.bids) || payload.bids.length === 0) throw new Error("bids array is required");

  const bids = payload.bids.map(normalizeBid)
    .filter((b) => b.lender && b.annualRate > 0 && b.processingFeePct >= 0)
    .map((b) => ({ ...b, effectiveCost: b.annualRate + b.processingFeePct }))
    .sort((a, b) => a.effectiveCost - b.effectiveCost);

  if (bids.length === 0) throw new Error("no valid bids");

  return {
    auctionId: `AUC-${Date.now()}`,
    invoiceId,
    status: "open",
    createdAt: new Date().toISOString(),
    bids,
    winner: bids[0]
  };
}

function settleAuction(db, auctionId, payload) {
  const auctionIndex = db.auctions.findIndex((a) => a.auctionId === auctionId);
  if (auctionIndex < 0) throw new Error("auction not found");
  const auction = db.auctions[auctionIndex];
  if (auction.status !== "open") throw new Error("auction already settled");

  const invoiceIndex = db.invoices.findIndex((i) => i.invoiceId === auction.invoiceId);
  if (invoiceIndex < 0) throw new Error("invoice not found for auction");

  const invoice = db.invoices[invoiceIndex];
  const paymentDate = String(payload.paymentDate || new Date().toISOString().slice(0, 10));
  const utrNumber = String(payload.utrNumber || "").trim();
  if (!utrNumber) throw new Error("utrNumber is required");

  const updatedInvoice = { ...invoice, paymentDate, utrNumber, updatedAt: new Date().toISOString() };
  const dueDate = getInvoiceDueDate(updatedInvoice);
  const acceptanceDate = toDate(updatedInvoice.acceptanceDate);
  const paidAt = toDate(paymentDate);
  const daysTaken = acceptanceDate && paidAt ? daysBetween(acceptanceDate, paidAt) : null;
  const withinWindow = dueDate && paidAt ? paidAt <= dueDate : false;

  const settlement = {
    settlementId: `SET-${Date.now()}`,
    auctionId: auction.auctionId,
    invoiceId: updatedInvoice.invoiceId,
    vendorId: updatedInvoice.vendorId,
    amount: updatedInvoice.amount,
    lender: auction.winner.lender,
    annualRate: auction.winner.annualRate,
    processingFeePct: auction.winner.processingFeePct,
    paymentDate,
    utrNumber,
    settledAt: new Date().toISOString()
  };

  const certificate = {
    certificateId: `CERT-${Date.now()}`,
    invoiceId: updatedInvoice.invoiceId,
    settlementId: settlement.settlementId,
    acceptanceDate: updatedInvoice.acceptanceDate,
    dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : "",
    paymentDate,
    daysTaken,
    withinWindow,
    complianceStatus: withinWindow ? "compliant" : "breach",
    utrNumber,
    generatedAt: new Date().toISOString()
  };

  const auctions = [...db.auctions];
  auctions[auctionIndex] = { ...auction, status: "settled", settlementId: settlement.settlementId, settledAt: settlement.settledAt };

  const invoices = [...db.invoices];
  invoices[invoiceIndex] = updatedInvoice;

  return {
    ...db,
    auctions,
    invoices,
    settlements: [settlement, ...db.settlements],
    auditCertificates: [certificate, ...db.auditCertificates]
  };
}

function parseAuctionPath(pathname) {
  const m = pathname.match(/^\/api\/auctions\/([^/]+)\/settle$/);
  return m ? m[1] : "";
}

function parseConnectorSyncPath(pathname) {
  const m = pathname.match(/^\/api\/connectors\/([^/]+)\/sync$/);
  return m ? m[1] : "";
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const path = parsed.pathname;

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "GET" && path === "/api/health") return sendJson(res, 200, { ok: true, service: "kredxcel-api", port: PORT, timestamp: new Date().toISOString() });
  if (req.method === "GET" && path === "/api/site") return sendJson(res, 200, siteContent);
  if (req.method === "GET" && path === "/api/connectors") return sendJson(res, 200, readDb().connectors);
  if (req.method === "GET" && path === "/api/ingestion/logs") return sendJson(res, 200, readDb().ingestionLogs);
  if (req.method === "GET" && path === "/api/treasury/metrics") return sendJson(res, 200, computeExposure(readDb()).summary);
  if (req.method === "GET" && path === "/api/treasury/exposure") return sendJson(res, 200, computeExposure(readDb()).analyzed);
  if (req.method === "GET" && path === "/api/auctions") return sendJson(res, 200, readDb().auctions);
  if (req.method === "GET" && path === "/api/settlements") return sendJson(res, 200, readDb().settlements);
  if (req.method === "GET" && path === "/api/audit/certificates") return sendJson(res, 200, readDb().auditCertificates);

  if (req.method === "POST" && path === "/api/connectors/config") {
    try {
      const body = await parseBody(req);
      const connectorId = String(body.connectorId || "").trim().toLowerCase();
      if (!connectorId) return sendJson(res, 400, { ok: false, error: "connectorId is required" });
      const db = readDb();
      const connectors = db.connectors.map((c) => c.connectorId !== connectorId ? c : {
        ...c,
        mode: String(body.mode || c.mode || "api"),
        endpoint: String(body.endpoint || "").trim(),
        authType: String(body.authType || c.authType || "none"),
        connected: true
      });
      const next = writeDb({ ...db, connectors });
      return sendJson(res, 200, { ok: true, connectors: next.connectors });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && path.startsWith("/api/connectors/") && path.endsWith("/sync")) {
    try {
      const connectorId = parseConnectorSyncPath(path);
      if (!connectorId) return sendJson(res, 400, { ok: false, error: "invalid connector path" });
      const body = await parseBody(req);
      const vendorRows = parseCsv(body.vendorsCsv || "");
      const invoiceRows = parseCsv(body.invoicesCsv || "");
      let db = readDb();
      if (vendorRows.length > 0) db = ingestVendors(db, vendorRows, `${connectorId}-sync`);
      if (invoiceRows.length > 0) db = ingestInvoices(db, invoiceRows, `${connectorId}-sync`);
      const connectors = db.connectors.map((c) => c.connectorId !== connectorId ? c : { ...c, connected: true, lastSyncAt: new Date().toISOString() });
      const next = writeDb({ ...db, connectors });
      return sendJson(res, 200, { ok: true, connectorId, vendorsIngested: vendorRows.length, invoicesIngested: invoiceRows.length, connectors: next.connectors });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && path === "/api/import/csv/vendors") {
    try {
      const rows = parseCsv((await parseBody(req)).csv || "");
      if (rows.length === 0) return sendJson(res, 400, { ok: false, error: "csv must include header and rows" });
      const next = writeDb(ingestVendors(readDb(), rows, "csv-upload"));
      return sendJson(res, 200, { ok: true, vendors: next.vendors.length });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && path === "/api/import/csv/invoices") {
    try {
      const rows = parseCsv((await parseBody(req)).csv || "");
      if (rows.length === 0) return sendJson(res, 400, { ok: false, error: "csv must include header and rows" });
      const next = writeDb(ingestInvoices(readDb(), rows, "csv-upload"));
      return sendJson(res, 200, { ok: true, invoices: next.invoices.length });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && path === "/api/ingest/vendors") {
    try {
      const body = await parseBody(req);
      if (!Array.isArray(body.vendors) || body.vendors.length === 0) return sendJson(res, 400, { ok: false, error: "vendors array is required" });
      const next = writeDb(ingestVendors(readDb(), body.vendors, "api-direct"));
      return sendJson(res, 200, { ok: true, vendors: next.vendors.length });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && path === "/api/ingest/invoices") {
    try {
      const body = await parseBody(req);
      if (!Array.isArray(body.invoices) || body.invoices.length === 0) return sendJson(res, 400, { ok: false, error: "invoices array is required" });
      const next = writeDb(ingestInvoices(readDb(), body.invoices, "api-direct"));
      return sendJson(res, 200, { ok: true, invoices: next.invoices.length });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && path === "/api/simulate/exposure") {
    try {
      const result = computeSimulation(computeExposure(readDb()).analyzed, await parseBody(req));
      return sendJson(res, 200, { ok: true, result });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && path === "/api/auctions/start") {
    try {
      const db = readDb();
      const auction = buildAuction(db, await parseBody(req));
      const next = writeDb({ ...db, auctions: [auction, ...db.auctions] });
      return sendJson(res, 201, { ok: true, auction, auctions: next.auctions });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && path.startsWith("/api/auctions/") && path.endsWith("/settle")) {
    try {
      const auctionId = parseAuctionPath(path);
      if (!auctionId) return sendJson(res, 400, { ok: false, error: "invalid auction path" });
      const next = writeDb(settleAuction(readDb(), auctionId, await parseBody(req)));
      return sendJson(res, 200, { ok: true, settlement: next.settlements[0], certificate: next.auditCertificates[0] });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && path === "/api/contact") {
    try {
      const body = await parseBody(req);
      if (!body.name || !body.email || !body.message) return sendJson(res, 400, { ok: false, error: "name, email, and message are required" });
      return sendJson(res, 201, { ok: true, ticketId: `KX-${Date.now()}`, note: "Inquiry received" });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  return sendJson(res, 404, { ok: false, error: "Route not found" });
});

server.listen(PORT, () => {
  console.log(`KredXcel backend running on http://localhost:${PORT}`);
});
