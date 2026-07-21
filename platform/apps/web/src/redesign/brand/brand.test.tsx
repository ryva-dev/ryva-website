import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

void describe("Ryva Brand Intelligence", () => {
  void it("register source exposes Brand policy, create labels, and representation boundary language", () => {
    const source = readFileSync(new URL("./BrandRegister.tsx", import.meta.url), "utf8");
    assert.match(source, /Brand Intelligence/);
    assert.match(source, /does not imply outreach permission or representation authority/);
    assert.match(source, /Create unqualified record/);
    assert.match(source, /AuthorityIndicator/);
  });

  void it("detail source preserves evidence, products, and authority distinctions", () => {
    const source = readFileSync(new URL("./BrandDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Exact claim or unknown/);
    assert.match(source, /Add evidence/);
    assert.match(source, /Related Products/);
    assert.match(source, /Representation readiness versus authority/);
    assert.match(source, /Authority not established here/);
    assert.match(source, /tabWhenStarted/);
  });

  void it("brand css uses token breakpoints without overflow-hiding workarounds", () => {
    const css = readFileSync(new URL("./brand.css", import.meta.url), "utf8");
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });

  void it("generic compatibility paths are supported by register and detail exports", () => {
    const register = readFileSync(new URL("./BrandRegister.tsx", import.meta.url), "utf8");
    const detail = readFileSync(new URL("./BrandDetail.tsx", import.meta.url), "utf8");
    assert.match(register, /showCompatibilityNotice/);
    assert.match(register, /compatibility\.detailPath/);
    assert.match(detail, /Generic Brand detail compatibility/);
    assert.match(detail, /compatibility\.registerPath/);
  });
});
