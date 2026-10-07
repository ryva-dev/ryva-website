import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  applyAdvertisingConsent,
  initializeMetaPixel,
  initializeTikTokPixel,
  normalizeMetaPixelId,
  normalizeTikTokPixelId,
  trackMetaPublicPageView,
  trackTikTokPublicPageView,
  type AdvertisingPixelsEnvironment,
  type AdvertisingPixelsRuntime
} from "../../apps/web/src/analytics/advertisingPixelsCore.js";

function pixelHarness() {
  const scripts = new Map<string, { id: string; src: string }>();
  const runtime: AdvertisingPixelsRuntime = {};
  const environment: AdvertisingPixelsEnvironment = {
    runtime,
    hasScript: (id) => scripts.has(id),
    appendScript: (script) => scripts.set(script.id, script),
    now: () => 123456
  };
  return { environment, runtime, scripts };
}

const publicPaths = [
  "/", "/the-program", "/how-it-works", "/curriculum", "/faq",
  "/terms", "/privacy", "/refund-policy", "/disclaimer"
];

void describe("Meta and TikTok advertising pixels", () => {
  void it("stays disabled without valid public pixel IDs", () => {
    const harness = pixelHarness();
    assert.equal(normalizeMetaPixelId(undefined), null);
    assert.equal(normalizeMetaPixelId("G-NOT-META"), null);
    assert.equal(normalizeTikTokPixelId(undefined), null);
    assert.equal(normalizeTikTokPixelId("invalid id"), null);
    assert.equal(initializeMetaPixel(null, harness.environment), false);
    assert.equal(initializeTikTokPixel(null, harness.environment), false);
    assert.equal(harness.scripts.size, 0);
  });

  void it("injects each standard loader once and omits identity enrichment", () => {
    const harness = pixelHarness();
    const metaId = normalizeMetaPixelId(" 1064143732916345 ");
    const tikTokId = normalizeTikTokPixelId(" db2lfgjc77ua626ehmcg ");
    assert.equal(initializeMetaPixel(metaId, harness.environment), true);
    assert.equal(initializeMetaPixel(metaId, harness.environment), true);
    assert.equal(initializeTikTokPixel(tikTokId, harness.environment), true);
    assert.equal(initializeTikTokPixel(tikTokId, harness.environment), true);
    assert.equal(harness.scripts.size, 2);
    assert.equal(harness.scripts.get("ryva-meta-pixel-script")?.src, "https://connect.facebook.net/en_US/fbevents.js");
    assert.equal(
      harness.scripts.get("ryva-tiktok-pixel-script")?.src,
      "https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=DB2LFGJC77UA626EHMCG&lib=ttq"
    );
    assert.deepEqual(harness.runtime.fbq?.queue, [["init", "1064143732916345"]]);
    assert.equal(harness.runtime.ttq?.some((entry) => entry[0] === "identify"), false);
    assert.deepEqual(harness.runtime.ttq?._o?.DB2LFGJC77UA626EHMCG, { historyObserver: false });
  });

  void it("emits only PageView/page once per approved SPA route and nothing private", () => {
    const harness = pixelHarness();
    for (const pathname of publicPaths) {
      assert.equal(trackMetaPublicPageView("1064143732916345", pathname, harness.environment), true);
      assert.equal(trackTikTokPublicPageView("DB2LFGJC77UA626EHMCG", pathname, harness.environment), true);
      assert.equal(trackMetaPublicPageView("1064143732916345", pathname, harness.environment), false);
      assert.equal(trackTikTokPublicPageView("DB2LFGJC77UA626EHMCG", pathname, harness.environment), false);
    }
    assert.equal(trackMetaPublicPageView("1064143732916345", "/login", harness.environment), false);
    assert.equal(trackTikTokPublicPageView("DB2LFGJC77UA626EHMCG", "/app/program/private", harness.environment), false);

    const metaCommands = harness.runtime.fbq?.queue ?? [];
    const tikTokCommands = harness.runtime.ttq ?? [];
    assert.equal(metaCommands.filter((entry) => entry[0] === "track" && entry[1] === "PageView").length, publicPaths.length);
    assert.equal(tikTokCommands.filter((entry) => entry[0] === "page").length, publicPaths.length);
    assert.equal(metaCommands.some((entry) => entry[0] === "track" && entry[1] !== "PageView"), false);
    assert.equal(tikTokCommands.some((entry) => entry[0] === "identify" || entry[0] === "track"), false);
    assert.doesNotMatch(JSON.stringify({ metaCommands, tikTokCommands }), /@|email|name|phone|user[_-]?id|password|token|stripe|answer/i);

    applyAdvertisingConsent(false, harness.environment);
    assert.deepEqual(harness.runtime.fbq?.queue?.at(-1), ["consent", "revoke"]);
    assert.deepEqual(harness.runtime.ttq?.at(-1), ["revokeConsent"]);
  });

  void it("keeps a narrow production CSP for both official loaders and collectors", () => {
    const apiSource = readFileSync(new URL("../../apps/api/src/app.ts", import.meta.url), "utf8");
    assert.match(apiSource, /scriptSrc:.*https:\/\/connect\.facebook\.net.*https:\/\/analytics\.tiktok\.com/);
    assert.match(apiSource, /connectSrc:.*https:\/\/www\.facebook\.com.*https:\/\/analytics\.tiktok\.com/);
    assert.doesNotMatch(apiSource, /scriptSrc:.*https:\/\/\*\.facebook\.com/);
    assert.doesNotMatch(apiSource, /scriptSrc:.*https:\/\/\*\.tiktok\.com/);
  });
});
