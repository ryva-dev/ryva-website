import { useEffect, useId, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { APP_BASE } from "../appBase";
import { useAuth } from "../auth";

const navItems = [
  { to: "/the-program", label: "The Program" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/curriculum", label: "Curriculum" },
  { to: "/faq", label: "FAQ" }
] as const;

export function MarketingHeader() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const signedIn = Boolean(session);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="ry-mkt-header">
      <div className="ry-mkt-header-inner">
        <Link to="/" className="ry-mkt-wordmark">
          ryva
        </Link>

        <nav className="ry-mkt-nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ry-mkt-header-actions">
          {!loading && signedIn ? (
            <Link className="ry-mkt-btn ry-mkt-btn-primary" to={APP_BASE}>
              Open Ryva
            </Link>
          ) : (
            <>
              <Link className="ry-mkt-link-quiet" to="/login">
                Sign In
              </Link>
              <Link className="ry-mkt-btn ry-mkt-btn-primary" to="/signup">
                Join Ryva
              </Link>
            </>
          )}
          <button
            type="button"
            className="ry-mkt-menu-toggle"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((current) => !current)}
          >
            <span aria-hidden="true" />
          </button>
        </div>
      </div>

      <nav id={menuId} className={`ry-mkt-mobile-nav${open ? " is-open" : ""}`} aria-label="Mobile">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
        {!loading && !signedIn ? <NavLink to="/login">Sign In</NavLink> : null}
        {!loading && signedIn ? <NavLink to={APP_BASE}>Open Ryva</NavLink> : null}
      </nav>
    </header>
  );
}
