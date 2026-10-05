import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ConfiguredObjectStorage } from "../../apps/api/src/providers.js";
import { loadConfig } from "../../packages/config/src/index.js";

const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY;

void describe("S3 upload signing", () => {
  before(() => {
    process.env.AWS_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
  });

  after(() => {
    if (originalAccessKey === undefined) delete process.env.AWS_ACCESS_KEY_ID;
    else process.env.AWS_ACCESS_KEY_ID = originalAccessKey;
    if (originalSecretKey === undefined) delete process.env.AWS_SECRET_ACCESS_KEY;
    else process.env.AWS_SECRET_ACCESS_KEY = originalSecretKey;
  });

  void it("signs every required client upload header without hoisting it", async () => {
    const storage = new ConfiguredObjectStorage(loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://localhost/unused",
      PGSSL: "disable",
      STORAGE_DRIVER: "s3",
      S3_BUCKET: "ryva-private-test-bucket",
      S3_REGION: "us-east-2"
    }));
    const sha256 = "a".repeat(64);
    const target = await storage.createUploadTarget({
      documentId: "document-1",
      storageKey: "workspaces/workspace-1/documents/document-1/file.csv",
      mediaType: "text/csv",
      byteSize: 12,
      sha256
    });

    const parsed = new URL(target.url);
    const signedHeaders = new Set(
      (parsed.searchParams.get("X-Amz-SignedHeaders") ?? "").split(";")
    );
    const requiredHeaders = new Set(Object.keys(target.headers));

    assert.equal(target.method, "PUT");
    assert.equal(target.expiresInSeconds, 900);
    assert.equal(parsed.searchParams.get("X-Amz-Expires"), "900");
    assert.equal(parsed.pathname, "/workspaces/workspace-1/documents/document-1/file.csv");
    assert.deepEqual(requiredHeaders, new Set([
      "content-type",
      "x-amz-checksum-sha256",
      "x-amz-server-side-encryption"
    ]));
    for (const header of requiredHeaders) {
      assert.ok(signedHeaders.has(header), `${header} must be covered by the signature`);
      assert.equal(parsed.searchParams.has(header), false, `${header} must not be hoisted`);
    }
    assert.equal(
      target.headers["x-amz-checksum-sha256"],
      Buffer.from(sha256, "hex").toString("base64")
    );
    assert.equal(target.headers["x-amz-server-side-encryption"], "AES256");
  });
});
