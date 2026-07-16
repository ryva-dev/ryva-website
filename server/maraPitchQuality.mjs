/**
 * Pitch quality gates before Gmail draft persistence.
 */

import { hasUnfilledPlaceholders } from "./maraDeliverablePublication.mjs";

const GENERIC_OPENERS = [
  /^hope you('?re| are) (doing )?well/i,
  /^my name is /i,
  /^i came across your (brand|page)/i,
  /^i love your brand/i,
  /^i'?m a huge fan/i
];

export function runPitchQualityChecks({
  body = "",
  subject = "",
  brandName = "",
  contactEmail = "",
  expectedBrandName = "",
  expectedContactEmail = "",
  creatorVoiceNotes = "",
  hasObservedEvidence = false,
  claimsBrandIsBuying = false,
  evidenceSupportsBuying = false
} = {}) {
  const issues = [];
  const text = String(body || "");
  const lower = text.toLowerCase();
  const brand = String(brandName || expectedBrandName || "").trim();
  const expectedBrand = String(expectedBrandName || brandName || "").trim();

  if (expectedBrand && brand && expectedBrand.toLowerCase() !== brand.toLowerCase()) {
    issues.push({ code: "wrong_brand", severity: "critical", message: `Brand mismatch: draft for "${brand}" vs expected "${expectedBrand}".` });
  }
  if (expectedContactEmail && contactEmail && expectedContactEmail.toLowerCase() !== contactEmail.toLowerCase()) {
    issues.push({ code: "wrong_contact", severity: "critical", message: "Contact email does not match the selected outreach contact." });
  }
  if (!contactEmail) {
    issues.push({ code: "missing_contact", severity: "critical", message: "No outreach contact — cannot create a sendable draft." });
  }
  if (claimsBrandIsBuying && !evidenceSupportsBuying) {
    issues.push({
      code: "unsupported_buying_claim",
      severity: "critical",
      message: "Pitch claims the brand is buying UGC/creators without verified evidence."
    });
  }
  if (!hasObservedEvidence && /\byou(?:'re| are) (?:already )?running\b|\byour ads?\b|\byour ugc\b/i.test(text)) {
    issues.push({
      code: "unsupported_factual_claim",
      severity: "high",
      message: "Pitch asserts brand creative/ad facts without observed evidence."
    });
  }
  if (text.length > 1400) {
    issues.push({ code: "excessive_length", severity: "medium", message: "Pitch is longer than ~1400 characters — tighten." });
  }
  if (text.length > 0 && text.length < 120) {
    issues.push({ code: "too_short", severity: "medium", message: "Pitch is too thin to carry a commercial reason." });
  }
  if (GENERIC_OPENERS.some((re) => re.test(text.trim()))) {
    issues.push({ code: "generic_wording", severity: "medium", message: "Opens with a generic cold-email cliché." });
  }
  if (!/\?|would you|open to|curious if|happy to send/i.test(text)) {
    issues.push({ code: "unclear_cta", severity: "high", message: "No clear low-friction call to action." });
  }
  if (brand && !lower.includes(brand.toLowerCase()) && brand.length > 2) {
    issues.push({ code: "missing_brand_name", severity: "high", message: "Body does not mention the target brand name." });
  }
  if (!/why|because|gap|angle|concept|audience|launch|campaign|hook/i.test(text)) {
    issues.push({ code: "missing_commercial_reason", severity: "high", message: "Missing why-now / commercial opportunity framing." });
  }
  if (/\bas we discussed\b|\bgreat chatting\b|\bfollowing up on our call\b/i.test(text)) {
    issues.push({ code: "fake_familiarity", severity: "critical", message: "Implies prior relationship without evidence." });
  }
  if (creatorVoiceNotes && /formal corporate|synergy|leverage our ecosystem/i.test(text)) {
    issues.push({ code: "voice_mismatch", severity: "low", message: "Tone may clash with creator voice notes." });
  }
  if (!String(subject || "").trim()) {
    issues.push({ code: "missing_subject", severity: "high", message: "Missing subject line." });
  }
  if (hasUnfilledPlaceholders(text) || hasUnfilledPlaceholders(subject)) {
    issues.push({
      code: "unfilled_placeholder",
      severity: "critical",
      message: "Pitch still contains unfilled placeholders like [Your Name] or [Brand] — not sendable."
    });
  }
  if (/^\[brand\]$/i.test(brand) || brand === "[Brand]") {
    issues.push({
      code: "unfilled_placeholder",
      severity: "critical",
      message: "Pitch target is still a placeholder brand, not a real company."
    });
  }

  const critical = issues.filter((item) => item.severity === "critical");
  return {
    ok: critical.length === 0,
    canCreateDraft: critical.length === 0,
    issues,
    score: Math.max(0, 100 - issues.reduce((sum, item) => sum + ({ critical: 40, high: 15, medium: 8, low: 3 }[item.severity] || 5), 0))
  };
}

export function detectUnsupportedBuyingClaim(text = "") {
  return /\byou(?:['’]re| are)\b[\s\S]{0,40}\bbuying\b[\s\S]{0,20}\b(?:ugc|creators?|influencer)/i.test(
    String(text)
  );
}
