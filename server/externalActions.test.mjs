import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "./dataStore.mjs";
import { claimExternalAction, completeExternalAction, initExternalActions, markExternalActionUncertain } from "./externalActions.mjs";

test("external side effects are claimed exactly once and completed durably", async () => {
  const store = createStore({ databasePath: ":memory:" });
  await initExternalActions(store);
  const action = { userId: "u1", workerId: "mara-vale", actionType: "send_email", approvalId: "a1", idempotencyKey: "gmail:draft-1", request: { to: "brand@example.com" } };
  const first = await claimExternalAction(store, action);
  const replay = await claimExternalAction(store, action);
  assert.equal(first.claimed, true);
  assert.equal(replay.claimed, false);
  assert.equal(replay.status, "executing");
  assert.equal(await completeExternalAction(store, first.id, { providerId: "sent-1" }), true);
  const completedReplay = await claimExternalAction(store, action);
  assert.equal(completedReplay.status, "completed");
  assert.deepEqual(completedReplay.result, { providerId: "sent-1" });
  await store.close();
});

test("ambiguous provider failures require reconciliation instead of automatic retry", async () => {
  const store = createStore({ databasePath: ":memory:" });
  await initExternalActions(store);
  const first = await claimExternalAction(store, { userId: "u1", workerId: "mara-vale", actionType: "send_email", idempotencyKey: "gmail:draft-2" });
  await markExternalActionUncertain(store, first.id, "timeout after request");
  const replay = await claimExternalAction(store, { userId: "u1", workerId: "mara-vale", actionType: "send_email", idempotencyKey: "gmail:draft-2" });
  assert.equal(replay.claimed, false);
  assert.equal(replay.status, "needs_reconciliation");
  await store.close();
});
