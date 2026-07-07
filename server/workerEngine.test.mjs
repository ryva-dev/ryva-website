import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  buildMaraInitialWorkPlan,
  buildMaraWorkspace,
  convertResearchItemToTask,
  createApprovalRequest,
  createApprovedTaskIfPermissionAllows,
  createRecurringResponsibility,
  createResearchItem,
  createSuggestedTask,
  defaultPermissionsForWorker,
  ensureWorkerPermissions,
  getWorkerPermissions,
  initWorkerTables,
  listRecurringResponsibilities,
  listWorkerTasksForUserWorker,
  MARA_WORKER_ID,
  runMaraActionDetector
} from "./workerEngine.mjs";

function makeDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE office_custom_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_slug TEXT NOT NULL,
      title TEXT NOT NULL,
      module_name TEXT NOT NULL,
      owner TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      due_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE office_activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_slug TEXT NOT NULL,
      action TEXT NOT NULL,
      module_name TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE office_suggested_actions (
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
      updated_at TEXT NOT NULL
    );
  `);
  initWorkerTables(db);
  return db;
}

test("worker permissions default correctly for Mara", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const permissions = getWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  assert.equal(permissions.canSuggestTasks, true);
  assert.equal(permissions.canCreateTasks, true);
  assert.equal(permissions.canRunResearch, true);
  assert.equal(permissions.canReadInbox, false);
  assert.equal(permissions.canSendEmailsWithoutApproval, false);
});

test("onboarding completion plan generates Mara work items", () => {
  const plan = buildMaraInitialWorkPlan({
    accountContext: { brandName: "Glow Forge", whatYouDo: "UGC creator for skincare brands" },
    maraAnswers: {
      approval_rules: "Never send anything without approval.",
      biggest_admin_drag: "Writing pitches and remembering follow-ups",
      current_workflow: "Everything is in my head",
      workflow_breakdowns: "I lose track of follow-ups"
    }
  });

  assert.ok(plan.tasks.length >= 7);
  assert.ok(plan.recurringResponsibilities.length >= 4);
  assert.ok(plan.memoryEntries.some((entry) => entry.title === "Pain point map"));
});

test("Mara can create tasks from memory-triggered chat", () => {
  const detector = runMaraActionDetector({
    openTasks: [],
    permissions: defaultPermissionsForWorker(MARA_WORKER_ID),
    recentMessages: [],
    triggerText: "I want to start reaching out to skincare brands but I hate writing pitches.",
    triggerType: "chat_message",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  assert.ok(detector.tasksToCreate.some((task) => task.title.includes("pitch template")));
  assert.ok(detector.researchItemsToCreate.some((item) => item.topic.includes("skincare")));
  assert.ok(detector.memoriesToSave.length > 0);
});

test("Mara does not duplicate tasks", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const first = createSuggestedTask(db, {
    description: "Draft a pitch.",
    priority: "high",
    title: "Create first skincare pitch template",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const second = createSuggestedTask(db, {
    description: "Draft a pitch again.",
    priority: "high",
    title: "Create first skincare pitch template",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(listWorkerTasksForUserWorker(db, "user-1", MARA_WORKER_ID).length, 1);
});

test("Mara creates approval requests for external actions", () => {
  const db = makeDb();
  const result = createApprovalRequest(db, {
    actionType: "send_email",
    description: "Send a drafted brand reply.",
    payload: { to: "brand@example.com" },
    title: "Approve brand reply",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  assert.equal(result.duplicate, false);
  const row = db.prepare("SELECT * FROM worker_approval_requests").get();
  assert.equal(row.action_type, "send_email");
  assert.equal(row.status, "pending");
});

test("approved tasks fall back to proposed when permission is missing", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID, { canDraftOutreach: false });
  createApprovedTaskIfPermissionAllows(db, {
    description: "Draft outreach",
    priority: "high",
    requiredPermissions: ["canDraftOutreach"],
    title: "Draft skincare outreach",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  const task = listWorkerTasksForUserWorker(db, "user-1", MARA_WORKER_ID)[0];
  assert.equal(task.status, "proposed");
});

test("recurring responsibilities can be created and listed", () => {
  const db = makeDb();
  createRecurringResponsibility(db, {
    cadence: "weekly",
    createdFrom: "onboarding",
    dayOfWeek: "Monday",
    description: "Find 5 brand leads weekly",
    title: "Weekly brand research",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  const responsibilities = listRecurringResponsibilities(db, "user-1", MARA_WORKER_ID);
  assert.equal(responsibilities.length, 1);
  assert.equal(responsibilities[0].title, "Weekly brand research");
});

test("research items can be queued and converted to tasks", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const research = createResearchItem(db, {
    evidence: [],
    insights: [],
    query: "Find skincare brands for beginner UGC creators",
    scope: "user_specific",
    sourceType: "manual",
    status: "queued",
    topic: "Find 5 skincare brand leads",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  const converted = convertResearchItemToTask(db, "user-1", MARA_WORKER_ID, research.id, {
    description: "Turn research into a task",
    priority: "high",
    title: "Find 5 skincare brand leads"
  });

  assert.equal(converted.duplicate, false);
  const updated = db.prepare("SELECT status FROM worker_research_items WHERE id = ?").get(research.id);
  assert.equal(updated.status, "converted_to_task");
});

test("workspace object returns tasks, memory, permissions, recurring responsibilities, and activity", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  createSuggestedTask(db, {
    description: "Draft a pitch",
    priority: "medium",
    title: "Create first pitch template",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  createRecurringResponsibility(db, {
    cadence: "weekly",
    createdFrom: "memory",
    description: "Weekly research",
    title: "Weekly brand research",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  const workspace = buildMaraWorkspace(db, "user-1", MARA_WORKER_ID, {
    readKnowledgeSections: () => [{ title: "Preferences", items: ["Keep pitches short"] }],
    readOfficeOverlays: () => ({ worklog: [] })
  });

  assert.ok(Array.isArray(workspace.openTasks));
  assert.ok(Array.isArray(workspace.proposedTasks));
  assert.ok(Array.isArray(workspace.recurringResponsibilities));
  assert.ok(Array.isArray(workspace.recentActivity));
  assert.equal(workspace.permissions.canCreateTasks, true);
  assert.equal(workspace.whatMaraKnows[0].title, "Preferences");
});
