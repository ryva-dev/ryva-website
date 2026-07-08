import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  autoExecuteSafeMaraTasks,
  buildMaraInitialWorkPlan,
  buildMaraExecutionContext,
  buildMaraWorkspace,
  convertResearchItemToTask,
  createApprovalRequest,
  createApprovedTaskIfPermissionAllows,
  createRecurringResponsibility,
  createResearchItem,
  createSuggestedTask,
  defaultPermissionsForWorker,
  dismissWorkerTask,
  ensureWorkerPermissions,
  getMaraRelevantKnowledge,
  getWorkerPermissions,
  inferMaraTaskType,
  initWorkerTables,
  listWorkerKnowledgeModules,
  listRecurringResponsibilities,
  listWorkerOutputs,
  listWorkerTasksForUserWorker,
  MARA_WORKER_ID,
  runMaraActionDetector,
  runMaraAutonomyCycle,
  runMaraTask,
  runWorkerTask,
  updateWorkerPermissions,
  updateApprovalRequestStatus
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

function makeExecutionReaders(overrides = {}) {
  return {
    readAccountContext: () => ({ brandName: "Glow Forge", whatYouDo: "skincare and wellness UGC" }),
    readConnectedIntegrations: () => [],
    readMaraOnboarding: () => ({ answers: { approval_rules: "Ask before sending anything external." }, generatedSummary: [] }),
    readMessages: () => [],
    readPrivateInsights: () => null,
    readWorkerKnowledge: () => [{ title: "Preferences", items: ["Keep outreach short and confident."] }],
    ...overrides
  };
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

test("worker permissions can be updated after integration connect", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const updated = updateWorkerPermissions(db, "user-1", MARA_WORKER_ID, {
    canReadInbox: true,
    canSendEmailsWithApproval: true,
    canUseConnectedIntegrations: true
  });
  assert.equal(updated.canReadInbox, true);
  assert.equal(updated.canSendEmailsWithApproval, true);
  assert.equal(updated.canUseConnectedIntegrations, true);
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

test("approval requests can be approved and reflected in suggested actions", () => {
  const db = makeDb();
  const approval = createApprovalRequest(db, {
    actionType: "send_email",
    description: "Send a drafted reply.",
    payload: { to: "brand@example.com" },
    title: "Approve drafted reply",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  const result = updateApprovalRequestStatus(db, "user-1", MARA_WORKER_ID, approval.id, "approved");
  assert.equal(result.ok, true);
  assert.equal(db.prepare("SELECT status FROM worker_approval_requests WHERE id = ?").get(approval.id).status, "approved");
  assert.equal(db.prepare("SELECT status FROM office_suggested_actions WHERE id = ?").get(approval.id).status, "approved");
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

test("safe internal Mara tasks can run and save an output", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Draft a first pitch template.",
    priority: "high",
    requiredPermissions: [],
    title: "Create first pitch template",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  const result = runMaraTask({ db, taskId: created.id, userId: "user-1", workerId: MARA_WORKER_ID, ...makeExecutionReaders() });
  const task = db.prepare("SELECT status, output FROM worker_tasks WHERE id = ?").get(created.id);

  assert.equal(result.output.outputType, "pitch_template");
  assert.equal(task.status, "completed");
  assert.ok(String(task.output).includes("pitch_template"));
  assert.equal(listWorkerOutputs(db, "user-1", MARA_WORKER_ID).length, 1);
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

test("waiting on you includes pending approvals", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  createApprovalRequest(db, {
    actionType: "use_integration",
    description: "Approve inbox access before inbox review.",
    payload: {},
    title: "Approve inbox access",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  const workspace = buildMaraWorkspace(db, "user-1", MARA_WORKER_ID);
  assert.equal(workspace.waitingOnUser[0].title, "Approve inbox access");
  assert.match(workspace.waitingOnUser[0].blockerReason, /paused until you approve/i);
});

test("blocked tasks expose blocker reason and next step", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  createSuggestedTask(db, {
    description: "Review inbox follow-ups for brand replies.",
    priority: "high",
    requiredPermissions: ["canReadInbox"],
    title: "Review inbox follow-ups",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  db.prepare("UPDATE worker_tasks SET status = 'blocked' WHERE title = ?").run("Review inbox follow-ups");

  const workspace = buildMaraWorkspace(db, "user-1", MARA_WORKER_ID);
  assert.equal(workspace.blockedTasks[0].title, "Review inbox follow-ups");
  assert.match(workspace.blockedTasks[0].blockerReason, /inbox access is connected/i);
  assert.match(workspace.blockedTasks[0].nextStep, /Connect Gmail or Outlook/i);
});

test("current focus prefers highest-priority runnable task before lower-priority work", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  createApprovedTaskIfPermissionAllows(db, {
    description: "Low priority task.",
    priority: "low",
    requiredPermissions: [],
    title: "Organize archived notes",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  createApprovedTaskIfPermissionAllows(db, {
    description: "High priority task.",
    priority: "high",
    requiredPermissions: [],
    title: "Create first pitch template",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  const workspace = buildMaraWorkspace(db, "user-1", MARA_WORKER_ID);
  assert.equal(workspace.currentFocus, "Create first pitch template");
  assert.equal(workspace.recommendedNextTaskToRun?.title, "Create first pitch template");
});

test("workspace uses honest empty state when no real work exists", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);

  const workspace = buildMaraWorkspace(db, "user-1", MARA_WORKER_ID);
  assert.equal(workspace.currentFocus, "Mara is ready for her next assignment.");
  assert.equal(workspace.runnableTasks.length, 0);
  assert.equal(workspace.latestOutputs.length, 0);
  assert.equal(workspace.pendingApprovals.length, 0);
});

test("recommended next includes starter task metadata when no tracked work exists", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);

  const workspace = buildMaraWorkspace(db, "user-1", MARA_WORKER_ID);
  assert.equal(workspace.recommendedNext?.kind, "starter_task");
  assert.equal(workspace.recommendedNext?.createTask?.title, "Define creator positioning");
});

test("dismissing a worker task removes it from active recommendation flow", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Draft the first pitch template.",
    priority: "high",
    requiredPermissions: [],
    title: "Create first pitch template",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  dismissWorkerTask(db, "user-1", MARA_WORKER_ID, created.id);
  const workspace = buildMaraWorkspace(db, "user-1", MARA_WORKER_ID);
  assert.notEqual(workspace.recommendedNext?.taskId, created.id);
  assert.equal(db.prepare("SELECT status FROM worker_tasks WHERE id = ?").get(created.id).status, "dismissed");
});

test("runMaraTask refuses tasks from another user", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Draft a first pitch template.",
    priority: "high",
    requiredPermissions: [],
    title: "Create first pitch template",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  assert.throws(() => runMaraTask({ db, taskId: created.id, userId: "user-2", workerId: MARA_WORKER_ID, ...makeExecutionReaders() }), /Worker task not found/);
});

test("runMaraTask checks permissions and blocks when missing", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID, { canDraftOutreach: false });
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Draft a first pitch template.",
    priority: "high",
    requiredPermissions: ["canDraftOutreach"],
    title: "Create first pitch template",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const task = listWorkerTasksForUserWorker(db, "user-1", MARA_WORKER_ID).find((entry) => entry.id === created.id);

  assert.equal(task.status, "proposed");
});

test("runMaraTask marks task blocked when required context is missing", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Draft a reply to the latest brand message.",
    priority: "high",
    requiredPermissions: [],
    taskType: "draft_brand_reply",
    title: "Draft brand reply",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  const result = runMaraTask({ db, taskId: created.id, userId: "user-1", workerId: MARA_WORKER_ID, ...makeExecutionReaders() });
  assert.match(result.blockerReason, /requires pasted brand message text/i);
  assert.equal(db.prepare("SELECT status FROM worker_tasks WHERE id = ?").get(created.id).status, "blocked");
});

test("autoExecuteSafeMaraTasks executes safe onboarding tasks", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const first = createApprovedTaskIfPermissionAllows(db, {
    description: "Define creator positioning.",
    priority: "high",
    requiredPermissions: [],
    taskType: "creator_positioning",
    title: "Define creator positioning",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const second = createApprovedTaskIfPermissionAllows(db, {
    description: "Build brand fit criteria.",
    priority: "high",
    requiredPermissions: [],
    taskType: "brand_fit_criteria",
    title: "Build brand fit criteria",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  const results = autoExecuteSafeMaraTasks({
    db,
    taskIds: [first.id, second.id],
    userId: "user-1",
    workerId: MARA_WORKER_ID,
    ...makeExecutionReaders()
  });

  assert.equal(results.length, 2);
  assert.equal(listWorkerOutputs(db, "user-1", MARA_WORKER_ID).length, 2);
});

test("task type inference works for onboarding-generated tasks", () => {
  assert.equal(inferMaraTaskType("Define creator positioning", "onboarding_generated"), "creator_positioning");
  assert.equal(inferMaraTaskType("Build brand fit criteria", "onboarding_generated"), "brand_fit_criteria");
  assert.equal(inferMaraTaskType("Create first pitch template", "onboarding_generated"), "pitch_template");
  assert.equal(inferMaraTaskType("Create first content idea batch", "onboarding_generated"), "content_idea_batch");
});

test("creator positioning task produces saved output", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Define creator positioning.",
    priority: "high",
    requiredPermissions: [],
    taskType: "creator_positioning",
    title: "Define creator positioning",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const result = runMaraTask({ db, taskId: created.id, userId: "user-1", workerId: MARA_WORKER_ID, ...makeExecutionReaders() });
  assert.equal(result.output.outputType, "creator_positioning");
  assert.match(result.output.content, /Creator positioning statement/);
});

test("brand fit criteria task produces saved output", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Build brand fit criteria.",
    priority: "high",
    requiredPermissions: [],
    taskType: "brand_fit_criteria",
    title: "Build brand fit criteria",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const result = runMaraTask({ db, taskId: created.id, userId: "user-1", workerId: MARA_WORKER_ID, ...makeExecutionReaders() });
  assert.equal(result.output.outputType, "brand_criteria");
  assert.match(result.output.content, /Best-fit industries/);
});

test("content idea batch task produces saved output", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Create a first content idea batch.",
    priority: "high",
    requiredPermissions: [],
    taskType: "content_idea_batch",
    title: "Create first content idea batch",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const result = runMaraTask({ db, taskId: created.id, userId: "user-1", workerId: MARA_WORKER_ID, ...makeExecutionReaders() });
  assert.equal(result.output.outputType, "content_ideas");
  assert.equal(result.output.structuredContent.ideas.length, 10);
});

test("buildMaraExecutionContext reuses previous outputs", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const positioningTask = createApprovedTaskIfPermissionAllows(db, {
    description: "Define creator positioning.",
    priority: "high",
    requiredPermissions: [],
    taskType: "creator_positioning",
    title: "Define creator positioning",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  runMaraTask({ db, taskId: positioningTask.id, userId: "user-1", workerId: MARA_WORKER_ID, ...makeExecutionReaders() });
  const pitchTask = createApprovedTaskIfPermissionAllows(db, {
    description: "Create first pitch template.",
    priority: "high",
    requiredPermissions: [],
    taskType: "pitch_template",
    title: "Create first pitch template",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const context = buildMaraExecutionContext({ db, taskId: pitchTask.id, userId: "user-1", workerId: MARA_WORKER_ID, ...makeExecutionReaders() });
  assert.ok(context.previousOutputs.some((output) => output.outputType === "creator_positioning"));
});

test("workspace includes latest outputs and runnable tasks", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const completed = createApprovedTaskIfPermissionAllows(db, {
    description: "Define creator positioning.",
    priority: "high",
    requiredPermissions: [],
    taskType: "creator_positioning",
    title: "Define creator positioning",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  runMaraTask({ db, taskId: completed.id, userId: "user-1", workerId: MARA_WORKER_ID, ...makeExecutionReaders() });
  createApprovedTaskIfPermissionAllows(db, {
    description: "Build follow-up sequence.",
    priority: "medium",
    requiredPermissions: [],
    taskType: "follow_up_sequence",
    title: "Build follow-up sequence",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  const workspace = buildMaraWorkspace(db, "user-1", MARA_WORKER_ID, {
    readKnowledgeSections: makeExecutionReaders().readWorkerKnowledge,
    readOfficeOverlays: () => ({ worklog: [] })
  });

  assert.ok(workspace.latestOutputs.length > 0);
  assert.ok(workspace.runnableTasks.length > 0);
});

test("activity log records task execution and output creation", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Create first pitch template.",
    priority: "high",
    requiredPermissions: [],
    taskType: "pitch_template",
    title: "Create first pitch template",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  runMaraTask({ db, taskId: created.id, userId: "user-1", workerId: MARA_WORKER_ID, ...makeExecutionReaders() });

  const events = db.prepare("SELECT event_type AS eventType FROM worker_activity_log WHERE user_id = ? AND worker_id = ?").all("user-1", MARA_WORKER_ID).map((row) => row.eventType);
  assert.ok(events.includes("task_execution_started"));
  assert.ok(events.includes("task_execution_completed"));
  assert.ok(events.includes("worker_output_created"));
});

test("UGC knowledge modules are seeded", () => {
  const db = makeDb();
  const modules = listWorkerKnowledgeModules(db, { workerId: MARA_WORKER_ID });
  assert.ok(modules.length >= 12);
  assert.ok(modules.some((module) => module.category === "ugc_basics"));
  assert.ok(modules.some((module) => module.category === "red_flags"));
});

test("getMaraRelevantKnowledge returns relevant modules by task type", () => {
  const db = makeDb();
  const modules = getMaraRelevantKnowledge({
    db,
    taskType: "pitch_template",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const categories = modules.map((module) => module.category);
  assert.ok(categories.includes("ugc_basics"));
  assert.ok(categories.includes("outreach"));
  assert.ok(categories.includes("pitch_templates"));
  assert.ok(!categories.includes("admin_tracking"));
});

test("pitch template execution includes outreach and pitch knowledge", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Create a first pitch template.",
    priority: "high",
    requiredPermissions: [],
    taskType: "pitch_template",
    title: "Create first pitch template",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const result = runMaraTask({ db, taskId: created.id, userId: "user-1", workerId: MARA_WORKER_ID, ...makeExecutionReaders() });
  assert.match(result.output.content, /Subject line options/);
  assert.match(result.output.content, /Personalization placeholders/);
});

test("content idea batch execution includes content strategy knowledge", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Create a first content idea batch.",
    priority: "high",
    requiredPermissions: [],
    taskType: "content_idea_batch",
    title: "Create first content idea batch",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const result = runMaraTask({ db, taskId: created.id, userId: "user-1", workerId: MARA_WORKER_ID, ...makeExecutionReaders() });
  assert.ok(result.output.structuredContent.ideas.some((idea) => /Problem-first|Why this works|Before you buy/.test(idea.hook)));
});

test("content idea batch execution uses private creator-search insights when present", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Create a first content idea batch.",
    priority: "high",
    requiredPermissions: [],
    taskType: "content_idea_batch",
    title: "Create first content idea batch",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const result = runMaraTask({
    db,
    taskId: created.id,
    userId: "user-1",
    workerId: MARA_WORKER_ID,
    ...makeExecutionReaders({
      readPrivateInsights: () => ({
        contentGaps: [{ label: "ingredient education" }, { label: "day-in-the-life proof" }]
      })
    })
  });
  assert.ok(result.output.structuredContent.privateContentGapsUsed.includes("ingredient education"));
});

test("brand fit criteria execution includes brand research knowledge", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Build brand fit criteria.",
    priority: "high",
    requiredPermissions: [],
    taskType: "brand_fit_criteria",
    title: "Build brand fit criteria",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const result = runMaraTask({ db, taskId: created.id, userId: "user-1", workerId: MARA_WORKER_ID, ...makeExecutionReaders() });
  assert.match(result.output.content, /Bad-fit|Red flags|priority/i);
});

test("pasted brand message analysis detects missing usage payment and deliverable details", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Analyze the pasted brand message.",
    priority: "high",
    requiredPermissions: [],
    taskType: "pasted_message_analysis",
    title: "Analyze pasted brand message",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const result = runMaraTask({
    db,
    taskId: created.id,
    userId: "user-1",
    workerId: MARA_WORKER_ID,
    ...makeExecutionReaders({
      readMessages: () => [{ author: "You", text: "Brand: We'd love to work with you soon. Let us know if interested." }]
    })
  });
  assert.match(result.output.content, /Potential thing to clarify: what exact deliverables/i);
  assert.match(result.output.content, /Potential thing to clarify: how compensation works/i);
  assert.match(result.output.content, /Potential thing to clarify: whether usage rights/i);
});

test("draft brand reply includes approval reminder and clarification questions", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Draft a brand reply.",
    priority: "high",
    requiredPermissions: [],
    taskType: "draft_brand_reply",
    title: "Draft brand reply",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const result = runMaraTask({
    db,
    taskId: created.id,
    userId: "user-1",
    workerId: MARA_WORKER_ID,
    ...makeExecutionReaders({
      readMessages: () => [{ author: "You", text: "Brand: We'd love a video and raw footage. Can you send pricing?" }]
    })
  });
  assert.match(result.output.content, /Approval reminder/);
  assert.match(result.output.content, /Questions to clarify/);
});

test("Mara recommendations change when portfolio and follow-up system are missing", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const workspace = buildMaraWorkspace(db, "user-1", MARA_WORKER_ID, {
    readKnowledgeSections: () => [{ title: "Recent direction", items: ["I am a beginner creator and I am losing track of follow-ups."] }],
    readOfficeOverlays: () => ({ worklog: [] })
  });
  assert.match(workspace.recommendedNext.label, /portfolio|positioning|follow-up/i);
});

test("knowledge retrieval does not include every module unnecessarily", () => {
  const db = makeDb();
  const modules = getMaraRelevantKnowledge({
    db,
    taskType: "follow_up_sequence",
    limit: 4,
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  assert.ok(modules.length <= 4);
  assert.ok(modules.every((module) => ["ugc_basics", "follow_ups", "outreach", "admin_tracking"].includes(module.category)));
});

test("Mara outputs do not claim live research was performed", () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID);
  const created = createApprovedTaskIfPermissionAllows(db, {
    description: "Create a first content idea batch.",
    priority: "high",
    requiredPermissions: [],
    taskType: "content_idea_batch",
    title: "Create first content idea batch",
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });
  const result = runMaraTask({ db, taskId: created.id, userId: "user-1", workerId: MARA_WORKER_ID, ...makeExecutionReaders() });
  assert.doesNotMatch(result.output.content, /I checked TikTok trends|Reddit/i);
});

test("runMaraAutonomyCycle creates deliverables and research-backed tasks", async () => {
  const db = makeDb();
  ensureWorkerPermissions(db, "user-1", MARA_WORKER_ID, {
    canReadInbox: true,
    canSendEmailsWithApproval: true,
    canUseConnectedIntegrations: true
  });
  db.prepare(
    `CREATE TABLE office_email_threads (
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
      updated_at TEXT NOT NULL
    )`
  ).run();
  db.prepare(
    `INSERT INTO office_email_threads
      (id, user_id, worker_slug, provider, subject, participants_json, snippet, received_at, brand_related, category, urgency, confidence, reason, brand_name, contact_name, contact_email, source_message_count, thread_status, raw_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "thread-1",
    "user-1",
    MARA_WORKER_ID,
    "gmail",
    "Glow Theory follow-up",
    JSON.stringify(["brand@example.com"]),
    "Need revised deliverables and timing.",
    new Date().toISOString(),
    1,
    "outreach",
    "high",
    0.91,
    "Likely brand thread",
    "Glow Theory",
    "Taylor",
    "brand@example.com",
    2,
    "awaiting_reply",
    "{}",
    new Date().toISOString(),
    new Date().toISOString()
  );

  const mockFetch = async (url) => {
    if (String(url).includes("duckduckgo.com")) {
      return {
        ok: true,
        text: async () => `
          <a class="result__a" href="https://examplebrand.com">Example Brand</a>
          <a class="result__a" href="https://secondbrand.com">Second Brand</a>
        `
      };
    }
    if (String(url).includes("reddit.com")) {
      return {
        ok: true,
        text: async () => JSON.stringify({
          data: {
            children: [
              { data: { title: "Creators are struggling with ingredient education hooks", permalink: "/r/ugc/comments/1" } }
            ]
          }
        })
      };
    }
    return {
      ok: true,
      text: async () => `
        <html>
          <head>
            <title>Example Brand | Skincare</title>
            <meta name="description" content="A skincare brand built around simple routines and founder-led education." />
          </head>
          <body></body>
        </html>
      `
    };
  };

  const summary = await runMaraAutonomyCycle({
    db,
    fetchImpl: mockFetch,
    userId: "user-1",
    workerId: MARA_WORKER_ID,
    ...makeExecutionReaders({
      readConnectedIntegrations: () => [{ provider: "gmail", status: "connected", accountLabel: "Gmail inbox", metadata: {} }],
      readMaraOnboarding: () => ({
        answers: { approval_rules: "Ask before sending anything external." },
        generatedSummary: [],
        status: "completed"
      }),
      readPrivateInsights: () => ({
        contentGaps: [{ label: "ingredient education" }, { label: "before-and-after honesty" }]
      })
    })
  });

  assert.ok(summary.outputs.length > 0);
  assert.ok(listWorkerOutputs(db, "user-1", MARA_WORKER_ID).some((output) => output.title === "Daily brand research digest"));
  assert.ok(listWorkerTasksForUserWorker(db, "user-1", MARA_WORKER_ID).some((task) => /personalized pitch/i.test(task.title)));
});
