import { useEffect, useMemo, useState } from "react";
import "./styles.css";

const emptySite = {
  hero: { eyebrow: "", title: "", subtitle: "" },
  phases: []
};

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

function App() {
  const [site, setSite] = useState(emptySite);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [exposure, setExposure] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [connectorForm, setConnectorForm] = useState({
    connectorId: "tally",
    mode: "file",
    endpoint: "",
    authType: "none"
  });

  const [syncForm, setSyncForm] = useState({
    connectorId: "tally",
    vendorsCsv: "",
    invoicesCsv: ""
  });

  const [csvUpload, setCsvUpload] = useState({ vendors: "", invoices: "" });

  const [simulationForm, setSimulationForm] = useState({ delayDays: 10, enterpriseType: "" });
  const [simulationResult, setSimulationResult] = useState(null);

  const topExposure = useMemo(
    () => [...exposure].sort((a, b) => b.taxAtRisk - a.taxAtRisk).slice(0, 12),
    [exposure]
  );

  async function parseResponse(res) {
    const payload = await res.json();
    if (res.ok === false) {
      throw new Error(payload.error || "Request failed");
    }
    return payload;
  }

  async function refreshData() {
    try {
      const [siteRes, metricsRes, exposureRes, connectorsRes, logsRes] = await Promise.all([
        fetch("/api/site"),
        fetch("/api/treasury/metrics"),
        fetch("/api/treasury/exposure"),
        fetch("/api/connectors"),
        fetch("/api/ingestion/logs")
      ]);

      const [sitePayload, metricsPayload, exposurePayload, connectorsPayload, logsPayload] = await Promise.all([
        parseResponse(siteRes),
        parseResponse(metricsRes),
        parseResponse(exposureRes),
        parseResponse(connectorsRes),
        parseResponse(logsRes)
      ]);

      setSite(sitePayload);
      setMetrics(metricsPayload);
      setExposure(exposurePayload);
      setConnectors(connectorsPayload);
      setLogs(logsPayload);
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
      const res = await fetch("/api/connectors/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(connectorForm)
      });
      await parseResponse(res);
      setNotice("Connector configuration saved");
      await refreshData();
    } catch (err) {
      setNotice(err.message || "Unable to save connector config");
    }
  }

  async function syncConnector(event) {
    event.preventDefault();
    try {
      const res = await fetch(`/api/connectors/${syncForm.connectorId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorsCsv: syncForm.vendorsCsv, invoicesCsv: syncForm.invoicesCsv })
      });
      const payload = await parseResponse(res);
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

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv })
      });
      await parseResponse(res);
      setNotice(`${type} CSV ingested`);
      setCsvUpload((prev) => ({ ...prev, [type]: "" }));
      await refreshData();
    } catch (err) {
      setNotice(err.message || "CSV ingestion failed");
    }
  }

  async function runSimulation(event) {
    event.preventDefault();
    try {
      const res = await fetch("/api/simulate/exposure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(simulationForm)
      });
      const payload = await parseResponse(res);
      setSimulationResult(payload.result);
      setNotice("Simulation completed");
    } catch (err) {
      setNotice(err.message || "Simulation failed");
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
        <h2>Workflow</h2>
        <div className="timeline">
          {site.phases.map((phase) => (
            <article className="timeline-card" key={phase.phase}>
              <strong>{phase.phase}</strong>
              <h3>{phase.title}</h3>
              <p>{phase.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Connector Hub</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Connector</th>
                <th>Mode</th>
                <th>Endpoint</th>
                <th>Connected</th>
                <th>Last Sync</th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((connector) => (
                <tr key={connector.connectorId}>
                  <td>{connector.name}</td>
                  <td>{connector.mode}</td>
                  <td>{connector.endpoint || "-"}</td>
                  <td>{connector.connected ? "yes" : "no"}</td>
                  <td>{connector.lastSyncAt || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="form-grid" onSubmit={saveConnectorConfig}>
          <select value={connectorForm.connectorId} onChange={(e) => setConnectorForm({ ...connectorForm, connectorId: e.target.value })}>
            {connectors.map((c) => <option key={c.connectorId} value={c.connectorId}>{c.name}</option>)}
          </select>
          <select value={connectorForm.mode} onChange={(e) => setConnectorForm({ ...connectorForm, mode: e.target.value })}>
            <option value="api">api</option>
            <option value="file">file</option>
          </select>
          <select value={connectorForm.authType} onChange={(e) => setConnectorForm({ ...connectorForm, authType: e.target.value })}>
            <option value="none">none</option>
            <option value="token">token</option>
            <option value="basic">basic</option>
          </select>
          <input placeholder="Endpoint URL" value={connectorForm.endpoint} onChange={(e) => setConnectorForm({ ...connectorForm, endpoint: e.target.value })} />
          <button className="btn" type="submit">Save Connector Config</button>
        </form>
      </section>

      <section className="panel">
        <h2>Connector Sync (CSV Payload)</h2>
        <form onSubmit={syncConnector} className="stack-form">
          <select value={syncForm.connectorId} onChange={(e) => setSyncForm({ ...syncForm, connectorId: e.target.value })}>
            {connectors.map((c) => <option key={c.connectorId} value={c.connectorId}>{c.name}</option>)}
          </select>
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
        <h2>Exposure Simulation</h2>
        <form className="form-grid" onSubmit={runSimulation}>
          <input type="number" min="1" value={simulationForm.delayDays} onChange={(e) => setSimulationForm({ ...simulationForm, delayDays: Number(e.target.value || 0) })} />
          <select value={simulationForm.enterpriseType} onChange={(e) => setSimulationForm({ ...simulationForm, enterpriseType: e.target.value })}>
            <option value="">All Types</option>
            <option value="micro">Micro</option>
            <option value="small">Small</option>
            <option value="non-msme">Non-MSME</option>
          </select>
          <button className="btn" type="submit">Run Simulation</button>
        </form>

        {simulationResult ? (
          <div className="sim-result">
            <p>Impacted Invoices: {simulationResult.impactedInvoices}</p>
            <p>Additional Tax Risk: {currency(simulationResult.additionalTaxRisk)}</p>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Top Tax At Risk Invoices</h2>
        {topExposure.length === 0 ? (
          <p>No invoices available.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Vendor</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Tax At Risk</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {topExposure.map((row) => (
                  <tr key={row.invoiceId}>
                    <td>{row.invoiceId}</td>
                    <td>{row.vendorName}</td>
                    <td>{row.status}</td>
                    <td>{currency(row.amount)}</td>
                    <td>{currency(row.taxAtRisk)}</td>
                    <td>{row.dueDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Ingestion Logs</h2>
        {logs.length === 0 ? (
          <p>No ingestion logs yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Accepted</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.timestamp}</td>
                    <td>{log.type}</td>
                    <td>{log.source}</td>
                    <td>{log.accepted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
