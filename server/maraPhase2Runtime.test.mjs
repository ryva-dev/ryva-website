import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "./dataStore.mjs";
import { ingestMaraEvent, listMaraEvents } from "./maraEvents.mjs";
import { generateCandidateWork } from "./maraCandidateWork.mjs";
import { loadMaraPlaybooks, REQUIRED_PLAYBOOK_METADATA, retrieveRelevantPlaybooks } from "./maraPlaybooks.mjs";
import { MARA_PHASE2_SCENARIOS } from "./maraPhase2Scenarios.mjs";
import { applyMaraEvents } from "./maraBusinessState.mjs";
import { runMaraShadowPlanning } from "./maraShadowRuntime.mjs";
import { validateShadowPlan } from "./maraShadowPlanner.mjs";

test("events are idempotent and tenant isolated", async () => {
  const store = createStore({ databasePath: ":memory:" });
  const event = { userId: "u1", workerId: "mara", eventType: "invoice_overdue", sourceType: "invoice", sourceId: "i1", occurredAt: "2026-07-14T12:00:00Z", payload: { amount: 50 } };
  await ingestMaraEvent(store, event); await ingestMaraEvent(store, event);
  assert.equal((await listMaraEvents(store, { userId: "u1", workerId: "mara" })).length, 1);
  assert.equal((await listMaraEvents(store, { userId: "u2", workerId: "mara" })).length, 0);
  await store.close();
});

test("all 16 states generate expected possibilities without code selecting a plan", () => {
  assert.equal(MARA_PHASE2_SCENARIOS.length, 16);
  for (const scenario of MARA_PHASE2_SCENARIOS) {
    const types = generateCandidateWork(scenario.state).map((item) => item.candidateType);
    for (const expected of scenario.expected) assert.ok(types.includes(expected), `${scenario.id} missing ${expected}`);
  }
});

test("minimum playbooks have complete machine-readable metadata and relevant retrieval", async () => {
  const playbooks = await loadMaraPlaybooks();
  assert.equal(playbooks.length, 11);
  for (const playbook of playbooks) for (const field of REQUIRED_PLAYBOOK_METADATA) assert.notEqual(playbook.metadata[field], undefined);
  const novice = MARA_PHASE2_SCENARIOS[0].state;
  const selected = retrieveRelevantPlaybooks(playbooks, { state: novice, candidates: generateCandidateWork(novice) });
  assert.ok(selected.some((item) => item.metadata.id === "mara.creator-readiness"));
  const strong = MARA_PHASE2_SCENARIOS.at(-1).state;
  const strongSelected = retrieveRelevantPlaybooks(playbooks, { state: strong, candidates: generateCandidateWork(strong) });
  assert.ok(!strongSelected.some((item) => item.metadata.id === "mara.creator-readiness"));
});

test("a payment outcome removes overdue-payment work from future candidates", () => {
  const overdue = MARA_PHASE2_SCENARIOS.find((item) => item.id === "overdue-payment").state;
  assert.ok(generateCandidateWork(overdue).some((item) => item.candidateType === "resolve_overdue_payment"));
  const { state } = applyMaraEvents(overdue, [{ id: "paid-event", eventType: "payment_recorded", entityId: "inv-17", payload: { amount: 800 }, occurredAt: "2026-07-14T14:00:00Z", confidence: 1 }]);
  assert.ok(!generateCandidateWork(state).some((item) => item.candidateType === "resolve_overdue_payment"));
});

test("an unchanged state terminates before a second premium planning call", async () => {
  const store = createStore({ databasePath: ":memory:" });
  let calls = 0;
  const planningModel = async () => {
    calls += 1;
    return { plan: { situationSummary: "No urgent work.", currentBottleneck: "none", emergingNeeds: [], workToCreate: [], workToSkip: [], questionsForUser: [] } };
  };
  const flags = { normalizedEvents: true, eventMaterialization: true, candidateGeneration: true, shadowPlanner: true, playbookRetrieval: true, detailedUsageAccounting: true };
  const input = { store, userId: "unchanged", workerId: "mara", seedState: MARA_PHASE2_SCENARIOS.at(-1).state, flags, availableTools: [], permissions: {}, budget: {}, existingScheduledWork: [], planningModel };
  assert.equal((await runMaraShadowPlanning(input)).status, "completed");
  const second = await runMaraShadowPlanning(input);
  assert.equal(second.status, "skipped_no_meaningful_change");
  assert.equal(second.diagnostics.premiumModelCalled, false);
  assert.equal(calls, 1);
  await store.close();
});

test("code normalizes untrusted schedule dates and rejects hidden creator effort", () => {
  const basePlan = {
    situationSummary: "One active deal is waiting.", currentBottleneck: "waiting on reply", emergingNeeds: [],
    workToCreate: [{
      title: "Monitor deal", sourceCandidateTypes: [], owner: "mara", commercialObjective: "Protect active revenue",
      expectedBusinessEffect: "Flags a stalled deal before commercial momentum is lost.", urgency: "normal", creatorEffortMinutes: 0,
      dependencies: [], scheduledTime: null, schedulingWindow: "Friday 2026-07-18 end of day", approvalRequirement: "none",
      executionModelTier: "code", completionCondition: "Status checked", reassessmentTrigger: "Brand replies", confidence: .9,
      evidence: ["active opportunity"]
    }], workToSkip: [], questionsForUser: []
  };
  const input = { planningTime: "2026-07-14T12:00:00-04:00", businessState: {}, meaningfulRecentEvents: [], candidateWork: [], existingScheduledWork: [] };
  const normalized = validateShadowPlan(structuredClone(basePlan), input);
  assert.equal(normalized.workToCreate[0].schedulingWindow, "Friday end of day");
  assert.equal(normalized.workToCreate[0].scheduleNormalizedByCode, true);
  const hiddenEffort = structuredClone(basePlan);
  hiddenEffort.workToCreate[0].creatorEffortMinutes = 10;
  assert.throws(() => validateShadowPlan(hiddenEffort, input), /cannot hide creator effort/);
});
