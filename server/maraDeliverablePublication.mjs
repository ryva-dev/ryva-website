/**
 * Shared rules for what may appear as customer-facing "shipped" work.
 * Digests, office deliverables, and desk "while you were away" must agree.
 */

const NON_PUBLISH_GENERATED_BY = new Set(["placeholder", "template", "empty_scan"]);

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

/**
 * @param {{ outputType?: string, content?: string, structuredContent?: object }} output
 * @param {{ hiddenTypes?: Set<string> }} [options]
 */
export function shouldPublishWorkerOutput(output, { hiddenTypes = null } = {}) {
  const outputType = String(output?.outputType || "");
  if (hiddenTypes?.has(outputType)) return false;

  const generatedBy = String(output?.structuredContent?.generatedBy || "");
  if (NON_PUBLISH_GENERATED_BY.has(generatedBy)) return false;

  if (outputType === "market_pulse" && isEmptyMarketPulseStructured(output?.structuredContent || {})) {
    return false;
  }

  if (hasUnfilledPlaceholders(output?.content) || hasUnfilledPlaceholders(output?.structuredContent)) {
    return false;
  }

  return true;
}
