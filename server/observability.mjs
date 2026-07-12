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
 *
 * Note: SESSION_SECRET is unused — sessions are DB-backed cookies.
 */
export function validateConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const problems = [];
  const warnings = [];

  const usingPostgres = Boolean(String(process.env.DATABASE_URL ?? "").trim());
  const objectDriver = String(process.env.OBJECT_STORAGE_DRIVER ?? (process.env.S3_BUCKET ? "s3" : "local")).trim().toLowerCase();
  const encryptionKey = String(process.env.ENCRYPTION_KEY ?? "").trim();
  const appUrl = String(process.env.APP_URL ?? "").trim();

  function encryptionKeyOk(raw) {
    if (!raw) return false;
    try {
      const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
      return key.length === 32;
    } catch {
      return false;
    }
  }

  if (isProduction) {
    if (!usingPostgres) {
      problems.push("DATABASE_URL (Postgres) is required in production for multi-tenant SaaS.");
    }
    if (objectDriver !== "s3") {
      problems.push("OBJECT_STORAGE_DRIVER=s3 (with S3_BUCKET) is required in production; local disk is not shared across replicas.");
    } else if (!String(process.env.S3_BUCKET ?? "").trim()) {
      problems.push("S3_BUCKET is required when OBJECT_STORAGE_DRIVER=s3.");
    }
    if (!appUrl) {
      problems.push("APP_URL is required in production.");
    }
    if (!encryptionKey) {
      problems.push("ENCRYPTION_KEY is required in production; OAuth tokens must never be stored in plaintext.");
    } else if (!encryptionKeyOk(encryptionKey)) {
      problems.push("ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex chars or base64).");
    }
    if (!String(process.env.ANTHROPIC_API_KEY ?? "").trim()) {
      problems.push("ANTHROPIC_API_KEY is required in production; paid workers must not emit placeholder output.");
    }
    const stripeKey = String(process.env.STRIPE_SECRET_KEY ?? "").trim();
    const stripeHook = String(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
    if (!stripeKey || !stripeHook) {
      problems.push("STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required in production for paying strangers.");
    }
    if (!String(process.env.METRICS_TOKEN ?? "").trim()) {
      warnings.push("METRICS_TOKEN is unset; /metrics will return 401 in production until configured.");
    }
    if (String(process.env.SESSION_SECRET ?? "").trim()) {
      warnings.push("SESSION_SECRET is unused; sessions are stored in the database. You can remove it.");
    }
    const googleId = String(process.env.GOOGLE_CLIENT_ID ?? "").trim();
    const googleSecret = String(process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
    const googleOk = Boolean(googleId && googleSecret);
    const smtpOk = Boolean(String(process.env.SMTP_HOST ?? "").trim());
    if (!googleOk && !smtpOk) {
      problems.push(
        "Production requires Google OAuth (GOOGLE_CLIENT_ID/SECRET) and/or SMTP_HOST so strangers can sign up and verify."
      );
    } else {
      if (!googleOk) {
        warnings.push("GOOGLE_CLIENT_ID/SECRET unset — Google login and Gmail connect will not work.");
      }
      if (!smtpOk) {
        warnings.push("SMTP_HOST unset — email/password signup verification and digests will not send.");
      }
    }
    const videoQaDisabled = String(process.env.MARA_DISABLE_VIDEO_QA ?? "").trim() === "1";
    const transcription = String(process.env.MARA_TRANSCRIPTION_PROVIDER || "mock").toLowerCase();
    const multimodal = String(process.env.MARA_MULTIMODAL_PROVIDER || "mock").toLowerCase();
    if (!videoQaDisabled) {
      const transcriptionReal = ["openai", "whisper", "openai_whisper"].includes(transcription);
      const multimodalReal = multimodal === "anthropic";
      if (!transcriptionReal || !multimodalReal) {
        problems.push(
          "Production video QA must use real providers (MARA_TRANSCRIPTION_PROVIDER=openai + MARA_MULTIMODAL_PROVIDER=anthropic + OPENAI_API_KEY) or set MARA_DISABLE_VIDEO_QA=1."
        );
      } else if (!String(process.env.OPENAI_API_KEY ?? "").trim()) {
        problems.push("OPENAI_API_KEY is required when Mara video QA providers are enabled in production.");
      }
      if (String(process.env.MARA_REQUIRE_REAL_MEDIA ?? "").trim() !== "1") {
        warnings.push("Set MARA_REQUIRE_REAL_MEDIA=1 in production so mock media analysis cannot slip through.");
      }
    }
    if (!String(process.env.SUPPORT_EMAIL ?? "").trim()) {
      warnings.push("SUPPORT_EMAIL unset — legal/support pages will use a placeholder contact.");
    }
  } else if (encryptionKey && !encryptionKeyOk(encryptionKey)) {
    problems.push("ENCRYPTION_KEY must decode to exactly 32 bytes when set.");
  }

  for (const warning of warnings) emit("warn", "config_warning", { detail: warning });
  if (problems.length > 0) {
    for (const problem of problems) emit("error", "config_error", { detail: problem });
    throw new Error(`Invalid configuration:\n- ${problems.join("\n- ")}`);
  }
  emit("info", "config_validated", {
    backend: usingPostgres ? "postgres" : "sqlite",
    objectStorage: objectDriver,
    production: isProduction
  });
}
