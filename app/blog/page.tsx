"use client";
import { useState } from "react";

const TAG_COLORS: Record<string, string> = {
  Compliance: "bg-green-100 text-green-700",
  Governance: "bg-blue-100 text-blue-700",
  Testing:    "bg-purple-100 text-purple-700",
  Security:   "bg-yellow-100 text-yellow-700",
};

const POSTS = [
  {
    tag: "Governance",
    date: "May 2026",
    readTime: "7 min read",
    title: "Why 94% of enterprise AI deployments fail compliance review",
    excerpt:
      "Most teams treat compliance as a documentation problem. It is actually an evidence problem. Here is what auditors actually look for.",
    href: "#",
  },
  {
    tag: "Testing",
    date: "May 2026",
    readTime: "6 min read",
    title: "Fuzz testing your LLM agent: what we found across 15 input categories",
    excerpt:
      "We ran 15 fuzz input categories against four different production agents. The failure modes were surprisingly consistent.",
    href: "#",
  },
  {
    tag: "Compliance",
    date: "April 2026",
    readTime: "5 min read",
    title: "Model cards for AI systems: what they are and why regulators want them",
    excerpt:
      "A model card is not a README. It is a structured disclosure document. Here is what goes in one and how Ryva generates them automatically.",
    href: "#",
  },
  {
    tag: "Security",
    date: "April 2026",
    readTime: "5 min read",
    title: "Tamper-evident audit logs: how HMAC signing works and why it matters",
    excerpt:
      "An audit log that can be altered after the fact is not an audit log. Here is how cryptographic signing makes lineage records trustworthy.",
    href: "#",
  },
];

export default function BlogPage() {
  const [email, setEmail]             = useState("");
  const [subscribed, setSubscribed]   = useState(false);

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setSubscribed(true);
  }

  return (
    <div className="bg-white text-gray-900">

      {/* Hero */}
      <section
        className="text-center px-6 py-20"
        style={{ borderBottom: "1px solid #f0f0f0" }}
      >
        <div className="max-w-2xl mx-auto">
          <h1
            className="font-bold text-gray-900 tracking-tight mb-4"
            style={{ fontSize: "clamp(32px,5vw,48px)" }}
          >
            From the Ryva team.
          </h1>
          <p className="text-gray-500" style={{ fontSize: 18, lineHeight: 1.6 }}>
            Insights on AI governance, compliance, and production AI engineering.
          </p>
        </div>
      </section>

      {/* Featured post */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <a
            href="#"
            className="block bg-white rounded-xl border border-gray-200 p-8 hover:border-gray-300 transition-colors shadow-sm"
            style={{ borderLeft: "4px solid #16a34a" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TAG_COLORS["Compliance"]}`}>
                Compliance
              </span>
              <span className="text-gray-400 text-sm">May 2026</span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-400 text-sm">8 min read</span>
            </div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: "clamp(22px,3vw,30px)", lineHeight: 1.2 }}
            >
              The Colorado AI Act takes effect June 2026. Here is what your AI team needs to do now.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6" style={{ maxWidth: 640 }}>
              The Act applies to any developer deploying a high-risk AI system that processes data on Colorado residents. If that is you, here is a practical checklist for what you need before the enforcement date.
            </p>
            <span className="text-[#16a34a] text-sm font-medium hover:underline">
              Read post →
            </span>
          </a>
        </div>
      </section>

      {/* Four post cards */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          {POSTS.map((post) => (
            <a
              key={post.title}
              href={post.href}
              className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TAG_COLORS[post.tag] ?? "bg-gray-100 text-gray-600"}`}>
                  {post.tag}
                </span>
                <span className="text-gray-400 text-sm">{post.date}</span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-400 text-sm">{post.readTime}</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3 leading-snug">{post.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{post.excerpt}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Subscribe */}
      <section
        className="py-20 px-6"
        style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0" }}
      >
        <div className="max-w-md mx-auto text-center">
          <h2
            className="font-bold text-gray-900 tracking-tight mb-3"
            style={{ fontSize: 26 }}
          >
            Get new posts in your inbox.
          </h2>
          <p className="text-gray-500 text-sm mb-8">No spam. Unsubscribe any time.</p>

          {subscribed ? (
            <p className="text-[#16a34a] font-medium">You are subscribed.</p>
          ) : (
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="flex-1 border border-gray-200 rounded-full px-5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#16a34a] transition-colors"
              />
              <button
                type="submit"
                className="bg-[#16a34a] text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-[#15803d] transition-colors shrink-0"
              >
                Subscribe
              </button>
            </form>
          )}
        </div>
      </section>

    </div>
  );
}
