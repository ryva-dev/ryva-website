import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { wrapSqliteHandle } from "./dataStore.mjs";
import { createAgentOutput, createAgentTask, ensureAgentPermissions, listAgentOutputs, listAgentTasks, updateAgentTaskStatus } from "./agentRepository.mjs";

function repositoryStore() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE worker_permissions (id TEXT PRIMARY KEY, user_id TEXT, worker_id TEXT,
      can_suggest_tasks INTEGER, can_create_tasks INTEGER, can_run_research INTEGER,
      can_create_recurring_responsibilities INTEGER, can_draft_outreach INTEGER, can_read_inbox INTEGER,
      can_send_emails_with_approval INTEGER, can_send_emails_without_approval INTEGER,
      can_update_external_trackers INTEGER, can_use_connected_integrations INTEGER,
      approval_required_for_external_actions INTEGER, created_at TEXT, updated_at TEXT, UNIQUE(user_id, worker_id));
    CREATE TABLE worker_tasks (id TEXT PRIMARY KEY, user_id TEXT, worker_id TEXT, title TEXT, description TEXT,
      source TEXT, status TEXT, priority TEXT, due_at TEXT, required_permissions_json TEXT,
      evidence_used_json TEXT, output TEXT, task_type TEXT, target_brand_id TEXT, normalized_title TEXT,
      created_at TEXT, updated_at TEXT);
    CREATE TABLE office_custom_tasks (id TEXT PRIMARY KEY, user_id TEXT, worker_slug TEXT, title TEXT,
      module_name TEXT, owner TEXT, priority TEXT, status TEXT, due_date TEXT, created_at TEXT);
    CREATE TABLE worker_activity_log (id TEXT PRIMARY KEY, user_id TEXT, worker_id TEXT, event_type TEXT,
      title TEXT, description TEXT, related_task_id TEXT, metadata_json TEXT, created_at TEXT);
    CREATE TABLE worker_outputs (id TEXT PRIMARY KEY, user_id TEXT, worker_id TEXT, task_id TEXT,
      output_type TEXT, title TEXT, content TEXT, structured_content_json TEXT, source TEXT, created_at TEXT, updated_at TEXT);
  `);
  return { db, store: wrapSqliteHandle(db) };
}

test("generic agent repository persists personalized work through async store", async () => {
  const { db, store } = repositoryStore();
  const permissions = await ensureAgentPermissions(store, "user-1", "sloane-pierce");
  const created = await createAgentTask(store, {
    userId: "user-1", workerId: "sloane-pierce", title: "Build Glowe rate card",
    description: "Use Glowe's current rate floor.", taskType: "rate_card", status: "approved"
  }, permissions);
  assert.equal(created.duplicate, false);
  assert.equal((await listAgentTasks(store, "user-1", "sloane-pierce"))[0].title, "Build Glowe rate card");
  const output = await createAgentOutput(store, {
    userId: "user-1", workerId: "sloane-pierce", taskId: created.id, outputType: "rate_card",
    title: "Glowe rate card", content: "Glowe-specific pricing", structuredContent: { brand: "Glowe" }, source: "task_execution"
  });
  await updateAgentTaskStatus(store, "user-1", "sloane-pierce", created.id, "completed", output.id);
  assert.equal((await listAgentOutputs(store, "user-1", "sloane-pierce"))[0].structuredContent.brand, "Glowe");
  assert.equal((await listAgentTasks(store, "user-1", "sloane-pierce"))[0].status, "completed");
  db.close();
});
