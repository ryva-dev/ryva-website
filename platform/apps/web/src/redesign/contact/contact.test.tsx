import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

void describe("Ryva Contact relationship", () => {
  void it("detail source preserves verification boundary, authority language, call preparation, and silent reload", () => {
    const source = readFileSync(new URL("./ContactDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Verification boundary/);
    assert.match(source, /A Contact record never establishes Brand, Product, territory, channel, or Buyer Outreach authority\./);
    assert.match(source, /Call preparation/);
    assert.match(source, /tabWhenStarted/);
    assert.match(source, /load\(\{ silent: true \}\)/);
    assert.match(source, /Verification does not override suppression/);
  });

  void it("register source exposes Contact create labels and Business/Buyer/Contact distinction language", () => {
    const source = readFileSync(new URL("./ContactRegister.tsx", import.meta.url), "utf8");
    assert.match(source, /Contact register/);
    assert.match(source, /Create unverified Contact/);
    assert.match(source, /aria-label="Create unverified Contact"/);
    assert.match(source, /A Contact is an individual person/);
    assert.match(source, /a Business is an organization/);
    assert.match(source, /a Buyer is a role/);
    assert.match(source, /They do not create Buyer authority/);
  });

  void it("contact css uses token breakpoints without overflow-hiding workarounds", () => {
    const css = readFileSync(new URL("./contact.css", import.meta.url), "utf8");
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });

  void it("generic compatibility paths are supported by register and detail exports", () => {
    const register = readFileSync(new URL("./ContactRegister.tsx", import.meta.url), "utf8");
    const detail = readFileSync(new URL("./ContactDetail.tsx", import.meta.url), "utf8");
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    assert.match(register, /showCompatibilityNotice/);
    assert.match(register, /compatibility\.detailPath/);
    assert.match(detail, /Generic Contact detail compatibility/);
    assert.match(detail, /compatibility\.registerPath/);
    assert.match(index, /ContactIntelligencePage/);
  });
});
