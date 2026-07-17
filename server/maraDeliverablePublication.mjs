/**
 * Shared rules for what may appear as customer-facing "shipped" work.
 * Digests, office deliverables, and desk "while you were away" must agree.
 */

import { isCreatorPreferenceEcho } from "./maraOpportunityScoring.mjs";

const NON_PUBLISH_GENERATED_BY = new Set(["placeholder", "template", "empty_scan"]);

/** Internal / operational types that must never be claimed as shipped deliverables. */
export const INTERNAL_OUTPUT_TYPES = new Set([
  "summary",
  "status_note",
  "ops_brief",
  "tracker_structure",
  "weekly_plan",
  "weekly_schedule"
]);

/** Bracket tokens like [Your Name] / [Brand] that mean the draft was never finished. */
export function hasUnfilledPlaceholders(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value || "");
  return /\[[A-Za-z][^\]\n]{0,48}\]/.test(text);
}

export function isEmptyMarketPulseStructured(structured = {}) {
  const opportunities = Array.isArray(structured.opportunities) ? structured.opportunities : [];
  const lessons = Array.isArray(structured.lessonsLearned) ? structured.lessonsLearned : [];
  const reddit = Array.isArray(structured.communitySignals) ? structured.communitySignals : [];
  const tiktok = Array.isArray(structured.tiktokSignals) ? structured.tiktokSignals : [];
  const takeaways = Array.isArray(structured.takeaways) ? structured.takeaways : [];
  return (
    opportunities.length === 0 &&
    lessons.length === 0 &&
    reddit.length === 0 &&
    tiktok.length === 0 &&
    takeaways.length === 0
  );
}

export function isEmptyBrandResearchDigest(structured = {}) {
  const brands = Array.isArray(structured.brands) ? structured.brands : [];
  return brands.length === 0;
}

/**
 * @param {{ outputType?: string, content?: string, structuredContent?: object, title?: string }} output
 * @param {{ hiddenTypes?: Set<string> }} [options]
 */
export function shouldPublishWorkerOutput(output, { hiddenTypes = null } = {}) {
  const outputType = String(output?.outputType || "");
  if (INTERNAL_OUTPUT_TYPES.has(outputType)) return false;
  if (hiddenTypes?.has(outputType)) return false;

  const generatedBy = String(output?.structuredContent?.generatedBy || "");
  if (NON_PUBLISH_GENERATED_BY.has(generatedBy)) return false;

  if (outputType === "market_pulse" && isEmptyMarketPulseStructured(output?.structuredContent || {})) {
    return false;
  }

  if (outputType === "brand_research_digest" && isEmptyBrandResearchDigest(output?.structuredContent || {})) {
    return false;
  }

  // Stage 0A: digests that echo dream-brand preference copy are not usable work.
  if (
    outputType === "brand_research_digest" &&
    (isCreatorPreferenceEcho(output?.content) || isCreatorPreferenceEcho(JSON.stringify(output?.structuredContent || {})))
  ) {
    return false;
  }

  // Legacy digests were stored as summary/title only — never publish those.
  if (/^daily brand research digest$/i.test(String(output?.title || "")) && outputType === "summary") {
    return false;
  }

  if (hasUnfilledPlaceholders(output?.content) || hasUnfilledPlaceholders(output?.structuredContent)) {
    return false;
  }

  return true;
}

/** Whether a worker_output_created activity may say "I shipped …". */
export function shouldClaimShippedActivity(metadata = {}, title = "") {
  const outputType = String(metadata?.outputType || "");
  const generatedBy = String(metadata?.generatedBy || metadata?.structuredContent?.generatedBy || "");
  if (INTERNAL_OUTPUT_TYPES.has(outputType)) return false;
  if (/^daily brand research digest$/i.test(String(title || "")) && (!outputType || outputType === "summary")) {
    return false;
  }
  if (["placeholder", "template", "empty_scan"].includes(generatedBy)) return false;
  if (outputType === "brand_research_digest") {
    const brandCount = Number(metadata?.brandCount);
    if (Number.isFinite(brandCount)) return brandCount > 0;
    // New digests are only written when brands exist; trust research-marked ones.
    return generatedBy === "research" || generatedBy === "llm";
  }
  if (!outputType) return true;
  return !INTERNAL_OUTPUT_TYPES.has(outputType);
}
