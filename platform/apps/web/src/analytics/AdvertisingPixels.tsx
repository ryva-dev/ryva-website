import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PUBLIC_SEO_ROUTES } from "../seo/routes";
import {
  applyAdvertisingConsent,
  normalizeMetaPixelId,
  normalizeTikTokPixelId,
  trackMetaPublicPageView,
  trackTikTokPublicPageView,
  type AdvertisingPixelsEnvironment
} from "./advertisingPixelsCore";

const CONSENT_STORAGE_KEY = "ryva.optional-advertising-measurement.v1";
type ConsentState = "granted" | "denied" | "undecided";

const advertisingEnvironment: AdvertisingPixelsEnvironment = {
  runtime: window as unknown as AdvertisingPixelsEnvironment["runtime"],
  hasScript: (id) => Boolean(document.getElementById(id)),
  appendScript: ({ id, src }) => {
    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.src = src;
    document.head.append(script);
  },
  now: () => Date.now()
};

function readConsent(): ConsentState {
  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return stored === "granted" || stored === "denied" ? stored : "undecided";
  } catch {
    return "undecided";
  }
}

function saveConsent(value: Exclude<ConsentState, "undecided">): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch {
    // Storage may be unavailable; the in-memory choice still controls this visit.
  }
}

export function AdvertisingPixels() {
  const location = useLocation();
  const [consent, setConsent] = useState<ConsentState>(readConsent);
  const metaValue: unknown = import.meta.env.VITE_META_PIXEL_ID;
  const tikTokValue: unknown = import.meta.env.VITE_TIKTOK_PIXEL_ID;
  const metaPixelId = normalizeMetaPixelId(typeof metaValue === "string" ? metaValue : undefined);
  const tikTokPixelId = normalizeTikTokPixelId(typeof tikTokValue === "string" ? tikTokValue : undefined);
  const isApprovedPublicRoute = Boolean(PUBLIC_SEO_ROUTES[location.pathname]);
  const hasConfiguredPixel = Boolean(metaPixelId || tikTokPixelId);

  useEffect(() => {
    if (consent !== "granted") return;
    applyAdvertisingConsent(isApprovedPublicRoute, advertisingEnvironment);
    trackMetaPublicPageView(metaPixelId, location.pathname, advertisingEnvironment);
    trackTikTokPublicPageView(tikTokPixelId, location.pathname, advertisingEnvironment);
  }, [consent, isApprovedPublicRoute, location.pathname, metaPixelId, tikTokPixelId]);

  useEffect(() => {
    if (consent !== "granted" || !hasConfiguredPixel) return;

    const preservePrivateRouteBoundary = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || PUBLIC_SEO_ROUTES[destination.pathname]) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign(destination.href);
    };

    document.addEventListener("click", preservePrivateRouteBoundary, true);
    return () => document.removeEventListener("click", preservePrivateRouteBoundary, true);
  }, [consent, hasConfiguredPixel]);

  if (!hasConfiguredPixel || !isApprovedPublicRoute) return null;

  const decide = (value: "granted" | "denied") => {
    saveConsent(value);
    applyAdvertisingConsent(value === "granted", advertisingEnvironment);
    setConsent(value);
  };

  if (consent !== "undecided") {
    return (
      <button type="button" className="ry-ad-privacy-choices" onClick={() => setConsent("undecided")}>
        Privacy choices
      </button>
    );
  }

  return (
    <aside className="ry-ad-consent" aria-label="Optional advertising measurement">
      <div>
        <strong>Optional measurement</strong>
        <p>
          Allow optional public-page measurement from Meta and TikTok to help Ryva understand its advertising. No account, form, Program, or workspace content is sent. See our <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </div>
      <div className="ry-ad-consent-actions">
        <button type="button" className="ry-mkt-btn ry-mkt-btn-secondary" onClick={() => decide("denied")}>Decline</button>
        <button type="button" className="ry-mkt-btn ry-mkt-btn-primary" onClick={() => decide("granted")}>Allow measurement</button>
      </div>
    </aside>
  );
}
