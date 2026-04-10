import { useEffect, useMemo, useState } from "react";
import "./styles.css";

const fallbackData = {
  hero: {
    eyebrow: "Autonomous Treasury Infrastructure",
    title: "Section 43B(h) Compliance, Liquidity, and Audit Defense in One System",
    subtitle:
      "KredXcel prevents MSME payment delays from turning into tax leakage by monitoring risk, triggering liquidity, and generating scrutiny-proof compliance evidence."
  },
  kpis: [],
  phases: [],
  capabilities: [],
  architecture: [],
  roadmap: []
};

function App() {
  const [data, setData] = useState(fallbackData);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [contact, setContact] = useState({ name: "", email: "", message: "" });
  const [contactResult, setContactResult] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSite() {
      try {
        const res = await fetch("/api/site");
        if (!res.ok) {
          throw new Error("Failed to fetch website data");
        }
        const payload = await res.json();
        if (active) {
          setData(payload);
          setApiError("");
        }
      } catch (_error) {
        if (active) {
          setApiError("Backend is not running. Start backend on port 5000 to load live data.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSite();
    return () => {
      active = false;
    };
  }, []);

  const roadmapDoneCount = useMemo(
    () => data.roadmap.filter((item) => item.status.toLowerCase() === "done").length,
    [data.roadmap]
  );

  async function submitContact(event) {
    event.preventDefault();
    setContactLoading(true);
    setContactResult("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contact)
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to submit inquiry");
      }

      setContactResult(`Request submitted. Ticket: ${payload.ticketId}`);
      setContact({ name: "", email: "", message: "" });
    } catch (error) {
      setContactResult(error.message || "Unable to submit request.");
    } finally {
      setContactLoading(false);
    }
  }

  return (
    <div className="site">
      <header className="hero">
        <nav className="nav">
          <div className="logo">KredXcel</div>
          <div className="nav-links">
            <a href="#workflow">Workflow</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#roadmap">Roadmap</a>
            <a href="#contact">Contact</a>
          </div>
        </nav>

        <div className="hero-body">
          <p className="eyebrow">{data.hero.eyebrow}</p>
          <h1>{data.hero.title}</h1>
          <p className="lead">{data.hero.subtitle}</p>
          <div className="actions">
            <a className="btn btn-solid" href="#contact">Request Pilot</a>
            <a className="btn btn-ghost" href="#workflow">Explore Workflow</a>
          </div>
        </div>
      </header>

      {apiError ? <p className="warning">{apiError}</p> : null}

      <section className="metrics" aria-busy={loading}>
        {data.kpis.map((metric) => (
          <article key={metric.label} className="metric-card">
            <p className="metric-value">{metric.value}</p>
            <p className="metric-label">{metric.label}</p>
          </article>
        ))}
      </section>

      <section id="workflow" className="panel">
        <h2>End-to-End Workflow</h2>
        <div className="timeline">
          {data.phases.map((item) => (
            <article className="timeline-card" key={item.title}>
              <span>{item.phase}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="capabilities" className="panel">
        <h2>KredXcel 2.0 Advanced Capabilities</h2>
        <div className="chips">
          {data.capabilities.map((item) => (
            <span key={item} className="chip">{item}</span>
          ))}
        </div>
      </section>

      <section className="architecture">
        <h2>Agentic Ledger Stack</h2>
        <div className="stack-grid">
          {data.architecture.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="roadmap" className="panel">
        <h2>Execution Roadmap</h2>
        <p className="roadmap-summary">
          {roadmapDoneCount} of {data.roadmap.length} milestones completed.
        </p>
        <div className="roadmap-grid">
          {data.roadmap.map((item) => (
            <article key={item.milestone} className="roadmap-card">
              <p className="roadmap-id">{item.milestone}</p>
              <h3>{item.name}</h3>
              <span className={`status status-${item.status.toLowerCase().replace(/\s+/g, "-")}`}>
                {item.status}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="contact-panel">
        <div>
          <h2>Talk to KredXcel Team</h2>
          <p>
            Share your ERP stack, MSME vendor count, and current payment cycle. We will map an implementation plan
            for your finance and tax teams.
          </p>
        </div>

        <form className="contact-form" onSubmit={submitContact}>
          <input
            required
            type="text"
            placeholder="Name"
            value={contact.name}
            onChange={(event) => setContact((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={contact.email}
            onChange={(event) => setContact((prev) => ({ ...prev, email: event.target.value }))}
          />
          <textarea
            required
            placeholder="Message"
            rows={4}
            value={contact.message}
            onChange={(event) => setContact((prev) => ({ ...prev, message: event.target.value }))}
          />
          <button className="btn btn-solid" type="submit" disabled={contactLoading}>
            {contactLoading ? "Submitting..." : "Submit Inquiry"}
          </button>
          {contactResult ? <p className="contact-result">{contactResult}</p> : null}
        </form>
      </section>
    </div>
  );
}

export default App;
