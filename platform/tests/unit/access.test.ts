import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideAccess, type AccessRow } from "../../packages/domain/src/index.js";

const at = new Date("2026-07-19T12:00:00.000Z");
const base: AccessRow = {
  user_id: "user",
  user_status: "active",
  workspace_id: "workspace",
  workspace_status: "active",
  role: "representative",
  membership_status: "active",
  credential_status: "active",
  credential_expires_at: new Date("2027-07-19T12:00:00.000Z"),
  suspension_read_only_allowed: false,
  subscription_status: "active",
  current_period_end: new Date("2026-08-19T12:00:00.000Z"),
  past_due_since: null
};

describe("access decision policy", () => {
  it("grants full access only with active credential and entitlement", () => {
    const result = decideAccess(base, at);
    assert.equal(result.mode, "full");
    assert.ok(result.capabilities.includes("operational:write"));
  });

  it("makes an expired credential read-only during the 30-day grace", () => {
    const result = decideAccess(
      {
        ...base,
        credential_status: "expired",
        credential_expires_at: new Date("2026-07-14T12:00:00.000Z")
      },
      at
    );
    assert.equal(result.mode, "read_only");
    assert.equal(result.graceEndsAt, "2026-08-13T12:00:00.000Z");
    assert.ok(!result.capabilities.includes("operational:write"));
  });

  it("restricts an expired credential after grace", () => {
    const result = decideAccess(
      {
        ...base,
        credential_status: "expired",
        credential_expires_at: new Date("2026-06-01T12:00:00.000Z")
      },
      at
    );
    assert.equal(result.mode, "restricted");
    assert.ok(!result.capabilities.includes("operational:read"));
  });

  it("honors suspension read-only policy and blocks revocation", () => {
    assert.equal(
      decideAccess(
        { ...base, credential_status: "suspended", suspension_read_only_allowed: true },
        at
      ).mode,
      "read_only"
    );
    assert.equal(decideAccess({ ...base, credential_status: "revoked" }, at).mode, "blocked");
  });

  it("keeps canceled subscriptions full through paid period then restricts", () => {
    assert.equal(
      decideAccess({ ...base, subscription_status: "canceled", current_period_end: new Date("2026-07-29T12:00:00.000Z") }, at).mode,
      "full"
    );
    assert.equal(
      decideAccess({ ...base, subscription_status: "canceled", current_period_end: new Date("2026-05-01T12:00:00.000Z") }, at).mode,
      "subscription_required"
    );
  });

  it("does not require a representative credential for scoped staff roles", () => {
    const result = decideAccess(
      { ...base, role: "admin", credential_status: null, subscription_status: null },
      at
    );
    assert.equal(result.mode, "full");
    assert.ok(result.capabilities.includes("admin:access"));
    assert.ok(!result.capabilities.includes("operational:write"));
  });
});
