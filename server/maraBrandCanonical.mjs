/**
 * Canonical brand architecture for Mara.
 *
 * Source of truth:
 *   - Public facts:        mara_public_brands (+ provider runs)
 *   - Tenant evidence:     mara_brand_evidence
 *   - Opportunity/scores:  mara_creator_brand_opportunities (scoring via maraOpportunityScoring.mjs)
 *
 * Projections (must copy scores, never invent alternate weights):
 *   - worker_brands              → autonomy operational queue
 *   - office_brand_opportunities → office overlays
 *
 * Deprecated write path:
 *   - Direct writes to mara_brand_profiles (legacy). Prefer savePublicBrand / saveTenantEvidence.
 */
import { randomUUID } from "node:crypto";
import { createEvidenceItem, validateEvidenceList } from "./maraEvidence.mjs";

const LISTICLE_RE = /\b(best|top)\s+\d+|brands?\s+to\s+know|roundup|listicle|case study|growth tactics?|competitive advantage|marketing strateg(?:y|ies)|b2b lessons?|how .{0,40}\bbuilt\b/i;
const MARKETPLACE_HOSTS = new Set([
  "amazon.com", "etsy.com", "ebay.com", "walmart.com", "target.com", "alibaba.com"
]);
const AGENCY_HINTS = /\b(agency|influencer\s+marketing|ugc\s+agency|talent\s+management)\b/i;

export function normalizeBrandKey(nameOrDomain) {
  return String(nameOrDomain || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export function extractCanonicalDomain(url) {
  try {
    const host = new URL(String(url)).hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

export function classifyBrandEntity({ brandName = "", website = "", pageTitle = "", metaDescription = "" } = {}) {
  const blob = `${brandName} ${pageTitle} ${metaDescription}`.trim();
  const domain = extractCanonicalDomain(website) || "";
  if (LISTICLE_RE.test(blob) || LISTICLE_RE.test(pageTitle)) {
    return { entityType: "listicle", reject: true, reason: "Appears to be an article or listicle, not a brand." };
  }
  if (MARKETPLACE_HOSTS.has(domain) || /\b(marketplace|storefront)\b/i.test(blob)) {
    return { entityType: "marketplace", reject: true, reason: "Appears to be a marketplace/retailer listing page." };
  }
  if (AGENCY_HINTS.test(blob)) {
    return { entityType: "agency", reject: true, reason: "Appears to be an agency, not an end brand." };
  }
  if (!domain && !brandName) {
    return { entityType: "unknown", reject: true, reason: "Insufficient identity signals." };
  }
  return { entityType: "brand", reject: false, reason: null, canonicalDomain: domain || null };
}

export async function initMaraBrandArchitecture(store) {
  if (store.kind === "postgres") return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS mara_public_brands (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL UNIQUE, brand_name TEXT NOT NULL,
      canonical_domain TEXT, website TEXT, parent_company TEXT,
      alternate_names_json TEXT NOT NULL DEFAULT '[]', social_profiles_json TEXT NOT NULL DEFAULT '{}',
      entity_type TEXT NOT NULL DEFAULT 'brand', profile_json TEXT NOT NULL DEFAULT '{}',
      research_version INTEGER NOT NULL DEFAULT 1, last_researched_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS mara_brand_evidence (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, public_brand_id TEXT,
      kind TEXT NOT NULL, claim TEXT NOT NULL, source_url TEXT, source_provider TEXT, raw_excerpt TEXT,
      confidence INTEGER NOT NULL DEFAULT 70, observed_at TEXT, created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS mara_research_provider_runs (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, provider_name TEXT NOT NULL,
      research_type TEXT NOT NULL, query TEXT NOT NULL, retrieved_url TEXT, status TEXT NOT NULL,
      reliability REAL, freshness_hours INTEGER, observations_json TEXT NOT NULL DEFAULT '[]',
      error_text TEXT, rate_limited INTEGER NOT NULL DEFAULT 0, started_at TEXT NOT NULL,
      finished_at TEXT, created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS mara_ad_observations (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, public_brand_id TEXT,
      platform TEXT, source_url TEXT, external_id TEXT, asset_type TEXT, status TEXT NOT NULL DEFAULT 'unknown',
      observation_json TEXT NOT NULL, evidence_ids_json TEXT NOT NULL DEFAULT '[]', confidence INTEGER NOT NULL DEFAULT 50,
      first_observed_at TEXT NOT NULL, last_observed_at TEXT NOT NULL, created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS mara_brand_contacts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, public_brand_id TEXT NOT NULL,
      contact_type TEXT NOT NULL, value TEXT NOT NULL, source TEXT NOT NULL, source_url TEXT,
      verification_state TEXT NOT NULL DEFAULT 'unverified', confidence INTEGER NOT NULL DEFAULT 40,
      may_use_for_outreach INTEGER NOT NULL DEFAULT 0, inferred INTEGER NOT NULL DEFAULT 0,
      bounce_state TEXT, metadata_json TEXT NOT NULL DEFAULT '{}',
      retrieved_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(user_id, worker_id, public_brand_id, contact_type, value)
    )`,
    `CREATE TABLE IF NOT EXISTS mara_creator_intelligence_profiles (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL,
      business_json TEXT NOT NULL DEFAULT '{}', creative_json TEXT NOT NULL DEFAULT '{}',
      commercial_json TEXT NOT NULL DEFAULT '{}', learned_json TEXT NOT NULL DEFAULT '{}',
      provenance_json TEXT NOT NULL DEFAULT '{}', confidence INTEGER NOT NULL DEFAULT 50,
      last_updated_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(user_id, worker_id)
    )`,
    `CREATE TABLE IF NOT EXISTS mara_creative_patterns (
      id TEXT PRIMARY KEY, user_id TEXT, worker_id TEXT, public_brand_id TEXT,
      taxonomy_json TEXT NOT NULL, source TEXT NOT NULL, category TEXT, product TEXT,
      evidence_ids_json TEXT NOT NULL DEFAULT '[]', frequency INTEGER NOT NULL DEFAULT 1,
      confidence INTEGER NOT NULL DEFAULT 50, saturation_estimate REAL, performance_json TEXT NOT NULL DEFAULT '{}',
      first_observed_at TEXT NOT NULL, last_observed_at TEXT NOT NULL, created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS mara_creative_concepts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, opportunity_id TEXT,
      public_brand_id TEXT, signature TEXT NOT NULL, concept_json TEXT NOT NULL,
      evidence_ids_json TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(user_id, worker_id, signature)
    )`,
    `CREATE TABLE IF NOT EXISTS mara_outreach_sequences (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, opportunity_id TEXT,
      public_brand_id TEXT, contact_id TEXT, status TEXT NOT NULL DEFAULT 'active',
      attempt_count INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3,
      next_run_at TEXT, stop_reason TEXT, steps_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS mara_media_assets (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, file_id TEXT,
      storage_key TEXT NOT NULL, content_type TEXT NOT NULL, byte_size INTEGER NOT NULL,
      duration_seconds REAL, status TEXT NOT NULL DEFAULT 'uploaded', processing_error TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS mara_video_analyses (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, media_asset_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', analysis_json TEXT NOT NULL DEFAULT '{}',
      timeline_json TEXT NOT NULL DEFAULT '[]', evidence_json TEXT NOT NULL DEFAULT '[]',
      provider_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(user_id, worker_id, media_asset_id)
    )`,
    `CREATE TABLE IF NOT EXISTS mara_autonomy_limits (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, limits_json TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id, worker_id)
    )`,
    `CREATE TABLE IF NOT EXISTS mara_score_change_log (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, opportunity_id TEXT NOT NULL,
      score_version TEXT NOT NULL, previous_total INTEGER, next_total INTEGER, reason TEXT NOT NULL,
      evidence_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
    )`
  ];
  for (const sql of statements) {
    await store.execute(sql);
  }
  // Best-effort column adds for SQLite (ignore if exist).
  for (const alter of [
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN score_version TEXT DEFAULT '2026-07-12.1'`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN confidence INTEGER DEFAULT 50`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN public_brand_id TEXT`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN decision TEXT DEFAULT 'monitor'`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN decision_reason TEXT`
  ]) {
    try {
      await store.execute(alter);
    } catch {
      /* column may already exist */
    }
  }
}

export async function savePublicBrand(store, input) {
  const classification = classifyBrandEntity(input);
  if (classification.reject) {
    const error = new Error(classification.reason);
    error.code = "BRAND_ENTITY_REJECTED";
    error.entityType = classification.entityType;
    throw error;
  }
  const now = new Date().toISOString();
  const canonicalDomain = classification.canonicalDomain || extractCanonicalDomain(input.website) || null;
  let brandKey = String(input.brandKey || normalizeBrandKey(canonicalDomain || input.brandName));
  const existingIdentity = await store.queryOne(
    `SELECT id, brand_key AS "brandKey" FROM mara_public_brands
     WHERE brand_key = ?
        OR canonical_domain = ?
        OR lower(brand_name) = lower(?)
     ORDER BY CASE WHEN brand_key = ? THEN 0 WHEN canonical_domain = ? THEN 1 ELSE 2 END
     LIMIT 1`,
    brandKey,
    canonicalDomain,
    String(input.brandName),
    brandKey,
    canonicalDomain
  );
  if (existingIdentity?.brandKey) brandKey = existingIdentity.brandKey;
  const id = existingIdentity?.id || input.id || randomUUID();
  const publicProfile = {
    description: input.description || null,
    productCategories: input.productCategories || [],
    namedProducts: input.namedProducts || [],
    creatorProgramUrl: input.creatorProgramUrl || null,
    affiliateProgramUrl: input.affiliateProgramUrl || null,
    contactPageUrl: input.contactPageUrl || null
  };
  // Never spread arbitrary input.profile — that is how creator thesis leaked into global brands.
  await store.execute(
    `INSERT INTO mara_public_brands
      (id, brand_key, brand_name, canonical_domain, website, parent_company, alternate_names_json,
       social_profiles_json, entity_type, profile_json, research_version, last_researched_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
     ON CONFLICT(brand_key) DO UPDATE SET
       brand_name = excluded.brand_name,
       canonical_domain = COALESCE(excluded.canonical_domain, mara_public_brands.canonical_domain),
       website = COALESCE(excluded.website, mara_public_brands.website),
       parent_company = COALESCE(excluded.parent_company, mara_public_brands.parent_company),
       alternate_names_json = excluded.alternate_names_json,
       social_profiles_json = excluded.social_profiles_json,
       entity_type = excluded.entity_type,
       profile_json = excluded.profile_json,
       research_version = mara_public_brands.research_version + 1,
       last_researched_at = excluded.last_researched_at,
       updated_at = excluded.updated_at`,
    id,
    brandKey,
    String(input.brandName),
    canonicalDomain,
    input.website || null,
    input.parentCompany || null,
    JSON.stringify(input.alternateNames || []),
    JSON.stringify(input.socialProfiles || {}),
    classification.entityType,
    JSON.stringify(publicProfile),
    now,
    now,
    now
  );
  // FK compatibility stub only — never store creator thesis on the legacy table.
  try {
    await store.execute(
      `INSERT INTO mara_brand_profiles
        (id, brand_key, brand_name, website, profile_json, evidence_json, research_version, last_researched_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', 1, ?, ?, ?)
       ON CONFLICT(brand_key) DO UPDATE SET
         brand_name = excluded.brand_name,
         website = COALESCE(excluded.website, mara_brand_profiles.website),
         profile_json = excluded.profile_json,
         last_researched_at = excluded.last_researched_at,
         updated_at = excluded.updated_at`,
      id,
      brandKey,
      String(input.brandName),
      input.website || null,
      JSON.stringify(publicProfile),
      now,
      now,
      now
    );
  } catch {
    /* legacy table optional */
  }
  return store.queryOne(`SELECT * FROM mara_public_brands WHERE brand_key = ?`, brandKey);
}

export async function saveTenantEvidence(store, { userId, workerId, publicBrandId, evidence }) {
  const items = validateEvidenceList(Array.isArray(evidence) ? evidence : [evidence]);
  const now = new Date().toISOString();
  const saved = [];
  for (const item of items) {
    const id = randomUUID();
    await store.execute(
      `INSERT INTO mara_brand_evidence
        (id, user_id, worker_id, public_brand_id, kind, claim, source_url, source_provider, raw_excerpt, confidence, observed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      userId,
      workerId,
      publicBrandId || null,
      item.kind,
      item.claim,
      item.sourceUrl,
      item.sourceProvider || null,
      item.rawExcerpt,
      item.confidence,
      item.observedAt || now,
      now
    );
    saved.push({ ...item, id });
  }
  return saved;
}

export async function recordResearchProviderRun(store, run) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await store.execute(
    `INSERT INTO mara_research_provider_runs
      (id, user_id, worker_id, provider_name, research_type, query, retrieved_url, status, reliability,
       freshness_hours, observations_json, error_text, rate_limited, started_at, finished_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    run.userId,
    run.workerId,
    run.providerName,
    run.researchType,
    run.query,
    run.retrievedUrl || null,
    run.status,
    run.reliability ?? null,
    run.freshnessHours ?? null,
    JSON.stringify(run.observations || []),
    run.error || null,
    run.rateLimited ? 1 : 0,
    run.startedAt || now,
    run.finishedAt || now,
    now
  );
  return id;
}

/** Project opportunity score into worker_brands without alternate weighting. */
export async function projectOpportunityToWorkerBrand(store, { userId, workerId, brandName, website, opportunity }) {
  try {
    const now = new Date().toISOString();
    const normalized = normalizeBrandKey(brandName);
    const existing = await store.queryOne(
      `SELECT id FROM worker_brands WHERE user_id = ? AND worker_id = ? AND normalized_name = ?`,
      userId,
      workerId,
      normalized
    );
    const identitySummary = String(opportunity?.opportunityPackage?.brandSummary?.description || opportunity?.opportunityThesis || "").slice(0, 400);
    if (existing?.id) {
      await store.execute(
        `UPDATE worker_brands SET brand_name = ?, website = COALESCE(?, website), identity_summary = ?, updated_at = ? WHERE id = ?`,
        brandName,
        website || null,
        identitySummary,
        now,
        existing.id
      );
      return existing.id;
    }
    const id = randomUUID();
    await store.execute(
      `INSERT INTO worker_brands
        (id, user_id, worker_id, brand_name, normalized_name, website, contact_email, identity_summary,
         niche_fit_notes, content_gap, suggested_angle, research_item_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '', ?, '', '', '', NULL, ?, ?)`,
      id,
      userId,
      workerId,
      brandName,
      normalized,
      website || null,
      identitySummary,
      now,
      now
    );
    return id;
  } catch {
    return null;
  }
}

export function officeFitScoreFromCanonical(scoreTotal, confidence) {
  // Projection only — do not invent a second formula.
  return {
    fitScore: Number(scoreTotal) || 0,
    confidence: Number(confidence) || 0,
    scoreSource: "mara_opportunity_scoring",
    scoreVersion: "2026-07-12.1"
  };
}

export { createEvidenceItem };
