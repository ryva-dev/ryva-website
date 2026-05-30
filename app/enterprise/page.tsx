"use client";
import { useState } from "react";

const ARTICLES = [
  { id: "Article 9",  req: "Risk management system",  coverage: "Structured test results, lineage history, governance scores" },
  { id: "Article 10", req: "Data governance",          coverage: "PII masking, retrieval source recording, data provenance" },
  { id: "Article 12", req: "Record-keeping",           coverage: "Tamper-evident lineage records, HMAC signatures, exportable" },
  { id: "Article 13", req: "Transparency",             coverage: "Auto-generated model cards, alignment rule declarations" },
  { id: "Article 14", req: "Human oversight",          coverage: "Alignment failure blocks, high-risk run flagging" },
  { id: "Article 15", req: "Accuracy and robustness",  coverage: "Fuzz, adversarial, and regression testing on every push" },
];

type FormState = {
  name: string;
  email: string;
  company: string;
  teamSize: string;
  concern: string;
  message: string;
};

export default function EnterprisePage() {
  const [form, setForm] = useState<FormState>({
    name: "", email: "", company: "", teamSize: "", concern: "", message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="bg-white text-gray-900">

      {/* Hero */}
      <section className="px-6 pt-24 pb-20 text-center" style={{ borderBottom: "1px solid #f0f0f0" }}>
        <div className="max-w-3xl mx-auto">
          <h1
            className="font-bold text-gray-900 tracking-tight mb-5"
            style={{ fontSize: "clamp(34px,5vw,52px)", lineHeight: 1.1 }}
          >
            Built for teams where AI decisions have real consequences.
          </h1>
          <p
            className="text-gray-500 mb-10 mx-auto"
            style={{ fontSize: 18, maxWidth: 560, lineHeight: 1.65 }}
          >
            Governance, auditability, and compliance infrastructure for organizations operating AI in regulated or high-stakes environments.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <a
              href="https://calendly.com/aball-ryvaforge/ryva-demo"
              className="bg-[#16a34a] text-white px-6 py-3 rounded-full font-medium hover:bg-[#15803d] transition-colors text-sm"
            >
              Book a discovery call
            </a>
            <a
              href="mailto:sales@ryvaforge.com?subject=Enterprise%20Overview%20Request"
              className="border border-gray-300 text-gray-700 px-6 py-3 rounded-full font-medium hover:border-gray-500 transition-colors text-sm"
            >
              Request overview
            </a>
          </div>
          {/* Trust signals */}
          <p className="text-xs font-semibold text-gray-400 tracking-wide">
            EU AI Act &nbsp;·&nbsp; Colorado AI Act &nbsp;·&nbsp; GDPR Compatible &nbsp;·&nbsp; Air-gap Ready &nbsp;·&nbsp; SOC 2 Aligned
          </p>
        </div>
      </section>

      {/* Section 1 — Audit trails */}
      <section id="security" className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(24px,3vw,36px)" }}
            >
              Tamper-evident audit trails
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              Every agent run produces a lineage record signed with HMAC-SHA256 using your project secret key. Records are tamper-evident, queryable, and exportable for regulators.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              Run <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva lineage verify --all</code> to verify that no lineage record has been altered since it was written. Any tampering is detected immediately.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              Records are indexed by run ID, agent name, timestamp, and parent run ID. You can reconstruct the complete decision history for any agent output, including multi-step pipelines.
            </p>
          </div>
          {/* Terminal */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div
              className="px-4 py-2.5 flex items-center gap-1.5"
              style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span
                className="text-gray-400 text-xs ml-2"
                style={{ fontFamily: "var(--font-geist-mono)" }}
              >
                ryva lineage verify --all
              </span>
            </div>
            <div
              className="bg-[#0d1117] p-5"
              style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: "1.85" }}
            >
              <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva lineage verify --all</span></p>
              <p style={{ color: "#8b949e" }} className="mt-1">Verifying 142 lineage records...</p>
              <div className="mt-2 space-y-0.5">
                <p><span style={{ color: "#8b949e" }}>Records verified: </span><span style={{ color: "#ffffff" }}>142 / 142</span></p>
                <p><span style={{ color: "#8b949e" }}>Tampered:         </span><span style={{ color: "#ffffff" }}>0</span></p>
                <p><span style={{ color: "#8b949e" }}>Signature algo:   </span><span style={{ color: "#d1d5db" }}>HMAC-SHA256</span></p>
                <p><span style={{ color: "#8b949e" }}>Key ID:           </span><span style={{ color: "#d1d5db" }}>corp-key-2026-01</span></p>
              </div>
              <div className="border-t border-gray-800 mt-3 pt-3">
                <p style={{ color: "#16a34a" }}>All 142 records verified</p>
                <p style={{ color: "#16a34a" }}>No tampering detected</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 — EU AI Act + Colorado AI Act */}
      <section
        id="eu-ai-act"
        className="py-24 px-6"
        style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}
      >
        <div className="max-w-5xl mx-auto">
          <div id="colorado">
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(24px,3vw,36px)" }}
            >
              EU AI Act and Colorado AI Act compliance
            </h2>
            <p className="text-gray-500 leading-relaxed mb-10">
              Continuous documentation, not annual. Every command updates your compliance evidence in real time.
            </p>
          </div>

          {/* Article table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <th className="text-left px-5 py-3 font-semibold text-gray-700">Article</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-700">Requirement</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-700">Ryva Coverage</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {ARTICLES.map((a, i) => (
                  <tr
                    key={a.id}
                    style={{ borderBottom: i < ARTICLES.length - 1 ? "1px solid #f3f4f6" : "none" }}
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">{a.id}</td>
                    <td className="px-5 py-3 text-gray-600">{a.req}</td>
                    <td className="px-5 py-3 text-gray-500">{a.coverage}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 text-[#16a34a] font-semibold text-xs">
                        <span>&#10003;</span> Covered
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 3 — Audit export */}
      <section id="audit" className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(24px,3vw,36px)" }}
            >
              Complete audit package in one command.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              One command generates a complete audit zip containing your governance report, model cards, verified lineage records, and compliance checklists. Hand it directly to your legal team.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              The package includes both EU AI Act and Colorado AI Act checklists, all 142 verified lineage records, and a machine-readable manifest regulators can process programmatically.
            </p>
          </div>
          {/* File tree terminal */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div
              className="px-4 py-2.5 flex items-center gap-1.5"
              style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span
                className="text-gray-400 text-xs ml-2"
                style={{ fontFamily: "var(--font-geist-mono)" }}
              >
                ryva audit export
              </span>
            </div>
            <div
              className="bg-[#0d1117] p-5"
              style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: "1.85" }}
            >
              <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva audit export</span></p>
              <p style={{ color: "#16a34a" }} className="mt-1">✓ Audit package ready</p>
              <div className="mt-3" style={{ color: "#8b949e" }}>
                <p>ryva_audit_myproject_20260529.zip</p>
                <p className="pl-2">├── README.md</p>
                <p className="pl-2">├── governance/</p>
                <p className="pl-4">│   ├── governance_report.json</p>
                <p className="pl-4">│   └── governance_report.md</p>
                <p className="pl-2">├── model_cards/</p>
                <p className="pl-4">│   └── intake_agent_model_card.json</p>
                <p className="pl-2">├── lineage/</p>
                <p className="pl-4">│   └── (142 records, all verified)</p>
                <p className="pl-2">├── compliance/</p>
                <p className="pl-4">│   ├── eu_ai_act_checklist.md</p>
                <p className="pl-4">│   └── colorado_ai_act_checklist.md</p>
                <p className="pl-2">└── PACKAGE_MANIFEST.json</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-24 px-6 text-center" style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0" }}>
        <div className="max-w-2xl mx-auto">
          <h2
            className="font-bold text-gray-900 tracking-tight mb-5"
            style={{ fontSize: "clamp(26px,3.5vw,36px)" }}
          >
            Every organization is different.
          </h2>
          <p className="text-gray-500 leading-relaxed mb-8">
            Book a discovery call and we will scope exactly what your team needs.
          </p>
          <a
            href="https://calendly.com/aball-ryvaforge/ryva-demo"
            className="bg-[#16a34a] text-white px-6 py-3 rounded-full font-medium hover:bg-[#15803d] transition-colors text-sm inline-block"
          >
            Book a discovery call
          </a>
        </div>
      </section>

      {/* Contact form */}
      <section id="contact" className="py-24 px-6">
        <div className="max-w-xl mx-auto">
          <h2
            className="font-bold text-gray-900 tracking-tight mb-3"
            style={{ fontSize: "clamp(24px,3vw,36px)" }}
          >
            Get in touch
          </h2>
          <p className="text-gray-500 mb-10">We respond within one business day.</p>

          {submitted ? (
            <div className="border border-green-200 bg-green-50 rounded-xl p-8 text-center">
              <p className="text-[#16a34a] font-semibold mb-2">
                Thank you. We will be in touch within one business day.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#16a34a] transition-colors"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Work email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#16a34a] transition-colors"
                    placeholder="you@company.com"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
                  <input
                    type="text"
                    required
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#16a34a] transition-colors"
                    placeholder="Your company"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Team size</label>
                  <select
                    required
                    value={form.teamSize}
                    onChange={(e) => setForm({ ...form, teamSize: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#16a34a] transition-colors bg-white"
                  >
                    <option value="">Select team size</option>
                    <option value="1-10">1 to 10</option>
                    <option value="11-50">11 to 50</option>
                    <option value="51-200">51 to 200</option>
                    <option value="200+">200 or more</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Primary concern</label>
                <select
                  value={form.concern}
                  onChange={(e) => setForm({ ...form, concern: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#16a34a] transition-colors bg-white"
                >
                  <option value="">Select your primary concern</option>
                  <option value="eu-ai-act">EU AI Act</option>
                  <option value="colorado">Colorado AI Act</option>
                  <option value="gdpr-hipaa">GDPR/HIPAA</option>
                  <option value="general">General AI Governance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#16a34a] transition-colors resize-none"
                  placeholder="Tell us about your use case..."
                />
              </div>
              <button
                type="submit"
                className="bg-[#16a34a] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-[#15803d] transition-colors w-full"
              >
                Send message
              </button>
            </form>
          )}
        </div>
      </section>

    </div>
  );
}
