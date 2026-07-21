import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

void describe("Ryva Product Intelligence", () => {
  void it("register source exposes comparison policy, create labels, and no Product Score language", () => {
    const source = readFileSync(new URL("./ProductRegister.tsx", import.meta.url), "utf8");
    assert.match(source, /Product Intelligence/);
    assert.match(source, /No numerical ranking is calculated/);
    assert.match(source, /Create unqualified record/);
    assert.match(source, /Compare/);
  });

  void it("detail source preserves evidence and observation form labels", () => {
    const source = readFileSync(new URL("./ProductDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Exact claim or unknown/);
    assert.match(source, /Add evidence/);
    assert.match(source, /Record observation/);
    assert.match(source, /EvidenceLabel/);
    assert.match(source, /AuthorityIndicator/);
  });

  void it("comparison create source preserves selection and validation messaging", () => {
    const source = readFileSync(new URL("./ProductComparison.tsx", import.meta.url), "utf8");
    assert.match(source, /Create comparison/);
    assert.match(source, /No numerical Product Score/);
    assert.match(source, /Create aligned comparison/);
    assert.match(source, /Selection incomplete/);
  });

  void it("comparison detail source exposes mobile focus controls and interpretation limits", () => {
    const source = readFileSync(new URL("./ProductComparison.tsx", import.meta.url), "utf8");
    assert.match(source, /ry-product-comparison-mobile/);
    assert.match(source, /Interpretation limits/);
    assert.match(source, /No ranking or recommendation/);
  });

  void it("product css uses token breakpoints without overflow-hiding workarounds", () => {
    const css = readFileSync(new URL("./product.css", import.meta.url), "utf8");
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });

  void it("generic compatibility paths are supported by register and detail exports", () => {
    const register = readFileSync(new URL("./ProductRegister.tsx", import.meta.url), "utf8");
    const detail = readFileSync(new URL("./ProductDetail.tsx", import.meta.url), "utf8");
    assert.match(register, /showCompatibilityNotice/);
    assert.match(register, /compatibility\.detailPath/);
    assert.match(detail, /Generic Product detail compatibility/);
    assert.match(detail, /compatibility\.registerPath/);
  });
});
