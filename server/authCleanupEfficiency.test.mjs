import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("session lookup throttles expired-record cleanup instead of writing on every request", async () => {
  const source = await readFile(new URL("./index.mjs", import.meta.url), "utf8");
  assert.match(source, /nowMs - expiredRecordCleanupAt < 15 \* 60 \* 1000/);
  assert.match(source, /expiredRecordCleanupPromise/);
  assert.match(source, /sessions\.token_hash = \? AND sessions\.expires_at >= \?/);
});

test("production state changes fail closed when origin evidence is missing", async () => {
  const source = await readFile(new URL("./index.mjs", import.meta.url), "utf8");
  assert.match(source, /!requestOrigin && isProduction/);
  assert.match(source, /Missing request origin/);
});
