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

function daysBetween(fromDate, toDate) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((toDate - fromDate) / dayMs);
}

function toDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
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
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    return row;
  });
}

function ingestVendors(db, vendorsInput, source) {
  const map = new Map(db.vendors.map((v) => [v.vendorId, v]));
  let accepted = 0;

  vendorsInput.map(normalizeVendor).forEach((vendor) => {
    if (!vendor.vendorId || !vendor.name) {
      return;
    }
    map.set(vendor.vendorId, vendor);
    accepted += 1;
  });

  const log = {
    id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: "vendors",
    source,
    accepted,
    timestamp: new Date().toISOString()
  };

  return {
    ...db,
    vendors: [...map.values()],
    ingestionLogs: [log, ...db.ingestionLogs].slice(0, 100)
  };
}

function ingestInvoices(db, invoicesInput, source) {
  const map = new Map(db.invoices.map((i) => [i.invoiceId, i]));
  let accepted = 0;

  invoicesInput.map(normalizeInvoice).forEach((invoice) => {
    if (!invoice.invoiceId || !invoice.vendorId || !invoice.invoiceDate || invoice.amount <= 0) {
      return;
    }
    map.set(invoice.invoiceId, invoice);
    accepted += 1;
  });

  const log = {
    id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: "invoices",
    source,
    accepted,
    timestamp: new Date().toISOString()
  };

  return {
    ...db,
    invoices: [...map.values()],
    ingestionLogs: [log, ...db.ingestionLogs].slice(0, 100)
  };
}

function computeExposure(db) {
  const now = new Date();
  const vendors = new Map(db.vendors.map((v) => [v.vendorId, v]));

  const analyzed = db.invoices
    .map((inv) => {
      const vendor = vendors.get(inv.vendorId);
      const acceptance = toDate(inv.acceptanceDate);
      if (!acceptance) {
        return null;
      }

      const dueDate = new Date(acceptance);
      dueDate.setDate(dueDate.getDate() + Number(inv.dueDays || 15));

      const paid = Boolean(inv.paymentDate);
      const paymentDate = inv.paymentDate ? toDate(inv.paymentDate) : null;
      const referenceDate = paid && paymentDate ? paymentDate : now;
      const daysElapsed = Math.max(0, daysBetween(acceptance, referenceDate));
      const daysToDue = daysBetween(now, dueDate);
      const overdueDays = daysBetween(dueDate, now);
      const isOverdue = !paid && overdueDays > 0;
      const taxAtRisk = isOverdue ? inv.amount * TAX_RATE : 0;

      return {
        invoiceId: inv.invoiceId,
        vendorId: inv.vendorId,
        vendorName: vendor?.name || "Unknown Vendor",
        enterpriseType: vendor?.enterpriseType || "unknown",
        amount: inv.amount,
        dueDays: inv.dueDays,
        hasWrittenAgreement: inv.hasWrittenAgreement,
        invoiceDate: inv.invoiceDate,
        acceptanceDate: inv.acceptanceDate,
        dueDate: dueDate.toISOString().slice(0, 10),
        paymentDate: inv.paymentDate || null,
        daysElapsed,
        daysToDue,
        overdueDays: isOverdue ? overdueDays : 0,
        status: paid ? "paid" : isOverdue ? "overdue" : "open",
        taxAtRisk
      };
    })
    .filter(Boolean);

  const openInvoices = analyzed.filter((i) => i.status === "open");
  const overdueInvoices = analyzed.filter((i) => i.status === "overdue");
  const paidInvoices = analyzed.filter((i) => i.status === "paid");

  return {
    analyzed,
    summary: {
      vendors: db.vendors.length,
      invoices: analyzed.length,
      openInvoices: openInvoices.length,
      overdueInvoices: overdueInvoices.length,
      paidInvoices: paidInvoices.length,
      totalOutstanding:
        openInvoices.reduce((sum, i) => sum + i.amount, 0) +
        overdueInvoices.reduce((sum, i) => sum + i.amount, 0),
      totalTaxAtRisk: overdueInvoices.reduce((sum, i) => sum + i.taxAtRisk, 0)
    }
  };
}

function computeSimulation(exposureRows, payload) {
  const delayDays = Number(payload.delayDays || 0);
  const targetType = payload.enterpriseType ? String(payload.enterpriseType).toLowerCase() : "";

  if (delayDays <= 0) {
    return {
      delayDays: 0,
      impactedInvoices: 0,
      additionalTaxRisk: 0,
      impactedInvoiceIds: []
    };
  }

  const candidates = exposureRows.filter((row) => {
    if (row.status !== "open") {
      return false;
    }
    if (!targetType) {
      return true;
    }
    return row.enterpriseType === targetType;
  });

  const impacted = candidates.filter((row) => row.daysToDue - delayDays < 0);
  return {
    delayDays,
    enterpriseType: targetType || "all",
    impactedInvoices: impacted.length,
    additionalTaxRisk: impacted.reduce((sum, row) => sum + row.amount * TAX_RATE, 0),
    impactedInvoiceIds: impacted.map((row) => row.invoiceId)
  };
}

function extractConnectorId(path) {
  const match = path.match(/^\/api\/connectors\/([^/]+)\/sync$/);
  return match ? match[1] : "";
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const path = parsed.pathname;

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "GET" && path === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "kredxcel-api",
      port: PORT,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (req.method === "GET" && path === "/api/site") {
    sendJson(res, 200, siteContent);
    return;
  }

  if (req.method === "GET" && path === "/api/connectors") {
    const db = readDb();
    sendJson(res, 200, db.connectors);
    return;
  }

  if (req.method === "POST" && path === "/api/connectors/config") {
    try {
      const body = await parseBody(req);
      const connectorId = String(body.connectorId || "").trim().toLowerCase();
      if (!connectorId) {
        sendJson(res, 400, { ok: false, error: "connectorId is required" });
        return;
      }

      const db = readDb();
      const updated = db.connectors.map((connector) => {
        if (connector.connectorId !== connectorId) {
          return connector;
        }
        return {
          ...connector,
          mode: String(body.mode || connector.mode || "api"),
          endpoint: String(body.endpoint || "").trim(),
          authType: String(body.authType || connector.authType || "none"),
          connected: true
        };
      });

      const next = writeDb({ ...db, connectors: updated });
      sendJson(res, 200, { ok: true, connectors: next.connectors });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && path.startsWith("/api/connectors/") && path.endsWith("/sync")) {
    try {
      const connectorId = extractConnectorId(path);
      if (!connectorId) {
        sendJson(res, 400, { ok: false, error: "invalid connector path" });
        return;
      }

      const body = await parseBody(req);
      const vendorRows = parseCsv(body.vendorsCsv || "");
      const invoiceRows = parseCsv(body.invoicesCsv || "");

      let db = readDb();
      if (vendorRows.length > 0) {
        db = ingestVendors(db, vendorRows, `${connectorId}-sync`);
      }
      if (invoiceRows.length > 0) {
        db = ingestInvoices(db, invoiceRows, `${connectorId}-sync`);
      }

      const connectors = db.connectors.map((connector) => {
        if (connector.connectorId !== connectorId) {
          return connector;
        }
        return {
          ...connector,
          connected: true,
          lastSyncAt: new Date().toISOString()
        };
      });

      const next = writeDb({ ...db, connectors });
      sendJson(res, 200, {
        ok: true,
        connectorId,
        vendorsIngested: vendorRows.length,
        invoicesIngested: invoiceRows.length,
        connectors: next.connectors
      });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && path === "/api/import/csv/vendors") {
    try {
      const body = await parseBody(req);
      const rows = parseCsv(body.csv || "");
      if (rows.length === 0) {
        sendJson(res, 400, { ok: false, error: "csv must include header and rows" });
        return;
      }

      const next = writeDb(ingestVendors(readDb(), rows, "csv-upload"));
      sendJson(res, 200, { ok: true, vendors: next.vendors.length });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && path === "/api/import/csv/invoices") {
    try {
      const body = await parseBody(req);
      const rows = parseCsv(body.csv || "");
      if (rows.length === 0) {
        sendJson(res, 400, { ok: false, error: "csv must include header and rows" });
        return;
      }

      const next = writeDb(ingestInvoices(readDb(), rows, "csv-upload"));
      sendJson(res, 200, { ok: true, invoices: next.invoices.length });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "GET" && path === "/api/ingestion/logs") {
    const db = readDb();
    sendJson(res, 200, db.ingestionLogs);
    return;
  }

  if (req.method === "GET" && path === "/api/treasury/metrics") {
    const db = readDb();
    sendJson(res, 200, computeExposure(db).summary);
    return;
  }

  if (req.method === "GET" && path === "/api/treasury/exposure") {
    const db = readDb();
    sendJson(res, 200, computeExposure(db).analyzed);
    return;
  }

  if (req.method === "POST" && path === "/api/ingest/vendors") {
    try {
      const body = await parseBody(req);
      if (!Array.isArray(body.vendors) || body.vendors.length === 0) {
        sendJson(res, 400, { ok: false, error: "vendors array is required" });
        return;
      }

      const next = writeDb(ingestVendors(readDb(), body.vendors, "api-direct"));
      sendJson(res, 200, { ok: true, vendors: next.vendors.length });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && path === "/api/ingest/invoices") {
    try {
      const body = await parseBody(req);
      if (!Array.isArray(body.invoices) || body.invoices.length === 0) {
        sendJson(res, 400, { ok: false, error: "invoices array is required" });
        return;
      }

      const next = writeDb(ingestInvoices(readDb(), body.invoices, "api-direct"));
      sendJson(res, 200, { ok: true, invoices: next.invoices.length });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && path === "/api/simulate/exposure") {
    try {
      const body = await parseBody(req);
      const db = readDb();
      const result = computeSimulation(computeExposure(db).analyzed, body);
      sendJson(res, 200, { ok: true, result });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && path === "/api/contact") {
    try {
      const body = await parseBody(req);
      if (!body.name || !body.email || !body.message) {
        sendJson(res, 400, {
          ok: false,
          error: "name, email, and message are required"
        });
        return;
      }

      sendJson(res, 201, {
        ok: true,
        ticketId: `KX-${Date.now()}`,
        note: "Inquiry received"
      });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found" });
});

server.listen(PORT, () => {
  console.log(`KredXcel backend running on http://localhost:${PORT}`);
});
