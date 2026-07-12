import { createHash, randomUUID } from "node:crypto";

const SENSITIVE_ACTIONS = new Set(["send_email", "publish_content", "spend_money", "delete_external_data", "update_external_record"]);

function hasActionAuthority(actionType, permissions, approvalId) {
  switch (String(actionType)) {
    case "send_email":
      return approvalId ? permissions.canSendEmailsWithApproval === true : permissions.canSendEmailsWithoutApproval === true;
    case "update_external_record":
      return permissions.canUpdateExternalTrackers === true;
    case "publish_content":
      return permissions.canPublishContent === true;
    case "spend_money":
      return permissions.canSpendMoney === true;
    case "delete_external_data":
      return permissions.canDeleteExternalData === true;
    default:
      return true;
  }
}

export function evaluateActionPolicy({ actionType, permissions = {}, safeAutoExecute = false, integrationConnected = false, approvalId = null }) {
  const external = SENSITIVE_ACTIONS.has(String(actionType));
  const reasons = [];
  if (!safeAutoExecute && !external) reasons.push("Task type is not approved for autonomous execution.");
  if (external && !integrationConnected) reasons.push("Required external integration is not connected.");
  if (external && !permissions.canUseConnectedIntegrations) reasons.push("Worker lacks connected-integration authority.");
  if (external && !hasActionAuthority(actionType, permissions, approvalId)) reasons.push("Worker lacks authority for this specific external action.");
  if (external && permissions.approvalRequiredForExternalActions !== false && !approvalId) reasons.push("This external action requires a specific approval.");
  return {
    allowed: reasons.length === 0,
    approvalRequired: external && permissions.approvalRequiredForExternalActions !== false,
    external,
    reasons,
    policyVersion: "2026-07-11.1"
  };
}

export async function initActionAudit(store) {
  if (store.kind === "postgres") return;
  await store.execute(`CREATE TABLE IF NOT EXISTS action_audit_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      task_id TEXT,
      decision TEXT NOT NULL,
      policy_version TEXT NOT NULL,
      reasons_json TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      approval_id TEXT,
      idempotency_key TEXT,
      previous_event_hash TEXT,
      event_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )`);
  await store.execute(`CREATE TRIGGER IF NOT EXISTS action_audit_events_no_update
      BEFORE UPDATE ON action_audit_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END`);
}

export async function appendActionAuditEvent(store, event) {
  const previous = await store.queryOne(
    "SELECT event_hash AS \"eventHash\" FROM action_audit_events WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1"
  , event.userId);
  const createdAt = event.createdAt || new Date().toISOString();
  const id = randomUUID();
  const canonical = JSON.stringify({
    id, userId: event.userId, workerId: event.workerId, actionType: event.actionType,
    taskId: event.taskId || null, decision: event.decision, policyVersion: event.policyVersion,
    reasons: event.reasons || [], evidence: event.evidence || [], approvalId: event.approvalId || null,
    idempotencyKey: event.idempotencyKey || null, previousEventHash: previous?.eventHash || null, createdAt
  });
  const eventHash = createHash("sha256").update(canonical).digest("hex");
  await store.execute(
    `INSERT INTO action_audit_events
      (id, user_id, worker_id, action_type, task_id, decision, policy_version, reasons_json,
       evidence_json, approval_id, idempotency_key, previous_event_hash, event_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, event.userId, event.workerId, event.actionType, event.taskId || null, event.decision,
    event.policyVersion, JSON.stringify(event.reasons || []), JSON.stringify(event.evidence || []),
    event.approvalId || null, event.idempotencyKey || null, previous?.eventHash || null, eventHash, createdAt);
  return { id, eventHash };
}
