CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit_buckets(reset_at);

CREATE TABLE IF NOT EXISTS mara_global_trend_insights (
  platform TEXT PRIMARY KEY,
  payload_json JSONB NOT NULL,
  source TEXT,
  updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_is_set INTEGER NOT NULL DEFAULT 1;
