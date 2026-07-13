import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { wrapSqliteHandle } from "./dataStore.mjs";
import { initMaraBrandArchitecture, recordResearchProviderRun } from "./maraBrandCanonical.mjs";
import { assertWithinDeepResearchLimit, normalizeAutonomyLimits, saveAutonomyLimits } from "./maraAutonomyLimits.mjs";

test("autonomy limits are bounded and cannot disable send approval", () => {
  const limits = normalizeAutonomyLimits({
    maxBrandsResearchedPerDay: 999,
    maxDeepResearchJobsPerWeek: -2,
    maxOutreachDraftsPerWeek: "12",
    maxFollowUpAttempts: 99,
    maxConcurrentTasks: 0,
    approvalRequiredForSend: false,
    excludedBrands: Array.from({ length: 120 }, (_, index) => `Brand ${index}`),
    unknownCapability: true
  });
  assert.equal(limits.maxBrandsResearchedPerDay, 25);
  assert.equal(limits.maxDeepResearchJobsPerWeek, 1);
  assert.equal(limits.maxOutreachDraftsPerWeek, 12);
  assert.equal(limits.maxFollowUpAttempts, 5);
  assert.equal(limits.maxConcurrentTasks, 1);
  assert.equal(limits.approvalRequiredForSend, true);
  assert.equal(limits.excludedBrands.length, 100);
  assert.equal("unknownCapability" in limits, false);
});

test("deep research requests honor the saved weekly cap", async () => {
  const db = new Database(":memory:");
  const store = wrapSqliteHandle(db);
  await initMaraBrandArchitecture(store);
  await saveAutonomyLimits(store, "u1", "mara-vale", { maxDeepResearchJobsPerWeek: 1 });
  await assertWithinDeepResearchLimit(store, "u1", "mara-vale");
  await recordResearchProviderRun(store, {
    userId: "u1", workerId: "mara-vale", providerName: "ryva_deep_research_request",
    researchType: "deep_brand_research", query: "Brand", status: "started", observations: []
  });
  await assert.rejects(() => assertWithinDeepResearchLimit(store, "u1", "mara-vale"), /Weekly deep research limit reached \(1\)/);
  db.close();
});
