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
      title: candidate.candidateType.replaceAll("_", " "), sourceCandidateTypes: [candidate.candidateType],
      owner: candidate.userActionMayBeRequired && candidate.suggestedOwner === "mara" ? "shared" : candidate.suggestedOwner,
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

function evaluateBehavior(scenario, plan) {
  if (!plan) return ["no valid plan"];
  const failures = [];
  const work = plan.workToCreate || [];
  const selectedTypes = [...new Set(work.flatMap((item) => item.sourceCandidateTypes || []))];
  const taskText = work.map((item) => `${item.title} ${item.commercialObjective} ${item.expectedBusinessEffect}`).join(" ").toLowerCase();
  const creatorWork = work.filter((item) => item.owner === "creator" || item.owner === "shared");
  if (work.some((item) => String(item.commercialObjective || "").trim().length < 12)) failures.push("task without a clear commercial objective");
  if (work.some((item) => String(item.expectedBusinessEffect || "").trim().length < 20)) failures.push("task without a meaningful expected business effect");
  if (work.some((item) => !Array.isArray(item.evidence) || item.evidence.length === 0)) failures.push("task without evidence");
  if (work.some((item) => /^(review|research|optimize|audit)$/i.test(String(item.title || "").trim()))) failures.push("generic task title");
  if ((plan.questionsForUser || []).length && creatorWork.length === 0) failures.push("non-blocking creator question without creator-owned work");
  if (scenario.id === "no-niche-no-portfolio" && (selectedTypes.includes("strengthen_pipeline") || selectedTypes.includes("address_portfolio_gap"))) failures.push("premature pipeline or portfolio work before positioning choice");
  if (["strong-portfolio", "portfolio-alone"].includes(scenario.id) && /portfolio (audit|gap|refresh|review|redesign)|additional portfolio|new sample/i.test(taskText)) failures.push("unnecessary portfolio work");
  if (scenario.id === "twenty-unsent" && (selectedTypes.includes("strengthen_pipeline") || /new (brand|opportunity|target).*research|discover/i.test(taskText))) failures.push("new discovery despite excessive unsent backlog");
  if (scenario.id === "urgent-active-deals" && (!selectedTypes.includes("protect_active_deadline") || selectedTypes.includes("strengthen_pipeline"))) failures.push("active deadline not protected or speculative pipeline selected");
  if (scenario.id === "limited-time") {
    if (work.length > 2 || creatorWork.length > 1 || creatorWork.reduce((sum, item) => sum + Number(item.creatorEffortMinutes || 0), 0) > 30) failures.push("time-constrained creator overloaded");
    if (/reusable.*(pitch|template)|generic.*pitch/i.test(taskText)) failures.push("premature generic pitch artifact for limited-time creator");
  }
  if (scenario.id === "ignored-tasks" && (selectedTypes.some((type) => type !== "throttle_and_reenter") || /research|discover|draft/i.test(taskText))) failures.push("speculative work during inactivity");
  if (scenario.id === "international-multilingual" && !/germany|international|shipping|language|english|portuguese|eur/i.test(taskText)) failures.push("international constraints not assessed");
  if (scenario.id === "overdue-payment" && (!/payment|invoice/i.test(taskText) || /research.*contact/i.test(taskText))) failures.push("overdue payment not handled directly from known contact state");
  if (scenario.id === "portfolio-alone" && work.length > 1) failures.push("unnecessary work at unrelated checkpoint");
  return [...new Set(failures)];
}

for (const scenario of scenarios) {
  const result = await runMaraShadowPlanning({
    store, userId: `evaluation-${scenario.id}`, workerId: "mara-vale", seedState: scenario.state,
    legacyPlan: ["ensure_starter_tasks", "brand_research", "weekly_plan"], flags,
    availableTools: ["internal_read", "internal_task_create", "research", "contact_validation", "analytics"],
    permissions: { externalCommunication: false, createGmailDrafts: false, createInternalTasks: true },
    budget: { maximumPlanningCostUsd: scenario.maxCost }, existingScheduledWork: [], planningModel: live ? undefined : genericPlan,
    planningTime: "2026-07-14T12:00:00-04:00", timeZone: "America/New_York"
  });
  const considered = result.diagnostics?.candidatesConsidered || [];
  const selectedTypes = [...new Set((result.output?.workToCreate || []).flatMap((work) => work.sourceCandidateTypes || []))];
  const selectedText = (result.output?.workToCreate || []).map((work) => `${work.title} ${work.commercialObjective}`).join(" ").toLowerCase();
  const expectedCandidates = scenario.expected.every((type) => considered.includes(type));
  const expectedWorkSelected = scenario.expected.every((type) => selectedTypes.includes(type));
  const avoidedWorkSelected = scenario.avoid.every((type) => !selectedTypes.includes(type));
  const noExternal = !/send (an? )?(email|message)|gmail draft/.test(selectedText);
  const cost = Number(result.estimatedCostUsd || 0);
  const behaviorFailures = evaluateBehavior(scenario, result.output);
  results.push({ id: scenario.id, name: scenario.name, status: result.status, expectedCandidates, expectedWorkSelected, avoidedWorkSelected, noExternal, behaviorFailures, cost, withinCost: cost <= scenario.maxCost, signature: (result.output?.workToCreate || []).map((work) => work.title).sort().join("|") || "NO_WORK", diagnostics: result.diagnostics, plan: result.output });
}

const first = MARA_PHASE2_SCENARIOS[0];
await runMaraShadowPlanning({ store, userId: "no-change", workerId: "mara-vale", seedState: first.state, flags, availableTools: [], permissions: {}, budget: {}, existingScheduledWork: [], planningModel: genericPlan, planningTime: "2026-07-14T12:00:00-04:00", timeZone: "America/New_York" });
const noChange = await runMaraShadowPlanning({ store, userId: "no-change", workerId: "mara-vale", seedState: first.state, flags, availableTools: [], permissions: {}, budget: {}, existingScheduledWork: [], planningModel: () => { throw new Error("premium model must not run"); }, planningTime: "2026-07-14T12:00:00-04:00", timeZone: "America/New_York" });
const uniqueSignatures = new Set(results.map((result) => result.signature)).size;
const report = {
  mode: live ? "live-premium" : "offline-structural", generatedAt: new Date().toISOString(),
  summary: {
    scenarios: results.length,
    passedStructural: results.filter((r) => r.status === "completed" && r.expectedCandidates && r.noExternal).length,
    passedPlanningQuality: results.filter((r) => r.status === "completed" && r.expectedWorkSelected && r.avoidedWorkSelected && r.noExternal && r.withinCost).length,
    passedBehavior: results.filter((r) => r.status === "completed" && r.behaviorFailures.length === 0).length,
    uniquePlanSignatures: uniqueSignatures, noChangeStatus: noChange.status, noChangePremiumModelCalled: noChange.diagnostics?.premiumModelCalled
  },
  results
};
console.log(JSON.stringify(report, null, 2));
await store.close();
const minimumUnique = selectedScenarioId ? 1 : 12;
const planningGate = !live || (report.summary.passedPlanningQuality === scenarios.length && report.summary.passedBehavior === scenarios.length);
if (report.summary.passedStructural !== scenarios.length || !planningGate || report.summary.noChangeStatus !== "skipped_no_meaningful_change" || report.summary.noChangePremiumModelCalled !== false || uniqueSignatures < minimumUnique) process.exitCode = 1;
