import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

void describe("Ryva Commerce", () => {
  void it("account register preserves continuity copy and register contracts", () => {
    const source = readFileSync(new URL("./AccountRegister.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Protected Accounts and operational Accounts"/);
    assert.match(source, /do not create contractual rights/i);
    assert.match(source, /Account status/);
    assert.match(source, /No Accounts yet\. Confirm a documented opening Order/);
    assert.match(source, /\/api\/accounts/);
    assert.match(source, /\/api\/commercial-export\/account/);
    assert.match(source, /RegisterMobileList/);
    assert.match(source, /CommercialSubnav/);
  });

  void it("account detail preserves health review and commercial boundaries", () => {
    const source = readFileSync(new URL("./AccountDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Confirm human account review/);
    assert.match(source, /Factual health rationale/);
    assert.match(source, /Commercial history remains visible/);
    assert.match(source, /not guaranteed revenue/i);
    assert.match(source, /ConsequentialReviewLayout/);
    assert.match(source, /ConfirmationDialog/);
    assert.match(source, /Increment 15/);
    assert.match(source, /Placement is not an Account|Placement does not become an Account|Placement.*not.*Account/i);
  });

  void it("order register preserves multi-line entry and verification separation", () => {
    const source = readFileSync(new URL("./OrderRegister.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Orders"/);
    assert.match(source, /Record an opening Order/);
    assert.match(source, /Order-discussion Placement/);
    assert.match(source, /Clean source document/);
    assert.match(source, /Add line/);
    assert.match(source, /Save review-required Order/);
    assert.match(source, /Drafts and projections are excluded/i);
    assert.match(source, /\/api\/orders/);
  });

  void it("order detail preserves consequential confirmation boundaries", () => {
    const source = readFileSync(new URL("./OrderDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Confirm documented Order/);
    assert.match(source, /ConsequentialReviewLayout/);
    assert.match(source, /ExactArtifact/);
    assert.match(source, /\/api\/orders\/\$\{id\}\/confirm/);
    assert.match(source, /caught instanceof ApiProblem/);
    assert.match(source, /commission owed|not commission/i);
    assert.match(source, /existing commission workflow|Open commissions/);
  });

  void it("protected account register preserves documentary-rights copy", () => {
    const source = readFileSync(new URL("./ProtectedAccountRegister.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Protected Accounts"/);
    assert.match(source, /does not create contractual protection/i);
    assert.match(source, /Protection status/);
    assert.match(source, /Register a documented account-rights basis/);
    assert.match(source, /Create pending rights review/);
    assert.match(source, /\/api\/protected-accounts/);
  });

  void it("reorder register preserves projection honesty", () => {
    const source = readFileSync(new URL("./ReorderRegister.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Reorders and account health"/);
    assert.match(source, /not guaranteed revenue/i);
    assert.match(source, /Human Reorder review/);
    assert.match(source, /Confirm human review/);
    assert.match(source, /\/api\/reorders/);
    assert.match(source, /Review status/);
  });

  void it("commerce css uses token breakpoints without overflow-hiding", () => {
    const css = readFileSync(new URL("./commerce.css", import.meta.url), "utf8");
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });

  void it("index exposes migrated commercial pages", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    assert.match(source, /AccountRegisterPage/);
    assert.match(source, /AccountDetailPage/);
    assert.match(source, /OrderRegisterPage/);
    assert.match(source, /OrderDetailPage/);
    assert.match(source, /ProtectedAccountRegisterPage/);
    assert.match(source, /ReorderRegisterPage/);
  });

  void it("domain boundaries remain explicit across commerce surfaces", () => {
    const account = readFileSync(new URL("./AccountDetail.tsx", import.meta.url), "utf8");
    const order = readFileSync(new URL("./OrderDetail.tsx", import.meta.url), "utf8");
    const reorder = readFileSync(new URL("./ReorderRegister.tsx", import.meta.url), "utf8");
    const protection = readFileSync(new URL("./ProtectedAccountRegister.tsx", import.meta.url), "utf8");
    assert.match(account, /Order value is not commission owed|not commission owed/i);
    assert.match(order, /Order is not protection/i);
    assert.match(order, /Placement is not Account/i);
    assert.match(reorder, /Time alone never establishes eligibility/i);
    assert.match(protection, /does not create contractual protection/i);
    assert.doesNotMatch(account, /Stripe|ARR forecast|pipeline revenue chart/i);
    assert.doesNotMatch(order, /automatically create protection|AI can approve/i);
  });
});
