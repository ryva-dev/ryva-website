"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type DropdownName = "Product" | "Solutions" | "Customers" | "Resources";

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ display: "inline", marginLeft: 3 }}>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M3 8l3.5 3.5L13 5" stroke="#16a34a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={d} stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProductDropdown() {
  return (
    <div style={{ width: 720 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 200px", gap: 24 }}>
        {/* Col 1 */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Capabilities</p>
          {[
            { icon: "M2 8h12M8 2l6 6-6 6", title: "Testing & Validation", desc: "9 test types including fuzz, adversarial, and hallucination detection", href: "/product#testing" },
            { icon: "M2 4l4 4-4 4M8 12h6", title: "Lineage & Tracing", desc: "Full chain of custody on every AI decision, cryptographically signed", href: "/product#lineage" },
            { icon: "M8 2l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 11l-4 2.5 1.5-4.5L2 6.5h4.5z", title: "Governance & Compliance", desc: "EU AI Act and Colorado AI Act coverage out of the box", href: "/product#governance" },
            { icon: "M2 12V4m4 8V7m4 5V5m4 7V2", title: "Observability", desc: "Latency, cost, and error rate across all agents in real time", href: "/product#observability" },
            { icon: "M2 10h3l2-6 3 9 2-5 2 2h2", title: "Cost Intelligence", desc: "Per-agent spend tracking, forecasting, and model comparison", href: "/product#cost" },
          ].map((item) => (
            <Link key={item.title} href={item.href} style={{ display: "flex", gap: 12, padding: "8px", borderRadius: 8, marginBottom: 4, textDecoration: "none" }}
              className="nav-item-hover">
              <NavIcon d={item.icon} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>{item.title}</p>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 1.4, margin: 0 }}>{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
        {/* Col 2 */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Platform</p>
          {[
            { title: "Ryva CLI", desc: "Open source. Free forever.", href: "/get-started" },
            { title: "Ryva Cloud", desc: "Shared dashboards and compliance exports", href: "/get-started" },
            { title: "Audit Export", desc: "One command. Everything regulators need.", href: "/product#governance" },
            { title: "Model Cards", desc: "Auto-generated documentation for every AI system", href: "/product#governance" },
            { title: "Enterprise", desc: "Air-gap, SAML, dedicated support", href: "/enterprise" },
          ].map((item) => (
            <Link key={item.title} href={item.href} style={{ display: "flex", gap: 12, padding: "8px", borderRadius: 8, marginBottom: 4, textDecoration: "none" }}
              className="nav-item-hover">
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>{item.title}</p>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 1.4, margin: 0 }}>{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
        {/* Col 3 — Featured */}
        <div>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", margin: 0 }}>NEW</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginTop: 4, marginBottom: 0 }}>Colorado AI Act SB 24-205</p>
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 8, lineHeight: 1.5, marginBottom: 0 }}>Effective June 1, 2026. Impact assessments, audit trails, and consumer notice — built in.</p>
            <Link href="/enterprise" style={{ fontSize: 12, color: "#16a34a", fontWeight: 500, marginTop: 12, display: "block", textDecoration: "none" }}>See what&apos;s covered →</Link>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 16, paddingTop: 16 }}>
        <Link href="/demo" style={{ fontSize: 14, color: "#475569", textDecoration: "none" }}
          className="nav-bottom-hover">
          Talk to an engineer about your AI governance needs →
        </Link>
      </div>
    </div>
  );
}

function SolutionsDropdown() {
  return (
    <div style={{ width: 800 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>By Role</p>
          {[
            { title: "AI Engineering Teams", href: "/solutions" },
            { title: "Compliance & Legal", href: "/solutions" },
            { title: "Head of AI / VP Engineering", href: "/solutions" },
            { title: "CTO / CISO", href: "/enterprise" },
          ].map((item) => (
            <div key={item.title} style={{ marginBottom: 8 }}>
              <Link href={item.href} style={{ fontSize: 13, color: "#0f172a", textDecoration: "none", display: "block", padding: "4px 0" }}
                className="nav-role-hover">{item.title}</Link>
            </div>
          ))}
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>By Industry</p>
          {["Fintech", "Healthcare", "HR Tech", "Insurance", "Legal Tech"].map((item) => (
            <div key={item} style={{ marginBottom: 8 }}>
              <Link href="/solutions" style={{ fontSize: 13, color: "#0f172a", textDecoration: "none", display: "block", padding: "4px 0" }}
                className="nav-role-hover">{item}</Link>
            </div>
          ))}
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>By Regulation</p>
          {[
            { title: "EU AI Act", href: "/enterprise" },
            { title: "Colorado AI Act", href: "/enterprise" },
            { title: "GDPR / HIPAA", href: "/enterprise" },
            { title: "SOC 2", href: "/enterprise" },
          ].map((item) => (
            <div key={item.title} style={{ marginBottom: 8 }}>
              <Link href={item.href} style={{ fontSize: 13, color: "#0f172a", textDecoration: "none", display: "block", padding: "4px 0" }}
                className="nav-role-hover">{item.title}</Link>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 16, paddingTop: 16 }}>
        <Link href="/demo" style={{ fontSize: 14, color: "#475569", textDecoration: "none" }}
          className="nav-bottom-hover">
          Not sure where to start? Book a 30-minute scoping call →
        </Link>
      </div>
    </div>
  );
}

function CustomersDropdown() {
  return (
    <div style={{ width: 760 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 1fr", gap: 24 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>What Teams Are Saying</p>
          {[
            { emoji: "🏦", text: "A Series B fintech reduced compliance prep from 3 weeks to 4 hours." },
            { emoji: "🏥", text: "A healthcare AI startup passed their first EU AI Act assessment with zero engineering time on docs." },
            { emoji: "👥", text: "An HR tech platform generated model cards for 12 AI systems in a single afternoon." },
            { emoji: "⚖️", text: "A legal tech company gave their legal team real-time compliance visibility for the first time." },
          ].map((item, i) => (
            <Link key={i} href="/blog" style={{ display: "block", background: "#f8fafc", borderRadius: 8, padding: 12, marginBottom: 8, textDecoration: "none" }}
              className="nav-outcome-hover">
              <p style={{ fontSize: 13, color: "#0f172a", margin: 0 }}>{item.emoji} {item.text}</p>
              <p style={{ fontSize: 12, color: "#16a34a", marginTop: 4, marginBottom: 0 }}>Read story →</p>
            </Link>
          ))}
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>By Industry</p>
          {["Fintech", "Healthcare", "HR Tech", "Insurance", "Legal Tech", "Government"].map((item) => (
            <div key={item} style={{ marginBottom: 8 }}>
              <Link href="/solutions" style={{ fontSize: 13, color: "#0f172a", textDecoration: "none", display: "block", padding: "4px 0" }}
                className="nav-role-hover">{item}</Link>
            </div>
          ))}
        </div>
        <div style={{ borderLeft: "1px solid #f1f5f9", paddingLeft: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Proof Through Adoption</p>
          {[
            { value: "200+", label: "engineering teams" },
            { value: "1M+", label: "traces processed" },
            { value: "40+", label: "regulated industries" },
            { value: "94%", label: "avg test pass rate" },
          ].map((stat) => (
            <div key={stat.label} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>{stat.value}</p>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{stat.label}</p>
            </div>
          ))}
          <Link href="/blog" style={{ fontSize: 13, color: "#16a34a", textDecoration: "none" }}>View all case studies →</Link>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 16, paddingTop: 16 }}>
        <Link href="/get-started" style={{ fontSize: 14, color: "#475569", textDecoration: "none" }}
          className="nav-bottom-hover">
          Join 200+ teams governing AI in production →
        </Link>
      </div>
    </div>
  );
}

function ResourcesDropdown() {
  return (
    <div style={{ width: 760 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 220px", gap: 24 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Learn</p>
          {[
            { title: "Blog", href: "/blog" },
            { title: "EU AI Act Guide", href: "/blog/eu-ai-act-articles-9-15" },
            { title: "Colorado AI Act Checklist", href: "/blog/colorado-ai-act-june-2026" },
            { title: "Fuzz Testing Guide", href: "/blog/fuzz-testing-llm-agents" },
          ].map((item) => (
            <div key={item.title} style={{ marginBottom: 8 }}>
              <Link href={item.href} style={{ fontSize: 13, color: "#0f172a", textDecoration: "none", display: "block", padding: "4px 0" }}
                className="nav-role-hover">{item.title}</Link>
            </div>
          ))}
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Developers</p>
          {[
            { title: "Documentation", href: "/docs" },
            { title: "Changelog", href: "/changelog" },
            { title: "CLI Reference", href: "/docs" },
          ].map((item) => (
            <div key={item.title} style={{ marginBottom: 8 }}>
              <Link href={item.href} style={{ fontSize: 13, color: "#0f172a", textDecoration: "none", display: "block", padding: "4px 0" }}
                className="nav-role-hover">{item.title}</Link>
            </div>
          ))}
          <div style={{ marginBottom: 8 }}>
            <a href="https://github.com/ryva-dev/ryva" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: "#0f172a", textDecoration: "none", display: "block", padding: "4px 0" }}
              className="nav-role-hover">GitHub</a>
          </div>
          <div style={{ marginBottom: 8 }}>
            <a href="https://pypi.org/project/ryva" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: "#0f172a", textDecoration: "none", display: "block", padding: "4px 0" }}
              className="nav-role-hover">PyPI</a>
          </div>
        </div>
        <div>
          <div style={{ background: "#0f172a", borderRadius: 12, padding: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", margin: 0 }}>FREE GUIDE</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", marginTop: 4, marginBottom: 0 }}>AI Governance Readiness Report 2026</p>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8, lineHeight: 1.5, marginBottom: 0 }}>How 200+ engineering teams are preparing for EU AI Act and Colorado AI Act enforcement.</p>
            <Link href="/demo" style={{ display: "inline-block", marginTop: 12, background: "#16a34a", color: "#ffffff", borderRadius: 9999, padding: "8px 16px", fontSize: 13, textDecoration: "none" }}>Download free →</Link>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 16, paddingTop: 16 }}>
        <Link href="/blog/colorado-ai-act-june-2026" style={{ fontSize: 14, color: "#475569", textDecoration: "none" }}
          className="nav-bottom-hover">
          New: Colorado AI Act takes effect June 1, 2026. See what&apos;s required →
        </Link>
      </div>
    </div>
  );
}

const DROPDOWN_COMPONENTS: Record<DropdownName, React.ReactNode> = {
  Product: <ProductDropdown />,
  Solutions: <SolutionsDropdown />,
  Customers: <CustomersDropdown />,
  Resources: <ResourcesDropdown />,
};

const MOBILE_LINKS: Record<DropdownName, Array<{ title: string; href: string }>> = {
  Product: [
    { title: "Testing & Validation", href: "/product#testing" },
    { title: "Lineage & Tracing", href: "/product#lineage" },
    { title: "Governance & Compliance", href: "/product#governance" },
    { title: "Observability", href: "/product#observability" },
    { title: "Cost Intelligence", href: "/product#cost" },
    { title: "Enterprise", href: "/enterprise" },
  ],
  Solutions: [
    { title: "AI Engineering Teams", href: "/solutions" },
    { title: "Compliance & Legal", href: "/solutions" },
    { title: "Fintech", href: "/solutions" },
    { title: "Healthcare", href: "/solutions" },
    { title: "EU AI Act", href: "/enterprise" },
    { title: "Colorado AI Act", href: "/enterprise" },
  ],
  Customers: [
    { title: "Case Studies", href: "/blog" },
    { title: "Fintech", href: "/solutions" },
    { title: "Healthcare", href: "/solutions" },
    { title: "HR Tech", href: "/solutions" },
  ],
  Resources: [
    { title: "Blog", href: "/blog" },
    { title: "EU AI Act Guide", href: "/blog/eu-ai-act-articles-9-15" },
    { title: "Colorado AI Act Checklist", href: "/blog/colorado-ai-act-june-2026" },
    { title: "Documentation", href: "/docs" },
    { title: "Changelog", href: "/changelog" },
    { title: "GitHub", href: "https://github.com/ryva-dev/ryva" },
  ],
};

export default function Nav() {
  const [activeDropdown, setActiveDropdown] = useState<DropdownName | null>(null);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<DropdownName | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  function openDropdown(name: DropdownName) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (activeDropdown !== name) {
      setDropdownVisible(false);
      setActiveDropdown(name);
      setTimeout(() => setDropdownVisible(true), 10);
    } else {
      setDropdownVisible(true);
    }
  }

  function scheduleClose() {
    timeoutRef.current = setTimeout(() => {
      setDropdownVisible(false);
      setTimeout(() => setActiveDropdown(null), 150);
    }, 150);
  }

  function cancelClose() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setDropdownVisible(false);
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const DESKTOP_ITEMS: DropdownName[] = ["Product", "Solutions", "Customers", "Resources"];

  return (
    <>
      <style>{`
        .nav-item-hover:hover { background: #f8fafc !important; }
        .nav-bottom-hover:hover { color: #0f172a !important; }
        .nav-role-hover:hover { color: #16a34a !important; }
        .nav-outcome-hover:hover { background: #f1f5f9 !important; }
        .nav-dropdown-enter { opacity: 0; transform: translateY(-4px); }
        .nav-dropdown-visible { opacity: 1; transform: translateY(0); transition: opacity 150ms ease, transform 150ms ease; }
      `}</style>
      <nav
        ref={navRef}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#ffffff",
          borderBottom: "1px solid #f1f5f9",
          height: 60,
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <Link href="/" style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            <img src="/logo.png" alt="Ryva" style={{ height: 28 }} />
          </Link>

          {/* Desktop nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }} className="hidden md:flex">
            {DESKTOP_ITEMS.map((name) => (
              <button
                key={name}
                onMouseEnter={() => openDropdown(name)}
                onMouseLeave={scheduleClose}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: "6px 10px",
                  borderRadius: 6,
                  color: activeDropdown === name ? "#0f172a" : "#475569",
                  fontWeight: activeDropdown === name ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                {name}
                <ChevronDown />
              </button>
            ))}
            <Link
              href="/pricing"
              style={{ fontSize: 14, padding: "6px 10px", borderRadius: 6, color: "#475569", textDecoration: "none" }}
            >
              Pricing
            </Link>
          </div>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a
              href="https://ryva-dashboard.vercel.app/login"
              style={{ fontSize: 14, color: "#475569", textDecoration: "none", display: "none" }}
              className="hidden md:inline"
            >
              Sign in
            </a>
            <Link
              href="/demo"
              style={{
                background: "#0f172a",
                color: "#ffffff",
                borderRadius: 9999,
                padding: "8px 20px",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Book a demo
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#475569" }}
              className="md:hidden"
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

        {/* Desktop dropdown */}
        {activeDropdown && (
          <div
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className={dropdownVisible ? "nav-dropdown-visible" : "nav-dropdown-enter"}
            style={{
              position: "absolute",
              top: 60,
              left: "50%",
              transform: dropdownVisible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-4px)",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
              zIndex: 50,
              padding: 24,
              transition: "opacity 150ms ease, transform 150ms ease",
              opacity: dropdownVisible ? 1 : 0,
            }}
          >
            {DROPDOWN_COMPONENTS[activeDropdown]}
          </div>
        )}

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{ background: "#ffffff", borderTop: "1px solid #f1f5f9", padding: "12px 16px" }} className="md:hidden">
            {DESKTOP_ITEMS.map((name) => (
              <div key={name}>
                <button
                  onClick={() => setMobileExpanded(mobileExpanded === name ? null : name)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "#0f172a",
                    fontWeight: 500,
                    padding: "10px 12px",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  {name}
                  <ChevronDown />
                </button>
                {mobileExpanded === name && (
                  <div style={{ paddingLeft: 16, paddingBottom: 8 }}>
                    {MOBILE_LINKS[name].map((link) => (
                      <Link
                        key={link.title}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        style={{ display: "block", fontSize: 13, color: "#475569", padding: "7px 12px", textDecoration: "none" }}
                      >
                        {link.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Link href="/pricing" onClick={() => setMobileOpen(false)}
              style={{ display: "block", fontSize: 14, color: "#0f172a", fontWeight: 500, padding: "10px 12px", textDecoration: "none" }}>
              Pricing
            </Link>
            <a href="https://ryva-dashboard.vercel.app/login"
              style={{ display: "block", fontSize: 14, color: "#475569", padding: "10px 12px", textDecoration: "none" }}>
              Sign in
            </a>
          </div>
        )}
      </nav>
    </>
  );
}
