import { Link } from "react-router-dom";

const links = [
  { to: "/the-program", label: "The Program" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/curriculum", label: "Curriculum" },
  { to: "/faq", label: "FAQ" },
  { to: "/login", label: "Sign In" },
  { to: "/signup", label: "Join Ryva" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/refund-policy", label: "Refund Policy" },
  { to: "/disclaimer", label: "Disclaimer" }
] as const;

export function MarketingFooter() {
  return (
    <footer className="ry-mkt-footer">
      <div className="ry-mkt-footer-inner">
        <Link to="/" className="ry-mkt-footer-brand">
          ryva
        </Link>
        <nav className="ry-mkt-footer-nav" aria-label="Footer">
          {links.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="ry-mkt-footer-legal">
          © 2026 Ryva Forge, LLC. Ryva is an independent educational and software platform.
        </p>
      </div>
    </footer>
  );
}
