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

test("production refuses plaintext OAuth token storage", () => {
  withEnvironment(
    { NODE_ENV: "production", DATABASE_URL: undefined, ANTHROPIC_API_KEY: "test-key", ENCRYPTION_KEY: undefined },
    () => assert.throws(validateConfig, /ENCRYPTION_KEY is required/)
  );
});

test("production accepts Postgres after Stage B cutover", () => {
  withEnvironment(
    {
      NODE_ENV: "production",
      DATABASE_URL: "postgres://example.invalid/ryva",
      ANTHROPIC_API_KEY: "test-key",
      ENCRYPTION_KEY: "00".repeat(32),
      OBJECT_STORAGE_DRIVER: "s3",
      STRIPE_SECRET_KEY: undefined,
      STRIPE_WEBHOOK_SECRET: undefined
    },
    () => assert.doesNotThrow(validateConfig)
  );
});

test("production accepts the honest single-instance configuration", () => {
  withEnvironment(
    {
      NODE_ENV: "production",
      DATABASE_URL: undefined,
      ANTHROPIC_API_KEY: "test-key",
      ENCRYPTION_KEY: "00".repeat(32),
      STRIPE_SECRET_KEY: undefined,
      STRIPE_WEBHOOK_SECRET: undefined
    },
    () => assert.doesNotThrow(validateConfig)
  );
});
