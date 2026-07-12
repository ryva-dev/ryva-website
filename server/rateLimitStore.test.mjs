import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { wrapSqliteHandle } from "./dataStore.mjs";
import { createDurableRateLimitStore, initRateLimitStore } from "./rateLimitStore.mjs";

test("durable rate limit store increments and resets across window expiry", async () => {
  const db = new Database(":memory:");
  const store = wrapSqliteHandle(db);
  await initRateLimitStore(store);
  const limiter = createDurableRateLimitStore(store, { windowMs: 50 });

  const first = await limiter.increment("chat:user:1");
  assert.equal(first.totalHits, 1);
  const second = await limiter.increment("chat:user:1");
  assert.equal(second.totalHits, 2);

  await new Promise((resolve) => setTimeout(resolve, 60));
  const afterExpiry = await limiter.increment("chat:user:1");
  assert.equal(afterExpiry.totalHits, 1);

  await limiter.resetKey("chat:user:1");
  const afterReset = await limiter.increment("chat:user:1");
  assert.equal(afterReset.totalHits, 1);
  db.close();
});
