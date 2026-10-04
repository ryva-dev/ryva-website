import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { generate } from "otplib";
import request, { type Response } from "supertest";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";
import { migrate } from "../../packages/database/src/migrate.js";
import {
  decryptSecret,
  processTransactionalIdentityEmail,
  secureDigest,
  type TransactionalIdentityEmailProvider,
  type TransactionalIdentityMessage,
  verifyPassword
} from "../../packages/domain/src/index.js";

const configuration = loadConfig({
  ...process.env,
  TERMS_DOCUMENT_URL: "https://example.test/terms",
  TERMS_DOCUMENT_VERSION: "terms-test-v1",
  PRIVACY_DOCUMENT_URL: "https://example.test/privacy",
  PRIVACY_DOCUMENT_VERSION: "privacy-test-v1",
  RATE_LIMIT_LOGIN_MAX: "100"
});
const database = createDatabase(configuration);
let app: ReturnType<typeof createApp>;

function cookieFrom(response: Response, name: string): string {
  const values = response.headers["set-cookie"];
  const cookies = Array.isArray(values) ? values : values ? [values] : [];
  const found = cookies.find((value) => value.startsWith(`${name}=`));
  assert.ok(found, `${name} cookie should be set`);
  return decodeURIComponent(found.split(";")[0]!.slice(name.length + 1));
}

async function publicCsrf(agent: ReturnType<typeof request.agent>): Promise<string> {
  const response = await agent.get("/api/identity/csrf");
  assert.equal(response.status, 204, response.text);
  return cookieFrom(response, "ryva_public_csrf");
}

const registration = {
  firstName: "Jordan",
  lastName: "Customer",
  email: "jordan.identity@example.test",
  password: "A secure customer password 2026!",
  passwordConfirmation: "A secure customer password 2026!",
  termsAccepted: true,
  privacyAcknowledged: true,
  termsVersion: "terms-test-v1",
  privacyVersion: "privacy-test-v1"
};

class MemoryTransactionalEmailProvider implements TransactionalIdentityEmailProvider {
  readonly messages: Array<TransactionalIdentityMessage & { idempotencyKey: string }> = [];
  send(input: TransactionalIdentityMessage & { idempotencyKey: string }) {
    this.messages.push(input);
    return Promise.resolve({ providerMessageId: `memory-${this.messages.length}` });
  }
}

before(async () => {
  await database.query("DROP SCHEMA public CASCADE");
  await database.query("CREATE SCHEMA public");
  await migrate(database);
  app = createApp({ database, configuration });
});

after(async () => {
  await database.end();
});

describe("Identity P0A account creation", () => {
  it("requires public CSRF and atomically creates only identity records with legal evidence", async () => {
    const noCsrf = await request(app).post("/api/identity/register").send(registration);
    assert.equal(noCsrf.status, 403);

    const agent = request.agent(app);
    const context = await agent.get("/api/identity/context");
    assert.equal(context.status, 200, context.text);
    const csrf = cookieFrom(context, "ryva_public_csrf");
    const missingConsent = await agent.post("/api/identity/register").set("x-csrf-token", csrf).send({
      ...registration,
      termsAccepted: false
    });
    assert.equal(missingConsent.status, 422, missingConsent.text);
    const submittedAfter = new Date();
    const created = await agent.post("/api/identity/register").set("x-csrf-token", csrf).send({
      ...registration,
      acceptedAt: "2000-01-01T00:00:00.000Z"
    });
    assert.equal(created.status, 201, created.text);

    const result = await database.query<{
      id: string;
      password_hash: string;
      first_name: string;
      last_name: string;
      name: string;
      workspace_id: string;
      role: string;
      profile_count: number;
      settings_count: number;
      legal_count: number;
      credential_count: number;
      subscription_count: number;
      program_count: number;
    }>(
      `SELECT u.id,u.password_hash,u.first_name,u.last_name,u.name,wm.workspace_id,wm.role,
              (SELECT count(*)::int FROM user_profiles WHERE user_id=u.id) AS profile_count,
              (SELECT count(*)::int FROM workspace_settings WHERE workspace_id=wm.workspace_id) AS settings_count,
              (SELECT count(*)::int FROM legal_acceptances WHERE user_id=u.id) AS legal_count,
              (SELECT count(*)::int FROM certification_credentials WHERE user_id=u.id) AS credential_count,
              (SELECT count(*)::int FROM subscription_entitlements WHERE user_id=u.id) AS subscription_count,
              (SELECT count(*)::int FROM program_entitlements WHERE user_id=u.id) AS program_count
         FROM users u JOIN workspace_memberships wm ON wm.user_id=u.id
        WHERE lower(u.email)=lower($1)`,
      [registration.email]
    );
    const row = result.rows[0]!;
    assert.equal(row.first_name, "Jordan");
    assert.equal(row.last_name, "Customer");
    assert.equal(row.name, "Jordan Customer");
    assert.equal(row.role, "representative");
    assert.equal(row.profile_count, 1);
    assert.equal(row.settings_count, 1);
    assert.equal(row.legal_count, 2);
    assert.equal(row.credential_count, 0);
    assert.equal(row.subscription_count, 0);
    assert.equal(row.program_count, 0);
    assert.notEqual(row.password_hash, registration.password);
    assert.equal(await verifyPassword(registration.password, row.password_hash, configuration.SESSION_PEPPER), true);
    const legal = await database.query<{
      document_type: string;
      document_version: string;
      acceptance_context: string;
      workspace_id: string;
      ip_hash: string | null;
      user_agent: string | null;
      occurred_at: Date;
    }>(
      `SELECT document_type,document_version,acceptance_context,workspace_id,ip_hash,user_agent,occurred_at
         FROM legal_acceptances WHERE user_id=$1 ORDER BY document_type`,
      [row.id]
    );
    assert.deepEqual(legal.rows.map((entry) => entry.document_type), ["privacy_policy", "terms_of_use"]);
    assert.ok(legal.rows.every((entry) => entry.acceptance_context === "account_creation"));
    assert.ok(legal.rows.every((entry) => entry.workspace_id === row.workspace_id));
    assert.ok(legal.rows.every((entry) => entry.document_version.endsWith("test-v1")));
    assert.ok(legal.rows.every((entry) => entry.occurred_at >= submittedAfter));
    await database.query(
      `INSERT INTO legal_acceptances
        (id,user_id,workspace_id,document_type,document_version,acceptance_action,acceptance_context,occurred_at)
       VALUES(gen_random_uuid(),$1,$2,'terms_of_use','terms-test-v2','accepted','account_creation',clock_timestamp())`,
      [row.id, row.workspace_id]
    );
    const versions = await database.query<{ document_version: string }>(
      `SELECT document_version FROM legal_acceptances
        WHERE user_id=$1 AND document_type='terms_of_use' ORDER BY occurred_at`,
      [row.id]
    );
    assert.deepEqual(versions.rows.map((entry) => entry.document_version), ["terms-test-v1", "terms-test-v2"]);
    await assert.rejects(
      database.query("UPDATE legal_acceptances SET document_version='changed' WHERE user_id=$1", [row.id]),
      /append-only/
    );
    await assert.rejects(
      database.query("DELETE FROM legal_acceptances WHERE user_id=$1", [row.id]),
      /append-only/
    );

    for (const table of ["brands", "products", "businesses", "placements", "outreach_messages", "accounts", "orders", "commissions"]) {
      const actualTable = table === "placements" ? "placement_opportunities" : table;
      const count = await database.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${actualTable} WHERE workspace_id=$1`,
        [row.workspace_id]
      );
      assert.equal(count.rows[0]!.count, 0, `${actualTable} should be empty`);
    }

    const login = await request(app).post("/api/auth/login").send({ email: registration.email, password: registration.password });
    assert.equal(login.status, 200, login.text);
    assert.equal(login.body.access.mode, "account_only");
    assert.equal(login.body.access.canAccessProgram, false);
    assert.equal(login.body.access.canAccessOperatingPlatform, false);
  });

  it("rejects duplicate normalized email without creating another workspace", async () => {
    await database.query("DELETE FROM rate_limit_buckets WHERE bucket_key LIKE 'account_registration:%'");
    const before = await database.query<{ count: number }>("SELECT count(*)::int AS count FROM workspaces");
    const agent = request.agent(app);
    const csrf = await publicCsrf(agent);
    const duplicate = await agent.post("/api/identity/register").set("x-csrf-token", csrf).send({
      ...registration,
      email: "  JORDAN.IDENTITY@EXAMPLE.TEST  "
    });
    assert.equal(duplicate.status, 409, duplicate.text);
    const after = await database.query<{ count: number }>("SELECT count(*)::int AS count FROM workspaces");
    assert.equal(after.rows[0]!.count, before.rows[0]!.count);
  });

  it("uses the existing database-backed rate limiter", async () => {
    await database.query("DELETE FROM rate_limit_buckets WHERE bucket_key LIKE 'account_registration:%'");
    const agent = request.agent(app);
    const csrf = await publicCsrf(agent);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await agent
        .post("/api/identity/register")
        .set("x-csrf-token", csrf)
        .send({});
      assert.equal(response.status, 422, response.text);
    }
    const limited = await agent
      .post("/api/identity/register")
      .set("x-csrf-token", csrf)
      .send({});
    assert.equal(limited.status, 429, limited.text);
  });
});

describe("Identity P0A password reset", () => {
  it("returns the same generic response, stores only a digest, and delivers through encrypted outbox", async () => {
    await database.query("DELETE FROM rate_limit_buckets WHERE bucket_key LIKE 'password_reset_request:%'");
    const existingAgent = request.agent(app);
    const existingCsrf = await publicCsrf(existingAgent);
    const existing = await existingAgent.post("/api/identity/password-reset/request").set("x-csrf-token", existingCsrf).send({ email: registration.email });
    const missingAgent = request.agent(app);
    const missingCsrf = await publicCsrf(missingAgent);
    const missing = await missingAgent.post("/api/identity/password-reset/request").set("x-csrf-token", missingCsrf).send({ email: "missing@example.test" });
    assert.equal(existing.status, 202, existing.text);
    assert.equal(missing.status, 202, missing.text);
    assert.deepEqual(existing.body, missing.body);

    const stored = await database.query<{ token_hash: string; encrypted_payload: string; outbox_id: string }>(
      `SELECT pr.token_hash,te.encrypted_payload,te.id AS outbox_id
         FROM password_reset_tokens pr
         JOIN transactional_email_outbox te ON te.user_id=pr.user_id
        WHERE pr.used_at IS NULL ORDER BY pr.issued_at DESC,te.created_at DESC LIMIT 1`
    );
    const provider = new MemoryTransactionalEmailProvider();
    await processTransactionalIdentityEmail(database, configuration, provider, stored.rows[0]!.outbox_id);
    assert.equal(provider.messages.length, 1);
    const delivered = await database.query<{ status: string; provider_message_id: string | null }>(
      "SELECT status,provider_message_id FROM transactional_email_outbox WHERE id=$1",
      [stored.rows[0]!.outbox_id]
    );
    assert.deepEqual(delivered.rows[0], {
      status: "sent",
      provider_message_id: "memory-1"
    });
    const urlMatch = provider.messages[0]!.text.match(/https?:\/\/\S+reset-password\?token=[^\s]+/);
    assert.ok(urlMatch);
    const token = new URL(urlMatch[0]).searchParams.get("token")!;
    assert.notEqual(stored.rows[0]!.token_hash, token);
    assert.equal(stored.rows[0]!.token_hash, secureDigest(token, configuration.SESSION_PEPPER));
    assert.doesNotMatch(stored.rows[0]!.encrypted_payload, new RegExp(token));
  });

  it("rejects invalid, expired, and used tokens; resets once; revokes sessions; and audits", async () => {
    const loginAgent = request.agent(app);
    assert.equal((await loginAgent.post("/api/auth/login").send({ email: registration.email, password: registration.password })).status, 200);

    await database.query("DELETE FROM rate_limit_buckets WHERE bucket_key LIKE 'password_reset_request:%' OR bucket_key LIKE 'password_reset_confirm:%'");
    const requestAgent = request.agent(app);
    const requestCsrf = await publicCsrf(requestAgent);
    await requestAgent.post("/api/identity/password-reset/request").set("x-csrf-token", requestCsrf).send({ email: registration.email });
    const outbox = await database.query<{ id: string }>("SELECT id FROM transactional_email_outbox WHERE status='queued' ORDER BY created_at DESC LIMIT 1");
    const provider = new MemoryTransactionalEmailProvider();
    await processTransactionalIdentityEmail(database, configuration, provider, outbox.rows[0]!.id);
    const resetUrl = provider.messages[0]!.text.match(/https?:\/\/\S+reset-password\?token=[^\s]+/)![0];
    const token = new URL(resetUrl).searchParams.get("token")!;

    const invalid = await requestAgent.post("/api/identity/password-reset/confirm").set("x-csrf-token", requestCsrf).send({ token: "x".repeat(43), password: "A different secure password 2026!", passwordConfirmation: "A different secure password 2026!" });
    assert.equal(invalid.status, 400);

    await database.query(
      `UPDATE password_reset_tokens
          SET issued_at=now()-interval '2 hours',expires_at=now()-interval '1 hour'
        WHERE used_at IS NULL`
    );
    const expired = await requestAgent.post("/api/identity/password-reset/confirm").set("x-csrf-token", requestCsrf).send({ token, password: "A different secure password 2026!", passwordConfirmation: "A different secure password 2026!" });
    assert.equal(expired.status, 400);

    await requestAgent.post("/api/identity/password-reset/request").set("x-csrf-token", requestCsrf).send({ email: registration.email });
    const nextOutbox = await database.query<{ id: string }>("SELECT id FROM transactional_email_outbox WHERE status='queued' ORDER BY created_at DESC LIMIT 1");
    const nextProvider = new MemoryTransactionalEmailProvider();
    await processTransactionalIdentityEmail(database, configuration, nextProvider, nextOutbox.rows[0]!.id);
    const nextToken = new URL(nextProvider.messages[0]!.text.match(/https?:\/\/\S+reset-password\?token=[^\s]+/)![0]).searchParams.get("token")!;
    const nextPassword = "A different secure password 2026!";
    const success = await requestAgent.post("/api/identity/password-reset/confirm").set("x-csrf-token", requestCsrf).send({ token: nextToken, password: nextPassword, passwordConfirmation: nextPassword });
    assert.equal(success.status, 204, success.text);
    assert.equal((await loginAgent.get("/api/session")).status, 401);
    assert.equal((await requestAgent.post("/api/identity/password-reset/confirm").set("x-csrf-token", requestCsrf).send({ token: nextToken, password: nextPassword, passwordConfirmation: nextPassword })).status, 400);
    assert.equal((await request(app).post("/api/auth/login").send({ email: registration.email, password: registration.password })).status, 401);
    assert.equal((await request(app).post("/api/auth/login").send({ email: registration.email, password: nextPassword })).status, 200);
    const audit = await database.query<{ count: number }>("SELECT count(*)::int AS count FROM audit_events WHERE action='account.password_reset_completed'");
    assert.equal(audit.rows[0]!.count, 1);
  });
});

describe("Identity P0A staff MFA enrollment", () => {
  it("uses a password-authenticated temporary challenge and consumes it only after valid TOTP", async () => {
    const user = await database.query<{ id: string }>("SELECT id FROM users WHERE lower(email)=lower($1)", [registration.email]);
    await database.query("UPDATE workspace_memberships SET role='admin' WHERE user_id=$1", [user.rows[0]!.id]);
    await database.query("UPDATE users SET mfa_secret_ciphertext=NULL WHERE id=$1", [user.rows[0]!.id]);

    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({ email: registration.email, password: "A different secure password 2026!" });
    assert.equal(login.status, 202, login.text);
    assert.deepEqual(login.body, { mfaSetupRequired: true });
    const enrollment = await agent.get("/api/auth/mfa/enrollment");
    assert.equal(enrollment.status, 200, enrollment.text);
    assert.match(enrollment.body.qrCodeDataUrl, /^data:image\/png;base64,/);
    assert.equal("secret" in enrollment.body, false);
    assert.doesNotMatch(JSON.stringify(enrollment.body), /otpauth:/);
    const csrf = cookieFrom(enrollment, "ryva_public_csrf");

    const invalid = await agent.post("/api/auth/mfa/enrollment/confirm").set("x-csrf-token", csrf).send({ code: "000000" });
    assert.equal(invalid.status, 400);
    const challenge = await database.query<{ secret_ciphertext: string }>(
      "SELECT secret_ciphertext FROM staff_mfa_enrollment_challenges WHERE user_id=$1 AND consumed_at IS NULL",
      [user.rows[0]!.id]
    );
    const secret = decryptSecret(challenge.rows[0]!.secret_ciphertext, configuration.FIELD_ENCRYPTION_KEY);
    const validCode = await generate({ secret });
    const confirmed = await agent.post("/api/auth/mfa/enrollment/confirm").set("x-csrf-token", csrf).send({ code: validCode });
    assert.equal(confirmed.status, 204, confirmed.text);
    const state = await database.query<{ consumed: boolean; encrypted: boolean; audits: number }>(
      `SELECT c.consumed_at IS NOT NULL AS consumed,u.mfa_secret_ciphertext IS NOT NULL AS encrypted,
              (SELECT count(*)::int FROM audit_events WHERE action='account.mfa_enrolled' AND actor_user_id=u.id) AS audits
         FROM users u JOIN staff_mfa_enrollment_challenges c ON c.user_id=u.id
        WHERE u.id=$1 ORDER BY c.created_at DESC LIMIT 1`,
      [user.rows[0]!.id]
    );
    assert.deepEqual(state.rows[0], { consumed: true, encrypted: true, audits: 1 });
    assert.equal((await agent.post("/api/auth/mfa/enrollment/confirm").set("x-csrf-token", csrf).send({ code: validCode })).status, 401);
    assert.equal((await request(app).post("/api/auth/login").send({ email: registration.email, password: "A different secure password 2026!", mfaCode: await generate({ secret }) })).status, 200);
  });
});
