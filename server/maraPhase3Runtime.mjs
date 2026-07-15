import { randomUUID, createHash } from "node:crypto";
import { runMaraShadowPlanning } from "./maraShadowRuntime.mjs";
import { compileMaraPlan } from "./maraPlanTaskCompiler.mjs";
import { executeDueInternalTasks } from "./maraControlledExecution.mjs";
import { getMaraPhase2Flags, getMaraRuntimeMode } from "./maraFeatureFlags.mjs";
import { ensureMaraRuntimeTables } from "./maraRuntimeStorage.mjs";
import { MARA_EVENT_TYPES } from "./maraEvents.mjs";

export async function runMaraPhase3(options) {
  const flags = options.flags || getMaraPhase2Flags(options.env);
  const mode = options.mode || getMaraRuntimeMode(options.env);
  const planning = await runMaraShadowPlanning({ ...options, flags });
  const effectiveMode = mode === "shadow" || !flags.deterministicScheduling ? "shadow" : mode;
  const compilation = planning.status === "completed" && flags.taskGraph ? await compileMaraPlan(options.store, {
    userId: options.userId, workerId: options.workerId, planId: planning.id, stateHash: planning.stateHash,
    plan: planning.output, plannerInput: planning.input, mode: effectiveMode, env: options.env
  }) : null;
  const defaultExecutors = {
    code: async (task) => {
      if (!["monitoring", "reassessment"].includes(task.taskKind)) return { accepted: false, reason: "This task needs a substantive executor." };
      return { accepted: true, resultType: "deterministic_internal_check", checkedAt: new Date().toISOString(), sourceStateHash: task.sourceStateHash };
    }
  };
  const execution = mode === "controlled_execution" && flags.controlledInternalExecution
    ? await executeDueInternalTasks(options.store, { userId: options.userId, workerId: options.workerId, executors: { ...defaultExecutors, ...options.executors }, allowedUserIds: options.allowedUserIds, availableTools: options.availableTools, budget: options.executionBudget || options.budget, currentBusinessState: planning.input?.businessState || options.seedState, env: options.env, now: new Date(options.planningTime || Date.now()) })
    : [];
  return { mode, effectiveMode, planning, compilation, execution };
}

export async function registerDynamicResponsibility(store, { userId, workerId = "mara", title, commercialObjective, cadence, candidateTriggerType, nextCheckAt }) {
  await ensureMaraRuntimeTables(store);
  if (!MARA_EVENT_TYPES.includes(candidateTriggerType)) throw new Error(`Unsupported responsibility event type: ${candidateTriggerType}`);
  const key = createHash("sha256").update(JSON.stringify([userId, workerId, title, candidateTriggerType])).digest("hex");
  const now = new Date().toISOString();
  await store.execute("INSERT INTO agent_dynamic_responsibilities (id,user_id,worker_id,title,commercial_objective,cadence_json,candidate_trigger_type,is_active,last_triggered_at,next_check_at,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,worker_id,idempotency_key) DO NOTHING", randomUUID(), userId, workerId, title, commercialObjective, JSON.stringify(cadence), candidateTriggerType, 1, null, nextCheckAt, key, now, now);
  return key;
}

export async function materializeDueResponsibilities(store, { userId, workerId = "mara", now = new Date().toISOString(), emitEvent }) {
  await ensureMaraRuntimeTables(store);
  const due = await store.query("SELECT * FROM agent_dynamic_responsibilities WHERE user_id = ? AND worker_id = ? AND is_active = 1 AND next_check_at <= ?", userId, workerId, now);
  const emitted = [];
  for (const responsibility of due) {
    const cadence = typeof responsibility.cadence_json === "string" ? JSON.parse(responsibility.cadence_json) : responsibility.cadence_json;
    const scheduledFor = new Date(responsibility.next_check_at).toISOString();
    const event = await emitEvent({ userId, workerId, eventType: responsibility.candidate_trigger_type, sourceType: "dynamic_responsibility", sourceId: responsibility.id, occurredAt: scheduledFor, idempotencyKey: `${responsibility.id}:${scheduledFor}`, payload: { title: responsibility.title, commercialObjective: responsibility.commercial_objective, scheduledFor } });
    emitted.push(event);
    const intervalMinutes = Number(cadence?.intervalMinutes || 0) + Number(cadence?.intervalHours || 0) * 60 + Number(cadence?.intervalDays || 0) * 1440;
    const oneShot = cadence?.oneShot === true || intervalMinutes <= 0;
    const nextCheckAt = oneShot ? responsibility.next_check_at : new Date(new Date(scheduledFor).getTime() + intervalMinutes * 60_000).toISOString();
    await store.execute("UPDATE agent_dynamic_responsibilities SET last_triggered_at = ?, next_check_at = ?, is_active = ?, updated_at = ? WHERE id = ?", scheduledFor, nextCheckAt, oneShot ? 0 : 1, now, responsibility.id);
  }
  return emitted;
}
