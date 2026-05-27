"use client";
import { useState } from "react";
import Link from "next/link";

const FEATURED = {
  title: "Why 95% of enterprise AI pilots fail to reach production",
  excerpt: "MIT's 2026 study confirmed what most AI engineers already know: the gap between prototype and production is not a model problem. It is a tooling and governance problem. Here is what that means for teams building AI systems today.",
  tag: "Engineering",
  date: "May 2026",
};

const POSTS = [
  {
    title: "The EU AI Act is now enforceable. Is your AI stack ready?",
    excerpt: "Enforcement began in May 2026. Most companies operating high-risk AI systems are not ready. Here is what the Act actually requires and what Ryva does to help you meet it.",
    tag: "Compliance",
    date: "May 2026",
  },
  {
    title: "What tamper-evident audit logs actually mean for AI governance",
    excerpt: "HMAC signatures on lineage records sound like security theater until your legal team needs to prove to an auditor that no AI output was altered after the fact. Here is how the math works.",
    tag: "Security",
    date: "May 2026",
  },
  {
    title: "Fuzz testing your LLM agent: what we found after 15 categories",
    excerpt: "We ran 15 fuzz input categories against four different production agents. The results showed patterns in failure modes that schema tests and regression baselines completely miss.",
    tag: "Testing",
    date: "April 2026",
  },
  {
    title: "RAG pipeline testing: why word overlap is not enough",
    excerpt: "Checking whether a RAG answer overlaps with retrieved documents tells you almost nothing about faithfulness. Here is what Ryva's RAG test type actually measures and why it matters.",
    tag: "Engineering",
    date: "April 2026",
  },
];

const TAG_COLORS: Record<string, string> = {
  Engineering:  "bg-blue-50 text-blue-700 border-blue-200",
  Compliance:   "bg-purple-50 text-purple-700 border-purple-200",
  Security:     "bg-yellow-50 text-yellow-700 border-yellow-200",
  Testing:      "bg-green-50 text-[#16a34a] border-green-200",
};

export default function BlogPage() {
  const [email, setEmail]       = useState("");
  const [subscribed, setSubscribed] = useState(false);

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setSubscribed(true);
  }

  return (
    <div className="bg-white text-gray-900">

      {/* Hero */}
      <section className="text-center px-6 py-20" style={{ borderBottom: "1px solid #f0f0f0" }}>
        <div className="max-w-2xl mx-auto">
          <h1 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(32px,5vw,48px)" }}>
            From the Ryva team.
          </h1>
          <p className="text-gray-500" style={{ fontSize: 18, lineHeight: 1.6 }}>
            Engineering insights on AI governance, observability, and production AI.
          </p>
        </div>
      </section>

      {/* Featured post */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="border border-gray-200 rounded-2xl p-10 hover:border-gray-300 transition-colors">
            <div className="flex items-center gap-3 mb-5">
              <span className={`text-xs font-semibold border rounded-full px-3 py-1 ${TAG_COLORS[FEATURED.tag]}`}>
                {FEATURED.tag}
              </span>
              <span className="text-gray-400 text-sm">{FEATURED.date}</span>
            </div>
            <h2 className="font-bold text-gray-900 tracking-tight mb-4" style={{ fontSize: "clamp(22px,3vw,32px)", lineHeight: 1.25 }}>
              {FEATURED.title}
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6 max-w-2xl">
              {FEATURED.excerpt}
            </p>
            <Link href="#" className="text-[#16a34a] text-sm font-medium hover:underline">
              Read post
            </Link>
          </div>
        </div>
      </section>

      {/* Post grid */}
      <section className="px-6 pb-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          {POSTS.map((post) => (
            <div key={post.title} className="border border-gray-200 rounded-xl p-7 hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-xs font-semibold border rounded-full px-3 py-1 ${TAG_COLORS[post.tag]}`}>
                  {post.tag}
                </span>
                <span className="text-gray-400 text-sm">{post.date}</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3 leading-snug" style={{ fontSize: 16 }}>
                {post.title}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                {post.excerpt}
              </p>
              <Link href="#" className="text-[#16a34a] text-sm font-medium hover:underline">
                Read post
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Subscribe */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0" }} className="py-20 px-6">
        <div className="max-w-md mx-auto text-center">
          <h2 className="font-bold text-gray-900 tracking-tight mb-3" style={{ fontSize: 26 }}>
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
                className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-gray-700 transition-colors shrink-0"
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
