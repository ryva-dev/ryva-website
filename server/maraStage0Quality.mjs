/**
 * Stage 0B quality rubric — measurable gates before Stage 1 infrastructure.
 * Scores delivered opportunities/pitches; does not invent commercial value.
 */

import { hasUnfilledPlaceholders } from "./maraDeliverablePublication.mjs";
import { isEarlyStageCreator, isDesiredBrand } from "./maraOpportunityScoring.mjs";

export const STAGE0_WORTH_PURSUE_THRESHOLD = 70;

function scoreBoolean(ok, weight) {
  return ok ? weight : 0;
}

/**
 * Score one opportunity package for Stage 0 "worth pursuing" judgment.
 * Returns 0–100 plus issue codes. Gate: score >= STAGE0_WORTH_PURSUE_THRESHOLD.
 */
export function scoreOpportunityQuality({
  brandName = "",
  creatorStage = "",
  desiredBrands = [],
  fitReason = "",
  evidenceClaims = [],
  reachableNowReason = "",
  contactRoute = "",
  contactEmail = "",
  contactBlockedHonestly = false,
  contentAngle = "",
  pitchBody = "",
  pitchSubject = "",
  confidence = null,
  risks = [],
  nextAction = "",
  decision = "",
  readiness = ""
} = {}) {
  const issues = [];
  const early = isEarlyStageCreator(creatorStage);
  const dream = isDesiredBrand(brandName, desiredBrands);
  const evidence = Array.isArray(evidenceClaims) ? evidenceClaims.filter(Boolean) : [];
  const riskList = Array.isArray(risks) ? risks.filter(Boolean) : [];

  if (early && dream && readiness !== "later" && decision !== "build_toward") {
    issues.push({ code: "dream_brand_as_primary", severity: "critical" });
  }
  if (!String(fitReason || "").trim()) issues.push({ code: "missing_fit_reason", severity: "high" });
  if (evidence.length === 0) issues.push({ code: "missing_evidence", severity: "high" });
  if (!String(reachableNowReason || "").trim() && !dream) {
    issues.push({ code: "missing_reachable_now", severity: "medium" });
  }
  if (!String(contactEmail || "").trim() && !String(contactRoute || "").trim() && !contactBlockedHonestly) {
    issues.push({ code: "missing_contact_path", severity: "critical" });
  }
  if (!String(contentAngle || "").trim()) issues.push({ code: "missing_content_angle", severity: "high" });
  if (!String(pitchBody || "").trim()) issues.push({ code: "missing_pitch", severity: "critical" });
  if (hasUnfilledPlaceholders(pitchBody) || hasUnfilledPlaceholders(pitchSubject)) {
    issues.push({ code: "placeholder_pitch", severity: "critical" });
  }
  if (confidence == null || !Number.isFinite(Number(confidence))) {
    issues.push({ code: "missing_confidence", severity: "medium" });
  }
  if (!String(nextAction || "").trim()) issues.push({ code: "missing_next_action", severity: "high" });

  let score = 0;
  score += scoreBoolean(Boolean(String(fitReason || "").trim()), 12);
  score += scoreBoolean(evidence.length > 0, 14);
  score += scoreBoolean(Boolean(String(reachableNowReason || "").trim()) || Boolean(dream && (decision === "build_toward" || readiness === "later")), 10);
  score += scoreBoolean(Boolean(String(contactEmail || "").trim()) || Boolean(String(contactRoute || "").trim()) || contactBlockedHonestly, 16);
  score += scoreBoolean(Boolean(String(contentAngle || "").trim()), 12);
  score += scoreBoolean(Boolean(String(pitchBody || "").trim()) && !hasUnfilledPlaceholders(pitchBody), 18);
  score += scoreBoolean(confidence != null && Number.isFinite(Number(confidence)), 6);
  score += scoreBoolean(riskList.length > 0 || dream, 4);
  score += scoreBoolean(Boolean(String(nextAction || "").trim()), 8);
  if (early && dream && readiness !== "later" && decision !== "build_toward") score = Math.min(score, 40);

  const critical = issues.some((item) => item.severity === "critical");
  if (critical) score = Math.min(score, 55);

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    worthPursuing: !critical && score >= STAGE0_WORTH_PURSUE_THRESHOLD,
    issues,
    earlyStage: early,
    dreamBrand: dream
  };
}

/**
 * Aggregate overnight/run quality. Stage 0B exit requires passRate >= 0.7.
 */
export function summarizeStage0Run(opportunityScores = []) {
  const rows = Array.isArray(opportunityScores) ? opportunityScores : [];
  const worth = rows.filter((row) => row?.worthPursuing);
  const passRate = rows.length ? worth.length / rows.length : 0;
  return {
    delivered: rows.length,
    worthPursuing: worth.length,
    passRate,
    gatePass: rows.length > 0 && passRate >= 0.7,
    averageScore: rows.length
      ? Math.round(rows.reduce((sum, row) => sum + Number(row.score || 0), 0) / rows.length)
      : 0
  };
}
