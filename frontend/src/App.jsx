import "./styles.css";

const phases = [
  {
    title: "Phase 1: Deep-ERP Ingestion",
    desc: "Read-write agents connect to Tally, SAP, and Oracle to ingest invoices, payments, and vendor masters.",
    bullets: [
      "GSTIN + Udyam live verification",
      "Auto-tag: Micro, Small, Non-MSME",
      "Appointed-day smart ledgering (15/45 day clock)"
    ]
  },
  {
    title: "Phase 2: Compliance Watchdog",
    desc: "AI continuously calculates tax-at-risk and alerts before Section 43B(h) deadlines are breached.",
    bullets: [
      "Real-time aging and exposure view",
      "Predictive cash-gap detection",
      "Day-35/40 critical escalation triggers"
    ]
  },
  {
    title: "Phase 3: Liquidity Bridge",
    desc: "If liquidity is insufficient, KredXcel launches a flash auction among NBFCs and banks.",
    bullets: [
      "Risk-based lender pricing",
      "Lowest-cost bid optimization",
      "Atomic split-payment orchestration"
    ]
  },
  {
    title: "Phase 4: Audit Vault",
    desc: "Each settlement is preserved as scrutiny-ready legal evidence for tax and statutory audits.",
    bullets: [
      "UTR-linked proof of settlement",
      "Immutable compliance snapshots",
      "Form 3CD and Notes-to-Accounts outputs"
    ]
  }
];

const advanced = [
  "NLP Contract Intelligence Agent",
  "GSTN-Udyam Status Fluctuation Detection",
  "Monte Carlo What-If Tax Simulations",
  "Quarterly Advance-Tax Optimizer",
  "Blockchain-hashed Compliance Certificates",
  "Vendor Negotiation & Early-Pay Bot"
];

export default function App() {
  return (
    <div className="page">
      <header className="hero">
        <p className="tag">Autonomous Treasury for Section 43B(h)</p>
        <h1>KredXcel</h1>
        <p className="subtitle">
          Prevent MSME payment delays from becoming a 30% tax penalty.
          Monitor risk, trigger funding, settle dues, and defend every claim.
        </p>
      </header>

      <section>
        <h2>Product Workflow</h2>
        <div className="grid">
          {phases.map((p) => (
            <article className="card" key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
              <ul>
                {p.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Advanced Features</h2>
        <div className="chips">
          {advanced.map((a) => (
            <span className="chip" key={a}>
              {a}
            </span>
          ))}
        </div>
      </section>

      <section className="cta">
        <h2>Built for CFO, Treasury, Tax, and Audit Teams</h2>
        <p>
          Connect ERP. Verify MSME status. Predict exposure. Execute liquidity.
          Generate one-click compliance proof.
        </p>
      </section>
    </div>
  );
}
