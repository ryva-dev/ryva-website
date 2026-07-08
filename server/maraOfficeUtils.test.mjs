import test from "node:test";
import assert from "node:assert/strict";
import { deriveMaraPermissionsFromOnboarding, formatTaskSourceLabel } from "./maraOfficeUtils.mjs";

test("formatTaskSourceLabel hides internal source keys", () => {
  assert.equal(formatTaskSourceLabel("onboarding_generated"), "From your onboarding");
  assert.equal(formatTaskSourceLabel("autonomy_starter"), "Getting started");
  assert.equal(formatTaskSourceLabel("worker_task"), "");
});

test("deriveMaraPermissionsFromOnboarding respects approval boundaries", () => {
  const restrictive = deriveMaraPermissionsFromOnboarding({
    approval_rules: "Never send anything without my approval.",
    reply_boundaries: "Draft only and bring everything back to me first.",
    integration_interest: "No, keep it manual"
  });
  assert.equal(restrictive.canSendEmailsWithoutApproval, false);
  assert.equal(restrictive.canReadInbox, false);
  assert.equal(restrictive.canRunResearch, true);
});
