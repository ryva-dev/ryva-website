import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PUBLIC_ORIGIN, PUBLIC_SEO_ROUTES } from "./routes";

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

    const canonical = `${PUBLIC_ORIGIN}${location.pathname === "/" ? "/" : location.pathname}`;
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
