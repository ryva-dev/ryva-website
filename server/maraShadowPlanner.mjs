import { randomUUID } from "node:crypto";
import { createAnthropicMessage, parseJsonFromLlmText } from "./maraLlm.mjs";
import { estimateModelCost } from "./modelUsageAccounting.mjs";

export const MARA_SHADOW_PLAN_SCHEMA_VERSION = "1.0.0";
const OWNERS = new Set(["mara", "creator", "shared"]);
const URGENCY = new Set(["critical", "high", "normal", "low"]);
const TIERS = new Set(["code", "small", "mid", "premium"]);

export function validateShadowPlannerInput(input) {
  for (const field of ["businessState", "meaningfulRecentEvents", "candidateWork", "playbooks", "availableTools", "permissions", "budget", "existingScheduledWork"]) {
    if (input?.[field] == null) throw new Error(`Shadow planner input missing ${field}.`);
  }
  return input;
}

export function validateShadowPlan(plan) {
  if (!plan || typeof plan !== "object") throw new Error("Shadow plan must be an object.");
  for (const field of ["situationSummary", "currentBottleneck", "emergingNeeds", "workToCreate", "workToSkip", "questionsForUser"]) {
    if (plan[field] == null) throw new Error(`Shadow plan missing ${field}.`);
  }
  if (!Array.isArray(plan.workToCreate) || !Array.isArray(plan.workToSkip) || !Array.isArray(plan.emergingNeeds) || !Array.isArray(plan.questionsForUser)) throw new Error("Shadow plan list fields must be arrays.");
  for (const work of plan.workToCreate) {
    for (const field of ["title", "sourceCandidateTypes", "owner", "commercialObjective", "expectedBusinessEffect", "urgency", "creatorEffortMinutes", "dependencies", "schedulingWindow", "approvalRequirement", "executionModelTier", "completionCondition", "reassessmentTrigger", "confidence", "evidence"]) {
      if (work[field] == null) throw new Error(`Planned work missing ${field}.`);
    }
    if (!OWNERS.has(work.owner) || !URGENCY.has(work.urgency) || !TIERS.has(work.executionModelTier)) throw new Error("Planned work contains an invalid enum.");
    if (typeof work.confidence !== "number" || work.confidence < 0 || work.confidence > 1) throw new Error("Planned work confidence must be 0..1.");
    if (!Array.isArray(work.sourceCandidateTypes) || !Array.isArray(work.dependencies) || !Array.isArray(work.evidence)) throw new Error("Planned work source candidates, dependencies, and evidence must be arrays.");
    if (/send (an? )?(email|message)|create gmail draft/i.test(`${work.title} ${work.completionCondition}`)) throw new Error("Shadow plan attempted prohibited external execution.");
  }
  return { schemaVersion: MARA_SHADOW_PLAN_SCHEMA_VERSION, ...plan };
}

function systemPrompt(playbooks) {
  return [
    "You are the premium shadow planner for Mara, a persistent self-directed Ryva employee.",
    "Diagnose and choose a small commercially justified plan for this creator. Candidates are possibilities, never instructions.",
    "Different states must yield different work. Skip unnecessary work. Portfolio work requires a demonstrated gap.",
    "Mara may create and schedule internal work but never sends external communication and never creates Gmail drafts.",
    "The creator owns sends and consequential approvals. Add anticipatory work only with evidence.",
    "Return JSON only, exactly matching the requested structure.",
    ...playbooks.map((p) => `PLAYBOOK ${p.metadata.id}@${p.metadata.version}\n${p.content}`)
  ].join("\n\n");
}

function userPrompt(input) {
  return JSON.stringify({
    businessState: input.businessState,
    meaningfulRecentEvents: input.meaningfulRecentEvents,
    candidateWork: input.candidateWork,
    availableTools: input.availableTools,
    permissions: input.permissions,
    budget: input.budget,
    existingScheduledWork: input.existingScheduledWork,
    requiredOutput: {
      situationSummary: "string", currentBottleneck: "string", emergingNeeds: ["string"],
      workToCreate: [{
        title: "string", sourceCandidateTypes: ["zero or more candidate_type values; empty only for justified anticipatory work"], owner: "mara|creator|shared", commercialObjective: "string", expectedBusinessEffect: "string",
        urgency: "critical|high|normal|low", creatorEffortMinutes: 0, dependencies: ["string"],
        scheduledTime: "ISO timestamp or null", schedulingWindow: "string", approvalRequirement: "string or none",
        executionModelTier: "code|small|mid|premium", completionCondition: "string", reassessmentTrigger: "string",
        confidence: 0.0, evidence: ["state path, event id, or candidate type"]
      }],
      workToSkip: [{ work: "string", reason: "string" }], questionsForUser: ["only blocking focused questions"]
    }
  });
}

export async function planMaraInShadow(input, { fetchImpl = globalThis.fetch, model, planningModel, store } = {}) {
  validateShadowPlannerInput(input);
  const selectedModel = model || process.env.MARA_PREMIUM_PLANNING_MODEL || process.env.ANTHROPIC_MARA_TASK_MODEL || "claude-sonnet-4-6";
  const started = Date.now();
  if (planningModel) {
    const result = await planningModel(input);
    return { plan: validateShadowPlan(result.plan || result), provider: result.provider || "injected", model: result.model || selectedModel, usage: result.usage || {}, latencyMs: Date.now() - started };
  }
  const text = await createAnthropicMessage({
    fetchImpl, maxTokens: 2600, model: selectedModel, system: systemPrompt(input.playbooks),
    messages: [{ role: "user", content: [{ type: "text", text: userPrompt(input) }] }], userId: input.userId,
    usageStore: store, usageContext: { workerId: input.workerId, taskType: "shadow_business_planning", acceptanceStatus: "unused", relatedEventId: input.meaningfulRecentEvents[0]?.id }
  });
  const plan = validateShadowPlan(parseJsonFromLlmText(text));
  const recorded = store && input.userId
    ? await store.queryOne("SELECT estimated_cost_usd,input_tokens,output_tokens,cached_tokens FROM model_usage_events WHERE user_id = ? AND worker_id = ? AND task_type = ? ORDER BY created_at DESC LIMIT 1", input.userId, input.workerId, "shadow_business_planning")
    : null;
  return {
    plan, provider: "anthropic", model: selectedModel,
    usage: recorded ? {
      estimatedCostUsd: Number(recorded.estimated_cost_usd || 0), inputTokens: Number(recorded.input_tokens || 0),
      outputTokens: Number(recorded.output_tokens || 0), cachedTokens: Number(recorded.cached_tokens || 0)
    } : { estimatedCostUsd: estimateModelCost({}) },
    latencyMs: Date.now() - started
  };
}

export function planningRunId() { return randomUUID(); }
