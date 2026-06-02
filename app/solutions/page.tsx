import Link from "next/link";

export default function SolutionsPage() {
  return (
    <div style={{ background: "#ffffff" }}>

      {/* Hero */}
      <section style={{ textAlign: "center", paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>Solutions</p>
          <h1 style={{ fontSize: 48, fontWeight: 700, color: "#0f172a", marginTop: 12, marginBottom: 0, lineHeight: 1.15 }}>
            AI governance for every team, industry, and regulation.
          </h1>
          <p style={{ fontSize: 20, color: "#64748b", marginTop: 16, maxWidth: 600, margin: "16px auto 0", lineHeight: 1.6 }}>
            Ryva adapts to how your organization works — from engineering teams to compliance officers to regulators.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}>
            <Link href="/demo" style={{ background: "#0f172a", color: "#ffffff", borderRadius: 9999, padding: "12px 24px", fontWeight: 500, textDecoration: "none", fontSize: 15 }}>
              Book a demo
            </Link>
            <Link href="/pricing" style={{ border: "1px solid #e2e8f0", color: "#0f172a", borderRadius: 9999, padding: "12px 24px", fontWeight: 500, textDecoration: "none", fontSize: 15 }}>
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* By role */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0", paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: 32 }}>By Role</p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "AI Engineering Teams",
                body: "Test, trace, and govern every agent before it ships to production. Full fuzz testing, adversarial probing, and hallucination detection built in.",
              },
              {
                title: "Compliance & Legal",
                body: "Machine-readable evidence for every regulatory requirement. EU AI Act articles, Colorado AI Act checklists, and GDPR documentation generated automatically.",
              },
              {
                title: "Head of AI / VP Engineering",
                body: "Coverage gaps, test metrics, cost trends, and agent health across your entire AI portfolio in a single dashboard.",
              },
              {
                title: "CTO / CISO",
                body: "Air-gap deployment, SAML SSO, tamper-evident audit logs, and role-based access control. Built for enterprise security requirements.",
              },
            ].map((card) => (
              <div key={card.title} style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 8, marginTop: 0 }}>{card.title}</h3>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.65, margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* By industry */}
      <section style={{ background: "#ffffff", paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: 32 }}>By Industry</p>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { title: "Fintech", body: "Comply with financial AI regulations and document model decisions for auditors." },
              { title: "Healthcare", body: "HIPAA-compatible AI governance with PII masking and full audit trails." },
              { title: "HR Tech", body: "Document AI-driven hiring and promotion decisions to meet legal requirements." },
              { title: "Insurance", body: "Governance documentation for underwriting and claims AI systems." },
              { title: "Legal Tech", body: "Compliance evidence for AI tools used in legal research and document review." },
            ].map((card) => (
              <div key={card.title} style={{ border: "1px solid #f1f5f9", borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 8, marginTop: 0 }}>{card.title}</h3>
                <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* By regulation */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0", paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: 32 }}>By Regulation</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "EU AI Act", body: "Articles 9-15 fully covered. Machine-readable compliance reports and model cards generated on every run." },
              { title: "Colorado AI Act", body: "SB 24-205 coverage including impact assessments, audit trails, and consumer notice built in." },
              { title: "GDPR / HIPAA", body: "PII masking, no personal data in audit trails, and compliant data handling for regulated data." },
              { title: "SOC 2", body: "Tamper-evident audit logs, role-based access control, and documented AI system behavior." },
            ].map((card) => (
              <div key={card.title} style={{ border: "1px solid #f1f5f9", borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 8, marginTop: 0 }}>{card.title}</h3>
                <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ background: "#0f172a", paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, color: "#ffffff", margin: 0 }}>Ready to see how Ryva fits your team?</h2>
        <div style={{ marginTop: 24 }}>
          <Link href="/demo" style={{ background: "#16a34a", color: "#ffffff", borderRadius: 9999, padding: "12px 24px", fontWeight: 500, textDecoration: "none", fontSize: 15 }}>
            Book a demo
          </Link>
        </div>
      </section>

    </div>
  );
}
