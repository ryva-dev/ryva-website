import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dbPath = path.join(rootDir, "data", "app.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

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
`);

db.exec(`
  INSERT INTO hired_workers (id, user_id, worker_slug, checkout_session_id, status, hired_at)
  SELECT lower(hex(randomblob(16))), cs.user_id, cs.worker_slug, cs.id, 'active', coalesce(cs.completed_at, cs.created_at)
  FROM checkout_sessions cs
  LEFT JOIN hired_workers hw
    ON hw.user_id = cs.user_id AND hw.worker_slug = cs.worker_slug
  WHERE cs.status = 'completed' AND hw.id IS NULL;
`);
