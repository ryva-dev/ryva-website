import assert from "node:assert/strict";
import test from "node:test";
import { validateConfig } from "./observability.mjs";

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
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
  MARA_DISABLE_VIDEO_QA: "1",
  METRICS_TOKEN: "metrics-secret",
  SESSION_SECRET: undefined
};

test("production refuses plaintext OAuth token storage", () => {
  withEnvironment(
    { ...prodBase, ENCRYPTION_KEY: undefined },
    () => assert.throws(validateConfig, /ENCRYPTION_KEY is required/)
  );
});

test("production refuses invalid ENCRYPTION_KEY length", () => {
  withEnvironment(
    { ...prodBase, ENCRYPTION_KEY: "tooshort" },
    () => assert.throws(validateConfig, /32 bytes/)
  );
});

test("production requires Postgres + S3 + APP_URL", () => {
  withEnvironment(
    { ...prodBase, DATABASE_URL: undefined },
    () => assert.throws(validateConfig, /DATABASE_URL/)
  );
  withEnvironment(
    { ...prodBase, OBJECT_STORAGE_DRIVER: "local", S3_BUCKET: undefined },
    () => assert.throws(validateConfig, /OBJECT_STORAGE_DRIVER=s3/)
  );
  withEnvironment(
    { ...prodBase, APP_URL: undefined },
    () => assert.throws(validateConfig, /APP_URL/)
  );
});

test("production accepts complete multi-instance configuration", () => {
  withEnvironment(prodBase, () => assert.doesNotThrow(validateConfig));
});

test("production requires Stripe for paying strangers", () => {
  withEnvironment(
    { ...prodBase, STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined },
    () => assert.throws(validateConfig, /STRIPE_SECRET_KEY/)
  );
});

test("production requires Google OAuth or SMTP for signup", () => {
  withEnvironment(
    {
      ...prodBase,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      SMTP_HOST: undefined
    },
    () => assert.throws(validateConfig, /Google OAuth|SMTP_HOST/)
  );
});

test("production refuses mock video QA unless disabled", () => {
  withEnvironment(
    {
      ...prodBase,
      MARA_DISABLE_VIDEO_QA: undefined,
      MARA_TRANSCRIPTION_PROVIDER: "mock",
      MARA_MULTIMODAL_PROVIDER: "mock"
    },
    () => assert.throws(validateConfig, /video QA|MARA_DISABLE_VIDEO_QA/)
  );
});

test("development still allows sqlite without S3", () => {
  withEnvironment(
    {
      NODE_ENV: "development",
      DATABASE_URL: undefined,
      OBJECT_STORAGE_DRIVER: "local",
      ANTHROPIC_API_KEY: undefined,
      ENCRYPTION_KEY: undefined,
      APP_URL: undefined
    },
    () => assert.doesNotThrow(validateConfig)
  );
});
