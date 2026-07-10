-- Ryva — Postgres schema (Phase 2, Stage A)
-- Translated 1:1 from the SQLite schema in server/db.mjs + server/workerEngine.mjs
-- (initWorkerTables), with all runtime ensureColumn() additions folded in so a
-- fresh Postgres database matches a fully-migrated SQLite database.
--
-- Conventions:
--   * TEXT ids (UUID strings) — no serial/identity columns, matching today.
--   * Boolean flags stay INTEGER 0/1 to keep application logic unchanged in
--     Stage A; a later pass can tighten them to boolean.
--   * Timestamps stay text (ISO 8601 strings) for the same reason.
--   * gen_random_uuid() needs pgcrypto (enabled below) for the hire backfill.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Core identity / auth / billing
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TEXT,
  stripe_customer_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hired_workers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  checkout_session_id TEXT NOT NULL,
  status TEXT NOT NULL,
  hired_at TEXT NOT NULL,
  stripe_subscription_id TEXT,
  billing_status TEXT NOT NULL DEFAULT '',
  paused INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, worker_slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (checkout_session_id) REFERENCES checkout_sessions(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Office surface
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS office_chat_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_custom_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  module_name TEXT NOT NULL,
  owner TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  due_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  action TEXT NOT NULL,
  module_name TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_worker_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, worker_slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_worker_knowledge (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  knowledge_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, worker_slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_uploaded_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_custom_briefings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  date_label TEXT NOT NULL,
  summary TEXT NOT NULL,
  agenda_json TEXT NOT NULL,
  decisions_json TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_global_settings (
  user_id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_onboarding (
  user_id TEXT PRIMARY KEY,
  brand_name TEXT NOT NULL,
  what_you_do TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_onboarding_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  status TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  generated_summary_json TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, worker_slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_calendar_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  event_type TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_worker_integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  account_label TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  connected_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, worker_slug, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_email_threads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  participants_json TEXT NOT NULL,
  snippet TEXT NOT NULL,
  received_at TEXT NOT NULL,
  brand_related INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  urgency TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  source_message_count INTEGER NOT NULL DEFAULT 0,
  thread_status TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  gmail_thread_id TEXT,
  body_text TEXT NOT NULL DEFAULT '',
  parsed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_campaigns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  brand_website TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  product_name TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_status TEXT NOT NULL,
  source_thread_id TEXT,
  deliverables_json TEXT NOT NULL,
  brief_text TEXT NOT NULL,
  draft_due_date TEXT,
  final_due_date TEXT,
  payment_amount TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  usage_rights TEXT NOT NULL,
  usage_rights_status TEXT NOT NULL,
  revision_limit TEXT NOT NULL,
  raw_footage_required INTEGER NOT NULL DEFAULT 0,
  missing_fields_json TEXT NOT NULL,
  risk_flags_json TEXT NOT NULL,
  notes TEXT NOT NULL,
  last_parsed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_leads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  lead_stage TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_reference_id TEXT,
  last_activity_at TEXT,
  next_follow_up_at TEXT,
  summary TEXT NOT NULL,
  history_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, worker_slug, brand_name, contact_email),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_suggested_actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reason TEXT NOT NULL,
  related_thread_id TEXT,
  related_campaign_id TEXT,
  related_brand_id TEXT,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  requires_approval INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_label TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  kind TEXT NOT NULL,
  rhythm TEXT,
  blocked_reason TEXT NOT NULL,
  due_at TEXT,
  artifact_type TEXT NOT NULL,
  artifact_ref_id TEXT,
  artifact_title TEXT NOT NULL,
  artifact_preview TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, worker_slug, source_type, source_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_deliverables (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  deliverable_type TEXT NOT NULL,
  preview_text TEXT NOT NULL,
  content_ref_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, worker_slug, source_type, source_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_handbook_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  section TEXT NOT NULL,
  subsection TEXT NOT NULL,
  worker_slug TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_label TEXT NOT NULL,
  statement TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, section, subsection, worker_slug, source_type, source_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_brand_opportunities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  website TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  fit_score INTEGER NOT NULL,
  ugc_potential_score INTEGER NOT NULL,
  risk_score INTEGER NOT NULL,
  priority TEXT NOT NULL,
  content_gap TEXT NOT NULL,
  suggested_angle TEXT NOT NULL,
  source_notes TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_trend_signals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  niche TEXT NOT NULL,
  platform TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  hashtags_json TEXT NOT NULL,
  examples_json TEXT NOT NULL,
  confidence TEXT NOT NULL,
  source TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS office_sync_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_slug TEXT NOT NULL,
  job_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_digest_log (
  user_id TEXT PRIMARY KEY,
  last_sent_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Worker engine (from initWorkerTables)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS worker_permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  can_suggest_tasks INTEGER NOT NULL DEFAULT 0,
  can_create_tasks INTEGER NOT NULL DEFAULT 0,
  can_run_research INTEGER NOT NULL DEFAULT 0,
  can_create_recurring_responsibilities INTEGER NOT NULL DEFAULT 0,
  can_draft_outreach INTEGER NOT NULL DEFAULT 0,
  can_read_inbox INTEGER NOT NULL DEFAULT 0,
  can_send_emails_with_approval INTEGER NOT NULL DEFAULT 0,
  can_send_emails_without_approval INTEGER NOT NULL DEFAULT 0,
  can_update_external_trackers INTEGER NOT NULL DEFAULT 0,
  can_use_connected_integrations INTEGER NOT NULL DEFAULT 0,
  approval_required_for_external_actions INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, worker_id)
);

CREATE TABLE IF NOT EXISTS worker_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  due_at TEXT,
  required_permissions_json TEXT NOT NULL,
  evidence_used_json TEXT NOT NULL,
  output TEXT,
  normalized_title TEXT NOT NULL,
  task_type TEXT,
  target_brand_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  related_task_id TEXT,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_recurring_responsibilities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cadence TEXT NOT NULL,
  day_of_week TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  permission_required TEXT,
  last_run_at TEXT,
  next_run_at TEXT,
  created_from TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_research_items (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  worker_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  topic TEXT NOT NULL,
  query TEXT NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT,
  insights_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  normalized_topic TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_approval_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_outputs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  task_id TEXT,
  output_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  structured_content_json TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_knowledge_modules (
  id TEXT PRIMARY KEY,
  worker_type TEXT,
  worker_id TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  structured_content_json TEXT,
  tags_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_brands (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  website TEXT,
  identity_summary TEXT NOT NULL DEFAULT '',
  vibe_notes TEXT NOT NULL DEFAULT '',
  suggested_angle TEXT NOT NULL DEFAULT '',
  contact_email TEXT,
  contact_name TEXT,
  research_item_id TEXT,
  last_content_ideas_at TEXT,
  last_pitch_at TEXT,
  normalized_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, worker_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS worker_trend_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  niche TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'US',
  period_days INTEGER NOT NULL DEFAULT 7,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL,
  content_gaps_json TEXT NOT NULL,
  hashtags_json TEXT NOT NULL,
  insights_json TEXT NOT NULL,
  login_wall_encountered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Indexes for the hot access paths (everything filters by user_id, usually
-- also by worker). These do not exist in the SQLite build and are a free win.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_hired_workers_user ON hired_workers(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_user_worker ON office_chat_messages(user_id, worker_slug);
CREATE INDEX IF NOT EXISTS idx_activity_user_worker ON office_activity_logs(user_id, worker_slug);
CREATE INDEX IF NOT EXISTS idx_custom_tasks_user_worker ON office_custom_tasks(user_id, worker_slug);
CREATE INDEX IF NOT EXISTS idx_assignments_user_worker ON office_assignments(user_id, worker_slug);
CREATE INDEX IF NOT EXISTS idx_deliverables_user_worker ON office_deliverables(user_id, worker_slug);
CREATE INDEX IF NOT EXISTS idx_calendar_user ON office_calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_briefings_user_worker ON office_custom_briefings(user_id, worker_slug);
CREATE INDEX IF NOT EXISTS idx_integrations_user_worker ON office_worker_integrations(user_id, worker_slug);
CREATE INDEX IF NOT EXISTS idx_email_threads_user_worker ON office_email_threads(user_id, worker_slug);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_worker ON office_campaigns(user_id, worker_slug);
CREATE INDEX IF NOT EXISTS idx_leads_user_worker ON office_leads(user_id, worker_slug);
CREATE INDEX IF NOT EXISTS idx_suggested_actions_user_worker ON office_suggested_actions(user_id, worker_slug);
CREATE INDEX IF NOT EXISTS idx_worker_tasks_user_worker ON worker_tasks(user_id, worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_outputs_user_worker ON worker_outputs(user_id, worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_activity_user_worker ON worker_activity_log(user_id, worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_brands_user_worker ON worker_brands(user_id, worker_id);
