import { PUBLIC_SEO_ROUTES } from "../seo/routes.js";

const META_SCRIPT_ID = "ryva-meta-pixel-script";
const TIKTOK_SCRIPT_ID = "ryva-tiktok-pixel-script";
const META_PIXEL_ID_PATTERN = /^\d{8,20}$/;
const TIKTOK_PIXEL_ID_PATTERN = /^[A-Z0-9]{10,32}$/;

type MetaPixelFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: MetaPixelFunction;
};

type TikTokInstance = unknown[] & { _u?: string };

type TikTokQueue = unknown[][] & {
  _i?: Record<string, TikTokInstance>;
  _o?: Record<string, Record<string, unknown>>;
  _t?: Record<string, number>;
  methods?: string[];
  page?: (...args: unknown[]) => void;
  grantConsent?: (...args: unknown[]) => void;
  revokeConsent?: (...args: unknown[]) => void;
  instance?: (pixelId: string) => TikTokInstance;
  setAndDefer?: (target: TikTokQueue, method: string) => void;
};

export type AdvertisingPixelsRuntime = {
  fbq?: MetaPixelFunction;
  _fbq?: MetaPixelFunction;
  ttq?: TikTokQueue;
  TiktokAnalyticsObject?: string;
  __ryvaMetaPixelId?: string;
  __ryvaMetaLastPath?: string;
  __ryvaTikTokPixelId?: string;
  __ryvaTikTokLastPath?: string;
  __ryvaAdvertisingConsent?: "granted" | "denied";
};

export type AdvertisingPixelsEnvironment = {
  runtime: AdvertisingPixelsRuntime;
  hasScript(id: string): boolean;
  appendScript(input: { id: string; src: string }): void;
  now(): number;
};

export function normalizeMetaPixelId(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && META_PIXEL_ID_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeTikTokPixelId(value: string | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && TIKTOK_PIXEL_ID_PATTERN.test(normalized) ? normalized : null;
}

export function applyAdvertisingConsent(
  granted: boolean,
  environment: AdvertisingPixelsEnvironment
): void {
  const { runtime } = environment;
  const nextState = granted ? "granted" : "denied";
  if (runtime.__ryvaAdvertisingConsent === nextState) return;
  runtime.__ryvaAdvertisingConsent = nextState;
  if (runtime.__ryvaMetaPixelId && runtime.fbq) {
    runtime.fbq("consent", granted ? "grant" : "revoke");
  }
  if (runtime.__ryvaTikTokPixelId && runtime.ttq) {
    const consentMethod = granted ? runtime.ttq.grantConsent : runtime.ttq.revokeConsent;
    consentMethod?.();
  }
}

export function initializeMetaPixel(
  pixelId: string | null,
  environment: AdvertisingPixelsEnvironment
): boolean {
  if (!pixelId) return false;
  const { runtime } = environment;
  if (runtime.__ryvaMetaPixelId === pixelId) return true;

  if (!runtime.fbq) {
    const fbq: MetaPixelFunction = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue!.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    runtime.fbq = fbq;
    runtime._fbq = fbq;
  }

  if (!environment.hasScript(META_SCRIPT_ID)) {
    environment.appendScript({
      id: META_SCRIPT_ID,
      src: "https://connect.facebook.net/en_US/fbevents.js"
    });
  }

  // Advanced Matching stays off: the init call contains only the public pixel ID.
  runtime.fbq("init", pixelId);
  runtime.__ryvaMetaPixelId = pixelId;
  return true;
}

export function trackMetaPublicPageView(
  pixelId: string | null,
  pathname: string,
  environment: AdvertisingPixelsEnvironment
): boolean {
  const { runtime } = environment;
  if (!PUBLIC_SEO_ROUTES[pathname]) {
    delete runtime.__ryvaMetaLastPath;
    return false;
  }
  if (!pixelId || runtime.__ryvaMetaLastPath === pathname) return false;
  if (!initializeMetaPixel(pixelId, environment) || !runtime.fbq) return false;

  runtime.fbq("track", "PageView");
  runtime.__ryvaMetaLastPath = pathname;
  return true;
}

export function initializeTikTokPixel(
  pixelId: string | null,
  environment: AdvertisingPixelsEnvironment
): boolean {
  if (!pixelId) return false;
  const { runtime } = environment;
  if (runtime.__ryvaTikTokPixelId === pixelId) return true;

  runtime.TiktokAnalyticsObject = "ttq";
  const ttq = (runtime.ttq ??= [] as unknown as TikTokQueue);
  ttq.methods ??= [
    "page", "track", "identify", "instances", "debug", "on", "off", "once", "ready",
    "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"
  ];
  ttq.setAndDefer ??= (target, method) => {
    const methodTarget = target as unknown as Record<string, unknown>;
    if (typeof methodTarget[method] !== "function") {
      methodTarget[method] = (...args: unknown[]) => target.push([method, ...args]);
    }
  };
  for (const method of ttq.methods) ttq.setAndDefer(ttq, method);
  const instances = (ttq._i ??= {});
  const pixelInstance = (instances[pixelId] ??= [] as unknown as TikTokInstance);
  pixelInstance._u = "https://analytics.tiktok.com/i18n/pixel/events.js";
  ttq.instance ??= (instancePixelId) => {
    const instance = (instances[instancePixelId] ??= [] as unknown as TikTokInstance);
    for (const method of ttq.methods ?? []) ttq.setAndDefer?.(instance as unknown as TikTokQueue, method);
    return instance;
  };
  ttq._o ??= {};
  // TikTok enables SPA URL-change pageviews by default. Ryva owns route filtering,
  // so disable that observer and emit only approved public-route page() calls.
  ttq._o[pixelId] = { historyObserver: false };
  ttq._t ??= {};
  ttq._t[pixelId] = environment.now();

  if (!environment.hasScript(TIKTOK_SCRIPT_ID)) {
    environment.appendScript({
      id: TIKTOK_SCRIPT_ID,
      src: `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(pixelId)}&lib=ttq`
    });
  }

  runtime.__ryvaTikTokPixelId = pixelId;
  return true;
}

export function trackTikTokPublicPageView(
  pixelId: string | null,
  pathname: string,
  environment: AdvertisingPixelsEnvironment
): boolean {
  const { runtime } = environment;
  if (!PUBLIC_SEO_ROUTES[pathname]) {
    delete runtime.__ryvaTikTokLastPath;
    return false;
  }
  if (!pixelId || runtime.__ryvaTikTokLastPath === pathname) return false;
  if (!initializeTikTokPixel(pixelId, environment) || !runtime.ttq?.page) return false;

  // Page only: do not call identify, track, or pass user/content properties.
  runtime.ttq.page();
  runtime.__ryvaTikTokLastPath = pathname;
  return true;
}
