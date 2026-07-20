import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { generate } from "otplib";
import request, { type Response } from "supertest";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig, resetConfigForTests } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";
import { migrate } from "../../packages/database/src/migrate.js";
import { seedSynthetic, syntheticPassword } from "../../packages/database/src/seed.js";
import {
  claimJobs,
  completeJob,
  decryptSecret,
  enqueueJob,
  reconcileCredentialEvent
} from "../../packages/domain/src/index.js";

const configuration = loadConfig(process.env);
const database = createDatabase(configuration);
let app: ReturnType<typeof createApp>;

function csrfFrom(response: Response): string {
  const values = response.headers["set-cookie"];
  const cookies = Array.isArray(values) ? values : values ? [values] : [];
  const csrf = cookies.find((value) => value.startsWith("ryva_csrf="));
  assert.ok(csrf, "CSRF cookie should be set");
  return decodeURIComponent(csrf.split(";")[0]!.slice("ryva_csrf=".length));
}

async function login(email: string, mfaCode?: string) {
  const agent = request.agent(app);
  const response = await agent
    .post("/api/auth/login")
    .send({ email, password: syntheticPassword, ...(mfaCode ? { mfaCode } : {}) });
  assert.equal(response.status, 200, response.text);
  return { agent, csrf: csrfFrom(response), response };
}

async function staffCode(email: string): Promise<string> {
  const result = await database.query<{ mfa_secret_ciphertext: string }>(
    "SELECT mfa_secret_ciphertext FROM users WHERE email=$1",
    [email]
  );
  const cipher = result.rows[0]?.mfa_secret_ciphertext;
  assert.ok(cipher);
  return generate({ secret: decryptSecret(cipher, configuration.FIELD_ENCRYPTION_KEY) });
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

describe("ACC-001 through ACC-010", () => {
  it("ACC-001 blocks operational access for an uncertified user", async () => {
    const { agent } = await login("uncertified@synthetic.ryva.test");
    const home = await agent.get("/api/home");
    assert.equal(home.status, 403);
    const certification = await agent.get("/api/certification");
    assert.equal(certification.status, 200);
    assert.equal(certification.body.access.mode, "certification_required");
  });

  it("ACC-002 grants an eligible representative secure operational access", async () => {
    const { agent } = await login("active@synthetic.ryva.test");
    const home = await agent.get("/api/home");
    assert.equal(home.status, 200);
    assert.equal(home.body.access.mode, "full");
    assert.ok(home.headers["content-security-policy"]);
    assert.ok(home.headers["x-request-id"]);
  });

  it("ACC-003 applies read-only credential grace and rejects mutation", async () => {
    const { agent, csrf } = await login("grace@synthetic.ryva.test");
    const home = await agent.get("/api/home");
    assert.equal(home.status, 200);
    assert.equal(home.body.access.mode, "read_only");
    assert.ok(home.body.access.capabilities.includes("export:request"));
    const workspaceId = home.body.account.workspaceId as string;
    const profile = await agent.get(`/api/workspaces/${workspaceId}/profile`);
    const update = await agent
      .put(`/api/workspaces/${workspaceId}/profile`)
      .set("x-csrf-token", csrf)
      .send({ ...profile.body.profile, name: "Should Not Save" });
    assert.equal(update.status, 403);
  });

  it("ACC-004 removes operational reads after credential grace", async () => {
    const { agent } = await login("expired@synthetic.ryva.test");
    assert.equal((await agent.get("/api/home")).status, 403);
    const certification = await agent.get("/api/certification");
    assert.equal(certification.status, 200);
    assert.equal(certification.body.access.mode, "restricted");
  });

  it("ACC-005 follows the suspension record's read-only policy", async () => {
    const readable = await login("suspended-read@synthetic.ryva.test");
    assert.equal((await readable.agent.get("/api/home")).status, 200);
    const blocked = await login("suspended-blocked@synthetic.ryva.test");
    assert.equal((await blocked.agent.get("/api/home")).status, 403);
  });

  it("ACC-006 immediately invalidates sessions after a trusted revocation", async () => {
    const { agent } = await login("active@synthetic.ryva.test");
    const user = await database.query<{ id: string }>(
      "SELECT id FROM users WHERE email='active@synthetic.ryva.test'"
    );
    const userId = user.rows[0]!.id;
    await reconcileCredentialEvent(
      database,
      {
        eventId: `synthetic-revoke-${Date.now()}`,
        eventType: "credential.revoked",
        userId,
        providerReference: `synthetic:${userId}`,
        credentialType: "Ryva Brand Placement Certification",
        credentialNumberMasked: "••••0001",
        status: "revoked",
        verifiedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString()
      },
      "test-revocation"
    );
    assert.equal((await agent.get("/api/session")).status, 401);
  });

  it("ACC-007 honors canceled paid-through access and ends it afterward", async () => {
    const paid = await login("canceled-paid@synthetic.ryva.test");
    assert.equal((await paid.agent.get("/api/home")).body.access.mode, "full");
    const ended = await login("canceled-ended@synthetic.ryva.test");
    assert.equal((await ended.agent.get("/api/home")).status, 403);
    assert.equal((await ended.agent.get("/api/subscription")).body.access.mode, "subscription_required");
  });

  it("ACC-008 conceals another workspace and enforces server-side tenancy", async () => {
    const active = await login("canceled-paid@synthetic.ryva.test");
    const other = await database.query<{ workspace_id: string }>(
      `SELECT wm.workspace_id FROM workspace_memberships wm
       JOIN users u ON u.id=wm.user_id WHERE u.email='uncertified@synthetic.ryva.test'`
    );
    assert.equal(
      (await active.agent.get(`/api/workspaces/${other.rows[0]!.workspace_id}/profile`)).status,
      404
    );
  });

  it("ACC-009 restricts support to an active field-scoped grant", async () => {
    const support = await login(
      "support@synthetic.ryva.test",
      await staffCode("support@synthetic.ryva.test")
    );
    const target = await database.query<{ user_id: string; workspace_id: string }>(
      `SELECT u.id AS user_id, wm.workspace_id FROM users u
       JOIN workspace_memberships wm ON wm.user_id=u.id
       WHERE u.email='uncertified@synthetic.ryva.test'`
    );
    assert.equal(
      (await support.agent.get(`/api/workspaces/${target.rows[0]!.workspace_id}/profile`)).status,
      404
    );
    const admin = await login(
      "admin@synthetic.ryva.test",
      await staffCode("admin@synthetic.ryva.test")
    );
    const grant = await admin.agent
      .post("/api/admin/support-grants")
      .set("x-csrf-token", admin.csrf)
      .send({
        supportUserId: support.response.body.user.id,
        workspaceId: target.rows[0]!.workspace_id,
        ticketReference: "SYNTHETIC-100",
        reason: "Synthetic test of time-limited field-scoped support access.",
        allowedRecordTypes: ["profile"],
        allowedRecordIds: [target.rows[0]!.user_id],
        allowedFields: ["name"],
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      });
    assert.equal(grant.status, 201, grant.text);
    const scoped = await support.agent.get(`/api/support/grants/${grant.body.id}/profile`);
    assert.equal(scoped.status, 200);
    assert.deepEqual(Object.keys(scoped.body.profile), ["name"]);
  });

  it("ACC-010 prevents a representative from using Admin APIs", async () => {
    const representative = await login("canceled-paid@synthetic.ryva.test");
    assert.equal((await representative.agent.get("/api/admin/jobs")).status, 403);
  });
});

describe("applicable QLT controls", () => {
  it("requires a valid CSRF token for authenticated mutation", async () => {
    const { agent, response } = await login("canceled-paid@synthetic.ryva.test");
    const workspaceId = response.body.user.workspaceId as string;
    assert.equal(
      (await agent.put(`/api/workspaces/${workspaceId}/settings`).send({})).status,
      403
    );
  });

  it("prevents stale optimistic-concurrency updates", async () => {
    const { agent, csrf, response } = await login("canceled-paid@synthetic.ryva.test");
    const workspaceId = response.body.user.workspaceId as string;
    const original = await agent.get(`/api/workspaces/${workspaceId}/profile`);
    const profile = original.body.profile;
    const payload = {
      version: profile.version,
      name: "Casey Current",
      timeZone: profile.timeZone,
      locale: profile.locale,
      professionalTitle: "",
      outreachName: profile.outreachName,
      outreachSignature: "",
      currency: profile.currency,
      categoryInterests: [],
      businessTypeInterests: [],
      geographicPreferences: [],
      experienceLevel: "not_set",
      workingHours: {}
    };
    assert.equal(
      (await agent.put(`/api/workspaces/${workspaceId}/profile`).set("x-csrf-token", csrf).send(payload)).status,
      200
    );
    assert.equal(
      (await agent.put(`/api/workspaces/${workspaceId}/profile`).set("x-csrf-token", csrf).send(payload)).status,
      409
    );
  });

  it("makes audit events append-only in PostgreSQL", async () => {
    const event = await database.query<{ id: string }>("SELECT id FROM audit_events LIMIT 1");
    assert.ok(event.rows[0]);
    await assert.rejects(
      database.query("UPDATE audit_events SET outcome='failed' WHERE id=$1", [event.rows[0]!.id]),
      /append-only/
    );
  });

  it("keeps jobs idempotent and lease-owned through completion", async () => {
    const first = await enqueueJob(database, {
      kind: "session.cleanup",
      idempotencyKey: "synthetic-job-idempotency"
    });
    const duplicate = await enqueueJob(database, {
      kind: "session.cleanup",
      idempotencyKey: "synthetic-job-idempotency"
    });
    assert.equal(first.id, duplicate.id);
    assert.equal(duplicate.inserted, false);
    const claimed = await claimJobs(database, "test-worker");
    const job = claimed.find((item) => item.id === first.id);
    assert.ok(job);
    assert.equal(await completeJob(database, first.id, "wrong-worker"), false);
    assert.equal(await completeJob(database, first.id, "test-worker"), true);
  });
});
