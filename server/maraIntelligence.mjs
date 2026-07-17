import { randomUUID } from "node:crypto";
import { applyCreatorStageReadiness, cleanDesiredBrandName, isCreatorPreferenceEcho } from "./maraOpportunityScoring.mjs";

export const EVIDENCE_BASIS = new Set(["observed", "inferred", "hypothesis", "creator_preference", "industry_benchmark"]);

const SCORE_WEIGHTS = {
  creatorFit: 0.35,
  commercialPotential: 0.25,
  opportunityGap: 0.25,
  outreachLikelihood: 0.15
};

function boundedScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

export function scoreCreatorBrandOpportunity(dimensions = {}) {
  const normalized = Object.fromEntries(Object.keys(SCORE_WEIGHTS).map((key) => [key, boundedScore(dimensions[key])]));
  const total = Math.round(Object.entries(SCORE_WEIGHTS).reduce((sum, [key, weight]) => sum + normalized[key] * weight, 0));
  return { dimensions: normalized, total };
}

export function validateEvidence(evidence = []) {
  if (!Array.isArray(evidence) || evidence.length === 0) throw new Error("At least one evidence item is required.");
  return evidence.map((item) => {
    const basis = String(item?.basis ?? "").trim().toLowerCase();
    const claim = String(item?.claim ?? "").trim();
    if (!EVIDENCE_BASIS.has(basis)) throw new Error(`Unsupported evidence basis: ${basis || "missing"}.`);
    if (!claim) throw new Error("Every evidence item requires a claim.");
    return {
      basis,
      claim,
      sourceUrl: item?.sourceUrl ? String(item.sourceUrl) : null,
      observedAt: item?.observedAt ? String(item.observedAt) : null,
      confidence: boundedScore(item?.confidence ?? (basis === "observed" ? 90 : basis === "hypothesis" ? 45 : 70))
    };
  });
}

export function buildOpportunityPackage(input) {
  const score = scoreCreatorBrandOpportunity(input.scores);
  const evidence = validateEvidence(input.evidence);
  return {
    brandIntelligence: input.brandIntelligence || {},
    creatorPositioning: input.creatorPositioning || {},
    pitchStrategy: input.pitchStrategy || {},
    creativeTreatment: input.creativeTreatment || {},
    economics: input.economics || {},
    opportunityThesis: String(input.opportunityThesis || "").trim(),
    creativeGap: String(input.creativeGap || "").trim(),
    confidence: Math.round(evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length),
    evidence,
    score
  };
}

export async function initMaraIntelligence(store) {
  if (store.kind === "postgres") return;
  await store.execute(`CREATE TABLE IF NOT EXISTS mara_brand_profiles (
    id TEXT PRIMARY KEY, brand_key TEXT NOT NULL UNIQUE, brand_name TEXT NOT NULL, website TEXT,
    profile_json TEXT NOT NULL, evidence_json TEXT NOT NULL, research_version INTEGER NOT NULL DEFAULT 1,
    last_researched_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  await store.execute(`CREATE TABLE IF NOT EXISTS mara_creator_performance_profiles (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, profile_json TEXT NOT NULL,
    evidence_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(user_id, worker_id)
  )`);
  await store.execute(`CREATE TABLE IF NOT EXISTS mara_creator_brand_opportunities (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, brand_profile_id TEXT NOT NULL,
    status TEXT NOT NULL, score_total INTEGER NOT NULL, scores_json TEXT NOT NULL,
    opportunity_package_json TEXT NOT NULL, evidence_json TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id, worker_id, brand_profile_id)
  )`);
  await store.execute(`CREATE TABLE IF NOT EXISTS mara_creative_analyses (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, asset_type TEXT NOT NULL,
    asset_ref TEXT NOT NULL, analysis_json TEXT NOT NULL, evidence_json TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id, worker_id, asset_type, asset_ref)
  )`);
  await store.execute(`CREATE TABLE IF NOT EXISTS mara_commercial_outcomes (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, opportunity_id TEXT,
    contacted INTEGER NOT NULL DEFAULT 0, responded INTEGER NOT NULL DEFAULT 0, concept_accepted INTEGER NOT NULL DEFAULT 0,
    hired INTEGER NOT NULL DEFAULT 0, rehired INTEGER NOT NULL DEFAULT 0, revenue_amount REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD', outcome_json TEXT NOT NULL, occurred_at TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  const { initMaraBrandArchitecture } = await import("./maraBrandCanonical.mjs");
  await initMaraBrandArchitecture(store);
  try {
    const { ensureOpportunityLifecycleSchema } = await import("./maraOpportunityStateEngine.mjs");
    await ensureOpportunityLifecycleSchema(store);
  } catch {
    /* best-effort */
  }
  try {
    const { ensureLearningSchema } = await import("./maraLearningLoop.mjs");
    await ensureLearningSchema(store);
  } catch {
    /* best-effort */
  }
}

export async function saveBrandProfile(store, profile) {
  const now = new Date().toISOString();
  const id = profile.id || randomUUID();
  const evidence = validateEvidence(profile.evidence);
  // Deprecated dual-write path: public facts only. Prefer savePublicBrand /
  // createOrUpdateOpportunityFromResearch for new code. Legacy mara_brand_profiles
  // receives a public-only stub so older FK references keep resolving.
  const publicOnlyProfile = {
    description: profile.profile?.description || null,
    productCategories: profile.profile?.productCategories || [],
    namedProducts: profile.profile?.namedProducts || [],
    creatorProgramUrl: profile.profile?.creatorProgramUrl || null,
    affiliateProgramUrl: profile.profile?.affiliateProgramUrl || null,
    contactPageUrl: profile.profile?.contactPageUrl || null,
    currentResearchScope: profile.profile?.currentResearchScope || null
  };
  await store.execute(
    `INSERT INTO mara_public_brands
      (id, brand_key, brand_name, website, entity_type, profile_json, research_version, last_researched_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'brand', ?, 1, ?, ?, ?)
     ON CONFLICT(brand_key) DO UPDATE SET brand_name = excluded.brand_name, website = COALESCE(excluded.website, mara_public_brands.website),
       profile_json = excluded.profile_json, research_version = mara_public_brands.research_version + 1,
       last_researched_at = excluded.last_researched_at, updated_at = excluded.updated_at`,
    id, String(profile.brandKey), String(profile.brandName), profile.website || null,
    JSON.stringify(publicOnlyProfile), now, now, now
  );
  try {
    await store.execute(
      `INSERT INTO mara_brand_profiles
        (id, brand_key, brand_name, website, profile_json, evidence_json, research_version, last_researched_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT(brand_key) DO UPDATE SET brand_name = excluded.brand_name, website = excluded.website,
         profile_json = excluded.profile_json, evidence_json = excluded.evidence_json,
         research_version = mara_brand_profiles.research_version + 1,
         last_researched_at = excluded.last_researched_at, updated_at = excluded.updated_at`,
      id, String(profile.brandKey), String(profile.brandName), profile.website || null,
      JSON.stringify(publicOnlyProfile), JSON.stringify(evidence), now, now, now
    );
  } catch {
    /* legacy table may be absent mid-migrate */
  }
  return store.queryOne(`SELECT * FROM mara_public_brands WHERE brand_key = ?`, String(profile.brandKey))
    || store.queryOne(`SELECT * FROM mara_brand_profiles WHERE brand_key = ?`, String(profile.brandKey));
}

export async function saveCreatorPerformanceProfile(store, profile) {
  const now = new Date().toISOString();
  const evidence = validateEvidence(profile.evidence);
  await store.execute(
    `INSERT INTO mara_creator_performance_profiles (id, user_id, worker_id, profile_json, evidence_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_id) DO UPDATE SET profile_json = excluded.profile_json,
       evidence_json = excluded.evidence_json, updated_at = excluded.updated_at`,
    randomUUID(), profile.userId, profile.workerId, JSON.stringify(profile.profile || {}), JSON.stringify(evidence), now, now
  );
}

export async function saveCreatorBrandOpportunity(store, opportunity) {
  const now = new Date().toISOString();
  const packageData = buildOpportunityPackage(opportunity);
  const id = opportunity.id || randomUUID();
  await store.execute(
    `INSERT INTO mara_creator_brand_opportunities
      (id, user_id, worker_id, brand_profile_id, status, score_total, scores_json, opportunity_package_json, evidence_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_id, brand_profile_id) DO UPDATE SET status = excluded.status,
       score_total = excluded.score_total, scores_json = excluded.scores_json,
       opportunity_package_json = excluded.opportunity_package_json, evidence_json = excluded.evidence_json,
       updated_at = excluded.updated_at`,
    id, opportunity.userId, opportunity.workerId, opportunity.brandProfileId, opportunity.status || "candidate",
    packageData.score.total, JSON.stringify(packageData.score.dimensions), JSON.stringify(packageData),
    JSON.stringify(packageData.evidence), now, now
  );
  return { id, ...packageData };
}

export async function recordCommercialOutcome(store, outcome) {
  const now = new Date().toISOString();
  if (outcome.opportunityId) {
    const owned = await store.queryOne(
      `SELECT id FROM mara_creator_brand_opportunities WHERE id = ? AND user_id = ? AND worker_id = ?`,
      outcome.opportunityId, outcome.userId, outcome.workerId
    );
    if (!owned) throw new Error("Opportunity not found for this creator and worker.");
  }
  const revenueAmount = Number(outcome.revenueAmount || 0);
  if (!Number.isFinite(revenueAmount) || revenueAmount < 0) throw new Error("Revenue amount must be a non-negative number.");
  const id = randomUUID();
  await store.execute(
    `INSERT INTO mara_commercial_outcomes
      (id, user_id, worker_id, opportunity_id, contacted, responded, concept_accepted, hired, rehired,
       revenue_amount, currency, outcome_json, occurred_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, outcome.userId, outcome.workerId, outcome.opportunityId || null,
    outcome.contacted ? 1 : 0, outcome.responded ? 1 : 0, outcome.conceptAccepted ? 1 : 0,
    outcome.hired ? 1 : 0, outcome.rehired ? 1 : 0, revenueAmount,
    String(outcome.currency || "USD"), JSON.stringify(outcome.details || {}), outcome.occurredAt || now, now
  );
  const ranking = outcome.opportunityId
    ? await applyCommercialOutcomeToOpportunity(store, {
        userId: outcome.userId,
        workerId: outcome.workerId,
        opportunityId: outcome.opportunityId,
        contacted: Boolean(outcome.contacted),
        responded: Boolean(outcome.responded),
        conceptAccepted: Boolean(outcome.conceptAccepted),
        hired: Boolean(outcome.hired),
        rehired: Boolean(outcome.rehired),
        declined: Boolean(outcome.details?.declined || outcome.declined),
        revenueAmount
      })
    : null;
  return { id, ranking };
}

/**
 * Decide whether research evidence is strong enough to treat a brand as
 * pitch-ready ("qualified") vs still a research candidate.
 */
export function resolveOpportunityStatusFromEvidence(evidence = [], { suggestedAngle = "", contactEmail = "" } = {}) {
  const items = Array.isArray(evidence) ? evidence : [];
  const observedWithSource = items.some(
    (item) => String(item?.basis).toLowerCase() === "observed" && String(item?.sourceUrl || "").trim()
  );
  const hasGap = Boolean(String(suggestedAngle || "").trim());
  if (observedWithSource && hasGap) return "qualified";
  if (observedWithSource || contactEmail) return "candidate";
  return "candidate";
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

/**
 * Outcome → score/status flywheel. Hired/revenue boosts commercial + outreach;
 * contact without response lowers outreach likelihood and can mark cold.
 */
export async function applyCommercialOutcomeToOpportunity(store, outcome) {
  const row = await store.queryOne(
    `SELECT id, status, scores_json AS "scoresJson", opportunity_package_json AS "packageJson",
            evidence_json AS "evidenceJson", brand_profile_id AS "brandProfileId"
     FROM mara_creator_brand_opportunities
     WHERE id = ? AND user_id = ? AND worker_id = ?`,
    outcome.opportunityId, outcome.userId, outcome.workerId
  );
  if (!row) return null;

  const parse = (value, fallback) => {
    if (value && typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const dimensions = {
    creatorFit: 50,
    commercialPotential: 50,
    opportunityGap: 50,
    outreachLikelihood: 50,
    ...parse(row.scoresJson, {})
  };
  let status = String(row.status || "candidate");

  if (outcome.declined && !outcome.hired && !outcome.rehired) {
    dimensions.outreachLikelihood = clampScore(dimensions.outreachLikelihood - 25);
    dimensions.commercialPotential = clampScore(dimensions.commercialPotential - 10);
    status = "lost";
  } else if (outcome.hired || outcome.rehired) {
    dimensions.commercialPotential = clampScore(dimensions.commercialPotential + (outcome.rehired ? 18 : 14));
    dimensions.outreachLikelihood = clampScore(dimensions.outreachLikelihood + 12);
    dimensions.creatorFit = clampScore(dimensions.creatorFit + 8);
    status = outcome.rehired ? "won_repeat" : "won";
  } else if (outcome.conceptAccepted) {
    dimensions.opportunityGap = clampScore(dimensions.opportunityGap + 8);
    dimensions.commercialPotential = clampScore(dimensions.commercialPotential + 6);
    status = status === "won" || status === "won_repeat" ? status : "concept_accepted";
  } else if (outcome.responded) {
    dimensions.outreachLikelihood = clampScore(dimensions.outreachLikelihood + 10);
    status = ["won", "won_repeat", "concept_accepted"].includes(status) ? status : "responded";
  } else if (outcome.contacted) {
    dimensions.outreachLikelihood = clampScore(dimensions.outreachLikelihood - 12);
    status = ["won", "won_repeat", "concept_accepted", "responded"].includes(status) ? status : "contacted";
  }

  if (outcome.contacted && !outcome.responded && !outcome.hired) {
    // Soft-cold: still visible, but autonomy should deprioritize.
    if (dimensions.outreachLikelihood < 35 && !["won", "won_repeat"].includes(status)) {
      status = "cold";
    }
  }

  if (Number(outcome.revenueAmount) > 0) {
    dimensions.commercialPotential = clampScore(dimensions.commercialPotential + Math.min(15, Math.log10(Number(outcome.revenueAmount) + 1) * 6));
  }

  const score = scoreCreatorBrandOpportunity(dimensions);
  const packageData = parse(row.packageJson, {});
  packageData.score = score;
  const now = new Date().toISOString();

  const { LEGACY_STATUS_TO_LIFECYCLE, buildNextAction, legacyStatusFromLifecycle } = await import("./maraOpportunityLifecycle.mjs");
  let lifecycleStage = LEGACY_STATUS_TO_LIFECYCLE[status] || status;
  if (Number(outcome.revenueAmount) > 0 && (outcome.hired || outcome.rehired)) {
    lifecycleStage = "paid";
    status = "won";
  }
  const nextAction = buildNextAction({ lifecycleStage });
  const giftedOnly = Boolean(outcome.details?.giftedOnly || outcome.giftedOnly);
  if (giftedOnly && lifecycleStage === "paid") {
    lifecycleStage = "interested";
  }

  await store.execute(
    `UPDATE mara_creator_brand_opportunities
     SET status = ?, score_total = ?, scores_json = ?, opportunity_package_json = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND worker_id = ?`,
    status, score.total, JSON.stringify(score.dimensions), JSON.stringify(packageData), now,
    outcome.opportunityId, outcome.userId, outcome.workerId
  );

  try {
    await store.execute(
      `UPDATE mara_creator_brand_opportunities
       SET lifecycle_stage = ?, previous_lifecycle_stage = COALESCE(lifecycle_stage, previous_lifecycle_stage),
           stage_changed_at = ?, next_action_json = ?, blocking_reason = ?,
           actual_revenue = CASE WHEN ? > 0 THEN ? ELSE actual_revenue END,
           confirmed_deal_value = CASE WHEN ? > 0 THEN ? ELSE confirmed_deal_value END,
           loss_reason = COALESCE(?, loss_reason)
       WHERE id = ? AND user_id = ?`,
      lifecycleStage,
      now,
      JSON.stringify(nextAction),
      nextAction.blockingReason,
      Number(outcome.revenueAmount || 0),
      Number(outcome.revenueAmount || 0),
      Number(outcome.revenueAmount || 0),
      Number(outcome.revenueAmount || 0),
      outcome.declined ? "Brand declined" : null,
      outcome.opportunityId,
      outcome.userId
    );
  } catch {
    /* lifecycle columns optional until migration */
  }

  try {
    const { applyOutcomeToLearning } = await import("./maraLearningLoop.mjs");
    await applyOutcomeToLearning(store, {
      userId: outcome.userId,
      workerId: outcome.workerId,
      hired: Boolean(outcome.hired || outcome.rehired),
      declined: Boolean(outcome.declined),
      responded: Boolean(outcome.responded),
      giftedOnly
    });
  } catch {
    /* learning is best-effort */
  }

  return {
    opportunityId: outcome.opportunityId,
    status,
    lifecycleStage,
    legacyStatus: legacyStatusFromLifecycle(lifecycleStage),
    scoreTotal: score.total,
    scores: score.dimensions
  };
}

/** Brands Mara should pitch next — high score, not cold/lost, prefer qualified+. */
export async function listTopPitchTargets(store, userId, workerId, limit = 5) {
  const rows = await store.query(
    `SELECT o.id, o.status, o.lifecycle_stage AS "lifecycleStage", o.decision, o.decision_reason AS "decisionReason",
            o.score_total AS "scoreTotal", o.scores_json AS "scoresJson", o.updated_at AS "updatedAt",
            COALESCE(pb.brand_name, b.brand_name) AS "brandName",
            COALESCE(pb.website, b.website) AS website,
            COALESCE(o.public_brand_id, o.brand_profile_id) AS "brandProfileId",
            o.public_brand_id AS "publicBrandId"
     FROM mara_creator_brand_opportunities o
     LEFT JOIN mara_public_brands pb ON pb.id = COALESCE(o.public_brand_id, o.brand_profile_id)
     LEFT JOIN mara_brand_profiles b ON b.id = o.brand_profile_id
     WHERE o.user_id = ? AND o.worker_id = ?
       AND o.status NOT IN ('cold', 'lost', 'won', 'won_repeat', 'responded', 'concept_accepted')
       AND o.score_total >= 45
     ORDER BY
       CASE o.status WHEN 'qualified' THEN 0 WHEN 'active' THEN 1 WHEN 'responded' THEN 2 WHEN 'candidate' THEN 3 ELSE 4 END,
       o.score_total DESC, o.updated_at DESC
     LIMIT ?`,
    userId, workerId, 60
  );
  const parse = (value, fallback) => {
    if (value && typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const { findBestOutreachContact } = await import("./maraContactDiscovery.mjs");
  const { getCreatorIntelligenceProfile } = await import("./maraCreatorProfile.mjs");
  const creatorProfile = await getCreatorIntelligenceProfile(store, userId, workerId);
  const enriched = [];
  for (const row of dedupeBrandOpportunities(rows)) {
    const readiness = applyCreatorStageReadiness({ ...row, creatorProfile });
    if (!readiness.pursueNow) continue;
    const publicBrandId = row.publicBrandId || row.brandProfileId;
    let outreachContact = null;
    if (publicBrandId) {
      try {
        outreachContact = await findBestOutreachContact(store, userId, workerId, publicBrandId);
      } catch {
        outreachContact = null;
      }
    }
    enriched.push({
      ...row,
      scores: parse(row.scoresJson, {}),
      publicBrandId,
      outreachReady: Boolean(outreachContact?.value?.includes("@")),
      contactEmail: outreachContact?.value || null,
      outreachContact: outreachContact
        ? { id: outreachContact.id, value: outreachContact.value, contactType: outreachContact.contactType }
        : null
    });
  }
  return enriched.sort(
    (left, right) => Number(Boolean(right.outreachReady)) - Number(Boolean(left.outreachReady))
  ).slice(0, Math.max(1, Math.min(20, Number(limit) || 5)));
}

function brandNameKey(value) {
  return String(value || "").toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|company|co|corp|corporation)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function brandDomainKey(value) {
  try { return new URL(String(value || "")).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function containsWholeBrandName(value, brandName) {
  const haystack = ` ${brandNameKey(value)} `;
  const needle = brandNameKey(brandName);
  return needle.length >= 3 && haystack.includes(` ${needle} `);
}

function websiteLooksOwnedByBrand(website, brandName) {
  const domain = brandDomainKey(website);
  const compactBrand = brandNameKey(brandName).replace(/\s+/g, "");
  return Boolean(domain && compactBrand.length >= 3 && domain.replace(/[^a-z0-9]/g, "").includes(compactBrand));
}

/**
 * Resolve headline-shaped research records such as "How Gymshark Built..."
 * back to a creator-declared brand. Article publishers must never become
 * separate opportunities or donate their contact details to that brand.
 */
export function resolveCanonicalDesiredBrand(row = {}, desiredBrands = []) {
  const matched = (Array.isArray(desiredBrands) ? desiredBrands : [])
    .map(cleanDesiredBrandName)
    .filter(Boolean)
    .find((desired) => containsWholeBrandName(row.brandName, desired));
  if (!matched) return { ...row, canonicalDesiredBrand: false };
  return {
    ...row,
    brandName: matched,
    website: websiteLooksOwnedByBrand(row.website, matched) ? row.website : null,
    canonicalDesiredBrand: true
  };
}

function removePreferenceEchoes(row) {
  const opportunityPackage = { ...(row.opportunityPackage || {}) };
  const thesis = opportunityPackage.opportunityThesis;
  if (typeof thesis === "string" && isCreatorPreferenceEcho(thesis)) {
    opportunityPackage.opportunityThesis = "";
  } else if (thesis && typeof thesis === "object") {
    const echoesPreference = isCreatorPreferenceEcho(thesis.underrepresented);
    opportunityPackage.opportunityThesis = {
      ...thesis,
      underrepresented: echoesPreference ? null : thesis.underrepresented,
      whyItCouldMatter: isCreatorPreferenceEcho(thesis.whyItCouldMatter) ? null : thesis.whyItCouldMatter,
      hypotheses: (Array.isArray(thesis.hypotheses) ? thesis.hypotheses : []).filter((item) => !isCreatorPreferenceEcho(item?.claim))
    };
  }
  if (isCreatorPreferenceEcho(opportunityPackage.creativeGap)) opportunityPackage.creativeGap = null;
  if (isCreatorPreferenceEcho(opportunityPackage.recommendedConceptTerritory?.messagingAngle)) {
    opportunityPackage.recommendedConceptTerritory = {
      ...opportunityPackage.recommendedConceptTerritory,
      messagingAngle: null
    };
  }
  if (isCreatorPreferenceEcho(opportunityPackage.recommendedPitchStrategy?.pitchFraming)) {
    opportunityPackage.recommendedPitchStrategy = {
      ...opportunityPackage.recommendedPitchStrategy,
      pitchFraming: null
    };
  }
  opportunityPackage.evidence = (Array.isArray(opportunityPackage.evidence) ? opportunityPackage.evidence : [])
    .filter((item) => !isCreatorPreferenceEcho(item?.claim));
  return {
    ...row,
    opportunityPackage,
    evidence: (Array.isArray(row.evidence) ? row.evidence : []).filter((item) => !isCreatorPreferenceEcho(item?.claim))
  };
}

/** Collapses legacy name-keyed and canonical domain-keyed research into one brand decision. */
export function dedupeBrandOpportunities(rows = []) {
  const groups = [];
  for (const row of rows) {
    const name = brandNameKey(row.brandName);
    const domain = brandDomainKey(row.website);
    let group = groups.find((candidate) => (name && candidate.names.has(name)) || (domain && candidate.domains.has(domain)));
    if (!group) {
      group = { names: new Set(), domains: new Set(), rows: [] };
      groups.push(group);
    }
    if (name) group.names.add(name);
    if (domain) group.domains.add(domain);
    group.rows.push(row);
  }
  const stageRank = (row) => {
    const value = String(row.lifecycleStage || row.status || "").toLowerCase();
    return ["paid", "payment_due", "in_production", "contracted", "negotiating", "responded", "active", "qualified", "candidate", "researching", "discovered"].indexOf(value);
  };
  return groups.map((group) => {
    const ordered = [...group.rows].sort((left, right) => {
      const leftRank = stageRank(left); const rightRank = stageRank(right);
      if (leftRank !== rightRank) return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank);
      return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    });
    const primary = ordered[0];
    const evidence = ordered.flatMap((row) => Array.isArray(row.evidence) ? row.evidence : []);
    return {
      ...primary,
      evidence: [...new Map(evidence.map((item) => [`${item?.kind || item?.basis}:${item?.claim}`, item])).values()],
      sourceBrandIds: [...new Set(ordered.flatMap((row) => [row.publicBrandId, row.brandProfileId]).filter(Boolean))],
      mergedResearchRecords: ordered.length
    };
  });
}

function validateTimestamp(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(text)) throw new Error(`Invalid feedback timestamp: ${text || "missing"}.`);
  return text;
}

export function validateCreativeAnalysis(analysis = {}) {
  const timestampedFeedback = Array.isArray(analysis.timestampedFeedback) ? analysis.timestampedFeedback : [];
  if (timestampedFeedback.length === 0) throw new Error("Creative analysis requires timestamped feedback.");
  const requiredSections = ["videoStructure", "creativeStrategy", "performanceMechanics", "execution"];
  for (const section of requiredSections) {
    if (!analysis[section] || typeof analysis[section] !== "object" || Array.isArray(analysis[section])) {
      throw new Error(`Creative analysis requires a structured ${section} section.`);
    }
  }
  return {
    assetSummary: String(analysis.assetSummary || "").trim(),
    videoStructure: analysis.videoStructure,
    creativeStrategy: analysis.creativeStrategy,
    performanceMechanics: analysis.performanceMechanics,
    execution: analysis.execution,
    timestampedFeedback: timestampedFeedback.map((item) => {
      const observation = String(item?.observation || "").trim();
      const consequence = String(item?.consequence || "").trim();
      const revision = String(item?.revision || "").trim();
      if (!observation || !consequence || !revision) throw new Error("Each timestamp requires an observation, consequence, and revision.");
      return { at: validateTimestamp(item.at), observation, consequence, revision };
    }),
    unknowns: Array.isArray(analysis.unknowns) ? analysis.unknowns.map(String).filter(Boolean) : [],
    isMock: Boolean(analysis.isMock),
    providerHonesty: analysis.providerHonesty ? String(analysis.providerHonesty) : null
  };
}

export async function saveCreativeAnalysis(store, input) {
  const now = new Date().toISOString();
  const assetType = String(input.assetType || "").trim();
  const assetRef = String(input.assetRef || "").trim();
  if (!assetType || !assetRef) throw new Error("Creative analysis requires an asset type and reference.");
  const analysis = validateCreativeAnalysis(input.analysis);
  const evidence = validateEvidence(input.evidence);
  const id = input.id || randomUUID();
  await store.execute(
    `INSERT INTO mara_creative_analyses
      (id, user_id, worker_id, asset_type, asset_ref, analysis_json, evidence_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_id, asset_type, asset_ref) DO UPDATE SET
       analysis_json = excluded.analysis_json, evidence_json = excluded.evidence_json, updated_at = excluded.updated_at`,
    id, input.userId, input.workerId, assetType, assetRef,
    JSON.stringify(analysis), JSON.stringify(evidence), now, now
  );
  return { id, analysis, evidence };
}

export async function listCreativeAnalyses(store, userId, workerId, limit = 20) {
  const rows = await store.query(
    `SELECT id, asset_type AS "assetType", asset_ref AS "assetRef", analysis_json AS "analysisJson",
            evidence_json AS "evidenceJson", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM mara_creative_analyses WHERE user_id = ? AND worker_id = ?
     ORDER BY updated_at DESC LIMIT ?`,
    userId, workerId, Math.max(1, Math.min(100, Number(limit) || 20))
  );
  const parse = (value, fallback) => {
    if (value && typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return fallback; }
  };
  return rows.map((row) => ({ ...row, analysis: parse(row.analysisJson, {}), evidence: parse(row.evidenceJson, []) }));
}

export async function getRevenueInfluenceMetrics(store, userId, workerId) {
  const row = await store.queryOne(
    `SELECT COUNT(*) AS opportunities,
            SUM(contacted) AS contacted, SUM(responded) AS responded,
            SUM(concept_accepted) AS "conceptsAccepted", SUM(hired) AS deals,
            SUM(rehired) AS "repeatDeals", SUM(revenue_amount) AS "revenueInfluenced",
            AVG(CASE WHEN revenue_amount > 0 THEN revenue_amount END) AS "averageDealValue"
     FROM mara_commercial_outcomes WHERE user_id = ? AND worker_id = ?`,
    userId, workerId
  );
  const qualified = await store.queryOne(
    `SELECT COUNT(*) AS count FROM mara_creator_brand_opportunities
     WHERE user_id = ? AND worker_id = ? AND status IN ('qualified', 'active', 'responded', 'concept_accepted', 'won', 'won_repeat')`,
    userId, workerId
  );
  const number = (value) => Number(value || 0);
  const contacted = number(row?.contacted);
  const responded = number(row?.responded);
  const deals = number(row?.deals);
  return {
    opportunitiesTracked: number(row?.opportunities),
    qualifiedOpportunityCount: number(qualified?.count),
    contacted,
    responded,
    conceptsAccepted: number(row?.conceptsAccepted),
    deals,
    repeatDeals: number(row?.repeatDeals),
    revenueInfluenced: number(row?.revenueInfluenced),
    averageDealValue: number(row?.averageDealValue),
    positiveResponseRate: contacted ? responded / contacted : 0,
    pitchToDealConversion: contacted ? deals / contacted : 0
  };
}

export async function getMaraGrowthIntelligenceSnapshot(store, userId, workerId) {
  const opportunities = await store.query(
    `SELECT o.id, o.status, o.score_total AS "scoreTotal", o.scores_json AS "scoresJson",
            o.opportunity_package_json AS "opportunityPackageJson", o.evidence_json AS "evidenceJson",
            o.decision, o.decision_reason AS "decisionReason", o.confidence,
            o.lifecycle_stage AS "lifecycleStage", o.updated_at AS "updatedAt",
            COALESCE(o.public_brand_id, o.brand_profile_id) AS "publicBrandId",
            COALESCE(pb.brand_name, b.brand_name) AS "brandName",
            COALESCE(pb.website, b.website) AS website,
            COALESCE(pb.last_researched_at, b.last_researched_at) AS "lastResearchedAt"
     FROM mara_creator_brand_opportunities o
     LEFT JOIN mara_public_brands pb ON pb.id = COALESCE(o.public_brand_id, o.brand_profile_id)
     LEFT JOIN mara_brand_profiles b ON b.id = o.brand_profile_id
     WHERE o.user_id = ? AND o.worker_id = ?
     ORDER BY o.score_total DESC, o.updated_at DESC LIMIT 25`,
    userId, workerId
  );
  const parse = (value, fallback) => {
    if (value && typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const { findBestOutreachContact, listBrandContacts } = await import("./maraContactDiscovery.mjs");
  const { getCreatorIntelligenceProfile } = await import("./maraCreatorProfile.mjs");
  const creatorProfile = await getCreatorIntelligenceProfile(store, userId, workerId);
  const parsed = opportunities.map((row) => {
    const { scoresJson, opportunityPackageJson, evidenceJson, ...publicRow } = row;
    return removePreferenceEchoes(resolveCanonicalDesiredBrand({
      ...publicRow,
      scores: parse(scoresJson, {}),
      opportunityPackage: parse(opportunityPackageJson, {}),
      evidence: parse(evidenceJson, [])
    }, creatorProfile?.business?.desiredBrands));
  });
  const enriched = [];
  for (const row of dedupeBrandOpportunities(parsed)) {
    let outreachContact = null;
    let contacts = [];
    const brandIds = row.sourceBrandIds?.length ? row.sourceBrandIds : [row.publicBrandId].filter(Boolean);
    if (brandIds.length) {
      try {
        for (const brandId of brandIds) {
          contacts.push(...await listBrandContacts(store, userId, workerId, brandId));
          const candidate = await findBestOutreachContact(store, userId, workerId, brandId);
          if (!outreachContact || candidate?.value?.includes("@")) outreachContact = candidate || outreachContact;
        }
      } catch {
        contacts = [];
      }
    }
    contacts = contacts.filter((contact) => {
      const local = String(contact?.value || "").split("@")[0] || "";
      return !/^(press|pr|media|news|journalist|editorial)$/i.test(local);
    });
    if (row.canonicalDesiredBrand) {
      const brandToken = brandNameKey(row.brandName).replace(/\s+/g, "");
      contacts = contacts.filter((contact) => {
        const emailDomain = String(contact?.value || "").split("@")[1]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
        return brandToken.length >= 3 && emailDomain.includes(brandToken);
      });
    }
    outreachContact = contacts.find((contact) => Number(contact.mayUseForOutreach) === 1 && String(contact.value || "").includes("@")) || null;
    const readiness = applyCreatorStageReadiness({ ...row, creatorProfile });
    enriched.push({
      ...row,
      decision: readiness.decision,
      decisionReason: readiness.decisionReason,
      readiness: readiness.readiness,
      outreachReady: Boolean(outreachContact?.value?.includes("@")),
      outreachContact: outreachContact
        ? {
            id: outreachContact.id,
            value: outreachContact.value,
            contactType: outreachContact.contactType,
            source: outreachContact.source
          }
        : null,
      contacts: contacts.slice(0, 5).map((contact) => ({
        id: contact.id,
        value: contact.value,
        contactType: contact.contactType,
        mayUseForOutreach: Number(contact.mayUseForOutreach) === 1,
        inferred: Boolean(Number(contact.inferred)),
        source: contact.source,
        confidence: contact.confidence
      }))
    });
  }
  const metrics = await getRevenueInfluenceMetrics(store, userId, workerId);
  // Legacy research rows can outnumber the canonical brands shown above.
  // The visible pipeline count must describe the same deduplicated book of
  // business the creator is looking at, not obsolete article-shaped rows.
  metrics.qualifiedOpportunityCount = enriched.filter((row) => {
    const status = String(row.status || "").toLowerCase();
    if (["discarded", "lost"].includes(status)) return false;
    // Dream / later targets stay tracked but do not inflate "qualified now."
    if (row.readiness === "later" || row.decision === "build_toward") return false;
    return true;
  }).length;
  enriched.sort((left, right) => {
    const leftLater = left.readiness === "later" || left.decision === "build_toward" ? 1 : 0;
    const rightLater = right.readiness === "later" || right.decision === "build_toward" ? 1 : 0;
    if (leftLater !== rightLater) return leftLater - rightLater;
    const leftReady = Number(Boolean(left.outreachReady));
    const rightReady = Number(Boolean(right.outreachReady));
    if (leftReady !== rightReady) return rightReady - leftReady;
    return Number(right.scoreTotal || 0) - Number(left.scoreTotal || 0);
  });
  return {
    opportunities: enriched,
    metrics,
    creativeAnalyses: await listCreativeAnalyses(store, userId, workerId, 10)
  };
}
