"use client";
import { useState } from "react";
import Link from "next/link";

const PLANS = [
  {
    name: "Free",
    tagline: "For individual engineers",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    priceNote: "Forever",
    featured: false,
    features: [
      "Full CLI access",
      "All 9 test types",
      "Lineage tracking (local)",
      "Governance reports (local)",
      "1 project",
      "Community support",
    ],
    cta: "Get started",
    ctaHref: "https://github.com/ryva-dev/ryva",
    ctaSecondary: null,
  },
  {
    name: "Team",
    tagline: "For growing engineering teams",
    monthlyPrice: "$59",
    yearlyPrice: "$49",
    priceNote: "per user / month",
    featured: true,
    features: [
      "Everything in Free",
      "Ryva Cloud dashboard",
      "Shared traces and lineage",
      "Team permissions and roles",
      "10 projects",
      "Slack alerts",
      "Email support",
    ],
    cta: "Get started",
    ctaHref: "https://ryva-dashboard.vercel.app",
    ctaSecondary: null,
  },
  {
    name: "Business",
    tagline: "For organizations shipping AI at scale",
    monthlyPrice: "$179",
    yearlyPrice: "$149",
    priceNote: "per user / month",
    featured: false,
    features: [
      "Everything in Team",
      "Unlimited projects",
      "PostgreSQL and S3 backends",
      "PII masking",
      "HMAC lineage signing",
      "Priority support",
      "SLA guarantee",
    ],
    cta: "Get started",
    ctaHref: "https://ryva-dashboard.vercel.app",
    ctaSecondary: "Contact sales",
  },
  {
    name: "Enterprise",
    tagline: "Annual billing only",
    monthlyPrice: "Custom",
    yearlyPrice: "Custom",
    priceNote: "Talk to sales",
    featured: false,
    features: [
      "Everything in Business",
      "EU AI Act compliance exports",
      "Air-gap deployment",
      "SAML and SCIM",
      "Dedicated support",
      "Custom SLA",
      "On-premise option",
      "Procurement and legal support",
    ],
    cta: "Contact sales",
    ctaHref: "mailto:sales@ryvaforge.com",
    ctaSecondary: null,
  },
];

const FAQ = [
  {
    q: "Is the CLI really free forever?",
    a: "Yes. The Ryva CLI, including all nine test types, lineage tracking, governance reporting, and cost forecasting, is MIT licensed and free forever. No account required. Enterprise features like shared dashboards, SAML, and compliance exports are how we fund the open source work.",
  },
  {
    q: "Can I self-host Ryva Cloud?",
    a: "Yes, on the Business and Enterprise plans. Ryva Cloud is open source and can be deployed to your own infrastructure. We support PostgreSQL for trace storage and S3-compatible stores for lineage exports.",
  },
  {
    q: "What is included in the EU AI Act compliance report?",
    a: "The report covers Articles 9, 10, 12, 13, 14, and 15. It scores each article based on your project configuration, lineage records, and test results, then exports a machine-readable JSON file for legal teams and regulators.",
  },
  {
    q: "Does Ryva work with any LLM provider?",
    a: "Ryva has built-in support for Anthropic, OpenAI, Google Gemini, and Ollama. For any other provider, the plugin system lets you implement a custom provider interface that works with all of Ryva's tooling automatically.",
  },
  {
    q: "How does PII masking work?",
    a: "Ryva applies PII masking before every log write. You declare PII field patterns in your project config, and Ryva redacts them from traces, lineage records, and governance reports before they are stored. The redaction is logged so auditors can verify it happened.",
  },
  {
    q: "What support is included in the Enterprise plan?",
    a: "Enterprise includes a dedicated support engineer, a custom SLA with defined response times, help with procurement and legal review, and optional on-premise deployment support. We respond to Enterprise support requests within two hours during business hours.",
  },
];

export default function PricingPage() {
  const [yearly, setYearly] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ background: "#0a0a0a", color: "#ffffff" }} className="min-h-screen">

      {/* Hero */}
      <section className="text-center px-6 pt-24 pb-16">
        <h1 className="font-bold tracking-tight mb-4" style={{ fontSize: "clamp(36px,5vw,52px)" }}>
          Simple, transparent pricing.
        </h1>
        <p className="text-gray-400 mb-10" style={{ fontSize: 18, maxWidth: 480, margin: "0 auto 40px" }}>
          Start for free. Upgrade when your team needs shared dashboards and compliance tooling.
        </p>

        {/* Toggle */}
        <div className="inline-flex items-center gap-3 border border-gray-700 rounded-full p-1 mb-16">
          <button
            onClick={() => setYearly(false)}
            className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
              !yearly ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
              yearly ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
            }`}
          >
            Yearly
            <span className="ml-2 text-xs text-[#16a34a]">Save 17%</span>
          </button>
        </div>
      </section>

      {/* Plans */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 flex flex-col ${
                plan.featured
                  ? "bg-white text-gray-900"
                  : "border border-gray-800 bg-gray-900/50"
              }`}
            >
              <div className="mb-6">
                <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${plan.featured ? "text-[#16a34a]" : "text-gray-400"}`}>
                  {plan.name}
                </p>
                <p className={`text-sm mb-4 ${plan.featured ? "text-gray-600" : "text-gray-400"}`}>{plan.tagline}</p>
                <p className={`font-bold tracking-tight ${plan.featured ? "text-gray-900" : "text-white"}`} style={{ fontSize: 36 }}>
                  {yearly ? plan.yearlyPrice : plan.monthlyPrice}
                </p>
                {plan.yearlyPrice !== "Custom" && (
                  <p className={`text-xs mt-1 ${plan.featured ? "text-gray-500" : "text-gray-500"}`}>{plan.priceNote}</p>
                )}
                {plan.yearlyPrice === "Custom" && (
                  <p className={`text-xs mt-1 ${plan.featured ? "text-gray-500" : "text-gray-500"}`}>{plan.priceNote}</p>
                )}
              </div>

              <ul className="space-y-2.5 flex-1 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className={`text-sm flex items-start gap-2 ${plan.featured ? "text-gray-600" : "text-gray-400"}`}>
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${plan.featured ? "border-[#16a34a]" : "border-gray-600"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${plan.featured ? "bg-[#16a34a]" : "bg-gray-500"}`} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="space-y-2">
                <Link
                  href={plan.ctaHref}
                  className={`block text-center text-sm font-medium px-5 py-2.5 rounded-full transition-colors ${
                    plan.featured
                      ? "bg-gray-900 text-white hover:bg-gray-700"
                      : "bg-white text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  {plan.cta}
                </Link>
                {plan.ctaSecondary && (
                  <Link
                    href="mailto:sales@ryvaforge.com"
                    className="block text-center text-sm font-medium px-5 py-2.5 rounded-full border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
                  >
                    {plan.ctaSecondary}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24" style={{ borderTop: "1px solid #1f2937" }}>
        <div className="max-w-3xl mx-auto pt-20">
          <h2 className="font-bold text-white tracking-tight mb-12 text-center" style={{ fontSize: "clamp(26px,3.5vw,36px)" }}>
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div key={i} className="border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between text-white hover:bg-gray-800/50 transition-colors"
                >
                  <span className="text-sm font-medium">{item.q}</span>
                  <span className={`text-gray-400 text-lg transition-transform ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-gray-400 text-sm leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="text-center px-6 pb-24">
        <div className="max-w-xl mx-auto">
          <p className="text-gray-400 mb-6">Questions about enterprise pricing?</p>
          <Link
            href="mailto:sales@ryvaforge.com"
            className="bg-white text-gray-900 text-sm font-medium px-7 py-3 rounded-full hover:bg-gray-100 transition-colors inline-block"
          >
            Contact sales
          </Link>
        </div>
      </section>

    </div>
  );
}
