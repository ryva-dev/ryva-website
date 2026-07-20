import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "../../packages/config/src/index.js";
import {
  decryptSecret,
  encryptSecret,
  hashPassword,
  secureDigest,
  verifyPassword
} from "../../packages/domain/src/index.js";

describe("security primitives", () => {
  it("hashes passwords with a unique salt and verifies without exposing input", async () => {
    const first = await hashPassword("Correct horse battery staple", "pepper");
    const second = await hashPassword("Correct horse battery staple", "pepper");
    assert.notEqual(first, second);
    assert.equal(await verifyPassword("Correct horse battery staple", first, "pepper"), true);
    assert.equal(await verifyPassword("incorrect password here", first, "pepper"), false);
  });

  it("encrypts sensitive values with authenticated encryption", () => {
    const key = "1".repeat(64);
    const encrypted = encryptSecret("synthetic-secret", key);
    assert.notEqual(encrypted, "synthetic-secret");
    assert.equal(decryptSecret(encrypted, key), "synthetic-secret");
  });

  it("uses keyed session digests", () => {
    assert.notEqual(secureDigest("token", "pepper-a"), secureDigest("token", "pepper-b"));
  });

  it("fails production startup when mandatory provider and security configuration is absent", () => {
    assert.throws(
      () =>
        loadConfig({
          NODE_ENV: "production",
          APP_URL: "http://example.com",
          DATABASE_URL: "postgres://example.invalid/ryva",
          PGSSL: "disable"
        }),
      /Invalid Ryva Pro configuration/
    );
  });
});
