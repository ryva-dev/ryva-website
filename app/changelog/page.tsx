export default function ChangelogPage() {
  const entries = [
    {
      version: "v0.2.1",
      date: "May 2026",
      items: [
        "Added Colorado AI Act SB 24-205 compliance report generation",
        "Consumer notice documentation auto-generated from agent config",
        "Impact assessment template now available for high-risk classifications",
        "Fixed edge case in HMAC verification for multi-step pipeline lineage",
        "ryva audit export now includes Colorado AI Act checklist by default",
      ],
    },
    {
      version: "v0.2.0",
      date: "April 2026",
      items: [
        "Ryva Cloud beta launched with shared dashboards and role-based access",
        "ryva cloud sync command for uploading traces and lineage records",
        "Leadership dashboard view showing compliance score and agent health",
        "EU AI Act article-by-article evidence grid in the cloud dashboard",
        "One-click audit package export from the dashboard",
        "PII masking now configurable per-field in project.yml",
        "Cost forecasting improved with 90-day projection support",
      ],
    },
    {
      version: "v0.1.1",
      date: "March 2026",
      items: [
        "Fixed fuzz testing unicode category on Python 3.11",
        "Added --format flag to ryva governance report for JSON and Markdown output",
        "Improved error messages for missing agent configuration fields",
        "ryva lineage verify now exits non-zero if any tampering is detected",
        "Added ryva registry aliases command to list model aliases",
        "Documentation improvements for alignment rule configuration",
      ],
    },
    {
      version: "v0.1.0",
      date: "February 2026",
      items: [
        "Initial release of Ryva CLI",
        "Nine test types: schema, regression, adversarial, memory, RAG faithfulness, hallucination detection, fuzz (15 categories), fine-tune evaluation, business alignment",
        "Lineage engine with HMAC-SHA256 tamper-evident signatures",
        "EU AI Act Articles 9-15 governance report",
        "Model card generation meeting Article 13 requirements",
        "ryva audit export command for complete audit package",
        "Cost forecasting with per-agent tracking and budget alerts",
        "Support for Anthropic, OpenAI, Google Gemini, and Ollama providers",
        "MIT licensed and fully open source",
      ],
    },
  ];

  return (
    <div style={{ background: "#ffffff" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px" }}>
        <h1 style={{ fontSize: 40, fontWeight: 700, color: "#0f172a", margin: 0 }}>Changelog.</h1>
        <p style={{ fontSize: 16, color: "#64748b", marginTop: 8, marginBottom: 0 }}>What is new in Ryva.</p>

        <div style={{ marginTop: 48, position: "relative", paddingLeft: 24 }}>
          {/* Vertical line */}
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "#e2e8f0" }} />

          {entries.map((entry, i) => (
            <div key={entry.version} style={{ position: "relative", marginBottom: i < entries.length - 1 ? 48 : 0 }}>
              {/* Dot */}
              <div style={{ position: "absolute", left: -30, top: 4, width: 12, height: 12, borderRadius: "50%", background: "#16a34a" }} />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>{entry.version}</h2>
              <p style={{ fontSize: 14, color: "#94a3b8", margin: 0, marginTop: 4, marginBottom: 16 }}>{entry.date}</p>
              <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                {entry.items.map((item) => (
                  <li key={item} style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.65 }}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
