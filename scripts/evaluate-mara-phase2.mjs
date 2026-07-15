import { createStore } from "../server/dataStore.mjs";
import { runMaraShadowPlanning } from "../server/maraShadowRuntime.mjs";
import { MARA_PHASE2_SCENARIOS } from "../server/maraPhase2Scenarios.mjs";

const live = process.argv.includes("--live");
const scenarioArgIndex = process.argv.indexOf("--scenario");
const selectedScenarioId = scenarioArgIndex >= 0 ? process.argv[scenarioArgIndex + 1] : null;
const scenarios = selectedScenarioId ? MARA_PHASE2_SCENARIOS.filter((item) => item.id === selectedScenarioId) : MARA_PHASE2_SCENARIOS;
const flags = { normalizedEvents: true, eventMaterialization: true, candidateGeneration: true, shadowPlanner: true, playbookRetrieval: true, detailedUsageAccounting: true };
const genericPlan = async (input) => ({
  provider: "offline-schema-test", model: "fixture",
  plan: {
    situationSummary: `Creator state has ${input.candidateWork.length} observable work possibilities.`,
    currentBottleneck: input.businessState.bottleneck,
    emergingNeeds: input.businessState.emergingNeeds || [],
    workToCreate: input.candidateWork.slice(0, 3).map((candidate) => ({
      title: candidate.candidateType.replaceAll("_", " "), sourceCandidateTypes: [candidate.candidateType], owner: candidate.suggestedOwner,
      commercialObjective: candidate.possibleCommercialObjective, expectedBusinessEffect: candidate.possibleCommercialObjective,
      urgency: candidate.urgency, creatorEffortMinutes: candidate.userActionMayBeRequired ? 15 : 0, dependencies: candidate.dependencies,
      scheduledTime: null, schedulingWindow: candidate.urgency === "critical" ? "immediately" : "next feasible work block",
      approvalRequirement: candidate.userActionMayBeRequired ? "creator action required" : "none", executionModelTier: "mid",
      completionCondition: `${candidate.candidateType} evidence is ready for review`, reassessmentTrigger: "new outcome or state change",
      confidence: .8, evidence: [candidate.candidateType]
    })),
    workToSkip: [], questionsForUser: []
  }, usage: { estimatedCostUsd: 0 }
});

const store = createStore({ databasePath: ":memory:" });
const results = [];
for (const scenario of scenarios) {
  const result = await runMaraShadowPlanning({
    store, userId: `evaluation-${scenario.id}`, workerId: "mara-vale", seedState: scenario.state,
    legacyPlan: ["ensure_starter_tasks", "brand_research", "weekly_plan"], flags,
    availableTools: ["internal_read", "internal_task_create", "research", "contact_validation", "analytics"],
    permissions: { externalCommunication: false, createGmailDrafts: false, createInternalTasks: true },
    budget: { maximumPlanningCostUsd: scenario.maxCost }, existingScheduledWork: [], planningModel: live ? undefined : genericPlan
  });
  const considered = result.diagnostics?.candidatesConsidered || [];
  const selectedTypes = [...new Set((result.output?.workToCreate || []).flatMap((work) => work.sourceCandidateTypes || []))];
  const selectedText = (result.output?.workToCreate || []).map((work) => `${work.title} ${work.commercialObjective}`).join(" ").toLowerCase();
  const expectedCandidates = scenario.expected.every((type) => considered.includes(type));
  const expectedWorkSelected = scenario.expected.every((type) => selectedTypes.includes(type));
  const avoidedWorkSelected = scenario.avoid.every((type) => !selectedTypes.includes(type));
  const noExternal = !/send (an? )?(email|message)|gmail draft/.test(selectedText);
  const cost = Number(result.estimatedCostUsd || 0);
  results.push({ id: scenario.id, name: scenario.name, status: result.status, expectedCandidates, expectedWorkSelected, avoidedWorkSelected, noExternal, cost, withinCost: cost <= scenario.maxCost, signature: (result.output?.workToCreate || []).map((work) => work.title).sort().join("|") || "NO_WORK", diagnostics: result.diagnostics, plan: result.output });
}

const first = MARA_PHASE2_SCENARIOS[0];
await runMaraShadowPlanning({ store, userId: "no-change", workerId: "mara-vale", seedState: first.state, flags, availableTools: [], permissions: {}, budget: {}, existingScheduledWork: [], planningModel: genericPlan });
const noChange = await runMaraShadowPlanning({ store, userId: "no-change", workerId: "mara-vale", seedState: first.state, flags, availableTools: [], permissions: {}, budget: {}, existingScheduledWork: [], planningModel: () => { throw new Error("premium model must not run"); } });
const uniqueSignatures = new Set(results.map((result) => result.signature)).size;
const report = {
  mode: live ? "live-premium" : "offline-structural", generatedAt: new Date().toISOString(),
  summary: {
    scenarios: results.length,
    passedStructural: results.filter((r) => r.status === "completed" && r.expectedCandidates && r.noExternal).length,
    passedPlanningQuality: results.filter((r) => r.status === "completed" && r.expectedWorkSelected && r.avoidedWorkSelected && r.noExternal && r.withinCost).length,
    uniquePlanSignatures: uniqueSignatures, noChangeStatus: noChange.status, noChangePremiumModelCalled: noChange.diagnostics?.premiumModelCalled
  },
  results
};
console.log(JSON.stringify(report, null, 2));
await store.close();
const minimumUnique = selectedScenarioId ? 1 : 12;
const planningGate = !live || report.summary.passedPlanningQuality === scenarios.length;
if (report.summary.passedStructural !== scenarios.length || !planningGate || report.summary.noChangeStatus !== "skipped_no_meaningful_change" || report.summary.noChangePremiumModelCalled !== false || uniqueSignatures < minimumUnique) process.exitCode = 1;
