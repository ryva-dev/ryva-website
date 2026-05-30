import Link from "next/link";
import TerminalHero from "./components/TerminalHero";
import ProductTabs from "./components/ProductTabs";

const STATS = [
  { value: "9",    label: "Test types built in" },
  { value: "4",    label: "LLM providers supported" },
  { value: "227",  label: "Unit tests in the suite" },
  { value: "0.87", label: "Average EU AI Act compliance score" },
];

const PROBLEMS = [
  {
    title: "No audit trail",
    body: "When a regulator asks what data your AI used, what prompt was active, or why it made a specific decision — most teams have no way to answer. They are flying blind.",
  },
  {
    title: "No compliance documentation",
    body: "The EU AI Act and Colorado AI Act require documented model cards, impact assessments, and risk classifications for every high-risk AI system. Almost no team has this.",
  },
  {
    title: "No continuous evidence",
    body: "Annual audits tell you what happened last year. Regulators want continuous proof that your systems are behaving correctly. Static documents do not cut it anymore.",
  },
];

const MARQUEE_ROW1 = [
  "Anthropic", "OpenAI", "GitHub", "Google", "Ollama",
  "AWS", "PostgreSQL", "LangChain",
];
const MARQUEE_ROW2 = [
  "Hugging Face", "Docker", "Kubernetes", "Railway",
  "Vercel", "Slack", "PagerDuty", "Datadog",
];

const SOCIAL_PROOF = [
  {
    title: "227 unit tests",
    body: "Production-grade CLI. 227 tests across 12 files. Zero lint errors. Full CI on every push.",
  },
  {
    title: "9 test types",
    body: "Schema, fuzz, hallucination, adversarial, RAG, memory, regression, fine-tune, and multimodal. All from one CLI.",
  },
  {
    title: "Open source",
    body: "MIT licensed. Free forever for individual engineers. The full CLI, lineage engine, and governance reporter are open source.",
  },
];

const REGULATORY_CARDS = [
  {
    badge: "In force",
    badgeColor: "text-[#16a34a]",
    title: "EU AI Act",
    desc: "Articles 9-15 covered, machine-readable compliance reports",
    link: "/enterprise#eu-ai-act",
  },
  {
    badge: "Effective June 2026",
    badgeColor: "text-yellow-600",
    title: "Colorado AI Act",
    desc: "Impact assessments, audit trails, consumer notice requirements",
    link: "/enterprise#colorado",
  },
  {
    badge: "PII protection built in",
    badgeColor: "text-[#16a34a]",
    title: "GDPR and HIPAA",
    desc: "PII masking, no personal data in audit trails",
    link: "/enterprise#security",
  },
];

export default function Home() {
  return (
    <div className="bg-white text-gray-900">

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-16">
        <div className="grid md:grid-cols-5 gap-12 items-center">
          {/* Left: 60% */}
          <div className="md:col-span-3">
            {/* Status line */}
            <p className="flex items-center gap-2 text-[#16a34a] text-sm font-semibold mb-8">
              <span className="w-2 h-2 rounded-full bg-[#16a34a] shrink-0" />
              Colorado AI Act effective June 2026 — Is your AI stack ready?
            </p>

            {/* Headline */}
            <h1
              className="font-extrabold text-gray-900 tracking-tight mb-6"
              style={{ fontSize: "clamp(40px,5vw,64px)", lineHeight: 1.1, maxWidth: 720 }}
            >
              Your AI systems are<br />
              already being audited.<br />
              Are you ready?
            </h1>

            {/* Subheadline */}
            <p
              className="text-gray-500 mb-10 leading-relaxed"
              style={{ fontSize: 20, maxWidth: 560 }}
            >
              Ryva automatically generates the compliance evidence, audit trails, and governance documentation your AI systems need to survive regulatory scrutiny — continuously, not just at audit time.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-8">
              <a
                href="https://calendly.com/aball-ryvaforge/ryva-demo"
                className="bg-[#16a34a] text-white px-6 py-3 rounded-full font-medium hover:bg-[#15803d] transition-colors text-sm"
              >
                Book a demo
              </a>
              <a
                href="https://github.com/ryva-dev/ryva"
                className="bg-gray-900 text-white px-6 py-3 rounded-full font-medium hover:bg-gray-700 transition-colors text-sm"
              >
                Start free
              </a>
            </div>

            {/* Trust line */}
            <p className="text-gray-400" style={{ fontSize: 14 }}>
              Free and open source. No credit card required. EU AI Act and Colorado AI Act coverage built in.
            </p>
          </div>

          {/* Right: 40% */}
          <div className="md:col-span-2">
            <TerminalHero />
          </div>
        </div>
      </section>

      {/* STATS BAR */}
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

      {/* PROBLEM STATEMENT */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-center font-bold text-gray-900 tracking-tight mb-16"
            style={{ fontSize: "clamp(28px,4vw,40px)", lineHeight: 1.2 }}
          >
            AI teams are shipping without the controls every other production system already has.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {PROBLEMS.map((p) => (
              <div
                key={p.title}
                className="bg-white shadow-sm rounded-xl p-6"
                style={{ borderLeft: "4px solid #16a34a" }}
              >
                <h3 className="font-semibold text-gray-900 mb-3 text-base">{p.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT TABS */}
      <section className="py-24 px-6" style={{ background: "#ffffff" }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(26px,3.5vw,38px)" }}
            >
              Everything your compliance team has been asking for.
            </h2>
            <p className="text-gray-500 leading-relaxed" style={{ maxWidth: 520 }}>
              One platform. Every piece of evidence a regulator needs.
            </p>
          </div>
          <ProductTabs />
        </div>
      </section>

      {/* REGULATORY COVERAGE */}
      <section className="py-24 px-6" style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}>
        <div className="max-w-5xl mx-auto">
          <h2
            className="font-bold text-gray-900 tracking-tight mb-4"
            style={{ fontSize: "clamp(26px,3.5vw,38px)" }}
          >
            Built for the regulations that matter right now.
          </h2>
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {REGULATORY_CARDS.map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-xl p-6 border"
                style={{ borderColor: "#e5e7eb", borderRadius: 12 }}
              >
                <p className={`text-xs font-semibold mb-4 ${card.badgeColor}`}>{card.badge}</p>
                <h3 className="font-semibold text-gray-900 mb-2">{card.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">{card.desc}</p>
                <Link href={card.link} className="text-[#16a34a] text-sm font-medium hover:underline">
                  View coverage
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTEGRATION MARQUEE */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-gray-400 font-semibold text-sm mb-10 uppercase tracking-widest">
            Works alongside your existing AI stack.
          </p>
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

      {/* SOCIAL PROOF */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2
            className="font-bold text-gray-900 tracking-tight mb-12 text-center"
            style={{ fontSize: "clamp(26px,3.5vw,36px)" }}
          >
            Built in public. Trusted by engineers.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {SOCIAL_PROOF.map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-xl p-6 border"
                style={{ borderColor: "#e5e7eb", borderRadius: 12 }}
              >
                <h3 className="font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AUDIT ENGAGEMENT CTA */}
      <section className="py-24 px-6" style={{ background: "#111827" }}>
        <div className="max-w-7xl mx-auto text-center">
          <div className="max-w-[700px] mx-auto">
            <h2
              className="font-bold text-white tracking-tight mb-6"
              style={{ fontSize: "clamp(28px,3.5vw,40px)", lineHeight: 1.2 }}
            >
              Your AI compliance audit. Delivered in 30 days.
            </h2>
            <p
              className="text-gray-400 mb-10 leading-relaxed"
              style={{ fontSize: 18 }}
            >
              We connect to your existing AI systems, assess your stack against EU AI Act and Colorado AI Act requirements, generate model cards and compliance documentation, and deliver a complete audit package your legal team can hand directly to regulators.
            </p>
            <a
              href="https://calendly.com/aball-ryvaforge/ryva-demo"
              className="bg-[#16a34a] text-white px-6 py-3 rounded-full font-medium hover:bg-[#15803d] transition-colors text-sm inline-block"
            >
              Book a discovery call
            </a>
            <p className="text-gray-500 text-sm mt-6">
              No commitment. Just a conversation about what your team needs.
            </p>
          </div>
        </div>
      </section>

      {/* INSTALL SECTION */}
      <section className="py-24 px-6" style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0" }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2
            className="font-bold text-gray-900 tracking-tight mb-4"
            style={{ fontSize: "clamp(26px,3.5vw,36px)" }}
          >
            Start in 2 minutes. Scale to enterprise.
          </h2>
          <p className="text-gray-500 mb-10 leading-relaxed">
            Install from PyPI, initialize your project, and run your first governance report.
          </p>

          {/* Terminal block */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm mx-auto max-w-xl mb-10">
            <div
              className="px-4 py-2.5 flex items-center gap-1.5"
              style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <div
              className="bg-[#0d1117] p-5 text-left"
              style={{ fontFamily: "var(--font-geist-mono)", fontSize: 13, lineHeight: "1.9" }}
            >
              <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>pip install ryva</span></p>
              <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva init my-project</span></p>
              <p><span style={{ color: "#6b7280" }}>$ </span><span style={{ color: "#16a34a" }}>ryva governance report</span></p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="https://github.com/ryva-dev/ryva"
              className="bg-gray-900 text-white px-6 py-3 rounded-full font-medium hover:bg-gray-700 transition-colors text-sm"
            >
              View on GitHub
            </a>
            <a
              href="https://calendly.com/aball-ryvaforge/ryva-demo"
              className="bg-[#16a34a] text-white px-6 py-3 rounded-full font-medium hover:bg-[#15803d] transition-colors text-sm"
            >
              Book a demo
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
