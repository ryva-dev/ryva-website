import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

describe("Phase 2 connected record kernel", () => {
  it("creates related records and preserves material history", async () => {
    const { agent, csrf } = await login();
    const brand = await agent.post("/api/records/brand").set("x-csrf-token", csrf).send({
      name: "Synthetic Juniper Goods",
      website: "https://example.test/juniper"
    });
    assert.equal(brand.status, 201, brand.text);
    const product = await agent.post("/api/records/product").set("x-csrf-token", csrf).send({
      name: "Synthetic Juniper Brush",
      brandId: brand.body.record.id,
      category: "Home",
      summary: "Synthetic fixture"
    });
    assert.equal(product.status, 201, product.text);
    const context = await agent.get(`/api/records/brand/${brand.body.record.id}`);
    assert.equal(context.status, 200, context.text);
    assert.equal(context.body.related.length, 1);
    assert.ok(context.body.activities.some((item: { activityType: string }) => item.activityType === "record_created"));
    const audit = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM audit_events WHERE target_id=$1",
      [brand.body.record.id]
    );
    assert.ok(audit.rows[0]!.count >= 1);
  });

  it("requires provenance for non-unknown evidence and a reason for Unknown", async () => {
    const { agent, csrf } = await login();
    const brand = await agent.post("/api/records/brand").set("x-csrf-token", csrf).send({
      name: "Synthetic Evidence Brand"
    });
    const endpoint = `/api/records/brand/${brand.body.record.id}/evidence`;
    const base = {
      exactClaim: "The product has documented wholesale terms.",
      verificationStatus: "reviewed",
      supports: "",
      doesNotSupport: "",
      confidence: "limited",
      context: "",
      limitations: "",
      contraryEvidence: "",
      permittedUse: "Internal review",
      prohibitedInference: "Do not claim public availability."
    };
    const unsupported = await agent.post(endpoint).set("x-csrf-token", csrf).send({
      ...base,
      evidenceClass: "direct_evidence"
    });
    assert.equal(unsupported.status, 422);
    const unknown = await agent.post(endpoint).set("x-csrf-token", csrf).send({
      ...base,
      evidenceClass: "unknown",
      unknownReason: "Wholesale terms have not been supplied."
    });
    assert.equal(unknown.status, 201, unknown.text);
  });

  it("suggests duplicates without silently merging them", async () => {
    const { agent, csrf } = await login();
    const first = await agent.post("/api/records/brand").set("x-csrf-token", csrf).send({
      name: "Synthetic Exact Name"
    });
    assert.equal(first.status, 201);
    const suggestions = await agent.get("/api/records/brand/duplicates").query({
      name: "Synthetic Exact Name"
    });
    assert.equal(suggestions.status, 200);
    assert.equal(suggestions.body.candidates[0].id, first.body.record.id);
    const duplicate = await agent.post("/api/records/brand").set("x-csrf-token", csrf).send({
      name: "Synthetic Exact Name"
    });
    assert.equal(duplicate.status, 409);
    assert.equal((await database.query("SELECT id FROM brands WHERE public_name='Synthetic Exact Name'")).rowCount, 1);
  });

  it("applies workspace authorization before search and direct record reads", async () => {
    const active = await login();
    const created = await active.agent.post("/api/records/brand").set("x-csrf-token", active.csrf).send({
      name: "Synthetic Workspace Secret"
    });
    const other = await login("canceled-paid@synthetic.ryva.test");
    const search = await other.agent.get("/api/search").query({ q: "Workspace Secret" });
    assert.equal(search.status, 200);
    assert.equal(search.body.results.length, 0);
    assert.equal(
      (await other.agent.get(`/api/records/brand/${created.body.record.id}`)).status,
      404
    );
  });

  it("validates import previews without creating operational records", async () => {
    const { agent, csrf } = await login();
    const before = await database.query<{ count: number }>("SELECT count(*)::int AS count FROM brands");
    const preview = await agent.post("/api/imports/preview").set("x-csrf-token", csrf).send({
      recordType: "brand",
      sourceName: "Synthetic import.csv",
      csv: "name\nSynthetic Preview Only\n",
      mapping: { name: "name" }
    });
    assert.equal(preview.status, 201, preview.text);
    assert.equal(preview.body.summary.valid, 1);
    assert.equal(preview.body.summary.commitAvailable, false);
    const afterResult = await database.query<{ count: number }>("SELECT count(*)::int AS count FROM brands");
    assert.equal(afterResult.rows[0]!.count, before.rows[0]!.count);
  });

  it("hash-verifies document uploads and quarantines them until a clean scan", async () => {
    const { agent, csrf } = await login();
    const brand = await agent.post("/api/records/brand").set("x-csrf-token", csrf).send({
      name: "Synthetic Document Brand"
    });
    const content = Buffer.from("%PDF-1.4\nsynthetic fixture only\n");
    const created = await agent.post("/api/documents").set("x-csrf-token", csrf).send({
      subjectType: "brand",
      subjectId: brand.body.record.id,
      name: "synthetic-fixture.pdf",
      documentType: "supporting_material",
      mediaType: "application/pdf",
      byteSize: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
      confidentiality: "normal"
    });
    assert.equal(created.status, 201, created.text);
    const uploaded = await agent
      .put(created.body.upload.url)
      .set("x-csrf-token", csrf)
      .set("content-type", "application/pdf")
      .send(content);
    assert.equal(uploaded.status, 202, uploaded.text);
    assert.equal(uploaded.body.access, "quarantined_until_clean");
    assert.equal(
      (await agent.get(`/api/documents/${created.body.document.id}/content`)).status,
      404
    );
  });

  it("binds Buyer authority and human approval to exact workspace records and artifacts", async () => {
    const { agent, csrf } = await login();
    const business = await agent.post("/api/records/business").set("x-csrf-token", csrf).send({
      name: "Synthetic Buyer Business",
      businessType: "Independent retailer",
      category: "Gift"
    });
    const contact = await agent.post("/api/records/contact").set("x-csrf-token", csrf).send({
      name: "Synthetic Buyer Contact",
      parentType: "business",
      parentId: business.body.record.id,
      role: "Buyer"
    });
    const buyer = await agent
      .post(`/api/businesses/${business.body.record.id}/buyers`)
      .set("x-csrf-token", csrf)
      .send({
        contactId: contact.body.record.id,
        buyerRole: "evaluator",
        decisionContext: "Evaluates the synthetic seasonal assortment.",
        authorityEvidence: "Authority remains limited to evaluation."
      });
    assert.equal(buyer.status, 201, buyer.text);
    const requested = await agent
      .post(`/api/records/business/${business.body.record.id}/approvals`)
      .set("x-csrf-token", csrf)
      .send({
        actionType: "confirm_buyer_authority",
        artifact: "Synthetic exact authority statement v1",
        scope: "This Business Buyer record only"
      });
    assert.equal(requested.status, 201, requested.text);
    const changed = await agent
      .patch(`/api/approvals/${requested.body.approval.id}`)
      .set("x-csrf-token", csrf)
      .send({
        status: "approved",
        artifact: "Synthetic exact authority statement v2",
        conditions: ""
      });
    assert.equal(changed.status, 409);
    const approved = await agent
      .patch(`/api/approvals/${requested.body.approval.id}`)
      .set("x-csrf-token", csrf)
      .send({
        status: "approved",
        artifact: "Synthetic exact authority statement v1",
        conditions: "Do not infer purchasing authority."
      });
    assert.equal(approved.status, 200, approved.text);
    const territory = await agent.post("/api/territories").set("x-csrf-token", csrf).send({
      name: "Synthetic Northeast Specialty",
      territoryType: "hybrid",
      scope: { states: ["MA", "NY"], channel: "specialty" },
      status: "proposed"
    });
    assert.equal(territory.status, 201, territory.text);
    const view = await agent.post("/api/saved-views").set("x-csrf-token", csrf).send({
      recordType: "business",
      name: "Synthetic Buyer Review",
      definition: {
        filters: [{ field: "status", operator: "equals", value: "research" }],
        sort: [{ field: "updatedAt", direction: "desc" }],
        layout: "table"
      },
      scope: "private"
    });
    assert.equal(view.status, 201, view.text);
  });
});
