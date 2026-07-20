import type { Database, Transaction } from "../../database/src/index.js";
import { oneOrNone } from "../../database/src/index.js";

export type Role = "representative" | "mentor" | "instructor" | "admin" | "support";
export type AccessMode =
  | "full"
  | "read_only"
  | "certification_required"
  | "subscription_required"
  | "restricted"
  | "blocked";

export type AccessDecision = {
  mode: AccessMode;
  reason:
    | "eligible"
    | "staff"
    | "credential_missing"
    | "credential_expired_grace"
    | "credential_expired"
    | "credential_suspended"
    | "credential_revoked"
    | "credential_surrendered"
    | "subscription_missing"
    | "subscription_read_only"
    | "subscription_paid_through";
  credentialStatus: string | null;
  subscriptionStatus: string | null;
  graceEndsAt: string | null;
  capabilities: string[];
};

export type AccessRow = {
  user_id: string;
  user_status: string;
  workspace_id: string;
  workspace_status: string;
  role: Role;
  membership_status: string;
  credential_status: string | null;
  credential_expires_at: Date | null;
  suspension_read_only_allowed: boolean | null;
  subscription_status: string | null;
  current_period_end: Date | null;
  past_due_since: Date | null;
};

const operationalRead = ["profile:read", "settings:read", "operational:read", "export:request"];
const operationalWrite = [
  ...operationalRead,
  "profile:write",
  "settings:write",
  "operational:write",
  "external:approve"
];
const restricted = [
  "profile:read",
  "profile:write",
  "certification:read",
  "subscription:read",
  "support:request"
];

function full(
  row: AccessRow,
  reason: AccessDecision["reason"],
  graceEndsAt: string | null = null
): AccessDecision {
  return {
    mode: "full",
    reason,
    credentialStatus: row.credential_status,
    subscriptionStatus: row.subscription_status,
    graceEndsAt,
    capabilities: operationalWrite
  };
}

function decision(
  row: AccessRow,
  mode: AccessMode,
  reason: AccessDecision["reason"],
  capabilities: string[],
  graceEndsAt: Date | null = null
): AccessDecision {
  return {
    mode,
    reason,
    credentialStatus: row.credential_status,
    subscriptionStatus: row.subscription_status,
    graceEndsAt: graceEndsAt?.toISOString() ?? null,
    capabilities
  };
}

export function decideAccess(row: AccessRow, at = new Date()): AccessDecision {
  if (
    row.user_status !== "active" ||
    row.membership_status !== "active" ||
    row.workspace_status === "closed"
  ) {
    return decision(row, "blocked", "credential_revoked", []);
  }
  if (row.role === "admin") {
    return decision(row, "full", "staff", [
      "admin:access",
      "audit:read",
      "jobs:manage",
      "support_grants:manage"
    ]);
  }
  if (row.role === "support") {
    return decision(row, "full", "staff", ["support:access", "jobs:read"]);
  }
  if (row.role === "mentor" || row.role === "instructor") {
    return decision(row, "restricted", "staff", ["sandbox:access", ...restricted]);
  }
  if (!row.credential_status || row.credential_status === "pending") {
    return decision(row, "certification_required", "credential_missing", restricted);
  }
  if (row.credential_status === "revoked") {
    return decision(row, "blocked", "credential_revoked", ["certification:read", "support:request"]);
  }
  if (row.credential_status === "suspended") {
    return decision(
      row,
      row.suspension_read_only_allowed ? "read_only" : "blocked",
      "credential_suspended",
      row.suspension_read_only_allowed
        ? operationalRead
        : ["certification:read", "support:request"]
    );
  }
  if (row.credential_status === "surrendered") {
    return decision(row, "restricted", "credential_surrendered", restricted);
  }

  const expiry = row.credential_expires_at;
  const isExpired =
    row.credential_status === "expired" || (expiry !== null && expiry.getTime() <= at.getTime());
  if (isExpired) {
    const graceEnd = new Date((expiry ?? at).getTime() + 30 * 24 * 60 * 60 * 1000);
    if (at < graceEnd) {
      return decision(
        row,
        "read_only",
        "credential_expired_grace",
        [...operationalRead, "certification:read", "subscription:read"],
        graceEnd
      );
    }
    return decision(
      row,
      "restricted",
      "credential_expired",
      [...restricted, "export:request"],
      graceEnd
    );
  }

  const subscription = row.subscription_status ?? "none";
  const periodEnd = row.current_period_end;
  if (subscription === "trial" || subscription === "active") return full(row, "eligible");
  if (subscription === "past_due") {
    const retryEnd = new Date((row.past_due_since ?? at).getTime() + 7 * 24 * 60 * 60 * 1000);
    if (at <= retryEnd) return full(row, "eligible", retryEnd.toISOString());
  }
  if (subscription === "canceled" && periodEnd && periodEnd > at) {
    return full(row, "subscription_paid_through", periodEnd.toISOString());
  }
  if (["past_due", "retry_failed", "canceled", "ended"].includes(subscription)) {
    const readOnlyEnd = new Date(
      (periodEnd ?? row.past_due_since ?? at).getTime() + 30 * 24 * 60 * 60 * 1000
    );
    return decision(
      row,
      at <= readOnlyEnd ? "read_only" : "subscription_required",
      "subscription_read_only",
      at <= readOnlyEnd
        ? [...operationalRead, "certification:read", "subscription:read"]
        : [...restricted, "export:request"],
      readOnlyEnd
    );
  }
  return decision(row, "subscription_required", "subscription_missing", restricted);
}

export async function getAccessDecision(
  database: Database | Transaction,
  userId: string,
  workspaceId: string,
  at = new Date()
): Promise<AccessDecision | null> {
  const row = await oneOrNone<AccessRow>(
    database,
    `SELECT u.id AS user_id, u.status AS user_status,
            w.id AS workspace_id, w.status AS workspace_status,
            wm.role, wm.status AS membership_status,
            c.status AS credential_status, c.expires_at AS credential_expires_at,
            c.suspension_read_only_allowed,
            s.status AS subscription_status, s.current_period_end, s.past_due_since
       FROM users u
       JOIN workspace_memberships wm ON wm.user_id = u.id AND wm.workspace_id = $2
       JOIN workspaces w ON w.id = wm.workspace_id
       LEFT JOIN LATERAL (
         SELECT * FROM certification_credentials cc
          WHERE cc.user_id = u.id ORDER BY cc.verified_at DESC LIMIT 1
       ) c ON true
       LEFT JOIN subscription_entitlements s ON s.user_id = u.id
      WHERE u.id = $1`,
    [userId, workspaceId]
  );
  return row ? decideAccess(row, at) : null;
}

export function can(decision: AccessDecision, capability: string): boolean {
  return decision.capabilities.includes(capability);
}
