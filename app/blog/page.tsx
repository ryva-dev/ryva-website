"use client";
import { useState } from "react";

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

      {/* Coming soon */}
      <section className="px-6 py-32 text-center">
        <div className="max-w-lg mx-auto">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-4">Coming soon</p>
          <p className="text-gray-500 leading-relaxed">
            Posts are in progress. Subscribe below to get notified when the first ones publish.
          </p>
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
                className="flex-1 border border-gray-200 rounded-lg px-5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#16a34a] transition-colors"
              />
              <button
                type="submit"
                className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-md hover:bg-gray-700 transition-colors shrink-0"
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
