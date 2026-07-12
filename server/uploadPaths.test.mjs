import assert from "node:assert/strict";
import test from "node:test";
import { resolveUserUploadPath } from "./uploadPaths.mjs";

test("resolveUserUploadPath includes the tenant directory", () => {
  assert.equal(
    resolveUserUploadPath("/var/ryva/uploads", "user-1", "file-1-contract.pdf"),
    "/var/ryva/uploads/user-1/file-1-contract.pdf"
  );
});

test("resolveUserUploadPath rejects a tenant traversal", () => {
  assert.throws(() => resolveUserUploadPath("/var/ryva/uploads", "../other-user", "file.txt"));
});

test("resolveUserUploadPath strips traversal from corrupted stored names", () => {
  assert.equal(
    resolveUserUploadPath("/var/ryva/uploads", "user-1", "../../secret.txt"),
    "/var/ryva/uploads/user-1/secret.txt"
  );
});
