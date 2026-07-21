import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

void describe("Ryva Buyer Intelligence", () => {
  void it("register source exposes Business/Buyer policy, create labels, and authority boundary language", () => {
    const source = readFileSync(new URL("./BuyerRegister.tsx", import.meta.url), "utf8");
    assert.match(source, /Buyer Intelligence/);
    assert.match(source, /Business is an organization/);
    assert.match(source, /Contacts do not create Buyer authority/);
    assert.match(source, /No ranking or inferred demand/);
    assert.match(source, /Create unqualified record/);
    assert.match(source, /Create unqualified Business/);
    assert.match(source, /AuthorityIndicator/);
  });

  void it("detail source preserves evidence, Buyer/Contact distinctions, and human decision gate", () => {
    const source = readFileSync(new URL("./BuyerDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Exact claim or unknown/);
    assert.match(source, /Add evidence/);
    assert.match(source, /Human decision gate/);
    assert.match(source, /qualification and authority are human-owned/);
    assert.match(source, /Buyer profiles are not Contacts/);
    assert.match(source, /They do not create Buyer authority/);
    assert.match(source, /Product match is not Brand\/Buyer authority/);
    assert.match(source, /not established by a Business record/);
    assert.match(source, /tabWhenStarted/);
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
