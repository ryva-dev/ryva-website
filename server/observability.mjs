// Ryva — observability & resilience (Phase 2, Stage E)
//
// Production hygiene the platform needs before it can run behind a load
// balancer: structured logs, request correlation, health/readiness probes, a
// single async error path, graceful shutdown, and fail-fast config validation.
// Dependency-free so it installs cleanly in any environment.

import { randomUUID } from "node:crypto";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const activeLevel = LEVELS[String(process.env.LOG_LEVEL ?? "info").toLowerCase()] ?? LEVELS.info;

/** Structured JSON logger. One line per event — CloudWatch / Datadog friendly. */
function emit(level, message, fields) {
  if (LEVELS[level] < activeLevel) return;
  const record = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(fields && typeof fields === "object" ? fields : {})
  };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (message, fields) => emit("debug", message, fields),
  info: (message, fields) => emit("info", message, fields),
  warn: (message, fields) => emit("warn", message, fields),
  error: (message, fields) => emit("error", message, fields)
};

/** Attach a request id (from the LB header if present) and log completion. */
export function requestContext(req, res, next) {
  const requestId = String(req.headers["x-request-id"] || randomUUID());
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  const startedAt = Date.now();
  res.on("finish", () => {
    // Health probes are noisy; log them at debug only.
    const level = req.path === "/healthz" || req.path === "/readyz" ? "debug" : "info";
    emit(level, "request", {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - startedAt
    });
  });
  next();
}

/** Wrap an async route so rejected promises reach the error handler. */
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/** 404 for unmatched API routes. */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not found." });
}

/** Terminal error handler — logs with correlation, never leaks stacks in prod. */
export function errorHandler(isProduction) {
  return (err, req, res, _next) => {
    emit("error", "unhandled_error", {
      requestId: req?.requestId,
      method: req?.method,
      path: req?.path,
      error: err?.message,
      stack: isProduction ? undefined : err?.stack
    });
    if (res.headersSent) return;
    res.status(err?.statusCode || 500).json({
      error: isProduction ? "Something went wrong." : String(err?.message || "Server error."),
      requestId: req?.requestId
    });
  };
}

/**
 * Liveness (/healthz) and readiness (/readyz) probes.
 * `pingStore` should resolve when the database is reachable.
 */
export function registerHealthEndpoints(app, { pingStore }) {
  app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));
  app.get("/readyz", async (_req, res) => {
    try {
      await pingStore();
      res.status(200).json({ status: "ready" });
    } catch (error) {
      emit("error", "readiness_failed", { error: error?.message });
      res.status(503).json({ status: "unavailable" });
    }
  });
}

/**
 * Drain on SIGTERM/SIGINT: stop taking traffic, run cleanup (scheduler, pool),
 * exit. Prevents dropped requests and leaked connections on deploy/rollback.
 */
export function installGracefulShutdown({ server, onShutdown, timeoutMs = 15_000 }) {
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    emit("info", "shutdown_started", { signal });
    const forced = setTimeout(() => {
      emit("error", "shutdown_forced", { signal });
      process.exit(1);
    }, timeoutMs);
    try {
      await new Promise((resolve) => server.close(resolve));
      if (onShutdown) await onShutdown();
      clearTimeout(forced);
      emit("info", "shutdown_complete", { signal });
      process.exit(0);
    } catch (error) {
      emit("error", "shutdown_error", { signal, error: error?.message });
      process.exit(1);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => emit("error", "unhandled_rejection", { reason: String(reason) }));
  process.on("uncaughtException", (error) => {
    emit("error", "uncaught_exception", { error: error?.message, stack: error?.stack });
    void shutdown("uncaughtException");
  });
}

/**
 * Fail fast at boot if production config is incomplete, rather than failing
 * later per-request. Returns nothing; throws on fatal misconfiguration.
 */
export function validateConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const problems = [];
  const warnings = [];

  const usingPostgres = Boolean(String(process.env.DATABASE_URL ?? "").trim());

  if (isProduction) {
    if (usingPostgres) {
      // Schema comes from `npm run migrate`. Object storage should be S3 in prod.
      if (String(process.env.OBJECT_STORAGE_DRIVER ?? "").trim().toLowerCase() !== "s3") {
        warnings.push("OBJECT_STORAGE_DRIVER is not s3; multi-instance deploys need shared object storage.");
      }
    }
    if (!String(process.env.ANTHROPIC_API_KEY ?? "").trim()) {
      problems.push("ANTHROPIC_API_KEY is required in production; paid workers must not emit placeholder output.");
    }
    if (!String(process.env.ENCRYPTION_KEY ?? "").trim()) {
      problems.push("ENCRYPTION_KEY is required in production; OAuth tokens must never be stored in plaintext.");
    }
    const stripeKey = String(process.env.STRIPE_SECRET_KEY ?? "").trim();
    const stripeHook = String(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
    if (Boolean(stripeKey) !== Boolean(stripeHook)) {
      problems.push("STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set together.");
    }
  }

  for (const warning of warnings) emit("warn", "config_warning", { detail: warning });
  if (problems.length > 0) {
    for (const problem of problems) emit("error", "config_error", { detail: problem });
    throw new Error(`Invalid configuration:\n- ${problems.join("\n- ")}`);
  }
  emit("info", "config_validated", {
    backend: usingPostgres ? "postgres" : "sqlite",
    production: isProduction
  });
}
