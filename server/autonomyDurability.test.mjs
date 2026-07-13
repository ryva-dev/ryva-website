import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serverSource = await readFile(new URL("./index.mjs", import.meta.url), "utf8");

test("interactive Mara full runs are queued durably instead of detached promises", () => {
  assert.match(serverSource, /idempotencyKey: `manager_autonomy:/);
  assert.match(serverSource, /Full research run queued as/);
  assert.doesNotMatch(serverSource, /void runMaraAutonomyCycle\(\{\s*store: maraStore,\s*mode: "full"/);
});
