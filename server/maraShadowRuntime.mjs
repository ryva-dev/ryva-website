import { randomUUID } from "node:crypto";
import { getMaraPhase2Flags } from "./maraFeatureFlags.mjs";
import { listMaraEvents, markMaraEventsProcessed } from "./maraEvents.mjs";
import { materializeBusinessState } from "./maraBusinessState.mjs";
import { generateCandidateWork, persistCandidateWork } from "./maraCandidateWork.mjs";
import { loadMaraPlaybooks, retrieveRelevantPlaybooks } from "./maraPlaybooks.mjs";
import { planMaraInShadow } from "./maraShadowPlanner.mjs";
import { ensureMaraRuntimeTables } from "./maraRuntimeStorage.mjs";

async function storeRun(store, row) {
  await ensureMaraRuntimeTables(store);
  await store.execute(
    `INSERT INTO agent_planning_runs (id,user_id,worker_id,mode,state_snapshot_id,state_hash,trigger_event_ids_json,playbook_versions_json,planner_input_json,planner_output_json,legacy_plan_json,diagnostics_json,provider,model,estimated_cost_usd,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    row.id, row.userId, row.workerId, "shadow", row.snapshotId || null, row.stateHash || null,
    JSON.stringify(row.eventIds || []), JSON.stringify(row.playbookVersions || {}), JSON.stringify(row.input || {}),
    row.output ? JSON.stringify(row.output) : null, JSON.stringify(row.legacyPlan || []), JSON.stringify(row.diagnostics || {}),
    row.provider || null, row.model || null, Number(row.estimatedCostUsd || 0), row.status, new Date().toISOString()
  );
  return row;
}

export async function runMaraShadowPlanning({
  store, userId, workerId, seedState, legacyPlan = [], availableTools = [], permissions = {},
  budget = {}, existingScheduledWork = [], planningModel, fetchImpl, flags: explicitFlags,
  planningTime = new Date().toISOString(), timeZone = "UTC"
}) {
  const flags = explicitFlags || getMaraPhase2Flags();
  if (!flags.shadowPlanner) return { status: "disabled" };
  const run = { id: randomUUID(), userId, workerId, legacyPlan };
  let premiumModelAttempted = false;
  try {
    const events = (flags.normalizedEvents || flags.eventMaterialization) ? await listMaraEvents(store, { userId, workerId, unprocessedOnly: true }) : [];
    const snapshot = await materializeBusinessState(store, { userId, workerId, events, seedState });
    const lastPlan = await store.queryOne("SELECT state_hash FROM agent_planning_runs WHERE user_id = ? AND worker_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1", userId, workerId);
    run.snapshotId = snapshot.id; run.stateHash = snapshot.hash; run.eventIds = events.map((e) => e.id);
    if (lastPlan?.state_hash === snapshot.hash && events.length === 0) {
      return storeRun(store, { ...run, status: "skipped_no_meaningful_change", diagnostics: { reason: "state hash unchanged", premiumModelCalled: false } });
    }
    const candidates = flags.candidateGeneration ? generateCandidateWork(snapshot.state, events) : [];
    if (flags.candidateGeneration) await persistCandidateWork(store, { userId, workerId, candidates });
    const allPlaybooks = flags.playbookRetrieval ? await loadMaraPlaybooks() : [];
    const playbooks = retrieveRelevantPlaybooks(allPlaybooks, { state: snapshot.state, candidates });
    const input = { userId, workerId, planningTime, timeZone, businessState: snapshot.state, meaningfulRecentEvents: events, candidateWork: candidates, playbooks, availableTools, permissions, budget, existingScheduledWork };
    premiumModelAttempted = true;
    const result = await planMaraInShadow(input, { fetchImpl, planningModel, store });
    const selected = result.plan.workToCreate.map((work) => work.title);
    const skipped = result.plan.workToSkip.map((work) => work.work);
    const diagnostics = {
      reason: snapshot.materialChanges?.join("; ") || "initial state assessment", premiumModelCalled: true,
      playbooksLoaded: playbooks.map((p) => `${p.metadata.id}@${p.metadata.version}`), candidatesConsidered: candidates.map((c) => c.candidateType),
      workSelected: selected, workSkipped: skipped, legacyPlan, validationFailures: [],
      modelUsage: {
        inputTokens: Number(result.usage?.inputTokens || 0), outputTokens: Number(result.usage?.outputTokens || 0),
        cachedTokens: Number(result.usage?.cachedTokens || 0), estimatedCostUsd: Number(result.usage?.estimatedCostUsd || 0),
        latencyMs: Number(result.latencyMs || 0)
      },
      comparison: { legacyCount: legacyPlan.length, shadowCount: selected.length, sharedLabels: selected.filter((x) => legacyPlan.includes(x)) }
    };
    if (events.length) await markMaraEventsProcessed(store, { userId, workerId, eventIds: events.map((e) => e.id) });
    return storeRun(store, {
      ...run, input, output: result.plan, status: "completed", provider: result.provider, model: result.model,
      estimatedCostUsd: result.usage?.estimatedCostUsd || 0, playbookVersions: Object.fromEntries(playbooks.map((p) => [p.metadata.id, p.metadata.version])), diagnostics
    });
  } catch (error) {
    const failedUsage = premiumModelAttempted
      ? await store.queryOne("SELECT input_tokens,output_tokens,cached_tokens,estimated_cost_usd,latency_ms FROM model_usage_events WHERE user_id = ? AND worker_id = ? AND task_type = ? ORDER BY created_at DESC LIMIT 1", userId, workerId, "shadow_business_planning")
      : null;
    return storeRun(store, {
      ...run,
      status: "failed",
      estimatedCostUsd: Number(failedUsage?.estimated_cost_usd || 0),
      diagnostics: {
        premiumModelCalled: premiumModelAttempted,
        validationFailures: [error instanceof Error ? error.message : String(error)],
        rawPlannerOutput: error?.rawPlannerOutput || null,
        modelUsage: failedUsage ? {
          inputTokens: Number(failedUsage.input_tokens || 0), outputTokens: Number(failedUsage.output_tokens || 0),
          cachedTokens: Number(failedUsage.cached_tokens || 0), estimatedCostUsd: Number(failedUsage.estimated_cost_usd || 0),
          latencyMs: Number(failedUsage.latency_ms || 0)
        } : null
      }
    });
  }
}
