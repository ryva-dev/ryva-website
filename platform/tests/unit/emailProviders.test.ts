import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Webhook } from "svix";
import {
  ConfiguredEmailProvider,
  ConfiguredTransactionalIdentityEmailProvider,
  ResendEmailAdapter
} from "../../apps/api/src/providers.js";
import {
  normalizeResendEmailEvent,
  verifyResendWebhook
} from "../../apps/api/src/phase5Routes.js";
import { loadConfig } from "../../packages/config/src/index.js";
import { AppError } from "../../packages/shared/src/index.js";

type FetchCall = { url: string; init: RequestInit | undefined };

function recordingFetch(
  response: () => Response,
  calls: FetchCall[]
): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    calls.push({ url, init });
    return Promise.resolve(response());
  }) as typeof fetch;
}

void describe("Resend email adapter", () => {
  void it("translates Ryva messages, forwards idempotency, and captures the provider id", async () => {
    const calls: FetchCall[] = [];
    const adapter = new ResendEmailAdapter(
      "https://api.resend.com",
      "test-provider-token",
      recordingFetch(() => Response.json({ id: "resend-message-1" }), calls)
    );

    const result = await adapter.send({
      idempotencyKey: "email-artifact-1",
      from: "support@ryvaforge.com",
      to: "learner@example.test",
      subject: "Reset your password",
      text: "Plain text",
      html: "<p>HTML text</p>",
      headers: { "X-Ryva-Message-Type": "password_reset" }
    });

    assert.deepEqual(result, { providerMessageId: "resend-message-1" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "https://api.resend.com/emails");
    const headers = new Headers(calls[0]!.init?.headers);
    assert.equal(headers.get("authorization"), "Bearer test-provider-token");
    assert.equal(headers.get("idempotency-key"), "email-artifact-1");
    const requestBody = calls[0]!.init?.body;
    if (typeof requestBody !== "string") throw new Error("Expected a JSON request body.");
    assert.deepEqual(JSON.parse(requestBody), {
      from: "support@ryvaforge.com",
      to: ["learner@example.test"],
      subject: "Reset your password",
      text: "Plain text",
      html: "<p>HTML text</p>",
      headers: { "X-Ryva-Message-Type": "password_reset" }
    });
  });

  void it("returns retry-safe errors for network, rate-limit, and provider failures", async () => {
    const unavailable = [
      (() => Promise.reject(new Error("network unavailable"))) as typeof fetch,
      (() => Promise.resolve(new Response("rate limited", { status: 429 }))) as typeof fetch,
      (() => Promise.resolve(new Response("provider failure", { status: 503 }))) as typeof fetch
    ];
    for (const fetcher of unavailable) {
      const adapter = new ResendEmailAdapter("https://api.resend.com", "token", fetcher);
      await assert.rejects(
        adapter.send({
          idempotencyKey: "retry-key",
          from: "support@ryvaforge.com",
          to: "learner@example.test",
          subject: "Test",
          text: "Test"
        }),
        (error: unknown) => error instanceof AppError &&
          error.status === 503 && error.type === "email_provider_unavailable"
      );
    }
  });

  void it("does not call Resend for outreach while disabled, but transactional mail still works", async () => {
    let outreachCalls = 0;
    const configuration = loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://localhost/unused",
      PGSSL: "disable",
      OUTREACH_SEND_ENABLED: "0",
      EMAIL_PROVIDER_URL: "https://api.resend.com",
      EMAIL_PROVIDER_TOKEN: "outreach-token",
      TRANSACTIONAL_EMAIL_PROVIDER_URL: "https://api.resend.com",
      TRANSACTIONAL_EMAIL_PROVIDER_TOKEN: "transactional-token",
      TRANSACTIONAL_EMAIL_FROM_ADDRESS: "support@ryvaforge.com"
    });
    const outreach = new ConfiguredEmailProvider(
      configuration,
      (() => {
        outreachCalls += 1;
        return Promise.resolve(Response.json({ id: "must-not-send" }));
      }) as typeof fetch
    );
    await assert.rejects(
      outreach.send({
        idempotencyKey: "outreach-disabled",
        from: "support@ryvaforge.com",
        to: "buyer@example.test",
        subject: "Outreach",
        body: "Outreach body",
        headers: {}
      }),
      (error: unknown) => error instanceof AppError && error.type === "email_provider_unavailable"
    );
    assert.equal(outreachCalls, 0);

    const calls: FetchCall[] = [];
    const transactional = new ConfiguredTransactionalIdentityEmailProvider(
      configuration,
      recordingFetch(() => Response.json({ id: "resend-password-reset-1" }), calls)
    );
    assert.deepEqual(await transactional.send({
      kind: "password_reset",
      to: "learner@example.test",
      subject: "Reset",
      text: "Reset safely",
      idempotencyKey: "password-reset-1"
    }), { providerMessageId: "resend-password-reset-1" });
    assert.equal(calls.length, 1);
  });
});

void describe("Resend webhook adapter", () => {
  const secret = `whsec_${Buffer.from("ryva-resend-webhook-test-secret").toString("base64")}`;

  void it("verifies the native Svix signature and normalizes configured events", () => {
    const cases = [
      ["email.delivered", "delivered"],
      ["email.bounced", "bounced"],
      ["email.complained", "complained"]
    ] as const;
    for (const [providerType, normalizedType] of cases) {
      const raw = Buffer.from(JSON.stringify({
        type: providerType,
        data: { email_id: `provider-${normalizedType}` }
      }));
      const timestamp = new Date();
      const id = `event-${normalizedType}`;
      const signature = new Webhook(secret).sign(id, timestamp, raw);
      const verified = verifyResendWebhook(raw, {
        "svix-id": id,
        "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
        "svix-signature": signature
      }, secret);
      assert.deepEqual(normalizeResendEmailEvent(verified), {
        eventType: normalizedType,
        providerMessageId: `provider-${normalizedType}`
      });
    }
  });

  void it("rejects invalid signatures and ignores unsupported authenticated events", () => {
    const raw = Buffer.from(JSON.stringify({
      type: "email.sent",
      data: { email_id: "provider-sent" }
    }));
    assert.throws(
      () => verifyResendWebhook(raw, {
        "svix-id": "event-sent",
        "svix-timestamp": String(Math.floor(Date.now() / 1000)),
        "svix-signature": "v1,invalid"
      }, secret),
      (error: unknown) => error instanceof AppError && error.type === "webhook_signature_invalid"
    );

    const timestamp = new Date();
    const signature = new Webhook(secret).sign("event-sent", timestamp, raw);
    const verified = verifyResendWebhook(raw, {
      "svix-id": "event-sent",
      "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": signature
    }, secret);
    assert.equal(normalizeResendEmailEvent(verified), null);
  });
});

void describe("production email launch configuration", () => {
  void it("accepts production with outreach disabled and explicit Resend verification", () => {
    const configuration = loadConfig({
      NODE_ENV: "production",
      APP_URL: "https://ryva.example.test",
      DATABASE_URL: "postgres://production.example.test/ryva",
      PGSSL: "require",
      SESSION_PEPPER: "production-session-pepper",
      FIELD_ENCRYPTION_KEY: "0".repeat(64),
      STRIPE_SECRET_KEY: "stripe-secret",
      STRIPE_WEBHOOK_SECRET: "stripe-webhook",
      STRIPE_PROGRAM_PRICE_ID: "price_program",
      STRIPE_PRICE_ID: "price_pro",
      EMAIL_PROVIDER_URL: "https://api.resend.com",
      EMAIL_PROVIDER_TOKEN: "resend-token",
      EMAIL_FROM_ADDRESS: "support@ryvaforge.com",
      RESEND_WEBHOOK_SECRET: "resend-webhook-secret",
      TRANSACTIONAL_EMAIL_PROVIDER_URL: "https://api.resend.com",
      TRANSACTIONAL_EMAIL_PROVIDER_TOKEN: "resend-token",
      TRANSACTIONAL_EMAIL_FROM_ADDRESS: "support@ryvaforge.com",
      OUTREACH_SEND_ENABLED: "0",
      STORAGE_DRIVER: "s3",
      S3_BUCKET: "ryva-production-files",
      S3_REGION: "us-east-2",
      MALWARE_SCANNER_WEBHOOK_SECRET: "scanner-secret",
      ALLOW_SYNTHETIC_SEED: "0"
    });
    assert.equal(configuration.OUTREACH_SEND_ENABLED, false);
    assert.equal(configuration.EMAIL_FROM_ADDRESS, "support@ryvaforge.com");
  });
});
