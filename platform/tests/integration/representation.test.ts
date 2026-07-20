import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request, { type Response } from "supertest";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig, resetConfigForTests } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";
import { migrate } from "../../packages/database/src/migrate.js";
import { seedSynthetic, syntheticPassword } from "../../packages/database/src/seed.js";
import { newId } from "../../packages/shared/src/index.js";

const configuration = loadConfig(process.env);
const database = createDatabase(configuration);
let app: ReturnType<typeof createApp>;
type Agent = ReturnType<typeof request.agent>;

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
  return { agent, csrf: csrfFrom(response), workspaceId: response.body.user.workspaceId as string, userId: response.body.user.id as string };
}

async function core(agent: Agent, csrf: string, type: string, values: Record<string, unknown>) {
  const response = await agent.post(`/api/records/${type}`).set("x-csrf-token", csrf).send(values);
  assert.equal(response.status, 201, response.text);
  return response.body.record as { id: string; version: number };
}

async function task(agent: Agent, csrf: string, type: string, id: string, title: string) {
  const response = await agent.post(`/api/records/${type}/${id}/tasks`).set("x-csrf-token", csrf).send({
    title, priority: "high", createdReason: "Synthetic Phase 4 acceptance gate", mandatoryGate: true,
    dueAt: "2026-08-01T12:00:00.000Z"
  });
  assert.equal(response.status, 201, response.text);
  return response.body.task.id as string;
}

async function decision(agent: Agent, csrf: string, type: string, id: string, outcome: string) {
  const response = await agent.post(`/api/records/${type}/${id}/decisions`).set("x-csrf-token", csrf).send({
    question: `Should this ${type} advance?`, scope: "Synthetic Phase 4 fixture only",
    outcome, rationale: "Human-owned synthetic acceptance decision based on classified evidence.",
    confidence: "supported", nextAction: "Complete the next authority gate.", status: "issued"
  });
  assert.equal(response.status, 201, response.text);
  return response.body.decision.id as string;
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

describe("Phase 4 Representation Workspace and Agreement Authority", () => {
  it("PLC-001/002 fail closed when no current human-approved Agreement covers outreach or represented state", async () => {
    const { agent, csrf } = await login();
    const brand = await core(agent, csrf, "brand", { name: "Synthetic No Authority Brand" });
    const product = await core(agent, csrf, "product", {
      brandId: brand.id, name: "Synthetic No Authority Product", category: "Gift"
    });
    const authority = await agent.post("/api/authority/evaluate").set("x-csrf-token", csrf).send({
      action: "send_outreach", brandId: brand.id, productIds: [product.id], channel: "independent_retail"
    });
    assert.equal(authority.status, 200, authority.text);
    assert.equal(authority.body.authority.outcome, "denied");
    assert.deepEqual(authority.body.authority.reasonCodes, ["no_current_active_agreement"]);
    const productDecision = await decision(agent, csrf, "product", product.id, "Represent");
    const productTask = await task(agent, csrf, "product", product.id, "Review representation scope");
    const represented = await agent.post(`/api/intelligence/products/${product.id}/status`)
      .set("x-csrf-token", csrf).send({
        version: 1, toStatus: "represented", decisionId: productDecision, nextActionTaskId: productTask
      });
    assert.equal(represented.status, 409);
    assert.ok(String(represented.body.type).endsWith("/representation_agreement_required"));
  });

  it("JRN-03 and PLC-003–010 preserve original provenance, exact human approval, conflicts, Triangle value, stage history, and lifecycle blocking", async () => {
    const { agent, csrf, workspaceId, userId } = await login();
    const brand = await core(agent, csrf, "brand", { name: "Synthetic Authority Brand" });
    const product = await core(agent, csrf, "product", {
      brandId: brand.id, name: "Synthetic Authority Product", category: "Home Gift"
    });
    const business = await core(agent, csrf, "business", {
      name: "Synthetic Qualified Gift Shop", businessType: "gift_shop", category: "Gift"
    });
    const excludedBusiness = await core(agent, csrf, "business", {
      name: "Synthetic House Account", businessType: "regional_retailer", category: "Gift"
    });
    await database.query(
      "UPDATE brands SET pipeline_stage='contact_ready',identity_status='reviewing' WHERE id=$1",
      [brand.id]
    );
    await database.query("UPDATE products SET status='qualified' WHERE id=$1", [product.id]);
    await database.query(
      "UPDATE businesses SET qualification_status='qualified' WHERE id=ANY($1::uuid[])",
      [[business.id, excludedBusiness.id]]
    );
    const brandDecision = await decision(agent, csrf, "brand", brand.id, "Proceed with representation review");
    const brandTask = await task(agent, csrf, "brand", brand.id, "Review proposed agreement");
    const businessDecision = await decision(agent, csrf, "business", business.id, "Proceed with placement");
    const businessTask = await task(agent, csrf, "business", business.id, "Prepare evidence-led buyer rationale");
    const excludedDecision = await decision(agent, csrf, "business", excludedBusiness.id, "Investigate conflict");

    await database.query(
      `INSERT INTO product_business_match_reviews
       (id,workspace_id,product_id,business_id,context,context_digest,rationale,confidence,
        material_statements,evidence_ids,missing_evidence,contrary_evidence,origin,status,
        decision_id,next_action_task_id,reviewed_by,reviewed_at)
       VALUES($1,$2,$3,$4,'{}',$5,$6,'supported','[]','{}','{}','','user_entered','qualified',$7,$8,$9,now()),
             ($10,$2,$3,$11,'{}',$12,$13,'supported','[]','{}','{}','','user_entered','qualified',$14,$8,$9,now())`,
      [newId(), workspaceId, product.id, business.id, "qualified-main",
        "Shelf and customer need are supported by synthetic evidence.", businessDecision, businessTask, userId,
        newId(), excludedBusiness.id, "qualified-excluded", "Synthetic pre-conflict match.", excludedDecision]
    );

    const opportunity = await agent.post("/api/representation/opportunities").set("x-csrf-token", csrf).send({
      brandId: brand.id, productIds: [product.id], proposedChannels: ["independent_retail"],
      proposedTerritory: { countries: ["US"] }, brandObjectives: "Open qualified independent retail.",
      termsSummary: "Written terms under review.", missingTerms: [],
      decisionId: brandDecision, nextActionTaskId: brandTask
    });
    assert.equal(opportunity.status, 201, opportunity.text);
    const opportunityId = opportunity.body.opportunity.id as string;

    const documentId = newId();
    await database.query(
      `INSERT INTO documents
       (id,workspace_id,subject_type,subject_id,owner_user_id,name,document_type,media_type,
        byte_size,storage_key,sha256,scan_status,confidentiality,status)
       VALUES($1,$2,'representation_opportunity',$3,$4,'synthetic-authority.pdf',
        'representation_agreement_original','application/pdf',42,$5,$6,'clean','restricted','active')`,
      [documentId, workspaceId, opportunityId, userId, `${workspaceId}/${documentId}/original`, "a".repeat(64)]
    );
    const agreementCreated = await agent.post("/api/agreements").set("x-csrf-token", csrf).send({
      representationOpportunityId: opportunityId, sourceDocumentId: documentId
    });
    assert.equal(agreementCreated.status, 201, agreementCreated.text);
    const agreementId = agreementCreated.body.agreement.id as string;
    const terms = await agent.patch(`/api/agreements/${agreementId}`).set("x-csrf-token", csrf).send({
      version: 1,
      productIds: [product.id],
      changes: {
        effectiveAt: "2026-07-01T00:00:00.000Z",
        expiresAt: "2027-07-01T00:00:00.000Z",
        channels: ["independent_retail"],
        territoryScope: { countries: ["US"] },
        authoritySummary: "May introduce the scoped Product to qualified independent retailers.",
        commissionBasis: "Net paid opening and reorder invoices",
        commissionRate: 0.12,
        commissionCurrency: "USD",
        commissionTiming: "Within 30 days after Brand receives cleared buyer payment.",
        openingOrderRights: "Commission applies to written approved opening orders.",
        reorderRights: "Commission applies to reorders during the term.",
        protectedAccountRules: "Only specifically approved written accounts qualify.",
        houseAccountRules: "The written house-account schedule is excluded.",
        terminationTerms: "Either party may terminate with 30 days written notice.",
        terminationNoticeDays: 30,
        postTerminationCommissionRights: "Only accepted orders placed before termination remain commissionable.",
        renewalStatus: "review_due",
        renewalReviewAt: "2027-05-01T00:00:00.000Z",
        legalAmbiguityStatus: "none"
      }
    });
    assert.equal(terms.status, 200, terms.text);

    const candidate = await agent.post(`/api/agreements/${agreementId}/term-candidates`)
      .set("x-csrf-token", csrf).send({
        sourceDocumentId: documentId, fieldName: "commissionTiming",
        proposedValue: "Within 30 days after cleared payment", sourcePage: 4,
        sourceLocation: "Page 4, section 6.2", evidenceExcerpt: "Synthetic fixture excerpt",
        evidenceClass: "direct_evidence", confidence: "supported", origin: "user_entered",
        material: true, ambiguous: false, specialistReviewRequired: false
      });
    assert.equal(candidate.status, 201, candidate.text);
    const confirmed = await agent.patch(`/api/agreement-term-candidates/${candidate.body.candidate.id}`)
      .set("x-csrf-token", csrf).send({
        version: 1, decision: "confirmed",
        editedValue: "Within 30 days after Brand receives cleared buyer payment.",
        reviewNotes: "Human compared the cited section to the immutable original."
      });
    assert.equal(confirmed.status, 200, confirmed.text);

    const restriction = await agent.post(`/api/agreements/${agreementId}/account-restrictions`)
      .set("x-csrf-token", csrf).send({
        restrictionType: "house_account_exclusion", businessId: excludedBusiness.id,
        accountName: "Synthetic House Account", productIds: [product.id],
        channels: ["independent_retail"], territoryScope: { countries: ["US"] },
        sourceDocumentId: documentId, sourceLocation: "Page 8, Exhibit B"
      });
    assert.equal(restriction.status, 201, restriction.text);

    const approval = await agent.post(`/api/agreements/${agreementId}/approval`)
      .set("x-csrf-token", csrf).send({ scope: "Exact written Product, channel, territory, account, commission, and termination terms." });
    assert.equal(approval.status, 201, approval.text);
    const activated = await agent.post(`/api/agreements/${agreementId}/activate`)
      .set("x-csrf-token", csrf).send({
        approvalId: approval.body.approval.id, decision: "approved",
        conditions: "No rights beyond the reviewed written terms."
      });
    assert.equal(activated.status, 200, activated.text);
    assert.equal(activated.body.agreement.status, "active");

    const approvedAuthority = await agent.post("/api/authority/evaluate").set("x-csrf-token", csrf).send({
      action: "send_outreach", agreementId, brandId: brand.id, productIds: [product.id],
      businessId: business.id, channel: "independent_retail"
    });
    assert.equal(approvedAuthority.body.authority.outcome, "authorized");
    const excludedAuthority = await agent.post("/api/authority/evaluate").set("x-csrf-token", csrf).send({
      action: "send_outreach", agreementId, brandId: brand.id, productIds: [product.id],
      businessId: excludedBusiness.id, channel: "independent_retail"
    });
    assert.equal(excludedAuthority.body.authority.outcome, "denied");
    assert.ok(excludedAuthority.body.authority.reasonCodes.includes("written_account_exclusion"));

    const commissionOnly = await agent.post("/api/placements").set("x-csrf-token", csrf).send({
      agreementId, businessId: business.id, productIds: [product.id], channel: "independent_retail",
      matchThesis: "Representative can earn commission.", buyerValueBasis: "Representative commission only.",
      evidenceConfidence: "supported", decisionId: businessDecision,
      triangle: {
        brandValue: "Revenue", brandObligations: "Fulfill", brandRisks: "Returns", brandWarningSigns: "",
        buyerValue: "Representative commission", buyerObligations: "Pay", buyerRisks: "No supported value", buyerWarningSigns: "",
        representativeValue: "Commission", representativeObligations: "Professional conduct",
        representativeRisks: "Trust", representativeWarningSigns: "",
        allPartiesReceiveLegitimateValue: true
      }
    });
    assert.equal(commissionOnly.status, 422);
    assert.ok(String(commissionOnly.body.type).endsWith("/commission_only_rationale"));

    const placement = await agent.post("/api/placements").set("x-csrf-token", csrf).send({
      agreementId, businessId: business.id, productIds: [product.id], channel: "independent_retail",
      matchThesis: "The Product fills a documented gift assortment need at the Business.",
      buyerValueBasis: "Adds a shelf-ready gift option for the Buyer’s documented customer need.",
      evidenceConfidence: "supported", decisionId: businessDecision, nextActionTaskId: businessTask,
      triangle: {
        brandValue: "Qualified distribution", brandObligations: "Fulfill and support", brandRisks: "Returns", brandWarningSigns: "",
        buyerValue: "Relevant assortment and supported margin", buyerObligations: "Review terms", buyerRisks: "Sell-through", buyerWarningSigns: "",
        representativeValue: "Professional placement opportunity", representativeObligations: "Accurate claims and follow-through",
        representativeRisks: "Relationship trust", representativeWarningSigns: "",
        allPartiesReceiveLegitimateValue: true
      }
    });
    assert.equal(placement.status, 201, placement.text);
    const placementId = placement.body.placement.id as string;
    const qualified = await agent.post(`/api/placements/${placementId}/stage`).set("x-csrf-token", csrf).send({
      version: 1, toStage: "qualified", reason: "Human confirmed current fit and authority.",
      decisionId: businessDecision, evidenceIds: [], nextActionTaskId: businessTask
    });
    assert.equal(qualified.status, 200, qualified.text);
    const prepared = await agent.post(`/api/placements/${placementId}/stage`).set("x-csrf-token", csrf).send({
      version: 2, toStage: "prepared", reason: "Human confirmed the authorized preparation basis.",
      decisionId: businessDecision, evidenceIds: [], nextActionTaskId: businessTask
    });
    assert.equal(prepared.status, 200, prepared.text);
    const prematureContact = await agent.post(`/api/placements/${placementId}/stage`).set("x-csrf-token", csrf).send({
      version: 3, toStage: "contacted", reason: "Attempt premature contact.",
      decisionId: businessDecision, evidenceIds: [], nextActionTaskId: businessTask
    });
    assert.equal(prematureContact.status, 409);
    assert.ok(String(prematureContact.body.type).endsWith("/verified_outreach_required"));
    const closedWithoutEvidence = await agent.post(`/api/placements/${placementId}/stage`).set("x-csrf-token", csrf).send({
      version: 3, toStage: "closed_lost", reason: "Buyer timing changed.",
      decisionId: businessDecision, evidenceIds: []
    });
    assert.equal(closedWithoutEvidence.status, 422);

    const ended = await agent.post(`/api/agreements/${agreementId}/status`).set("x-csrf-token", csrf).send({
      version: activated.body.agreement.version, status: "ended",
      reason: "Synthetic authority ended after human contractual review."
    });
    assert.equal(ended.status, 200, ended.text);
    const blockedAfterEnd = await agent.post("/api/authority/evaluate").set("x-csrf-token", csrf).send({
      action: "send_outreach", agreementId, brandId: brand.id, productIds: [product.id],
      businessId: business.id, channel: "independent_retail"
    });
    assert.equal(blockedAfterEnd.body.authority.outcome, "denied");

    const histories = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM authority_evaluations WHERE workspace_id=$1",
      [workspaceId]
    );
    assert.ok(histories.rows[0]!.count >= 4);
    const versions = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM representation_agreement_versions WHERE agreement_id=$1",
      [agreementId]
    );
    assert.ok(versions.rows[0]!.count >= 5);
    const audit = await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM audit_events WHERE workspace_id=$1
        AND target_type IN ('representation_agreement','placement_opportunity','authority_evaluation')`,
      [workspaceId]
    );
    assert.ok(audit.rows[0]!.count >= 8);
  });

  it("conceals Phase 4 records across workspaces and preserves append-only authority history", async () => {
    const active = await login();
    const other = await login("canceled-paid@synthetic.ryva.test");
    const agreement = await database.query<{ id: string }>(
      "SELECT id FROM representation_agreements WHERE workspace_id=$1 LIMIT 1",
      [active.workspaceId]
    );
    assert.ok(agreement.rows[0]);
    const concealed = await other.agent.get(`/api/agreements/${agreement.rows[0].id}`);
    assert.equal(concealed.status, 404);
    await assert.rejects(
      database.query("DELETE FROM authority_evaluations WHERE workspace_id=$1", [active.workspaceId]),
      /append-only/
    );
    await assert.rejects(
      database.query("UPDATE representation_agreement_versions SET reason='tampered' WHERE agreement_id=$1", [agreement.rows[0].id]),
      /append-only/
    );
  });

  it("previews imported Agreement terms without committing or creating authority", async () => {
    const { agent, csrf, workspaceId } = await login();
    const before = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM representation_agreements WHERE workspace_id=$1",
      [workspaceId]
    );
    const preview = await agent.post("/api/imports/preview").set("x-csrf-token", csrf).send({
      recordType: "representation_agreement",
      sourceName: "synthetic-agreement-terms.csv",
      csv: "brand_id,effective_at,product_ids,channels,commission_basis\n00000000-0000-4000-8000-000000000001,2026-07-01T00:00:00Z,00000000-0000-4000-8000-000000000002,independent_retail,Net paid invoices\n",
      mapping: {
        brand_id: "brandId", effective_at: "effectiveAt", product_ids: "productIds",
        channels: "channels", commission_basis: "commissionBasis"
      }
    });
    assert.equal(preview.status, 201, preview.text);
    assert.equal(preview.body.summary.commitAvailable, false);
    assert.ok(preview.body.summary.authorityImplications.some((item: string) => item.includes("cannot activate authority")));
    const afterResult = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM representation_agreements WHERE workspace_id=$1",
      [workspaceId]
    );
    assert.equal(afterResult.rows[0]!.count, before.rows[0]!.count);
  });
});
