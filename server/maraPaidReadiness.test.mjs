/**
 * Paid-readiness gates that do not require a live Stripe/Postgres soak.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { validateConfig } from "./observability.mjs";
import { validateCreativeAnalysis } from "./maraIntelligence.mjs";
import { mapPipelineAnalysisToCreativeIntel } from "./maraMediaPipeline.mjs";

function withEnvironment(overrides, callback) {
  const keys = Object.keys(overrides);
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return callback();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

const prodBase = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://example.invalid/ryva",
  ANTHROPIC_API_KEY: "test-key",
  ENCRYPTION_KEY: "00".repeat(32),
  OBJECT_STORAGE_DRIVER: "s3",
  S3_BUCKET: "ryva-uploads",
  APP_URL: "https://app.example.com",
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
  SMTP_HOST: "smtp.example.com",
  MARA_DISABLE_VIDEO_QA: "1",
  METRICS_TOKEN: "metrics",
  SUPPORT_EMAIL: "support@example.com",
  AUTONOMY_SCHEDULER_ENABLED: "0"
};

test("paid production config accepts complete Google and SMTP customer paths", () => {
  withEnvironment(prodBase, () => assert.doesNotThrow(validateConfig));
});

test("paid production config rejects SMTP-only because Gmail is advertised", () => {
  withEnvironment(
    {
      ...prodBase,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      SMTP_HOST: "smtp.example.com"
    },
    () => assert.throws(validateConfig, /GOOGLE_CLIENT_ID/)
  );
});

test("creative analysis preserves mock honesty flags", () => {
  const mapped = mapPipelineAnalysisToCreativeIntel(
    {
      durationSeconds: 12,
      isMock: true,
      providerHonesty: "Mock providers only",
      strategic: { messagingAngle: "demo" },
      execution: { openingClarity: "clear", productVisibility: "early", claimRisks: [] },
      timestampedFeedback: [{ start_seconds: 0, observation: "Hook", likely_consequence: "Drop", recommended_change: "Cut" }],
      unknowns: ["mock_provider"]
    },
    { fileName: "cut.mp4" }
  );
  const validated = validateCreativeAnalysis(mapped);
  assert.equal(validated.isMock, true);
  assert.match(String(validated.providerHonesty), /Mock/);
});
