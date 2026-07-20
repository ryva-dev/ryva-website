import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request, { type Response } from "supertest";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig, resetConfigForTests } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";
import { migrate } from "../../packages/database/src/migrate.js";
import { seedSynthetic, syntheticPassword } from "../../packages/database/src/seed.js";
import { processCommercialJob } from "../../packages/domain/src/index.js";
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

async function login(email = "active@synthetic.ryva.test") {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password: syntheticPassword });
  assert.equal(response.status, 200, response.text);
  return {
    agent, csrf: csrfFrom(response), workspaceId: response.body.user.workspaceId as string,
    userId: response.body.user.id as string
  };
}

async function core(agent: Agent, csrf: string, type: string, values: Record<string, unknown>) {
  const response = await agent.post(`/api/records/${type}`).set("x-csrf-token", csrf).send(values);
  assert.equal(response.status, 201, response.text);
  return response.body.record as { id: string };
}

async function setupCommercialFixture(
  agent: Agent,
  csrf: string,
  workspaceId: string,
  userId: string,
  label: string,
  protectedRules = "One year of documented account protection after an accepted opening Order.",
  commissionCurrency = "USD"
) {
  const brand = await core(agent, csrf, "brand", { name: `Synthetic ${label} Brand` });
  const product = await core(agent, csrf, "product", {
    brandId: brand.id, name: `Synthetic ${label} Product`, category: "Gift"
  });
  const business = await core(agent, csrf, "business", {
    name: `Synthetic ${label} Buyer`, businessType: "gift_shop", category: "Gift"
  });
  await database.query("UPDATE products SET status='qualified' WHERE id=$1", [product.id]);
  await database.query(
    `UPDATE businesses SET qualification_status='qualified',
      geography='{"country":"US"}' WHERE id=$1`,
    [business.id]
  );
  const documentId = newId();
  const agreementId = newId();
  await database.query(
    `INSERT INTO documents
      (id,workspace_id,subject_type,subject_id,owner_user_id,name,document_type,media_type,
       byte_size,storage_key,sha256,scan_status,confidentiality,status)
     VALUES($1,$2,'representation_agreement',$3,$4,$5,'representation_agreement_original',
       'application/pdf',100,$6,$7,'clean','restricted','active')`,
    [documentId, workspaceId, agreementId, userId, `synthetic-${label}-agreement.pdf`,
      `${workspaceId}/${documentId}/original`, label.padEnd(64, "a").slice(0, 64)]
  );
  const approvalId = newId();
  await database.query(
    `INSERT INTO human_approvals
      (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,
       approver_user_id,status,scope,decided_at)
     VALUES($1,$2,'representation_agreement',$3,'activate_authority',$4,$5,'approved',
       'Synthetic exact Agreement terms',now())`,
    [approvalId, workspaceId, agreementId, `${label}-authority`, userId]
  );
  await database.query(
    `INSERT INTO representation_agreements
      (id,workspace_id,brand_id,representative_user_id,status,source_document_id,
       effective_at,expires_at,channels,territory_scope,authority_summary,
       commission_basis,commission_rate,commission_currency,commission_timing,
       opening_order_rights,reorder_rights,protected_account_rules,house_account_rules,
       termination_terms,post_termination_commission_rights,legal_ambiguity_status,
       approval_id,authority_digest,approved_by,approved_at)
     VALUES($1,$2,$3,$4,'active',$5,'2026-01-01','2028-01-01',
       ARRAY['independent_retail'],'{"countries":["US"]}',
       'May place the scoped Product with qualified independent retailers.',
       'Net eligible wholesale after discounts, returns, and cancellations',0.12,$9,
       'Within 30 days after cleared Buyer payment','Opening Orders are commissionable.',
       'Reorders are commissionable during the Agreement term.',$6,'Written exclusions only.',
       'Thirty days written notice.','Accepted Orders survive termination.','none',
       $7,$8,$4,now())`,
    [agreementId, workspaceId, brand.id, userId, documentId, protectedRules,
      approvalId, `${label}-authority`, commissionCurrency]
  );
  await database.query(
    `INSERT INTO representation_agreement_products
     (agreement_id,workspace_id,product_id,scope_notes) VALUES($1,$2,$3,'Synthetic exact scope')`,
    [agreementId, workspaceId, product.id]
  );
  const decisionId = newId();
  await database.query(
    `INSERT INTO decision_records
      (id,workspace_id,subject_type,subject_id,question,scope,outcome,rationale,
       confidence,owner_user_id,decided_at,next_action,status)
     VALUES($1,$2,'business',$3,'Proceed to Order discussion?','Synthetic Phase 6 fixture',
       'Proceed','Human documented Buyer value and commercial conditions.','supported',
       $4,now(),'Verify the documented Order','issued')`,
    [decisionId, workspaceId, business.id, userId]
  );
  const placementId = newId();
  await database.query(
    `INSERT INTO placement_opportunities
      (id,workspace_id,agreement_id,brand_id,business_id,owner_user_id,stage,
       match_thesis,buyer_value_basis,evidence_confidence,decision_id,conflict_status,
       authority_channel)
     VALUES($1,$2,$3,$4,$5,$6,'terms_order_discussion',
       'Synthetic documented assortment match.','Documented Buyer assortment value.',
       'supported',$7,'clear','independent_retail')`,
    [placementId, workspaceId, agreementId, brand.id, business.id, userId, decisionId]
  );
  await database.query(
    `INSERT INTO placement_opportunity_products
     (placement_opportunity_id,workspace_id,product_id) VALUES($1,$2,$3)`,
    [placementId, workspaceId, product.id]
  );
  return { brandId: brand.id, productId: product.id, businessId: business.id,
    agreementId, placementId, documentId };
}

async function createOpeningOrder(
  agent: Agent, csrf: string, context: Awaited<ReturnType<typeof setupCommercialFixture>>,
  label: string, orderCurrency = "USD"
) {
  const response = await agent.post("/api/orders").set("x-csrf-token", csrf).send({
    placementId: context.placementId, orderNumber: `SYN-${label}-001`,
    externalReference: `external-${label}-001`, idempotencyKey: `phase6-${label}-opening`,
    orderType: "opening_order", orderDate: "2026-07-15", currency: orderCurrency,
    sourceType: "document", sourceDocumentId: context.documentId,
    sourceReference: `Synthetic ${label} PO`, paymentStatus: "unpaid",
    fulfillmentStatus: "unfulfilled",
    lines: [{
      productId: context.productId, description: `Synthetic ${label} line`,
      quantity: "10", unitWholesalePrice: "100.0000", grossAmount: "1000.00",
      discountAmount: "100.00", returnAmount: "50.00", cancellationAmount: "0.00",
      commissionEligible: true
    }]
  });
  assert.equal(response.status, 201, response.text);
  return response.body.order as Record<string, unknown>;
}

before(async () => {
  await database.query("DROP SCHEMA public CASCADE");
  await database.query("CREATE SCHEMA public");
  await migrate(database);
  resetConfigForTests();
  await seedSynthetic();
  app = createApp({ database, configuration });
});

after(async () => {
  await database.end();
});

describe("Phase 6 Accounts, Orders, Reorders, and Commissions", () => {
  it("COM-001/002/003 atomically converts one verified opening Order without manufacturing protection", async () => {
    const { agent, csrf, workspaceId, userId } = await login();
    Object.assign(fixture, { workspaceId, userId });
    const context = await setupCommercialFixture(agent, csrf, workspaceId, userId, "Commerce");
    Object.assign(fixture, context);
    const order = await createOpeningOrder(agent, csrf, context, "commerce");
    fixture.orderId = String(order.id);
    const duplicate = await createOpeningOrder(agent, csrf, context, "commerce");
    assert.equal(duplicate.id, order.id, "idempotency must return the one Order");
    const confirmed = await agent.post(`/api/orders/${String(order.id)}/confirm`)
      .set("x-csrf-token", csrf).send({
        version: order.version,
        verificationNotes: "Human compared Order identity, line, quantity, values, and source."
      });
    assert.equal(confirmed.status, 200, confirmed.text);
    fixture.accountId = confirmed.body.accountId;
    fixture.protectedAccountId = confirmed.body.protectedAccountId;
    fixture.commissionId = confirmed.body.commission.id;
    fixture.reorderId = confirmed.body.reorder.id;
    assert.ok(fixture.accountId);
    assert.ok(fixture.protectedAccountId);
    assert.equal(confirmed.body.commission.expectedAmount, "102.00");
    assert.equal(confirmed.body.commission.status, "estimated");
    const protection = await agent.get(`/api/protected-accounts/${fixture.protectedAccountId}`);
    assert.equal(protection.status, 200, protection.text);
    assert.equal(protection.body.protection.status, "pending");
    assert.equal(protection.body.protection.supporting_basis_status, "review_required");
    assert.equal(protection.body.protection.human_confirmed, false);
    const account = await agent.get(`/api/accounts/${fixture.accountId}`);
    assert.equal(account.status, 200, account.text);
    assert.equal(account.body.account.opening_order_id, order.id);
    const audit = await database.query(
      `SELECT action FROM audit_events WHERE workspace_id=$1
        AND target_id=ANY($2::text[])`,
      [workspaceId, [order.id, fixture.accountId, fixture.commissionId]]
    );
    assert.ok(audit.rows.length >= 3);
  });

  it("COM-002 opens an ordinary Account without asserting undocumented protection", async () => {
    const { agent, csrf, workspaceId, userId } = await login();
    const context = await setupCommercialFixture(
      agent, csrf, workspaceId, userId, "NoProtection", ""
    );
    const order = await createOpeningOrder(agent, csrf, context, "no-protection");
    const confirmed = await agent.post(`/api/orders/${String(order.id)}/confirm`)
      .set("x-csrf-token", csrf).send({
        version: order.version,
        verificationNotes: "Human verified the Order; the Agreement has no protection clause."
      });
    assert.equal(confirmed.status, 200, confirmed.text);
    assert.equal(confirmed.body.protectedAccountId, null);
    const account = await agent.get(`/api/accounts/${confirmed.body.accountId}`);
    assert.equal(account.status, 200, account.text);
    assert.equal(account.body.account.protected_account_id, null);
    const task = await database.query(
      `SELECT id FROM tasks WHERE workspace_id=$1 AND subject_type='account'
        AND subject_id=$2 AND mandatory_gate`,
      [workspaceId, confirmed.body.accountId]
    );
    assert.equal(task.rowCount, 1);
  });

  it("COM-002 requires documentary scope and exact human approval before protection activates", async () => {
    const { agent, csrf } = await login();
    const pending = await agent.get(`/api/protected-accounts/${fixture.protectedAccountId}`);
    const protection = pending.body.protection;
    const premature = await agent.post(`/api/protected-accounts/${fixture.protectedAccountId}/approval`)
      .set("x-csrf-token", csrf).send();
    assert.equal(premature.status, 409);
    const reviewed = await agent.patch(`/api/protected-accounts/${fixture.protectedAccountId}`)
      .set("x-csrf-token", csrf).send({
        version: protection.version, basisDocumentId: fixture.documentId,
        scopeSummary: "The documented Business, Product, channel, US territory, and one-year term.",
        productIds: [fixture.productId], channels: ["independent_retail"],
        territoryScope: { countries: ["US"] }, protectionStartsOn: "2026-07-15",
        protectionEndsOn: "2027-07-15", protectionTerm: "One year from documented opening Order",
        commissionRights: "12% of eligible net wholesale under the Agreement.",
        reorderRights: "Reorders during the written term are commissionable.",
        houseAccountExclusions: "Only written exclusions apply.",
        releaseTerms: "Release requires documented human action.", conflictNotes: ""
      });
    assert.equal(reviewed.status, 200, reviewed.text);
    const requested = await agent.post(`/api/protected-accounts/${fixture.protectedAccountId}/approval`)
      .set("x-csrf-token", csrf).send();
    assert.equal(requested.status, 201, requested.text);
    const approved = await agent.post(
      `/api/protected-accounts/${fixture.protectedAccountId}/approval/${requested.body.approval.id}`
    ).set("x-csrf-token", csrf).send({
      decision: "approved", conditions: "Exact reviewed documentary scope only."
    });
    assert.equal(approved.status, 200, approved.text);
    assert.equal(approved.body.protectedAccount.status, "active");
    assert.equal(approved.body.protectedAccount.human_confirmed, true);
  });

  it("COM-004 preserves Order and calculation versions through returns and human re-verification", async () => {
    const { agent, csrf } = await login();
    const current = await agent.get(`/api/orders/${fixture.orderId}`);
    const corrected = await agent.post(`/api/orders/${fixture.orderId}/corrections`)
      .set("x-csrf-token", csrf).send({
        version: current.body.order.version,
        reason: "A documented additional return reduced eligible net wholesale.",
        sourceDocumentId: fixture.documentId, status: "partially_returned",
        paymentStatus: "unpaid", fulfillmentStatus: "partial",
        lines: [{
          productId: fixture.productId, description: "Synthetic corrected line",
          quantity: "10", unitWholesalePrice: "100.0000", grossAmount: "1000.00",
          discountAmount: "100.00", returnAmount: "150.00", cancellationAmount: "0.00",
          commissionEligible: true
        }]
      });
    assert.equal(corrected.status, 200, corrected.text);
    assert.equal(corrected.body.order.net_commissionable, "750.00");
    const commission = await agent.get(`/api/commissions/${fixture.commissionId}`);
    assert.equal(commission.body.commission.expectedAmount, "90.00");
    assert.equal(commission.body.calculations.length, 2);
    assert.equal(commission.body.calculations[1].resultAmount, "102.00");
    const reconfirmed = await agent.post(`/api/orders/${fixture.orderId}/confirm`)
      .set("x-csrf-token", csrf).send({
        version: corrected.body.order.version,
        verificationNotes: "Human verified the corrected return against the source."
      });
    assert.equal(reconfirmed.status, 200, reconfirmed.text);
    assert.equal(reconfirmed.body.accountId, fixture.accountId);
  });

  it("COM-005/006 links a verified Reorder and produces idempotent human-review reminders", async () => {
    const { agent, csrf } = await login();
    const current = await agent.get(`/api/reorders`);
    const reorder = (current.body.reorders as Array<Record<string, unknown>>)
      .find((item) => item.id === fixture.reorderId)!;
    const reminderAt = new Date(Date.now() - 60_000).toISOString();
    const updated = await agent.patch(`/api/reorders/${fixture.reorderId}`)
      .set("x-csrf-token", csrf).send({
        version: reorder.version, status: "due",
        expectedWindowStartsOn: "2026-08-15", expectedWindowEndsOn: "2026-09-15",
        reminderAt, accountHealth: "healthy",
        healthRationale: "Opening delivery and support have no unresolved issue.",
        nextAction: "Review Buyer need before approved follow-up.",
        likelihoodLabel: "medium", likelihoodOrigin: "user_entered",
        estimateExplanation: "Human qualitative estimate; not guaranteed revenue.",
        recommendedFollowUp: "Review need and inventory before contact.",
        deferOrCloseReason: null
      });
    assert.equal(updated.status, 200, updated.text);
    await processCommercialJob(database, {
      workspaceId: fixture.workspaceId!, kind: "commerce.reorder_due",
      payload: { reorderId: fixture.reorderId }, requestId: "reorder-reminder-1"
    });
    await processCommercialJob(database, {
      workspaceId: fixture.workspaceId!, kind: "commerce.reorder_due",
      payload: { reorderId: fixture.reorderId }, requestId: "reorder-reminder-2"
    });
    const tasks = await database.query(
      `SELECT id FROM tasks WHERE workspace_id=$1 AND subject_type='reorder'
        AND subject_id=$2 AND created_reason LIKE 'Review actual history%'`,
      [fixture.workspaceId, fixture.reorderId]
    );
    assert.equal(tasks.rowCount, 1);
    const reorderOrder = await agent.post("/api/orders").set("x-csrf-token", csrf).send({
      placementId: fixture.placementId, accountId: fixture.accountId,
      priorOrderId: fixture.orderId, orderNumber: "SYN-REORDER-002",
      externalReference: "external-reorder-002", idempotencyKey: "phase6-commerce-reorder",
      orderType: "reorder", orderDate: "2026-08-20", currency: "USD",
      sourceType: "document", sourceDocumentId: fixture.documentId,
      sourceReference: "Synthetic Reorder PO", paymentStatus: "unpaid",
      fulfillmentStatus: "unfulfilled",
      lines: [{
        productId: fixture.productId, description: "Synthetic Reorder line",
        quantity: "5", unitWholesalePrice: "100.0000", grossAmount: "500.00",
        discountAmount: "0.00", returnAmount: "0.00", cancellationAmount: "0.00",
        commissionEligible: true
      }]
    });
    assert.equal(reorderOrder.status, 201, reorderOrder.text);
    const confirmed = await agent.post(`/api/orders/${reorderOrder.body.order.id}/confirm`)
      .set("x-csrf-token", csrf).send({
        version: reorderOrder.body.order.version,
        verificationNotes: "Human verified the subsequent Order and documentary rights."
      });
    assert.equal(confirmed.status, 200, confirmed.text);
    assert.equal(confirmed.body.commission.expectedAmount, "60.00");
    const linked = await database.query(
      "SELECT status,new_order_id FROM reorders WHERE id=$1",
      [fixture.reorderId]
    );
    assert.equal(linked.rows[0].status, "ordered");
    assert.equal(linked.rows[0].new_order_id, reorderOrder.body.order.id);
  });

  it("COM-007/008/009 keeps expiry, payment, clawback, and dispute decisions human-owned and traceable", async () => {
    const { agent, csrf } = await login();
    let detail = await agent.get(`/api/commissions/${fixture.commissionId}`);
    const pending = await agent.post(`/api/commissions/${fixture.commissionId}/status`)
      .set("x-csrf-token", csrf).send({
        version: detail.body.commission.version, toStatus: "pending_verification",
        reason: "Human verified current Order revision and Agreement rule.",
        sourceDocumentId: fixture.documentId
      });
    assert.equal(pending.status, 200, pending.text);
    const approved = await agent.post(`/api/commissions/${fixture.commissionId}/status`)
      .set("x-csrf-token", csrf).send({
        version: pending.body.commission.version, toStatus: "approved",
        reason: "Human approved the reconciled amount from documentary evidence.",
        sourceDocumentId: fixture.documentId, verifiedAmount: "90.00", approvedAmount: "90.00"
      });
    assert.equal(approved.status, 200, approved.text);
    const dispute = await agent.post(`/api/commissions/${fixture.commissionId}/disputes`)
      .set("x-csrf-token", csrf).send({
        reasonCode: "amount_variance",
        reason: "The Brand statement shows a lower amount than the documented calculation.",
        disputedAmount: "10.00", evidenceDocumentId: fixture.documentId,
        nextAction: "Request a factual reconciliation from the Brand."
      });
    assert.equal(dispute.status, 201, dispute.text);
    fixture.disputeId = dispute.body.dispute.id;
    const decisionId = newId();
    await database.query(
      `INSERT INTO decision_records
       (id,workspace_id,subject_type,subject_id,question,scope,outcome,rationale,confidence,
        owner_user_id,decided_at,next_action,status)
       VALUES($1,$2,'commission_dispute',$3,'Resolve documented variance?',
        'Synthetic dispute evidence','Resolve at 90.00',
        'Human compared the Agreement, Order revision, and statement.','supported',
        $4,now(),'Record the approved resolution','issued')`,
      [decisionId, fixture.workspaceId, fixture.disputeId, fixture.userId]
    );
    const resolved = await agent.post(`/api/commission-disputes/${fixture.disputeId}/resolve`)
      .set("x-csrf-token", csrf).send({
        version: dispute.body.dispute.version, resolutionAmount: "90.00",
        resolution: "Documentary reconciliation supports the full corrected amount.",
        resolutionDate: "2026-08-25", evidenceDocumentId: fixture.documentId,
        finalDecisionId: decisionId
      });
    assert.equal(resolved.status, 200, resolved.text);
    detail = await agent.get(`/api/commissions/${fixture.commissionId}`);
    const payable = await agent.post(`/api/commissions/${fixture.commissionId}/status`)
      .set("x-csrf-token", csrf).send({
        version: detail.body.commission.version, toStatus: "payable",
        reason: "Human confirmed the documented payment due date.",
        sourceDocumentId: fixture.documentId, paymentDueDate: "2026-08-30"
      });
    assert.equal(payable.status, 200, payable.text);
    const missingPayment = await agent.post(`/api/commissions/${fixture.commissionId}/status`)
      .set("x-csrf-token", csrf).send({
        version: payable.body.commission.version, toStatus: "paid",
        reason: "Attempt without required payment fields.", sourceDocumentId: fixture.documentId
      });
    assert.equal(missingPayment.status, 422);
    const paid = await agent.post(`/api/commissions/${fixture.commissionId}/status`)
      .set("x-csrf-token", csrf).send({
        version: payable.body.commission.version, toStatus: "paid",
        reason: "Human confirmed cleared payment against the statement.",
        sourceDocumentId: fixture.documentId, paidAmount: "90.00", paymentDate: "2026-08-29"
      });
    assert.equal(paid.status, 200, paid.text);
    const clawed = await agent.post(`/api/commissions/${fixture.commissionId}/status`)
      .set("x-csrf-token", csrf).send({
        version: paid.body.commission.version, toStatus: "clawed_back",
        reason: "Documented post-payment return requires a visible clawback.",
        sourceDocumentId: fixture.documentId, clawbackAmount: "5.00"
      });
    assert.equal(clawed.status, 200, clawed.text);
    const events = await database.query(
      `SELECT event_type FROM commercial_events WHERE workspace_id=$1
        AND subject_type='commission' AND subject_id=$2`,
      [fixture.workspaceId, fixture.commissionId]
    );
    assert.ok(events.rows.some((item) => item.event_type === "commission.paid"));
    assert.ok(events.rows.some((item) => item.event_type === "commission.clawed_back"));
    await database.query(
      "UPDATE protected_accounts SET protection_ends_on=CURRENT_DATE-1,status='active' WHERE id=$1",
      [fixture.protectedAccountId]
    );
    await processCommercialJob(database, {
      workspaceId: fixture.workspaceId!, kind: "commerce.protection_expired",
      payload: { protectedAccountId: fixture.protectedAccountId }, requestId: "expiry-test"
    });
    const protection = await database.query(
      "SELECT status FROM protected_accounts WHERE id=$1", [fixture.protectedAccountId]
    );
    assert.equal(protection.rows[0].status, "expired");
  });

  it("COM-010/011 preserves commercial records after termination and never combines currencies", async () => {
    const { agent, csrf, workspaceId, userId } = await login();
    const euroContext = await setupCommercialFixture(
      agent, csrf, workspaceId, userId, "Euro", "", "EUR"
    );
    const euroOrder = await createOpeningOrder(agent, csrf, euroContext, "euro", "EUR");
    const euroConfirmed = await agent.post(`/api/orders/${String(euroOrder.id)}/confirm`)
      .set("x-csrf-token", csrf).send({
        version: euroOrder.version,
        verificationNotes: "Human verified the EUR Order against its EUR Agreement rule."
      });
    assert.equal(euroConfirmed.status, 200, euroConfirmed.text);
    assert.equal(euroConfirmed.body.commission.currency, "EUR");
    const ended = await agent.post(`/api/agreements/${fixture.agreementId}/status`)
      .set("x-csrf-token", csrf).send({
        version: 1, status: "ended",
        reason: "Synthetic relationship end with surviving documented obligations."
      });
    assert.equal(ended.status, 200, ended.text);
    const authority = await agent.post("/api/authority/evaluate").set("x-csrf-token", csrf).send({
      action: "send_outreach", agreementId: fixture.agreementId,
      brandId: fixture.brandId, businessId: fixture.businessId,
      productIds: [fixture.productId], channel: "independent_retail"
    });
    assert.equal(authority.body.authority.outcome, "denied");
    assert.equal((await agent.get(`/api/accounts/${fixture.accountId}`)).status, 200);
    assert.equal((await agent.get(`/api/orders/${fixture.orderId}`)).status, 200);
    assert.equal((await agent.get(`/api/commissions/${fixture.commissionId}`)).status, 200);
    assert.equal((await agent.get(`/api/commission-disputes/${fixture.disputeId}`)).status, 200);
    const currencies = await database.query(
      `SELECT currency,sum(expected_amount)::text AS total FROM commissions
        WHERE workspace_id=$1 GROUP BY currency ORDER BY currency`,
      [fixture.workspaceId]
    );
    assert.deepEqual(
      currencies.rows.map((item: { currency: unknown }) => item.currency),
      ["EUR", "USD"]
    );
    const other = await login("uncertified@synthetic.ryva.test");
    const concealed = await other.agent.get(`/api/accounts/${fixture.accountId}`);
    assert.notEqual(concealed.status, 200);
  });
});
