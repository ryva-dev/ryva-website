import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideAccess, type AccessRow } from "../../packages/domain/src/index.js";

const at = new Date("2026-08-15T12:00:00.000Z");
const base: AccessRow = {
  user_id: "user",
  user_status: "active",
  workspace_id: "workspace",
  workspace_status: "active",
  role: "representative",
  membership_status: "active",
  program_status: null,
  program_completed_at: null,
  pro_trial_started_at: null,
  pro_trial_ends_at: null,
  subscription_status: null,
  current_period_end: null,
  past_due_since: null
};

const completed = {
  program_status: "active",
  program_completed_at: new Date("2026-07-01T12:00:00.000Z"),
  pro_trial_started_at: new Date("2026-07-01T12:00:00.000Z"),
  pro_trial_ends_at: new Date("2026-07-31T12:00:00.000Z")
};

describe("canonical Program and Ryva Pro access policy", () => {
  it("keeps account-only users in account capabilities", () => {
    const result = decideAccess(base, at);
    assert.equal(result.mode, "account_only");
    assert.equal(result.canAccessProgram, false);
    assert.equal(result.canAccessOperatingPlatform, false);
    assert.ok(result.capabilities.includes("settings:read"));
    assert.ok(!result.capabilities.includes("operational:read"));
  });

  it("allows an active incomplete Program without operating access", () => {
    const result = decideAccess({ ...base, program_status: "active" }, at);
    assert.equal(result.mode, "program_only");
    assert.equal(result.canAccessProgram, true);
    assert.equal(result.isProgramCompleted, false);
    assert.ok(result.capabilities.includes("program:read"));
    assert.ok(!result.capabilities.includes("operational:read"));
  });

  it("unlocks operating access during the completion-based trial", () => {
    const result = decideAccess({
      ...base,
      program_status: "active",
      program_completed_at: new Date("2026-08-10T12:00:00.000Z"),
      pro_trial_started_at: new Date("2026-08-10T12:00:00.000Z"),
      pro_trial_ends_at: new Date("2026-09-09T12:00:00.000Z")
    }, at);
    assert.equal(result.mode, "full");
    assert.equal(result.isProTrialActive, true);
    assert.equal(result.canAccessOperatingPlatform, true);
  });

  it("retains Program access when the trial expires without Pro", () => {
    const result = decideAccess({ ...base, ...completed }, at);
    assert.equal(result.mode, "pro_required");
    assert.equal(result.canAccessProgram, true);
    assert.equal(result.isProgramCompleted, true);
    assert.equal(result.canAccessOperatingPlatform, false);
  });

  it("accepts an active or paid-through Pro subscription after completion", () => {
    const active = decideAccess({
      ...base,
      ...completed,
      subscription_status: "active",
      current_period_end: new Date("2026-09-15T12:00:00.000Z")
    }, at);
    const paidThrough = decideAccess({
      ...base,
      ...completed,
      subscription_status: "canceled",
      current_period_end: new Date("2026-08-25T12:00:00.000Z")
    }, at);
    assert.equal(active.proAccessState, "subscription_active");
    assert.equal(active.canAccessOperatingPlatform, true);
    assert.equal(paidThrough.proAccessState, "paid_through");
    assert.equal(paidThrough.canAccessOperatingPlatform, true);
  });

  it("does not let a stray subscription bypass Program completion", () => {
    const result = decideAccess({
      ...base,
      subscription_status: "active",
      current_period_end: new Date("2026-09-15T12:00:00.000Z")
    }, at);
    assert.equal(result.mode, "account_only");
    assert.equal(result.canAccessOperatingPlatform, false);
    assert.equal(result.isProActive, false);
  });

  it("ignores historical certification fields for representative access", () => {
    const active = { ...base, ...completed, subscription_status: "active", current_period_end: new Date("2026-09-15T12:00:00.000Z") };
    const withRevokedCredential = { ...active, credential_status: "revoked" };
    assert.deepEqual(decideAccess(withRevokedCredential, at), decideAccess(active, at));
  });

  it("keeps staff independent of Program and Pro", () => {
    const result = decideAccess({ ...base, role: "admin" }, at);
    assert.equal(result.reason, "staff");
    assert.ok(result.capabilities.includes("admin:access"));
    assert.equal(result.proAccessState, "staff");
  });
});
