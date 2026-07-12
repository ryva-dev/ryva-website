-- Opportunity-to-revenue commercial spine (additive)

ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT;
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS previous_lifecycle_stage TEXT;
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ;
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS estimated_deal_value DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS confirmed_deal_value DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS expected_revenue DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS actual_revenue DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS next_action_json JSONB;
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS next_action_due_at TIMESTAMPTZ;
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS blocking_reason TEXT;
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS attribution TEXT NOT NULL DEFAULT 'uncertain';
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS loss_reason TEXT;
ALTER TABLE mara_creator_brand_opportunities
  ADD COLUMN IF NOT EXISTS deal_terms_json JSONB;

ALTER TABLE office_leads
  ADD COLUMN IF NOT EXISTS opportunity_id TEXT;
ALTER TABLE office_campaigns
  ADD COLUMN IF NOT EXISTS opportunity_id TEXT;

CREATE TABLE IF NOT EXISTS mara_opportunity_stage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  requires_confirmation INTEGER NOT NULL DEFAULT 0,
  confirmed INTEGER NOT NULL DEFAULT 0,
  evidence_json JSONB NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'system',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mara_stage_events_opp
  ON mara_opportunity_stage_events(user_id, worker_id, opportunity_id, created_at);

CREATE TABLE IF NOT EXISTS mara_creator_learning_state (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id)
);

-- Backfill lifecycle from legacy status where empty
UPDATE mara_creator_brand_opportunities
SET lifecycle_stage = CASE status
  WHEN 'qualified' THEN 'qualified'
  WHEN 'active' THEN 'pitch_preparing'
  WHEN 'contacted' THEN 'sent'
  WHEN 'responded' THEN 'replied'
  WHEN 'concept_accepted' THEN 'interested'
  WHEN 'won' THEN 'won'
  WHEN 'won_repeat' THEN 'won'
  WHEN 'cold' THEN 'cold'
  WHEN 'lost' THEN 'lost'
  ELSE 'discovered'
END
WHERE lifecycle_stage IS NULL OR lifecycle_stage = '';
