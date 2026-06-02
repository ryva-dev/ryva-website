"use client";
import { useState } from "react";
import Link from "next/link";

const FAQ = [
  {
    q: "Is the CLI really free forever?",
    a: "Yes. The Ryva CLI, including all nine test types, lineage tracking, governance reporting, and cost forecasting, is MIT licensed and free forever. No account required. You can run fuzz testing, generate EU AI Act compliance reports, and export audit packages without paying anything. Enterprise features like shared dashboards, SAML SSO, and cloud compliance exports are how we fund the open source work.",
  },
  {
    q: "Can I self-host Ryva Cloud?",
    a: "Yes, on the Business and Enterprise plans. Ryva Cloud is open source and can be deployed to your own infrastructure. We support PostgreSQL for trace storage and S3-compatible object stores for lineage exports. Air-gap deployment with no external dependencies is available on the Enterprise plan.",
  },
  {
    q: "What is included in the EU AI Act compliance report?",
    a: "The report covers Articles 9, 10, 12, 13, 14, and 15 in full. Each article is scored based on your project configuration, lineage records, and test results. The output is a machine-readable JSON file with per-article scores, a risk classification, and a list of evidence items. Your legal team can use this directly with regulators.",
  },
  {
    q: "Does Ryva cover the Colorado AI Act?",
    a: "Yes. Colorado AI Act SB 24-205 took effect June 1, 2026. Ryva generates impact assessments, consumer notice documentation, and audit trails that satisfy the Act&apos;s requirements for high-risk AI systems. Run ryva governance report --regulation colorado to generate a scored compliance report specifically for Colorado.",
  },
  {
    q: "Does Ryva work with any LLM provider?",
    a: "Ryva has built-in support for Anthropic, OpenAI, Google Gemini, and Ollama. For any other provider, the plugin system lets you implement a custom ModelProvider interface that works with all of Ryva&apos;s tooling automatically. Custom providers get full lineage recording, testing, and governance reporting support.",
  },
  {
    q: "How does PII masking work?",
    a: "You declare PII field patterns in your project configuration. Ryva applies masking before every log write. Masked fields are stored as redaction markers rather than raw values. The masking event is itself logged so auditors can verify it happened. PII masking status is visible in the cloud dashboard for every trace.",
  },
  {
    q: "What support is included in the Enterprise plan?",
    a: "Enterprise includes a dedicated support engineer, a custom SLA with defined response times, help with procurement and legal review, and optional on-premise deployment support. We respond to Enterprise support requests within two hours during business hours.",
  },
];

type Plan = {
  name: string;
  tagline: string;
  monthlyPrice: string;
  yearlyPrice: string;
  priceNote: string;
  featured: boolean;
  badge: string | null;
  features: string[];
  cta: string;
  ctaHref: string;
  ctaSecondary: string | null;
  ctaSecondaryHref: string | null;
};

const PLANS: Plan[] = [
  {
    name: "Free",
    tagline: "$0 forever",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    priceNote: "forever",
    featured: false,
    badge: null,
    features: [
      "Full CLI",
      "All 9 test types",
      "Lineage (local)",
      "Governance reports (local)",
      "Model cards (local)",
      "1 project",
      "Community support",
    ],
    cta: "Get started",
    ctaHref: "/get-started",
    ctaSecondary: null,
    ctaSecondaryHref: null,
  },
  {
    name: "Team",
    tagline: "/user/month",
    monthlyPrice: "$49",
    yearlyPrice: "$41",
    priceNote: "/user/month",
    featured: true,
    badge: "Most popular",
    features: [
      "Everything in Free",
      "Ryva Cloud dashboard",
      "Shared traces and lineage",
      "Team permissions",
      "10 projects",
      "30-day retention",
      "Slack alerts",
      "Email support",
    ],
    cta: "Get started",
    ctaHref: "/get-started",
    ctaSecondary: null,
    ctaSecondaryHref: null,
  },
  {
    name: "Business",
    tagline: "/user/month",
    monthlyPrice: "$149",
    yearlyPrice: "$124",
    priceNote: "/user/month",
    featured: false,
    badge: null,
    features: [
      "Everything in Team",
      "Unlimited projects",
      "90-day retention",
      "PII masking",
      "HMAC signing",
      "PostgreSQL/S3 backends",
      "EU AI Act exports",
      "Priority support",
      "SLA",
    ],
    cta: "Get started",
    ctaHref: "/get-started",
    ctaSecondary: "Contact sales",
    ctaSecondaryHref: "/contact",
  },
  {
    name: "Enterprise",
    tagline: "Annual billing",
    monthlyPrice: "Custom",
    yearlyPrice: "Custom",
    priceNote: "Annual billing",
    featured: false,
    badge: null,
    features: [
      "Everything in Business",
      "Colorado AI Act",
      "Full audit export",
      "Air-gap deployment",
      "SAML/SCIM",
      "Dedicated support",
      "Custom SLA",
      "On-premise",
      "Procurement support",
    ],
    cta: "Contact sales",
    ctaHref: "/contact",
    ctaSecondary: null,
    ctaSecondaryHref: null,
  },
];

export default function PricingPage() {
  const [yearly, setYearly] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ background: "#0a0a0a", color: "#ffffff" }} className="min-h-screen">

      {/* Hero */}
      <section className="text-center px-6 pt-24 pb-16">
        <h1
          className="font-bold tracking-tight mb-4"
          style={{ fontSize: "clamp(36px,5vw,52px)" }}
        >
          Simple, transparent pricing.
        </h1>
        <p
          className="text-gray-400 mb-12"
          style={{ fontSize: 18, maxWidth: 480, margin: "0 auto 48px" }}
        >
          Start free. Scale to enterprise.
        </p>

        {/* Monthly/yearly toggle */}
        <div className="inline-flex items-center rounded-full p-1 mb-16" style={{ background: "#1f2937" }}>
          <button
            onClick={() => setYearly(false)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              !yearly ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              yearly ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
            }`}
          >
            Yearly
            <span className="text-xs text-[#16a34a]">Save 17%</span>
          </button>
        </div>
      </section>

      {/* Plans */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 flex flex-col relative ${
                plan.featured
                  ? "bg-white text-gray-900"
                  : "border border-gray-800 bg-gray-900/50"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#16a34a] text-white text-xs font-semibold px-3 py-1 rounded">
                  {plan.badge}
                </div>
              )}
              <div className="mb-6">
                <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${plan.featured ? "text-[#16a34a]" : "text-gray-400"}`}>
                  {plan.name}
                </p>
                <p className={`font-bold tracking-tight ${plan.featured ? "text-gray-900" : "text-white"}`} style={{ fontSize: 36 }}>
                  {plan.monthlyPrice === "Custom" ? "Custom" : (yearly ? plan.yearlyPrice : plan.monthlyPrice)}
                </p>
                {plan.monthlyPrice !== "Custom" && (
                  <p className="text-xs mt-1 text-gray-500">{plan.priceNote}</p>
                )}
                {plan.monthlyPrice === "Custom" && (
                  <p className="text-xs mt-1 text-gray-500">{plan.priceNote}</p>
                )}
              </div>

              <ul className="space-y-2.5 flex-1 mb-8">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className={`text-sm flex items-start gap-2 ${plan.featured ? "text-gray-600" : "text-gray-400"}`}
                  >
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
                      : plan.name === "Enterprise"
                      ? "bg-[#16a34a] text-white hover:bg-[#15803d]"
                      : "bg-white text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  {plan.cta}
                </Link>
                {plan.ctaSecondary && plan.ctaSecondaryHref && (
                  <Link
                    href={plan.ctaSecondaryHref}
                    className="block text-center text-sm font-medium px-5 py-2.5 rounded-full border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
                  >
                    {plan.ctaSecondary}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 14, color: "#64748b", marginTop: 32 }}>
          Trusted by 200+ engineering teams in regulated industries.
        </p>
      </section>

      {/* Audit Engagement card */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <div
            className="rounded-2xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            style={{ background: "#111827", borderLeft: "4px solid #16a34a" }}
          >
            <div>
              <h3 className="font-bold text-white mb-2 text-lg">Need a one-time compliance audit?</h3>
              <p className="text-gray-400 text-sm leading-relaxed max-w-xl">
                We assess your AI stack against EU AI Act and Colorado AI Act requirements, generate model cards, and deliver a complete audit package. Pricing is scoped per engagement based on your needs.
              </p>
            </div>
            <Link
              href="/demo"
              className="bg-[#16a34a] text-white px-6 py-3 rounded-full font-medium hover:bg-[#15803d] transition-colors text-sm shrink-0"
            >
              Book a discovery call
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24" style={{ borderTop: "1px solid #1f2937" }}>
        <div className="max-w-3xl mx-auto pt-20">
          <h2
            className="font-bold text-white tracking-tight mb-12 text-center"
            style={{ fontSize: "clamp(26px,3.5vw,36px)" }}
          >
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
                  <span className="text-gray-400 text-lg transition-transform" style={{ transform: openFaq === i ? "rotate(45deg)" : "none" }}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-gray-400 text-sm leading-relaxed">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
