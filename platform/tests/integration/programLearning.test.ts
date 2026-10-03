import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import request, { type Response } from "supertest";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig, resetConfigForTests } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";
import { migrate } from "../../packages/database/src/migrate.js";
import { seedSynthetic, syntheticPassword } from "../../packages/database/src/seed.js";
import { itemProgressVersion, publishedItems, ryvaProgram, type KnowledgeCheckQuestion } from "../../packages/program-content/src/index.js";
import { publishedTestProgram } from "../programFixture.js";

const configuration = loadConfig(process.env);
const database = createDatabase(configuration);
let app: ReturnType<typeof createApp>;
let moduleOneApp: ReturnType<typeof createApp>;

function csrfFrom(response: Response): string {
  const values = response.headers["set-cookie"];
  const cookies = Array.isArray(values) ? values : values ? [values] : [];
  const csrf = cookies.find((value) => value.startsWith("ryva_csrf="));
  assert.ok(csrf);
  return decodeURIComponent(csrf.split(";")[0]!.slice("ryva_csrf=".length));
}

async function login(email: string) {
  return loginTo(app, email);
}

async function loginTo(target: ReturnType<typeof createApp>, email: string) {
  const agent = request.agent(target);
  const response = await agent.post("/api/auth/login").send({ email, password: syntheticPassword });
  assert.equal(response.status, 200, response.text);
  return { agent, response, csrf: csrfFrom(response) };
}

before(async () => {
  await database.query("DROP SCHEMA public CASCADE");
  await database.query("CREATE SCHEMA public");
  await migrate(database);
  resetConfigForTests();
  await seedSynthetic();
  app = createApp({ database, configuration, program: publishedTestProgram });
  moduleOneApp = createApp({ database, configuration, program: ryvaProgram });
});

after(async () => {
  await database.end();
});

describe("Program learning access", () => {
  it("keeps paid content behind Program capabilities while preserving completed learner access", async () => {
    const accountOnly = await login("uncertified@synthetic.ryva.test");
    assert.equal((await accountOnly.agent.get("/api/program")).status, 403);
    assert.equal((await accountOnly.agent.get("/api/program/library")).status, 403);
    assert.equal((await accountOnly.agent.get("/api/program/items/test-article-1")).status, 403);

    const learner = await login("grace@synthetic.ryva.test");
    const dashboard = await learner.agent.get("/api/program");
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.program.heading, "Step inside brand placement.");
    const library = await learner.agent.get("/api/program/library");
    assert.equal(library.status, 200);
    assert.equal(library.body.resources.length, 32);
    assert.equal(library.body.resources[0].title, "Brand Placement Glossary");

    const proInactive = await login("canceled-ended@synthetic.ryva.test");
    assert.equal(proInactive.response.body.access.canAccessOperatingPlatform, false);
    assert.equal((await proInactive.agent.get("/api/program")).status, 200);

    const staff = await login("mentor-readonly@synthetic.ryva.test");
    assert.equal(staff.response.body.access.reason, "staff");
    assert.equal((await staff.agent.get("/api/program")).status, 403);
  });
});

function reviewResponse(question: KnowledgeCheckQuestion): string | string[] {
  if (question.type === "single_choice") return question.options[0]!.id;
  if (question.type === "multiple_select") return [question.options[0]!.id];
  if (question.type === "true_false") return "true";
  if (question.type === "numeric_calculation") return String(question.answer.value);
  if (question.type === "ordering") return question.options.map((option) => option.id);
  return question.left.map((left, index) => `${left.id}:${question.right[index]!.id}`);
}

describe("Published Module 1", () => {
  it("protects content, evaluates retryable knowledge checks, persists exercise feedback, and unlocks Module 2 without completing the Program", async () => {
    const accountOnly = await loginTo(moduleOneApp, "uncertified@synthetic.ryva.test");
    assert.equal((await accountOnly.agent.get("/api/program/modules/inside-brand-placement")).status, 403);
    assert.equal((await accountOnly.agent.get("/api/program/items/what-brand-placement-is")).status, 403);

    const learner = await loginTo(moduleOneApp, "grace@synthetic.ryva.test");
    const userId = learner.response.body.user.id as string;
    assert.equal(learner.response.body.access.canAccessOperatingPlatform, false);
    const moduleResponse = await learner.agent.get("/api/program/modules/inside-brand-placement");
    assert.equal(moduleResponse.status, 200, moduleResponse.text);
    assert.equal(moduleResponse.body.module.title, "Inside Brand Placement");
    assert.equal(moduleResponse.body.module.requiredItems, 13);
    assert.equal(moduleResponse.body.module.items.filter((item: { type: string }) => item.type === "knowledge_check").length, 6);

    const before = await learner.agent.get("/api/program/items/knowledge-check-1-1");
    assert.equal(before.status, 200, before.text);
    assert.equal(before.body.submission, null);
    assert.equal(before.body.item.knowledgeCheck.questions.length, 3);
    assert.doesNotMatch(JSON.stringify(before.body.item), /"answer":/);
    assert.equal(JSON.stringify(before.body.item).includes("commercial-relationship"), true);
    assert.equal(JSON.stringify(before.body.item).includes("Visual appeal is only one part"), false);

    const withoutCsrf = await learner.agent
      .post("/api/program/items/module-1-check-1-1/submissions")
      .send({ steps: { "knowledge-check": {} } });
    assert.equal(withoutCsrf.status, 403);

    const invalidMultipleSelect = await learner.agent
      .post("/api/program/items/module-1-check-1-1/submissions")
      .set("x-csrf-token", learner.csrf)
      .send({
        steps: {
          "knowledge-check": {
            "brand-placement-definition": "commercial-relationship",
            "retailer-fit": ["customer-profile", "customer-profile"],
            "appearance-equals-placement": "false"
          }
        }
      });
    assert.equal(invalidMultipleSelect.status, 422, invalidMultipleSelect.text);

    const firstAttempt = await learner.agent
      .post("/api/program/items/module-1-check-1-1/submissions")
      .set("x-csrf-token", learner.csrf)
      .send({
        steps: {
          "knowledge-check": {
            "brand-placement-definition": "consumer-advertising",
            "retailer-fit": ["commission-rate", "prospect-list-order"],
            "appearance-equals-placement": "true"
          }
        }
      });
    assert.equal(firstAttempt.status, 201, firstAttempt.text);
    assert.equal(firstAttempt.body.programCompletion, null);
    assert.deepEqual(firstAttempt.body.knowledgeFeedback.questions.map((entry: { outcome: string }) => entry.outcome), ["review", "review", "review"]);
    assert.deepEqual(firstAttempt.body.knowledgeFeedback.questions.map((entry: { heading: string }) => entry.heading), ["Not quite", "Not quite", "Not quite"]);

    const secondAttempt = await learner.agent
      .post("/api/program/items/module-1-check-1-1/submissions")
      .set("x-csrf-token", learner.csrf)
      .send({
        steps: {
          "knowledge-check": {
            "brand-placement-definition": "commercial-relationship",
            "retailer-fit": ["customer-profile", "assortment", "price-architecture", "category-needs", "inventory-strategy", "commercial-priorities"],
            "appearance-equals-placement": "false"
          }
        }
      });
    assert.equal(secondAttempt.status, 201, secondAttempt.text);
    assert.deepEqual(secondAttempt.body.knowledgeFeedback.questions.map((entry: { outcome: string }) => entry.outcome), ["aligned", "aligned", "aligned"]);
    assert.deepEqual(secondAttempt.body.knowledgeFeedback.questions.map((entry: { heading: string }) => entry.heading), ["Correct", "Correct", "Correct"]);
    const attemptCount = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM program_activity_submissions WHERE user_id=$1 AND learning_item_id=$2",
      [userId, "module-1-check-1-1"]
    );
    assert.equal(attemptCount.rows[0]!.count, 2);
    const restored = await learner.agent.get("/api/program/items/knowledge-check-1-1");
    assert.deepEqual(restored.body.submission.knowledgeFeedback.questions.map((entry: { outcome: string }) => entry.outcome), ["aligned", "aligned", "aligned"]);
    assert.deepEqual(restored.body.submission.response.steps["knowledge-check"]["retailer-fit"], ["customer-profile", "assortment", "price-architecture", "category-needs", "inventory-strategy", "commercial-priorities"]);

    const exercise = await learner.agent
      .post("/api/program/items/module-1-map-the-relationship/submissions")
      .set("x-csrf-token", learner.csrf)
      .send({ steps: { "relationship-map": {
        brand: "lumen-ritual",
        representative: "independent-representative",
        retailer: "forma-beauty",
        buyer: "forma-buyer",
        product: "facial-oil",
        stage: "buyer-review",
        "next-information": "I would confirm tester support, opening minimums, replenishment, and the retailer's category needs."
      } } });
    assert.equal(exercise.status, 201, exercise.text);
    assert.deepEqual(exercise.body.considerations, [
      "A buyer request is not yet an order.",
      "Product interest and account fit are related but different.",
      "The representative needs both brand context and retailer context.",
      "The next useful action depends on what information is missing."
    ]);
    const exerciseReload = await learner.agent.get("/api/program/items/map-the-relationship");
    assert.deepEqual(exerciseReload.body.submission.considerations, exercise.body.considerations);

    const otherLearner = await loginTo(moduleOneApp, "active@synthetic.ryva.test");
    const isolatedExercise = await otherLearner.agent.get("/api/program/items/map-the-relationship");
    assert.equal(isolatedExercise.status, 200);
    assert.equal(isolatedExercise.body.submission, null);

    const preview = await learner.agent.get("/api/program/items/ryva-workspace-preview-commercial-map");
    assert.equal(preview.status, 200);
    const previewBlock = preview.body.item.blocks.find((block: { type: string }) => block.type === "workspace_preview");
    assert.equal(previewBlock.areas.length, 15);
    assert.equal(previewBlock.eyebrow, "Read-only Program simulation");
    assert.equal((await learner.agent.post("/api/program/items/module-1-ryva-commercial-map/preview/placements").set("x-csrf-token", learner.csrf)).status, 404);
    assert.equal((await learner.agent.get("/api/home")).status, 403);

    for (const item of ryvaProgram.modules[0]!.items.filter((entry) => entry.status === "published" && entry.required)) {
      if (item.id === "module-1-check-1-1" || item.id === "module-1-map-the-relationship") continue;
      if (item.type === "knowledge_check") {
        const responses = Object.fromEntries(item.knowledgeCheck!.questions.map((question) => [question.id, reviewResponse(question)]));
        const response = await learner.agent
          .post(`/api/program/items/${item.id}/submissions`)
          .set("x-csrf-token", learner.csrf)
          .send({ steps: { "knowledge-check": responses } });
        assert.equal(response.status, 201, `${item.id}: ${response.text}`);
      } else {
        const response = await learner.agent
          .post(`/api/program/items/${item.id}/complete`)
          .set("x-csrf-token", learner.csrf);
        assert.equal(response.status, 200, `${item.id}: ${response.text}`);
      }
    }

    const finishedModule = await learner.agent.get("/api/program");
    assert.equal(finishedModule.body.modules[0].state, "completed");
    assert.equal(finishedModule.body.modules[1].state, "current");
    assert.equal(finishedModule.body.progress.completedRequiredItems, 13);
    assert.equal(finishedModule.body.progress.totalRequiredItems, 128);
    assert.equal(finishedModule.body.progress.completionConfigured, true);
    assert.equal(finishedModule.body.programCompletedAt, null);
    assert.equal(finishedModule.body.finalSimulation.state, "locked");
    assert.equal(finishedModule.body.finalAssessment.state, "locked");
    assert.equal((await learner.agent.get("/api/program/modules/brands-products-assortment")).status, 200);
    const entitlement = await database.query<{ completed_at: Date | null }>(
      "SELECT completed_at FROM program_entitlements WHERE user_id=$1",
      [userId]
    );
    assert.equal(entitlement.rows[0]!.completed_at, null);
    const completionAudit = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM audit_events WHERE actor_user_id=$1 AND action='program.completed'",
      [userId]
    );
    assert.equal(completionAudit.rows[0]!.count, 0);
  });
});

describe("Final Brand Placement Assessment", () => {
  it("serves a weighted 50-question attempt without answers and completes only at the 80% threshold", async () => {
    const learner = await loginTo(moduleOneApp, "active@synthetic.ryva.test");
    const userId = learner.response.body.user.id as string;
    const prerequisites = publishedItems(ryvaProgram).filter((item) => item.required && item.id !== "final-assessment");
    for (const item of prerequisites) {
      await database.query(
        `INSERT INTO program_item_progress
          (id,user_id,learning_item_id,content_version,started_at,completed_at,last_viewed_at)
         VALUES ($1,$2,$3,$4,clock_timestamp(),clock_timestamp(),clock_timestamp())
         ON CONFLICT (user_id,learning_item_id,content_version) DO UPDATE SET completed_at=clock_timestamp()`,
        [randomUUID(), userId, item.id, itemProgressVersion(item)]
      );
    }

    const dashboard = await learner.agent.get("/api/program");
    assert.equal(dashboard.status, 200, dashboard.text);
    assert.equal(dashboard.body.finalAssessment.state, "available");

    const assessment = await learner.agent.get("/api/program/items/final-assessment");
    assert.equal(assessment.status, 200, assessment.text);
    assert.equal(assessment.body.item.knowledgeCheck.questions.length, 50);
    assert.doesNotMatch(JSON.stringify(assessment.body.item), /"answer":/);
    const domainCounts = assessment.body.item.knowledgeCheck.questions.reduce((counts: Record<string, number>, question: { domain: string }) => {
      counts[question.domain] = (counts[question.domain] ?? 0) + 1;
      return counts;
    }, {});
    assert.deepEqual(domainCounts, {
      foundations: 5,
      brands_products: 6,
      pricing_math: 8,
      buyers_accounts: 6,
      placement_strategy: 5,
      outreach: 5,
      orders_reorders: 6,
      account_performance: 4,
      commissions: 3,
      ryva_workflow: 2
    });

    const firstQuestions = assessment.body.item.knowledgeCheck.questions as Array<{ id: string; type: string; options?: Array<{ id: string }>; left?: Array<{ id: string }>; right?: Array<{ id: string }> }>;
    const reviewAnswers = Object.fromEntries(firstQuestions.map((question) => {
      if (question.type === "single_choice") return [question.id, question.options![0]!.id];
      if (question.type === "multiple_select") return [question.id, [question.options![0]!.id]];
      if (question.type === "true_false") return [question.id, "true"];
      if (question.type === "numeric_calculation") return [question.id, "0"];
      if (question.type === "ordering") return [question.id, question.options!.map((option) => option.id)];
      return [question.id, question.left!.map((left, index) => `${left.id}:${question.right![index]!.id}`)];
    }));
    const review = await learner.agent
      .post("/api/program/items/final-assessment/submissions")
      .set("x-csrf-token", learner.csrf)
      .send({ steps: { "knowledge-check": reviewAnswers } });
    assert.equal(review.status, 201, review.text);
    assert.equal(review.body.assessmentResult.passed, false);
    assert.equal(review.body.assessmentResult.heading, "Review recommended before your next attempt.");
    assert.equal(review.body.programCompletion, null);

    const reshuffled = await learner.agent.get("/api/program/items/final-assessment");
    const secondQuestions = reshuffled.body.item.knowledgeCheck.questions as Array<{ id: string }>;
    assert.notDeepEqual(secondQuestions.map((question) => question.id), firstQuestions.map((question) => question.id));
    assert.equal(reshuffled.body.submission.assessmentResult.passed, false);

    const staleRetake = await learner.agent
      .post("/api/program/items/final-assessment/submissions")
      .set("x-csrf-token", learner.csrf)
      .send({ steps: { "knowledge-check": reviewAnswers } });
    assert.equal(staleRetake.status, 422, staleRetake.text);
    assert.equal(staleRetake.body.title, "Question 1 needs a complete answer.");

    const bank = new Map(ryvaProgram.finalAssessment!.assessment!.questions.map((question) => [question.id, question]));
    const answers = Object.fromEntries(secondQuestions.map((question: { id: string }) => {
      const privateQuestion = bank.get(question.id)!;
      if (privateQuestion.type === "single_choice") return [question.id, privateQuestion.answer.optionId];
      if (privateQuestion.type === "multiple_select") return [question.id, privateQuestion.answer.optionIds];
      if (privateQuestion.type === "true_false") return [question.id, String(privateQuestion.answer.value)];
      if (privateQuestion.type === "numeric_calculation") return [question.id, String(privateQuestion.answer.value)];
      if (privateQuestion.type === "ordering") return [question.id, privateQuestion.answer.optionIds];
      return [question.id, privateQuestion.left.map((left) => `${left.id}:${privateQuestion.answer.matches[left.id]}`)];
    }));
    const submitted = await learner.agent
      .post("/api/program/items/final-assessment/submissions")
      .set("x-csrf-token", learner.csrf)
      .send({ steps: { "knowledge-check": answers } });
    assert.equal(submitted.status, 201, submitted.text);
    assert.equal(submitted.body.assessmentResult.score, 100);
    assert.equal(submitted.body.assessmentResult.passed, true);
    assert.equal(submitted.body.assessmentResult.attemptNumber, 2);
    assert.equal(submitted.body.assessmentResult.performance.length, 10);
    assert.ok(submitted.body.programCompletion);
  });
});

describe("Program progression and completion", () => {
  it("persists authoritative progress and triggers the P0B completion operation exactly once", async () => {
    const { agent, csrf, response: loginResponse } = await login("grace@synthetic.ryva.test");
    const userId = loginResponse.body.user.id as string;

    const initial = await agent.get("/api/program");
    assert.equal(initial.body.progress.totalRequiredItems, 4);
    assert.equal(initial.body.progress.percentage, 0);
    assert.equal(initial.body.modules[0].state, "current");
    assert.equal(initial.body.modules[1].state, "locked");
    assert.equal(initial.body.modules[0].items.some((item: { id: string }) => item.id === "test-draft-1"), false);
    assert.equal((await agent.get("/api/program/modules/brands-products-assortment")).status, 403);
    assert.equal((await agent.get("/api/program/items/test-draft-1")).status, 404);

    const invalidCalculation = await agent
      .post("/api/program/items/test-numeric-check/submissions")
      .set("x-csrf-token", csrf)
      .send({ steps: { "knowledge-check": { "numeric-answer": "not-a-number" } } });
    assert.equal(invalidCalculation.status, 422, invalidCalculation.text);
    const calculationReview = await agent
      .post("/api/program/items/test-numeric-check/submissions")
      .set("x-csrf-token", csrf)
      .send({ steps: { "knowledge-check": { "numeric-answer": "10" } } });
    assert.equal(calculationReview.status, 201, calculationReview.text);
    assert.equal(calculationReview.body.knowledgeFeedback.questions[0].heading, "Not quite");
    const calculationCorrect = await agent
      .post("/api/program/items/test-numeric-check/submissions")
      .set("x-csrf-token", csrf)
      .send({ steps: { "knowledge-check": { "numeric-answer": "12.5" } } });
    assert.equal(calculationCorrect.status, 201, calculationCorrect.text);
    assert.equal(calculationCorrect.body.knowledgeFeedback.questions[0].heading, "Correct");

    const noCsrf = await agent.post("/api/program/items/test-article-1/complete");
    assert.equal(noCsrf.status, 403);

    const forgedTimestamp = "1999-01-01T00:00:00.000Z";
    const firstCompletion = await agent
      .post("/api/program/items/test-article-1/complete")
      .set("x-csrf-token", csrf)
      .send({ completedAt: forgedTimestamp, percentage: 100 });
    assert.equal(firstCompletion.status, 200, firstCompletion.text);
    assert.notEqual(firstCompletion.body.progress.completedAt, forgedTimestamp);
    const repeatedCompletion = await agent
      .post("/api/program/items/test-article-1/complete")
      .set("x-csrf-token", csrf)
      .send({ completedAt: new Date().toISOString() });
    assert.equal(repeatedCompletion.status, 200);
    assert.equal(repeatedCompletion.body.progress.completedAt, firstCompletion.body.progress.completedAt);

    const afterArticle = await agent.get("/api/program/progress");
    assert.equal(afterArticle.body.progress.percentage, 25);
    assert.equal(afterArticle.body.modules[1].state, "locked");

    const activityShortcut = await agent
      .post("/api/program/items/test-exercise-1/complete")
      .set("x-csrf-token", csrf);
    assert.equal(activityShortcut.status, 409);
    const missingResponse = await agent
      .post("/api/program/items/test-exercise-1/submissions")
      .set("x-csrf-token", csrf)
      .send({ steps: {} });
    assert.equal(missingResponse.status, 422);
    const exercise = await agent
      .post("/api/program/items/test-exercise-1/submissions")
      .set("x-csrf-token", csrf)
      .send({
        userId: "10000000-0000-4000-8000-000000000001",
        steps: { "fit-step": { reasoning: "Retail fit and the buyer's assortment context deserve attention." } }
      });
    assert.equal(exercise.status, 201, exercise.text);
    assert.deepEqual(exercise.body.considerations, ["Retail fit depends on context, not one isolated product attribute."]);

    const submissionOwner = await database.query<{ user_id: string }>(
      "SELECT user_id FROM program_activity_submissions WHERE id=$1",
      [exercise.body.submissionId]
    );
    assert.equal(submissionOwner.rows[0]!.user_id, userId);
    assert.equal((await agent.get("/api/program/modules/brands-products-assortment")).status, 200);
    const afterExercise = await agent.get("/api/program/progress");
    assert.equal(afterExercise.body.progress.percentage, 50);

    const moduleTwo = await agent
      .post("/api/program/items/test-article-2/complete")
      .set("x-csrf-token", csrf)
      .send({ percentage: 100 });
    assert.equal(moduleTwo.status, 200);
    assert.equal((await agent.get("/api/program/items/test-article-1")).status, 200);
    const beforeFinal = await agent.get("/api/program");
    assert.equal(beforeFinal.body.progress.percentage, 75);
    assert.equal(beforeFinal.body.finalSimulation.state, "available");
    assert.equal(beforeFinal.body.programCompletedAt, null);

    const finalShortcut = await agent
      .post("/api/program/items/test-final-simulation/complete")
      .set("x-csrf-token", csrf);
    assert.equal(finalShortcut.status, 409);
    const final = await agent
      .post("/api/program/items/test-final-simulation/submissions")
      .set("x-csrf-token", csrf)
      .send({ steps: { "final-step": { next: "Follow-through, reorder context, and the account's changing needs." } } });
    assert.equal(final.status, 201, final.text);
    assert.equal(final.body.access.canAccessOperatingPlatform, true);
    assert.equal(final.body.access.isProTrialActive, true);
    assert.equal(final.body.programCompletion.newlyCompleted, true);

    const entitlement = await database.query<{
      completed_at: Date;
      pro_trial_started_at: Date;
      pro_trial_ends_at: Date;
    }>(
      "SELECT completed_at,pro_trial_started_at,pro_trial_ends_at FROM program_entitlements WHERE user_id=$1",
      [userId]
    );
    const firstEntitlement = entitlement.rows[0]!;
    assert.equal(firstEntitlement.completed_at.toISOString(), final.body.programCompletion.completedAt);
    assert.equal(firstEntitlement.pro_trial_started_at.toISOString(), final.body.programCompletion.trialStartedAt);
    assert.equal(firstEntitlement.pro_trial_ends_at.toISOString(), final.body.programCompletion.trialEndsAt);

    const repeatedFinal = await agent
      .post("/api/program/items/test-final-simulation/submissions")
      .set("x-csrf-token", csrf)
      .send({ steps: { "final-step": { next: "Continue observing the connected commercial relationship." } } });
    assert.equal(repeatedFinal.status, 201);
    assert.equal(repeatedFinal.body.programCompletion.newlyCompleted, false);
    assert.equal(repeatedFinal.body.programCompletion.completedAt, final.body.programCompletion.completedAt);
    assert.equal(repeatedFinal.body.programCompletion.trialEndsAt, final.body.programCompletion.trialEndsAt);

    const programAudit = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM audit_events WHERE actor_user_id=$1 AND action='program.completed'",
      [userId]
    );
    assert.equal(programAudit.rows[0]!.count, 1);
    const finished = await agent.get("/api/program");
    assert.equal(finished.body.progress.percentage, 100);
    assert.ok(finished.body.programCompletedAt);

    const otherLearner = await login("active@synthetic.ryva.test");
    const isolated = await otherLearner.agent.get("/api/program");
    assert.equal(isolated.body.progress.percentage, 0);

    await database.query(
      `UPDATE program_entitlements SET
         completed_at=now()-interval '31 days',
         pro_trial_started_at=now()-interval '31 days',
         pro_trial_ends_at=now()-interval '1 day'
       WHERE user_id=$1`,
      [userId]
    );
    await database.query("DELETE FROM subscription_entitlements WHERE user_id=$1", [userId]);
    assert.equal((await agent.get("/api/program")).status, 200);
    assert.equal((await agent.get("/api/home")).status, 403);
  });
});
