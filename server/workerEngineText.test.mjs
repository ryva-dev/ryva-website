import assert from "node:assert/strict";
import test from "node:test";
import { decodeHtmlEntities, isLikelyListicleTitle } from "./workerEngine.mjs";

test("decodeHtmlEntities cleans scraped entities", () => {
  assert.equal(decodeHtmlEntities("Healthy Living &mdash; The Honest Consumer"), "Healthy Living — The Honest Consumer");
  assert.equal(decodeHtmlEntities("Barnes &amp; Noble"), "Barnes & Noble");
  assert.equal(decodeHtmlEntities("It&#39;s here &#x2014; now"), "It's here — now");
  assert.equal(decodeHtmlEntities("plain text"), "plain text");
});

test("listicle titles are never treated as brand names", () => {
  assert.ok(isLikelyListicleTitle("15+ Wellness Brands for Healthy Sustainable Living — The Honest Consumer"));
  assert.ok(isLikelyListicleTitle("Top 10 DTC Skincare Brands"));
  assert.ok(isLikelyListicleTitle("Our List of Top Lifestyle and Wellness Brands"));
  assert.ok(isLikelyListicleTitle("7 Wellness Brands to Help You Move, Eat, and Live Better in 2025"));
  assert.ok(!isLikelyListicleTitle("Glow Recipe"));
  assert.ok(!isLikelyListicleTitle("Seed Health"));
  assert.ok(!isLikelyListicleTitle("Olipop"));
});
