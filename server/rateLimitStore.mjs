import { randomUUID } from "node:crypto";

/**
 * Shared rate-limit store backed by the app data store (Postgres or SQLite).
 * Required for multi-replica correctness — in-memory express-rate-limit stores
 * do not coordinate across instances.
 */
export async function initRateLimitStore(store) {
  await store.execute(`CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    bucket_key TEXT PRIMARY KEY,
    hits INTEGER NOT NULL DEFAULT 0,
    reset_at TEXT NOT NULL
  )`);
  await store.execute(`CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit_buckets(reset_at)`);
}

export function createDurableRateLimitStore(store, { windowMs = 600_000 } = {}) {
  return {
    async increment(key) {
      const now = Date.now();
      const bucketKey = String(key);
      return store.tx(async (tx) => {
        const row = await tx.queryOne(
          `SELECT hits, reset_at AS "resetAt" FROM rate_limit_buckets WHERE bucket_key = ?`,
          bucketKey
        );
        const resetAtMs = row?.resetAt ? new Date(row.resetAt).getTime() : 0;
        if (!row || resetAtMs <= now) {
          const resetTime = new Date(now + windowMs);
          await tx.execute(
            `INSERT INTO rate_limit_buckets (bucket_key, hits, reset_at) VALUES (?, 1, ?)
             ON CONFLICT(bucket_key) DO UPDATE SET hits = 1, reset_at = excluded.reset_at`,
            bucketKey,
            resetTime.toISOString()
          );
          return { totalHits: 1, resetTime };
        }
        await tx.execute(
          `UPDATE rate_limit_buckets SET hits = hits + 1 WHERE bucket_key = ?`,
          bucketKey
        );
        const next = await tx.queryOne(`SELECT hits FROM rate_limit_buckets WHERE bucket_key = ?`, bucketKey);
        return { totalHits: Number(next?.hits ?? 1), resetTime: new Date(resetAtMs) };
      });
    },
    async decrement(key) {
      await store.execute(
        `UPDATE rate_limit_buckets SET hits = CASE WHEN hits > 0 THEN hits - 1 ELSE 0 END WHERE bucket_key = ?`,
        String(key)
      );
    },
    async resetKey(key) {
      await store.execute(`DELETE FROM rate_limit_buckets WHERE bucket_key = ?`, String(key));
    }
  };
}

/** Best-effort cleanup of expired buckets (call from scheduler). */
export async function purgeExpiredRateLimitBuckets(store) {
  const now = new Date().toISOString();
  return (await store.execute(`DELETE FROM rate_limit_buckets WHERE reset_at < ?`, now)).changes;
}

export function rateLimitKeyForRequest(req, prefix) {
  const userId = String(req.user?.id || "").trim();
  if (userId) return `${prefix}:user:${userId}`;
  return `${prefix}:ip:${String(req.ip || "unknown")}`;
}

export function newRateLimitBucketId() {
  return randomUUID();
}
