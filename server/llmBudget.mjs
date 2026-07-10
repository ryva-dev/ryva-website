// Ryva — unified per-user LLM budget (Phase 2, P0)
//
// A single daily call counter shared by EVERY Anthropic path: agent tasks,
// Mara's bespoke generators (maraLlm), and the interview/onboarding/office-chat
// calls in index.mjs. Previously the cap lived only in agentLlm, so most paths
// could spend unlimited tokens. This module is the one source of truth.
//
// Depends only on the data store (no imports of maraLlm/agentLlm), so it can be
// imported anywhere without creating a cycle.

import * as store from "./dataStore.mjs";

const DAILY_LLM_CALL_LIMIT = Number.parseInt(process.env.AGENT_DAILY_LLM_CALL_LIMIT ?? "300", 10);

let usageTableReady = false;
async function ensureUsageTable() {
  if (usageTableReady) return;
  await store.execute(`
    CREATE TABLE IF NOT EXISTS agent_llm_usage (
      user_id TEXT NOT NULL,
      day TEXT NOT NULL,
      calls INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day)
    )
  `);
  usageTableReady = true;
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

/** Calls remaining today for a user. */
export async function llmBudgetRemaining(userId) {
  await ensureUsageTable();
  const row = await store.queryOne(
    "SELECT calls FROM agent_llm_usage WHERE user_id = ? AND day = ?",
    userId,
    utcDay()
  );
  return Math.max(0, DAILY_LLM_CALL_LIMIT - Number(row?.calls ?? 0));
}

/** Record one LLM call against a user's daily budget. */
export async function recordLlmCall(userId) {
  await ensureUsageTable();
  await store.execute(
    `INSERT INTO agent_llm_usage (user_id, day, calls) VALUES (?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET calls = calls + 1`,
    userId,
    utcDay()
  );
}

/**
 * True if the user may make another call. No userId (system/unauthenticated
 * paths) is allowed through — those are guarded by rate limiting instead.
 * Fails OPEN on infrastructure error: a budget-table hiccup must not take down
 * all LLM features.
 */
export async function canSpend(userId) {
  if (!userId) return true;
  try {
    return (await llmBudgetRemaining(userId)) > 0;
  } catch {
    return true;
  }
}

/** Best-effort usage record; never throws into the caller. */
export async function noteSpend(userId) {
  if (!userId) return;
  try {
    await recordLlmCall(userId);
  } catch {
    /* budget accounting is best-effort */
  }
}

export { DAILY_LLM_CALL_LIMIT };
