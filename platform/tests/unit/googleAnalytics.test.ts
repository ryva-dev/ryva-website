import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  initializeGoogleAnalytics,
  normalizeMeasurementId,
  trackPublicPageView
} from "../../apps/web/src/analytics/core.js";
import { readFileSync } from "node:fs";

function analyticsHarness() {
  const scripts = new Map<string, { id: string; src: string }>();
  const dataLayer: Array<ArrayLike<unknown>> = [];
  const runtime = { dataLayer };
  const environment = {
    runtime,
    hasScript: (id: string) => scripts.has(id),
    appendScript: (script: { id: string; src: string }) => scripts.set(script.id, script)
  };
  return { dataLayer, environment, scripts };
}

void describe("Google Analytics 4", () => {
  void it("stays disabled when the measurement ID is absent or malformed", () => {
    const harness = analyticsHarness();
    assert.equal(normalizeMeasurementId(undefined), null);
    assert.equal(normalizeMeasurementId("UA-123"), null);
    assert.equal(initializeGoogleAnalytics(null, harness.environment), false);
    assert.equal(harness.scripts.size, 0);
    assert.equal(harness.dataLayer.length, 0);
  });

  void it("injects and configures the Google tag exactly once", () => {
    const harness = analyticsHarness();
    const measurementId = normalizeMeasurementId(" g-test123 ");
    assert.equal(measurementId, "G-TEST123");
    assert.equal(initializeGoogleAnalytics(measurementId, harness.environment), true);
    assert.equal(initializeGoogleAnalytics(measurementId, harness.environment), true);
    assert.equal(harness.scripts.size, 1);
    assert.equal(harness.scripts.get("ryva-ga4-script")?.src, "https://www.googletagmanager.com/gtag/js?id=G-TEST123");
    assert.equal(harness.dataLayer.length, 2);
    assert.equal(harness.dataLayer[1]![0], "config");
    assert.deepEqual(harness.dataLayer[1]![2], {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
  });

  void it("tracks one safe pageview per public SPA route and ignores private paths", () => {
    const harness = analyticsHarness();
    const measurementId = "G-TEST123";
    const publicPaths = [
      "/",
      "/the-program",
      "/how-it-works",
      "/curriculum",
      "/faq",
      "/terms",
      "/privacy",
      "/refund-policy",
      "/disclaimer"
    ];
    assert.equal(trackPublicPageView(measurementId, publicPaths[0]!, harness.environment), true);
    assert.equal(trackPublicPageView(measurementId, publicPaths[0]!, harness.environment), false);
    for (const pathname of publicPaths.slice(1)) {
      assert.equal(trackPublicPageView(measurementId, pathname, harness.environment), true);
    }
    assert.equal(trackPublicPageView(measurementId, "/disclaimer", harness.environment), false);
    assert.equal(trackPublicPageView(measurementId, "/app/program/secret-answer", harness.environment), false);

    const pageviews = harness.dataLayer.filter((entry) => entry[0] === "event" && entry[1] === "page_view");
    assert.equal(pageviews.length, publicPaths.length);
    assert.deepEqual(
      pageviews.map((entry) => (entry[2] as { page_path: string }).page_path),
      publicPaths
    );
    assert.deepEqual(pageviews[0]?.[2], {
      send_to: measurementId,
      page_title: "Ryva | Brand Placement & Wholesale Industry Education",
      page_location: "https://www.ryvaforge.com/",
      page_path: "/"
    });
    assert.doesNotMatch(JSON.stringify(pageviews), /@|email|user[_-]?id|password|token|stripe|answer/i);
  });

  void it("allows the official Google collection fallback without widening script policy", () => {
    const apiSource = readFileSync(new URL("../../apps/api/src/app.ts", import.meta.url), "utf8");
    assert.match(apiSource, /connectSrc:.*https:\/\/www\.google\.com/);
    assert.match(apiSource, /imgSrc:.*https:\/\/www\.googletagmanager\.com/);
    assert.doesNotMatch(apiSource, /scriptSrc:.*https:\/\/www\.google\.com/);
  });
});
