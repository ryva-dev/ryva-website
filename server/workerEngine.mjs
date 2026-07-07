import { randomUUID } from "node:crypto";

export const MARA_WORKER_ID = "mara-vale";

export const DEFAULT_MARA_PERMISSIONS = {
  approvalRequiredForExternalActions: true,
  canCreateRecurringResponsibilities: true,
  canCreateTasks: true,
  canDraftOutreach: true,
  canReadInbox: false,
  canRunResearch: true,
  canSendEmailsWithApproval: false,
  canSendEmailsWithoutApproval: false,
  canSuggestTasks: true,
  canUpdateExternalTrackers: false,
  canUseConnectedIntegrations: false
};

export const MARA_ROLE_DEFINITION =
  "Mara is a junior UGC operations hire for creators. She helps creators organize workflow, research brand opportunities, draft outreach, track follow-ups, plan content, identify bottlenecks, and keep momentum. She is proactive, organized, direct, and practical. She asks for approval before sensitive actions.";

const TASK_STATUS_MAP = {
  approved: "To Do",
  blocked: "Needs Review",
  completed: "Completed",
  dismissed: "Completed",
  in_progress: "In Progress",
  proposed: "Needs Review"
};

const PRIORITY_MAP = {
  high: "High",
  low: "Low",
  medium: "Medium"
};

export function normalizeForComparison(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function initWorkerTables(db) {
  db.exec(`
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
  `);
}

export function defaultPermissionsForWorker(workerId) {
  if (workerId === MARA_WORKER_ID) {
    return { ...DEFAULT_MARA_PERMISSIONS };
  }

  return {
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
}

function boolToInt(value) {
  return value ? 1 : 0;
}

function intToBool(value) {
  return Boolean(value);
}

function safeJsonParse(value, fallback) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function ensureWorkerPermissions(db, userId, workerId, overrides = {}) {
  const current = db
    .prepare(
      `SELECT *
       FROM worker_permissions
       WHERE user_id = ? AND worker_id = ?`
    )
    .get(userId, workerId);

  if (current) {
    return getWorkerPermissions(db, userId, workerId);
  }

  const timestamp = new Date().toISOString();
  const next = { ...defaultPermissionsForWorker(workerId), ...overrides };
  db.prepare(
    `INSERT INTO worker_permissions (
      id, user_id, worker_id,
      can_suggest_tasks, can_create_tasks, can_run_research, can_create_recurring_responsibilities,
      can_draft_outreach, can_read_inbox, can_send_emails_with_approval, can_send_emails_without_approval,
      can_update_external_trackers, can_use_connected_integrations, approval_required_for_external_actions,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    userId,
    workerId,
    boolToInt(next.canSuggestTasks),
    boolToInt(next.canCreateTasks),
    boolToInt(next.canRunResearch),
    boolToInt(next.canCreateRecurringResponsibilities),
    boolToInt(next.canDraftOutreach),
    boolToInt(next.canReadInbox),
    boolToInt(next.canSendEmailsWithApproval),
    boolToInt(next.canSendEmailsWithoutApproval),
    boolToInt(next.canUpdateExternalTrackers),
    boolToInt(next.canUseConnectedIntegrations),
    boolToInt(next.approvalRequiredForExternalActions),
    timestamp,
    timestamp
  );

  return getWorkerPermissions(db, userId, workerId);
}

export function getWorkerPermissions(db, userId, workerId) {
  const record = db
    .prepare(
      `SELECT *
       FROM worker_permissions
       WHERE user_id = ? AND worker_id = ?`
    )
    .get(userId, workerId);

  if (!record) {
    return ensureWorkerPermissions(db, userId, workerId);
  }

  return {
    approvalRequiredForExternalActions: intToBool(record.approval_required_for_external_actions),
    canCreateRecurringResponsibilities: intToBool(record.can_create_recurring_responsibilities),
    canCreateTasks: intToBool(record.can_create_tasks),
    canDraftOutreach: intToBool(record.can_draft_outreach),
    canReadInbox: intToBool(record.can_read_inbox),
    canRunResearch: intToBool(record.can_run_research),
    canSendEmailsWithApproval: intToBool(record.can_send_emails_with_approval),
    canSendEmailsWithoutApproval: intToBool(record.can_send_emails_without_approval),
    canSuggestTasks: intToBool(record.can_suggest_tasks),
    canUpdateExternalTrackers: intToBool(record.can_update_external_trackers),
    canUseConnectedIntegrations: intToBool(record.can_use_connected_integrations)
  };
}

export function createWorkerActivityLog(db, {
  createdAt,
  description,
  eventType,
  metadata = {},
  relatedTaskId = null,
  title,
  userId,
  workerId
}) {
  const timestamp = createdAt || new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO worker_activity_log (id, user_id, worker_id, event_type, title, description, related_task_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, workerId, eventType, title, description, relatedTaskId, JSON.stringify(metadata), timestamp);
  return id;
}

function hasRequiredPermissions(permissions, requiredPermissions) {
  return requiredPermissions.every((permission) => permissions[permission] === true);
}

export function listWorkerTasksForUserWorker(db, userId, workerId) {
  return db
    .prepare(
      `SELECT id, user_id AS userId, worker_id AS workerId, title, description, source, status, priority,
              due_at AS dueAt, required_permissions_json AS requiredPermissionsJson, evidence_used_json AS evidenceUsedJson,
              output, created_at AS createdAt, updated_at AS updatedAt
       FROM worker_tasks
       WHERE user_id = ? AND worker_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId, workerId)
    .map((row) => ({
      ...row,
      evidenceUsed: safeJsonParse(row.evidenceUsedJson, []),
      requiredPermissions: safeJsonParse(row.requiredPermissionsJson, [])
    }));
}

function findDuplicateTask(db, userId, workerId, title) {
  const normalizedTitle = normalizeForComparison(title);
  return db
    .prepare(
      `SELECT id
       FROM worker_tasks
       WHERE user_id = ? AND worker_id = ? AND normalized_title = ? AND status NOT IN ('dismissed', 'completed')`
    )
    .get(userId, workerId, normalizedTitle);
}

export function createWorkerTask(db, task) {
  const normalizedTitle = normalizeForComparison(task.title);
  const duplicate = findDuplicateTask(db, task.userId, task.workerId, task.title);
  if (duplicate) {
    return { duplicate: true, id: duplicate.id };
  }

  const timestamp = task.createdAt || new Date().toISOString();
  const id = randomUUID();
  const requiredPermissions = Array.isArray(task.requiredPermissions) ? task.requiredPermissions.map(String) : [];
  const evidenceUsed = Array.isArray(task.evidenceUsed) ? task.evidenceUsed : [];

  db.prepare(
    `INSERT INTO worker_tasks (id, user_id, worker_id, title, description, source, status, priority, due_at,
      required_permissions_json, evidence_used_json, output, normalized_title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    task.userId,
    task.workerId,
    task.title,
    task.description,
    task.source,
    task.status,
    task.priority,
    task.dueAt ?? null,
    JSON.stringify(requiredPermissions),
    JSON.stringify(evidenceUsed),
    task.output ?? null,
    normalizedTitle,
    timestamp,
    timestamp
  );

  db.prepare(
    `INSERT INTO office_custom_tasks (id, user_id, worker_slug, title, module_name, owner, priority, status, due_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    task.userId,
    task.workerId,
    task.title,
    task.source,
    "Worker",
    PRIORITY_MAP[task.priority] ?? "Medium",
    TASK_STATUS_MAP[task.status] ?? "To Do",
    task.dueAt ?? "Soon",
    timestamp
  );

  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: task.description,
    eventType: "task_created",
    metadata: { source: task.source, status: task.status },
    relatedTaskId: id,
    title: task.title,
    userId: task.userId,
    workerId: task.workerId
  });

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), task.userId, task.workerId, "Created worker task.", "Worker Tasks", task.title, timestamp);

  return { duplicate: false, id };
}

export function updateWorkerTaskStatus(db, userId, workerId, taskId, status) {
  const timestamp = new Date().toISOString();
  db.prepare(
    `UPDATE worker_tasks
     SET status = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND worker_id = ?`
  ).run(status, timestamp, taskId, userId, workerId);

  db.prepare(
    `UPDATE office_custom_tasks
     SET status = ?
     WHERE id = ? AND user_id = ? AND worker_slug = ?`
  ).run(TASK_STATUS_MAP[status] ?? "To Do", taskId, userId, workerId);

  return { ok: true };
}

export function completeWorkerTask(db, userId, workerId, taskId, output = null) {
  const timestamp = new Date().toISOString();
  db.prepare(
    `UPDATE worker_tasks
     SET status = 'completed', output = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND worker_id = ?`
  ).run(output, timestamp, taskId, userId, workerId);
  updateWorkerTaskStatus(db, userId, workerId, taskId, "completed");
  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: output || "Task completed.",
    eventType: "task_completed",
    relatedTaskId: taskId,
    title: "Completed worker task",
    userId,
    workerId
  });
  return { ok: true };
}

export function createSuggestedTask(db, task) {
  return createWorkerTask(db, {
    ...task,
    source: task.source || "mara_suggested",
    status: "proposed"
  });
}

export function createApprovedTaskIfPermissionAllows(db, task) {
  const permissions = getWorkerPermissions(db, task.userId, task.workerId);
  const requiredPermissions = Array.isArray(task.requiredPermissions) ? task.requiredPermissions : [];
  if (!hasRequiredPermissions(permissions, requiredPermissions)) {
    createWorkerActivityLog(db, {
      description: `Blocked task creation due to missing permissions: ${requiredPermissions.join(", ")}`,
      eventType: "permission_blocked_action",
      metadata: { requiredPermissions },
      title: task.title,
      userId: task.userId,
      workerId: task.workerId
    });
    return createSuggestedTask(db, { ...task, source: task.source || "mara_suggested" });
  }

  return createWorkerTask(db, {
    ...task,
    source: task.source || "memory_triggered",
    status: "approved"
  });
}

function findDuplicateRecurring(db, userId, workerId, title) {
  return db
    .prepare(
      `SELECT id
       FROM worker_recurring_responsibilities
       WHERE user_id = ? AND worker_id = ? AND normalized_title = ? AND is_active = 1`
    )
    .get(userId, workerId, normalizeForComparison(title));
}

export function createRecurringResponsibility(db, recurring) {
  const duplicate = findDuplicateRecurring(db, recurring.userId, recurring.workerId, recurring.title);
  if (duplicate) {
    return { duplicate: true, id: duplicate.id };
  }

  const timestamp = recurring.createdAt || new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO worker_recurring_responsibilities
      (id, user_id, worker_id, title, description, cadence, day_of_week, is_active, permission_required,
       last_run_at, next_run_at, created_from, normalized_title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    recurring.userId,
    recurring.workerId,
    recurring.title,
    recurring.description,
    recurring.cadence,
    recurring.dayOfWeek ?? null,
    recurring.isActive === false ? 0 : 1,
    recurring.permissionRequired ?? null,
    recurring.lastRunAt ?? null,
    recurring.nextRunAt ?? null,
    recurring.createdFrom,
    normalizeForComparison(recurring.title),
    timestamp,
    timestamp
  );

  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: recurring.description,
    eventType: "recurring_responsibility_created",
    metadata: { cadence: recurring.cadence, createdFrom: recurring.createdFrom },
    title: recurring.title,
    userId: recurring.userId,
    workerId: recurring.workerId
  });

  return { duplicate: false, id };
}

export function listRecurringResponsibilities(db, userId, workerId) {
  return db
    .prepare(
      `SELECT id, user_id AS userId, worker_id AS workerId, title, description, cadence, day_of_week AS dayOfWeek,
              is_active AS isActive, permission_required AS permissionRequired, last_run_at AS lastRunAt,
              next_run_at AS nextRunAt, created_from AS createdFrom, created_at AS createdAt, updated_at AS updatedAt
       FROM worker_recurring_responsibilities
       WHERE user_id = ? AND worker_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId, workerId)
    .map((row) => ({ ...row, isActive: intToBool(row.isActive) }));
}

function findDuplicateResearch(db, userId, workerId, topic) {
  return db
    .prepare(
      `SELECT id
       FROM worker_research_items
       WHERE coalesce(user_id, '') = coalesce(?, '') AND worker_id = ? AND normalized_topic = ? AND status NOT IN ('dismissed')`
    )
    .get(userId ?? null, workerId, normalizeForComparison(topic));
}

export function createResearchItem(db, item) {
  const duplicate = findDuplicateResearch(db, item.userId ?? null, item.workerId, item.topic);
  if (duplicate) {
    return { duplicate: true, id: duplicate.id };
  }

  const timestamp = item.createdAt || new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO worker_research_items
      (id, user_id, worker_id, scope, topic, query, source_type, status, summary, insights_json, evidence_json, normalized_topic, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    item.userId ?? null,
    item.workerId,
    item.scope,
    item.topic,
    item.query,
    item.sourceType,
    item.status,
    item.summary ?? null,
    JSON.stringify(Array.isArray(item.insights) ? item.insights : []),
    JSON.stringify(Array.isArray(item.evidence) ? item.evidence : []),
    normalizeForComparison(item.topic),
    timestamp,
    timestamp
  );

  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: item.query,
    eventType: "research_item_created",
    metadata: { scope: item.scope, sourceType: item.sourceType, status: item.status },
    title: item.topic,
    userId: item.userId ?? "global",
    workerId: item.workerId
  });

  return { duplicate: false, id };
}

export function listResearchItems(db, userId, workerId) {
  return db
    .prepare(
      `SELECT id, user_id AS userId, worker_id AS workerId, scope, topic, query, source_type AS sourceType, status, summary,
              insights_json AS insightsJson, evidence_json AS evidenceJson, created_at AS createdAt, updated_at AS updatedAt
       FROM worker_research_items
       WHERE worker_id = ? AND (user_id IS NULL OR user_id = ?)
       ORDER BY created_at DESC`
    )
    .all(workerId, userId)
    .map((row) => ({
      ...row,
      evidence: safeJsonParse(row.evidenceJson, []),
      insights: safeJsonParse(row.insightsJson, [])
    }));
}

export function convertResearchItemToTask(db, userId, workerId, researchItemId, taskInput) {
  db.prepare(
    `UPDATE worker_research_items
     SET status = 'converted_to_task', updated_at = ?
     WHERE id = ? AND worker_id = ? AND (user_id = ? OR user_id IS NULL)`
  ).run(new Date().toISOString(), researchItemId, workerId, userId);

  return createWorkerTask(db, {
    ...taskInput,
    evidenceUsed: [...(taskInput.evidenceUsed ?? []), `research:${researchItemId}`],
    source: taskInput.source || "research_triggered",
    status: taskInput.status || "approved",
    userId,
    workerId
  });
}

function findDuplicateApproval(db, userId, workerId, title) {
  return db
    .prepare(
      `SELECT id
       FROM worker_approval_requests
       WHERE user_id = ? AND worker_id = ? AND normalized_title = ? AND status = 'pending'`
    )
    .get(userId, workerId, normalizeForComparison(title));
}

export function createApprovalRequest(db, approval) {
  const duplicate = findDuplicateApproval(db, approval.userId, approval.workerId, approval.title);
  if (duplicate) {
    return { duplicate: true, id: duplicate.id };
  }

  const timestamp = approval.createdAt || new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO worker_approval_requests
      (id, user_id, worker_id, action_type, title, description, payload_json, status, normalized_title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    approval.userId,
    approval.workerId,
    approval.actionType,
    approval.title,
    approval.description,
    JSON.stringify(approval.payload ?? {}),
    approval.status || "pending",
    normalizeForComparison(approval.title),
    timestamp,
    timestamp
  );

  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: approval.description,
    eventType: "approval_requested",
    metadata: approval.payload ?? {},
    title: approval.title,
    userId: approval.userId,
    workerId: approval.workerId
  });

  db.prepare(
    `INSERT INTO office_suggested_actions
      (id, user_id, worker_slug, action_type, title, description, reason, related_thread_id, related_campaign_id, related_brand_id, payload_json, status, requires_approval, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, 'suggested', 1, ?, ?)`
  ).run(
    id,
    approval.userId,
    approval.workerId,
    approval.actionType,
    approval.title,
    approval.description,
    "Awaiting approval before sensitive or external action.",
    JSON.stringify(approval.payload ?? {}),
    timestamp,
    timestamp
  );

  return { duplicate: false, id };
}

export function listApprovalRequests(db, userId, workerId) {
  return db
    .prepare(
      `SELECT id, action_type AS actionType, title, description, payload_json AS payloadJson, status, created_at AS createdAt, updated_at AS updatedAt
       FROM worker_approval_requests
       WHERE user_id = ? AND worker_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId, workerId)
    .map((row) => ({ ...row, payload: safeJsonParse(row.payloadJson, {}) }));
}

export function buildMaraInitialWorkPlan({ accountContext, maraAnswers }) {
  const niche = String(maraAnswers.target_niches || accountContext?.whatYouDo || "UGC creator work").trim();
  const workflowPain = String(maraAnswers.workflow_breakdowns || "Tracking follow-ups and brand conversations").trim();
  const adminBottleneck = String(maraAnswers.biggest_admin_drag || "Staying organized across outreach, ideas, and follow-ups").trim();
  const inboxPriorities = String(maraAnswers.email_volume || "brand emails, briefs, deadlines, and follow-ups").trim();
  const approvalRules = String(maraAnswers.approval_rules || "Sensitive external actions should be approval-gated.").trim();
  const dailyOutput = String(maraAnswers.daily_output || "A clear list of what moved, what is blocked, and what needs approval.").trim();
  const brandName = String(accountContext?.brandName || "Your brand").trim();

  const creatorProfileSummary = `${brandName} is focused on ${String(accountContext?.whatYouDo || niche).trim()}. Mara should operate as a junior UGC operations hire supporting creator workflow, outreach, and momentum.`;
  const brandFitCriteria = [
    `Brands aligned with ${niche}`,
    "UGC-friendly and open to creator partnerships",
    "Reasonable fit for the creator's current stage and positioning"
  ];
  const painPointMap = [workflowPain, adminBottleneck, `Inbox priorities: ${inboxPriorities}`];
  const first7DayActionPlan = [
    "Clarify creator positioning and ideal brand fit",
    "Set up first outreach assets and brand tracker structure",
    "Generate a first batch of research-backed opportunities",
    "Create a repeatable follow-up rhythm"
  ];
  const firstOutreachAngle = `Lead with a concise ${niche} creator pitch that removes friction and gives brands a clear reason to reply.`;
  const firstContentIdeas = [
    `Three ${niche} content concepts tied to brand outcomes`,
    "A low-production authenticity angle",
    "A problem-solution product use case"
  ];
  const tasks = [
    { title: "Define creator positioning", description: "Turn onboarding context into a clear positioning statement Mara can use across workflow and outreach.", priority: "high" },
    { title: "Build brand fit criteria", description: "Document what kinds of brands Mara should prioritize or avoid.", priority: "high" },
    { title: "Create first pitch template", description: "Draft a low-friction outreach template grounded in the creator's niche and strengths.", priority: "high" },
    { title: "Find first 5 target brands", description: "Queue a first research-backed starter list of brand opportunities.", priority: "high" },
    { title: "Create first content idea batch", description: "Draft initial content ideas Mara can turn into a repeatable workflow.", priority: "medium" },
    { title: "Build follow-up sequence", description: "Create a simple follow-up structure so outreach does not stall.", priority: "medium" },
    { title: "Set up brand tracker structure", description: "Prepare the tracking structure needed so conversations do not get lost.", priority: "medium" },
    { title: "Review weekly UGC workflow", description: "Map the weekly rhythm Mara should own and where approvals are required.", priority: "medium" }
  ];
  const recurringResponsibilities = [
    { title: "Weekly brand research", description: "Find fresh aligned brand opportunities each week.", cadence: "weekly", dayOfWeek: "Monday" },
    { title: "Weekly content idea batch", description: "Prepare a weekly batch of UGC-friendly concepts.", cadence: "weekly", dayOfWeek: "Friday" },
    { title: "Follow-up review", description: "Review open follow-ups and stalled opportunities twice per week.", cadence: "weekly", dayOfWeek: "Wednesday" },
    { title: "Monthly creator profile refresh", description: "Refresh positioning, brand fit, and workflow assumptions each month.", cadence: "monthly", dayOfWeek: null }
  ];
  const memoryEntries = [
    { title: "Creator profile summary", items: [creatorProfileSummary] },
    { title: "Brand fit criteria", items: brandFitCriteria },
    { title: "Pain point map", items: painPointMap },
    { title: "First 7-day action plan", items: first7DayActionPlan },
    { title: "First outreach angle", items: [firstOutreachAngle] },
    { title: "First content ideas", items: firstContentIdeas },
    { title: "Approval rules", items: [approvalRules] },
    { title: "Desired daily output", items: [dailyOutput] }
  ];

  return {
    brandFitCriteria,
    creatorProfileSummary,
    first7DayActionPlan,
    firstContentIdeas,
    firstOutreachAngle,
    memoryEntries,
    painPointMap,
    recurringResponsibilities,
    recommendedNextActions: tasks.slice(0, 4).map((task) => task.title),
    tasks
  };
}

export function runMaraActionDetector({
  openTasks = [],
  permissions = DEFAULT_MARA_PERMISSIONS,
  recentMessages = [],
  triggerText,
  triggerType,
  userId,
  workerId
}) {
  const normalizedText = String(triggerText ?? "").trim();
  const lower = normalizedText.toLowerCase();
  const tasksToCreate = [];
  const recurringResponsibilitiesToSuggest = [];
  const researchItemsToCreate = [];
  const approvalRequests = [];
  const memoriesToSave = [];
  const existingTaskTitles = new Set(openTasks.map((task) => normalizeForComparison(task.title)));

  if (!normalizedText) {
    return {
      approvalRequests,
      memoriesToSave,
      recurringResponsibilitiesToSuggest,
      researchItemsToCreate,
      tasksToCreate,
      userFacingSummary: ""
    };
  }

  memoriesToSave.push({ title: "Recent direction", items: [normalizedText] });

  if (/(prefer|like|hate|don'?t want|want)/.test(lower)) {
    memoriesToSave.push({ title: "Preferences", items: [normalizedText] });
  }

  if (/(always|never|approval|ask before|don'?t send|do not send)/.test(lower)) {
    memoriesToSave.push({ title: "Approval rules", items: [normalizedText] });
  }

  if ((/skincare|beauty|wellness/.test(lower) || /brand/.test(lower)) && /reach out|outreach|pitch/.test(lower)) {
    if (!existingTaskTitles.has(normalizeForComparison("Create first skincare pitch template"))) {
      tasksToCreate.push({
        description: "Draft a reusable outreach template aligned with the user's niche and tone preferences.",
        evidenceUsed: [normalizedText],
        priority: "high",
        requiredPermissions: permissions.canDraftOutreach ? [] : ["canDraftOutreach"],
        source: "memory_triggered",
        status: permissions.canCreateTasks ? "approved" : "proposed",
        title: "Create first skincare pitch template"
      });
    }

    if (!existingTaskTitles.has(normalizeForComparison("Find 5 skincare brand leads"))) {
      researchItemsToCreate.push({
        evidence: [normalizedText],
        insights: [],
        query: "Find 5 skincare brands aligned with the creator's niche and current stage.",
        scope: "user_specific",
        sourceType: "manual",
        status: "queued",
        topic: "Find 5 skincare brand leads"
      });
      tasksToCreate.push({
        description: "Research a starter list of skincare brand opportunities and turn them into a workable lead set.",
        evidenceUsed: [normalizedText],
        priority: "high",
        requiredPermissions: permissions.canRunResearch ? [] : ["canRunResearch"],
        source: "research_triggered",
        status: permissions.canCreateTasks && permissions.canRunResearch ? "approved" : "proposed",
        title: "Find 5 skincare brand leads"
      });
    }

    recurringResponsibilitiesToSuggest.push({
      cadence: "weekly",
      createdFrom: "memory",
      dayOfWeek: "Monday",
      description: "Find a fresh batch of aligned skincare brand opportunities each week.",
      permissionRequired: null,
      title: "Weekly skincare brand research"
    });
  }

  if (/losing track|follow-up|follow up|tracker|messy|missed/.test(lower)) {
    if (!existingTaskTitles.has(normalizeForComparison("Set up brand tracker structure"))) {
      tasksToCreate.push({
        description: "Create the structure Mara can use to keep outreach, follow-ups, and brand conversations visible.",
        evidenceUsed: [normalizedText],
        priority: "high",
        requiredPermissions: [],
        source: triggerType === "onboarding_completed" ? "onboarding_generated" : "memory_triggered",
        status: permissions.canCreateTasks ? "approved" : "proposed",
        title: "Set up brand tracker structure"
      });
    }
  }

  if (/gmail|outlook|inbox|email/.test(lower) && /connect|read|use|check/.test(lower)) {
    approvalRequests.push({
      actionType: "use_integration",
      description: "Mara needs approval before using inbox-connected tools or reading inbox data.",
      payload: { requestedMessage: normalizedText },
      title: "Approve inbox or integration access"
    });
  }

  if (/every week|weekly|every monday|every friday|twice per week/.test(lower) && /research|review|ideas|follow-up|follow up/.test(lower)) {
    recurringResponsibilitiesToSuggest.push({
      cadence: /every friday/.test(lower) ? "weekly" : "weekly",
      createdFrom: "user_request",
      dayOfWeek: /every monday/.test(lower) ? "Monday" : /every friday/.test(lower) ? "Friday" : null,
      description: normalizedText,
      permissionRequired: null,
      title: "Recurring workflow responsibility"
    });
  }

  const userFacingSummaryParts = [];
  if (tasksToCreate.length > 0) userFacingSummaryParts.push(`created ${tasksToCreate.length} task${tasksToCreate.length === 1 ? "" : "s"}`);
  if (researchItemsToCreate.length > 0) userFacingSummaryParts.push(`queued ${researchItemsToCreate.length} research item${researchItemsToCreate.length === 1 ? "" : "s"}`);
  if (recurringResponsibilitiesToSuggest.length > 0) userFacingSummaryParts.push(`identified ${recurringResponsibilitiesToSuggest.length} recurring responsibility${recurringResponsibilitiesToSuggest.length === 1 ? "" : "ies"}`);
  if (approvalRequests.length > 0) userFacingSummaryParts.push(`prepared ${approvalRequests.length} approval request${approvalRequests.length === 1 ? "" : "s"}`);

  return {
    approvalRequests,
    memoriesToSave,
    recurringResponsibilitiesToSuggest,
    researchItemsToCreate,
    tasksToCreate,
    userFacingSummary: userFacingSummaryParts.length > 0 ? `I ${userFacingSummaryParts.join(", ")} based on what you told me.` : ""
  };
}

export function buildMaraWorkspace(db, userId, workerId, { readKnowledgeSections, readOfficeOverlays } = {}) {
  const tasks = listWorkerTasksForUserWorker(db, userId, workerId);
  const approvals = listApprovalRequests(db, userId, workerId).filter((request) => request.status === "pending");
  const recurringResponsibilities = listRecurringResponsibilities(db, userId, workerId);
  const researchItems = listResearchItems(db, userId, workerId);
  const permissions = getWorkerPermissions(db, userId, workerId);
  const whatMaraKnows = typeof readKnowledgeSections === "function" ? readKnowledgeSections(userId, workerId) : [];
  const overlays = typeof readOfficeOverlays === "function" ? readOfficeOverlays(userId) : { worklog: [] };
  const recentActivity = db
    .prepare(
      `SELECT id, event_type AS eventType, title, description, related_task_id AS relatedTaskId, metadata_json AS metadataJson, created_at AS createdAt
       FROM worker_activity_log
       WHERE user_id = ? AND worker_id = ?
       ORDER BY created_at DESC
       LIMIT 12`
    )
    .all(userId, workerId)
    .map((row) => ({ ...row, metadata: safeJsonParse(row.metadataJson, {}) }));
  const openTasks = tasks.filter((task) => ["approved", "in_progress"].includes(task.status));
  const proposedTasks = tasks.filter((task) => task.status === "proposed");
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const blockedTasks = tasks.filter((task) => task.status === "blocked");

  return {
    blockedTasks,
    completedTasks,
    currentFocus: openTasks[0]?.title || proposedTasks[0]?.title || "Building the next best operating step.",
    openTasks,
    pendingApprovals: approvals,
    permissions,
    proposedTasks,
    recentActivity,
    recurringResponsibilities,
    recommendedNextActions: [
      ...proposedTasks.slice(0, 2).map((task) => task.title),
      ...researchItems.filter((item) => item.status === "queued").slice(0, 2).map((item) => `Research: ${item.topic}`)
    ].slice(0, 4),
    whatMaraKnows
  };
}
