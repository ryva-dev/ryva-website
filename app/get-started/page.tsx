"use client";
import { useState } from "react";

type CloudForm = {
  email: string;
  company: string;
  role: string;
};

export default function GetStartedPage() {
  const [cloudForm, setCloudForm] = useState<CloudForm>({ email: "", company: "", role: "" });
  const [cloudStatus, setCloudStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleCloudSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCloudStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cloudForm.email,
          email: cloudForm.email,
          company: cloudForm.company,
          role: cloudForm.role,
          formType: "cloud-access",
        }),
      });
      if (res.ok) {
        setCloudStatus("success");
      } else {
        setCloudStatus("error");
      }
    } catch {
      setCloudStatus("error");
    }
  }

  const inputStyle = {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 14,
    width: "100%",
    outline: "none",
    boxSizing: "border-box" as const,
    color: "#0f172a",
    background: "#ffffff",
  };

  return (
    <div style={{ background: "#ffffff" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "80px 24px" }}>
        <h1 style={{ fontSize: 48, fontWeight: 700, color: "#0f172a", textAlign: "center", margin: 0 }}>Start with Ryva.</h1>
        <p style={{ fontSize: 18, color: "#64748b", textAlign: "center", marginTop: 12, marginBottom: 0 }}>Free CLI for engineers. Cloud access for teams.</p>

        <div className="grid md:grid-cols-2 gap-6" style={{ marginTop: 48 }}>
          {/* Card 1 — CLI */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 32 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>For Engineers</p>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginTop: 8, marginBottom: 8 }}>Free CLI</h2>
            <p style={{ fontSize: 14, color: "#64748b", marginTop: 0, marginBottom: 0 }}>Full testing, lineage tracking, and governance reporting. MIT licensed. Free forever.</p>

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                "All 9 test types",
                "Lineage tracking and verification",
                "EU AI Act and Colorado AI Act reports",
                "Model cards and audit export",
              ].map((item) => (
                <div key={item} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#0f172a" }}>{item}</span>
                </div>
              ))}
            </div>

            {/* Terminal */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", marginTop: 24 }}>
              <div style={{ background: "#161b22", borderBottom: "1px solid #21262d", padding: "8px 12px", display: "flex", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
              </div>
              <div style={{ background: "#0d1117", padding: 16, fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: 1.9 }}>
                <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>pip install ryva</span></p>
                <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>ryva init my-project</span></p>
                <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>ryva governance report</span></p>
              </div>
            </div>

            <a
              href="https://github.com/ryva-dev/ryva"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 24, border: "1px solid #e2e8f0", borderRadius: 9999, padding: "10px 24px", fontSize: 14, color: "#0f172a", textDecoration: "none", fontWeight: 500 }}
            >
              View on GitHub
            </a>
          </div>

          {/* Card 2 — Cloud */}
          <div style={{ border: "2px solid #0f172a", borderRadius: 16, padding: 32 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>For Teams</p>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginTop: 8, marginBottom: 8 }}>Ryva Cloud</h2>
            <p style={{ fontSize: 14, color: "#64748b", marginTop: 0, marginBottom: 0 }}>Shared dashboards, compliance exports, and team collaboration. Invite-only access.</p>

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                "Role-based dashboard",
                "Shared traces and lineage",
                "EU AI Act compliance exports",
                "Team permissions and audit logs",
              ].map((item) => (
                <div key={item} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#0f172a" }}>{item}</span>
                </div>
              ))}
            </div>

            {cloudStatus === "success" ? (
              <p style={{ fontSize: 14, color: "#16a34a", marginTop: 24, marginBottom: 0 }}>Request received. We review within 1 business day.</p>
            ) : (
              <form onSubmit={handleCloudSubmit} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Work email *</label>
                  <input
                    type="email"
                    required
                    value={cloudForm.email}
                    onChange={(e) => setCloudForm({ ...cloudForm, email: e.target.value })}
                    style={inputStyle}
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Company *</label>
                  <input
                    type="text"
                    required
                    value={cloudForm.company}
                    onChange={(e) => setCloudForm({ ...cloudForm, company: e.target.value })}
                    style={inputStyle}
                    placeholder="Your company"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Role *</label>
                  <select
                    required
                    value={cloudForm.role}
                    onChange={(e) => setCloudForm({ ...cloudForm, role: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Select your role</option>
                    <option value="ai-engineer">AI Engineer</option>
                    <option value="ml-engineer">ML Engineer</option>
                    <option value="head-of-ai">Head of AI</option>
                    <option value="vp-engineering">VP Engineering</option>
                    <option value="compliance">Compliance / Legal</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {cloudStatus === "error" && (
                  <p style={{ color: "#dc2626", fontSize: 14, margin: 0 }}>Something went wrong. Please try again.</p>
                )}
                <button
                  type="submit"
                  disabled={cloudStatus === "loading"}
                  style={{ background: "#0f172a", color: "#ffffff", borderRadius: 12, padding: "10px 0", fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer", width: "100%" }}
                >
                  {cloudStatus === "loading" ? "Submitting..." : "Request access"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
