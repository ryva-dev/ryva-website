import assert from "node:assert/strict";
import test from "node:test";
import { resolvePostgresSsl } from "./postgresSsl.mjs";

test("Postgres SSL defaults to verified TLS", () => {
  // null bypasses an ambient PGSSL value while preserving the production API,
  // where undefined intentionally means "read process.env.PGSSL".
  assert.deepEqual(resolvePostgresSsl(null), { rejectUnauthorized: true });
  assert.deepEqual(resolvePostgresSsl("verify-full"), { rejectUnauthorized: true });
});

test("Postgres SSL require keeps encryption while accepting provider-managed certificates", () => {
  assert.deepEqual(resolvePostgresSsl("require"), { rejectUnauthorized: false });
});

test("Postgres SSL disable and invalid modes are explicit", () => {
  assert.equal(resolvePostgresSsl("disable"), false);
  assert.throws(() => resolvePostgresSsl("unsafe"), /PGSSL must be one of/);
});
