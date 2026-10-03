import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  businessCoverageLabel,
  businessQualificationLabel,
  businessTypeLabel
} from "./utils.js";

void describe("Ryva Buyer Intelligence", () => {
  void it("formats business type and coverage for catalog tiles", () => {
    assert.equal(businessTypeLabel({ businessType: "gift_shop" }), "Gift shop");
    assert.equal(businessQualificationLabel({ qualificationStatus: "not_reviewed" }), "Not reviewed");
    assert.equal(
      businessCoverageLabel({ contactCount: 1, verifiedBuyerCount: 0, qualificationStatus: "not_reviewed" }),
      "1 contact · Needs review"
    );
    assert.equal(
      businessCoverageLabel({ contactCount: 2, verifiedBuyerCount: 1, qualificationStatus: "qualified" }),
      "2 contacts · 1 verified buyer"
    );
  });

  void it("register source exposes Business/Buyer policy, create labels, and authority boundary language", () => {
    const source = readFileSync(new URL("./BuyerRegister.tsx", import.meta.url), "utf8");
    assert.match(source, /Businesses & Buyer Intelligence/);
    assert.match(source, /Business is an organization/);
    assert.match(source, /Contacts do not create Buyer authority/);
    assert.match(source, /No ranking or inferred demand/);
    assert.match(source, /Create unqualified record/);
    assert.match(source, /Create unqualified Business/);
    assert.match(source, /businessTypeLabel/);
    assert.match(source, /businessCoverageLabel/);
    assert.doesNotMatch(source, /AuthorityIndicator/);
    assert.doesNotMatch(source, /does not establish representation authority/);
  });

  void it("detail source preserves research, Buyer/Contact distinctions, and decision gate", () => {
    const source = readFileSync(new URL("./BuyerDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Research note/);
    assert.match(source, /Add research note/);
    assert.match(source, /label: "Research"/);
    assert.match(source, /No research recorded yet/);
    assert.match(source, /Qualification review/);
    assert.doesNotMatch(source, /Decision gate/);
    assert.match(source, /Current stage:/);
    assert.match(source, /Next stage:/);
    assert.doesNotMatch(source, /Current status:/);
    assert.doesNotMatch(source, /Target status:/);
    assert.doesNotMatch(source, /Target state/);
    assert.match(source, /qualification and authority remain explicit/i);
    assert.match(source, /Buyer profiles are not Contacts/);
    assert.match(source, /They do not create Buyer authority/);
    assert.match(source, /Product match is not Brand\/Buyer authority/);
    assert.match(source, /People at this business who can make buying decisions|People at this business who influence or make buying decisions/);
    assert.match(source, /This is the store or company account/);
    assert.match(source, /Outreach readiness/);
    assert.match(source, /Contacts available/);
    assert.match(source, /Verified buyer contacts/);
    assert.match(source, /Business profile/);
    assert.match(source, /Buying roles/);
    assert.match(source, /Add buyer role/);
    assert.match(source, /Buying authority/);
    assert.doesNotMatch(source, /Decision context/);
    assert.doesNotMatch(source, /Add unverified evaluator context/);
    assert.doesNotMatch(source, /evaluator context/i);
    assert.match(source, /Wholesale intelligence for this business/);
    assert.match(source, /profileDraft/);
    assert.match(source, /tabWhenStarted/);
    assert.match(source, /businessQualificationLabel/);
    assert.match(source, /businessTypeLabel/);
    assert.doesNotMatch(source, /StatusLabel/);
    assert.doesNotMatch(source, /hasBeenReviewed/);
    assert.doesNotMatch(source, /AuthorityIndicator/);
    assert.doesNotMatch(source, /Buyer profiles and authority/);
    assert.doesNotMatch(source, /Call preparation/);
    assert.doesNotMatch(source, /Diligence fields/);
    assert.doesNotMatch(source, /not established by a Business record/);
    assert.doesNotMatch(source, /Representation authority is not established/);
    assert.doesNotMatch(source, /Material field/);
    assert.doesNotMatch(source, /Reviewed value/);
    assert.doesNotMatch(source, /Save field/);
    assert.doesNotMatch(source, /The newest evidence record will be linked/);
    assert.doesNotMatch(source, /Evidence statement/);
    assert.doesNotMatch(source, /Classification and source/);
    assert.doesNotMatch(source, /Add evidence/);
  });

  void it("buyer css uses token breakpoints without overflow-hiding workarounds", () => {
    const css = readFileSync(new URL("./buyer.css", import.meta.url), "utf8");
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });

  void it("generic compatibility paths are supported by register and detail exports", () => {
    const register = readFileSync(new URL("./BuyerRegister.tsx", import.meta.url), "utf8");
    const detail = readFileSync(new URL("./BuyerDetail.tsx", import.meta.url), "utf8");
    assert.match(register, /showCompatibilityNotice/);
    assert.match(register, /compatibility\.detailPath/);
    assert.match(detail, /Generic Business detail compatibility/);
    assert.match(detail, /compatibility\.registerPath/);
  });
});
