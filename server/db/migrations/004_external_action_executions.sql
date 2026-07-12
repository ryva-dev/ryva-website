CREATE TABLE IF NOT EXISTS external_action_executions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  approval_id TEXT,
  status TEXT NOT NULL,
  request_json TEXT NOT NULL,
  result_json TEXT,
  error_text TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_external_actions_tenant_status
  ON external_action_executions(user_id, status, updated_at);
