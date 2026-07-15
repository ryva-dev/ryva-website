import test from "node:test";
import assert from "node:assert/strict";
import { buildScopedTrendInsights, extractNicheKeywords, inferTrendNiche, scoreHashtagForNiche } from "./maraTrendInsights.mjs";

const globalPayload = {
  hashtags: [
    { categories: ["Beauty"], hashtag: "#skincareroutine", posts: "120K", views: "40M" },
    { categories: ["Travel"], hashtag: "#empirestatebuilding", posts: "27.9K", views: "326.1M" },
    { categories: ["Health"], hashtag: "#wellnesstips", posts: "88K", views: "12M" }
  ],
  periodDays: 7,
  region: "US",
  sourceUrl: "https://example.com/trends"
};

test("extractNicheKeywords expands skincare and wellness tokens", () => {
  const keywords = extractNicheKeywords("skincare and wellness UGC");
  assert.ok(keywords.includes("skincare"));
  assert.ok(keywords.includes("wellness"));
  assert.ok(keywords.includes("beauty"));
});

test("scoreHashtagForNiche prefers beauty hashtags for skincare niche", () => {
  const keywords = extractNicheKeywords("skincare UGC");
  const beautyScore = scoreHashtagForNiche(globalPayload.hashtags[0], keywords);
  const travelScore = scoreHashtagForNiche(globalPayload.hashtags[1], keywords);
  assert.ok(beautyScore > travelScore);
});

test("buildScopedTrendInsights returns niche-matched hashtags first", () => {
  const scoped = buildScopedTrendInsights(globalPayload, "skincare and wellness UGC");
  assert.equal(scoped.niche, "skincare and wellness UGC");
  assert.ok(scoped.matchedToNiche);
  assert.ok(scoped.hashtags.some((item) => /skincare|wellness/i.test(item.hashtag)));
  assert.ok(scoped.contentGaps.length > 0);
});

test("trend niche comes from creator niche, never workflow boilerplate", () => {
  assert.equal(
    inferTrendNiche({ accountContext: {}, maraAnswers: { niche_focus: "strength training for beginners", current_workflow: "I use email and spreadsheets" } }),
    "strength training for beginners"
  );
});
