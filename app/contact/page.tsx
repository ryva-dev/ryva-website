"use client";
import { useState } from "react";

type FormState = {
  name: string;
  email: string;
  company: string;
  teamSize: string;
  concern: string;
  message: string;
};

export default function ContactPage() {
  const [form, setForm] = useState<FormState>({ name: "", email: "", company: "", teamSize: "", concern: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, formType: "contact" }),
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
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "80px 24px" }}>
        <h1 style={{ fontSize: 40, fontWeight: 700, color: "#0f172a", margin: 0 }}>Talk to the team.</h1>
        <p style={{ fontSize: 18, color: "#64748b", marginTop: 8, marginBottom: 0 }}>We respond within one business day.</p>

        {status === "success" ? (
          <div style={{ marginTop: 40, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 32, textAlign: "center" }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: "0 auto 16px" }}>
              <circle cx="24" cy="24" r="23" stroke="#16a34a" strokeWidth="2" />
              <path d="M14 24l7 7 13-14" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>Message sent.</h2>
            <p style={{ fontSize: 16, color: "#64748b", marginTop: 8, marginBottom: 0 }}>We will be in touch within one business day.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Name *</label>
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
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Team size</label>
              <select
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
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Primary concern</label>
              <select
                value={form.concern}
                onChange={(e) => setForm({ ...form, concern: e.target.value })}
                style={inputStyle}
              >
                <option value="">Select a topic</option>
                <option value="eu-ai-act">EU AI Act</option>
                <option value="colorado">Colorado AI Act</option>
                <option value="gdpr-hipaa">GDPR/HIPAA</option>
                <option value="general">General AI Governance</option>
                <option value="pricing">Pricing</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Message</label>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                style={{ ...inputStyle, resize: "none" }}
                placeholder="Tell us about your use case..."
              />
            </div>
            {status === "error" && (
              <p style={{ color: "#dc2626", fontSize: 14, margin: 0 }}>Something went wrong. Please try again.</p>
            )}
            <button
              type="submit"
              disabled={status === "loading"}
              style={{ background: "#0f172a", color: "#ffffff", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer", width: "100%" }}
            >
              {status === "loading" ? "Sending..." : "Send message"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
