import { useEffect, useMemo, useState } from "react";
import "./styles.css";

const emptySite = { hero: { eyebrow: "", title: "", subtitle: "" }, phases: [] };
const emptyMetrics = {
  vendors: 0,
  invoices: 0,
  openInvoices: 0,
  overdueInvoices: 0,
  paidInvoices: 0,
  totalOutstanding: 0,
  totalTaxAtRisk: 0
};

function currency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function parseBids(text) {
  const lines = String(text || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return lines.map((line) => {
    const [lender, annualRate, processingFeePct] = line.split(",").map((x) => x.trim());
    return {
      lender,
      annualRate: Number(annualRate || 0),
      processingFeePct: Number(processingFeePct || 0)
    };
  });
}

function App() {
  const [site, setSite] = useState(emptySite);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [exposure, setExposure] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [logs, setLogs] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [connectorForm, setConnectorForm] = useState({ connectorId: "tally", mode: "file", endpoint: "", authType: "none" });
  const [syncForm, setSyncForm] = useState({ connectorId: "tally", vendorsCsv: "", invoicesCsv: "" });
  const [csvUpload, setCsvUpload] = useState({ vendors: "", invoices: "" });

  const [auctionForm, setAuctionForm] = useState({ invoiceId: "", bidsText: "" });
  const [settleForm, setSettleForm] = useState({ auctionId: "", paymentDate: "", utrNumber: "" });
  const [simulationForm, setSimulationForm] = useState({ delayDays: 10, enterpriseType: "" });
  const [simulationResult, setSimulationResult] = useState(null);
  const [verifyBusyVendorId, setVerifyBusyVendorId] = useState("");
  const [verifyAllBusy, setVerifyAllBusy] = useState(false);
  const [optimizerQuarterEnd, setOptimizerQuarterEnd] = useState("");
  const [optimizer, setOptimizer] = useState(null);

  const topExposure = useMemo(() => [...exposure].sort((a, b) => b.taxAtRisk - a.taxAtRisk).slice(0, 12), [exposure]);

  async function parseResponse(res) {
    const payload = await res.json();
    if (res.ok === false) {
      throw new Error(payload.error || "Request failed");
    }
    return payload;
  }

  async function refreshData() {
    try {
      const [
        siteRes,
        metricsRes,
        exposureRes,
        connectorsRes,
        vendorsRes,
        logsRes,
        auctionsRes,
        settlementsRes,
        certificatesRes,
        optimizerRes
      ] = await Promise.all([
        fetch("/api/site"),
        fetch("/api/treasury/metrics"),
        fetch("/api/treasury/exposure"),
        fetch("/api/connectors"),
        fetch("/api/vendors"),
        fetch("/api/ingestion/logs"),
        fetch("/api/auctions"),
        fetch("/api/settlements"),
        fetch("/api/audit/certificates"),
        fetch("/api/optimizer/advance-tax" + (optimizerQuarterEnd ? `?quarterEnd=${optimizerQuarterEnd}` : ""))
      ]);

      const [
        sitePayload,
        metricsPayload,
        exposurePayload,
        connectorsPayload,
        vendorsPayload,
        logsPayload,
        auctionsPayload,
        settlementsPayload,
        certificatesPayload,
        optimizerPayload
      ] = await Promise.all([
        parseResponse(siteRes),
        parseResponse(metricsRes),
        parseResponse(exposureRes),
        parseResponse(connectorsRes),
        parseResponse(vendorsRes),
        parseResponse(logsRes),
        parseResponse(auctionsRes),
        parseResponse(settlementsRes),
        parseResponse(certificatesRes),
        parseResponse(optimizerRes)
      ]);

      setSite(sitePayload);
      setMetrics(metricsPayload);
      setExposure(exposurePayload);
      setConnectors(connectorsPayload);
      setVendors(vendorsPayload);
      setLogs(logsPayload);
      setAuctions(auctionsPayload);
      setSettlements(settlementsPayload);
      setCertificates(certificatesPayload);
      setOptimizer(optimizerPayload);
      setError("");
    } catch (err) {
      setError(err.message || "Backend unavailable");
    }
  }

  useEffect(() => {
    refreshData();
  }, []);

  async function saveConnectorConfig(event) {
    event.preventDefault();
    try {
      await parseResponse(
        await fetch("/api/connectors/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(connectorForm)
        })
      );
      setNotice("Connector configuration saved");
      await refreshData();
    } catch (err) {
      setNotice(err.message || "Unable to save connector config");
    }
  }

  async function syncConnector(event) {
    event.preventDefault();
    try {
      const payload = await parseResponse(
        await fetch(`/api/connectors/${syncForm.connectorId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendorsCsv: syncForm.vendorsCsv, invoicesCsv: syncForm.invoicesCsv })
        })
      );
      setNotice(`Connector sync completed: vendors ${payload.vendorsIngested}, invoices ${payload.invoicesIngested}`);
      setSyncForm((prev) => ({ ...prev, vendorsCsv: "", invoicesCsv: "" }));
      await refreshData();
    } catch (err) {
      setNotice(err.message || "Connector sync failed");
    }
  }

  async function uploadCsv(type) {
    try {
      const endpoint = type === "vendors" ? "/api/import/csv/vendors" : "/api/import/csv/invoices";
      const csv = type === "vendors" ? csvUpload.vendors : csvUpload.invoices;
      await parseResponse(
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv })
        })
      );
      setNotice(`${type} CSV ingested`);
      setCsvUpload((prev) => ({ ...prev, [type]: "" }));
      await refreshData();
    } catch (err) {
      setNotice(err.message || "CSV ingestion failed");
    }
  }

  async function verifyVendor(vendorId) {
    try {
      setVerifyBusyVendorId(vendorId);
      await parseResponse(
        await fetch(`/api/vendors/${encodeURIComponent(vendorId)}/verify`, {
          method: "POST"
        })
      );
      setNotice(`Vendor ${vendorId} verified from live registry APIs`);
      await refreshData();
    } catch (err) {
      setNotice(err.message || "Vendor verification failed");
    } finally {
      setVerifyBusyVendorId("");
    }
  }

  async function verifyAllVendors() {
    try {
      setVerifyAllBusy(true);
      const payload = await parseResponse(
        await fetch("/api/vendors/verify-all", { method: "POST" })
      );
      setNotice(`Bulk verification completed: ${payload.verified} success, ${payload.failed} failed`);
      await refreshData();
    } catch (err) {
      setNotice(err.message || "Bulk vendor verification failed");
    } finally {
      setVerifyAllBusy(false);
    }
  }

  async function runSimulation(event) {
    event.preventDefault();
    try {
      const payload = await parseResponse(
        await fetch("/api/simulate/exposure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(simulationForm)
        })
      );
      setSimulationResult(payload.result);
      setNotice("Simulation completed");
    } catch (err) {
      setNotice(err.message || "Simulation failed");
    }
  }

  async function runAdvanceTaxOptimizer(event) {
    event.preventDefault();
    try {
      await refreshData();
      setNotice("Advance-tax optimizer refreshed");
    } catch (err) {
      setNotice(err.message || "Optimizer refresh failed");
    }
  }

  async function startAuction(event) {
    event.preventDefault();
    try {
      const bids = parseBids(auctionForm.bidsText);
      await parseResponse(
        await fetch("/api/auctions/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: auctionForm.invoiceId, bids })
        })
      );
      setNotice("Auction started");
      setAuctionForm({ invoiceId: "", bidsText: "" });
      await refreshData();
    } catch (err) {
      setNotice(err.message || "Auction start failed");
    }
  }

  async function settleAuction(event) {
    event.preventDefault();
    try {
      await parseResponse(
        await fetch(`/api/auctions/${settleForm.auctionId}/settle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentDate: settleForm.paymentDate, utrNumber: settleForm.utrNumber })
        })
      );
      setNotice("Auction settled and certificate generated");
      setSettleForm({ auctionId: "", paymentDate: "", utrNumber: "" });
      await refreshData();
    } catch (err) {
      setNotice(err.message || "Settlement failed");
    }
  }

  async function exportAudit(format) {
    try {
      const res = await fetch(`/api/audit/export?format=${format}`);
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || "Export failed");
      }

      if (format === "csv") {
        const text = await res.text();
        const blob = new Blob([text], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "kredxcel-audit-certificates.csv";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "kredxcel-audit-export.json";
        a.click();
        URL.revokeObjectURL(url);
      }

      setNotice(`Audit export downloaded (${format.toUpperCase()})`);
    } catch (err) {
      setNotice(err.message || "Audit export failed");
    }
  }

  return (
    <div className="site">
      <header className="hero">
        <p className="eyebrow">{site.hero.eyebrow}</p>
        <h1>{site.hero.title}</h1>
        <p className="lead">{site.hero.subtitle}</p>
      </header>

      {error ? <p className="warning">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      <section className="metrics-grid">
        <article className="card"><h3>{metrics.vendors}</h3><p>Vendors</p></article>
        <article className="card"><h3>{metrics.invoices}</h3><p>Invoices</p></article>
        <article className="card"><h3>{metrics.openInvoices}</h3><p>Open Invoices</p></article>
        <article className="card"><h3>{metrics.overdueInvoices}</h3><p>Overdue Invoices</p></article>
        <article className="card"><h3>{currency(metrics.totalOutstanding)}</h3><p>Total Outstanding</p></article>
        <article className="card"><h3>{currency(metrics.totalTaxAtRisk)}</h3><p>Total Tax At Risk</p></article>
      </section>

      <section className="panel">
        <h2>Advance-Tax Optimizer</h2>
        <form className="form-grid" onSubmit={runAdvanceTaxOptimizer}>
          <input type="date" value={optimizerQuarterEnd} onChange={(e) => setOptimizerQuarterEnd(e.target.value)} />
          <button className="btn" type="submit">Refresh Optimizer</button>
        </form>
        {optimizer ? (
          <div className="optimizer-grid">
            <article className="card"><h3>{optimizer.quarterEndDate}</h3><p>Quarter End</p></article>
            <article className="card"><h3>{optimizer.msmeInvoicesConsidered}</h3><p>MSME Invoices</p></article>
            <article className="card"><h3>{optimizer.dueAndUnpaidAtQuarterEnd}</h3><p>Due & Unpaid</p></article>
            <article className="card"><h3>{currency(optimizer.deductionAtRiskAmount)}</h3><p>Deduction At Risk</p></article>
            <article className="card"><h3>{currency(optimizer.projectedAdvanceTaxReduction)}</h3><p>Potential Tax Savings</p></article>
          </div>
        ) : <p>No optimizer data available.</p>}
      </section>

      <section className="panel">
        <h2>Vendor Verification</h2>
        <div className="button-row">
          <button className="btn" type="button" onClick={verifyAllVendors} disabled={verifyAllBusy}>
            {verifyAllBusy ? "Verifying All..." : "Verify All Vendors"}
          </button>
        </div>
        {vendors.length === 0 ? <p>No vendors ingested yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Vendor</th><th>Name</th><th>Type</th><th>GSTIN</th><th>Udyam</th><th>Last Verified</th><th>Action</th></tr></thead>
              <tbody>{vendors.map((v) => <tr key={v.vendorId}><td>{v.vendorId}</td><td>{v.name}</td><td>{v.enterpriseType}</td><td>{v.gstin || "-"}</td><td>{v.udyam || "-"}</td><td>{v.verification?.verifiedAt || "-"}</td><td><button className="btn btn-inline" type="button" disabled={verifyBusyVendorId === v.vendorId} onClick={() => verifyVendor(v.vendorId)}>{verifyBusyVendorId === v.vendorId ? "Verifying..." : "Verify"}</button></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Connector Hub</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Connector</th><th>Mode</th><th>Endpoint</th><th>Connected</th><th>Last Sync</th></tr></thead>
            <tbody>{connectors.map((c) => <tr key={c.connectorId}><td>{c.name}</td><td>{c.mode}</td><td>{c.endpoint || "-"}</td><td>{c.connected ? "yes" : "no"}</td><td>{c.lastSyncAt || "-"}</td></tr>)}</tbody>
          </table>
        </div>
        <form className="form-grid" onSubmit={saveConnectorConfig}>
          <select value={connectorForm.connectorId} onChange={(e) => setConnectorForm({ ...connectorForm, connectorId: e.target.value })}>{connectors.map((c) => <option key={c.connectorId} value={c.connectorId}>{c.name}</option>)}</select>
          <select value={connectorForm.mode} onChange={(e) => setConnectorForm({ ...connectorForm, mode: e.target.value })}><option value="api">api</option><option value="file">file</option></select>
          <select value={connectorForm.authType} onChange={(e) => setConnectorForm({ ...connectorForm, authType: e.target.value })}><option value="none">none</option><option value="token">token</option><option value="basic">basic</option></select>
          <input placeholder="Endpoint URL" value={connectorForm.endpoint} onChange={(e) => setConnectorForm({ ...connectorForm, endpoint: e.target.value })} />
          <button className="btn" type="submit">Save Connector Config</button>
        </form>
      </section>

      <section className="panel">
        <h2>Connector Sync (CSV Payload)</h2>
        <form onSubmit={syncConnector} className="stack-form">
          <select value={syncForm.connectorId} onChange={(e) => setSyncForm({ ...syncForm, connectorId: e.target.value })}>{connectors.map((c) => <option key={c.connectorId} value={c.connectorId}>{c.name}</option>)}</select>
          <textarea rows={5} placeholder="Vendors CSV" value={syncForm.vendorsCsv} onChange={(e) => setSyncForm({ ...syncForm, vendorsCsv: e.target.value })} />
          <textarea rows={6} placeholder="Invoices CSV" value={syncForm.invoicesCsv} onChange={(e) => setSyncForm({ ...syncForm, invoicesCsv: e.target.value })} />
          <button className="btn" type="submit">Run Connector Sync</button>
        </form>
      </section>

      <section className="panel">
        <h2>Direct CSV Upload</h2>
        <div className="upload-grid">
          <div>
            <textarea rows={6} placeholder="Vendors CSV" value={csvUpload.vendors} onChange={(e) => setCsvUpload({ ...csvUpload, vendors: e.target.value })} />
            <button className="btn" type="button" onClick={() => uploadCsv("vendors")}>Upload Vendors CSV</button>
          </div>
          <div>
            <textarea rows={6} placeholder="Invoices CSV" value={csvUpload.invoices} onChange={(e) => setCsvUpload({ ...csvUpload, invoices: e.target.value })} />
            <button className="btn" type="button" onClick={() => uploadCsv("invoices")}>Upload Invoices CSV</button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Auction Engine</h2>
        <form className="stack-form" onSubmit={startAuction}>
          <input placeholder="Invoice ID" value={auctionForm.invoiceId} onChange={(e) => setAuctionForm({ ...auctionForm, invoiceId: e.target.value })} />
          <textarea rows={4} placeholder="Bids: lender,annualRate,processingFeePct" value={auctionForm.bidsText} onChange={(e) => setAuctionForm({ ...auctionForm, bidsText: e.target.value })} />
          <button className="btn" type="submit">Start Auction</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Auction</th><th>Invoice</th><th>Status</th><th>Winner</th><th>Cost</th><th>Created</th></tr></thead>
            <tbody>{auctions.map((a) => <tr key={a.auctionId}><td>{a.auctionId}</td><td>{a.invoiceId}</td><td>{a.status}</td><td>{a.winner?.lender || "-"}</td><td>{a.winner ? `${a.winner.effectiveCost}%` : "-"}</td><td>{a.createdAt}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Settlement & Certificate</h2>
        <form className="form-grid" onSubmit={settleAuction}>
          <input placeholder="Auction ID" value={settleForm.auctionId} onChange={(e) => setSettleForm({ ...settleForm, auctionId: e.target.value })} />
          <input type="date" value={settleForm.paymentDate} onChange={(e) => setSettleForm({ ...settleForm, paymentDate: e.target.value })} />
          <input placeholder="UTR Number" value={settleForm.utrNumber} onChange={(e) => setSettleForm({ ...settleForm, utrNumber: e.target.value })} />
          <button className="btn" type="submit">Settle Auction</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Settlement</th><th>Auction</th><th>Invoice</th><th>Lender</th><th>Amount</th><th>Payment</th><th>UTR</th></tr></thead>
            <tbody>{settlements.map((s) => <tr key={s.settlementId}><td>{s.settlementId}</td><td>{s.auctionId}</td><td>{s.invoiceId}</td><td>{s.lender}</td><td>{currency(s.amount)}</td><td>{s.paymentDate}</td><td>{s.utrNumber}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Audit Certificates</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Certificate</th><th>Invoice</th><th>Status</th><th>Due Date</th><th>Payment Date</th><th>Days Taken</th><th>UTR</th></tr></thead>
            <tbody>{certificates.map((c) => <tr key={c.certificateId}><td>{c.certificateId}</td><td>{c.invoiceId}</td><td>{c.complianceStatus}</td><td>{c.dueDate}</td><td>{c.paymentDate}</td><td>{c.daysTaken ?? "-"}</td><td>{c.utrNumber}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Audit Export</h2>
        <div className="button-row">
          <button className="btn" type="button" onClick={() => exportAudit("json")}>Download JSON Export</button>
          <button className="btn" type="button" onClick={() => exportAudit("csv")}>Download CSV Export</button>
        </div>
      </section>

      <section className="panel">
        <h2>Exposure Simulation</h2>
        <form className="form-grid" onSubmit={runSimulation}>
          <input type="number" min="1" value={simulationForm.delayDays} onChange={(e) => setSimulationForm({ ...simulationForm, delayDays: Number(e.target.value || 0) })} />
          <select value={simulationForm.enterpriseType} onChange={(e) => setSimulationForm({ ...simulationForm, enterpriseType: e.target.value })}>
            <option value="">All Types</option><option value="micro">Micro</option><option value="small">Small</option><option value="non-msme">Non-MSME</option>
          </select>
          <button className="btn" type="submit">Run Simulation</button>
        </form>
        {simulationResult ? <div className="sim-result"><p>Impacted Invoices: {simulationResult.impactedInvoices}</p><p>Additional Tax Risk: {currency(simulationResult.additionalTaxRisk)}</p></div> : null}
      </section>

      <section className="panel">
        <h2>Top Tax At Risk Invoices</h2>
        {topExposure.length === 0 ? <p>No invoices available.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Invoice</th><th>Vendor</th><th>Status</th><th>Amount</th><th>Tax At Risk</th><th>Due Date</th></tr></thead>
              <tbody>{topExposure.map((row) => <tr key={row.invoiceId}><td>{row.invoiceId}</td><td>{row.vendorName}</td><td>{row.status}</td><td>{currency(row.amount)}</td><td>{currency(row.taxAtRisk)}</td><td>{row.dueDate}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Ingestion Logs</h2>
        {logs.length === 0 ? <p>No ingestion logs yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Timestamp</th><th>Type</th><th>Source</th><th>Accepted</th></tr></thead>
              <tbody>{logs.map((log) => <tr key={log.id}><td>{log.timestamp}</td><td>{log.type}</td><td>{log.source}</td><td>{log.accepted}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
