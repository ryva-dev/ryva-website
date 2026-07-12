import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildScopedTrendInsights,
  inferTrendNiche,
  normalizeTrendInsightsPayload
} from "./maraTrendInsights.mjs";

const DEFAULT_MAX_AGE_HOURS = Number.parseInt(process.env.MARA_TREND_SNAPSHOT_MAX_AGE_HOURS ?? String(24 * 7), 10);
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, "..");
const GLOBAL_PLATFORM = "tiktok";

export function resolveGlobalTrendInsightsPath() {
  const configured = String(process.env.MARA_PRIVATE_INSIGHTS_PATH ?? "").trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(repoRoot, configured);
  }
  const storageRoot =
    process.env.STORAGE_ROOT ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    path.join(repoRoot, "data");
  return path.join(storageRoot, "private", "mara-tiktok-creator-search-insights.json");
}

export function resolveStorageRoot() {
  return (
    process.env.STORAGE_ROOT ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    path.join(repoRoot, "data")
  );
}

function usesSharedObjectStorage() {
  return String(process.env.OBJECT_STORAGE_DRIVER ?? "").trim().toLowerCase() === "s3";
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function getUserTrendInsightsFilePath(storageRoot, userId) {
  return path.join(storageRoot, "private", "users", userId, "mara-tiktok-trend-insights.json");
}

export function getUserTrendObjectStoredName() {
  return `trends/mara-tiktok-trend-insights.json`;
}

/** Local-file fallback for ops import only — not the multi-instance SoT. */
export function readGlobalTikTokInsightsFromFile(globalPath) {
  try {
    const raw = readFileSync(globalPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @deprecated Prefer readGlobalTrendInsights(store). Kept for scripts/tests. */
export function readGlobalTikTokInsights(globalPath) {
  return readGlobalTikTokInsightsFromFile(globalPath);
}

export async function ensureGlobalTrendTable(store) {
  await store.execute(`CREATE TABLE IF NOT EXISTS mara_global_trend_insights (
    platform TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    source TEXT,
    updated_at TEXT NOT NULL
  )`);
}

export async function saveGlobalTrendInsights(store, payload, { platform = GLOBAL_PLATFORM, source = null } = {}) {
  await ensureGlobalTrendTable(store);
  const now = new Date().toISOString();
  const normalized = typeof payload === "string" ? payload : JSON.stringify(payload);
  await store.execute(
    `INSERT INTO mara_global_trend_insights (platform, payload_json, source, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(platform) DO UPDATE SET
       payload_json = excluded.payload_json,
       source = excluded.source,
       updated_at = excluded.updated_at`,
    platform,
    normalized,
    source,
    now
  );
  return { platform, updatedAt: now };
}

export async function readGlobalTrendInsights(store, { platform = GLOBAL_PLATFORM, fileFallbackPath = null } = {}) {
  await ensureGlobalTrendTable(store);
  const row = await store.queryOne(
    `SELECT payload_json AS "payloadJson", source, updated_at AS "updatedAt"
     FROM mara_global_trend_insights WHERE platform = ?`,
    platform
  );
  if (row?.payloadJson) {
    const parsed = typeof row.payloadJson === "string" ? safeJsonParse(row.payloadJson, null) : row.payloadJson;
    if (parsed) return parsed;
  }
  // Bootstrap from local ops file into DB once so replicas share SoT afterwards.
  if (fileFallbackPath) {
    const fromFile = readGlobalTikTokInsightsFromFile(fileFallbackPath);
    if (fromFile) {
      await saveGlobalTrendInsights(store, fromFile, { platform, source: "file_bootstrap" });
      return fromFile;
    }
  }
  return null;
}

export async function getLatestTrendSnapshot(store, userId, workerId, platform = "tiktok") {
  return store.queryOne(
    `SELECT id, niche, region, period_days AS "periodDays", source, source_url AS "sourceUrl",
            payload_json AS "payloadJson", content_gaps_json AS "contentGapsJson", hashtags_json AS "hashtagsJson",
            insights_json AS "insightsJson", login_wall_encountered AS "loginWallEncountered", updated_at AS "updatedAt"
     FROM worker_trend_snapshots
     WHERE user_id = ? AND worker_id = ? AND platform = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    userId,
    workerId,
    platform
  );
}

export function isTrendSnapshotStale(snapshot, maxAgeHours = DEFAULT_MAX_AGE_HOURS) {
  if (!snapshot?.updatedAt) {
    return true;
  }
  const ageMs = Date.now() - new Date(snapshot.updatedAt).getTime();
  return ageMs >= maxAgeHours * 60 * 60 * 1000;
}

function snapshotToInsights(snapshot) {
  if (!snapshot) {
    return null;
  }

  return normalizeTrendInsightsPayload({
    ...safeJsonParse(snapshot.payloadJson, {}),
    contentGaps: safeJsonParse(snapshot.contentGapsJson, []),
    hashtags: safeJsonParse(snapshot.hashtagsJson, []),
    insights: safeJsonParse(snapshot.insightsJson, []),
    loginWallEncountered: Boolean(snapshot.loginWallEncountered),
    niche: snapshot.niche,
    region: snapshot.region,
    source: snapshot.source,
    sourceUrl: snapshot.sourceUrl,
    updatedAt: snapshot.updatedAt
  });
}

export async function saveUserTrendSnapshot(store, { insights, userId, workerId, platform = "tiktok" }) {
  const timestamp = insights.updatedAt || new Date().toISOString();
  const existing = await getLatestTrendSnapshot(store, userId, workerId, platform);
  const payloadJson = JSON.stringify(insights);

  if (existing?.id) {
    await store.execute(
      `UPDATE worker_trend_snapshots
       SET niche = ?, region = ?, period_days = ?, source = ?, source_url = ?, payload_json = ?,
           content_gaps_json = ?, hashtags_json = ?, insights_json = ?, login_wall_encountered = ?, updated_at = ?
       WHERE id = ?`,
      insights.niche,
      insights.region,
      insights.periodDays,
      insights.source,
      insights.sourceUrl,
      payloadJson,
      JSON.stringify(insights.contentGaps || []),
      JSON.stringify(insights.hashtags || []),
      JSON.stringify(insights.insights || []),
      insights.loginWallEncountered ? 1 : 0,
      timestamp,
      existing.id
    );
    return existing.id;
  }

  const id = randomUUID();
  await store.execute(
    `INSERT INTO worker_trend_snapshots
      (id, user_id, worker_id, platform, niche, region, period_days, source, source_url, payload_json,
       content_gaps_json, hashtags_json, insights_json, login_wall_encountered, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    userId,
    workerId,
    platform,
    insights.niche,
    insights.region,
    insights.periodDays,
    insights.source,
    insights.sourceUrl,
    payloadJson,
    JSON.stringify(insights.contentGaps || []),
    JSON.stringify(insights.hashtags || []),
    JSON.stringify(insights.insights || []),
    insights.loginWallEncountered ? 1 : 0,
    timestamp,
    timestamp
  );
  return id;
}

/**
 * Optional cache/export of trend insights. Source of truth is worker_trend_snapshots.
 * In multi-instance deploys, prefer S3; local files are best-effort only.
 */
export async function writeUserTrendInsightsFile(storageRoot, userId, insights, objectStorage = null) {
  const body = `${JSON.stringify(insights, null, 2)}\n`;
  if (objectStorage && usesSharedObjectStorage()) {
    await objectStorage.put({
      userId,
      storedName: getUserTrendObjectStoredName(),
      body,
      contentType: "application/json"
    });
    return `s3://${userId}/${getUserTrendObjectStoredName()}`;
  }
  if (process.env.NODE_ENV === "production" && usesSharedObjectStorage()) {
    return null;
  }
  const filePath = getUserTrendInsightsFilePath(storageRoot, userId);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body, "utf8");
  return filePath;
}

export async function deleteUserTrendArtifacts(storageRoot, userId, objectStorage = null) {
  const resolvedRoot = storageRoot || resolveStorageRoot();
  const dir = path.join(resolvedRoot, "private", "users", String(userId));
  await rm(dir, { recursive: true, force: true }).catch(() => {});
  if (objectStorage) {
    await objectStorage.delete({ userId, storedName: getUserTrendObjectStoredName() }).catch(() => {});
  }
}

export async function syncUserTrendInsightsFromGlobal({
  store,
  globalPath,
  readAccountContext,
  readMaraOnboarding,
  readWorkerKnowledge,
  storageRoot,
  userId,
  workerId,
  objectStorage = null
}) {
  const globalPayload = await readGlobalTrendInsights(store, { fileFallbackPath: globalPath });
  if (!globalPayload) {
    return { note: "Global TikTok trend insights are not available in shared storage yet.", synced: false };
  }

  const accountContext = typeof readAccountContext === "function" ? await readAccountContext(userId) : null;
  const maraOnboarding = typeof readMaraOnboarding === "function" ? await readMaraOnboarding(userId, workerId) : null;
  const workerKnowledge = typeof readWorkerKnowledge === "function" ? await readWorkerKnowledge(userId, workerId) : [];
  const niche = inferTrendNiche({
    accountContext,
    maraAnswers: maraOnboarding?.answers ?? {},
    workerKnowledge
  });
  const insights = buildScopedTrendInsights(globalPayload, niche);
  await saveUserTrendSnapshot(store, { insights, userId, workerId });

  const resolvedStorageRoot = storageRoot || resolveStorageRoot();
  writeUserTrendInsightsFile(resolvedStorageRoot, userId, insights, objectStorage).catch((error) => {
    console.error(`Failed to write per-user TikTok insights cache for ${userId}:`, error);
  });

  return { insights, niche, synced: true };
}

export async function loadUserTrendInsights({
  autoSync = true,
  store,
  globalPath,
  readAccountContext,
  readMaraOnboarding,
  readWorkerKnowledge,
  storageRoot,
  userId,
  workerId,
  objectStorage = null
}) {
  let snapshot = await getLatestTrendSnapshot(store, userId, workerId);
  if (!snapshot || (autoSync && isTrendSnapshotStale(snapshot))) {
    const syncResult = await syncUserTrendInsightsFromGlobal({
      store,
      globalPath,
      readAccountContext,
      readMaraOnboarding,
      readWorkerKnowledge,
      storageRoot: storageRoot || resolveStorageRoot(),
      userId,
      workerId,
      objectStorage
    });
    if (syncResult.insights) {
      return syncResult.insights;
    }
    snapshot = await getLatestTrendSnapshot(store, userId, workerId);
  }

  if (snapshot) {
    return snapshotToInsights(snapshot);
  }

  const globalPayload = await readGlobalTrendInsights(store, { fileFallbackPath: globalPath });
  if (!globalPayload) {
    return null;
  }

  const accountContext = typeof readAccountContext === "function" ? await readAccountContext(userId) : null;
  const maraOnboarding = typeof readMaraOnboarding === "function" ? await readMaraOnboarding(userId, workerId) : null;
  const workerKnowledge = typeof readWorkerKnowledge === "function" ? await readWorkerKnowledge(userId, workerId) : [];
  return buildScopedTrendInsights(
    globalPayload,
    inferTrendNiche({
      accountContext,
      maraAnswers: maraOnboarding?.answers ?? {},
      workerKnowledge
    })
  );
}

export async function readUserTrendInsightsFile(storageRoot, userId) {
  try {
    const raw = await readFile(getUserTrendInsightsFilePath(storageRoot, userId), "utf8");
    return normalizeTrendInsightsPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}
