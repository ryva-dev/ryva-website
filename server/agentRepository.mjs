import { randomUUID } from "node:crypto";

function parseJson(value, fallback) {
  if (value && typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeTitle(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const DEFAULT_PERMISSIONS = {
  approvalRequiredForExternalActions: true,
  canCreateRecurringResponsibilities: false,
  canCreateTasks: true,
  canDraftOutreach: false,
  canReadInbox: false,
  canRunResearch: false,
  canSendEmailsWithApproval: false,
  canSendEmailsWithoutApproval: false,
  canSuggestTasks: true,
  canUpdateExternalTrackers: false,
  canUseConnectedIntegrations: false
};

const permissionColumns = {
  approvalRequiredForExternalActions: "approval_required_for_external_actions",
  canCreateRecurringResponsibilities: "can_create_recurring_responsibilities",
  canCreateTasks: "can_create_tasks",
  canDraftOutreach: "can_draft_outreach",
  canReadInbox: "can_read_inbox",
  canRunResearch: "can_run_research",
  canSendEmailsWithApproval: "can_send_emails_with_approval",
  canSendEmailsWithoutApproval: "can_send_emails_without_approval",
  canSuggestTasks: "can_suggest_tasks",
  canUpdateExternalTrackers: "can_update_external_trackers",
  canUseConnectedIntegrations: "can_use_connected_integrations"
};

function mapPermissions(row) {
  return Object.fromEntries(Object.entries(permissionColumns).map(([key, column]) => [key, Boolean(row[column])]));
}

export async function ensureAgentPermissions(store, userId, workerId) {
  let row = await store.queryOne("SELECT * FROM worker_permissions WHERE user_id = ? AND worker_id = ?", userId, workerId);
  if (!row) {
    const now = new Date().toISOString();
    await store.execute(
      `INSERT INTO worker_permissions
       (id, user_id, worker_id, can_suggest_tasks, can_create_tasks, can_run_research,
        can_create_recurring_responsibilities, can_draft_outreach, can_read_inbox,
        can_send_emails_with_approval, can_send_emails_without_approval, can_update_external_trackers,
        can_use_connected_integrations, approval_required_for_external_actions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, worker_id) DO NOTHING`,
      randomUUID(), userId, workerId, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, now, now
    );
    row = await store.queryOne("SELECT * FROM worker_permissions WHERE user_id = ? AND worker_id = ?", userId, workerId);
  }
  return row ? mapPermissions(row) : { ...DEFAULT_PERMISSIONS };
}

export async function listAgentTasks(store, userId, workerId) {
  const rows = await store.query(
    `SELECT id, user_id AS "userId", worker_id AS "workerId", title, description, source, status, priority,
      due_at AS "dueAt", required_permissions_json AS "requiredPermissionsJson", evidence_used_json AS "evidenceUsedJson",
      output, task_type AS "taskType", target_brand_id AS "targetBrandId", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM worker_tasks WHERE user_id = ? AND worker_id = ? ORDER BY created_at DESC`, userId, workerId
  );
  return rows.map((row) => ({ ...row, requiredPermissions: parseJson(row.requiredPermissionsJson, []), evidenceUsed: parseJson(row.evidenceUsedJson, []) }));
}

export async function appendAgentActivity(store, event) {
  const id = randomUUID();
  await store.execute(
    `INSERT INTO worker_activity_log
     (id, user_id, worker_id, event_type, title, description, related_task_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, event.userId, event.workerId, event.eventType, event.title, event.description,
    event.relatedTaskId || null, JSON.stringify(event.metadata || {}), event.createdAt || new Date().toISOString()
  );
  return id;
}

export async function createAgentTask(store, task, permissions) {
  const normalized = normalizeTitle(task.title);
  const duplicate = await store.queryOne(
    "SELECT id FROM worker_tasks WHERE user_id = ? AND worker_id = ? AND normalized_title = ? AND status NOT IN ('dismissed', 'completed')",
    task.userId, task.workerId, normalized
  );
  if (duplicate) return { duplicate: true, id: duplicate.id };
  const required = Array.isArray(task.requiredPermissions) ? task.requiredPermissions : [];
  const authorized = required.every((permission) => permissions?.[permission] === true);
  const status = authorized ? (task.status || "approved") : "proposed";
  const id = randomUUID();
  const now = new Date().toISOString();
  await store.tx(async (transaction) => {
    await transaction.execute(
      `INSERT INTO worker_tasks
       (id, user_id, worker_id, title, description, source, status, priority, due_at,
        required_permissions_json, evidence_used_json, output, task_type, target_brand_id,
        normalized_title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, task.userId, task.workerId, task.title, task.description || "", task.source || "agent",
      status, task.priority || "medium", task.dueAt || null, JSON.stringify(required),
      JSON.stringify(task.evidenceUsed || []), task.output || null, task.taskType || "general_internal_task",
      task.targetBrandId || null, normalized, now, now
    );
    await transaction.execute(
      `INSERT INTO office_custom_tasks
       (id, user_id, worker_slug, title, module_name, owner, priority, status, due_date, created_at)
       VALUES (?, ?, ?, ?, ?, 'Worker', ?, ?, ?, ?)`,
      id, task.userId, task.workerId, task.title, task.source || "Agent",
      String(task.priority || "medium"), status === "completed" ? "Done" : "To Do", task.dueAt || "Soon", now
    );
  });
  await appendAgentActivity(store, { ...task, eventType: "task_created", title: task.title, description: task.description || "", relatedTaskId: id, metadata: { source: task.source, status } });
  return { duplicate: false, id, status };
}

export async function updateAgentTaskStatus(store, userId, workerId, taskId, status, output = undefined) {
  const now = new Date().toISOString();
  if (output === undefined) await store.execute("UPDATE worker_tasks SET status = ?, updated_at = ? WHERE id = ? AND user_id = ? AND worker_id = ?", status, now, taskId, userId, workerId);
  else await store.execute("UPDATE worker_tasks SET status = ?, output = ?, updated_at = ? WHERE id = ? AND user_id = ? AND worker_id = ?", status, output, now, taskId, userId, workerId);
  await store.execute("UPDATE office_custom_tasks SET status = ? WHERE id = ? AND user_id = ? AND worker_slug = ?", status === "completed" ? "Done" : "To Do", taskId, userId, workerId);
}

export async function listAgentOutputs(store, userId, workerId) {
  const rows = await store.query(
    `SELECT id, user_id AS "userId", worker_id AS "workerId", task_id AS "taskId", output_type AS "outputType",
      title, content, structured_content_json AS "structuredContentJson", source, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM worker_outputs WHERE user_id = ? AND worker_id = ? ORDER BY created_at DESC`, userId, workerId
  );
  return rows.map((row) => ({ ...row, structuredContent: parseJson(row.structuredContentJson, null) }));
}

export async function createAgentOutput(store, output) {
  const id = randomUUID();
  const now = output.createdAt || new Date().toISOString();
  await store.execute(
    `INSERT INTO worker_outputs
     (id, user_id, worker_id, task_id, output_type, title, content, structured_content_json, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, output.userId, output.workerId, output.taskId || null, output.outputType, output.title,
    output.content, output.structuredContent ? JSON.stringify(output.structuredContent) : null, output.source, now, now
  );
  await appendAgentActivity(store, { ...output, eventType: "worker_output_created", description: output.title, metadata: { outputType: output.outputType, source: output.source } });
  return { ...output, id, createdAt: now, updatedAt: now };
}

export async function listAgentKnowledge(store, { workerId, workerType = null }) {
  const rows = await store.query(
    `SELECT id, title, category, summary, content, updated_at AS "updatedAt"
     FROM worker_knowledge_modules WHERE is_active = 1
       AND (worker_id IS NULL OR worker_id = ?) AND (worker_type IS NULL OR worker_type = ?)
     ORDER BY category, title`, workerId, workerType
  );
  return rows;
}

export async function listAgentApprovals(store, userId, workerId) {
  const rows = await store.query(
    `SELECT id, action_type AS "actionType", title, description, payload_json AS "payloadJson", status,
      created_at AS "createdAt", updated_at AS "updatedAt"
     FROM worker_approval_requests WHERE user_id = ? AND worker_id = ? ORDER BY created_at DESC`, userId, workerId
  );
  return rows.map((row) => ({ ...row, payload: parseJson(row.payloadJson, {}) }));
}

export async function createAgentApproval(store, approval) {
  const normalized = normalizeTitle(approval.title);
  const duplicate = await store.queryOne(
    "SELECT id FROM worker_approval_requests WHERE user_id = ? AND worker_id = ? AND normalized_title = ? AND status = 'pending'",
    approval.userId, approval.workerId, normalized
  );
  if (duplicate) return { duplicate: true, id: duplicate.id };
  const id = randomUUID();
  const now = new Date().toISOString();
  await store.execute(
    `INSERT INTO worker_approval_requests
     (id, user_id, worker_id, action_type, title, description, payload_json, status, normalized_title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    id, approval.userId, approval.workerId, approval.actionType, approval.title, approval.description || "",
    JSON.stringify(approval.payload || {}), normalized, now, now
  );
  await appendAgentActivity(store, { ...approval, eventType: "approval_requested", description: approval.description || "", metadata: approval.payload || {} });
  return { duplicate: false, id };
}
