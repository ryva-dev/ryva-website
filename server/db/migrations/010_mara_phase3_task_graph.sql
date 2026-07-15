-- Mara Phase 3: durable task graph, separate calendars, controlled internal
-- execution, dynamic responsibilities, briefings, and failure history.

CREATE TABLE IF NOT EXISTS agent_tasks_v2 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  task_kind TEXT NOT NULL,
  source_plan_id TEXT NOT NULL,
  source_state_hash TEXT,
  source_event_ids_json JSONB NOT NULL DEFAULT '[]',
  source_candidate_types_json JSONB NOT NULL DEFAULT '[]',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  commercial_objective TEXT NOT NULL,
  expected_business_effect TEXT NOT NULL,
  priority TEXT NOT NULL,
  urgency TEXT NOT NULL,
  creator_effort_minutes INTEGER NOT NULL DEFAULT 0,
  estimated_mara_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  required_capabilities_json JSONB NOT NULL DEFAULT '[]',
  required_tools_json JSONB NOT NULL DEFAULT '[]',
  approval_requirement TEXT NOT NULL DEFAULT 'none',
  execution_tier TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  scheduled_window TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  timezone TEXT NOT NULL,
  completion_condition TEXT NOT NULL,
  reassessment_trigger TEXT NOT NULL,
  expiration_rule_json JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  confidence DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  failure_state_json JSONB,
  retry_policy_json JSONB NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL,
  output_json JSONB,
  execution_claim_id TEXT,
  execution_claimed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_v2_schedule
  ON agent_tasks_v2(user_id, worker_id, owner, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_v2_plan
  ON agent_tasks_v2(user_id, worker_id, source_plan_id);

CREATE TABLE IF NOT EXISTS agent_task_relationships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  from_task_id TEXT NOT NULL,
  to_task_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id, from_task_id, to_task_id, relationship_type)
);
CREATE INDEX IF NOT EXISTS idx_agent_task_relationships_from ON agent_task_relationships(user_id, worker_id, from_task_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_relationships_to ON agent_task_relationships(user_id, worker_id, to_task_id);

CREATE TABLE IF NOT EXISTS agent_task_audit_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  reason TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_task_audit_task ON agent_task_audit_history(user_id, worker_id, task_id, created_at);

CREATE TABLE IF NOT EXISTS agent_task_calendar_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  calendar_owner TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_agent_calendar_owner ON agent_task_calendar_entries(user_id, worker_id, calendar_owner, starts_at);

CREATE TABLE IF NOT EXISTS agent_task_compilation_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  source_plan_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  report_json JSONB NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id, source_plan_id, mode)
);

CREATE TABLE IF NOT EXISTS agent_task_execution_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  execution_tier TEXT NOT NULL,
  status TEXT NOT NULL,
  result_json JSONB,
  error_json JSONB,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, worker_id, task_id, claim_id)
);

CREATE TABLE IF NOT EXISTS agent_dynamic_responsibilities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  title TEXT NOT NULL,
  commercial_objective TEXT NOT NULL,
  cadence_json JSONB NOT NULL,
  candidate_trigger_type TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_triggered_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, worker_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS agent_briefings_v2 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  briefing_json JSONB NOT NULL,
  source_task_ids_json JSONB NOT NULL DEFAULT '[]',
  source_event_ids_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL
);
