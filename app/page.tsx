import Link from "next/link";
import TerminalHero from "./components/TerminalHero";
import ProductTabs from "./components/ProductTabs";
import CyclingTerminal from "./components/CyclingTerminal";

const STATS = [
  { value: "9",    label: "Test types built in" },
  { value: "4",    label: "LLM providers supported" },
  { value: "227",  label: "Unit tests in the suite" },
  { value: "0.87", label: "Avg EU AI Act score" },
];

const PROBLEMS = [
  {
    title: "No testing standard",
    body: "Every team invents their own way to check if an agent works. Most of it is manual, inconsistent, and invisible to anyone outside the team.",
  },
  {
    title: "No lineage or auditability",
    body: "When something goes wrong, nobody can trace which prompt version ran, what data was retrieved, or why the model decided what it decided.",
  },
  {
    title: "No governance layer",
    body: "Regulators, legal teams, and boards are starting to ask hard questions about AI systems. Most companies have no way to answer them.",
  },
];

const PARTNERS = ["Anthropic", "OpenAI", "GitHub", "Google", "Ollama"];

const MARQUEE_ROW1 = [
  "Anthropic", "OpenAI", "GitHub", "Google Cloud", "Ollama",
  "AWS", "PostgreSQL", "Slack",
];
const MARQUEE_ROW2 = [
  "LangChain", "Hugging Face", "Docker", "Kubernetes",
  "Datadog", "PagerDuty", "Vercel", "Railway",
];

const TEST_TYPES = [
  "Schema validation",
  "Regression comparison",
  "Adversarial probing",
  "Memory retention",
  "RAG faithfulness",
  "Hallucination detection",
  "Fuzz testing (15 categories)",
  "Fine-tune evaluation",
  "Business alignment",
];

const TRUST = [
  {
    title: "SOC 2 ready",
    body: "Tamper-evident audit logs, role-based access, and full activity history give your security team what they need.",
  },
  {
    title: "EU AI Act compliant",
    body: "Built-in compliance reporting for Articles 9 through 15. Machine-readable JSON output for legal and regulatory teams.",
  },
  {
    title: "Air-gap compatible",
    body: "Run entirely within your private network. No telemetry, no external pings. Supports local Ollama endpoints only.",
  },
];

function ArrowRight() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" aria-hidden="true">
      <line x1="0" y1="8" x2="16" y2="8" stroke="#d1d5db" strokeWidth="1.5" />
      <polyline points="10,3 16,8 10,13" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const LINEAGE_NODES = [
  { label: "Input",        hash: "8f3a9c2d" },
  { label: "Prompt v2.1",  hash: "7a2b5e9f" },
  { label: "RAG chunks",   hash: "a1b2c3d4" },
  { label: "LLM call",     hash: "claude-s4-5" },
  { label: "Output",       hash: "2d8e1c7b" },
];

export default function Home() {
  return (
    <div className="bg-white text-gray-900">

      {/* ── HERO ─────────────────────────────────── */}
      <section className="text-center px-6 pt-24 pb-16">
        <div className="max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 text-sm text-gray-600 border rounded-full px-4 py-1.5 mb-8" style={{ borderColor: "#e5e7eb" }}>
            <span className="w-2 h-2 rounded-full bg-[#16a34a] shrink-0" />
            Now with EU AI Act compliance reporting
          </div>

          {/* Headline */}
          <h1
            className="font-bold text-gray-900 tracking-tight mb-6"
            style={{ fontSize: "clamp(40px,6vw,64px)", lineHeight: 1.1 }}
          >
            The AI governance platform<br />
            your engineering team<br />
            actually needs.
          </h1>

          {/* Subheadline */}
          <p className="text-gray-500 mb-10 mx-auto" style={{ fontSize: 20, maxWidth: 560, lineHeight: 1.6 }}>
            Test, trace, align, and govern every AI agent, model, and pipeline.
            Built for teams shipping AI in production who need more than vibes.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <Link
              href="https://github.com/ryva-dev/ryva"
              className="bg-gray-900 text-white text-sm font-medium px-7 py-3 rounded-full hover:bg-gray-700 transition-colors"
            >
              Get started free
            </Link>
            <Link
              href="mailto:sales@ryvaforge.com"
              className="bg-white text-gray-900 text-sm font-medium px-7 py-3 rounded-full border border-gray-300 hover:border-gray-500 transition-colors"
            >
              Contact sales
            </Link>
          </div>

          {/* Partner logos */}
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-5">Works alongside your existing stack</p>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {PARTNERS.map((p) => (
              <span
                key={p}
                className="text-gray-400 text-sm font-semibold opacity-60 hover:opacity-100 transition-opacity cursor-default"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Terminal animation */}
        <div className="max-w-5xl mx-auto mt-16">
          <TerminalHero />
        </div>
      </section>

      {/* ── STATS ────────────────────────────────── */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}>
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200" style={{ paddingTop: 48, paddingBottom: 48 }}>
          {STATS.map((s) => (
            <div key={s.label} className="text-center px-8">
              <p className="font-bold text-gray-900 mb-1" style={{ fontSize: 48 }}>{s.value}</p>
              <p className="text-gray-500" style={{ fontSize: 14 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROBLEM STATEMENT ────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center font-bold text-gray-900 tracking-tight mb-16" style={{ fontSize: "clamp(28px,4vw,40px)", lineHeight: 1.2 }}>
            AI teams are shipping without the controls<br />
            every other production system already has.
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            {PROBLEMS.map((p) => (
              <div key={p.title}>
                <h3 className="font-semibold text-gray-900 mb-3 text-base">{p.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT TABS ─────────────────────────── */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }} className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-xl mb-12">
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(26px,3.5vw,38px)" }}>
              Every capability your AI stack needs
            </h2>
            <p className="text-gray-500 leading-relaxed">
              From first test to full governance report, Ryva covers the entire production lifecycle of an AI system.
            </p>
          </div>
          <ProductTabs />
        </div>
      </section>

      {/* ── LOGO MARQUEE ─────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center font-semibold text-gray-900 mb-12 text-lg">
            Integrates with the tools your team already uses.
          </h2>
          <div className="overflow-hidden">
            <div className="flex gap-12 animate-marquee whitespace-nowrap mb-5">
              {[...MARQUEE_ROW1, ...MARQUEE_ROW1].map((logo, i) => (
                <span key={i} className="text-gray-400 text-sm font-semibold opacity-50 shrink-0">{logo}</span>
              ))}
            </div>
            <div className="flex gap-12 animate-marquee-reverse whitespace-nowrap">
              {[...MARQUEE_ROW2, ...MARQUEE_ROW2].map((logo, i) => (
                <span key={i} className="text-gray-400 text-sm font-semibold opacity-50 shrink-0">{logo}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE 1: Testing ───────────────────── */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }} className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(24px,3vw,36px)" }}>
              Test every layer of your AI system
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              Nine test types built in. No configuration needed to get started. Each type runs in isolation and reports individually, so failures are easy to trace.
            </p>
            <ul className="space-y-2 mb-8">
              {TEST_TYPES.map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="w-4 h-4 rounded-full border-2 border-[#16a34a] flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <Link href="/product#testing" className="text-[#16a34a] text-sm font-medium hover:underline">
              View all test types
            </Link>
          </div>
          <CyclingTerminal />
        </div>
      </section>

      {/* ── FEATURE 2: Lineage ───────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          {/* Lineage chain diagram */}
          <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">Run lineage: f87951e4</p>
            <div className="flex items-center gap-2 flex-wrap">
              {LINEAGE_NODES.map((node, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="border border-gray-200 rounded-lg p-3 text-center" style={{ minWidth: 90 }}>
                    <p className="text-xs font-semibold text-gray-700">{node.label}</p>
                    <p className="text-gray-400 mt-1" style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)" }}>
                      {node.hash}
                    </p>
                  </div>
                  {i < LINEAGE_NODES.length - 1 && <ArrowRight />}
                </div>
              ))}
            </div>
            <p className="text-[#16a34a] text-xs mt-6" style={{ fontFamily: "var(--font-geist-mono)" }}>
              Tamper-evident signature verified
            </p>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(24px,3vw,36px)" }}>
              Full lineage on every run
            </h2>
            <p className="text-gray-500 leading-relaxed mb-4">
              Every agent run records the full chain: input, prompt version, retrieval sources, tool calls, output, cost, and tokens. Tamper-evident. Exportable for regulators.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Every record is signed with an HMAC signature using your project key. Run
              {" "}<code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">ryva lineage verify</code>{" "}
              to prove data integrity to auditors.
            </p>
            <Link href="/product#lineage" className="text-[#16a34a] text-sm font-medium hover:underline">
              Learn about lineage tracking
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURE 3: Governance ────────────────── */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }} className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(24px,3vw,36px)" }}>
              EU AI Act compliance out of the box
            </h2>
            <p className="text-gray-500 leading-relaxed mb-4">
              Generate a machine-readable compliance report in one command. Covers Articles 9, 10, 12, 13, 14, and 15. Export as JSON for your legal team.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Ryva scores each article based on your project configuration, lineage records, and test results. The output is a structured JSON file your legal team can work with directly.
            </p>
            <Link href="/enterprise#eu-ai-act" className="text-[#16a34a] text-sm font-medium hover:underline">
              See the full compliance report structure
            </Link>
          </div>
          {/* Governance report card */}
          <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">EU AI Act compliance</p>
              <span className="bg-green-50 text-[#16a34a] text-xs font-semibold px-3 py-1 rounded-full border border-green-200">COMPLIANT</span>
            </div>
            <div className="space-y-2 mb-4">
              {[
                { art: "Article 9",  label: "Risk management",     score: "1.00" },
                { art: "Article 10", label: "Data governance",      score: "0.92" },
                { art: "Article 12", label: "Record-keeping",       score: "0.95" },
                { art: "Article 13", label: "Transparency",         score: "0.84" },
                { art: "Article 14", label: "Human oversight",      score: "0.81" },
                { art: "Article 15", label: "Accuracy/robustness",  score: "0.87" },
              ].map((row) => (
                <div key={row.art} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full bg-[#16a34a]/10 flex items-center justify-center shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                    </span>
                    <span className="text-gray-600">{row.art} — {row.label}</span>
                  </div>
                  <span className="text-gray-900 font-medium">{row.score}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">Overall score</p>
              <p className="text-xl font-bold text-gray-900">0.87</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ENTERPRISE TRUST ─────────────────────── */}
      <section style={{ background: "#0a0a0a" }} className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-white font-bold tracking-tight mb-16 text-center" style={{ fontSize: "clamp(26px,3.5vw,38px)" }}>
            Built for teams where AI decisions have real consequences.
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            {TRUST.map((t) => (
              <div key={t.title}>
                <h3 className="text-white font-semibold mb-3">{t.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────── */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-bold text-gray-900 tracking-tight mb-5" style={{ fontSize: "clamp(28px,4vw,44px)", lineHeight: 1.15 }}>
            Start with open source.<br />Scale to enterprise.
          </h2>
          <p className="text-gray-500 mb-10 leading-relaxed">
            Free CLI for individual engineers. Team and enterprise plans for organizations
            that need shared dashboards, governance reporting, and compliance exports.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <Link
              href="https://github.com/ryva-dev/ryva"
              className="bg-gray-900 text-white text-sm font-medium px-7 py-3 rounded-full hover:bg-gray-700 transition-colors"
            >
              Get started free
            </Link>
            <Link
              href="mailto:sales@ryvaforge.com"
              className="bg-white text-gray-900 text-sm font-medium px-7 py-3 rounded-full border border-gray-300 hover:border-gray-500 transition-colors"
            >
              Contact sales
            </Link>
          </div>
          <Link
            href="https://ryva-dashboard.vercel.app"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Already using Ryva? Sign in to Ryva Cloud
          </Link>
        </div>
      </section>

    </div>
  );
}
