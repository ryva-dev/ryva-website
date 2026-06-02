import Link from "next/link";
import TerminalHero from "./components/TerminalHero";
import ProductTabs from "./components/ProductTabs";

const MARQUEE_ROW1 = [
  "Anthropic", "OpenAI", "GitHub", "Google", "Ollama",
  "AWS", "PostgreSQL", "LangChain",
];
const MARQUEE_ROW2 = [
  "Hugging Face", "Docker", "Kubernetes", "Railway",
  "Vercel", "Slack", "PagerDuty", "Datadog",
];

export default function Home() {
  return (
    <div className="bg-white text-gray-900">

      {/* HERO */}
      <section style={{ maxWidth: 1200, margin: "0 auto", paddingTop: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div className="grid md:grid-cols-5 gap-12 items-center">
          {/* Left: col-span-3 */}
          <div className="md:col-span-3">
            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, border: "1px solid #bbf7d0", borderRadius: 9999, padding: "4px 12px", marginBottom: 32, background: "#f0fdf4", color: "#16a34a" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
              Colorado AI Act &middot; Effective June 1, 2026
            </div>

            {/* Headline */}
            <h1 style={{ fontSize: 64, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1.05, maxWidth: 600, margin: 0 }}>
              Your AI systems<br />
              are already being<br />
              audited.
            </h1>

            {/* Subheadline */}
            <p style={{ fontSize: 20, color: "#64748b", maxWidth: 500, lineHeight: 1.6, marginTop: 20, marginBottom: 0 }}>
              Ryva gives engineering teams the testing, tracing, and compliance documentation regulators require. Continuously. Not just at audit time.
            </p>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
              <Link href="/demo" style={{ background: "#0f172a", color: "#ffffff", borderRadius: 9999, padding: "12px 24px", fontWeight: 500, textDecoration: "none", fontSize: 15 }}>
                Book a demo
              </Link>
              <Link href="/get-started" style={{ border: "1px solid #e2e8f0", color: "#0f172a", borderRadius: 9999, padding: "12px 24px", fontWeight: 500, textDecoration: "none", fontSize: 15 }}>
                Start free
              </Link>
            </div>

            {/* Trust line */}
            <p style={{ fontSize: 14, color: "#94a3b8", marginTop: 16 }}>
              Free and open source &middot; EU AI Act Articles 9-15 &middot; Colorado AI Act SB 24-205
            </p>
          </div>

          {/* Right: col-span-2 */}
          <div className="md:col-span-2">
            <TerminalHero />
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF BAR */}
      <section style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", paddingTop: 20, paddingBottom: 20, marginTop: 48 }}>
        <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Trusted by AI teams at companies navigating EU AI Act and Colorado AI Act compliance
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 40px", justifyContent: "center", alignItems: "center" }}>
          {["Meridian Financial", "CareLogic AI", "TalentOS", "Verdict AI", "ShieldStack", "DataSphere"].map((name) => (
            <span key={name} style={{ fontWeight: 700, fontSize: 15, color: "#475569", letterSpacing: "-0.01em" }}>{name}</span>
          ))}
        </div>
      </section>

      {/* STATS BAR */}
      <section style={{ background: "#ffffff", borderBottom: "1px solid #f1f5f9", paddingTop: 28, paddingBottom: 28 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", paddingLeft: 24, paddingRight: 24 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
            {[
              { value: "200+", label: "engineering teams" },
              { value: "1M+", label: "traces processed" },
              { value: "0.87", label: "avg EU AI Act compliance score" },
              { value: "MIT", label: "open source license" },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center", padding: "0 24px" }}>
                <p style={{ fontSize: 40, fontWeight: 700, color: "#0f172a", margin: 0 }}>{s.value}</p>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0, marginTop: 4 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM STATEMENT */}
      <section style={{ background: "#ffffff", paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontSize: 40, fontWeight: 700, color: "#0f172a", maxWidth: 680, lineHeight: 1.2, margin: 0, marginBottom: 40 }}>
            AI teams are shipping without the controls every other production system already has.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "No audit trail",
                body: "When a regulator asks what data your AI used, what prompt was active, or why it made a specific decision — most teams have no way to answer.",
              },
              {
                title: "No compliance documentation",
                body: "The EU AI Act and Colorado AI Act require documented model cards, impact assessments, and risk classifications. Almost no team has this ready.",
              },
              {
                title: "No continuous evidence",
                body: "Annual audits capture one moment in time. Regulators want proof your systems behave correctly every day. Static documents do not cut it.",
              },
            ].map((p) => (
              <div key={p.title} style={{ background: "#ffffff", borderLeft: "3px solid #fca5a5", border: "1px solid #fee2e2", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <h3 style={{ fontWeight: 600, color: "#0f172a", fontSize: 16, marginBottom: 12, marginTop: 0 }}>{p.title}</h3>
                <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.65, margin: 0 }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT TABS */}
      <section style={{ background: "#f8fafc", paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontSize: 36, fontWeight: 700, color: "#0f172a", margin: 0 }}>Every capability your AI stack needs.</h2>
          <p style={{ fontSize: 18, color: "#64748b", marginTop: 8, marginBottom: 40 }}>From first test to full compliance report.</p>
          <ProductTabs />
        </div>
      </section>

      {/* DASHBOARD SHOWCASE */}
      <section style={{ background: "#ffffff", paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>Ryva Cloud</p>
              <h2 style={{ fontSize: 36, fontWeight: 700, color: "#0f172a", marginTop: 8, marginBottom: 0, lineHeight: 1.2 }}>
                The compliance dashboard your legal team has been asking for.
              </h2>
              <p style={{ fontSize: 16, color: "#64748b", lineHeight: 1.65, marginTop: 16, marginBottom: 0 }}>
                Every trace, compliance report, and model card synced from the CLI and visible to every stakeholder — engineers, compliance teams, and leadership — with role-based views for each.
              </p>
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "Role-based views: engineer, compliance, and leadership",
                  "EU AI Act article-by-article evidence with pass/fail status",
                  "Full prompt and response traces with PII masking status",
                  "One-click audit package export for regulators",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                      <path d="M3 8l3.5 3.5L13 5" stroke="#16a34a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontSize: 14, color: "#0f172a" }}>{item}</span>
                  </div>
                ))}
              </div>
              <a href="https://ryva-dashboard.vercel.app" style={{ display: "inline-block", marginTop: 24, fontSize: 14, color: "#16a34a", fontWeight: 500, textDecoration: "none" }}>
                See the dashboard →
              </a>
            </div>

            {/* Right — Dashboard mockup */}
            <div style={{ background: "#0a0a0a", borderRadius: 12, boxShadow: "0 25px 60px rgba(0,0,0,0.3)", overflow: "hidden", transform: "perspective(1000px) rotateY(-2deg)" }}>
              {/* Top bar */}
              <div style={{ background: "#0d1117", borderBottom: "1px solid #1e2733", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1L14 4v4c0 3.5-2.5 6-6 7C2.5 14 0 11.5 0 8V4l8-3z" fill="#a855f7" opacity="0.8" />
                  </svg>
                  <span style={{ color: "#ffffff", fontSize: 14, fontWeight: 600 }}>Compliance</span>
                </div>
                <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 9999 }}>COMPLIANT</span>
              </div>
              {/* Score */}
              <div style={{ padding: "16px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: 48, fontWeight: 700, color: "#a855f7", margin: 0, lineHeight: 1 }}>0.87</p>
                  <p style={{ fontSize: 12, color: "#8b949e", margin: 0, marginTop: 4 }}>Overall compliance score</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 13, color: "#16a34a", margin: 0 }}>EU AI Act ✓</p>
                  <p style={{ fontSize: 13, color: "#16a34a", margin: 0, marginTop: 4 }}>Colorado AI Act ✓</p>
                </div>
              </div>
              {/* Article grid */}
              <div style={{ padding: "8px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[
                  { art: "Art. 9 · Risk management", status: "PASS", color: "#16a34a" },
                  { art: "Art. 10 · Data governance", status: "PARTIAL", color: "#ca8a04" },
                  { art: "Art. 12 · Record keeping", status: "PASS", color: "#16a34a" },
                  { art: "Art. 13 · Transparency", status: "PASS", color: "#16a34a" },
                  { art: "Art. 14 · Human oversight", status: "PARTIAL", color: "#ca8a04" },
                  { art: "Art. 15 · Accuracy", status: "PASS", color: "#16a34a" },
                ].map((a) => (
                  <div key={a.art} style={{ background: "#161b22", borderRadius: 8, padding: "10px" }}>
                    <p style={{ fontSize: 11, color: "#8b949e", margin: 0 }}>{a.art}</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: a.color, margin: 0, marginTop: 4 }}>{a.status}</p>
                  </div>
                ))}
              </div>
              {/* Export button */}
              <div style={{ margin: "8px 16px 16px" }}>
                <div style={{ background: "#16a34a", color: "#ffffff", borderRadius: 8, padding: "8px 0", textAlign: "center", fontSize: 13, cursor: "pointer" }}>
                  ↓ Export audit package
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REGULATORY COVERAGE */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0", paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", margin: 0 }}>Built for the regulations that matter right now.</h2>
          <div className="grid md:grid-cols-3 gap-6" style={{ marginTop: 40 }}>
            {[
              {
                status: "In force",
                statusColor: "#16a34a",
                title: "EU AI Act",
                desc: "Articles 9-15 covered, machine-readable compliance reports generated on every run.",
                link: "/enterprise#eu-ai-act",
              },
              {
                status: "Effective June 2026",
                statusColor: "#ca8a04",
                title: "Colorado AI Act",
                desc: "Impact assessments, audit trails, and consumer notice requirements built in.",
                link: "/enterprise#colorado",
              },
              {
                status: "Compatible",
                statusColor: "#16a34a",
                title: "GDPR / HIPAA",
                desc: "PII masking, no personal data in audit trails, and compliant data handling.",
                link: "/enterprise#security",
              },
            ].map((card) => (
              <div key={card.title} style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: card.statusColor, marginBottom: 8, marginTop: 0 }}>{card.status}</p>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 8, marginTop: 0 }}>{card.title}</h3>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>{card.desc}</p>
                <Link href={card.link} style={{ fontSize: 14, color: "#16a34a", textDecoration: "none" }}>View coverage</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTEGRATION LOGOS */}
      <section style={{ background: "#ffffff", paddingTop: 64, paddingBottom: 64, paddingLeft: 24, paddingRight: 24 }}>
        <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 32, marginTop: 0 }}>
          Works with your entire AI stack
        </p>
        <div style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }} className="animate-marquee whitespace-nowrap">
            {[...MARQUEE_ROW1, ...MARQUEE_ROW1].map((logo, i) => (
              <span key={i} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569", fontSize: 14, fontWeight: 500, padding: "6px 12px", borderRadius: 8, flexShrink: 0 }}>
                {logo}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12 }} className="animate-marquee-reverse whitespace-nowrap">
            {[...MARQUEE_ROW2, ...MARQUEE_ROW2].map((logo, i) => (
              <span key={i} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569", fontSize: 14, fontWeight: 500, padding: "6px 12px", borderRadius: 8, flexShrink: 0 }}>
                {logo}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section style={{ background: "#0f172a", paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="grid md:grid-cols-5 gap-12 items-center">
            {/* Left */}
            <div className="md:col-span-3">
              <h2 style={{ fontSize: 40, fontWeight: 700, color: "#ffffff", maxWidth: 520, lineHeight: 1.2, margin: 0 }}>
                Your first compliance audit. Delivered in 30 days.
              </h2>
              <p style={{ fontSize: 18, color: "#94a3b8", marginTop: 16, maxWidth: 520, lineHeight: 1.65, marginBottom: 0 }}>
                We connect to your existing AI stack, assess against EU AI Act and Colorado AI Act requirements, generate model cards and compliance documentation, and deliver a complete audit package your legal team can hand directly to regulators.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                <Link href="/demo" style={{ background: "#16a34a", color: "#ffffff", borderRadius: 9999, padding: "12px 24px", fontWeight: 500, textDecoration: "none", fontSize: 15 }}>
                  Book a discovery call
                </Link>
                <Link href="/get-started" style={{ border: "1px solid #475569", color: "#ffffff", borderRadius: 9999, padding: "12px 24px", fontWeight: 500, textDecoration: "none", fontSize: 15 }}>
                  Start free
                </Link>
              </div>
              <p style={{ fontSize: 14, color: "#64748b", marginTop: 12, marginBottom: 0 }}>No commitment. 30-day delivery. Fixed scope.</p>
            </div>
            {/* Right */}
            <div className="md:col-span-2" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                "EU AI Act Articles 9-15 covered",
                "Colorado AI Act SB 24-205 built in",
                "HMAC-signed tamper-evident audit trails",
              ].map((item) => (
                <div key={item} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M3 8l3.5 3.5L13 5" stroke="#16a34a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 14, color: "#ffffff" }}>{item}</span>
                </div>
              ))}
              <p style={{ fontSize: 14, color: "#94a3b8", marginTop: 8, marginBottom: 0 }}>All documentation machine-readable for your legal team.</p>
            </div>
          </div>
        </div>
      </section>

      {/* INSTALL SECTION */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", margin: 0 }}>Start in 2 minutes. Scale to enterprise.</h2>
          <p style={{ fontSize: 18, color: "#64748b", marginTop: 12, marginBottom: 0 }}>Install from PyPI, initialize your project, run your first governance report.</p>

          {/* Terminal */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", maxWidth: 480, margin: "32px auto 0" }}>
            <div style={{ background: "#161b22", borderBottom: "1px solid #21262d", padding: "8px 16px", display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
            </div>
            <div style={{ background: "#0d1117", padding: 20, fontFamily: "var(--font-geist-mono)", fontSize: 13, lineHeight: 1.9, textAlign: "left" }}>
              <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>pip install ryva</span></p>
              <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>ryva init my-project</span></p>
              <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>ryva governance report</span></p>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
            <Link href="/get-started" style={{ background: "#0f172a", color: "#ffffff", borderRadius: 9999, padding: "12px 24px", fontWeight: 500, textDecoration: "none", fontSize: 15 }}>
              Get started free
            </Link>
            <Link href="/demo" style={{ border: "1px solid #e2e8f0", color: "#0f172a", borderRadius: 9999, padding: "12px 24px", fontWeight: 500, textDecoration: "none", fontSize: 15 }}>
              Book a demo
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
