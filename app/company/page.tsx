import Link from "next/link";

const VALUES = [
  {
    icon: "🔓",
    title: "Open by default",
    body: "MIT licensed CLI, forever free. Enterprise features fund the open source work.",
  },
  {
    icon: "🎯",
    title: "Honest about limitations",
    body: "We document what Ryva does not do. We do not oversell.",
  },
  {
    icon: "⚡",
    title: "Engineers first",
    body: "Every product decision starts with the person running the terminal.",
  },
];

const TIMELINE = [
  {
    date: "2026",
    title: "Full EU AI Act and Colorado AI Act coverage",
    desc: "Every article, every requirement, machine-readable evidence for regulators.",
  },
  {
    date: "2027",
    title: "The standard for AI governance in regulated industries",
    desc: "Ryva becomes the default compliance layer for AI teams in fintech, healthcare, and legal tech.",
  },
  {
    date: "Beyond",
    title: "The dbt of AI governance",
    desc: "The same engineering discipline that dbt brought to data pipelines and Terraform brought to infrastructure — applied to AI systems.",
  },
];

export default function CompanyPage() {
  return (
    <div className="bg-white text-gray-900">

      {/* Hero */}
      <section
        className="px-6 pt-24 pb-20"
        style={{ borderBottom: "1px solid #f0f0f0" }}
      >
        <div className="max-w-2xl">
          <div className="mb-10">
            <img src="/logo.png" alt="Ryva" style={{ height: 80 }} />
          </div>
          <h1
            className="font-bold text-gray-900 tracking-tight mb-6"
            style={{ fontSize: 48, lineHeight: 1.15 }}
          >
            Built by an engineer who got tired of shipping AI in the dark.
          </h1>
        </div>
      </section>

      {/* Story */}
      <section className="py-24 px-6">
        <div className="max-w-2xl">
          <p className="text-gray-600 leading-relaxed mb-6" style={{ fontSize: 18 }}>
            Every AI engineer knows the moment. You build an agent, it works in staging, you ship it, and then you have no idea what it is doing in production. No traces. No cost visibility. No way to know if a prompt change broke something quietly three weeks ago.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6" style={{ fontSize: 18 }}>
            Ryva started as the tooling we wished existed. A framework that brings the same engineering discipline to AI systems that dbt brought to data pipelines and Terraform brought to infrastructure.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6" style={{ fontSize: 18 }}>
            It is becoming an AI governance platform because that is what enterprise teams actually need. Not just testing, but the continuous compliance evidence that lets them defend every AI decision to regulators, lawyers, and boards.
          </p>
          <p className="text-gray-600 leading-relaxed" style={{ fontSize: 18 }}>
            We are building in public, open source first, and funded by the enterprise teams that need this most.
          </p>
        </div>
      </section>

      {/* How we work */}
      <section
        className="py-16 px-6"
        style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="font-bold text-gray-900 tracking-tight mb-12" style={{ fontSize: "clamp(26px,3.5vw,36px)" }}>
            How we work
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {VALUES.map((v) => (
              <div key={v.title}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 16 }}>
                  {v.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-3">{v.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we are building toward */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-bold text-gray-900 tracking-tight mb-12" style={{ fontSize: "clamp(26px,3.5vw,36px)" }}>
            What we are building toward
          </h2>
          <div style={{ position: "relative", paddingLeft: 24 }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "#e2e8f0" }} />
            {TIMELINE.map((item, i) => (
              <div key={item.title} style={{ position: "relative", marginBottom: i < TIMELINE.length - 1 ? 40 : 0 }}>
                <div style={{ position: "absolute", left: -30, top: 4, width: 12, height: 12, borderRadius: "50%", background: "#16a34a" }} />
                <p className="text-sm font-semibold text-gray-400 mb-1">{item.date}</p>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open source */}
      <section
        className="py-24 px-6"
        style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <h2
            className="font-bold text-gray-900 tracking-tight mb-5"
            style={{ fontSize: "clamp(26px,3.5vw,36px)" }}
          >
            The full Ryva CLI is open source and MIT licensed.
          </h2>
          <p className="text-gray-500 leading-relaxed mb-8" style={{ fontSize: 17 }}>
            The CLI, the test runner, the lineage engine, the governance reporter — all of it is open source. Enterprise features like shared dashboards, SAML, and compliance exports fund the open source work.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="https://github.com/ryva-dev/ryva"
              className="bg-gray-900 text-white px-6 py-3 rounded-full font-medium hover:bg-gray-700 transition-colors text-sm inline-block"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
            <a
              href="https://pypi.org/project/ryva"
              className="border border-gray-300 text-gray-700 px-6 py-3 rounded-full font-medium hover:border-gray-500 transition-colors text-sm inline-block"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on PyPI
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
