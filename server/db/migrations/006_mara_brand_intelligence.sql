-- Phase: Mara brand intelligence architecture
-- Canonical model:
--   mara_public_brands              = global, reusable public brand facts (no creator thesis)
--   mara_brand_evidence             = tenant-scoped evidence rows (user_id + worker_id)
--   mara_creator_brand_opportunities = tenant opportunity + scores + package (SoT for fit)
--   worker_brands                   = operational projection for autonomy pitch queues
--   office_brand_opportunities      = office UI projection (derived; do not invent scores)
-- Scoring SoT: server/maraOpportunityScoring.mjs (versioned). Projections must copy, not recompute differently.

CREATE TABLE IF NOT EXISTS mara_public_brands (
  id TEXT PRIMARY KEY,
  brand_key TEXT NOT NULL UNIQUE,
  brand_name TEXT NOT NULL,
  canonical_domain TEXT,
  website TEXT,
  parent_company TEXT,
  alternate_names_json JSONB NOT NULL DEFAULT '[]',
  social_profiles_json JSONB NOT NULL DEFAULT '{}',
  entity_type TEXT NOT NULL DEFAULT 'brand',
  profile_json JSONB NOT NULL DEFAULT '{}',
  research_version INTEGER NOT NULL DEFAULT 1,
  last_researched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mara_public_brands_domain ON mara_public_brands(canonical_domain);

CREATE TABLE IF NOT EXISTS mara_brand_evidence (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  public_brand_id TEXT REFERENCES mara_public_brands(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  claim TEXT NOT NULL,
  source_url TEXT,
  source_provider TEXT,
  raw_excerpt TEXT,
  confidence INTEGER NOT NULL DEFAULT 70 CHECK (confidence BETWEEN 0 AND 100),
  observed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mara_brand_evidence_tenant
  ON mara_brand_evidence(user_id, worker_id, public_brand_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mara_research_provider_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  research_type TEXT NOT NULL,
  query TEXT NOT NULL,
  retrieved_url TEXT,
  status TEXT NOT NULL,
  reliability REAL,
  freshness_hours INTEGER,
  observations_json JSONB NOT NULL DEFAULT '[]',
  error_text TEXT,
  rate_limited INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mara_research_runs_tenant
  ON mara_research_provider_runs(user_id, worker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mara_ad_observations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  public_brand_id TEXT REFERENCES mara_public_brands(id) ON DELETE SET NULL,
  platform TEXT,
  source_url TEXT,
  external_id TEXT,
  asset_type TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  observation_json JSONB NOT NULL,
  evidence_ids_json JSONB NOT NULL DEFAULT '[]',
  confidence INTEGER NOT NULL DEFAULT 50,
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mara_ad_obs_tenant
  ON mara_ad_observations(user_id, worker_id, public_brand_id);

CREATE TABLE IF NOT EXISTS mara_brand_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  public_brand_id TEXT REFERENCES mara_public_brands(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  verification_state TEXT NOT NULL DEFAULT 'unverified',
  confidence INTEGER NOT NULL DEFAULT 40 CHECK (confidence BETWEEN 0 AND 100),
  may_use_for_outreach INTEGER NOT NULL DEFAULT 0,
  inferred INTEGER NOT NULL DEFAULT 0,
  bounce_state TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  retrieved_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id, public_brand_id, contact_type, value)
);
CREATE INDEX IF NOT EXISTS idx_mara_brand_contacts_tenant
  ON mara_brand_contacts(user_id, worker_id, public_brand_id);

CREATE TABLE IF NOT EXISTS mara_creator_intelligence_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  business_json JSONB NOT NULL DEFAULT '{}',
  creative_json JSONB NOT NULL DEFAULT '{}',
  commercial_json JSONB NOT NULL DEFAULT '{}',
  learned_json JSONB NOT NULL DEFAULT '{}',
  provenance_json JSONB NOT NULL DEFAULT '{}',
  confidence INTEGER NOT NULL DEFAULT 50,
  last_updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id)
);

CREATE TABLE IF NOT EXISTS mara_creative_patterns (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT,
  public_brand_id TEXT REFERENCES mara_public_brands(id) ON DELETE SET NULL,
  taxonomy_json JSONB NOT NULL,
  source TEXT NOT NULL,
  category TEXT,
  product TEXT,
  evidence_ids_json JSONB NOT NULL DEFAULT '[]',
  frequency INTEGER NOT NULL DEFAULT 1,
  confidence INTEGER NOT NULL DEFAULT 50,
  saturation_estimate REAL,
  performance_json JSONB NOT NULL DEFAULT '{}',
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS mara_creative_concepts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  opportunity_id TEXT REFERENCES mara_creator_brand_opportunities(id) ON DELETE CASCADE,
  public_brand_id TEXT REFERENCES mara_public_brands(id) ON DELETE SET NULL,
  signature TEXT NOT NULL,
  concept_json JSONB NOT NULL,
  evidence_ids_json JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id, signature)
);

CREATE TABLE IF NOT EXISTS mara_outreach_sequences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  opportunity_id TEXT REFERENCES mara_creator_brand_opportunities(id) ON DELETE CASCADE,
  public_brand_id TEXT REFERENCES mara_public_brands(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES mara_brand_contacts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_run_at TIMESTAMPTZ,
  stop_reason TEXT,
  steps_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mara_outreach_seq_due
  ON mara_outreach_sequences(user_id, worker_id, status, next_run_at);

CREATE TABLE IF NOT EXISTS mara_media_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  file_id TEXT,
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  duration_seconds REAL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  processing_error TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mara_media_assets_tenant
  ON mara_media_assets(user_id, worker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mara_video_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  media_asset_id TEXT NOT NULL REFERENCES mara_media_assets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  analysis_json JSONB NOT NULL DEFAULT '{}',
  timeline_json JSONB NOT NULL DEFAULT '[]',
  evidence_json JSONB NOT NULL DEFAULT '[]',
  provider_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id, media_asset_id)
);

CREATE TABLE IF NOT EXISTS mara_autonomy_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  limits_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id)
);

CREATE TABLE IF NOT EXISTS mara_score_change_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  score_version TEXT NOT NULL,
  previous_total INTEGER,
  next_total INTEGER,
  reason TEXT NOT NULL,
  evidence_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL
);

-- Migrate legacy global mara_brand_profiles into mara_public_brands when present.
INSERT INTO mara_public_brands (
  id, brand_key, brand_name, website, profile_json, research_version, last_researched_at, created_at, updated_at
)
SELECT id, brand_key, brand_name, website, profile_json, research_version, last_researched_at, created_at, updated_at
FROM mara_brand_profiles
ON CONFLICT (brand_key) DO NOTHING;

-- Point opportunities at public brands (same ids preserved when migrated).
-- New columns on opportunities for score versioning / confidence.
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS score_version TEXT NOT NULL DEFAULT '2026-07-12.1';
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS confidence INTEGER NOT NULL DEFAULT 50;
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS public_brand_id TEXT;
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS decision TEXT NOT NULL DEFAULT 'monitor';
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS decision_reason TEXT;

UPDATE mara_creator_brand_opportunities
SET public_brand_id = brand_profile_id
WHERE public_brand_id IS NULL;
