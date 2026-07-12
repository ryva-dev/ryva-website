/**
 * Structured creator intelligence profile (complements onboarding knowledge).
 */
import { randomUUID } from "node:crypto";
import { EVIDENCE_KINDS } from "./maraEvidence.mjs";

const EMPTY_PROFILE = () => ({
  business: {
    creatorStage: null,
    activePlatforms: [],
    currentRevenueSources: [],
    currentNiches: [],
    targetNiches: [],
    audienceNotes: null,
    geographicEligibility: [],
    desiredBrands: [],
    excludedBrands: [],
    incomeGoals: null,
    monthlyCapacity: null,
    preferredDealTypes: []
  },
  creative: {
    deliveryStyles: [],
    strongestFormats: [],
    filmingEnvironments: [],
    equipment: [],
    editingCapability: null,
    onCameraComfort: null,
    voiceoverComfort: null,
    demonstrationAbility: null,
    humorStyle: null,
    authorityAreas: [],
    visualAesthetic: null,
    authenticProductCategories: [],
    contentBoundaries: [],
    claimsWillNotMake: [],
    previousBrandCategories: [],
    strongestPortfolioExamples: [],
    weakPortfolioCategories: []
  },
  commercial: {
    currentRates: null,
    minimumRates: null,
    giftedWorkPolicy: null,
    affiliatePolicy: null,
    usageRightsPreferences: null,
    exclusivityPreferences: null,
    whitelistingPolicy: null,
    turnaroundTimes: null,
    revisionPolicy: null,
    knownClientOutcomes: [],
    previousRepeatClients: []
  },
  learned: {
    outreachResponseByCategory: {},
    pitchStylesThatProduceReplies: [],
    acceptedConcepts: [],
    rejectedConcepts: [],
    contentPatternsWithBetterOutcomes: [],
    brandFeedback: [],
    repeatWorkSignals: [],
    revenueByOpportunityType: {}
  }
});

function mergeSection(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  const next = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    next[key] = value;
  }
  return next;
}

export async function getCreatorIntelligenceProfile(store, userId, workerId) {
  const row = await store.queryOne(
    `SELECT id, business_json AS "businessJson", creative_json AS "creativeJson",
            commercial_json AS "commercialJson", learned_json AS "learnedJson",
            provenance_json AS "provenanceJson", confidence, last_updated_at AS "lastUpdatedAt",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM mara_creator_intelligence_profiles WHERE user_id = ? AND worker_id = ?`,
    userId,
    workerId
  );
  const parse = (value, fallback) => {
    if (value && typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  if (!row) {
    return { ...EMPTY_PROFILE(), confidence: 0, provenance: {}, lastUpdatedAt: null, id: null };
  }
  return {
    id: row.id,
    business: { ...EMPTY_PROFILE().business, ...parse(row.businessJson, {}) },
    creative: { ...EMPTY_PROFILE().creative, ...parse(row.creativeJson, {}) },
    commercial: { ...EMPTY_PROFILE().commercial, ...parse(row.commercialJson, {}) },
    learned: { ...EMPTY_PROFILE().learned, ...parse(row.learnedJson, {}) },
    provenance: parse(row.provenanceJson, {}),
    confidence: Number(row.confidence || 0),
    lastUpdatedAt: row.lastUpdatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function upsertCreatorIntelligenceProfile(store, { userId, workerId, business, creative, commercial, learned, provenance, confidence }) {
  const current = await getCreatorIntelligenceProfile(store, userId, workerId);
  const now = new Date().toISOString();
  const next = {
    business: mergeSection(current.business, business),
    creative: mergeSection(current.creative, creative),
    commercial: mergeSection(current.commercial, commercial),
    learned: mergeSection(current.learned, learned)
  };
  // Refuse demographic inference fields if somehow passed.
  delete next.creative.inferredDemographics;
  delete next.business.inferredAge;
  delete next.business.inferredGender;
  const prov = {
    ...current.provenance,
    ...provenance,
    lastWriteAt: now,
    lastWriteBasis: provenance?.basis || EVIDENCE_KINDS.CREATOR_PREFERENCE
  };
  if (current.id) {
    await store.execute(
      `UPDATE mara_creator_intelligence_profiles
       SET business_json = ?, creative_json = ?, commercial_json = ?, learned_json = ?,
           provenance_json = ?, confidence = ?, last_updated_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      JSON.stringify(next.business),
      JSON.stringify(next.creative),
      JSON.stringify(next.commercial),
      JSON.stringify(next.learned),
      JSON.stringify(prov),
      Number(confidence ?? Math.max(current.confidence, 60)),
      now,
      now,
      current.id,
      userId
    );
    return getCreatorIntelligenceProfile(store, userId, workerId);
  }
  const id = randomUUID();
  await store.execute(
    `INSERT INTO mara_creator_intelligence_profiles
      (id, user_id, worker_id, business_json, creative_json, commercial_json, learned_json,
       provenance_json, confidence, last_updated_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    userId,
    workerId,
    JSON.stringify(next.business),
    JSON.stringify(next.creative),
    JSON.stringify(next.commercial),
    JSON.stringify(next.learned),
    JSON.stringify(prov),
    Number(confidence ?? 55),
    now,
    now,
    now
  );
  return getCreatorIntelligenceProfile(store, userId, workerId);
}

/** Seed profile fields from onboarding answers without inventing demographics. */
export async function seedCreatorProfileFromOnboarding(store, { userId, workerId, answers = {} }) {
  const niche = String(answers.niche_focus || "").trim();
  const dreams = String(answers.dream_brands || "").trim();
  const stage = String(answers.current_stage || "").trim();
  return upsertCreatorIntelligenceProfile(store, {
    userId,
    workerId,
    business: {
      creatorStage: stage || null,
      currentNiches: niche ? [niche.slice(0, 200)] : [],
      targetNiches: niche ? [niche.slice(0, 200)] : [],
      desiredBrands: dreams ? dreams.split(/,|\n/).map((value) => value.trim()).filter(Boolean).slice(0, 20) : []
    },
    provenance: { basis: EVIDENCE_KINDS.CREATOR_PREFERENCE, source: "onboarding" },
    confidence: 60
  });
}

export async function applyOutcomeToCreatorLearning(store, { userId, workerId, outcome }) {
  const profile = await getCreatorIntelligenceProfile(store, userId, workerId);
  const learned = { ...profile.learned };
  if (outcome.responded) {
    learned.pitchStylesThatProduceReplies = [...new Set([...(learned.pitchStylesThatProduceReplies || []), outcome.pitchStyle || "personalized"])].slice(0, 20);
  }
  if (outcome.conceptAccepted) {
    learned.acceptedConcepts = [...(learned.acceptedConcepts || []), { at: new Date().toISOString(), note: outcome.claim || "concept accepted" }].slice(-30);
  }
  if (outcome.hired && Number(outcome.revenueAmount) > 0) {
    const key = outcome.opportunityType || "paid";
    learned.revenueByOpportunityType = {
      ...learned.revenueByOpportunityType,
      [key]: Number(learned.revenueByOpportunityType?.[key] || 0) + Number(outcome.revenueAmount)
    };
  }
  // Soft updates only — one event cannot swing confidence wildly.
  const confidence = Math.min(95, (profile.confidence || 40) + 2);
  return upsertCreatorIntelligenceProfile(store, {
    userId,
    workerId,
    learned,
    confidence,
    provenance: { basis: EVIDENCE_KINDS.DERIVED, source: "commercial_outcome", outcomeId: outcome.id || null }
  });
}
