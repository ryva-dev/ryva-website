CREATE TABLE IF NOT EXISTS mara_brand_profiles (
  id TEXT PRIMARY KEY, brand_key TEXT NOT NULL UNIQUE, brand_name TEXT NOT NULL, website TEXT,
  profile_json JSONB NOT NULL, evidence_json JSONB NOT NULL, research_version INTEGER NOT NULL DEFAULT 1,
  last_researched_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS mara_creator_performance_profiles (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL, profile_json JSONB NOT NULL, evidence_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, UNIQUE(user_id, worker_id)
);

CREATE TABLE IF NOT EXISTS mara_creator_brand_opportunities (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL, brand_profile_id TEXT NOT NULL REFERENCES mara_brand_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL, score_total INTEGER NOT NULL CHECK (score_total BETWEEN 0 AND 100),
  scores_json JSONB NOT NULL, opportunity_package_json JSONB NOT NULL, evidence_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id, brand_profile_id)
);
CREATE INDEX IF NOT EXISTS idx_mara_opportunities_creator_score
  ON mara_creator_brand_opportunities(user_id, worker_id, status, score_total DESC);

CREATE TABLE IF NOT EXISTS mara_creative_analyses (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL, asset_type TEXT NOT NULL, asset_ref TEXT NOT NULL,
  analysis_json JSONB NOT NULL, evidence_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id, asset_type, asset_ref)
);

CREATE TABLE IF NOT EXISTS mara_commercial_outcomes (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL, opportunity_id TEXT REFERENCES mara_creator_brand_opportunities(id) ON DELETE SET NULL,
  contacted INTEGER NOT NULL DEFAULT 0, responded INTEGER NOT NULL DEFAULT 0,
  concept_accepted INTEGER NOT NULL DEFAULT 0, hired INTEGER NOT NULL DEFAULT 0, rehired INTEGER NOT NULL DEFAULT 0,
  revenue_amount NUMERIC(14,2) NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'USD',
  outcome_json JSONB NOT NULL, occurred_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mara_outcomes_creator_date
  ON mara_commercial_outcomes(user_id, worker_id, occurred_at DESC);
