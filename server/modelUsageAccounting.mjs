import { randomUUID } from "node:crypto";
import { ensureMaraRuntimeTables } from "./maraRuntimeStorage.mjs";
import { isMaraFeatureEnabled } from "./maraFeatureFlags.mjs";

export function estimateModelCost({ inputTokens = 0, outputTokens = 0, cachedTokens = 0 }, env = process.env) {
  const inputRate = Number(env.MODEL_INPUT_USD_PER_MILLION ?? 3);
  const outputRate = Number(env.MODEL_OUTPUT_USD_PER_MILLION ?? 15);
  const cachedRate = Number(env.MODEL_CACHED_INPUT_USD_PER_MILLION ?? .3);
  const uncachedInput = Math.max(0, Number(inputTokens) - Number(cachedTokens));
  return Number(((uncachedInput * inputRate + Number(outputTokens) * outputRate + Number(cachedTokens) * cachedRate) / 1_000_000).toFixed(8));
}

export function normalizeAnthropicUsage(payload) {
  return {
    inputTokens: Number(payload?.usage?.input_tokens || 0),
    outputTokens: Number(payload?.usage?.output_tokens || 0),
    cachedTokens: Number(payload?.usage?.cache_read_input_tokens || 0) + Number(payload?.usage?.cache_creation_input_tokens || 0)
  };
}

export async function recordModelUsage(store, entry, { force = false } = {}) {
  if (!force && !isMaraFeatureEnabled("detailedUsageAccounting")) return null;
  await ensureMaraRuntimeTables(store);
  const tokens = {
    inputTokens: Number(entry.inputTokens || 0), outputTokens: Number(entry.outputTokens || 0), cachedTokens: Number(entry.cachedTokens || 0)
  };
  const row = { id: entry.id || randomUUID(), cost: entry.estimatedCostUsd ?? estimateModelCost(tokens) };
  await store.execute(
    `INSERT INTO model_usage_events (id,user_id,worker_id,task_type,provider,model,input_tokens,output_tokens,cached_tokens,estimated_cost_usd,latency_ms,retry_count,request_status,acceptance_status,related_event_id,related_task_id,related_opportunity_id,related_commercial_outcome_id,request_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    row.id, entry.userId || null, entry.workerId || null, entry.taskType || "unclassified", entry.provider || "unknown", entry.model || "unknown",
    tokens.inputTokens, tokens.outputTokens, tokens.cachedTokens, row.cost, Number(entry.latencyMs || 0), Number(entry.retryCount || 0),
    entry.requestStatus || "success", entry.acceptanceStatus || "unused", entry.relatedEventId || null, entry.relatedTaskId || null,
    entry.relatedOpportunityId || null, entry.relatedCommercialOutcomeId || null, entry.requestId || null, entry.createdAt || new Date().toISOString()
  );
  return { id: row.id, estimatedCostUsd: row.cost, ...tokens };
}

export async function markModelOutputDisposition(store, { usageId, userId, acceptanceStatus }) {
  if (!new Set(["accepted", "edited", "rejected", "unused"]).has(acceptanceStatus)) throw new Error("Invalid model output disposition.");
  await store.execute("UPDATE model_usage_events SET acceptance_status = ? WHERE id = ? AND user_id = ?", acceptanceStatus, usageId, userId);
}
