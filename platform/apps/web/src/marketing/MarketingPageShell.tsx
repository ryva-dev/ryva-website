import { useEffect } from "react";
import { Link } from "react-router-dom";

export function MarketingPageShell({
  title,
  lede,
  cta
}: {
  title: string;
  lede: string;
  cta?: { to: string; label: string };
}) {
  useEffect(() => {
    document.title = `${title} · Ryva`;
  }, [title]);

  return (
    <article className="ry-mkt-shell-page ry-mkt-reveal">
      <h1 className="ry-mkt-title">{title}</h1>
      <p className="ry-mkt-lede">{lede}</p>
      <div className="ry-mkt-cta-row">
        {cta ? (
          <Link className="ry-mkt-btn ry-mkt-btn-primary" to={cta.to}>
            {cta.label}
          </Link>
        ) : null}
        <Link className="ry-mkt-btn ry-mkt-btn-secondary" to="/">
          Back to home
        </Link>
      </div>
    </article>
  );
}
