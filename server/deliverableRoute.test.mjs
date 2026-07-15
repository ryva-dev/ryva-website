import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serverSource = await readFile(new URL("./index.mjs", import.meta.url), "utf8");

test("deliverable detail resolves worker names from the loaded roster", () => {
  const routeStart = serverSource.indexOf('app.get("/api/office/deliverables/:deliverableId"');
  const routeSource = serverSource.slice(routeStart, routeStart + 9_000);

  assert.ok(routeStart >= 0);
  assert.match(routeSource, /const workers = await readWorkers\(\)/);
  assert.doesNotMatch(routeSource, /\bWORKERS\b/);
});
