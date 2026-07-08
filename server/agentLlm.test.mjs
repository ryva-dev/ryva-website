import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBrandContext,
  buildChatInterpreterSystemPrompt,
  buildPlaceholderOutput,
  buildTaskExecutionUserPrompt,
  formatBrandContextForPrompt,
  parseAutonomyPlannerResponse,
  parseChatInterpreterResponse,
  renderStructuredContentToText
} from "./agentLlm.mjs";
import { getRoleConfig, getRoleTaskType } from "./roles.mjs";

const sloane = getRoleConfig("sloane-pierce");
const mara = getRoleConfig("mara-vale");

test("buildBrandContext pulls the manager's actual brand details", () => {
  const context = buildBrandContext({
    accountOnboarding: { brandName: "Glowe Studio", whatYouDo: "handmade candle UGC" },
    workerOnboardingAnswers: { approval_rules: "Never send emails without asking" },
    knowledgeSections: [
      { title: "Preferences", items: ["Short punchy hooks"] },
      { title: "Approval rules", items: ["Ask before outreach"] }
    ],
    recentOutputs: [{ title: "Positioning", outputType: "creator_positioning", createdAt: "2026-07-01" }],
    openTasks: [{ id: "t1", title: "Build rate card", taskType: "rate_card", status: "approved" }],
    integrations: [{ provider: "gmail", status: "connected" }]
  });

  assert.equal(context.brandName, "Glowe Studio");
  assert.deepEqual(context.preferences, ["Short punchy hooks"]);
  assert.deepEqual(context.connectedIntegrations, ["gmail"]);

  const prompt = formatBrandContextForPrompt(context);
  assert.match(prompt, /Glowe Studio/);
  assert.match(prompt, /handmade candle UGC/);
  assert.match(prompt, /Ask before outreach/);
});

test("brand context is honest when the brand is unknown", () => {
  const prompt = formatBrandContextForPrompt(buildBrandContext({}));
  assert.match(prompt, /not yet provided/);
  assert.match(prompt, /no external actions are possible/i);
});

test("chat interpreter parser enforces role task types and drops junk", () => {
  const parsed = parseChatInterpreterResponse(
    {
      reply: "On it — I'll evaluate that brief today.",
      tasksToCreate: [
        { title: "Evaluate the Lumos brief", taskType: "brief_evaluation", description: "Check terms", priority: "high" },
        { title: "Hack the mainframe", taskType: "not_a_real_type", description: "nope" },
        { title: "", taskType: "brief_evaluation" }
      ],
      memoriesToSave: [
        { title: "Approval rules", items: ["Never accept under $500"] },
        { title: "InvalidTitle", items: ["Goes to recent direction"] },
        { title: "Goals", items: [] }
      ],
      approvalRequests: [{ title: "Send counter-offer to Lumos", actionType: "send_email" }]
    },
    sloane
  );

  assert.equal(parsed.tasksToCreate.length, 1);
  assert.equal(parsed.tasksToCreate[0].taskType, "brief_evaluation");
  assert.equal(parsed.memoriesToSave.length, 2);
  assert.equal(parsed.memoriesToSave[1].title, "Recent direction");
  assert.equal(parsed.approvalRequests.length, 1);
});

test("chat interpreter parser rejects payloads without a reply", () => {
  assert.equal(parseChatInterpreterResponse({ tasksToCreate: [] }, sloane), null);
  assert.equal(parseChatInterpreterResponse(null, sloane), null);
});

test("planner parser only accepts safe-auto-execute types and caps at 3", () => {
  const parsed = parseAutonomyPlannerResponse(
    {
      plan: [
        { title: "Refresh rate card", taskType: "rate_card", reason: "stale" },
        { title: "A", taskType: "rate_card" },
        { title: "B", taskType: "negotiation_playbook" },
        { title: "C", taskType: "deal_memo" },
        { title: "Bogus", taskType: "made_up" }
      ],
      skippedBecause: ""
    },
    sloane
  );
  assert.equal(parsed.plan.length, 3);
  assert.ok(parsed.plan.every((entry) => entry.taskType !== "made_up"));
});

test("renderStructuredContentToText produces readable deliverable text", () => {
  const text = renderStructuredContentToText({
    generatedBy: "llm",
    headline: "hidden",
    dealSummary: "Two videos for Lumos at $1,200.",
    openQuestions: ["Usage window?", "Raw files?"],
    payment: "$1,200 net-15"
  });
  assert.match(text, /Deal Summary: Two videos for Lumos/);
  assert.match(text, /- Usage window\?/);
  assert.doesNotMatch(text, /hidden/);
  assert.doesNotMatch(text, /generatedBy/);
});

test("task execution prompt includes brand context and schema", () => {
  const brandContext = buildBrandContext({ accountOnboarding: { brandName: "Glowe Studio", whatYouDo: "candle UGC" } });
  const taskType = getRoleTaskType(mara, "creator_positioning");
  const prompt = buildTaskExecutionUserPrompt(mara, { title: "Define positioning", description: "" }, brandContext, taskType);
  assert.match(prompt, /Glowe Studio/);
  assert.match(prompt, /creatorPositioningStatement/);
  assert.match(prompt, /headline/);
});

test("chat system prompt lists only the role's task types", () => {
  const prompt = buildChatInterpreterSystemPrompt(sloane);
  assert.match(prompt, /brief_evaluation/);
  assert.doesNotMatch(prompt, /creator_positioning/);
});

test("placeholder output is honest and labeled", () => {
  const output = buildPlaceholderOutput(sloane, { title: "Evaluate brief" });
  assert.equal(output.structuredContent.generatedBy, "placeholder");
  assert.match(output.content, /could not produce the full deliverable/i);
  assert.doesNotMatch(output.content, /Deal summary/);
});
