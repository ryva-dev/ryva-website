/**
 * Canonical brand data architecture for Mara.
 *
 * Source of truth
 * ---------------
 * 1. mara_public_brands
 *    Global, reusable public facts only (identity, domain, public programs, social URLs).
 *    No creator thesis, fit scores, or outreach history.
 *
 * 2. mara_brand_evidence
 *    Tenant-scoped evidence rows (user_id + worker_id). Observed / inferred / hypothesis.
 *
 * 3. mara_creator_brand_opportunities
 *    Tenant opportunity SoT: scores, confidence, decision, opportunity package JSON.
 *    Scoring implementation: server/maraOpportunityScoring.mjs (SCORE_VERSION).
 *
 * Derived projections (copy scores; do not invent alternate weights)
 * -----------------------------------------------------------------
 * - worker_brands                 → autonomy operational queue
 * - office_brand_opportunities    → office overlays (fit_score = canonical total)
 *
 * Deprecated
 * ----------
 * - Writing creator-specific thesis into mara_brand_profiles.profile_json
 * - Recomputing office fit with a different formula than SCORE_VERSION
 *
 * Sync direction
 * --------------
 * research providers → public brand + tenant evidence → opportunity package/score
 *                   → project worker_brands + office_brand_opportunities
 */
export const BRAND_ARCHITECTURE_DOC_VERSION = "2026-07-12";
