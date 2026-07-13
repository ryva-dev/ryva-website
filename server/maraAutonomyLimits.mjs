/**
 * Backend-enforced autonomy budgets for Mara.
 */
import { randomUUID } from "node:crypto";

export const DEFAULT_AUTONOMY_LIMITS = Object.freeze({
  maxBrandsResearchedPerDay: Number.parseInt(process.env.MARA_DAILY_BRAND_RESEARCH_LIMIT ?? "5", 10),
  maxDeepResearchJobsPerWeek: Number.parseInt(process.env.MARA_WEEKLY_DEEP_RESEARCH_LIMIT ?? "20", 10),
  maxOutreachDraftsPerWeek: Number.parseInt(process.env.MARA_WEEKLY_OUTREACH_DRAFT_LIMIT ?? "25", 10),
  maxFollowUpAttempts: 3,
  maxConcurrentTasks: 5,
  allowedBusinessCategories: [],
  excludedBrands: [],
  quietHours: null,
  approvalRequiredForSend: true
});

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function normalizeAutonomyLimits(input = {}) {
  const limits = input && typeof input === "object" ? input : {};
  return {
    maxBrandsResearchedPerDay: boundedInteger(limits.maxBrandsResearchedPerDay, DEFAULT_AUTONOMY_LIMITS.maxBrandsResearchedPerDay, 1, 25),
    maxDeepResearchJobsPerWeek: boundedInteger(limits.maxDeepResearchJobsPerWeek, DEFAULT_AUTONOMY_LIMITS.maxDeepResearchJobsPerWeek, 1, 100),
    maxOutreachDraftsPerWeek: boundedInteger(limits.maxOutreachDraftsPerWeek, DEFAULT_AUTONOMY_LIMITS.maxOutreachDraftsPerWeek, 1, 100),
    maxFollowUpAttempts: boundedInteger(limits.maxFollowUpAttempts, DEFAULT_AUTONOMY_LIMITS.maxFollowUpAttempts, 0, 5),
    maxConcurrentTasks: boundedInteger(limits.maxConcurrentTasks, DEFAULT_AUTONOMY_LIMITS.maxConcurrentTasks, 1, 20),
    allowedBusinessCategories: Array.isArray(limits.allowedBusinessCategories) ? limits.allowedBusinessCategories.map(String).filter(Boolean).slice(0, 50) : [],
    excludedBrands: Array.isArray(limits.excludedBrands) ? limits.excludedBrands.map(String).filter(Boolean).slice(0, 100) : [],
    quietHours: limits.quietHours && typeof limits.quietHours === "object" ? limits.quietHours : null,
    // Public launch remains approval-gated. Graduated send authority needs its
    // own verified-recipient and daily-send policy, not a writable boolean.
    approvalRequiredForSend: true
  };
}

export async function getAutonomyLimits(store, userId, workerId) {
  try {
    const row = await store.queryOne(
      `SELECT limits_json AS "limitsJson" FROM mara_autonomy_limits WHERE user_id = ? AND worker_id = ?`,
      userId,
      workerId
    );
    if (!row) return { ...DEFAULT_AUTONOMY_LIMITS };
    const parsed = typeof row.limitsJson === "object" ? row.limitsJson : JSON.parse(row.limitsJson || "{}");
    return normalizeAutonomyLimits(parsed);
  } catch {
    return { ...DEFAULT_AUTONOMY_LIMITS };
  }
}

export async function saveAutonomyLimits(store, userId, workerId, limits) {
  const now = new Date().toISOString();
  const next = normalizeAutonomyLimits(limits);
  const existing = await store.queryOne(
    `SELECT id FROM mara_autonomy_limits WHERE user_id = ? AND worker_id = ?`,
    userId,
    workerId
  );
  if (existing?.id) {
    await store.execute(
      `UPDATE mara_autonomy_limits SET limits_json = ?, updated_at = ? WHERE id = ?`,
      JSON.stringify(next),
      now,
      existing.id
    );
  } else {
    await store.execute(
      `INSERT INTO mara_autonomy_limits (id, user_id, worker_id, limits_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      userId,
      workerId,
      JSON.stringify(next),
      now,
      now
    );
  }
  return next;
}

export async function assertWithinBrandResearchLimit(store, userId, workerId) {
  const limits = await getAutonomyLimits(store, userId, workerId);
  const day = new Date().toISOString().slice(0, 10);
  const row = await store.queryOne(
    `SELECT COUNT(*) AS count FROM worker_research_items
     WHERE user_id = ? AND worker_id = ? AND source_type = 'web_brand' AND created_at >= ?`,
    userId,
    workerId,
    `${day}T00:00:00.000Z`
  );
  const count = Number(row?.count || 0);
  if (count >= limits.maxBrandsResearchedPerDay) {
    const error = new Error(`Daily brand research limit reached (${limits.maxBrandsResearchedPerDay}).`);
    error.code = "MARA_BRAND_RESEARCH_LIMIT";
    throw error;
  }
  return { remaining: limits.maxBrandsResearchedPerDay - count, limits };
}

/** Weekly cap on pitch + follow-up draft outputs (send still separately approval-gated). */
export async function assertWithinOutreachDraftLimit(store, userId, workerId) {
  const limits = await getAutonomyLimits(store, userId, workerId);
  let count = 0;
  try {
    const row = await store.queryOne(
      `SELECT COUNT(*) AS count FROM worker_outputs
       WHERE user_id = ? AND worker_id = ?
         AND output_type IN ('pitch_draft', 'pitch_template', 'follow_up_sequence', 'reply_draft')
         AND created_at >= ?`,
      userId,
      workerId,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    );
    count = Number(row?.count || 0);
  } catch {
    return { remaining: limits.maxOutreachDraftsPerWeek, limits };
  }
  if (count >= limits.maxOutreachDraftsPerWeek) {
    const error = new Error(`Weekly outreach draft limit reached (${limits.maxOutreachDraftsPerWeek}).`);
    error.code = "MARA_OUTREACH_DRAFT_LIMIT";
    throw error;
  }
  return { remaining: limits.maxOutreachDraftsPerWeek - count, limits };
}

/** One marker row is written per deep-research request, independent of provider fan-out. */
export async function assertWithinDeepResearchLimit(store, userId, workerId) {
  const limits = await getAutonomyLimits(store, userId, workerId);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const row = await store.queryOne(
    `SELECT COUNT(*) AS count FROM mara_research_provider_runs
     WHERE user_id = ? AND worker_id = ? AND provider_name = 'ryva_deep_research_request' AND created_at >= ?`,
    userId,
    workerId,
    since
  );
  const count = Number(row?.count || 0);
  if (count >= limits.maxDeepResearchJobsPerWeek) {
    const error = new Error(`Weekly deep research limit reached (${limits.maxDeepResearchJobsPerWeek}).`);
    error.code = "MARA_DEEP_RESEARCH_LIMIT";
    throw error;
  }
  return { remaining: limits.maxDeepResearchJobsPerWeek - count, limits };
}
