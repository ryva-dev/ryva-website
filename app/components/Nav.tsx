"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 bg-white transition-shadow duration-200 ${
        scrolled ? "shadow-sm" : ""
      }`}
      style={{ borderBottom: "1px solid #f3f4f6" }}
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <img src="/logo.png" height={32} alt="Ryva" style={{ height: 32 }} />
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          <Link
            href="/product"
            className="text-gray-600 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
          >
            Product
          </Link>
          <Link
            href="/pricing"
            className="text-gray-600 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/enterprise"
            className="text-gray-600 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
          >
            Enterprise
          </Link>
          <Link
            href="/blog"
            className="text-gray-600 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
          >
            Blog
          </Link>
          <Link
            href="/company"
            className="text-gray-600 hover:text-gray-900 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
          >
            Company
          </Link>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          <a
            href="https://ryva-dashboard.vercel.app/login"
            className="hidden md:inline text-gray-500 hover:text-gray-900 text-sm transition-colors"
          >
            Sign in
          </a>
          <a
            href="https://calendly.com/aball-ryvaforge/ryva-demo"
            className="bg-[#16a34a] text-white px-6 py-3 rounded-full font-medium text-sm hover:bg-[#15803d] transition-colors"
          >
            Book a demo
          </a>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-1">
          <Link
            href="/product"
            onClick={() => setMobileOpen(false)}
            className="text-gray-700 hover:text-gray-900 text-sm py-2 px-3 rounded-md hover:bg-gray-50 transition-colors"
          >
            Product
          </Link>
          <Link
            href="/pricing"
            onClick={() => setMobileOpen(false)}
            className="text-gray-700 hover:text-gray-900 text-sm py-2 px-3 rounded-md hover:bg-gray-50 transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/enterprise"
            onClick={() => setMobileOpen(false)}
            className="text-gray-700 hover:text-gray-900 text-sm py-2 px-3 rounded-md hover:bg-gray-50 transition-colors"
          >
            Enterprise
          </Link>
          <Link
            href="/blog"
            onClick={() => setMobileOpen(false)}
            className="text-gray-700 hover:text-gray-900 text-sm py-2 px-3 rounded-md hover:bg-gray-50 transition-colors"
          >
            Blog
          </Link>
          <Link
            href="/company"
            onClick={() => setMobileOpen(false)}
            className="text-gray-700 hover:text-gray-900 text-sm py-2 px-3 rounded-md hover:bg-gray-50 transition-colors"
          >
            Company
          </Link>
          <a
            href="https://ryva-dashboard.vercel.app/login"
            className="text-gray-700 hover:text-gray-900 text-sm py-2 px-3 rounded-md hover:bg-gray-50 transition-colors"
          >
            Sign in
          </a>
        </div>
      )}
    </nav>
  );
}
