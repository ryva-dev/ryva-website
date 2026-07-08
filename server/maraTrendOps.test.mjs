import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { initWorkerTables, MARA_WORKER_ID } from "./workerEngine.mjs";
import { getLatestTrendSnapshot, loadUserTrendInsights, syncUserTrendInsightsFromGlobal } from "./maraTrendOps.mjs";

function makeDb() {
  const db = new Database(":memory:");
  initWorkerTables(db);
  return db;
}

const readers = {
  readAccountContext: () => ({ brandName: "Glow Forge", whatYouDo: "skincare and wellness UGC" }),
  readMaraOnboarding: () => ({ answers: {} }),
  readWorkerKnowledge: () => []
};

const globalPayload = {
  hashtags: [
    { categories: ["Beauty"], hashtag: "#skincareroutine", posts: "120K", views: "40M" },
    { categories: ["Travel"], hashtag: "#empirestatebuilding", posts: "27.9K", views: "326.1M" }
  ],
  periodDays: 7,
  region: "US",
  sourceUrl: "https://example.com/trends",
  updatedAt: new Date().toISOString()
};

test("syncUserTrendInsightsFromGlobal stores per-user niche-scoped snapshot", () => {
  const db = makeDb();
  const globalPath = path.join(tmpdir(), `mara-trend-global-${Date.now()}.json`);
  writeFileSync(globalPath, JSON.stringify(globalPayload));

  const result = syncUserTrendInsightsFromGlobal({
    db,
    globalPath,
    ...readers,
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  const snapshot = getLatestTrendSnapshot(db, "user-1", MARA_WORKER_ID);
  assert.equal(result.synced, true);
  assert.equal(snapshot.niche, "skincare and wellness UGC");
  assert.ok(result.insights.hashtags.some((item) => /skincare/i.test(item.hashtag)));
});

test("loadUserTrendInsights returns stored per-user insights", () => {
  const db = makeDb();
  const globalPath = path.join(tmpdir(), `mara-trend-global-${Date.now()}-2.json`);
  writeFileSync(globalPath, JSON.stringify(globalPayload));

  syncUserTrendInsightsFromGlobal({
    db,
    globalPath,
    ...readers,
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  const insights = loadUserTrendInsights({
    autoSync: false,
    db,
    globalPath,
    ...readers,
    userId: "user-1",
    workerId: MARA_WORKER_ID
  });

  assert.equal(insights.niche, "skincare and wellness UGC");
  assert.ok(insights.contentGaps.length > 0);
});
