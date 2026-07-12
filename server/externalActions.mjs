import { randomUUID } from "node:crypto";

export async function initExternalActions(store) {
  if (store.kind === "postgres") return;
  await store.execute(`CREATE TABLE IF NOT EXISTS external_action_executions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
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
  )`);
}

export async function claimExternalAction(store, action) {
  const timestamp = new Date().toISOString();
  const id = randomUUID();
  const inserted = await store.execute(
    `INSERT INTO external_action_executions
      (id, user_id, worker_id, action_type, idempotency_key, approval_id, status, request_json, result_json, error_text, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'executing', ?, NULL, NULL, ?, ?)
     ON CONFLICT(idempotency_key) DO NOTHING`,
    id, action.userId, action.workerId, action.actionType, action.idempotencyKey,
    action.approvalId || null, JSON.stringify(action.request || {}), timestamp, timestamp
  );
  if (inserted.changes === 1) return { claimed: true, id, status: "executing" };
  const existing = await store.queryOne(
    `SELECT id, status, result_json AS "resultJson", error_text AS "errorText"
     FROM external_action_executions WHERE idempotency_key = ?`,
    action.idempotencyKey
  );
  return {
    claimed: false,
    id: existing?.id ?? null,
    status: existing?.status ?? "unknown",
    result: existing?.resultJson ? JSON.parse(existing.resultJson) : null,
    error: existing?.errorText ?? null
  };
}

export async function completeExternalAction(store, id, result = {}) {
  const changed = await store.execute(
    `UPDATE external_action_executions
     SET status = 'completed', result_json = ?, error_text = NULL, updated_at = ?
     WHERE id = ? AND status = 'executing'`,
    JSON.stringify(result), new Date().toISOString(), id
  );
  return changed.changes === 1;
}

// A failed remote call is deliberately terminal. Automatic retry could repeat
// a side effect when the provider timed out after accepting it. A manager or
// operator must reconcile the provider state before creating a new action key.
export async function markExternalActionUncertain(store, id, error) {
  const changed = await store.execute(
    `UPDATE external_action_executions
     SET status = 'needs_reconciliation', error_text = ?, updated_at = ?
     WHERE id = ? AND status = 'executing'`,
    String(error || "Remote outcome is uncertain").slice(0, 1000), new Date().toISOString(), id
  );
  return changed.changes === 1;
}
