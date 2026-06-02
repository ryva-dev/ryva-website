"use client";
import { useState } from "react";
import Link from "next/link";

const TAG_COLORS: Record<string, string> = {
  Compliance: "background:#dcfce7;color:#16a34a",
  Governance: "background:#dbeafe;color:#1d4ed8",
  Testing:    "background:#f3e8ff;color:#7c3aed",
  Security:   "background:#fef9c3;color:#92400e",
};

const POSTS = [
  {
    slug: "colorado-ai-act-june-2026",
    tag: "Compliance",
    date: "May 28 2026",
    readTime: "7 min",
    title: "The Colorado AI Act takes effect June 1, 2026. Here is what your engineering team needs to do.",
    excerpt: "The first comprehensive state AI law in the US takes effect June 1. Here is a practical checklist covering who it applies to, what it requires, and how to document compliance.",
    featured: true,
  },
  {
    slug: "eu-ai-act-articles-9-15",
    tag: "Compliance",
    date: "May 20 2026",
    readTime: "9 min",
    title: "EU AI Act Articles 9-15: what they actually require and how to prove compliance",
    excerpt: "Most explainers focus on the big picture. This one focuses on what each article actually requires — and what evidence you need to produce to demonstrate it.",
    featured: false,
  },
  {
    slug: "fuzz-testing-llm-agents",
    tag: "Testing",
    date: "May 12 2026",
    readTime: "6 min",
    title: "We fuzz tested 15 categories of bad inputs against our LLM agents. Here is what we found.",
    excerpt: "We built 15 fuzz test categories into Ryva and ran them against a production summarization agent. The results were instructive.",
    featured: false,
  },
];

function tagStyle(tag: string): React.CSSProperties {
  const s = TAG_COLORS[tag] || "background:#f1f5f9;color:#475569";
  const parts: Record<string, string> = {};
  s.split(";").forEach((p) => {
    const [k, v] = p.split(":");
    if (k && v) parts[k.trim()] = v.trim();
  });
  return parts as React.CSSProperties;
}

export default function BlogPage() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setSubscribed(true);
  }

  const featured = POSTS.find((p) => p.featured);
  const rest = POSTS.filter((p) => !p.featured);

  return (
    <div style={{ background: "#ffffff" }}>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "80px 24px 64px", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h1 style={{ fontSize: 48, fontWeight: 700, color: "#0f172a", margin: 0, lineHeight: 1.15 }}>From the Ryva team.</h1>
          <p style={{ fontSize: 18, color: "#64748b", marginTop: 16, lineHeight: 1.6, marginBottom: 0 }}>
            Insights on AI governance, compliance, and production AI engineering.
          </p>
        </div>
      </section>

      {/* Featured post */}
      {featured && (
        <section style={{ padding: "48px 24px 0" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <Link
              href={`/blog/${featured.slug}`}
              style={{ display: "block", background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", borderLeft: "3px solid #16a34a", padding: 32, textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 4, ...tagStyle(featured.tag) }}>
                  {featured.tag}
                </span>
                <span style={{ fontSize: 14, color: "#94a3b8" }}>{featured.date}</span>
                <span style={{ color: "#e2e8f0" }}>|</span>
                <span style={{ fontSize: 14, color: "#94a3b8" }}>{featured.readTime} read</span>
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0, lineHeight: 1.25 }}>{featured.title}</h2>
              <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.65, marginTop: 12, marginBottom: 16, maxWidth: 640 }}>{featured.excerpt}</p>
              <span style={{ fontSize: 14, color: "#16a34a", fontWeight: 500 }}>Read post →</span>
            </Link>
          </div>
        </section>
      )}

      {/* Other posts */}
      <section style={{ padding: "32px 24px 80px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div className="grid md:grid-cols-2 gap-6">
            {rest.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{ display: "block", background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 24, textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 4, ...tagStyle(post.tag) }}>
                    {post.tag}
                  </span>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>{post.date}</span>
                  <span style={{ color: "#e2e8f0" }}>|</span>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>{post.readTime} read</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", margin: 0, lineHeight: 1.35 }}>{post.title}</h3>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginTop: 8, marginBottom: 12 }}>{post.excerpt}</p>
                <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 500 }}>Read post →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Subscribe */}
      <section style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0", padding: "64px 24px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0 }}>Get new posts in your inbox.</h2>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 8, marginBottom: 24 }}>No spam. Unsubscribe any time.</p>
          {subscribed ? (
            <p style={{ color: "#16a34a", fontWeight: 500 }}>You are subscribed.</p>
          ) : (
            <form onSubmit={handleSubscribe} style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 16px", fontSize: 14, outline: "none", color: "#0f172a" }}
              />
              <button
                type="submit"
                style={{ background: "#16a34a", color: "#ffffff", fontSize: 14, fontWeight: 500, padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", flexShrink: 0 }}
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
