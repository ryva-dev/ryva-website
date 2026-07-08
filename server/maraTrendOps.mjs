import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

export function readGlobalTikTokInsights(globalPath) {
  try {
    const raw = readFileSync(globalPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getLatestTrendSnapshot(db, userId, workerId, platform = "tiktok") {
  return (
    db
      .prepare(
        `SELECT id, niche, region, period_days AS periodDays, source, source_url AS sourceUrl,
                payload_json AS payloadJson, content_gaps_json AS contentGapsJson, hashtags_json AS hashtagsJson,
                insights_json AS insightsJson, login_wall_encountered AS loginWallEncountered, updated_at AS updatedAt
         FROM worker_trend_snapshots
         WHERE user_id = ? AND worker_id = ? AND platform = ?
         ORDER BY updated_at DESC
         LIMIT 1`
      )
      .get(userId, workerId, platform) ?? null
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

export function saveUserTrendSnapshot(db, { insights, userId, workerId, platform = "tiktok" }) {
  const timestamp = insights.updatedAt || new Date().toISOString();
  const existing = getLatestTrendSnapshot(db, userId, workerId, platform);
  const payloadJson = JSON.stringify(insights);

  if (existing?.id) {
    db.prepare(
      `UPDATE worker_trend_snapshots
       SET niche = ?, region = ?, period_days = ?, source = ?, source_url = ?, payload_json = ?,
           content_gaps_json = ?, hashtags_json = ?, insights_json = ?, login_wall_encountered = ?, updated_at = ?
       WHERE id = ?`
    ).run(
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
  db.prepare(
    `INSERT INTO worker_trend_snapshots
      (id, user_id, worker_id, platform, niche, region, period_days, source, source_url, payload_json,
       content_gaps_json, hashtags_json, insights_json, login_wall_encountered, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
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

export async function writeUserTrendInsightsFile(storageRoot, userId, insights) {
  const filePath = getUserTrendInsightsFilePath(storageRoot, userId);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(insights, null, 2)}\n`, "utf8");
  return filePath;
}

export function syncUserTrendInsightsFromGlobal({
  db,
  globalPath,
  readAccountContext,
  readMaraOnboarding,
  readWorkerKnowledge,
  storageRoot,
  userId,
  workerId
}) {
  const globalPayload = readGlobalTikTokInsights(globalPath);
  if (!globalPayload) {
    return { note: "Global TikTok trend file is not available yet.", synced: false };
  }

  const accountContext = typeof readAccountContext === "function" ? readAccountContext(userId) : null;
  const maraOnboarding = typeof readMaraOnboarding === "function" ? readMaraOnboarding(userId, workerId) : null;
  const workerKnowledge = typeof readWorkerKnowledge === "function" ? readWorkerKnowledge(userId, workerId) : [];
  const niche = inferTrendNiche({
    accountContext,
    maraAnswers: maraOnboarding?.answers ?? {},
    workerKnowledge
  });
  const insights = buildScopedTrendInsights(globalPayload, niche);
  saveUserTrendSnapshot(db, { insights, userId, workerId });

  const resolvedStorageRoot = storageRoot || resolveStorageRoot();
  writeUserTrendInsightsFile(resolvedStorageRoot, userId, insights).catch((error) => {
    console.error(`Failed to write per-user TikTok insights for ${userId}:`, error);
  });

  return { insights, niche, synced: true };
}

export function loadUserTrendInsights({
  autoSync = true,
  db,
  globalPath,
  readAccountContext,
  readMaraOnboarding,
  readWorkerKnowledge,
  storageRoot,
  userId,
  workerId
}) {
  let snapshot = getLatestTrendSnapshot(db, userId, workerId);
  if (!snapshot || (autoSync && isTrendSnapshotStale(snapshot))) {
    const syncResult = syncUserTrendInsightsFromGlobal({
      db,
      globalPath,
      readAccountContext,
      readMaraOnboarding,
      readWorkerKnowledge,
      storageRoot: storageRoot || resolveStorageRoot(),
      userId,
      workerId
    });
    if (syncResult.insights) {
      return syncResult.insights;
    }
    snapshot = getLatestTrendSnapshot(db, userId, workerId);
  }

  if (snapshot) {
    return snapshotToInsights(snapshot);
  }

  const globalPayload = readGlobalTikTokInsights(globalPath);
  if (!globalPayload) {
    return null;
  }

  const accountContext = typeof readAccountContext === "function" ? readAccountContext(userId) : null;
  const maraOnboarding = typeof readMaraOnboarding === "function" ? readMaraOnboarding(userId, workerId) : null;
  const workerKnowledge = typeof readWorkerKnowledge === "function" ? readWorkerKnowledge(userId, workerId) : [];
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
