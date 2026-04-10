import { useEffect, useMemo, useState } from "react";
import "./styles.css";

const emptySite = {
  hero: {
    eyebrow: "",
    title: "",
    subtitle: ""
  },
  phases: [],
  capabilities: []
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
  const [error, setError] = useState("");

  const [vendorForm, setVendorForm] = useState({
    vendorId: "",
    name: "",
    enterpriseType: "micro",
    gstin: "",
    udyam: ""
  });

  const [invoiceForm, setInvoiceForm] = useState({
    invoiceId: "",
    vendorId: "",
    amount: "",
    invoiceDate: "",
    acceptanceDate: "",
    hasWrittenAgreement: true,
    paymentDate: "",
    utrNumber: ""
  });

  const [simulationForm, setSimulationForm] = useState({
    delayDays: 10,
    enterpriseType: ""
  });

  const [simulationResult, setSimulationResult] = useState(null);
  const [notice, setNotice] = useState("");

  const topExposure = useMemo(
    () => [...exposure].sort((a, b) => b.taxAtRisk - a.taxAtRisk).slice(0, 8),
    [exposure]
  );

  async function refreshData() {
    try {
      const [siteRes, metricsRes, exposureRes] = await Promise.all([
        fetch("/api/site"),
        fetch("/api/treasury/metrics"),
        fetch("/api/treasury/exposure")
      ]);

      if (!siteRes.ok || !metricsRes.ok || !exposureRes.ok) {
        throw new Error("API unavailable");
      }

      const [sitePayload, metricsPayload, exposurePayload] = await Promise.all([
        siteRes.json(),
        metricsRes.json(),
        exposureRes.json()
      ]);

      setSite(sitePayload);
      setMetrics(metricsPayload);
      setExposure(exposurePayload);
      setError("");
    } catch (_err) {
      setError("Backend unavailable. Start backend first, then refresh.");
    }
  }

  useEffect(() => {
    refreshData();
  }, []);

  async function submitVendor(event) {
    event.preventDefault();
    const res = await fetch("/api/ingest/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendors: [vendorForm] })
    });

    const payload = await res.json();
    if (!res.ok) {
      setNotice(payload.error || "Failed to ingest vendor");
      return;
    }

    setNotice("Vendor ingested successfully");
    setVendorForm({ vendorId: "", name: "", enterpriseType: "micro", gstin: "", udyam: "" });
    refreshData();
  }

  async function submitInvoice(event) {
    event.preventDefault();
    const payload = {
      ...invoiceForm,
      amount: Number(invoiceForm.amount || 0)
    };

    const res = await fetch("/api/ingest/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoices: [payload] })
    });

    const data = await res.json();
    if (!res.ok) {
      setNotice(data.error || "Failed to ingest invoice");
      return;
    }

    setNotice("Invoice ingested successfully");
    setInvoiceForm({
      invoiceId: "",
      vendorId: "",
      amount: "",
      invoiceDate: "",
      acceptanceDate: "",
      hasWrittenAgreement: true,
      paymentDate: "",
      utrNumber: ""
    });
    refreshData();
  }

  async function runSimulation(event) {
    event.preventDefault();
    const res = await fetch("/api/simulate/exposure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(simulationForm)
    });

    const payload = await res.json();
    if (!res.ok) {
      setNotice(payload.error || "Simulation failed");
      return;
    }

    setSimulationResult(payload.result);
    setNotice("Simulation completed");
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
        <h2>Ingest Vendor</h2>
        <form className="form-grid" onSubmit={submitVendor}>
          <input required placeholder="Vendor ID" value={vendorForm.vendorId} onChange={(e) => setVendorForm({ ...vendorForm, vendorId: e.target.value })} />
          <input required placeholder="Vendor Name" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} />
          <select value={vendorForm.enterpriseType} onChange={(e) => setVendorForm({ ...vendorForm, enterpriseType: e.target.value })}>
            <option value="micro">Micro</option>
            <option value="small">Small</option>
            <option value="non-msme">Non-MSME</option>
          </select>
          <input placeholder="GSTIN" value={vendorForm.gstin} onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })} />
          <input placeholder="Udyam" value={vendorForm.udyam} onChange={(e) => setVendorForm({ ...vendorForm, udyam: e.target.value })} />
          <button className="btn" type="submit">Save Vendor</button>
        </form>
      </section>

      <section className="panel">
        <h2>Ingest Invoice</h2>
        <form className="form-grid" onSubmit={submitInvoice}>
          <input required placeholder="Invoice ID" value={invoiceForm.invoiceId} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceId: e.target.value })} />
          <input required placeholder="Vendor ID" value={invoiceForm.vendorId} onChange={(e) => setInvoiceForm({ ...invoiceForm, vendorId: e.target.value })} />
          <input required type="number" min="1" placeholder="Amount" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
          <input required type="date" value={invoiceForm.invoiceDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })} />
          <input type="date" value={invoiceForm.acceptanceDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, acceptanceDate: e.target.value })} />
          <label className="checkbox">
            <input type="checkbox" checked={invoiceForm.hasWrittenAgreement} onChange={(e) => setInvoiceForm({ ...invoiceForm, hasWrittenAgreement: e.target.checked })} />
            Written Agreement (45 days)
          </label>
          <input type="date" value={invoiceForm.paymentDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentDate: e.target.value })} />
          <input placeholder="UTR Number" value={invoiceForm.utrNumber} onChange={(e) => setInvoiceForm({ ...invoiceForm, utrNumber: e.target.value })} />
          <button className="btn" type="submit">Save Invoice</button>
        </form>
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
          <p>No invoices ingested yet.</p>
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
    </div>
  );
}

export default App;
