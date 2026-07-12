import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveUnverifiedEmailPatterns,
  extractEmailsFromJsonLd,
  extractEmailsFromText,
  freeSiteContactProbes,
  listContactEnrichmentProviders
} from "./maraContactEnrichment.mjs";
import { buildProductionTimeline, extractMissingBriefRequirements } from "./maraPostWinOps.mjs";
import { assessContactUsability, CONTACT_TYPES } from "./maraContactDiscovery.mjs";
import { tiktokLiveProvider, listSocialResearchProviders } from "./maraSocialResearch.mjs";

test("free enrichment extracts emails and never marks inferred patterns sendable", () => {
  const emails = extractEmailsFromText("Reach partners@glow.example or support@glow.example");
  assert.ok(emails.includes("partners@glow.example"));
  const ld = extractEmailsFromJsonLd(`<script type="application/ld+json">{"email":"hello@brand.example"}</script>`);
  assert.deepEqual(ld, ["hello@brand.example"]);
  const patterns = deriveUnverifiedEmailPatterns("https://www.acme.co/about");
  assert.ok(patterns.some((item) => item.email === "partners@acme.co"));
  assert.ok(patterns.every((item) => item.inferred));
  const usability = assessContactUsability({
    contactType: CONTACT_TYPES.INFERRED_PATTERN,
    inferred: true,
    verificationState: "unverified",
    value: patterns[0].email
  });
  assert.equal(usability.mayUseForOutreach, false);
});

test("freeSiteContactProbes crawls standard paths via mock fetch", async () => {
  const result = await freeSiteContactProbes({
    website: "https://brand.example",
    fetchImpl: async (url) => {
      if (String(url).includes("sitemap")) {
        return {
          ok: true,
          text: async () => `<urlset><url><loc>https://brand.example/pages/partnerships</loc></url></urlset>`
        };
      }
      if (String(url).includes("partnerships")) {
        return {
          ok: true,
          text: async () => `<html><a href="mailto:collab@brand.example">email</a></html>`
        };
      }
      return { ok: false, status: 404, text: async () => "" };
    }
  });
  assert.ok(result.emails.includes("collab@brand.example"));
  assert.ok(result.inferredPatterns.length > 0);
});

test("enrichment provider list exposes hunter/apollo configuration state", () => {
  const providers = listContactEnrichmentProviders();
  assert.ok(providers.some((item) => item.name === "hunter"));
  assert.ok(providers.some((item) => item.name === "free_site_probes" && item.configured));
});

test("production timeline and brief gap detection work", () => {
  const timeline = buildProductionTimeline({ brandName: "Glow" });
  assert.ok(timeline.milestones.some((item) => item.id === "invoice"));
  const gaps = extractMissingBriefRequirements("Please make a video");
  assert.ok(gaps.missing.includes("due_date"));
  assert.ok(gaps.missing.includes("usage_rights"));
});

test("tiktok live provider stays fail-closed without token and lists as implemented when token present", async () => {
  const previous = process.env.TIKTOK_ACCESS_TOKEN;
  delete process.env.TIKTOK_ACCESS_TOKEN;
  const missing = await tiktokLiveProvider({ brandName: "Glow" });
  assert.equal(missing.status, "not_configured");
  process.env.TIKTOK_ACCESS_TOKEN = "test-token";
  const listed = listSocialResearchProviders().find((item) => item.name === "tiktok_creative_center_live");
  assert.equal(listed.status, "implemented");
  const live = await tiktokLiveProvider({
    brandName: "Glow",
    fetchImpl: async () => ({
      ok: true,
      text: async () => JSON.stringify({ code: 0, data: { keywords: [{ keyword: "glow serum ugc" }] } })
    })
  });
  assert.equal(live.status, "ok");
  assert.ok(live.observations.length >= 1);
  if (previous == null) delete process.env.TIKTOK_ACCESS_TOKEN;
  else process.env.TIKTOK_ACCESS_TOKEN = previous;
});

test("openai whisper fails closed without media bytes", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousProvider = process.env.MARA_TRANSCRIPTION_PROVIDER;
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.MARA_TRANSCRIPTION_PROVIDER = "openai";
  const { createOpenAiWhisperProvider } = await import("./maraMediaPipeline.mjs");
  const provider = createOpenAiWhisperProvider();
  await assert.rejects(
    () => provider.transcribe({ durationSeconds: 10, mediaBuffer: null }),
    /requires the media file bytes/
  );
  if (previousKey == null) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
  if (previousProvider == null) delete process.env.MARA_TRANSCRIPTION_PROVIDER;
  else process.env.MARA_TRANSCRIPTION_PROVIDER = previousProvider;
});
