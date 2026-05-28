import Link from "next/link";

const VALUES = [
  {
    title: "Open by default",
    body: "The CLI is free and open source forever. Enterprise features like shared dashboards, SAML, and compliance exports are how we fund the open source work.",
  },
  {
    title: "Built for engineers",
    body: "Every decision is made with the person running the terminal in mind. No unnecessary abstractions. No dashboards that duplicate what the CLI already does better.",
  },
  {
    title: "Honest about limitations",
    body: "We document what Ryva does not do. We do not claim our governance reports replace legal review. We do not oversell the compliance scoring as certification.",
  },
];

export default function CompanyPage() {
  return (
    <div className="bg-white text-gray-900">

      {/* Hero */}
      <section className="px-6 pt-24 pb-20 text-center" style={{ borderBottom: "1px solid #f0f0f0" }}>
        <div className="max-w-2xl mx-auto">
          <h1 className="font-bold text-gray-900 tracking-tight mb-6" style={{ fontSize: "clamp(34px,5vw,52px)", lineHeight: 1.15 }}>
            Built by engineers who got tired of<br />shipping AI systems in the dark.
          </h1>
        </div>
      </section>

      {/* Story */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-500 leading-relaxed mb-6" style={{ fontSize: 17 }}>
              Ryva started with a problem every AI engineer knows: you build an agent, it works in testing, you ship it, and then you have no idea what it is doing in production. No traces. No cost visibility. No way to know if a prompt change broke something.
            </p>
            <p className="text-gray-500 leading-relaxed mb-6" style={{ fontSize: 17 }}>
              We built the tooling we wished existed. A framework that brings the same engineering discipline to AI systems that dbt brought to data and Terraform brought to infrastructure.
            </p>
            <p className="text-gray-500 leading-relaxed" style={{ fontSize: 17 }}>
              Ryva is open source, built in public, and designed to grow with your team from a single CLI command to a full enterprise governance platform.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }} className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-bold text-gray-900 tracking-tight mb-12" style={{ fontSize: "clamp(26px,3.5vw,36px)" }}>
            How we work
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {VALUES.map((v) => (
              <div key={v.title}>
                <h3 className="font-semibold text-gray-900 mb-3">{v.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open source */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }} className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-bold text-gray-900 tracking-tight mb-5" style={{ fontSize: "clamp(26px,3.5vw,36px)" }}>
            Ryva is open source
          </h2>
          <p className="text-gray-500 leading-relaxed mb-8" style={{ fontSize: 17 }}>
            The CLI, the test runner, the lineage engine, the governance reporter — all of it is open source and MIT licensed. Enterprise features like shared dashboards, SAML, and compliance exports are how we fund the open source work.
          </p>
          <Link
            href="https://github.com/ryva-dev/ryva"
            className="bg-gray-900 text-white text-sm font-medium px-7 py-3 rounded-md hover:bg-gray-700 transition-colors inline-block"
          >
            View on GitHub
          </Link>
        </div>
      </section>

    </div>
  );
}
