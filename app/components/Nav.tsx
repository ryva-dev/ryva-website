"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 bg-white/95 transition-all duration-200 ${
        scrolled ? "backdrop-blur-md shadow-sm" : ""
      }`}
      style={{ borderBottom: "1px solid #f0f0f0" }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-mono font-bold text-[#16a34a] shrink-0"
          style={{ fontSize: 20, fontFamily: "var(--font-geist-mono)" }}
        >
          {`{ryva}`}
        </Link>

        <div className="hidden md:flex items-center gap-1">
          <Link href="/product" className="text-gray-600 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">Product</Link>
          <Link href="/pricing" className="text-gray-600 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">Pricing</Link>
          <Link href="/enterprise" className="text-gray-600 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">Enterprise</Link>
          <Link href="/blog" className="text-gray-600 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">Blog</Link>
          <Link href="/company" className="text-gray-600 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">Company</Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="https://ryva-dashboard.vercel.app"
            className="text-gray-500 hover:text-gray-900 text-sm transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="https://github.com/ryva-dev/ryva"
            className="bg-gray-900 text-white text-sm font-medium px-4 py-1.5 rounded-md hover:bg-gray-700 transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
