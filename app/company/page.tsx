import Link from "next/link";

const VALUES = [
  {
    title: "Open by default",
    body: "MIT licensed CLI, forever free. Enterprise features fund the open source work.",
  },
  {
    title: "Honest about limitations",
    body: "We document what Ryva does not do. We do not oversell.",
  },
  {
    title: "Engineers first",
    body: "Every product decision starts with the person running the terminal.",
  },
];

export default function CompanyPage() {
  return (
    <div className="bg-white text-gray-900">

      {/* Hero */}
      <section
        className="px-6 pt-24 pb-20 text-center"
        style={{ borderBottom: "1px solid #f0f0f0" }}
      >
        <div className="max-w-2xl mx-auto">
          {/* Logo — larger on company page */}
          <div className="flex justify-center mb-10">
            <img src="/logo.png" height={80} alt="Ryva" style={{ height: 80 }} />
          </div>
          <h1
            className="font-bold text-gray-900 tracking-tight mb-6"
            style={{ fontSize: "clamp(34px,5vw,52px)", lineHeight: 1.15 }}
          >
            Built by an engineer who got tired of shipping AI in the dark.
          </h1>
        </div>
      </section>

      {/* Story */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <p
            className="text-gray-600 leading-relaxed mb-6"
            style={{ fontSize: 18 }}
          >
            Every AI engineer knows the moment. You build an agent, it works in staging, you ship it, and then you have no idea what it is doing in production. No traces. No cost visibility. No way to know if a prompt change broke something quietly three weeks ago.
          </p>
          <p
            className="text-gray-600 leading-relaxed mb-6"
            style={{ fontSize: 18 }}
          >
            I built the tooling I wished existed. A framework that brings the same engineering discipline to AI systems that dbt brought to data pipelines and Terraform brought to infrastructure.
          </p>
          <p
            className="text-gray-600 leading-relaxed mb-6"
            style={{ fontSize: 18 }}
          >
            Ryva started as a CLI. It is becoming an AI governance platform because that is what enterprise teams actually need — not just testing, but the continuous compliance evidence that lets them defend every AI decision to regulators, lawyers, and boards.
          </p>
          <p
            className="text-gray-600 leading-relaxed"
            style={{ fontSize: 18 }}
          >
            We are building in public, open source first, and funded by the enterprise teams that need this most.
          </p>
        </div>
      </section>

      {/* Founder card */}
      <section
        className="py-16 px-6"
        style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}
      >
        <div className="max-w-xl mx-auto">
          <div className="flex items-start gap-6">
            {/* Gray circle with initials since founder.jpg likely does not exist */}
            <div
              className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-500 font-bold text-xl"
            >
              AB
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-lg mb-0.5">Allie Ball</p>
              <p className="text-gray-500 text-sm mb-3">Founder and CEO, Ryva Forge</p>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                Previously built AI systems in production and got tired of doing it without proper tooling.
              </p>
              <a
                href="#"
                className="text-[#16a34a] text-sm font-medium hover:underline"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2
            className="font-bold text-gray-900 tracking-tight mb-12"
            style={{ fontSize: "clamp(26px,3.5vw,36px)" }}
          >
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
          <p
            className="text-gray-500 leading-relaxed mb-8"
            style={{ fontSize: 17 }}
          >
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
