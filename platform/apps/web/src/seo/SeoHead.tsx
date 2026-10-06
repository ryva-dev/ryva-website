import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ORIGIN = "https://www.ryvaforge.com";
const HOME_TITLE = "Ryva | Brand Placement & Wholesale Industry Education";
const HOME_DESCRIPTION = "Learn how brand placement, wholesale sales, retail buyers, and brand-to-retailer commercial relationships work through The Ryva Program.";

type PublicSeoRoute = {
  title: string;
  description: string;
};

const PUBLIC_SEO_ROUTES: Record<string, PublicSeoRoute> = {
  "/": {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION
  },
  "/the-program": {
    title: "The Ryva Program | Brand Placement Education",
    description: "Explore independent education and guided practice covering brand placement, wholesale fundamentals, retail buyers, orders, accounts, and commissions."
  },
  "/how-it-works": {
    title: "How The Ryva Program Works | Ryva",
    description: "See how Ryva combines concise industry lessons, commercial context, guided exercises, and realistic brand placement scenarios."
  },
  "/curriculum": {
    title: "Brand Placement Curriculum | Ryva",
    description: "Review eight modules covering products, assortment, retail buyers, placement strategy, wholesale orders, account development, and commissions."
  },
  "/faq": {
    title: "The Ryva Program FAQ | Ryva",
    description: "Answers about The Ryva Program, guided practice, access, completion, and its independent educational purpose."
  },
  "/terms": {
    title: "Terms of Service | Ryva",
    description: "Terms governing access to and use of the Ryva website, The Ryva Program, Ryva Pro, and related services."
  },
  "/privacy": {
    title: "Privacy Policy | Ryva",
    description: "How Ryva Forge, LLC collects, uses, discloses, and protects personal information."
  },
  "/refund-policy": {
    title: "Refund & Cancellation Policy | Ryva",
    description: "The refund and cancellation terms for The Ryva Program and Ryva Pro."
  },
  "/disclaimer": {
    title: "Educational & Commercial Disclaimer | Ryva",
    description: "Important educational, commercial, and outcomes disclaimers for The Ryva Program and Ryva services."
  }
};

function setMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

function setCanonical(href: string | null) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.append(element);
  }
  element.href = href;
}

export function SeoHead() {
  const location = useLocation();

  useEffect(() => {
    const route = PUBLIC_SEO_ROUTES[location.pathname];
    if (!route) {
      setMeta('meta[name="robots"]', "name", "robots", "noindex, nofollow, noarchive");
      setCanonical(null);
      return;
    }

    const canonical = `${ORIGIN}${location.pathname === "/" ? "/" : location.pathname}`;
    document.title = route.title;
    setMeta('meta[name="description"]', "name", "description", route.description);
    setMeta('meta[name="robots"]', "name", "robots", "index, follow");
    setMeta('meta[property="og:title"]', "property", "og:title", route.title);
    setMeta('meta[property="og:description"]', "property", "og:description", route.description);
    setMeta('meta[property="og:url"]', "property", "og:url", canonical);
    setMeta('meta[property="og:type"]', "property", "og:type", "website");
    setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary");
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", route.title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", route.description);
    setCanonical(canonical);
  }, [location.pathname]);

  return null;
}

export { HOME_DESCRIPTION, HOME_TITLE, PUBLIC_SEO_ROUTES };
