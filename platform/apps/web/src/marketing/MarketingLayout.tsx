import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { PUBLIC_SEO_ROUTES } from "../seo/routes";
import "./marketing.css";

export function MarketingLayout() {
  const location = useLocation();
  const isPublicAnalyticsRoute = Boolean(PUBLIC_SEO_ROUTES[location.pathname]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="ry-mkt">
      <a className="ry-mkt-skip" href="#main-content">
        Skip to content
      </a>
      <MarketingHeader />
      <main
        id="main-content"
        className="ry-mkt-main"
        data-clarity-mask={isPublicAnalyticsRoute ? undefined : "true"}
      >
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
}
