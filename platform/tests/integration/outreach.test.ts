import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request, { type Response } from "supertest";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig, resetConfigForTests } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";
import { migrate } from "../../packages/database/src/migrate.js";
import { seedSynthetic, syntheticPassword } from "../../packages/database/src/seed.js";
import {
  processOutreachProviderEvent,
  processOutreachSend,
  type EmailDeliveryProvider
} from "../../packages/domain/src/index.js";
import { newId } from "../../packages/shared/src/index.js";

const configuration = loadConfig(process.env);
const database = createDatabase(configuration);
let app: ReturnType<typeof createApp>;
type Agent = ReturnType<typeof request.agent>;

const fixture: Record<string, string> = {};

function csrfFrom(response: Response): string {
  const values = response.headers["set-cookie"];
  const cookies = Array.isArray(values) ? values : values ? [values] : [];
  const csrf = cookies.find((value) => value.startsWith("ryva_csrf="));
  assert.ok(csrf);
  return decodeURIComponent(csrf.split(";")[0]!.slice("ryva_csrf=".length));
}

async function login() {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({
    email: "active@synthetic.ryva.test",
    password: syntheticPassword
  });
  assert.equal(response.status, 200, response.text);
  return {
    agent,
    csrf: csrfFrom(response),
    workspaceId: response.body.user.workspaceId as string,
    userId: response.body.user.id as string
  };
}

async function core(
  agent: Agent,
  csrf: string,
  type: string,
  values: Record<string, unknown>
): Promise<{ id: string }> {
  const response = await agent.post(`/api/records/${type}`).set("x-csrf-token", csrf).send(values);
  assert.equal(response.status, 201, response.text);
  return response.body.record as { id: string };
}

async function makeDraft(
  agent: Agent,
  csrf: string,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const response = await agent.post("/api/outreach").set("x-csrf-token", csrf).send({
    placementId: fixture.placementId,
    contactId: fixture.contactId,
    channel: "email",
    senderAddress: "active@synthetic.ryva.test",
    recipientAddress: "buyer@synthetic.ryva.test",
    subject: "Synthetic assortment review",
    body: "Hello Synthetic Buyer. Please review this opportunity. Reply or opt out at any time.",
    productIds: [fixture.productId],
    claimLinks: [{
      claimText: "The product has a verified synthetic specification.",
      productId: fixture.productId,
      evidenceId: fixture.evidenceId
    }],
    attachmentIds: [],
    ...overrides
  });
  assert.equal(response.status, 201, response.text);
  return response.body.message.id as string;
}

async function approve(agent: Agent, csrf: string, messageId: string): Promise<string> {
  const requested = await agent.post(`/api/outreach/${messageId}/approval`)
    .set("x-csrf-token", csrf).send();
  assert.equal(requested.status, 201, requested.text);
  const approvalId = requested.body.approval.id as string;
  const decided = await agent.post(`/api/outreach/${messageId}/approval/${approvalId}`)
    .set("x-csrf-token", csrf)
    .send({ decision: "approved", conditions: "Exact artifact only." });
  assert.equal(decided.status, 200, decided.text);
  return approvalId;
}

before(async () => {
  await database.query("DROP SCHEMA public CASCADE");
  await database.query("CREATE SCHEMA public");
  await migrate(database);
  resetConfigForTests();
  await seedSynthetic();
  app = createApp({ database, configuration });
  const { agent, csrf, workspaceId, userId } = await login();
  fixture.workspaceId = workspaceId;
  fixture.userId = userId;
  const brand = await core(agent, csrf, "brand", { name: "Synthetic Outreach Brand" });
  const product = await core(agent, csrf, "product", {
    brandId: brand.id, name: "Synthetic Outreach Product", category: "Gift"
  });
  const business = await core(agent, csrf, "business", {
    name: "Synthetic Outreach Buyer", businessType: "gift_shop", category: "Gift"
  });
  const contact = await core(agent, csrf, "contact", {
    parentType: "business", parentId: business.id, name: "Synthetic Buyer",
    role: "Buyer", email: "buyer@synthetic.ryva.test"
  });
  fixture.brandId = brand.id;
  fixture.productId = product.id;
  fixture.businessId = business.id;
  fixture.contactId = contact.id;
  await database.query("UPDATE products SET status='qualified' WHERE id=$1", [product.id]);
  await database.query(
    `UPDATE businesses SET qualification_status='qualified',geography='{"country":"US"}' WHERE id=$1`,
    [business.id]
  );
  await database.query(
    "UPDATE contacts SET verification_status='verified',permission_status='professional_purpose' WHERE id=$1",
    [contact.id]
  );
  const decisionId = newId();
  await database.query(
    `INSERT INTO decision_records
      (id,workspace_id,subject_type,subject_id,question,scope,outcome,rationale,confidence,
       owner_user_id,decided_at,next_action,status)
     VALUES($1,$2,'business',$3,'Proceed?','Synthetic Phase 5 fixture','Proceed',
            'Human-owned synthetic decision.','supported',$4,now(),'Prepare outreach','issued')`,
    [decisionId, workspaceId, business.id, userId]
  );
  const opportunityId = newId();
  await database.query(
    `INSERT INTO representation_opportunities
      (id,workspace_id,brand_id,owner_user_id,stage,proposed_channels,proposed_territory,
       brand_objectives,decision_id)
     VALUES($1,$2,$3,$4,'converted',ARRAY['independent_retail'],'{"countries":["US"]}',
            'Synthetic authorized outreach',$5)`,
    [opportunityId, workspaceId, brand.id, userId, decisionId]
  );
  const documentId = newId();
  await database.query(
    `INSERT INTO documents
      (id,workspace_id,subject_type,subject_id,owner_user_id,name,document_type,media_type,
       byte_size,storage_key,sha256,scan_status,confidentiality,status)
     VALUES($1,$2,'representation_opportunity',$3,$4,'synthetic-agreement.pdf',
            'representation_agreement_original','application/pdf',10,$5,$6,'clean','restricted','active')`,
    [documentId, workspaceId, opportunityId, userId, `${workspaceId}/${documentId}`, "a".repeat(64)]
  );
  const agreementId = newId();
  const agreementApprovalId = newId();
  await database.query(
    `INSERT INTO human_approvals
      (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,
       approver_user_id,status,scope,decided_at)
     VALUES($1,$2,'representation_agreement',$3,'activate_representation_agreement',
            'synthetic-authority-digest',$4,'approved','Synthetic written scope',now())`,
    [agreementApprovalId, workspaceId, agreementId, userId]
  );
  await database.query(
    `INSERT INTO representation_agreements
      (id,workspace_id,representation_opportunity_id,brand_id,representative_user_id,status,
       source_document_id,effective_at,expires_at,channels,territory_scope,authority_summary,
       legal_ambiguity_status,approval_id,authority_digest,approved_by,approved_at)
     VALUES($1,$2,$3,$4,$5,'active',$6,now()-interval '1 day',now()+interval '1 year',
            ARRAY['independent_retail'],'{"countries":["US"]}','Synthetic authority',
            'none',$7,'synthetic-authority-digest',$5,now())`,
    [agreementId, workspaceId, opportunityId, brand.id, userId, documentId, agreementApprovalId]
  );
  await database.query(
    `INSERT INTO representation_agreement_products(agreement_id,workspace_id,product_id)
     VALUES($1,$2,$3)`,
    [agreementId, workspaceId, product.id]
  );
  const placementId = newId();
  await database.query(
    `INSERT INTO placement_opportunities
      (id,workspace_id,agreement_id,brand_id,business_id,owner_user_id,stage,authority_channel,
       match_thesis,buyer_value_basis,evidence_confidence,decision_id,conflict_status)
     VALUES($1,$2,$3,$4,$5,$6,'prepared','independent_retail',
            'Synthetic supported fit','Synthetic Buyer value','supported',$7,'clear')`,
    [placementId, workspaceId, agreementId, brand.id, business.id, userId, decisionId]
  );
  await database.query(
    `INSERT INTO placement_opportunity_products(placement_opportunity_id,workspace_id,product_id)
     VALUES($1,$2,$3)`,
    [placementId, workspaceId, product.id]
  );
  const sourceId = newId();
  await database.query(
    `INSERT INTO sources
      (id,workspace_id,source_type,reference,owner_or_provider,rights_classification,
       confidentiality,status,created_by)
     VALUES($1,$2,'synthetic_spec','Synthetic source','Synthetic fixture','owned',
            'normal','active',$3)`,
    [sourceId, workspaceId, userId]
  );
  const evidenceId = newId();
  await database.query(
    `INSERT INTO evidence_records
      (id,workspace_id,subject_type,subject_id,exact_claim,evidence_class,
       verification_status,source_id,confidence,permitted_use,reviewed_by,status)
     VALUES($1,$2,'product',$3,'Synthetic specification','verified_fact',
            'verified',$4,'strong','Buyer-specific outreach',$5,'current')`,
    [evidenceId, workspaceId, product.id, sourceId, userId]
  );
  fixture.agreementId = agreementId;
  fixture.placementId = placementId;
  fixture.evidenceId = evidenceId;
});

after(async () => {
  await database.end();
});

describe("Phase 5 Outreach Center", () => {
  it("OUT-001/002 binds approval to exact recipient, content, sender, channel, attachments and timing", async () => {
    const { agent, csrf } = await login();
    const messageId = await makeDraft(agent, csrf);
    const approvalId = await approve(agent, csrf, messageId);
    const detail = await agent.get(`/api/outreach/${messageId}`);
    const edited = await agent.patch(`/api/outreach/${messageId}`).set("x-csrf-token", csrf).send({
      version: detail.body.message.version,
      recipientAddress: "other@synthetic.ryva.test",
      senderAddress: detail.body.message.senderAddress,
      subject: detail.body.message.subject,
      body: detail.body.message.body,
      scheduledAt: null
    });
    assert.equal(edited.status, 200, edited.text);
    assert.equal(edited.body.message.status, "draft");
    assert.equal(edited.body.message.approvalId, null);
    const prior = await database.query<{ status: string }>(
      "SELECT status FROM human_approvals WHERE id=$1", [approvalId]
    );
    assert.equal(prior.rows[0]!.status, "expired");
    const send = await agent.post(`/api/outreach/${messageId}/send`).set("x-csrf-token", csrf).send();
    assert.equal(send.status, 409);
  });

  it("OUT-004/005 records one provider-accepted Email and Activity and retries idempotently", async () => {
    const { agent, csrf, workspaceId, userId } = await login();
    const messageId = await makeDraft(agent, csrf);
    await approve(agent, csrf, messageId);
    const queued = await agent.post(`/api/outreach/${messageId}/send`).set("x-csrf-token", csrf).send();
    assert.equal(queued.status, 202, queued.text);
    let sends = 0;
    const provider: EmailDeliveryProvider = {
      send() {
        sends += 1;
        return Promise.resolve({
          status: "accepted" as const,
          providerMessageId: "synthetic-provider-accepted-1"
        });
      }
    };
    const first = await processOutreachSend(database, provider, { workspaceId, messageId, actorUserId: userId });
    assert.equal(first.status, "accepted");
    const second = await processOutreachSend(database, provider, { workspaceId, messageId, actorUserId: userId });
    assert.equal(second.idempotent, true);
    assert.equal(sends, 1);
    const counts = await database.query<{ emails: number; activities: number }>(
      `SELECT
        (SELECT count(*)::int FROM outreach_messages WHERE id=$1 AND status='accepted') AS emails,
        (SELECT count(*)::int FROM activities WHERE metadata->>'outreachMessageId'=$1::text) AS activities`,
      [messageId]
    );
    assert.deepEqual(counts.rows[0], { emails: 1, activities: 1 });
    const placement = await database.query<{ stage: string }>(
      "SELECT stage FROM placement_opportunities WHERE id=$1", [fixture.placementId]
    );
    assert.equal(placement.rows[0]!.stage, "contacted");
  });

  it("OUT-003/007 suppresses opt-outs, stops sequences, and handles provider replay once", async () => {
    const { agent, csrf, workspaceId } = await login();
    const template = await agent.post("/api/outreach/templates").set("x-csrf-token", csrf).send({
      name: "Synthetic Follow-up", channel: "email", purpose: "Synthetic acceptance",
      subject: "Hello {{buyer_name}}",
      body: "Hello {{buyer_name}}. Reply or opt out.",
      requiredVariables: ["buyer_name"], requiredComplianceBlocks: ["opt_out"]
    });
    assert.equal(template.status, 201, template.text);
    const sequence = await agent.post("/api/outreach/sequences").set("x-csrf-token", csrf).send({
      name: "Synthetic Human Sequence", purpose: "Test stop rules",
      steps: [{ stepType: "email", delayMinutes: 60,
        templateVersionId: template.body.template.versionId,
        instructions: "Human review and exact approval required." }]
    });
    assert.equal(sequence.status, 201, sequence.text);
    const enrollment = await agent.post(`/api/outreach/sequences/${sequence.body.sequence.id}/enroll`)
      .set("x-csrf-token", csrf).send({ placementId: fixture.placementId, contactId: fixture.contactId });
    assert.equal(enrollment.status, 201, enrollment.text);
    const processed = await processOutreachProviderEvent(database, {
      providerEventId: "synthetic-optout-event-1",
      providerMessageId: "synthetic-provider-accepted-1",
      eventType: "opted_out",
      payloadDigest: "synthetic-payload",
      requestId: "synthetic-webhook-1"
    });
    assert.equal(processed.processed, true);
    const replay = await processOutreachProviderEvent(database, {
      providerEventId: "synthetic-optout-event-1",
      providerMessageId: "synthetic-provider-accepted-1",
      eventType: "opted_out",
      payloadDigest: "synthetic-payload",
      requestId: "synthetic-webhook-2"
    });
    assert.deepEqual(replay, { processed: false, reason: "duplicate" });
    const state = await database.query<{ permission: string; enrollment: string; suppressions: number }>(
      `SELECT
        (SELECT permission_status FROM contacts WHERE id=$1) AS permission,
        (SELECT status FROM outreach_sequence_enrollments WHERE id=$2) AS enrollment,
        (SELECT count(*)::int FROM communication_suppressions
          WHERE workspace_id=$3 AND contact_id=$1 AND status='active') AS suppressions`,
      [fixture.contactId, enrollment.body.enrollment.id, workspaceId]
    );
    assert.deepEqual(state.rows[0], { permission: "opted_out", enrollment: "stopped", suppressions: 1 });
    const blocked = await makeDraft(agent, csrf);
    const approval = await agent.post(`/api/outreach/${blocked}/approval`).set("x-csrf-token", csrf).send();
    assert.equal(approval.status, 409);
    assert.ok(String(approval.body.type).endsWith("/outreach_suppressed"));
  });

  it("OUT-008 revalidates Product evidence instead of reusing stale template or message approval", async () => {
    await database.query(
      "UPDATE contacts SET permission_status='professional_purpose',opted_out_at=NULL WHERE id=$1",
      [fixture.contactId]
    );
    await database.query(
      `UPDATE communication_suppressions SET status='corrected',corrected_at=now(),
              corrected_reason='Synthetic reset',correction_evidence='Test fixture'
        WHERE contact_id=$1 AND status='active'`,
      [fixture.contactId]
    );
    const { agent, csrf } = await login();
    const messageId = await makeDraft(agent, csrf);
    await database.query("UPDATE evidence_records SET status='stale' WHERE id=$1", [fixture.evidenceId]);
    const approval = await agent.post(`/api/outreach/${messageId}/approval`).set("x-csrf-token", csrf).send();
    assert.equal(approval.status, 409);
    assert.ok(String(approval.body.type).endsWith("/outreach_claim_not_supported"));
    await database.query("UPDATE evidence_records SET status='current' WHERE id=$1", [fixture.evidenceId]);
  });

  it("OUT-003 suppresses queued work when credential access changes before execution", async () => {
    const { agent, csrf, workspaceId, userId } = await login();
    const messageId = await makeDraft(agent, csrf);
    await approve(agent, csrf, messageId);
    const queued = await agent.post(`/api/outreach/${messageId}/send`).set("x-csrf-token", csrf).send();
    assert.equal(queued.status, 202, queued.text);
    await database.query(
      `UPDATE certification_credentials SET status='suspended',suspension_read_only_allowed=true
        WHERE user_id=$1`,
      [userId]
    );
    let providerCalled = false;
    const provider: EmailDeliveryProvider = {
      send() {
        providerCalled = true;
        return Promise.resolve({ status: "accepted" as const, providerMessageId: "must-not-send" });
      }
    };
    const result = await processOutreachSend(database, provider, { workspaceId, messageId, actorUserId: userId });
    assert.equal(result.status, "suppressed");
    assert.equal(providerCalled, false);
    const stored = await database.query<{ status: string; provider_status: string }>(
      "SELECT status,provider_status FROM outreach_messages WHERE id=$1", [messageId]
    );
    assert.deepEqual(stored.rows[0], { status: "suppressed", provider_status: "suppressed" });
    await database.query(
      `UPDATE certification_credentials SET status='active',suspension_read_only_allowed=false
        WHERE user_id=$1`,
      [userId]
    );
  });

  it("OUT-006/009 persists mobile-safe call logging and makes follow-up tasks visible", async () => {
    const { agent, csrf } = await login();
    const call = await agent.post("/api/outreach/calls").set("x-csrf-token", csrf).send({
      placementId: fixture.placementId, contactId: fixture.contactId, status: "completed",
      objective: "Confirm Buyer questions", preparation: "Review exact scope",
      questions: ["What does the Buyer need?"], objectionGuidance: [],
      authorityLimits: "Do not bind Brand terms.", voicemailScript: "",
      notes: "Synthetic mobile call notes", outcome: "Buyer requested follow-up.",
      durationSeconds: 180,
      nextActionTitle: "Send requested follow-up",
      nextActionDueAt: new Date(Date.now() - 60_000).toISOString()
    });
    assert.equal(call.status, 201, call.text);
    const tasks = await agent.get("/api/tasks");
    assert.equal(tasks.status, 200, tasks.text);
    assert.ok(tasks.body.tasks.some((item: { title: string }) => item.title === "Send requested follow-up"));
    const home = await agent.get("/api/home");
    assert.ok(home.body.nextActions.some((item: { title: string }) => item.title === "Send requested follow-up"));
  });
});
