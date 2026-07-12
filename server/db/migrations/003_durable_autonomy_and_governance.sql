CREATE TABLE IF NOT EXISTS durable_jobs (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, user_id TEXT, worker_id TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb, idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL, lease_owner TEXT, lease_expires_at TIMESTAMPTZ,
  last_error TEXT, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_durable_jobs_claim ON durable_jobs(status, available_at, lease_expires_at);

CREATE TABLE IF NOT EXISTS professional_research_candidates (
  id TEXT PRIMARY KEY, worker_type TEXT NOT NULL, title TEXT NOT NULL,
  proposed_summary TEXT NOT NULL, proposed_content TEXT NOT NULL, source_url TEXT NOT NULL,
  source_publisher TEXT NOT NULL, source_published_at TIMESTAMPTZ, evidence_json JSONB NOT NULL,
  content_hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL, review_notes TEXT, reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS action_audit_events (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_id TEXT NOT NULL, action_type TEXT NOT NULL,
  task_id TEXT, decision TEXT NOT NULL, policy_version TEXT NOT NULL, reasons_json JSONB NOT NULL,
  evidence_json JSONB NOT NULL, approval_id TEXT, idempotency_key TEXT, previous_event_hash TEXT,
  event_hash TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_action_audit_user_created ON action_audit_events(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION reject_action_audit_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS action_audit_events_no_update ON action_audit_events;
CREATE TRIGGER action_audit_events_no_update BEFORE UPDATE ON action_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_action_audit_update();
