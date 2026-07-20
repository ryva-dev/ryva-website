import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request, { type Response } from "supertest";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig, resetConfigForTests } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";
import { migrate } from "../../packages/database/src/migrate.js";
import { seedSynthetic, syntheticPassword } from "../../packages/database/src/seed.js";

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
  return { agent, csrf: csrfFrom(response) };
}

async function source(agent: Agent, csrf: string, suffix: string) {
  const response = await agent.post("/api/sources").set("x-csrf-token", csrf).send({
    sourceType: "human_reviewed_fixture",
    reference: `Synthetic ${suffix} evidence`,
    url: `https://example.test/${suffix}`,
    ownerOrProvider: "Synthetic fixture provider",
    rightsClassification: "public_reference",
    confidentiality: "normal",
    observedFrom: "2026-07-01T12:00:00.000Z"
  });
  assert.equal(response.status, 201, response.text);
  return response.body.source.id as string;
}

async function evidence(
  agent: Agent,
  csrf: string,
  type: string,
  id: string,
  sourceId: string,
  claim: string
) {
  const response = await agent.post(`/api/records/${type}/${id}/evidence`).set("x-csrf-token", csrf).send({
    exactClaim: claim,
    evidenceClass: "direct_evidence",
    verificationStatus: "reviewed",
    sourceId,
    supports: claim,
    doesNotSupport: "Does not establish representation authority.",
    confidence: "supported",
    context: "Synthetic Phase 3 acceptance fixture",
    limitations: "Synthetic fixture; not external intelligence.",
    contraryEvidence: "",
    permittedUse: "Automated acceptance testing",
    prohibitedInference: "Do not represent as live market intelligence.",
    observedAt: "2026-07-01T12:00:00.000Z"
  });
  assert.equal(response.status, 201, response.text);
  return response.body.evidence.id as string;
}

async function task(agent: Agent, csrf: string, type: string, id: string, title: string) {
  const response = await agent.post(`/api/records/${type}/${id}/tasks`).set("x-csrf-token", csrf).send({
    title, priority: "medium", createdReason: "Synthetic acceptance gate", mandatoryGate: true
  });
  assert.equal(response.status, 201, response.text);
  return response.body.task.id as string;
}

async function decision(agent: Agent, csrf: string, type: string, id: string, outcome: string) {
  const response = await agent.post(`/api/records/${type}/${id}/decisions`).set("x-csrf-token", csrf).send({
    question: `Should this ${type} proceed?`,
    scope: "Current synthetic evidence only",
    outcome,
    rationale: "Human-owned synthetic acceptance decision.",
    confidence: "supported",
    nextAction: "Perform the next documented review.",
    status: "issued"
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

describe("Phase 3 Product, Brand, and Buyer Intelligence", () => {
  it("INT-001 exposes classified Product evidence, provenance, unknowns, risks, and human qualification without a score", async () => {
    const { agent, csrf } = await login();
    const brand = await agent.post("/api/records/brand").set("x-csrf-token", csrf).send({ name: "Synthetic Product Evidence Brand" });
    const product = await agent.post("/api/records/product").set("x-csrf-token", csrf).send({
      name: "Synthetic Evidence Product", brandId: brand.body.record.id, category: "Gift", summary: "Synthetic fixture"
    });
    const sourceId = await source(agent, csrf, "product-intelligence");
    const evidenceId = await evidence(agent, csrf, "product", product.body.record.id, sourceId, "Synthetic packaging review indicates shelf readiness.");
    const unknown = await agent.post(`/api/records/product/${product.body.record.id}/evidence`).set("x-csrf-token", csrf).send({
      exactClaim: "Repeat-purchase behavior is unknown.",
      evidenceClass: "unknown", verificationStatus: "reviewed",
      unknownReason: "No reorder history exists.", supports: "", doesNotSupport: "",
      confidence: "insufficient", context: "Synthetic test", limitations: "",
      contraryEvidence: "", permittedUse: "Internal review", prohibitedInference: "Do not infer repeat demand."
    });
    assert.equal(unknown.status, 201, unknown.text);
    const updated = await agent.patch(`/api/intelligence/products/${product.body.record.id}`).set("x-csrf-token", csrf).send({
      version: 1,
      changes: { wholesaleReadiness: "ready", packagingReadiness: "ready" },
      evidenceByField: { wholesaleReadiness: [evidenceId], packagingReadiness: [evidenceId] },
      origin: "human_confirmed"
    });
    assert.equal(updated.status, 200, updated.text);
    const risk = await agent.post(`/api/records/product/${product.body.record.id}/risks`).set("x-csrf-token", csrf).send({
      riskType: "fulfillment", severity: "medium", description: "Synthetic lead-time uncertainty.", mitigation: "Confirm lead time."
    });
    assert.equal(risk.status, 201, risk.text);
    const nextTask = await task(agent, csrf, "product", product.body.record.id, "Confirm wholesale terms");
    const humanDecision = await decision(agent, csrf, "product", product.body.record.id, "Proceed with qualification");
    const qualified = await agent.post(`/api/intelligence/products/${product.body.record.id}/status`).set("x-csrf-token", csrf).send({
      version: 2, toStatus: "qualified", decisionId: humanDecision, nextActionTaskId: nextTask
    });
    assert.equal(qualified.status, 200, qualified.text);
    const detail = await agent.get(`/api/intelligence/products/${product.body.record.id}`);
    assert.equal(detail.status, 200, detail.text);
    assert.equal(detail.body.product.status, "qualified");
    assert.equal(
      detail.body.evidence.find((item: { evidenceClass: string }) => item.evidenceClass === "direct_evidence").sourceReference.startsWith("Synthetic"),
      true
    );
    assert.equal(detail.body.unknowns.length, 1);
    assert.equal(detail.body.risks.length, 1);
    assert.equal(detail.body.decisions[0].status, "issued");
    assert.equal("score" in detail.body.product, false);
    assert.equal(JSON.stringify(detail.body).toLowerCase().includes("productscore"), false);
  });

  it("INT-003 preserves superseded observations and rejects AI-origin writes at the public boundary", async () => {
    const { agent, csrf } = await login();
    const brand = await agent.post("/api/records/brand").set("x-csrf-token", csrf).send({ name: "Synthetic Observation Brand" });
    const product = await agent.post("/api/records/product").set("x-csrf-token", csrf).send({
      name: "Synthetic Observation Product", brandId: brand.body.record.id, category: "Pet"
    });
    const sourceId = await source(agent, csrf, "observations");
    const first = await agent.post(`/api/intelligence/product/${product.body.record.id}/observations`).set("x-csrf-token", csrf).send({
      metricCode: "review_volume", value: 120, unit: "reviews",
      evidenceClass: "direct_evidence", confidence: "limited", sourceId,
      observedAt: "2026-07-01T12:00:00.000Z", acquisitionContext: "Synthetic fixture capture",
      limitations: "Point-in-time only", origin: "externally_sourced"
    });
    assert.equal(first.status, 201, first.text);
    const second = await agent.post(`/api/intelligence/product/${product.body.record.id}/observations`).set("x-csrf-token", csrf).send({
      metricCode: "review_volume", value: 140, unit: "reviews",
      evidenceClass: "direct_evidence", confidence: "limited", sourceId,
      observedAt: "2026-07-15T12:00:00.000Z", acquisitionContext: "Synthetic fixture recapture",
      limitations: "Point-in-time only", origin: "externally_sourced", supersedesId: first.body.observation.id
    });
    assert.equal(second.status, 201, second.text);
    const detail = await agent.get(`/api/intelligence/products/${product.body.record.id}`);
    assert.equal(detail.body.observations.length, 2);
    assert.equal(detail.body.observations.find((item: { id: string }) => item.id === first.body.observation.id).status, "superseded");
    const aiWrite = await agent.post(`/api/intelligence/product/${product.body.record.id}/observations`).set("x-csrf-token", csrf).send({
      metricCode: "trend", value: "rising", evidenceClass: "model_generated_inference",
      confidence: "limited", sourceId, acquisitionContext: "Unreviewed model output",
      limitations: "", origin: "ai_suggested"
    });
    assert.equal(aiWrite.status, 422);
  });

  it("INT-004 compares two to four Products in an explicit context without ranking or numerical scoring", async () => {
    const { agent, csrf } = await login();
    const brand = await agent.post("/api/records/brand").set("x-csrf-token", csrf).send({ name: "Synthetic Comparison Brand" });
    const first = await agent.post("/api/records/product").set("x-csrf-token", csrf).send({ name: "Synthetic Compare A", brandId: brand.body.record.id, category: "Beauty" });
    const second = await agent.post("/api/records/product").set("x-csrf-token", csrf).send({ name: "Synthetic Compare B", brandId: brand.body.record.id, category: "Beauty" });
    const comparison = await agent.post("/api/intelligence/comparisons").set("x-csrf-token", csrf).send({
      name: "Synthetic salon comparison",
      productIds: [first.body.record.id, second.body.record.id],
      context: { category: "Beauty", geography: "New York", channel: "salon", buyerType: "independent salon", period: "2026 Q3", evidenceDate: "2026-07-19" }
    });
    assert.equal(comparison.status, 201, comparison.text);
    assert.equal(comparison.body.products.length, 2);
    assert.equal(comparison.body.comparison.context.channel, "salon");
    assert.ok(comparison.body.limitations.some((item: string) => item.includes("No numerical")));
    assert.equal(JSON.stringify(comparison.body).toLowerCase().includes("\"score\""), false);
    assert.equal(JSON.stringify(comparison.body).toLowerCase().includes("\"rank\""), false);
  });

  it("INT-005 gates Brand Contact Ready and blocks authority until a verified Agreement exists", async () => {
    const { agent, csrf } = await login();
    const brand = await agent.post("/api/records/brand").set("x-csrf-token", csrf).send({ name: "Synthetic Diligence Brand" });
    const earlyDecision = await decision(agent, csrf, "brand", brand.body.record.id, "Proceed to Contact Ready");
    const earlyTask = await task(agent, csrf, "brand", brand.body.record.id, "Review professional contact");
    const blocked = await agent.post(`/api/intelligence/brands/${brand.body.record.id}/stage`).set("x-csrf-token", csrf).send({
      version: 1, toStage: "contact_ready", reason: "Synthetic gate test", decisionId: earlyDecision, nextActionTaskId: earlyTask
    });
    assert.equal(blocked.status, 422);
    const identity = await agent.patch(`/api/records/brand/${brand.body.record.id}`).set("x-csrf-token", csrf).send({
      version: 1, changes: { identityStatus: "reviewing" }
    });
    assert.equal(identity.status, 200, identity.text);
    const sourceId = await source(agent, csrf, "brand-diligence");
    const evidenceId = await evidence(agent, csrf, "brand", brand.body.record.id, sourceId, "Synthetic source identifies a professional brand contact route.");
    const intelligence = await agent.patch(`/api/intelligence/brands/${brand.body.record.id}`).set("x-csrf-token", csrf).send({
      version: 2, changes: { contactPurpose: "Request documented wholesale availability." },
      evidenceByField: { contactPurpose: [evidenceId] }, origin: "human_confirmed"
    });
    assert.equal(intelligence.status, 200, intelligence.text);
    const contact = await agent.post("/api/records/contact").set("x-csrf-token", csrf).send({
      parentType: "brand", parentId: brand.body.record.id, name: "Synthetic Brand Contact",
      role: "Wholesale", email: "brand-contact@synthetic.ryva.test"
    });
    const verified = await agent.patch(`/api/contacts/${contact.body.record.id}/verification`).set("x-csrf-token", csrf).send({
      version: 1, status: "verified", sourceId, observedAt: "2026-07-01T12:00:00.000Z",
      notes: "Human reviewer confirmed the professional route in the synthetic source."
    });
    assert.equal(verified.status, 200, verified.text);
    const readyDecision = await decision(agent, csrf, "brand", brand.body.record.id, "Proceed to Contact Ready");
    const ready = await agent.post(`/api/intelligence/brands/${brand.body.record.id}/stage`).set("x-csrf-token", csrf).send({
      version: 3, toStage: "contact_ready", reason: "All pre-contact diligence gates passed.", decisionId: readyDecision, nextActionTaskId: earlyTask
    });
    assert.equal(ready.status, 200, ready.text);
    const authorityDecision = await decision(agent, csrf, "brand", brand.body.record.id, "Authorize representation");
    const unauthorized = await agent.post(`/api/intelligence/brands/${brand.body.record.id}/stage`).set("x-csrf-token", csrf).send({
      version: 4, toStage: "authorized", reason: "No Agreement exists.", decisionId: authorityDecision, nextActionTaskId: earlyTask
    });
    assert.equal(unauthorized.status, 409);
    assert.ok(unauthorized.body.type.endsWith("/representation_agreement_required"));
  });

  it("INT-006 and INT-007 require verified Buyer authority, evidence-linked match review, and human qualification", async () => {
    const { agent, csrf } = await login();
    const business = await agent.post("/api/records/business").set("x-csrf-token", csrf).send({
      name: "Synthetic Qualified Boutique", businessType: "Independent boutique", category: "Gift"
    });
    const brand = await agent.post("/api/records/brand").set("x-csrf-token", csrf).send({ name: "Synthetic Match Brand" });
    const product = await agent.post("/api/records/product").set("x-csrf-token", csrf).send({
      name: "Synthetic Match Product", brandId: brand.body.record.id, category: "Gift"
    });
    const sourceId = await source(agent, csrf, "buyer-qualification");
    const evidenceId = await evidence(agent, csrf, "business", business.body.record.id, sourceId, "Synthetic Buyer is stated to control Gift category purchasing.");
    const profile = await agent.patch(`/api/intelligence/businesses/${business.body.record.id}`).set("x-csrf-token", csrf).send({
      version: 1,
      changes: {
        assortmentSummary: "Curated independent gifts.",
        targetCustomerSummary: "Local premium gift shopper.",
        pricePositioning: "premium",
        fitRationale: "Category and price context are aligned."
      },
      evidenceByField: {
        assortmentSummary: [evidenceId], targetCustomerSummary: [evidenceId],
        pricePositioning: [evidenceId], fitRationale: [evidenceId]
      },
      origin: "human_confirmed"
    });
    assert.equal(profile.status, 200, profile.text);
    const contact = await agent.post("/api/records/contact").set("x-csrf-token", csrf).send({
      parentType: "business", parentId: business.body.record.id, name: "Synthetic Gift Buyer",
      role: "Category Buyer", email: "gift-buyer@synthetic.ryva.test"
    });
    const verifiedContact = await agent.patch(`/api/contacts/${contact.body.record.id}/verification`).set("x-csrf-token", csrf).send({
      version: 1, status: "verified", sourceId, observedAt: "2026-07-01T12:00:00.000Z",
      notes: "Human reviewer confirmed the professional contact route."
    });
    assert.equal(verifiedContact.status, 200, verifiedContact.text);
    const buyer = await agent.post(`/api/businesses/${business.body.record.id}/buyers`).set("x-csrf-token", csrf).send({
      contactId: contact.body.record.id, buyerRole: "evaluator",
      decisionContext: "Evaluates the Gift category.", authorityEvidence: null
    });
    assert.equal(buyer.status, 201, buyer.text);
    const verifiedBuyer = await agent.patch(`/api/businesses/${business.body.record.id}/buyers/${buyer.body.buyer.id}`).set("x-csrf-token", csrf).send({
      version: 1, buyerRole: "decision_maker", decisionContext: "Controls the Gift category buying decision.",
      authorityEvidence: "Linked synthetic direct evidence.", authorityEvidenceId: evidenceId,
      statedNeeds: "Differentiated gift product", buyingWindow: "2026 Q3",
      decisionProcess: "Buyer review followed by owner sign-off.", verificationStatus: "verified"
    });
    assert.equal(verifiedBuyer.status, 200, verifiedBuyer.text);
    const match = await agent.post("/api/intelligence/matches").set("x-csrf-token", csrf).send({
      productId: product.body.record.id, businessId: business.body.record.id,
      context: { channel: "physical retail", geography: "New York", buyerType: "independent boutique", priceBand: "premium", period: "2026 Q3" },
      rationale: "The Product category and Buyer assortment align in this stated context.",
      confidence: "limited",
      materialStatements: [
        { statement: "Category alignment is recorded.", classification: "verified_fact" },
        { statement: "Sell-through remains unknown.", classification: "unknown" }
      ],
      evidenceIds: [evidenceId], missingEvidence: ["Product sell-through history"],
      contraryEvidence: "No Product-side evidence has been linked.", origin: "user_entered"
    });
    assert.equal(match.status, 201, match.text);
    const matchDecision = await decision(agent, csrf, "business", business.body.record.id, "Conditionally qualify Product match");
    const matchTask = await task(agent, csrf, "business", business.body.record.id, "Obtain Product-side evidence");
    const decidedMatch = await agent.patch(`/api/intelligence/matches/${match.body.match.id}`).set("x-csrf-token", csrf).send({
      version: 1, status: "conditional", decisionId: matchDecision, nextActionTaskId: matchTask
    });
    assert.equal(decidedMatch.status, 200, decidedMatch.text);
    const qualificationDecision = await decision(agent, csrf, "business", business.body.record.id, "Qualify Business");
    const qualificationTask = await task(agent, csrf, "business", business.body.record.id, "Recheck conflicts before outreach");
    const qualified = await agent.post(`/api/intelligence/businesses/${business.body.record.id}/qualification`).set("x-csrf-token", csrf).send({
      version: 2, toStatus: "qualified", decisionId: qualificationDecision, nextActionTaskId: qualificationTask
    });
    assert.equal(qualified.status, 200, qualified.text);
    const detail = await agent.get(`/api/intelligence/businesses/${business.body.record.id}`);
    assert.equal(detail.body.business.qualification_status, "qualified");
    assert.equal(detail.body.buyers[0].verificationStatus, "verified");
    assert.equal(detail.body.matches[0].status, "conditional");
    assert.ok(detail.body.conflictScope.toLowerCase().includes("current ryva workspace"));
  });

  it("keeps Phase 3 records workspace-isolated and import previews explicit about authority", async () => {
    const active = await login();
    const brand = await active.agent.post("/api/records/brand").set("x-csrf-token", active.csrf).send({ name: "Synthetic Isolated Intelligence" });
    const other = await login("canceled-paid@synthetic.ryva.test");
    assert.equal((await other.agent.get(`/api/intelligence/brands/${brand.body.record.id}`)).status, 404);
    const preview = await active.agent.post("/api/imports/preview").set("x-csrf-token", active.csrf).send({
      recordType: "product", sourceName: "Synthetic Phase 3 import.csv",
      observedAt: "2026-07-01T12:00:00.000Z",
      csv: `name,category,brandId,wholesale\nSynthetic Imported Product,Gift,${brand.body.record.id},available\n`,
      mapping: { name: "name", category: "category", brandId: "brandId", wholesale: "wholesaleReadiness" }
    });
    assert.equal(preview.status, 201, preview.text);
    assert.equal(preview.body.summary.provenance.verificationStatus, "unverified");
    assert.ok(preview.body.summary.authorityImplications.some((item: string) => item.includes("cannot qualify")));
    assert.equal(preview.body.summary.commitAvailable, false);
  });
});
