import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serverSource = await readFile(new URL("./index.mjs", import.meta.url), "utf8");

test("interactive Mara full runs are queued durably instead of detached promises", () => {
  assert.match(serverSource, /idempotencyKey: `manager_autonomy:/);
  assert.match(serverSource, /Full research run queued as/);
  assert.doesNotMatch(serverSource, /void runMaraAutonomyCycle\(\{\s*store: maraStore,\s*mode: "full"/);
});

test("Mara first-day work is queued durably instead of blocking onboarding", () => {
  assert.match(serverSource, /kind: "mara_first_day"/);
  assert.match(serverSource, /idempotencyKey: `mara_first_day:/);
  assert.doesNotMatch(serverSource, /maraAutomationResult = await runMaraFirstDayAutomation/);
});

test("production autonomy is enabled by default and can only be paused explicitly", () => {
  assert.match(serverSource, /AUTONOMY_SCHEDULER_ENABLED \?\? "1"/);
  assert.doesNotMatch(serverSource, /isProduction \? "0" : "1"/);
});

test("Mara chat assignments stay on Mara's specialized task runtime", () => {
  assert.match(serverSource, /workerSlug !== MARA_SLUG && hasRoleConfig\(workerSlug\)/);
});

test("a broken Gmail connection degrades independently instead of aborting Mara's autonomy", () => {
  assert.match(serverSource, /async function syncGmailInboxWithoutBlockingAutonomy/);
  assert.match(serverSource, /status = 'needs_reconnect'/);
  assert.match(serverSource, /await syncGmailInboxWithoutBlockingAutonomy\(row\.userId, row\.workerSlug\)/);
  assert.match(serverSource, /gmail_sync_degraded_autonomy_continues/);
});
