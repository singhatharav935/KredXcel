const siteData = {
  hero: {
    eyebrow: "Autonomous Treasury Infrastructure",
    title: "Section 43B(h) Compliance, Liquidity, and Audit Defense in One System",
    subtitle:
      "KredXcel prevents MSME payment delays from turning into tax leakage by monitoring risk, triggering liquidity, and generating scrutiny-proof compliance evidence."
  },
  kpis: [
    { label: "Invoices Monitored", value: "12,480+" },
    { label: "Potential Tax Saved", value: "INR 8.4 Cr" },
    { label: "Avg Auction Rate", value: "9.2%" },
    { label: "Audit Packet Time", value: "< 30 sec" }
  ],
  phases: [
    {
      phase: "Phase 1",
      title: "Deep-ERP Ingestion",
      text: "Read-write agents connect to Tally, SAP, and Oracle. Vendor master, invoice events, and appointed-day logic are reconciled in a single ledger."
    },
    {
      phase: "Phase 2",
      title: "Compliance Watchdog",
      text: "Predictive aging computes 15/45-day legal windows and warns treasury teams before tax-at-risk exposure materializes."
    },
    {
      phase: "Phase 3",
      title: "Liquidity Bridge",
      text: "On risk trigger, KredXcel launches a flash auction across NBFC and bank partners, selecting the lowest net-cost bid."
    },
    {
      phase: "Phase 4",
      title: "Audit Vault",
      text: "UTR-backed proof, acceptance timestamps, and MSME status evidence are packaged into auditor-ready compliance snapshots."
    }
  ],
  capabilities: [
    "GSTN-Udyam Deep Link Verification",
    "NLP Contract Intelligence (15 vs 45 day rule)",
    "Dynamic Risk-Based Pricing Engine",
    "Split-Payment Orchestrator",
    "Monte Carlo What-If Tax Simulation",
    "Quarterly Advance-Tax Optimizer",
    "Form 3CD and Notes-to-Accounts Generator",
    "Vendor Negotiation and Early-Pay Agent"
  ],
  architecture: [
    {
      title: "Ingestion Agents",
      text: "API connectors, vendor classification, invoice normalization, and appointed-day reconstruction."
    },
    {
      title: "Intelligence Agents",
      text: "Contract NLP, risk scoring, predictive cash-gap alerts, and tax exposure heatmaps."
    },
    {
      title: "Execution Agents",
      text: "Auctioneer, lender bid optimization, settlement routing, and split-funding execution."
    },
    {
      title: "Assurance Agents",
      text: "Compliance certification, cryptographic evidence trails, and disclosure report automation."
    }
  ],
  roadmap: [
    { milestone: "M1", name: "Landing + API Foundation", status: "Done" },
    { milestone: "M2", name: "ERP Connector Adapters", status: "In Progress" },
    { milestone: "M3", name: "Predictive Tax-at-Risk Engine", status: "Planned" },
    { milestone: "M4", name: "Liquidity Flash-Auction Integration", status: "Planned" },
    { milestone: "M5", name: "Audit Vault + 3CD Export", status: "Planned" }
  ]
};

module.exports = { siteData };
