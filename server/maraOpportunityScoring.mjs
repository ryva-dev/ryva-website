/**
 * Versioned, explainable creator–brand–opportunity scoring.
 * This is the single source of truth for weights. UI/projections must not recompute differently.
 */
import { EVIDENCE_KINDS } from "./maraEvidence.mjs";

export const SCORE_VERSION = "2026-07-12.1";

export const DIMENSION_WEIGHTS = Object.freeze({
  creatorFit: 0.28,
  commercialPotential: 0.22,
  creativeOpportunity: 0.25,
  outreachFeasibility: 0.15,
  riskAdjustment: 0.1
});

function clamp(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

function avg(values) {
  const nums = values.filter((value) => Number.isFinite(Number(value)));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + Number(value), 0) / nums.length;
}

/**
 * Each component: { score: 0-100|null, confidence: 0-100, evidenceIds: [], notes: string, unknown: boolean }
 * Missing data → null score contributes to lower confidence, not automatic penalty.
 */
export function scoreOpportunityDimensions(components = {}) {
  const keys = Object.keys(DIMENSION_WEIGHTS);
  const dimensions = {};
  const evidence = [];
  let riskPenalty = 0;

  for (const key of keys) {
    const component = components[key] || {};
    const unknown = component.unknown === true || component.score == null;
    const score = unknown ? null : clamp(component.score);
    const confidence = clamp(component.confidence ?? (unknown ? 20 : 70));
    dimensions[key] = {
      score,
      confidence,
      evidenceIds: Array.isArray(component.evidenceIds) ? component.evidenceIds : [],
      notes: String(component.notes || ""),
      unknown
    };
    if (key === "riskAdjustment" && !unknown && score != null) {
      // High riskAdjustment score means safer; low means riskier → penalty from distance below 70.
      riskPenalty = Math.max(0, 70 - score) * 0.35;
    }
    for (const id of dimensions[key].evidenceIds) evidence.push(id);
  }

  let weighted = 0;
  let weightSum = 0;
  const confidences = [];
  for (const key of keys) {
    if (key === "riskAdjustment") continue;
    const dim = dimensions[key];
    if (dim.score == null) {
      confidences.push(dim.confidence * 0.5);
      continue;
    }
    weighted += dim.score * DIMENSION_WEIGHTS[key];
    weightSum += DIMENSION_WEIGHTS[key];
    confidences.push(dim.confidence);
  }
  const base = weightSum > 0 ? weighted / weightSum : 0;
  const total = clamp(base - riskPenalty);
  const confidence = clamp(avg(confidences) ?? 25);

  return {
    scoreVersion: SCORE_VERSION,
    dimensions,
    total: Math.round(total),
    confidence: Math.round(confidence),
    evidenceIds: [...new Set(evidence)],
    riskPenalty: Math.round(riskPenalty)
  };
}

/** Backward-compatible adapter for legacy 4-dimension inputs. */
export function scoreCreatorBrandOpportunityLegacy(dimensions = {}) {
  const mapped = scoreOpportunityDimensions({
    creatorFit: { score: dimensions.creatorFit ?? 50, confidence: 60 },
    commercialPotential: { score: dimensions.commercialPotential ?? 50, confidence: 55 },
    creativeOpportunity: { score: dimensions.opportunityGap ?? dimensions.creativeOpportunity ?? 50, confidence: 55 },
    outreachFeasibility: { score: dimensions.outreachLikelihood ?? dimensions.outreachFeasibility ?? 50, confidence: 50 },
    riskAdjustment: { score: dimensions.riskAdjustment ?? 70, confidence: 40, unknown: dimensions.riskAdjustment == null }
  });
  return {
    dimensions: {
      creatorFit: mapped.dimensions.creatorFit.score ?? 0,
      commercialPotential: mapped.dimensions.commercialPotential.score ?? 0,
      opportunityGap: mapped.dimensions.creativeOpportunity.score ?? 0,
      outreachLikelihood: mapped.dimensions.outreachFeasibility.score ?? 0,
      creativeOpportunity: mapped.dimensions.creativeOpportunity.score ?? 0,
      outreachFeasibility: mapped.dimensions.outreachFeasibility.score ?? 0,
      riskAdjustment: mapped.dimensions.riskAdjustment.score
    },
    total: mapped.total,
    confidence: mapped.confidence,
    scoreVersion: mapped.scoreVersion,
    detail: mapped
  };
}

export function buildDimensionFromEvidence(evidenceItems = [], { preferKinds = [EVIDENCE_KINDS.OBSERVED] } = {}) {
  const items = Array.isArray(evidenceItems) ? evidenceItems : [];
  if (!items.length) {
    return { score: null, confidence: 15, evidenceIds: [], notes: "No evidence yet.", unknown: true };
  }
  const preferred = items.filter((item) => preferKinds.includes(item.kind || item.basis));
  const pool = preferred.length ? preferred : items;
  const confidence = clamp(avg(pool.map((item) => item.confidence)) ?? 40);
  const score = clamp(40 + confidence * 0.4);
  return {
    score,
    confidence,
    evidenceIds: pool.map((item) => item.id).filter(Boolean),
    notes: pool[0]?.claim || "",
    unknown: false
  };
}

export function decideOpportunityAction({ total, confidence, riskScore, hasContact, hasObservedSource }) {
  if (riskScore != null && riskScore < 35) {
    return { decision: "avoid_pending_verification", reason: "Risk signals require verification before outreach." };
  }
  if (!hasObservedSource) {
    return { decision: "monitor", reason: "Insufficient observed sources to pursue yet." };
  }
  if (total >= 70 && confidence >= 55 && hasContact) {
    return { decision: "pursue", reason: "Strong fit, creative opportunity, and reachable contact path." };
  }
  if (total >= 55 && confidence >= 40) {
    return { decision: "pursue", reason: "Qualified opportunity with enough evidence to pitch carefully." };
  }
  if (total < 40) {
    return { decision: "deprioritize", reason: "Low composite fit relative to alternatives." };
  }
  return { decision: "monitor", reason: "Promising but incomplete evidence — refresh research before pitching." };
}
