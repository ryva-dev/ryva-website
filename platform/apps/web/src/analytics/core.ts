import { PUBLIC_ORIGIN, PUBLIC_SEO_ROUTES } from "../seo/routes.js";

const SCRIPT_ID = "ryva-ga4-script";
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

export type AnalyticsRuntime = {
  dataLayer?: Array<ArrayLike<unknown>>;
  gtag?: (...args: unknown[]) => void;
  __ryvaGa4MeasurementId?: string;
  __ryvaGa4LastPath?: string;
};

export type AnalyticsEnvironment = {
  runtime: AnalyticsRuntime;
  hasScript(id: string): boolean;
  appendScript(input: { id: string; src: string }): void;
};

export function normalizeMeasurementId(value: string | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && MEASUREMENT_ID_PATTERN.test(normalized) ? normalized : null;
}

export function initializeGoogleAnalytics(
  measurementId: string | null,
  environment: AnalyticsEnvironment
): boolean {
  if (!measurementId) return false;

  const { runtime } = environment;
  if (runtime.__ryvaGa4MeasurementId === measurementId) return true;

  runtime.dataLayer ??= [];
  runtime.gtag ??= function () {
    // Google tag consumes the standard Arguments object from its documented queue contract.
    // eslint-disable-next-line prefer-rest-params
    runtime.dataLayer!.push(arguments);
  };

  if (!environment.hasScript(SCRIPT_ID)) {
    environment.appendScript({
      id: SCRIPT_ID,
      src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
    });
  }

  runtime.gtag("js", new Date());
  runtime.gtag("config", measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  runtime.__ryvaGa4MeasurementId = measurementId;
  return true;
}

export function trackPublicPageView(
  measurementId: string | null,
  pathname: string,
  environment: AnalyticsEnvironment
): boolean {
  const route = PUBLIC_SEO_ROUTES[pathname];
  if (!measurementId || !route) return false;

  const { runtime } = environment;
  if (runtime.__ryvaGa4LastPath === pathname) return false;
  if (!initializeGoogleAnalytics(measurementId, environment) || !runtime.gtag) return false;

  runtime.gtag("event", "page_view", {
    send_to: measurementId,
    page_title: route.title,
    page_location: `${PUBLIC_ORIGIN}${pathname === "/" ? "/" : pathname}`,
    page_path: pathname
  });
  runtime.__ryvaGa4LastPath = pathname;
  return true;
}
