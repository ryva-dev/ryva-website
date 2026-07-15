import { randomUUID } from "node:crypto";
import { ensureMaraRuntimeTables, json } from "./maraRuntimeStorage.mjs";

export const TASK_OWNERS = Object.freeze(["mara", "creator", "shared"]);
export const TASK_KINDS = Object.freeze(["approval", "monitoring", "research", "analysis", "deliverable_generation", "reassessment", "waiting", "information_request", "internal_update"]);
export const TASK_STATUSES = Object.freeze(["proposed", "scheduled", "ready", "running", "awaiting_approval", "awaiting_creator_action", "awaiting_information", "awaiting_external_event", "blocked", "rescheduled", "completed", "failed", "superseded", "invalidated", "expired", "cancelled"]);
export const RELATIONSHIP_TYPES = Object.freeze(["depends_on", "blocks", "supersedes", "replaces", "invalidates", "generated_from", "requires_approval_from", "requires_information_from"]);
export const TERMINAL_TASK_STATUSES = new Set(["completed", "superseded", "invalidated", "expired", "cancelled"]);

export function mapTaskRow(row) {
  if (!row) return null;
  return {
    id: row.id, userId: row.user_id, workerId: row.worker_id, owner: row.owner, taskKind: row.task_kind,
    sourcePlanId: row.source_plan_id, sourceStateHash: row.source_state_hash,
    sourceEventIds: json(row.source_event_ids_json, []), sourceCandidateTypes: json(row.source_candidate_types_json, []),
    title: row.title, description: row.description, commercialObjective: row.commercial_objective,
    expectedBusinessEffect: row.expected_business_effect, priority: row.priority, urgency: row.urgency,
    creatorEffortMinutes: Number(row.creator_effort_minutes), estimatedMaraCostUsd: Number(row.estimated_mara_cost_usd),
    requiredCapabilities: json(row.required_capabilities_json, []), requiredTools: json(row.required_tools_json, []),
    approvalRequirement: row.approval_requirement, executionTier: row.execution_tier, scheduledAt: row.scheduled_at,
    scheduledWindow: row.scheduled_window, durationMinutes: Number(row.duration_minutes), timezone: row.timezone,
    completionCondition: row.completion_condition, reassessmentTrigger: row.reassessment_trigger,
    expirationRule: json(row.expiration_rule_json, {}), expiresAt: row.expires_at, confidence: Number(row.confidence),
    status: row.status, failureState: json(row.failure_state_json, null), retryPolicy: json(row.retry_policy_json, {}),
    idempotencyKey: row.idempotency_key, output: json(row.output_json, null), executionClaimId: row.execution_claim_id,
    executionClaimedAt: row.execution_claimed_at, attemptCount: Number(row.attempt_count), completedAt: row.completed_at,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

export async function listTaskGraph(store, { userId, workerId, statuses, owner } = {}) {
  await ensureMaraRuntimeTables(store);
  const clauses = ["user_id = ?", "worker_id = ?"];
  const params = [userId, workerId];
  if (owner) { clauses.push("owner = ?"); params.push(owner); }
  if (statuses?.length) { clauses.push(`status IN (${statuses.map(() => "?").join(",")})`); params.push(...statuses); }
  const rows = await store.query(`SELECT * FROM agent_tasks_v2 WHERE ${clauses.join(" AND ")} ORDER BY scheduled_at ASC, created_at ASC`, ...params);
  return rows.map(mapTaskRow);
}

export async function getTaskGraphTask(store, { userId, workerId, taskId }) {
  await ensureMaraRuntimeTables(store);
  return mapTaskRow(await store.queryOne("SELECT * FROM agent_tasks_v2 WHERE id = ? AND user_id = ? AND worker_id = ?", taskId, userId, workerId));
}

export async function appendTaskAudit(store, { userId, workerId, taskId, eventType, fromStatus = null, toStatus = null, reason = null, metadata = {}, createdAt = new Date().toISOString() }) {
  await store.execute(
    `INSERT INTO agent_task_audit_history (id,user_id,worker_id,task_id,event_type,from_status,to_status,reason,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    randomUUID(), userId, workerId, taskId, eventType, fromStatus, toStatus, reason, JSON.stringify(metadata), createdAt
  );
}

export async function transitionTask(store, { userId, workerId, taskId, toStatus, reason, metadata = {}, output, failureState, expectedStatuses }) {
  if (!TASK_STATUSES.includes(toStatus)) throw new Error(`Unsupported task status: ${toStatus}`);
  const current = await getTaskGraphTask(store, { userId, workerId, taskId });
  if (!current) throw new Error("Task not found for tenant.");
  if (expectedStatuses?.length && !expectedStatuses.includes(current.status)) return { changed: false, task: current };
  const now = new Date().toISOString();
  await store.execute(
    `UPDATE agent_tasks_v2 SET status = ?, output_json = COALESCE(?,output_json), failure_state_json = ?, completed_at = ?, execution_claim_id = CASE WHEN ? = 1 THEN NULL ELSE execution_claim_id END, execution_claimed_at = CASE WHEN ? = 1 THEN NULL ELSE execution_claimed_at END, updated_at = ? WHERE id = ? AND user_id = ? AND worker_id = ?`,
    toStatus, output === undefined ? null : JSON.stringify(output), failureState ? JSON.stringify(failureState) : null,
    toStatus === "completed" ? now : current.completedAt, TERMINAL_TASK_STATUSES.has(toStatus) ? 1 : 0, TERMINAL_TASK_STATUSES.has(toStatus) ? 1 : 0, now, taskId, userId, workerId
  );
  await appendTaskAudit(store, { userId, workerId, taskId, eventType: "status_changed", fromStatus: current.status, toStatus, reason, metadata, createdAt: now });
  return { changed: true, task: await getTaskGraphTask(store, { userId, workerId, taskId }) };
}

export async function listTaskRelationships(store, { userId, workerId }) {
  await ensureMaraRuntimeTables(store);
  return store.query("SELECT * FROM agent_task_relationships WHERE user_id = ? AND worker_id = ?", userId, workerId);
}

export async function addTaskRelationship(store, { userId, workerId, fromTaskId, toTaskId, relationshipType, metadata = {} }) {
  if (!RELATIONSHIP_TYPES.includes(relationshipType)) throw new Error(`Unsupported task relationship: ${relationshipType}`);
  if (fromTaskId === toTaskId) throw new Error("A task cannot relate to itself.");
  const tasks = await listTaskGraph(store, { userId, workerId });
  const ids = new Set(tasks.map((task) => task.id));
  if (!ids.has(fromTaskId) || !ids.has(toTaskId)) throw new Error("Relationship tasks must belong to the same tenant and worker.");
  const existing = (await listTaskRelationships(store, { userId, workerId })).map((row) => ({ fromTaskId: row.from_task_id, toTaskId: row.to_task_id, relationshipType: row.relationship_type }));
  if (relationshipType === "depends_on") assertAcyclicDependencies([...ids], [...existing, { fromTaskId, toTaskId, relationshipType }]);
  await store.execute("INSERT INTO agent_task_relationships (id,user_id,worker_id,from_task_id,to_task_id,relationship_type,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,worker_id,from_task_id,to_task_id,relationship_type) DO NOTHING", randomUUID(), userId, workerId, fromTaskId, toTaskId, relationshipType, JSON.stringify(metadata), new Date().toISOString());
}

export function assertAcyclicDependencies(taskIds, relationships) {
  const adjacency = new Map(taskIds.map((id) => [id, []]));
  for (const relation of relationships) {
    if (relation.relationshipType !== "depends_on") continue;
    adjacency.get(relation.fromTaskId)?.push(relation.toTaskId);
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error("Task graph contains a circular dependency.");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of adjacency.get(id) || []) visit(next);
    visiting.delete(id); visited.add(id);
  }
  for (const id of taskIds) visit(id);
  return true;
}

export async function dependenciesSatisfied(store, task) {
  const rows = await store.query(
    `SELECT t.status FROM agent_task_relationships r JOIN agent_tasks_v2 t ON t.id = r.to_task_id
     WHERE r.user_id = ? AND r.worker_id = ? AND r.from_task_id = ? AND r.relationship_type = 'depends_on'`,
    task.userId, task.workerId, task.id
  );
  return rows.every((row) => row.status === "completed");
}

export async function listTaskAudit(store, { userId, workerId, taskId }) {
  return store.query("SELECT * FROM agent_task_audit_history WHERE user_id = ? AND worker_id = ? AND task_id = ? ORDER BY created_at ASC", userId, workerId, taskId);
}
