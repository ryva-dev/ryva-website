import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import {
  claimJobs,
  completeJob,
  enqueueJob,
  extendJobLease,
  failJob,
  initJobQueue,
  mergeOAuthTokenMetadata,
  startJobLeaseHeartbeat
} from "./jobQueue.mjs";
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

test("extendJobLease prevents reclaim; expired lease without heartbeat is reclaimable", async () => {
  const db = new Database(":memory:");
  const store = wrapSqliteHandle(db);
  await initJobQueue(store);
  await enqueueJob(store, { kind: "worker_autonomy", idempotencyKey: "lease-1" });
  const [job] = await claimJobs(store, { owner: "a", leaseMs: 50 });
  assert.ok(job);

  await new Promise((resolve) => setTimeout(resolve, 80));
  const reclaimed = [];
  const stolen = await claimJobs(store, {
    owner: "b",
    onReclaim: (info) => reclaimed.push(info)
  });
  assert.equal(stolen.length, 1);
  assert.equal(stolen[0].id, job.id);
  assert.equal(reclaimed[0]?.kind, "worker_autonomy");

  await enqueueJob(store, { kind: "worker_autonomy", idempotencyKey: "lease-2" });
  const [held] = await claimJobs(store, { owner: "a", leaseMs: 200 });
  assert.equal(await extendJobLease(store, held.id, "a", 5_000), true);
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal((await claimJobs(store, { owner: "b" })).length, 0);
  assert.equal(await completeJob(store, held.id, "a"), true);
  db.close();
});

test("heartbeat keeps lease alive across short expiry windows", async () => {
  const db = new Database(":memory:");
  const store = wrapSqliteHandle(db);
  await initJobQueue(store);
  await enqueueJob(store, { kind: "mara_video_analysis", idempotencyKey: "hb-1" });
  const [job] = await claimJobs(store, { owner: "a", leaseMs: 80 });
  const stop = startJobLeaseHeartbeat(store, job.id, "a", { leaseMs: 5_000, intervalMs: 30 });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal((await claimJobs(store, { owner: "b" })).length, 0);
  stop();
  assert.equal(await completeJob(store, job.id, "a"), true);
  db.close();
});

test("mergeOAuthTokenMetadata preserves refresh token when Google omits it", () => {
  const merged = mergeOAuthTokenMetadata(
    { refreshToken: "keep-me", accessToken: "old", emailAddress: "a@b.com" },
    { refreshToken: "", accessToken: "new", emailAddress: "a@b.com", expiresAt: "later" }
  );
  assert.equal(merged.refreshToken, "keep-me");
  assert.equal(merged.accessToken, "new");
  assert.equal(merged.expiresAt, "later");
});
