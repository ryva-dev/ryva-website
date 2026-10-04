import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request, { type Response } from "supertest";
import type Stripe from "stripe";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";
import { migrate } from "../../packages/database/src/migrate.js";
import { publishedTestProgram } from "../programFixture.js";

const configuration = loadConfig({
  ...process.env,
  TERMS_DOCUMENT_URL: "https://example.test/terms",
  TERMS_DOCUMENT_VERSION: "terms-commerce-v1",
  PRIVACY_DOCUMENT_URL: "https://example.test/privacy",
  PRIVACY_DOCUMENT_VERSION: "privacy-commerce-v1",
  STRIPE_SECRET_KEY: "sk_test_ryva",
  STRIPE_WEBHOOK_SECRET: "whsec_ryva",
  STRIPE_PROGRAM_PRICE_ID: "price_program_397",
  STRIPE_PRICE_ID: "price_pro_20",
  PROGRAM_PRICE_CENTS: "39700",
  PROGRAM_PRICE_CURRENCY: "usd",
  RATE_LIMIT_LOGIN_MAX: "100"
});
const programConsent = {
  termsAccepted: true,
  refundPolicyAccepted: true,
  nonRefundableAcknowledged: true,
  commercialDisclaimerAcknowledged: true,
  termsVersion: "terms-commerce-v1",
  refundPolicyVersion: "2026-10-02",
  disclaimerVersion: "2026-10-02"
};
const database = createDatabase(configuration);
let app: ReturnType<typeof createApp>;
let checkoutSequence = 0;
let subscriptionCheckoutSequence = 0;
let programPriceAmount = 39700;
const createdCheckouts: Array<{ params: Stripe.Checkout.SessionCreateParams; options?: Stripe.RequestOptions }> = [];

const stripe = {
  prices: {
    retrieve(priceId: string) {
      if (priceId === "price_pro_20") {
        return Promise.resolve({ active: true, type: "recurring", unit_amount: 2000, currency: "usd", recurring: { interval: "month" } });
      }
      return Promise.resolve({ active: true, type: "one_time", unit_amount: programPriceAmount, currency: "usd" });
    }
  },
  checkout: {
    sessions: {
      create(params: Stripe.Checkout.SessionCreateParams, options?: Stripe.RequestOptions) {
        createdCheckouts.push({ params, ...(options ? { options } : {}) });
        if (params.mode === "subscription") {
          subscriptionCheckoutSequence += 1;
          return Promise.resolve({
            id: `cs_test_subscription_${subscriptionCheckoutSequence}`,
            url: `https://checkout.stripe.test/subscription/${subscriptionCheckoutSequence}`
          });
        }
        checkoutSequence += 1;
        return Promise.resolve({
          id: `cs_test_program_${checkoutSequence}`,
          url: `https://checkout.stripe.test/program/${checkoutSequence}`
        });
      }
    }
  },
  webhooks: {
    constructEvent(payload: Buffer, signature: string) {
      if (signature !== "valid-test-signature") throw new Error("Invalid signature");
      return JSON.parse(payload.toString("utf8")) as Stripe.Event;
    }
  },
  billingPortal: { sessions: { create: () => Promise.reject(new Error("not used")) } }
} as unknown as Stripe;

function cookieFrom(response: Response, name: string): string {
  const values = response.headers["set-cookie"];
  const cookies = Array.isArray(values) ? values : values ? [values] : [];
  const found = cookies.find((value) => value.startsWith(`${name}=`));
  assert.ok(found, `${name} cookie should be set`);
  return decodeURIComponent(found.split(";")[0]!.slice(name.length + 1));
}

async function register(email: string, password: string) {
  const agent = request.agent(app);
  const context = await agent.get("/api/identity/context");
  const csrf = cookieFrom(context, "ryva_public_csrf");
  const response = await agent.post("/api/identity/register").set("x-csrf-token", csrf).send({
    firstName: "Fresh",
    lastName: "Customer",
    email,
    password,
    passwordConfirmation: password,
    termsAccepted: true,
    privacyAcknowledged: true,
    termsVersion: "terms-commerce-v1",
    privacyVersion: "privacy-commerce-v1"
  });
  assert.equal(response.status, 201, response.text);
}

async function login(email: string, password: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password });
  assert.equal(response.status, 200, response.text);
  return { agent, csrf: cookieFrom(response, "ryva_csrf"), response };
}

function programEvent(input: {
  eventId: string;
  sessionId: string;
  userId: string;
  paymentStatus?: string;
  amountTotal?: number;
}) {
  return {
    id: input.eventId,
    type: "checkout.session.completed",
    data: {
      object: {
        id: input.sessionId,
        customer: "cus_program_test",
        payment_intent: "pi_program_test",
        payment_status: input.paymentStatus ?? "paid",
        amount_total: input.amountTotal ?? 39700,
        currency: "usd",
        metadata: { ryvaPurchaseKind: "program", ryvaUserId: input.userId }
      }
    }
  };
}

before(async () => {
  await database.query("DROP SCHEMA public CASCADE");
  await database.query("CREATE SCHEMA public");
  await migrate(database);
  app = createApp({ database, configuration, stripe, program: publishedTestProgram });
});

after(async () => {
  await database.end();
});

describe("fresh-user Program commerce path", () => {
  const email = "fresh.program.buyer@example.test";
  const secondEmail = "isolated.program.buyer@example.test";
  const password = "A secure commerce password 2026!";
  let userId = "";
  let firstAgent: Awaited<ReturnType<typeof login>>;
  let checkoutId = "";

  it("creates an account with no product access and enforces pre-purchase gates", async () => {
    await register(email, password);
    firstAgent = await login(email, password);
    userId = firstAgent.response.body.user.id as string;
    assert.equal(firstAgent.response.body.access.mode, "account_only");
    assert.equal(firstAgent.response.body.access.canAccessProgram, false);
    assert.equal(firstAgent.response.body.access.canAccessOperatingPlatform, false);
    assert.equal((await firstAgent.agent.get("/api/program")).status, 403);
    assert.equal((await firstAgent.agent.get("/api/program/items/test-article-1")).status, 403);
    assert.equal((await firstAgent.agent.get("/api/program/modules/test-module-2")).status, 403);
    assert.equal((await firstAgent.agent.get("/api/home")).status, 403);
  });

  it("creates a server-associated $397 one-time checkout without granting early access", async () => {
    assert.equal((await firstAgent.agent.post("/api/program/checkout")).status, 403);
    const missingConsent = await firstAgent.agent.post("/api/program/checkout")
      .set("x-csrf-token", firstAgent.csrf)
      .send({ ...programConsent, refundPolicyAccepted: false });
    assert.equal(missingConsent.status, 422, missingConsent.text);
    const staleConsent = await firstAgent.agent.post("/api/program/checkout")
      .set("x-csrf-token", firstAgent.csrf)
      .send({ ...programConsent, termsVersion: "stale-terms" });
    assert.equal(staleConsent.status, 409, staleConsent.text);
    programPriceAmount = 39600;
    const misconfigured = await firstAgent.agent.post("/api/program/checkout").set("x-csrf-token", firstAgent.csrf).send(programConsent);
    assert.equal(misconfigured.status, 503, misconfigured.text);
    assert.equal(misconfigured.body.type, "https://ryva.example/problems/program_price_invalid");
    programPriceAmount = 39700;
    const checkout = await firstAgent.agent.post("/api/program/checkout")
      .set("x-csrf-token", firstAgent.csrf)
      .set("user-agent", "Ryva persistence audit test")
      .send(programConsent);
    assert.equal(checkout.status, 201, checkout.text);
    assert.equal(checkout.body.url, "https://checkout.stripe.test/program/1");
    checkoutId = "cs_test_program_1";
    assert.equal(createdCheckouts[0]!.params.mode, "payment");
    assert.deepEqual(createdCheckouts[0]!.params.line_items, [{ price: "price_program_397", quantity: 1 }]);
    assert.equal(createdCheckouts[0]!.params.metadata!.ryvaUserId, userId);
    assert.equal(createdCheckouts[0]!.params.metadata!.ryvaPurchaseKind, "program");
    assert.match(createdCheckouts[0]!.options!.idempotencyKey!, /^program-checkout:/);
    const consent = await database.query<{
      document_type: string;
      acceptance_context: string;
      associated_record_id: string;
      ip_hash: string | null;
      user_agent: string | null;
    }>(
      `SELECT document_type,acceptance_context,associated_record_id,ip_hash,user_agent
         FROM legal_acceptances
        WHERE user_id=$1 AND acceptance_context='program_purchase'
        ORDER BY document_type`,
      [userId]
    );
    assert.deepEqual(consent.rows.map((row) => row.document_type), [
      "commercial_disclaimer", "refund_policy", "terms_of_use"
    ]);
    assert.ok(consent.rows.every((row) => row.acceptance_context === "program_purchase"));
    assert.ok(consent.rows.every((row) => row.associated_record_id === checkoutId));
    assert.ok(consent.rows.every((row) => row.ip_hash && row.user_agent));
    const repeated = await firstAgent.agent.post("/api/program/checkout").set("x-csrf-token", firstAgent.csrf).send(programConsent);
    assert.equal(repeated.status, 200, repeated.text);
    assert.equal(repeated.body.url, checkout.body.url);
    assert.equal(repeated.body.reused, true);
    assert.equal(createdCheckouts.length, 1);
    const repeatedConsent = await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM legal_acceptances
        WHERE user_id=$1 AND acceptance_context='program_purchase'`,
      [userId]
    );
    assert.equal(repeatedConsent.rows[0]!.count, 3);
    assert.equal((await firstAgent.agent.get("/api/program")).status, 403);
  });

  it("rejects unverified or mismatched fulfillment and grants nothing for failed payment", async () => {
    const invalidSignature = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "invalid")
      .set("content-type", "application/json")
      .send(JSON.stringify(programEvent({ eventId: "evt_invalid_signature", sessionId: checkoutId, userId })));
    assert.equal(invalidSignature.status, 401);

    const unpaid = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "valid-test-signature")
      .set("content-type", "application/json")
      .send(JSON.stringify(programEvent({ eventId: "evt_unpaid", sessionId: checkoutId, userId, paymentStatus: "unpaid" })));
    assert.equal(unpaid.status, 422, unpaid.text);
    assert.equal((await firstAgent.agent.get("/api/program")).status, 403);
  });

  it("fulfills a delayed successful payment exactly once", async () => {
    const event = programEvent({ eventId: "evt_program_paid", sessionId: checkoutId, userId });
    const first = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "valid-test-signature")
      .set("content-type", "application/json")
      .send(JSON.stringify(event));
    assert.equal(first.status, 200, first.text);
    const duplicate = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "valid-test-signature")
      .set("content-type", "application/json")
      .send(JSON.stringify(event));
    assert.equal(duplicate.status, 200, duplicate.text);

    const entitlement = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM program_entitlements WHERE user_id=$1 AND status='active'",
      [userId]
    );
    assert.equal(entitlement.rows[0]!.count, 1);
    const session = await firstAgent.agent.get("/api/session");
    assert.equal(session.body.access.canAccessProgram, true);
    assert.equal(session.body.access.isProgramCompleted, false);
    assert.equal(session.body.access.canAccessOperatingPlatform, false);
    assert.equal((await firstAgent.agent.get("/api/program")).status, 200);
    assert.equal((await firstAgent.agent.get("/api/program/modules/test-module-1")).status, 200);
    assert.equal((await firstAgent.agent.get("/api/program/modules/test-module-2")).status, 403);
    const paidCheckout = await database.query<{ provider_payment_intent_id: string | null }>(
      "SELECT provider_payment_intent_id FROM program_checkout_sessions WHERE provider_checkout_session_id=$1",
      [checkoutId]
    );
    assert.equal(paidCheckout.rows[0]!.provider_payment_intent_id, "pi_program_test");
    const duplicatePurchase = await firstAgent.agent.post("/api/program/checkout").set("x-csrf-token", firstAgent.csrf).send(programConsent);
    assert.equal(duplicatePurchase.status, 409, duplicatePurchase.text);
    assert.equal(duplicatePurchase.body.type, "https://ryva.example/problems/program_already_owned");
    const entitledConsent = await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM legal_acceptances
        WHERE user_id=$1 AND acceptance_context='program_purchase'`,
      [userId]
    );
    assert.equal(entitledConsent.rows[0]!.count, 3);
  });

  it("persists progress through logout and reauthentication", async () => {
    assert.equal((await firstAgent.agent.post("/api/program/items/test-article-1/start").set("x-csrf-token", firstAgent.csrf)).status, 200);
    assert.equal((await firstAgent.agent.post("/api/program/items/test-article-1/complete").set("x-csrf-token", firstAgent.csrf)).status, 200);
    assert.equal((await firstAgent.agent.post("/api/auth/logout").set("x-csrf-token", firstAgent.csrf)).status, 204);
    const relogged = await login(email, password);
    const dashboard = await relogged.agent.get("/api/program");
    assert.equal(dashboard.status, 200, dashboard.text);
    assert.equal(dashboard.body.modules[0].completedRequiredItems, 1);
  });

  it("keeps cancellation and learner state isolated, then recovers from a failed payment", async () => {
    await register(secondEmail, password);
    const second = await login(secondEmail, password);
    const secondUserId = second.response.body.user.id as string;
    assert.equal(second.response.body.access.canAccessProgram, false);
    const secondCheckout = await second.agent.post("/api/program/checkout").set("x-csrf-token", second.csrf).send(programConsent);
    assert.equal(secondCheckout.status, 201, secondCheckout.text);
    assert.equal((await second.agent.get("/api/program")).status, 403);

    const firstProgress = await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM program_item_progress p
        JOIN users u ON u.id=p.user_id WHERE u.email=$1`,
      [email]
    );
    const secondProgress = await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM program_item_progress p
        JOIN users u ON u.id=p.user_id WHERE u.email=$1`,
      [secondEmail]
    );
    assert.ok(firstProgress.rows[0]!.count > 0);
    assert.equal(secondProgress.rows[0]!.count, 0);

    const failed = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "valid-test-signature")
      .set("content-type", "application/json")
      .send(JSON.stringify({
        id: "evt_program_failed",
        type: "checkout.session.async_payment_failed",
        data: { object: {
          id: "cs_test_program_2",
          metadata: { ryvaPurchaseKind: "program", ryvaUserId: secondUserId }
        } }
      }));
    assert.equal(failed.status, 200, failed.text);
    assert.equal((await second.agent.get("/api/program")).status, 403);
    const failedState = await database.query<{ status: string }>(
      "SELECT status FROM program_checkout_sessions WHERE provider_checkout_session_id='cs_test_program_2'"
    );
    assert.equal(failedState.rows[0]!.status, "failed");
    const retainedConsent = await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM legal_acceptances
        WHERE user_id=$1 AND acceptance_context='program_purchase'
          AND associated_record_id='cs_test_program_2'`,
      [secondUserId]
    );
    assert.equal(retainedConsent.rows[0]!.count, 3);

    const retry = await second.agent.post("/api/program/checkout").set("x-csrf-token", second.csrf).send(programConsent);
    assert.equal(retry.status, 201, retry.text);
    const recovered = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "valid-test-signature")
      .set("content-type", "application/json")
      .send(JSON.stringify(programEvent({
        eventId: "evt_program_retry_paid",
        sessionId: "cs_test_program_3",
        userId: secondUserId
      })));
    assert.equal(recovered.status, 200, recovered.text);
    assert.equal((await second.agent.get("/api/program")).status, 200);
    const secondEntitlements = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM program_entitlements WHERE user_id=$1",
      [secondUserId]
    );
    assert.equal(secondEntitlements.rows[0]!.count, 1);
  });

  it("requires and persists Ryva-specific recurring subscription consent", async () => {
    await database.query(
      `UPDATE program_entitlements SET completed_at=clock_timestamp(),
        pro_trial_started_at=clock_timestamp(),pro_trial_ends_at=clock_timestamp()+interval '30 days'
        WHERE user_id=$1`,
      [userId]
    );
    const subscriber = await login(email, password);
    const missing = await subscriber.agent.post("/api/subscription/checkout")
      .set("x-csrf-token", subscriber.csrf).send({});
    assert.equal(missing.status, 422, missing.text);
    const subscriptionConsent = {
      termsAccepted: true,
      recurringBillingAccepted: true,
      cancellationTermsAccepted: true,
      termsVersion: "terms-commerce-v1",
      priceCents: 2000,
      currency: "usd",
      billingCadence: "month"
    };
    const offer = await subscriber.agent.get("/api/subscription");
    assert.equal(offer.status, 200, offer.text);
    assert.ok(offer.body.offer.firstChargeAt);
    assert.equal(offer.body.offer.firstChargeAt, offer.body.access.proTrialEndsAt);
    await database.query(
      "UPDATE program_entitlements SET pro_trial_ends_at=clock_timestamp()+interval '47 hours' WHERE user_id=$1",
      [userId]
    );
    const tooCloseToTrialEnd = await subscriber.agent.post("/api/subscription/checkout")
      .set("x-csrf-token", subscriber.csrf).send(subscriptionConsent);
    assert.equal(tooCloseToTrialEnd.status, 409, tooCloseToTrialEnd.text);
    assert.equal(
      tooCloseToTrialEnd.body.type,
      "https://ryva.example/problems/subscription_checkout_timing_unavailable"
    );
    await database.query(
      "UPDATE program_entitlements SET pro_trial_ends_at=clock_timestamp()+interval '30 days' WHERE user_id=$1",
      [userId]
    );
    const checkout = await subscriber.agent.post("/api/subscription/checkout")
      .set("x-csrf-token", subscriber.csrf)
      .set("user-agent", "Ryva subscription consent test")
      .send(subscriptionConsent);
    assert.equal(checkout.status, 201, checkout.text);
    assert.equal(checkout.body.url, "https://checkout.stripe.test/subscription/1");
    const subscriptionCheckout = createdCheckouts.find(({ params }) => params.mode === "subscription");
    assert.ok(subscriptionCheckout?.params.subscription_data?.trial_end);
    const entitlement = await database.query<{ pro_trial_ends_at: Date }>(
      "SELECT pro_trial_ends_at FROM program_entitlements WHERE user_id=$1",
      [userId]
    );
    assert.equal(
      subscriptionCheckout.params.subscription_data.trial_end,
      Math.floor(entitlement.rows[0]!.pro_trial_ends_at.getTime() / 1000)
    );
    const persisted = await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM legal_acceptances
        WHERE user_id=$1 AND acceptance_context='ryva_pro_subscription'
          AND associated_record_id='cs_test_subscription_1'`,
      [userId]
    );
    assert.equal(persisted.rows[0]!.count, 2);
    const record = await database.query<{ amount_total: number; currency: string; billing_interval: string }>(
      "SELECT amount_total,currency,billing_interval FROM subscription_checkout_sessions WHERE user_id=$1",
      [userId]
    );
    assert.deepEqual(record.rows[0], { amount_total: 2000, currency: "usd", billing_interval: "month" });
    const repeated = await subscriber.agent.post("/api/subscription/checkout")
      .set("x-csrf-token", subscriber.csrf).send(subscriptionConsent);
    assert.equal(repeated.status, 200, repeated.text);
    assert.equal(repeated.body.reused, true);
    const completion = {
      id: "evt_subscription_checkout_completed",
      type: "checkout.session.completed",
      data: { object: {
        id: "cs_test_subscription_1",
        subscription: "sub_ryva_pro_test",
        metadata: { ryvaPurchaseKind: "ryva_pro", ryvaUserId: userId }
      } }
    };
    const completed = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "valid-test-signature")
      .set("content-type", "application/json")
      .send(JSON.stringify(completion));
    assert.equal(completed.status, 200, completed.text);
    const completedRecord = await database.query<{ status: string; completed_at: Date | null; provider_subscription_id: string | null }>(
      "SELECT status,completed_at,provider_subscription_id FROM subscription_checkout_sessions WHERE user_id=$1",
      [userId]
    );
    assert.equal(completedRecord.rows[0]!.status, "completed");
    assert.ok(completedRecord.rows[0]!.completed_at);
    assert.equal(completedRecord.rows[0]!.provider_subscription_id, "sub_ryva_pro_test");
  });
});
