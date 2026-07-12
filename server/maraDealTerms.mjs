/**
 * Structured deal terms + negotiation risk flags (not legal advice).
 */

export const DEAL_TERM_FIELDS = Object.freeze([
  "baseRate",
  "numberOfVideos",
  "rawFootage",
  "hooksOrVariations",
  "revisions",
  "usageRights",
  "usageDuration",
  "paidAdvertising",
  "whitelisting",
  "exclusivity",
  "organicPosting",
  "turnaroundTime",
  "rushFee",
  "cancellationTerms",
  "paymentTerms",
  "productValue",
  "affiliateCompensation",
  "performanceBonuses"
]);

export function emptyDealTerms(overrides = {}) {
  const base = Object.fromEntries(DEAL_TERM_FIELDS.map((field) => [field, null]));
  return {
    ...base,
    currency: "USD",
    notes: [],
    source: "unknown",
    confidence: 0,
    ...overrides
  };
}

export function extractDealTermsFromText(text = "") {
  const source = String(text || "");
  const terms = emptyDealTerms({ source: "email_text", confidence: 40 });
  const money = source.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
  if (money) {
    terms.baseRate = Number(String(money[1]).replace(/,/g, ""));
    terms.confidence = 55;
  }
  const videos = source.match(/\b(\d+)\s*(videos?|assets?|cuts?)\b/i);
  if (videos) terms.numberOfVideos = Number(videos[1]);
  if (/\braw footage\b/i.test(source)) terms.rawFootage = true;
  if (/\bwhitelist/i.test(source)) terms.whitelisting = true;
  if (/\bpaid (ads?|advertising|usage)\b/i.test(source)) terms.paidAdvertising = true;
  if (/\bexclusiv/i.test(source)) terms.exclusivity = true;
  if (/\bperpetual|in perpetuity\b/i.test(source)) terms.usageDuration = "perpetual";
  if (/\bnet\s?(\d+)\b/i.test(source)) {
    const net = source.match(/\bnet\s?(\d+)\b/i);
    terms.paymentTerms = net ? `net_${net[1]}` : terms.paymentTerms;
  }
  if (/\bgifted|product only|free product\b/i.test(source)) {
    terms.productValue = terms.productValue || "gifted_product";
    terms.baseRate = terms.baseRate || 0;
  }
  const revision = source.match(/\b(\d+)\s*revisions?\b/i);
  if (revision) terms.revisions = Number(revision[1]);
  return terms;
}

export function evaluateDealTerms(terms = {}, { creatorMinimums = {}, benchmarks = null } = {}) {
  const flags = [];
  const t = { ...emptyDealTerms(), ...terms };
  const minRate = Number(creatorMinimums.baseRate || creatorMinimums.minRate || 0);
  const rate = Number(t.baseRate);

  if (t.usageDuration === "perpetual") {
    flags.push({
      code: "perpetual_usage",
      severity: "high",
      message: "Perpetual usage requested. Mara will not accept this — manager decision required. Not legal advice.",
      confidence: 90
    });
  }
  if (t.exclusivity === true) {
    flags.push({
      code: "exclusivity",
      severity: "high",
      message: "Exclusivity terms present. Flag for manager; do not agree autonomously.",
      confidence: 85
    });
  }
  if (Number.isFinite(rate) && minRate > 0 && rate < minRate) {
    flags.push({
      code: "under_minimum",
      severity: "high",
      message: `Offered rate $${rate} is below creator minimum $${minRate}.`,
      confidence: 80
    });
  }
  if ((t.productValue && !rate) || t.productValue === "gifted_product") {
    flags.push({
      code: "gifted_not_paid",
      severity: "medium",
      message: "Appears gifted/product-only — do not count as paid revenue.",
      confidence: 85
    });
  }
  if (t.paidAdvertising === true && (!Number.isFinite(rate) || rate <= 0)) {
    flags.push({
      code: "paid_usage_without_rate",
      severity: "high",
      message: "Paid ad usage mentioned without clear compensation.",
      confidence: 70
    });
  }
  if (benchmarks && Number.isFinite(rate) && Number.isFinite(benchmarks.medianRate) && rate < benchmarks.medianRate * 0.6) {
    flags.push({
      code: "below_benchmark",
      severity: "medium",
      message: "Below available benchmark median — benchmark confidence is limited; treat as guidance only.",
      confidence: Number(benchmarks.confidence || 40),
      provenance: benchmarks.source || "internal_benchmark"
    });
  }

  return {
    terms: t,
    flags,
    mayAutonomouslyAccept: false,
    guidance:
      flags.length === 0
        ? "Terms look within ordinary bounds from available signals — still requires manager approval to accept."
        : "Negotiation risks detected. Draft guidance only; do not accept terms."
  };
}
