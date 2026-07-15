const TRUE = new Set(["1", "true", "yes", "on"]);

export const MARA_PHASE2_FLAGS = Object.freeze({
  normalizedEvents: "MARA_EVENTS_V2",
  eventMaterialization: "MARA_STATE_V2_WRITE",
  candidateGeneration: "MARA_CANDIDATES_V2",
  shadowPlanner: "MARA_SHADOW_PLANNER",
  playbookRetrieval: "MARA_PLAYBOOKS_V1",
  detailedUsageAccounting: "MARA_MODEL_USAGE_V1"
});

export function isMaraFeatureEnabled(name, env = process.env) {
  const key = MARA_PHASE2_FLAGS[name] || name;
  return TRUE.has(String(env[key] ?? "").trim().toLowerCase());
}

export function getMaraPhase2Flags(env = process.env) {
  return Object.fromEntries(Object.keys(MARA_PHASE2_FLAGS).map((name) => [name, isMaraFeatureEnabled(name, env)]));
}
