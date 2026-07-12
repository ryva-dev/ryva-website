import { randomUUID } from "node:crypto";

export async function initJobQueue(store) {
  await store.execute(`CREATE TABLE IF NOT EXISTS durable_jobs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      user_id TEXT,
      worker_id TEXT,
      payload_json TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      available_at TEXT NOT NULL,
      lease_owner TEXT,
      lease_expires_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    )`);
  await store.execute(`CREATE INDEX IF NOT EXISTS idx_durable_jobs_claim
      ON durable_jobs(status, available_at, lease_expires_at)`);
}

export async function enqueueJob(store, { kind, userId = null, workerId = null, payload = {}, idempotencyKey, availableAt, maxAttempts = 5 }) {
  if (!kind || !idempotencyKey) throw new Error("Job kind and idempotency key are required.");
  const now = new Date().toISOString();
  const info = await store.execute(
    `INSERT INTO durable_jobs
      (id, kind, user_id, worker_id, payload_json, idempotency_key, status, attempts, max_attempts,
       available_at, lease_owner, lease_expires_at, last_error, created_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, NULL, NULL, NULL, ?, ?, NULL)
     ON CONFLICT(idempotency_key) DO NOTHING`,
    randomUUID(), kind, userId, workerId, JSON.stringify(payload), idempotencyKey, maxAttempts, availableAt || now, now, now);
  return { enqueued: info.changes === 1 };
}

export async function claimJobs(store, { owner, limit = 10, leaseMs = 5 * 60 * 1000 } = {}) {
  if (!owner) throw new Error("A lease owner is required.");
  const now = new Date().toISOString();
  const leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();
  const driver = typeof store.activeDriver === "function" ? store.activeDriver() : store.kind;
  return store.tx(async (transaction) => {
    // Postgres: SKIP LOCKED lets multiple app replicas claim disjoint batches.
    // SQLite: optimistic UPDATE ... WHERE status='queued' still serializes winners.
    const lockClause = driver === "postgres" ? " FOR UPDATE SKIP LOCKED" : "";
    const candidates = await transaction.query(
      `SELECT id FROM durable_jobs
       WHERE attempts < max_attempts AND available_at <= ?
         AND (status = 'queued' OR (status = 'running' AND lease_expires_at < ?))
       ORDER BY available_at, created_at LIMIT ?${lockClause}`,
      now, now, limit);
    const claimed = [];
    for (const candidate of candidates) {
      const info = await transaction.execute(
        `UPDATE durable_jobs SET status = 'running', attempts = attempts + 1,
          lease_owner = ?, lease_expires_at = ?, updated_at = ?
         WHERE id = ? AND (status = 'queued' OR lease_expires_at < ?)`,
        owner, leaseExpiresAt, now, candidate.id, now);
      if (info.changes === 1) {
        const row = await transaction.queryOne("SELECT * FROM durable_jobs WHERE id = ?", candidate.id);
        const payload = typeof row.payload_json === "string" ? JSON.parse(row.payload_json || "{}") : (row.payload_json || {});
        claimed.push({ ...row, payload });
      }
    }
    return claimed;
  });
}

export async function completeJob(store, jobId, owner) {
  const now = new Date().toISOString();
  return (await store.execute(
    `UPDATE durable_jobs SET status = 'completed', completed_at = ?, updated_at = ?,
       lease_owner = NULL, lease_expires_at = NULL
     WHERE id = ? AND status = 'running' AND lease_owner = ?`
    , now, now, jobId, owner)).changes === 1;
}

export async function failJob(store, jobId, owner, error, { retryDelayMs = 60_000 } = {}) {
  const row = await store.queryOne("SELECT attempts, max_attempts FROM durable_jobs WHERE id = ? AND lease_owner = ?", jobId, owner);
  if (!row) return false;
  const exhausted = Number(row.attempts) >= Number(row.max_attempts);
  const now = new Date().toISOString();
  const availableAt = new Date(Date.now() + retryDelayMs * Math.max(1, Number(row.attempts))).toISOString();
  return (await store.execute(
    `UPDATE durable_jobs SET status = ?, available_at = ?, last_error = ?, updated_at = ?,
       lease_owner = NULL, lease_expires_at = NULL
     WHERE id = ? AND lease_owner = ?`
    , exhausted ? "dead" : "queued", availableAt, String(error ?? "Job failed").slice(0, 2000), now, jobId, owner)).changes === 1;
}
