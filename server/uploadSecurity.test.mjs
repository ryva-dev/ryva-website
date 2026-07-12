import assert from "node:assert/strict";
import test from "node:test";
import { validateTenantUpload } from "./uploadSecurity.mjs";

test("upload validation accepts bounded documents", () => {
  const result = validateTenantUpload({ name: "brief.txt", type: "text/plain", contentBase64: Buffer.from("private brief").toString("base64") });
  assert.equal(result.body.toString(), "private brief");
});

test("upload validation rejects traversal, scripts, malformed payloads, and executable magic", () => {
  assert.throws(() => validateTenantUpload({ name: "../secret.txt", type: "text/plain", contentBase64: "YQ==" }), /name/i);
  assert.throws(() => validateTenantUpload({ name: "attack.sh", type: "text/plain", contentBase64: "YQ==" }), /script/i);
  assert.throws(() => validateTenantUpload({ name: "brief.txt", type: "text/plain", contentBase64: "%%%=" }), /base64/i);
  assert.throws(() => validateTenantUpload({ name: "fake.txt", type: "text/plain", contentBase64: Buffer.from([0x4d, 0x5a, 0, 0]).toString("base64") }), /Executable content/i);
  assert.throws(() => validateTenantUpload({ name: "large.txt", type: "text/plain", contentBase64: Buffer.from("too large").toString("base64"), maxBytes: 2 }), /between/i);
});
