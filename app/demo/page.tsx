"use client";
import { useState } from "react";

type FormState = {
  name: string;
  email: string;
  company: string;
  role: string;
  teamSize: string;
  message: string;
};

export default function DemoPage() {
  const [form, setForm] = useState<FormState>({ name: "", email: "", company: "", role: "", teamSize: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, formType: "demo" }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
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
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div className="grid md:grid-cols-5 gap-16">
          {/* Left */}
          <div className="md:col-span-2">
            <p style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>Book a Demo</p>
            <h1 style={{ fontSize: 40, fontWeight: 700, color: "#0f172a", marginTop: 12, marginBottom: 0, lineHeight: 1.15 }}>See Ryva in action.</h1>
            <p style={{ fontSize: 18, color: "#64748b", lineHeight: 1.65, marginTop: 16, marginBottom: 0 }}>
              We will walk you through a live demo of the CLI, the cloud dashboard, and a real compliance report — tailored to your industry and use case.
            </p>
            <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>What to expect:</p>
              {[
                "30-minute live walkthrough",
                "Real EU AI Act compliance report generated during the call",
                "Dashboard demo with role-based views",
                "Q&A with the founder",
                "No sales pressure",
              ].map((item) => (
                <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M3 8l3.5 3.5L13 5" stroke="#16a34a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 14, color: "#0f172a" }}>{item}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 14, color: "#64748b", marginTop: 32, marginBottom: 0 }}>
              Questions? Email{" "}
              <a href="mailto:allie@ryvaforge.com" style={{ color: "#16a34a" }}>allie@ryvaforge.com</a>
            </p>
          </div>

          {/* Right — Form card */}
          <div className="md:col-span-3">
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 32, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              {status === "success" ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: "0 auto 16px" }}>
                    <circle cx="24" cy="24" r="23" stroke="#16a34a" strokeWidth="2" />
                    <path d="M14 24l7 7 13-14" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Demo request received.</h2>
                  <p style={{ fontSize: 16, color: "#64748b", marginTop: 8, marginBottom: 24 }}>We will be in touch within one business day.</p>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", maxWidth: 320, margin: "0 auto" }}>
                    <div style={{ background: "#161b22", padding: "8px 12px", display: "flex", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
                    </div>
                    <div style={{ background: "#0d1117", padding: 16, fontFamily: "var(--font-geist-mono)", fontSize: 13 }}>
                      <p style={{ margin: 0 }}><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#22c55e" }}>pip install ryva</span></p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Full name *</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      style={inputStyle}
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Work email *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      style={inputStyle}
                      placeholder="you@company.com"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Company *</label>
                    <input
                      type="text"
                      required
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      style={inputStyle}
                      placeholder="Your company"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Role *</label>
                    <select
                      required
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">Select your role</option>
                      <option value="ai-engineer">AI Engineer</option>
                      <option value="ml-engineer">ML Engineer</option>
                      <option value="head-of-ai">Head of AI</option>
                      <option value="vp-engineering">VP Engineering</option>
                      <option value="cto">CTO</option>
                      <option value="cro">Chief Risk Officer</option>
                      <option value="clo">Chief Legal Officer</option>
                      <option value="compliance">Compliance / Legal</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Team size *</label>
                    <select
                      required
                      value={form.teamSize}
                      onChange={(e) => setForm({ ...form, teamSize: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">Select team size</option>
                      <option value="1-10">1-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-200">51-200</option>
                      <option value="200+">200+</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>What do you want to see?</label>
                    <textarea
                      rows={3}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      style={{ ...inputStyle, resize: "none" }}
                      placeholder="Optional — describe your use case or specific questions"
                    />
                  </div>
                  {status === "error" && (
                    <p style={{ color: "#dc2626", fontSize: 14, margin: 0 }}>
                      Something went wrong. Email{" "}
                      <a href="mailto:allie@ryvaforge.com" style={{ color: "#dc2626" }}>allie@ryvaforge.com</a> directly.
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    style={{ background: "#0f172a", color: "#ffffff", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer", width: "100%" }}
                  >
                    {status === "loading" ? "Sending..." : "Request demo"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
