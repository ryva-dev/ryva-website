import Link from "next/link";

function TermBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ background: "#161b22", borderBottom: "1px solid #21262d", padding: "8px 12px", display: "flex", gap: 6, alignItems: "center" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
      </div>
      <div style={{ background: "#0d1117", padding: 16, fontFamily: "var(--font-geist-mono)", fontSize: 13, lineHeight: 1.9 }}>
        {children}
      </div>
    </div>
  );
}

const CLI_COMMANDS = [
  { cmd: "ryva init [name]", desc: "Create a new Ryva project with default structure", example: "ryva init my-project" },
  { cmd: "ryva compile", desc: "Validate project configuration and resolve dependencies", example: "ryva compile" },
  { cmd: "ryva run [agent]", desc: "Run an agent and record lineage", example: "ryva run intake_agent" },
  { cmd: "ryva test --all", desc: "Run all 9 test types against configured agents", example: "ryva test --all" },
  { cmd: "ryva test --fuzz [agent]", desc: "Run 15 fuzz categories against a specific agent", example: "ryva test --fuzz intake_agent" },
  { cmd: "ryva test --adversarial [agent]", desc: "Run adversarial probing tests", example: "ryva test --adversarial intake_agent" },
  { cmd: "ryva lineage show [run-id]", desc: "Display full lineage record for a run", example: "ryva lineage show f87951e4" },
  { cmd: "ryva lineage verify --all", desc: "Verify HMAC signatures on all lineage records", example: "ryva lineage verify --all" },
  { cmd: "ryva governance report", desc: "Generate EU AI Act and Colorado AI Act compliance report", example: "ryva governance report" },
  { cmd: "ryva modelcard generate [agent]", desc: "Auto-generate model card for an agent", example: "ryva modelcard generate intake_agent" },
  { cmd: "ryva audit export", desc: "Package all compliance evidence into a zip file", example: "ryva audit export" },
  { cmd: "ryva traces show [run-id]", desc: "Show prompt, response, cost, and PII masking status", example: "ryva traces show f87951e4" },
  { cmd: "ryva forecast [agent]", desc: "30-day cost forecast with budget status", example: "ryva forecast intake_agent" },
  { cmd: "ryva registry list", desc: "List all registered models with provider and alias", example: "ryva registry list" },
  { cmd: "ryva cloud sync", desc: "Sync traces and lineage to Ryva Cloud", example: "ryva cloud sync" },
  { cmd: "ryva cloud login", desc: "Authenticate with Ryva Cloud", example: "ryva cloud login" },
];

export default function DocsPage() {
  return (
    <div style={{ background: "#ffffff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px" }}>

        <h1 style={{ fontSize: 40, fontWeight: 700, color: "#0f172a", margin: 0 }}>Ryva documentation.</h1>
        <p style={{ fontSize: 18, color: "#64748b", marginTop: 12, marginBottom: 0 }}>Everything you need to install, configure, and run Ryva.</p>

        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          <a href="#get-started" style={{ border: "1px solid #e2e8f0", borderRadius: 9999, padding: "10px 20px", fontSize: 14, color: "#0f172a", textDecoration: "none" }}>Get started</a>
          <a href="#cli-reference" style={{ border: "1px solid #e2e8f0", borderRadius: 9999, padding: "10px 20px", fontSize: 14, color: "#0f172a", textDecoration: "none" }}>CLI reference</a>
          <a href="#cloud" style={{ border: "1px solid #e2e8f0", borderRadius: 9999, padding: "10px 20px", fontSize: 14, color: "#0f172a", textDecoration: "none" }}>Cloud setup</a>
          <a href="#compliance" style={{ border: "1px solid #e2e8f0", borderRadius: 9999, padding: "10px 20px", fontSize: 14, color: "#0f172a", textDecoration: "none" }}>Compliance</a>
        </div>

        {/* Section 1 */}
        <section id="get-started" style={{ marginTop: 64, paddingTop: 32, borderTop: "1px solid #f0f0f0" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 32, marginTop: 0 }}>Getting started</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {/* Step 1 */}
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 8, marginTop: 0 }}>1. Install</h3>
              <TermBlock>
                <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>pip install ryva</span></p>
              </TermBlock>
              <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.65 }}>Requires Python 3.11 or later. Install via pip, uv, or pipx.</p>
            </div>
            {/* Step 2 */}
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 8, marginTop: 0 }}>2. Initialize</h3>
              <TermBlock>
                <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>ryva init my-project</span></p>
                <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>cd my-project</span></p>
              </TermBlock>
              <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.65 }}>Creates project.yml and the standard directory structure: agents/, prompts/, tests/, pipelines/, policies/</p>
            </div>
            {/* Step 3 */}
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 8, marginTop: 0 }}>3. First test</h3>
              <TermBlock>
                <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>ryva compile</span></p>
                <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>ryva test --agent my_agent --fuzz</span></p>
                <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>ryva governance report</span></p>
              </TermBlock>
              <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.65 }}>Compile validates your project. Test runs all configured test types. Governance report generates your EU AI Act compliance report.</p>
            </div>
          </div>
        </section>

        {/* Section 2 — CLI Reference */}
        <section id="cli-reference" style={{ marginTop: 64, paddingTop: 32, borderTop: "1px solid #f0f0f0" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 24, marginTop: 0 }}>CLI reference</h2>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Command</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Description</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Example</th>
                </tr>
              </thead>
              <tbody>
                {CLI_COMMANDS.map((row, i) => (
                  <tr key={row.cmd} style={{ borderBottom: i < CLI_COMMANDS.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "#0f172a", whiteSpace: "nowrap" }}>{row.cmd}</td>
                    <td style={{ padding: "10px 16px", color: "#64748b", lineHeight: 1.5 }}>{row.desc}</td>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "#16a34a", whiteSpace: "nowrap" }}>{row.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3 — Cloud Setup */}
        <section id="cloud" style={{ marginTop: 64, paddingTop: 32, borderTop: "1px solid #f0f0f0" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 24, marginTop: 0 }}>Cloud setup</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <p style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.7, margin: 0 }}>
                <strong>1. Request access</strong> — Visit <Link href="/get-started" style={{ color: "#16a34a" }}>/get-started</Link> and submit your work email. We review requests within one business day.
              </p>
            </div>
            <div>
              <p style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.7, marginBottom: 8, marginTop: 0 }}>
                <strong>2. Authenticate</strong> — Once approved, run:
              </p>
              <TermBlock>
                <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>ryva cloud login</span></p>
              </TermBlock>
            </div>
            <div>
              <p style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.7, marginBottom: 8, marginTop: 0 }}>
                <strong>3. Sync traces</strong> — After running agents, sync to the cloud dashboard:
              </p>
              <TermBlock>
                <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>ryva cloud sync</span></p>
              </TermBlock>
            </div>
            <div>
              <p style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.7, margin: 0 }}>
                <strong>4. Invite teammates</strong> — From the dashboard, go to Settings and add teammates with role-based access (Engineer, Compliance, or Leadership view).
              </p>
            </div>
            <div>
              <p style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.7, margin: 0 }}>
                <strong>5. Export compliance reports</strong> — From the dashboard, click Export audit package to download a zip file with all evidence for regulators.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 — Compliance */}
        <section id="compliance" style={{ marginTop: 64, paddingTop: 32, borderTop: "1px solid #f0f0f0" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 24, marginTop: 0 }}>Compliance</h2>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", marginBottom: 12, marginTop: 0 }}>EU AI Act</h3>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, marginBottom: 16, marginTop: 0 }}>
            Ryva covers Articles 9 through 15 of the EU AI Act. Run <code style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>ryva governance report</code> to generate a machine-readable JSON report scored against each article. The report is written to <code style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>target/governance_report.json</code>.
          </p>
          <TermBlock>
            <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>ryva governance report --regulation eu-ai-act</span></p>
            <p style={{ margin: 0, color: "#8b949e", marginTop: 8 }}>EU AI Act score: 0.87 — COMPLIANT</p>
          </TermBlock>

          <h3 style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", marginBottom: 12, marginTop: 24 }}>Colorado AI Act</h3>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, marginBottom: 16, marginTop: 0 }}>
            Colorado AI Act SB 24-205 took effect June 1, 2026. Ryva generates impact assessments, consumer notice documentation, and audit trails that satisfy the Act&apos;s requirements for high-risk AI systems.
          </p>
          <TermBlock>
            <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>ryva governance report --regulation colorado</span></p>
            <p style={{ margin: 0, color: "#8b949e", marginTop: 8 }}>Colorado AI Act score: 0.91 — COMPLIANT</p>
          </TermBlock>
        </section>

        {/* Bottom links */}
        <div style={{ display: "flex", gap: 24, alignItems: "center", marginTop: 64, paddingTop: 32, borderTop: "1px solid #f0f0f0", flexWrap: "wrap" }}>
          <a href="https://github.com/ryva-dev/ryva" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: "#16a34a", textDecoration: "none" }}>GitHub</a>
          <a href="https://pypi.org/project/ryva" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: "#16a34a", textDecoration: "none" }}>PyPI</a>
          <a href="mailto:allie@ryvaforge.com" style={{ fontSize: 14, color: "#16a34a", textDecoration: "none" }}>allie@ryvaforge.com</a>
        </div>

      </div>
    </div>
  );
}
