import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAutonomyPlannerContext,
  computeNextRunAt,
  isRecurringDue,
  planMaraAutonomyActions
} from "./maraAutonomyPlanner.mjs";

test("computeNextRunAt schedules the next weekly run in the future", () => {
  const next = computeNextRunAt("weekly", "Monday", new Date("2026-07-08T12:00:00.000Z"));
  assert.ok(new Date(next).getTime() > Date.parse("2026-07-08T12:00:00.000Z"));
});

test("planner prioritizes maintenance and research when onboarding is complete", () => {
  const context = buildAutonomyPlannerContext({
    approvals: [],
    blockedTasks: [],
    brandResearchRemaining: 3,
    brands: [{ id: "brand-1", brandName: "Glow Theory", lastContentIdeasAt: null, lastPitchAt: null }],
    dueRecurring: [],
    hasConnectedEmail: true,
    integrations: [{ status: "connected" }],
    leadCount: 2,
    onboarding: { status: "completed" },
    outputs: [],
    permissions: { canReadInbox: true, canRunResearch: true },
    tasks: []
  });

  const actions = planMaraAutonomyActions(context);
  assert.ok(actions.some((action) => action.kind === "maintain_artifact"));
  assert.ok(actions.some((action) => action.kind === "brand_research"));
  assert.ok(actions.some((action) => action.kind === "brand_content_ideas"));
});

test("planner switches to reddit pulse when brand research cap is reached", () => {
  const context = buildAutonomyPlannerContext({
    approvals: [],
    blockedTasks: [],
    brandResearchRemaining: 0,
    brands: [],
    dueRecurring: [],
    hasConnectedEmail: false,
    integrations: [],
    leadCount: 0,
    onboarding: { status: "completed" },
    outputs: [{ outputType: "creator_positioning", createdAt: new Date().toISOString() }, { outputType: "brand_criteria", createdAt: new Date().toISOString() }],
    permissions: { canRunResearch: true },
    tasks: []
  });

  const actions = planMaraAutonomyActions(context);
  assert.ok(actions.some((action) => action.kind === "reddit_pulse"));
});

test("isRecurringDue respects next_run_at", () => {
  const due = isRecurringDue({
    cadence: "weekly",
    dayOfWeek: "Monday",
    isActive: true,
    lastRunAt: null,
    nextRunAt: new Date(Date.now() - 60_000).toISOString()
  });
  assert.equal(due, true);
});
