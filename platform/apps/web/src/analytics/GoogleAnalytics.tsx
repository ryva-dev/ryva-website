import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  normalizeMeasurementId,
  trackPublicPageView,
  type AnalyticsEnvironment
} from "./core";

const analyticsEnvironment: AnalyticsEnvironment = {
  runtime: window as unknown as AnalyticsEnvironment["runtime"],
  hasScript: (id) => Boolean(document.getElementById(id)),
  appendScript: ({ id, src }) => {
    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.src = src;
    document.head.append(script);
  }
};

export function GoogleAnalytics() {
  const location = useLocation();
  const configuredValue: unknown = import.meta.env.VITE_GA_MEASUREMENT_ID;
  const measurementId = normalizeMeasurementId(
    typeof configuredValue === "string" ? configuredValue : undefined
  );

  useEffect(() => {
    trackPublicPageView(measurementId, location.pathname, analyticsEnvironment);
  }, [location.pathname, measurementId]);

  return null;
}
