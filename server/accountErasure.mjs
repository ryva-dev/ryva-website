/**
 * Tenant erasure allowlists. Keep in sync with migrations that add user_id columns.
 * Global tables are intentionally excluded and documented for audits.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const USER_SCOPED_TABLES = [
  "sessions",
  "email_verification_tokens",
  "password_reset_tokens",
  "checkout_sessions",
  "hired_workers",
  "office_chat_messages",
  "office_custom_tasks",
  "office_activity_logs",
  "office_worker_settings",
  "office_worker_knowledge",
  "office_uploaded_files",
  "office_custom_briefings",
  "office_global_settings",
  "user_onboarding",
  "office_onboarding_sessions",
  "office_calendar_events",
  "office_worker_integrations",
  "office_email_threads",
  "office_campaigns",
  "office_leads",
  "office_suggested_actions",
  "office_assignments",
  "office_deliverables",
  "office_handbook_entries",
  "office_brand_opportunities",
  "office_trend_signals",
  "office_sync_jobs",
  "user_digest_log",
  "worker_permissions",
  "worker_tasks",
  "worker_activity_log",
  "worker_recurring_responsibilities",
  "worker_research_items",
  "worker_approval_requests",
  "worker_outputs",
  "worker_brands",
  "worker_trend_snapshots",
  "agent_llm_usage",
  "agent_events",
  "worker_business_state_snapshots",
  "agent_work_candidates",
  "agent_planning_runs",
  "model_usage_events",
  "agent_tasks_v2",
  "agent_task_relationships",
  "agent_task_audit_history",
  "agent_task_calendar_entries",
  "agent_task_compilation_runs",
  "agent_task_execution_attempts",
  "agent_dynamic_responsibilities",
  "agent_briefings_v2",
  "action_audit_events",
  "durable_jobs",
  "external_action_executions",
  "mara_creator_performance_profiles",
  "mara_creator_brand_opportunities",
  "mara_creative_analyses",
  "mara_commercial_outcomes",
  "mara_brand_evidence",
  "mara_research_provider_runs",
  "mara_ad_observations",
  "mara_brand_contacts",
  "mara_creator_intelligence_profiles",
  "mara_creative_patterns",
  "mara_creative_concepts",
  "mara_outreach_sequences",
  "mara_media_assets",
  "mara_video_analyses",
  "mara_autonomy_limits",
  "mara_score_change_log",
  "mara_opportunity_stage_events",
  "mara_creator_learning_state"
];

/** Shared / global tables intentionally excluded from per-user wipe. */
export const GLOBAL_TABLES_EXCLUDED_FROM_USER_DELETE = [
  "mara_public_brands",
  "mara_brand_profiles",
  "worker_knowledge_modules",
  "schema_migrations",
  "mara_global_trend_insights",
  "rate_limit_buckets",
  "stripe_webhook_events"
];

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "db", "migrations");

/** Parse CREATE TABLE blocks in migrations for tables that declare a user_id column. */
export function listUserIdTablesFromMigrations(dir = migrationsDir) {
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  const tables = new Set();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const createRe = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\)\s*;/gi;
    let match;
    while ((match = createRe.exec(sql)) !== null) {
      const table = match[1];
      const body = match[2];
      if (/\buser_id\b/i.test(body)) tables.add(table);
    }
  }
  return [...tables].sort();
}

export function assertUserScopedTableCoverage({
  requiredTables = listUserIdTablesFromMigrations(),
  allowlist = USER_SCOPED_TABLES,
  globalExclusions = GLOBAL_TABLES_EXCLUDED_FROM_USER_DELETE
} = {}) {
  const missing = requiredTables.filter(
    (table) => !allowlist.includes(table) && !globalExclusions.includes(table)
  );
  if (missing.length > 0) {
    throw new Error(`USER_SCOPED_TABLES missing (not in allowlist or global exclusions): ${missing.join(", ")}`);
  }
  return true;
}

/**
 * Decide whether an account-deletion request is authorized.
 * Google-only users (passwordIsSet=0) cannot use password; they must re-auth with Google.
 */
export async function authorizeAccountDeletion({
  user,
  password = "",
  googleAccessToken = "",
  verifyPassword,
  fetchGoogleProfile,
  normalizeEmail = (value) => String(value || "").trim().toLowerCase()
}) {
  const passwordIsSet = Number(user.passwordIsSet ?? user.password_is_set ?? 1) === 1;
  const passwordText = String(password ?? "");
  if (passwordIsSet && passwordText && typeof verifyPassword === "function") {
    if (verifyPassword(passwordText, user.passwordHash || user.password_hash)) {
      return { ok: true, method: "password" };
    }
  }

  const token = String(googleAccessToken ?? "").trim();
  if (token && typeof fetchGoogleProfile === "function") {
    try {
      const profile = await fetchGoogleProfile(token);
      const emailMatches = normalizeEmail(profile?.email) === normalizeEmail(user.email);
      const verified = profile?.email_verified !== false;
      if (emailMatches && verified) {
        return { ok: true, method: "google" };
      }
    } catch {
      return { ok: false, reason: "google_reauth_failed" };
    }
  }

  if (!passwordIsSet) {
    return { ok: false, reason: "google_reauth_required" };
  }
  return { ok: false, reason: "password_incorrect" };
}
