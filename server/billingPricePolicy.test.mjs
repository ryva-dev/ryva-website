import assert from "node:assert/strict";
import test from "node:test";
import { validateConfiguredPrice } from "./billingPricePolicy.mjs";

test("configured Stripe prices must match the worker's displayed monthly salary", () => {
  assert.equal(validateConfiguredPrice({ active: true, unit_amount: 7900, currency: "usd", type: "recurring", recurring: { interval: "month" } }, { expectedAmountCents: 7900 }).valid, true);
  const stale = validateConfiguredPrice({ active: true, unit_amount: 4000, currency: "usd", type: "recurring", recurring: { interval: "month" } }, { expectedAmountCents: 7900 });
  assert.equal(stale.valid, false);
  assert.match(stale.reasons.join(" "), /7900/);
});
