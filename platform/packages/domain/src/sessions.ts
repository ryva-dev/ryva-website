import type { AppConfig } from "../../config/src/index.js";
import type { Database } from "../../database/src/index.js";
import { oneOrNone } from "../../database/src/index.js";
import { newId } from "../../shared/src/index.js";
import { randomToken, secureDigest } from "./crypto.js";

export type SessionIdentity = {
  sessionId: string;
  userId: string;
  workspaceId: string;
  role: string;
  email: string;
  name: string;
  mfaVerifiedAt: Date | null;
};

export async function createSession(
  database: Database,
  configuration: AppConfig,
  input: { userId: string; mfaVerified: boolean; ip?: string; userAgent?: string }
): Promise<{ token: string; csrfToken: string; expiresAt: Date; sessionId: string }> {
  const token = randomToken();
  const csrfToken = randomToken();
  const expiresAt = new Date(Date.now() + configuration.SESSION_TTL_HOURS * 60 * 60 * 1000);
  const sessionId = newId();
  await database.query(
    `INSERT INTO sessions
      (id, user_id, token_hash, csrf_hash, expires_at, mfa_verified_at, ip_hash, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      sessionId,
      input.userId,
      secureDigest(token, configuration.SESSION_PEPPER),
      secureDigest(csrfToken, configuration.SESSION_PEPPER),
      expiresAt,
      input.mfaVerified ? new Date() : null,
      input.ip ? secureDigest(input.ip, configuration.SESSION_PEPPER) : null,
      input.userAgent?.slice(0, 500) ?? null
    ]
  );
  return { token, csrfToken, expiresAt, sessionId };
}

export async function findSession(
  database: Database,
  configuration: AppConfig,
  token: string
): Promise<SessionIdentity | null> {
  return oneOrNone<SessionIdentity>(
    database,
    `SELECT s.id AS "sessionId", s.user_id AS "userId", wm.workspace_id AS "workspaceId",
            wm.role, u.email, u.name, s.mfa_verified_at AS "mfaVerifiedAt"
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN LATERAL (
         SELECT workspace_id, role FROM workspace_memberships
          WHERE user_id = u.id AND status = 'active'
          ORDER BY created_at LIMIT 1
       ) wm ON true
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
        AND u.status = 'active'`,
    [secureDigest(token, configuration.SESSION_PEPPER)]
  );
}

export async function csrfMatches(
  database: Database,
  configuration: AppConfig,
  sessionId: string,
  csrfToken: string
): Promise<boolean> {
  const row = await oneOrNone<{ valid: boolean }>(
    database,
    `SELECT csrf_hash = $2 AS valid FROM sessions
      WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [sessionId, secureDigest(csrfToken, configuration.SESSION_PEPPER)]
  );
  return row?.valid ?? false;
}

export async function revokeSession(
  database: Database,
  sessionId: string,
  reason: string
): Promise<boolean> {
  const result = await database.query(
    `UPDATE sessions SET revoked_at = now(), revoked_reason = $2
      WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId, reason]
  );
  return result.rowCount === 1;
}

export async function revokeUserSessions(
  database: Database,
  userId: string,
  reason: string
): Promise<number> {
  const result = await database.query(
    `UPDATE sessions SET revoked_at = now(), revoked_reason = $2
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, reason]
  );
  return result.rowCount ?? 0;
}
