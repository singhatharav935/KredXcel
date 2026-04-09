import "./styles.css";

const metrics = [
  { label: "Invoices Tracked", value: "12,480+" },
  { label: "Potential Tax Saved", value: "INR 8.4 Cr" },
  { label: "Avg Auction Rate", value: "9.2%" },
  { label: "Audit Packet Time", value: "< 30 sec" }
];

const phases = [
  {
    phase: "Phase 1",
    title: "Deep-ERP Ingestion",
    text: "Read-write agents connect with Tally, SAP, and Oracle to ingest vendor masters, invoices, and appointed-day logic."
  },
  {
    phase: "Phase 2",
    title: "Compliance Watchdog",
    text: "Predictive aging continuously computes 15/45-day compliance windows and flags tax-at-risk before a breach."
  },
  {
    phase: "Phase 3",
    title: "Liquidity Bridge",
    text: "Flash-auction engine runs lender bidding across NBFCs and banks to fund MSME payouts at lowest cost."
  },
  {
    phase: "Phase 4",
    title: "Audit Vault",
    text: "Every settlement is packed with UTR evidence, timestamp proofs, and 43B(h)-ready disclosure snapshots."
  }
];

const capabilities = [
  "GSTN-Udyam Deep Link Verification",
  "NLP Agreement Intelligence (15 vs 45 day)",
  "Dynamic Risk-Based Financing Scores",
  "Split-Payment Orchestration",
  "Monte Carlo Tax Exposure Simulation",
  "Form 3CD / Notes-to-Accounts Generator"
];

function App() {
  return (
    <div className="site">
      <header className="hero">
        <nav className="nav">
          <div className="logo">KredXcel</div>
          <div className="nav-links">
            <a href="#workflow">Workflow</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#architecture">Architecture</a>
          </div>
        </nav>

        <div className="hero-body">
          <p className="eyebrow">Autonomous Treasury Infrastructure</p>
          <h1>Section 43B(h) Compliance, Liquidity, and Audit Defense in One System.</h1>
          <p className="lead">
            KredXcel helps enterprises avoid tax leakage by monitoring MSME dues, predicting liquidity gaps,
            executing low-cost financing, and generating scrutiny-proof legal evidence.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-solid">Request Pilot</button>
            <button type="button" className="btn btn-ghost">View Demo Flow</button>
          </div>
        </div>
      </header>

      <section className="metrics">
        {metrics.map((metric) => (
          <article key={metric.label} className="metric-card">
            <p className="metric-value">{metric.value}</p>
            <p className="metric-label">{metric.label}</p>
          </article>
        ))}
      </section>

      <section id="workflow" className="panel">
        <h2>Full Workflow</h2>
        <div className="timeline">
          {phases.map((item) => (
            <article className="timeline-card" key={item.title}>
              <span>{item.phase}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="capabilities" className="panel">
        <h2>Advanced Capabilities</h2>
        <div className="chips">
          {capabilities.map((item) => (
            <span key={item} className="chip">{item}</span>
          ))}
        </div>
      </section>

      <section id="architecture" className="architecture">
        <h2>Agentic Ledger Stack</h2>
        <div className="stack-grid">
          <article>
            <h3>Ingestion Agents</h3>
            <p>ERP connectors, invoice normalization, appointed-day reconciliation.</p>
          </article>
          <article>
            <h3>Intelligence Agents</h3>
            <p>Vendor classification, contract NLP, predictive exposure forecasting.</p>
          </article>
          <article>
            <h3>Execution Agents</h3>
            <p>Auctioneer, bid optimizer, split-payment and payment routing.</p>
          </article>
          <article>
            <h3>Assurance Agents</h3>
            <p>Audit-vault certificates, disclosure packs, and compliance snapshots.</p>
          </article>
        </div>
      </section>
    </div>
  );
}

export default App;
