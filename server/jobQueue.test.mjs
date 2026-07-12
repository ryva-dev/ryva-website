import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { claimJobs, completeJob, enqueueJob, failJob, initJobQueue } from "./jobQueue.mjs";
import { wrapSqliteHandle } from "./dataStore.mjs";

test("durable queue deduplicates, leases, completes, and retries", async () => {
  const db = new Database(":memory:");
  const store = wrapSqliteHandle(db);
  await initJobQueue(store);
  assert.equal((await enqueueJob(store, { kind: "autonomy", idempotencyKey: "u:w:1" })).enqueued, true);
  assert.equal((await enqueueJob(store, { kind: "autonomy", idempotencyKey: "u:w:1" })).enqueued, false);
  const [job] = await claimJobs(store, { owner: "instance-a" });
  assert.equal(job.kind, "autonomy");
  assert.equal((await claimJobs(store, { owner: "instance-b" })).length, 0);
  assert.equal(await failJob(store, job.id, "instance-a", "temporary", { retryDelayMs: 0 }), true);
  const [retry] = await claimJobs(store, { owner: "instance-b" });
  assert.equal(retry.attempts, 2);
  assert.equal(await completeJob(store, retry.id, "instance-b"), true);
  assert.equal((await claimJobs(store, { owner: "instance-c" })).length, 0);
  db.close();
});
