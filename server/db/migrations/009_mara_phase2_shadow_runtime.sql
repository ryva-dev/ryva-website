-- Mara Phase 2: provider-neutral events, materialized business state, candidates,
-- shadow planning, and token/dollar usage accounting. All tables are additive.

CREATE TABLE IF NOT EXISTS agent_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}',
  provenance_json JSONB NOT NULL DEFAULT '{}',
  confidence DOUBLE PRECISION NOT NULL DEFAULT 1,
  occurred_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL,
  processed_at TIMESTAMPTZ,
  UNIQUE(user_id, worker_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_agent_events_unprocessed
  ON agent_events(user_id, worker_id, occurred_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_events_entity
  ON agent_events(user_id, worker_id, entity_type, entity_id, occurred_at);

CREATE TABLE IF NOT EXISTS worker_business_state_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  state_version INTEGER NOT NULL,
  state_hash TEXT NOT NULL,
  state_json JSONB NOT NULL,
  material_changes_json JSONB NOT NULL DEFAULT '[]',
  source_event_watermark TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id, state_version)
);
CREATE INDEX IF NOT EXISTS idx_worker_state_latest
  ON worker_business_state_snapshots(user_id, worker_id, state_version DESC);

CREATE TABLE IF NOT EXISTS agent_work_candidates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  candidate_type TEXT NOT NULL,
  trigger_event_ids_json JSONB NOT NULL DEFAULT '[]',
  possible_commercial_objective TEXT NOT NULL,
  urgency TEXT NOT NULL,
  dependencies_json JSONB NOT NULL DEFAULT '[]',
  suggested_owner TEXT NOT NULL,
  required_capabilities_json JSONB NOT NULL DEFAULT '[]',
  user_action_may_be_required INTEGER NOT NULL DEFAULT 0,
  risk_class TEXT NOT NULL DEFAULT 'normal',
  evidence_json JSONB NOT NULL DEFAULT '[]',
  dedupe_key TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_agent_candidates_open
  ON agent_work_candidates(user_id, worker_id, status, created_at);

CREATE TABLE IF NOT EXISTS agent_planning_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  state_snapshot_id TEXT,
  state_hash TEXT,
  trigger_event_ids_json JSONB NOT NULL DEFAULT '[]',
  playbook_versions_json JSONB NOT NULL DEFAULT '{}',
  planner_input_json JSONB NOT NULL DEFAULT '{}',
  planner_output_json JSONB,
  legacy_plan_json JSONB NOT NULL DEFAULT '[]',
  diagnostics_json JSONB NOT NULL DEFAULT '{}',
  provider TEXT,
  model TEXT,
  estimated_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_planning_runs_latest
  ON agent_planning_runs(user_id, worker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS model_usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  worker_id TEXT,
  task_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  request_status TEXT NOT NULL,
  acceptance_status TEXT NOT NULL DEFAULT 'unused',
  related_event_id TEXT,
  related_task_id TEXT,
  related_opportunity_id TEXT,
  related_commercial_outcome_id TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_usage_user_day
  ON model_usage_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_model_usage_outcome
  ON model_usage_events(related_commercial_outcome_id);
