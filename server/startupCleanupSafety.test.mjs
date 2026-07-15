import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serverSource = await readFile(new URL("./index.mjs", import.meta.url), "utf8");

test("listicle cleanup never deletes user work from title heuristics", () => {
  const cleanupStart = serverSource.indexOf("async function purgeListicleArtifacts()");
  const cleanupEnd = serverSource.indexOf("await purgeListicleArtifacts();", cleanupStart);
  const cleanupSource = serverSource.slice(cleanupStart, cleanupEnd);

  assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart);
  assert.doesNotMatch(cleanupSource, /DELETE FROM worker_outputs/);
  assert.doesNotMatch(cleanupSource, /DELETE FROM worker_tasks/);
  assert.doesNotMatch(cleanupSource, /DELETE FROM office_deliverables/);
  assert.doesNotMatch(cleanupSource, /DELETE FROM office_assignments/);
});
