const TRUE = new Set(["1", "true", "yes", "on"]);

export const MARA_PHASE2_FLAGS = Object.freeze({
  normalizedEvents: "MARA_EVENTS_V2",
  eventMaterialization: "MARA_STATE_V2_WRITE",
  candidateGeneration: "MARA_CANDIDATES_V2",
  shadowPlanner: "MARA_SHADOW_PLANNER",
  playbookRetrieval: "MARA_PLAYBOOKS_V1",
  detailedUsageAccounting: "MARA_MODEL_USAGE_V1",
  taskGraph: "MARA_TASK_GRAPH_V1",
  deterministicScheduling: "MARA_DETERMINISTIC_SCHEDULING_V1",
  controlledInternalExecution: "MARA_CONTROLLED_INTERNAL_EXECUTION_V1",
  reassessment: "MARA_REASSESSMENT_V1",
  briefings: "MARA_BRIEFINGS_V2"
});

export function isMaraFeatureEnabled(name, env = process.env) {
  const key = MARA_PHASE2_FLAGS[name] || name;
  return TRUE.has(String(env[key] ?? "").trim().toLowerCase());
}

export function getMaraPhase2Flags(env = process.env) {
  return Object.fromEntries(Object.keys(MARA_PHASE2_FLAGS).map((name) => [name, isMaraFeatureEnabled(name, env)]));
}

export const MARA_RUNTIME_MODES = Object.freeze(["shadow", "task_creation", "controlled_execution"]);

export function getMaraRuntimeMode(env = process.env) {
  const mode = String(env.MARA_RUNTIME_V2_MODE || "shadow").trim().toLowerCase();
  return MARA_RUNTIME_MODES.includes(mode) ? mode : "shadow";
}

export function isControlledExecutionTenant(userId, env = process.env) {
  const allowed = String(env.MARA_CONTROLLED_EXECUTION_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  return allowed.includes(String(userId));
}
