import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { wrapSqliteHandle } from "./dataStore.mjs";
import {
  loadUserTrendInsights,
  readGlobalTrendInsights,
  saveGlobalTrendInsights,
  saveUserTrendSnapshot
} from "./maraTrendOps.mjs";

test("global trend insights use shared DB SoT across readers", async () => {
  const db = new Database(":memory:");
  const store = wrapSqliteHandle(db);
  await store.execute(`CREATE TABLE worker_trend_snapshots (
    id TEXT PRIMARY KEY, user_id TEXT, worker_id TEXT, platform TEXT,
    niche TEXT, region TEXT, period_days INTEGER, source TEXT, source_url TEXT,
    payload_json TEXT, content_gaps_json TEXT, hashtags_json TEXT, insights_json TEXT,
    login_wall_encountered INTEGER, created_at TEXT, updated_at TEXT
  )`);

  await saveGlobalTrendInsights(store, {
    hashtags: [{ hashtag: "#shared", views: "1M" }],
    contentGaps: [],
    updatedAt: new Date().toISOString()
  }, { source: "test" });

  const fromDb = await readGlobalTrendInsights(store, { fileFallbackPath: "/no/such/file.json" });
  assert.equal(fromDb.hashtags[0].hashtag, "#shared");

  const insights = await loadUserTrendInsights({
    store,
    globalPath: "/no/such/file.json",
    userId: "u1",
    workerId: "mara-vale",
    readAccountContext: async () => null,
    readMaraOnboarding: async () => null,
    readWorkerKnowledge: async () => []
  });
  assert.ok(insights);
  const snapshot = await store.queryOne("SELECT id FROM worker_trend_snapshots WHERE user_id = ?", "u1");
  assert.ok(snapshot?.id);
  db.close();
});

test("saveUserTrendSnapshot is the per-user SoT even without files", async () => {
  const db = new Database(":memory:");
  const store = wrapSqliteHandle(db);
  await store.execute(`CREATE TABLE worker_trend_snapshots (
    id TEXT PRIMARY KEY, user_id TEXT, worker_id TEXT, platform TEXT,
    niche TEXT, region TEXT, period_days INTEGER, source TEXT, source_url TEXT,
    payload_json TEXT, content_gaps_json TEXT, hashtags_json TEXT, insights_json TEXT,
    login_wall_encountered INTEGER, created_at TEXT, updated_at TEXT
  )`);
  await saveUserTrendSnapshot(store, {
    userId: "u1",
    workerId: "mara-vale",
    insights: {
      niche: "beauty",
      region: "US",
      periodDays: 7,
      source: "test",
      sourceUrl: "",
      contentGaps: [],
      hashtags: [],
      insights: ["a"],
      loginWallEncountered: false,
      updatedAt: new Date().toISOString()
    }
  });
  const loaded = await loadUserTrendInsights({
    autoSync: false,
    store,
    globalPath: "/missing.json",
    userId: "u1",
    workerId: "mara-vale"
  });
  assert.equal(loaded.niche, "beauty");
  db.close();
});
