import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import "./marketing.css";

export function MarketingLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="ry-mkt">
      <a className="ry-mkt-skip" href="#main-content">
        Skip to content
      </a>
      <MarketingHeader />
      <main id="main-content" className="ry-mkt-main">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
}
