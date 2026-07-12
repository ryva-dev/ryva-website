import assert from "node:assert/strict";
import test from "node:test";
import { appendActionAuditEvent } from "./actionPolicy.mjs";
import { createStore } from "./dataStore.mjs";
import { claimJobs, completeJob, enqueueJob, initJobQueue } from "./jobQueue.mjs";
import { proposeProfessionalInsight, publishProfessionalInsight, reviewProfessionalInsight } from "./professionalIntelligence.mjs";
import { createAgentOutput, createAgentTask, ensureAgentPermissions, listAgentOutputs, listAgentTasks, updateAgentTaskStatus } from "./agentRepository.mjs";
import { claimExternalAction, completeExternalAction } from "./externalActions.mjs";
import { getRevenueInfluenceMetrics, recordCommercialOutcome, saveBrandProfile, saveCreatorBrandOpportunity } from "./maraIntelligence.mjs";

const databaseUrl = String(process.env.TEST_DATABASE_URL ?? "").trim();

test("Postgres runs durable jobs, governed knowledge, and hash-chained audit events", { skip: !databaseUrl }, async () => {
  const store = createStore({ databaseUrl });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userId = `pg-user-${suffix}`;
  try {
    await store.execute(
      "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, 'Postgres Test', 'test', ?)",
      userId, `${userId}@example.com`, new Date().toISOString()
    );
    await initJobQueue(store);
    await enqueueJob(store, { kind: "integration_test", userId, idempotencyKey: `pg-job-${suffix}`, payload: { tenantSafe: true } });
    const [job] = await claimJobs(store, { owner: `test-${suffix}`, limit: 1 });
    assert.equal(job.payload.tenantSafe, true);
    assert.equal(await completeJob(store, job.id, `test-${suffix}`), true);

    const permissions = await ensureAgentPermissions(store, userId, "sloane-pierce");
    const task = await createAgentTask(store, {
      userId, workerId: "sloane-pierce", title: `Tenant plan ${suffix}`,
      description: "Use this tenant's actual business context.", taskType: "weekly_plan", status: "approved"
    }, permissions);
    const output = await createAgentOutput(store, {
      userId, workerId: "sloane-pierce", taskId: task.id, outputType: "weekly_plan",
      title: `Tenant output ${suffix}`, content: "Personalized work", structuredContent: { userId }, source: "integration_test"
    });
    await updateAgentTaskStatus(store, userId, "sloane-pierce", task.id, "completed", output.id);
    assert.equal((await listAgentTasks(store, userId, "sloane-pierce"))[0].status, "completed");
    assert.equal((await listAgentOutputs(store, userId, "sloane-pierce"))[0].structuredContent.userId, userId);

    const proposed = await proposeProfessionalInsight(store, {
      workerType: "mara", title: `Postgres research ${suffix}`, summary: "Verified summary.",
      content: "Verified professional content.", sourceUrl: `https://example.com/${suffix}`,
      sourcePublisher: "Integration test", evidence: ["Public evidence"]
    });
    await reviewProfessionalInsight(store, { candidateId: proposed.id, reviewer: "ci", decision: "approved" });
    const published = await publishProfessionalInsight(store, { candidateId: proposed.id });
    assert.match(published.moduleId, /^research:/);

    const first = await appendActionAuditEvent(store, { userId, workerId: "mara-vale", actionType: "research", decision: "allowed", policyVersion: "test" });
    await appendActionAuditEvent(store, { userId, workerId: "mara-vale", actionType: "research", decision: "allowed", policyVersion: "test" });
    const chained = await store.queryOne(
      "SELECT previous_event_hash AS \"previousHash\" FROM action_audit_events WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
      userId
    );
    assert.equal(chained.previousHash, first.eventHash);

    const external = await claimExternalAction(store, {
      userId,
      workerId: "mara-vale",
      actionType: "send_email",
      approvalId: `approval-${suffix}`,
      idempotencyKey: `pg-external-${suffix}`,
      request: { tenantSafe: true }
    });
    assert.equal(external.claimed, true);
    assert.equal((await claimExternalAction(store, {
      userId,
      workerId: "mara-vale",
      actionType: "send_email",
      approvalId: `approval-${suffix}`,
      idempotencyKey: `pg-external-${suffix}`
    })).claimed, false);
    assert.equal(await completeExternalAction(store, external.id, { providerId: `sent-${suffix}` }), true);

    const brand = await saveBrandProfile(store, {
      brandKey: `pg-brand-${suffix}`,
      brandName: `Postgres Brand ${suffix}`,
      profile: { priorityProducts: ["Test product"] },
      evidence: [{ basis: "observed", claim: "Public product evidence", sourceUrl: `https://example.com/brand/${suffix}` }]
    });
    const opportunity = await saveCreatorBrandOpportunity(store, {
      userId, workerId: "mara-vale", brandProfileId: brand.id,
      scores: { creatorFit: 90, commercialPotential: 80, opportunityGap: 85, outreachLikelihood: 75 },
      opportunityThesis: "Postgres-backed creator-specific fit", creativeGap: "Test gap",
      evidence: [{ basis: "observed", claim: "Observed gap" }]
    });
    await recordCommercialOutcome(store, {
      userId, workerId: "mara-vale", opportunityId: opportunity.id,
      contacted: true, responded: true, hired: true, revenueAmount: 750
    });
    assert.equal((await getRevenueInfluenceMetrics(store, userId, "mara-vale")).revenueInfluenced, 750);
  } finally {
    await store.execute("DELETE FROM mara_commercial_outcomes WHERE user_id = ?", userId).catch(() => {});
    await store.execute("DELETE FROM mara_creator_brand_opportunities WHERE user_id = ?", userId).catch(() => {});
    await store.execute("DELETE FROM mara_brand_profiles WHERE brand_key = ?", `pg-brand-${suffix}`).catch(() => {});
    await store.execute("DELETE FROM external_action_executions WHERE user_id = ?", userId).catch(() => {});
    await store.execute("DELETE FROM action_audit_events WHERE user_id = ?", userId).catch(() => {});
    await store.execute("DELETE FROM durable_jobs WHERE user_id = ?", userId).catch(() => {});
    await store.execute("DELETE FROM professional_research_candidates WHERE source_url = ?", `https://example.com/${suffix}`).catch(() => {});
    await store.execute("DELETE FROM worker_knowledge_modules WHERE title = ?", `Postgres research ${suffix}`).catch(() => {});
    await store.execute("DELETE FROM worker_outputs WHERE user_id = ?", userId).catch(() => {});
    await store.execute("DELETE FROM worker_activity_log WHERE user_id = ?", userId).catch(() => {});
    await store.execute("DELETE FROM worker_tasks WHERE user_id = ?", userId).catch(() => {});
    await store.execute("DELETE FROM worker_permissions WHERE user_id = ?", userId).catch(() => {});
    await store.execute("DELETE FROM users WHERE id = ?", userId).catch(() => {});
    await store.close();
  }
});
