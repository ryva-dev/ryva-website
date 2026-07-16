CREATE TABLE IF NOT EXISTS office_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_slug TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT NOT NULL,
  delivery TEXT NOT NULL,
  status TEXT NOT NULL,
  scheduled_for TEXT,
  sent_at TEXT,
  read_at TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_office_notifications_user ON office_notifications(user_id, created_at);

CREATE TABLE IF NOT EXISTS research_provider_cache (
  cache_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  query_text TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_provider_cache_expiry ON research_provider_cache(provider, expires_at);
