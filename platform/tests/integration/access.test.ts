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
  completeProgram,
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

describe("canonical Program and Ryva Pro lifecycle", () => {
  it("keeps account-only settings available while Program and operations remain unavailable", async () => {
    const { agent, response } = await login("uncertified@synthetic.ryva.test");
    const workspaceId = response.body.user.workspaceId as string;
    assert.equal(response.body.access.mode, "account_only");
    assert.equal(response.body.access.canAccessProgram, false);
    assert.equal((await agent.get(`/api/workspaces/${workspaceId}/profile`)).status, 200);
    assert.equal((await agent.get("/api/program")).status, 403);
    assert.equal((await agent.get("/api/home")).status, 403);
    assert.equal((await agent.get("/api/certification")).status, 404);
  });

  it("allows an incomplete Program but denies the operating platform", async () => {
    const { agent, csrf, response } = await login("grace@synthetic.ryva.test");
    assert.equal(response.body.access.mode, "program_only");
    assert.equal(response.body.access.canAccessProgram, true);
    assert.equal(response.body.access.isProgramCompleted, false);
    assert.equal((await agent.get("/api/program")).status, 200);
    assert.equal((await agent.get("/api/home")).status, 403);
    assert.equal((await agent.post("/api/subscription/checkout").set("x-csrf-token", csrf)).status, 403);
  });

  it("unlocks the operating platform during the completion-based Pro period", async () => {
    const { agent, response } = await login("expired@synthetic.ryva.test");
    assert.equal(response.body.access.isProTrialActive, true);
    assert.equal(response.body.access.canAccessOperatingPlatform, true);
    assert.equal(response.body.access.proAccessState, "trial_active");
    assert.equal((await agent.get("/api/home")).status, 200);
  });

  it("retains Program access after trial expiry while operations are locked", async () => {
    const { agent, response } = await login("canceled-ended@synthetic.ryva.test");
    assert.equal(response.body.access.mode, "pro_required");
    assert.equal(response.body.access.canAccessProgram, true);
    assert.equal(response.body.access.isProgramCompleted, true);
    assert.equal(response.body.access.canAccessOperatingPlatform, false);
    assert.equal((await agent.get("/api/program")).status, 200);
    assert.equal((await agent.get("/api/home")).status, 403);
  });

  it("accepts active and canceled-paid-through Pro after Program completion", async () => {
    const active = await login("active@synthetic.ryva.test");
    assert.equal(active.response.body.access.proAccessState, "subscription_active");
    assert.equal((await active.agent.get("/api/home")).status, 200);
    const paidThrough = await login("canceled-paid@synthetic.ryva.test");
    assert.equal(paidThrough.response.body.access.proAccessState, "paid_through");
    assert.equal((await paidThrough.agent.get("/api/home")).status, 200);
  });

  it("does not let a subscription without Program completion unlock operations", async () => {
    const { agent, csrf, response } = await login("uncertified@synthetic.ryva.test");
    assert.equal(response.body.access.subscriptionStatus, "active");
    assert.equal(response.body.access.canAccessOperatingPlatform, false);
    const checkout = await agent.post("/api/subscription/checkout").set("x-csrf-token", csrf);
    assert.equal(checkout.status, 403);
    assert.equal(checkout.body.type, "https://ryva.example/problems/program_completion_required");
  });

  it("does not let historical certification changes affect access or sessions", async () => {
    const { agent, response } = await login("active@synthetic.ryva.test");
    await reconcileCredentialEvent(database, {
      eventId: `synthetic-revoke-${Date.now()}`,
      eventType: "credential.revoked",
      userId: response.body.user.id as string,
      providerReference: `synthetic:${String(response.body.user.id)}`,
      credentialType: "Historical Ryva certification",
      credentialNumberMasked: "••••0001",
      status: "revoked",
      verifiedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString()
    }, "test-historical-credential");
    const session = await agent.get("/api/session");
    assert.equal(session.status, 200);
    assert.equal(session.body.access.canAccessOperatingPlatform, true);
    assert.equal((await agent.get("/api/home")).status, 200);
    if (!configuration.STRIPE_SECRET_KEY || !configuration.STRIPE_PRICE_ID) {
      const checkout = await agent.post("/api/subscription/checkout").set("x-csrf-token", csrfFrom(response));
      assert.equal(checkout.status, 503);
      assert.equal(checkout.body.type, "https://ryva.example/problems/billing_not_configured");
    }
  });

  it("records completion once without restarting or extending the trial", async () => {
    const user = await database.query<{ id: string; workspace_id: string }>(
      `SELECT u.id,wm.workspace_id FROM users u
       JOIN workspace_memberships wm ON wm.user_id=u.id
       WHERE u.email='grace@synthetic.ryva.test'`
    );
    const input = {
      userId: user.rows[0]!.id,
      workspaceId: user.rows[0]!.workspace_id,
      requestId: "program-completion-first"
    };
    const first = await completeProgram(database, configuration, input);
    const second = await completeProgram(database, configuration, {
      ...input,
      requestId: "program-completion-repeat"
    });
    assert.equal(first.newlyCompleted, true);
    assert.equal(second.newlyCompleted, false);
    assert.equal(second.completedAt, first.completedAt);
    assert.equal(second.trialStartedAt, first.trialStartedAt);
    assert.equal(second.trialEndsAt, first.trialEndsAt);
    const audits = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM audit_events WHERE action='program.completed' AND actor_user_id=$1",
      [input.userId]
    );
    assert.equal(audits.rows[0]!.count, 1);
  });

  it("keeps staff access independent of Program and Pro", async () => {
    const admin = await login("admin@synthetic.ryva.test", await staffCode("admin@synthetic.ryva.test"));
    assert.equal(admin.response.body.access.reason, "staff");
    assert.equal((await admin.agent.get("/api/admin/jobs")).status, 200);
    const representative = await login("active@synthetic.ryva.test");
    assert.equal((await representative.agent.get("/api/admin/jobs")).status, 403);
  });

  it("continues to conceal other workspaces", async () => {
    const active = await login("canceled-paid@synthetic.ryva.test");
    const other = await database.query<{ workspace_id: string }>(
      `SELECT wm.workspace_id FROM workspace_memberships wm
       JOIN users u ON u.id=wm.user_id WHERE u.email='uncertified@synthetic.ryva.test'`
    );
    assert.equal((await active.agent.get(`/api/workspaces/${other.rows[0]!.workspace_id}/profile`)).status, 404);
  });
});

describe("applicable QLT controls", () => {
  it("requires a valid CSRF token for authenticated mutation", async () => {
    const { agent, response } = await login("canceled-paid@synthetic.ryva.test");
    const workspaceId = response.body.user.workspaceId as string;
    assert.equal((await agent.put(`/api/workspaces/${workspaceId}/settings`).send({})).status, 403);
  });

  it("prevents stale optimistic-concurrency updates", async () => {
    const { agent, csrf, response } = await login("canceled-paid@synthetic.ryva.test");
    const workspaceId = response.body.user.workspaceId as string;
    const original = await agent.get(`/api/workspaces/${workspaceId}/profile`);
    const profile = original.body.profile;
    const payload = {
      version: profile.version,
      firstName: "Casey",
      lastName: "Current",
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
    assert.equal((await agent.put(`/api/workspaces/${workspaceId}/profile`).set("x-csrf-token", csrf).send(payload)).status, 200);
    assert.equal((await agent.put(`/api/workspaces/${workspaceId}/profile`).set("x-csrf-token", csrf).send(payload)).status, 409);
  });

  it("makes audit events append-only in PostgreSQL", async () => {
    const event = await database.query<{ id: string }>("SELECT id FROM audit_events LIMIT 1");
    assert.ok(event.rows[0]);
    await assert.rejects(database.query("UPDATE audit_events SET outcome='failed' WHERE id=$1", [event.rows[0]!.id]), /append-only/);
  });

  it("keeps jobs idempotent and lease-owned through completion", async () => {
    const first = await enqueueJob(database, { kind: "session.cleanup", idempotencyKey: "synthetic-job-idempotency" });
    const duplicate = await enqueueJob(database, { kind: "session.cleanup", idempotencyKey: "synthetic-job-idempotency" });
    assert.equal(first.id, duplicate.id);
    assert.equal(duplicate.inserted, false);
    const claimed = await claimJobs(database, "test-worker");
    const job = claimed.find((item) => item.id === first.id);
    assert.ok(job);
    assert.equal(await completeJob(database, first.id, "wrong-worker"), false);
    assert.equal(await completeJob(database, first.id, "test-worker"), true);
  });
});
