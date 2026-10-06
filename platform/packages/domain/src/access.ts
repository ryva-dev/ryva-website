import type { Database, Transaction } from "../../database/src/index.js";
import { oneOrNone } from "../../database/src/index.js";
import {
  deriveCustomerProductAccess,
  type CustomerProductAccess,
  type ProAccessState
} from "./productAccess.js";

export type Role = "representative" | "mentor" | "instructor" | "admin" | "support";
export type AccessMode =
  | "full"
  | "account_only"
  | "program_only"
  | "pro_required"
  | "restricted"
  | "blocked";

export type AccessReason =
  | "operating_access"
  | "account_only"
  | "program_incomplete"
  | "pro_trial_active"
  | "pro_subscription_active"
  | "pro_subscription_paid_through"
  | "pro_inactive"
  | "staff"
  | "account_blocked";

export type AccessDecision = CustomerProductAccess & {
  mode: AccessMode;
  reason: AccessReason;
  capabilities: string[];
};

export type AccessRow = {
  user_id: string;
  user_status: string;
  workspace_id: string;
  workspace_status: string;
  role: Role;
  membership_status: string;
  program_status: string | null;
  program_completed_at: Date | null;
  pro_trial_started_at: Date | null;
  pro_trial_ends_at: Date | null;
  subscription_status: string | null;
  current_period_end: Date | null;
  past_due_since: Date | null;
};

const accountCapabilities = [
  "account:read",
  "profile:read",
  "profile:write",
  "settings:read",
  "settings:write",
  "sessions:read",
  "sessions:write",
  "support:request"
];
const programCapabilities = [...accountCapabilities, "program:read", "program:progress.write"];
const operatingReadCapabilities = [
  ...programCapabilities,
  "operational:read",
  "export:request"
];
const operatingCapabilities = [
  ...operatingReadCapabilities,
  "operational:write",
  "external:approve",
];

function staffProductAccess(): CustomerProductAccess {
  return {
    canAccessProgram: false,
    isProgramCompleted: false,
    canAccessOperatingPlatform: false,
    isProTrialActive: false,
    isProActive: false,
    programStatus: null,
    programCompletedAt: null,
    proTrialStartedAt: null,
    proTrialEndsAt: null,
    proAccessState: "staff",
    subscriptionStatus: null
  };
}

function adminProductAccess(): CustomerProductAccess {
  return {
    ...staffProductAccess(),
    canAccessProgram: true,
    isProgramCompleted: true,
    canAccessOperatingPlatform: true,
    programStatus: "staff"
  };
}

function decision(
  mode: AccessMode,
  reason: AccessReason,
  capabilities: string[],
  product: CustomerProductAccess
): AccessDecision {
  return { mode, reason, capabilities, ...product };
}

function reasonForProState(state: ProAccessState): AccessReason {
  if (state === "trial_active") return "pro_trial_active";
  if (state === "subscription_active") return "pro_subscription_active";
  if (state === "paid_through") return "pro_subscription_paid_through";
  return "operating_access";
}

export function decideAccess(row: AccessRow, at = new Date()): AccessDecision {
  const product = deriveCustomerProductAccess({
    programStatus: row.program_status,
    programCompletedAt: row.program_completed_at,
    proTrialStartedAt: row.pro_trial_started_at,
    proTrialEndsAt: row.pro_trial_ends_at,
    subscriptionStatus: row.subscription_status,
    subscriptionPeriodEnd: row.current_period_end,
    subscriptionPastDueSince: row.past_due_since
  }, at);

  if (
    row.user_status !== "active" ||
    row.membership_status !== "active" ||
    row.workspace_status === "closed"
  ) {
    return decision("blocked", "account_blocked", [], product);
  }
  if (row.role === "admin") {
    return decision("full", "staff", [
      ...operatingCapabilities,
      "admin:access",
      "audit:read",
      "jobs:read",
      "jobs:manage",
      "support_grants:manage"
    ], adminProductAccess());
  }
  if (row.role === "support") {
    return decision("full", "staff", [
      ...accountCapabilities,
      "support:access",
      "jobs:read"
    ], staffProductAccess());
  }
  if (row.role === "mentor" || row.role === "instructor") {
    return decision("restricted", "staff", [
      "sandbox:access",
      ...accountCapabilities,
      "operational:read",
      "export:request"
    ], staffProductAccess());
  }
  if (!product.canAccessProgram) {
    return decision("account_only", "account_only", accountCapabilities, product);
  }
  if (!product.isProgramCompleted) {
    return decision("program_only", "program_incomplete", programCapabilities, product);
  }
  if (!product.canAccessOperatingPlatform) {
    return decision("pro_required", "pro_inactive", programCapabilities, product);
  }
  return decision("full", reasonForProState(product.proAccessState), operatingCapabilities, product);
}

export async function getAccessDecision(
  database: Database | Transaction,
  userId: string,
  workspaceId: string,
  at = new Date()
): Promise<AccessDecision | null> {
  const row = await oneOrNone<AccessRow>(
    database,
    `SELECT u.id AS user_id,u.status AS user_status,
            w.id AS workspace_id,w.status AS workspace_status,
            wm.role,wm.status AS membership_status,
            pe.status AS program_status,pe.completed_at AS program_completed_at,
            pe.pro_trial_started_at,pe.pro_trial_ends_at,
            se.status AS subscription_status,se.current_period_end,se.past_due_since
       FROM users u
       JOIN workspace_memberships wm ON wm.user_id=u.id AND wm.workspace_id=$2
       JOIN workspaces w ON w.id=wm.workspace_id
       LEFT JOIN program_entitlements pe ON pe.user_id=u.id
       LEFT JOIN subscription_entitlements se ON se.user_id=u.id
      WHERE u.id=$1`,
    [userId, workspaceId]
  );
  return row ? decideAccess(row, at) : null;
}

export function can(decision: AccessDecision, capability: string): boolean {
  return decision.capabilities.includes(capability);
}
