import test from "node:test";
import assert from "node:assert/strict";
import {
  contentAdviceFromDiscoveryRoutes,
  extractBrandDiscoveryIntel,
  formatDiscoveryRoutesForDeliverable,
  mergeBrandDiscoveryRoute,
  shouldAllowOutreachPitch
} from "./maraBrandDiscoveryIntel.mjs";

const GYMSHARK_ARTICLE = `
Curious about becoming a Gymshark athlete? Here’s what you need to know about how we choose our partners.
We look for authentic people who align with the brand.
Tag @Gymshark and use #Gymshark so our team can find you.
We do not provide a direct email or application form for sponsorship requests.
`;

test("Gymshark athlete article becomes tag-discovery intel, not a pitch path", () => {
  const intel = extractBrandDiscoveryIntel({
    text: GYMSHARK_ARTICLE,
    brandName: "Gymshark would be a DREAM for me",
    url: "https://support.gymshark.com/en/articles/11186207-gymshark-athlete"
  });
  assert.ok(intel);
  assert.equal(intel.brandName, "Gymshark");
  assert.equal(intel.mode, "tag_discovery");
  assert.equal(shouldAllowOutreachPitch(intel), false);
  assert.ok(intel.handles.includes("@Gymshark"));
  assert.ok(intel.hashtags.includes("#Gymshark"));
  assert.match(intel.summary, /do not pitch/i);
});

test("ordinary brand page without discovery rules returns null", () => {
  assert.equal(
    extractBrandDiscoveryIntel({
      text: "Independent training gear for everyday athletes. Free shipping.",
      brandName: "Reachable Fit",
      url: "https://shop.reachablefit.com/"
    }),
    null
  );
});

test("discovery routes merge and feed caption advice", () => {
  const intel = extractBrandDiscoveryIntel({
    text: GYMSHARK_ARTICLE,
    brandName: "Gymshark",
    url: "https://support.gymshark.com/athlete"
  });
  const routes = mergeBrandDiscoveryRoute([], intel);
  assert.equal(routes.length, 1);
  const advice = contentAdviceFromDiscoveryRoutes(routes);
  assert.ok(advice.includes("@Gymshark"));
  assert.ok(advice.includes("#Gymshark"));
  const lines = formatDiscoveryRoutesForDeliverable(routes);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /do not pitch/i);
});
