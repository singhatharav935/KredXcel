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
      if (body.length > 2e6) {
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
  return {
    invoiceId: String(input.invoiceId || "").trim(),
    vendorId: String(input.vendorId || "").trim(),
    amount: Number(input.amount || 0),
    invoiceDate: String(input.invoiceDate || "").trim(),
    acceptanceDate: String(input.acceptanceDate || input.invoiceDate || "").trim(),
    paymentDate: input.paymentDate ? String(input.paymentDate).trim() : "",
    hasWrittenAgreement: Boolean(input.hasWrittenAgreement),
    dueDays: input.hasWrittenAgreement ? 45 : 15,
    utrNumber: input.utrNumber ? String(input.utrNumber).trim() : "",
    updatedAt: new Date().toISOString()
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

  const totalOutstanding = openInvoices.reduce((sum, i) => sum + i.amount, 0) +
    overdueInvoices.reduce((sum, i) => sum + i.amount, 0);

  const totalTaxAtRisk = overdueInvoices.reduce((sum, i) => sum + i.taxAtRisk, 0);

  return {
    analyzed,
    summary: {
      vendors: db.vendors.length,
      invoices: analyzed.length,
      openInvoices: openInvoices.length,
      overdueInvoices: overdueInvoices.length,
      paidInvoices: paidInvoices.length,
      totalOutstanding,
      totalTaxAtRisk
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
      additionalTaxRisk: 0
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
  const additionalTaxRisk = impacted.reduce((sum, row) => sum + row.amount * TAX_RATE, 0);

  return {
    delayDays,
    enterpriseType: targetType || "all",
    impactedInvoices: impacted.length,
    additionalTaxRisk,
    impactedInvoiceIds: impacted.map((row) => row.invoiceId)
  };
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

  if (req.method === "GET" && path === "/api/treasury/metrics") {
    const db = readDb();
    const exposure = computeExposure(db);
    sendJson(res, 200, exposure.summary);
    return;
  }

  if (req.method === "GET" && path === "/api/treasury/exposure") {
    const db = readDb();
    const exposure = computeExposure(db);
    sendJson(res, 200, exposure.analyzed);
    return;
  }

  if (req.method === "POST" && path === "/api/ingest/vendors") {
    try {
      const body = await parseBody(req);
      if (!Array.isArray(body.vendors) || body.vendors.length === 0) {
        sendJson(res, 400, { ok: false, error: "vendors array is required" });
        return;
      }

      const db = readDb();
      const map = new Map(db.vendors.map((v) => [v.vendorId, v]));

      body.vendors.map(normalizeVendor).forEach((vendor) => {
        if (!vendor.vendorId || !vendor.name) {
          return;
        }
        map.set(vendor.vendorId, vendor);
      });

      const next = writeDb({ ...db, vendors: [...map.values()] });
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

      const db = readDb();
      const map = new Map(db.invoices.map((i) => [i.invoiceId, i]));

      body.invoices.map(normalizeInvoice).forEach((invoice) => {
        if (!invoice.invoiceId || !invoice.vendorId || !invoice.invoiceDate || invoice.amount <= 0) {
          return;
        }
        map.set(invoice.invoiceId, invoice);
      });

      const next = writeDb({ ...db, invoices: [...map.values()] });
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
      const exposure = computeExposure(db);
      const result = computeSimulation(exposure.analyzed, body);
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
