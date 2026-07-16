import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serverSource = await readFile(new URL("./index.mjs", import.meta.url), "utf8");
const workerEngineSource = await readFile(new URL("./workerEngine.mjs", import.meta.url), "utf8");

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

test("a failed office projection cannot rewrite a completed autonomy cycle as failed", () => {
  assert.match(serverSource, /Mara operational sync failed; autonomy cycle preserved/);
  assert.match(serverSource, /incrementMetric\("mara_operational_sync_failed"/);
});

test("Mara activity aliases preserve camelCase when PostgreSQL builds workspace history", () => {
  assert.match(workerEngineSource, /event_type AS "eventType"/);
  assert.match(workerEngineSource, /metadata_json AS "metadataJson"/);
  assert.match(workerEngineSource, /created_at AS "createdAt"/);
  assert.match(workerEngineSource, /const seenActivity = new Set\(\)/);
  assert.match(workerEngineSource, /seenActivity\.has\(fingerprint\)/);
});
