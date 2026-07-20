import { randomUUID } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AppConfig } from "../../../packages/config/src/index.js";
import type { Database } from "../../../packages/database/src/index.js";
import { withTransaction } from "../../../packages/database/src/index.js";
import {
  can,
  csrfMatches,
  findSession,
  getAccessDecision,
  recordAudit
} from "../../../packages/domain/src/index.js";
import type { Logger } from "../../../packages/domain/src/index.js";
import { AppError } from "../../../packages/shared/src/index.js";

export function asyncRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (request, response, next) => {
    void Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function requestContext(logger: Logger): RequestHandler {
  return (request, response, next) => {
    request.requestId = String(request.header("x-request-id") || randomUUID()).slice(0, 128);
    response.setHeader("x-request-id", request.requestId);
    const started = performance.now();
    response.on("finish", () => {
      logger.info("http.request", {
        requestId: request.requestId,
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Math.round(performance.now() - started)
      });
    });
    next();
  };
}

export function enforceOrigin(configuration: AppConfig): RequestHandler {
  const allowedOrigin = new URL(configuration.APP_URL).origin;
  return (request, _response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
    const origin = request.header("origin");
    if (origin && origin !== allowedOrigin) {
      return next(new AppError(403, "origin_denied", "The request origin is not allowed."));
    }
    return next();
  };
}

export function authenticate(database: Database, configuration: AppConfig): RequestHandler {
  return asyncRoute(async (request, _response, next) => {
    const token = request.cookies?.ryva_session as string | undefined;
    if (!token) throw new AppError(401, "authentication_required", "Sign in to continue.");
    const identity = await findSession(database, configuration, token);
    if (!identity) throw new AppError(401, "session_invalid", "Your session has ended. Sign in again.");
    if(configuration.CONTROLLED_LAUNCH_ENABLED&&!["admin","support"].includes(identity.role)){
      const allowed=await database.query(
        `SELECT id FROM launch_access_entries
         WHERE workspace_id=$1 AND user_id=$2 AND status='allowed'
           AND starts_at<=now() AND (expires_at IS NULL OR expires_at>now())`,
        [identity.workspaceId,identity.userId]
      );
      if(!allowed.rowCount){
        throw new AppError(403,"controlled_launch_access_required",
          "This workspace is not currently included in controlled launch access.");
      }
    }
    const access = await getAccessDecision(database, identity.userId, identity.workspaceId);
    if (!access) throw new AppError(403, "workspace_access_denied", "Workspace access is unavailable.");
    request.identity = identity;
    request.access = access;
    await database.query("UPDATE sessions SET last_seen_at=now() WHERE id=$1", [identity.sessionId]);
    next();
  });
}

export function requireMfa(): RequestHandler {
  return (request, _response, next) => {
    if (!request.identity?.mfaVerifiedAt) {
      return next(new AppError(403, "mfa_required", "Multi-factor verification is required."));
    }
    return next();
  };
}

export function requireCapability(database: Database, capability: string): RequestHandler {
  return asyncRoute(async (request, _response, next) => {
    if (request.access && can(request.access, capability)) return next();
    if (request.identity && request.access) {
      await recordAudit(database, {
        workspaceId: request.identity.workspaceId,
        actorUserId: request.identity.userId,
        actorType: "user",
        action: "access.denied",
        targetType: "capability",
        targetId: capability,
        origin: "api",
        requestId: request.requestId,
        outcome: "denied",
        metadata: { mode: request.access.mode, reason: request.access.reason }
      });
    }
    throw new AppError(403, "capability_denied", "Your current access does not permit this action.");
  });
}

export function requireWorkspaceMatch(): RequestHandler {
  return (request, _response, next) => {
    if (!request.identity || request.params.workspaceId !== request.identity.workspaceId) {
      return next(new AppError(404, "record_not_found", "Record not found."));
    }
    return next();
  };
}

export function requireCsrf(database: Database, configuration: AppConfig): RequestHandler {
  return asyncRoute(async (request, _response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
    if (!request.identity) throw new AppError(401, "authentication_required", "Sign in to continue.");
    const cookieValue = request.cookies?.ryva_csrf as string | undefined;
    const headerValue = request.header("x-csrf-token");
    if (!cookieValue || !headerValue || cookieValue !== headerValue) {
      throw new AppError(403, "csrf_invalid", "The security token is missing or invalid.");
    }
    if (!(await csrfMatches(database, configuration, request.identity.sessionId, headerValue))) {
      throw new AppError(403, "csrf_invalid", "The security token is no longer valid.");
    }
    next();
  });
}

export function databaseRateLimit(
  database: Database,
  input: { prefix: string; limit: number; windowSeconds: number }
): RequestHandler {
  return asyncRoute(async (request, response, next) => {
    const identity = request.identity?.userId;
    const key = `${input.prefix}:${identity ? `user:${identity}` : `ip:${request.ip ?? "unknown"}`}`;
    const result = await withTransaction(database, async (transaction) => {
      const row = await transaction.query<{ hits: number; reset_at: Date }>(
        "SELECT hits, reset_at FROM rate_limit_buckets WHERE bucket_key=$1 FOR UPDATE",
        [key]
      );
      const current = row.rows[0];
      if (!current || current.reset_at <= new Date()) {
        const resetAt = new Date(Date.now() + input.windowSeconds * 1000);
        await transaction.query(
          `INSERT INTO rate_limit_buckets (bucket_key,hits,reset_at) VALUES ($1,1,$2)
           ON CONFLICT (bucket_key) DO UPDATE SET hits=1, reset_at=excluded.reset_at`,
          [key, resetAt]
        );
        return { hits: 1, resetAt };
      }
      const updated = await transaction.query<{ hits: number; reset_at: Date }>(
        `UPDATE rate_limit_buckets SET hits=hits+1 WHERE bucket_key=$1
         RETURNING hits, reset_at`,
        [key]
      );
      return { hits: updated.rows[0]?.hits ?? input.limit + 1, resetAt: current.reset_at };
    });
    response.setHeader("RateLimit-Limit", String(input.limit));
    response.setHeader("RateLimit-Remaining", String(Math.max(0, input.limit - result.hits)));
    response.setHeader("RateLimit-Reset", String(Math.ceil(result.resetAt.getTime() / 1000)));
    if (result.hits > input.limit) {
      throw new AppError(429, "rate_limit_exceeded", "Too many attempts. Wait before trying again.");
    }
    next();
  });
}
