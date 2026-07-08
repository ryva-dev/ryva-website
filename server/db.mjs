import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initWorkerTables } from "./workerEngine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const defaultStorageRoot = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(rootDir, "data");
const configuredDatabasePath = process.env.DATABASE_PATH;
const dbPath = configuredDatabasePath
  ? path.isAbsolute(configuredDatabasePath)
    ? configuredDatabasePath
    : path.resolve(rootDir, configuredDatabasePath)
  : path.join(defaultStorageRoot, "app.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const isProduction = process.env.NODE_ENV === "production";
const hasRailwayVolume = Boolean(process.env.RAILWAY_VOLUME_MOUNT_PATH);
const hasAbsoluteDatabasePath = Boolean(configuredDatabasePath && path.isAbsolute(configuredDatabasePath));
const hasAbsoluteStorageRoot = Boolean(process.env.STORAGE_ROOT && path.isAbsolute(process.env.STORAGE_ROOT));

if (isProduction && !hasRailwayVolume && !hasAbsoluteDatabasePath && !hasAbsoluteStorageRoot) {
  throw new Error(
    "Persistent storage is not configured for production. Set RAILWAY_VOLUME_MOUNT_PATH or use an absolute DATABASE_PATH/STORAGE_ROOT."
  );
}

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

function ensureColumn(tableName, columnName, columnDefinition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

export function ensureOfficeSchema() {
  db.exec(`
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
  `);

  ensureColumn("office_onboarding_sessions", "completed_at", "TEXT");
  ensureColumn("office_onboarding_sessions", "created_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_onboarding_sessions", "updated_at", "TEXT NOT NULL DEFAULT ''");

  ensureColumn("office_assignments", "source_label", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_assignments", "summary", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_assignments", "status", "TEXT NOT NULL DEFAULT 'queued'");
  ensureColumn("office_assignments", "priority", "TEXT NOT NULL DEFAULT 'medium'");
  ensureColumn("office_assignments", "kind", "TEXT NOT NULL DEFAULT 'one_off'");
  ensureColumn("office_assignments", "rhythm", "TEXT");
  ensureColumn("office_assignments", "blocked_reason", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_assignments", "due_at", "TEXT");
  ensureColumn("office_assignments", "artifact_type", "TEXT NOT NULL DEFAULT 'none'");
  ensureColumn("office_assignments", "artifact_ref_id", "TEXT");
  ensureColumn("office_assignments", "artifact_title", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_assignments", "artifact_preview", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_assignments", "created_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_assignments", "updated_at", "TEXT NOT NULL DEFAULT ''");

  ensureColumn("office_deliverables", "summary", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_deliverables", "deliverable_type", "TEXT NOT NULL DEFAULT 'file'");
  ensureColumn("office_deliverables", "preview_text", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_deliverables", "content_ref_id", "TEXT");
  ensureColumn("office_deliverables", "created_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_deliverables", "updated_at", "TEXT NOT NULL DEFAULT ''");

  ensureColumn("office_handbook_entries", "subsection", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_handbook_entries", "worker_slug", "TEXT");
  ensureColumn("office_handbook_entries", "source_type", "TEXT NOT NULL DEFAULT 'manual'");
  ensureColumn("office_handbook_entries", "source_id", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_handbook_entries", "source_label", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_handbook_entries", "statement", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_handbook_entries", "created_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_handbook_entries", "updated_at", "TEXT NOT NULL DEFAULT ''");

  ensureColumn("office_email_threads", "gmail_thread_id", "TEXT");
  ensureColumn("office_email_threads", "body_text", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("office_email_threads", "parsed_at", "TEXT");
  ensureColumn("office_campaigns", "last_parsed_at", "TEXT");

  // Subscription lifecycle: link hires to their Stripe subscription so firing
  // a worker cancels billing and failed payments are visible.
  ensureColumn("hired_workers", "stripe_subscription_id", "TEXT");
  ensureColumn("hired_workers", "billing_status", "TEXT NOT NULL DEFAULT ''");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified_at TEXT,
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
    UNIQUE(user_id, worker_slug),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (checkout_session_id) REFERENCES checkout_sessions(id) ON DELETE CASCADE
  );

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
    confidence REAL NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    brand_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    source_message_count INTEGER NOT NULL DEFAULT 0,
    thread_status TEXT NOT NULL,
    raw_json TEXT NOT NULL,
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
`);

ensureOfficeSchema();
initWorkerTables(db);

db.exec(`
  INSERT INTO hired_workers (id, user_id, worker_slug, checkout_session_id, status, hired_at)
  SELECT lower(hex(randomblob(16))), cs.user_id, cs.worker_slug, cs.id, 'active', coalesce(cs.completed_at, cs.created_at)
  FROM checkout_sessions cs
  LEFT JOIN hired_workers hw
    ON hw.user_id = cs.user_id AND hw.worker_slug = cs.worker_slug
  WHERE cs.status = 'completed' AND hw.id IS NULL;
`);
