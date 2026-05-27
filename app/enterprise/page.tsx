"use client";
import { useState } from "react";
import Link from "next/link";

const TRUST_SIGNALS = [
  "SOC 2 Ready",
  "EU AI Act",
  "GDPR Compatible",
  "Air-gap Deployable",
  "SAML / SCIM",
];

const INTEGRATIONS = [
  { name: "PostgreSQL", desc: "Store traces and lineage records in your own database." },
  { name: "S3",         desc: "Export governance reports and lineage archives to any S3-compatible store." },
  { name: "SAML",       desc: "Single sign-on via any SAML 2.0 identity provider." },
  { name: "SCIM",       desc: "Automate user provisioning and deprovisioning from your directory." },
  { name: "Slack",      desc: "Receive alignment failure alerts and budget warnings in any channel." },
  { name: "PagerDuty",  desc: "Page on-call engineers when an agent run fails a critical alignment rule." },
  { name: "Webhooks",   desc: "Push any run event to your own endpoint for custom integrations." },
];

type FormState = {
  name: string;
  email: string;
  company: string;
  teamSize: string;
  message: string;
};

export default function EnterprisePage() {
  const [form, setForm] = useState<FormState>({
    name: "", email: "", company: "", teamSize: "", message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="bg-white text-gray-900">

      {/* Hero */}
      <section className="px-6 pt-24 pb-20" style={{ borderBottom: "1px solid #f0f0f0" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-bold text-gray-900 tracking-tight mb-5" style={{ fontSize: "clamp(34px,5vw,52px)", lineHeight: 1.1 }}>
            Built for teams where AI decisions have real consequences.
          </h1>
          <p className="text-gray-500 mb-10 mx-auto" style={{ fontSize: 18, maxWidth: 560, lineHeight: 1.65 }}>
            Governance, auditability, and compliance infrastructure for organizations operating AI in regulated or high-stakes environments.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Link
              href="#contact"
              className="bg-gray-900 text-white text-sm font-medium px-7 py-3 rounded-full hover:bg-gray-700 transition-colors"
            >
              Contact sales
            </Link>
            <Link
              href="#"
              className="bg-white text-gray-900 text-sm font-medium px-7 py-3 rounded-full border border-gray-300 hover:border-gray-500 transition-colors"
            >
              Download enterprise overview
            </Link>
          </div>
          {/* Trust signals */}
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {TRUST_SIGNALS.map((t) => (
              <span key={t} className="text-xs font-semibold text-gray-500 border border-gray-200 rounded-full px-3 py-1">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Capability 1: Audit trails */}
      <section id="security" className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(24px,3vw,36px)" }}>
              Tamper-evident audit trails
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              Every agent run produces a lineage record signed with an HMAC signature computed from your project secret key. The signature covers the full record: input hash, prompt version, retrieval sources, tool calls, output hash, token counts, and cost.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              Run <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva lineage verify</code> to verify that no lineage record has been altered since it was written. Any tamper is detected immediately. Financial auditors and legal teams can rely on the signatures as evidence of system integrity.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              Records are indexed by run ID, agent name, timestamp, and parent run ID. You can reconstruct the complete decision history for any agent output, including multi-step pipelines.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-gray-400 text-xs ml-2" style={{ fontFamily: "var(--font-geist-mono)" }}>ryva lineage verify --run f87951e4</span>
            </div>
            <div className="bg-[#0d1117] p-5" style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: "1.85" }}>
              <p className="text-gray-500 mb-2">Verifying lineage record f87951e4...</p>
              <p><span className="text-gray-500">Record hash:    </span><span className="text-gray-300">sha256:9b4c2e1a...d7f3a8c5</span></p>
              <p><span className="text-gray-500">Stored sig:     </span><span className="text-gray-300">hmac-sha256:4e2d9c7b...a1f5e8d3</span></p>
              <p><span className="text-gray-500">Key ID:         </span><span className="text-gray-300">corp-key-2026-01</span></p>
              <div className="border-t border-gray-800 mt-3 pt-3">
                <p className="text-[#16a34a]">Signature valid</p>
                <p className="text-[#16a34a]">Record integrity confirmed</p>
                <p className="text-gray-400 mt-1">Written: 2026-05-27T10:23:45Z</p>
                <p className="text-gray-400">No tampering detected</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capability 2: EU AI Act */}
      <section id="compliance" style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }} className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm order-last md:order-first">
            <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-gray-400 text-xs ml-2" style={{ fontFamily: "var(--font-geist-mono)" }}>governance_report.json (excerpt)</span>
            </div>
            <div className="bg-[#0d1117] p-5" style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: "1.85" }}>
              <p className="text-gray-400">{`{`}</p>
              <p className="text-gray-400 pl-4">{`"project": `}<span className="text-yellow-400">"intake-pipeline"</span>,</p>
              <p className="text-gray-400 pl-4">{`"compliance_score": `}<span className="text-[#16a34a]">0.87</span>,</p>
              <p className="text-gray-400 pl-4">{`"status": `}<span className="text-[#16a34a]">"COMPLIANT"</span>,</p>
              <p className="text-gray-400 pl-4">{`"risk_classification": `}<span className="text-yellow-400">"medium"</span>,</p>
              <p className="text-gray-400 pl-4">{`"ai_bill_of_materials": {`}</p>
              <p className="text-gray-400 pl-8">{`"models": ["claude-sonnet-4-5", "claude-haiku-3"],`}</p>
              <p className="text-gray-400 pl-8">{`"datasets": ["rag_index_v4"],`}</p>
              <p className="text-gray-400 pl-8">{`"providers": ["anthropic"]`}</p>
              <p className="text-gray-400 pl-4">{`},`}</p>
              <p className="text-gray-400 pl-4">{`"articles": { ... },`}</p>
              <p className="text-gray-400 pl-4">{`"risk_items": [`}</p>
              <p className="text-gray-400 pl-8">{`{ "article": "14", "finding": "oversight_gap", "severity": "low" }`}</p>
              <p className="text-gray-400 pl-4">{`]`}</p>
              <p className="text-gray-400">{`}`}</p>
            </div>
          </div>
          <div id="eu-ai-act">
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(24px,3vw,36px)" }}>
              EU AI Act compliance reporting
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              Run <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva governance report</code> to generate a compliance report covering Articles 9 through 15. The report scores each article, assigns a risk classification, and exports a machine-readable JSON file.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              The report includes an AI bill of materials: every model, dataset, and provider used by your system, with version information. Legal teams can hand this directly to regulators.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              Risk scoring per article is based on your project configuration, lineage records, and test results. A risk item flagged in Article 14 (human oversight) is specific enough for your engineering team to act on.
            </p>
          </div>
        </div>
      </section>

      {/* Capability 3: Air-gap */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(24px,3vw,36px)" }}>
              Air-gap and private deployment
            </h2>
            <p className="text-gray-500 leading-relaxed mb-5">
              Pass the <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">--air-gapped</code> flag and Ryva makes zero external network calls. No telemetry, no update checks, no external API calls. Every operation runs on your infrastructure.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              In air-gapped mode, only local Ollama endpoints are supported for model inference. Lineage records, governance reports, and traces are written to your configured local storage backend.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              Designed for government agencies, defense contractors, and financial services firms that operate under strict network isolation requirements. Ryva has no embedded callbacks or external dependencies at runtime.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <div className="bg-[#0d1117] p-5" style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, lineHeight: "1.85" }}>
              <p><span className="text-gray-500">$ </span><span className="text-[#16a34a]">ryva run --air-gapped --agent intake_agent</span></p>
              <p className="text-gray-500 mt-1">Air-gapped mode enabled</p>
              <p className="text-gray-500">Network calls: blocked</p>
              <p className="text-gray-500">Provider: ollama (local)</p>
              <p className="text-gray-500">Storage: local filesystem</p>
              <p className="text-gray-500">Telemetry: disabled</p>
              <div className="border-t border-gray-800 mt-3 pt-3">
                <p className="text-[#16a34a]">Run complete</p>
                <p className="text-gray-400">Lineage written to .ryva/lineage/f87951e4.json</p>
                <p className="text-gray-400">Zero external requests made</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }} className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(24px,3vw,36px)" }}>
            Enterprise integrations
          </h2>
          <p className="text-gray-500 mb-10 leading-relaxed">Connect Ryva to the infrastructure your organization already uses.</p>
          <div className="grid md:grid-cols-3 gap-4">
            {INTEGRATIONS.map((i) => (
              <div key={i.name} className="border border-gray-200 rounded-xl p-5 bg-white">
                <h3 className="font-semibold text-gray-900 text-sm mb-2">{i.name}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{i.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact form */}
      <section id="contact" className="py-24 px-6">
        <div className="max-w-xl mx-auto">
          <h2 className="font-bold text-gray-900 tracking-tight mb-3" style={{ fontSize: "clamp(24px,3vw,36px)" }}>
            Talk to the sales team
          </h2>
          <p className="text-gray-500 mb-10">We respond within one business day.</p>

          {submitted ? (
            <div className="border border-green-200 bg-green-50 rounded-xl p-8 text-center">
              <p className="text-[#16a34a] font-semibold mb-2">Thanks, we will be in touch soon.</p>
              <p className="text-gray-500 text-sm">We typically respond within one business day.</p>
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
                className="bg-gray-900 text-white text-sm font-medium px-7 py-3 rounded-full hover:bg-gray-700 transition-colors w-full"
              >
                Contact sales team
              </button>
            </form>
          )}
        </div>
      </section>

    </div>
  );
}
