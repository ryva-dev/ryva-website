/**
 * Lightweight in-process metrics for Stage E.
 * Suitable for CloudWatch/Datadog log-based collection or scraping GET /metrics.
 * Reset on process restart — durable metrics belong in the monitoring backend.
 */

const counters = new Map();
const startedAt = Date.now();

export function incrementMetric(name, by = 1, tags = {}) {
  const key = tagKey(name, tags);
  counters.set(key, (counters.get(key) || 0) + by);
}

export function getMetricsSnapshot() {
  const metrics = {};
  for (const [key, value] of counters.entries()) {
    metrics[key] = value;
  }
  return {
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    metrics
  };
}

function tagKey(name, tags) {
  const tagPart = Object.keys(tags)
    .sort()
    .map((key) => `${key}=${String(tags[key])}`)
    .join(",");
  return tagPart ? `${name}|${tagPart}` : name;
}

/** Optional Sentry: set SENTRY_DSN to enable. Uses @sentry/node if installed. */
let sentryReady = null;
export async function captureException(error, context = {}) {
  const dsn = String(process.env.SENTRY_DSN ?? "").trim();
  if (!dsn) return false;
  try {
    if (!sentryReady) {
      sentryReady = (async () => {
        const Sentry = await import("@sentry/node");
        Sentry.init({
          dsn,
          environment: process.env.NODE_ENV || "development",
          tracesSampleRate: 0
        });
        return Sentry;
      })();
    }
    const Sentry = await sentryReady;
    Sentry.captureException(error, { extra: context });
    return true;
  } catch {
    // Package not installed or init failed — structured logs remain the source of truth.
    return false;
  }
}
