import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  brandFieldValueLabel,
  brandIdentityLabel,
  brandNameTitle,
  brandReadinessLabel,
  brandResearchConfidenceLabel,
  brandResearchEvidenceClass,
  brandRiskLabel,
  brandStageLabel,
  displayBrandName
} from "./utils.js";

void describe("Ryva Brand Intelligence", () => {
  void it("formats brand display names like Representation register columns", () => {
    assert.equal(displayBrandName("Increment11 Brand acct-chromium-desktop-1784734596469"), "Increment11 Brand");
    assert.equal(brandNameTitle("Increment11 Brand acct-chromium-desktop-1784734596469"), "Increment11 Brand acct-chromium-desktop-1784734596469");
    assert.equal(brandStageLabel({ pipelineStage: "discovered" }), "Discovered");
    assert.equal(brandReadinessLabel({ wholesaleStatus: "unknown" }), "Needs review");
    assert.equal(brandRiskLabel({ riskCount: 0 }), "Low");
    assert.equal(brandIdentityLabel({ identityStatus: "unverified" }), "Unverified");
    assert.equal(brandFieldValueLabel("wholesaleStatus"), "Select status");
    assert.equal(brandResearchEvidenceClass("strong"), "verified_fact");
    assert.equal(brandResearchConfidenceLabel("limited"), "Low");
  });

  void it("register source exposes Brand policy, create labels, and representation boundary language", () => {
    const source = readFileSync(new URL("./BrandRegister.tsx", import.meta.url), "utf8");
    assert.match(source, /Brand Intelligence/);
    assert.match(source, /does not imply outreach permission or representation authority/);
    assert.match(source, /Create brand/);
    assert.match(source, /Add a brand to begin research and wholesale evaluation/);
    assert.match(source, /Brand name/);
    assert.doesNotMatch(source, /Create unqualified record/);
    assert.doesNotMatch(source, /research record/);
    assert.match(source, /Create Brand/);
    assert.match(source, /defaultVisibleColumns/);
    assert.match(source, /brandStageLabel/);
    assert.match(source, /brandReadinessLabel/);
    assert.match(source, /brandRiskLabel/);
    assert.match(source, /ry-brand-register-dimension/);
    assert.match(source, /label: "Readiness"/);
    assert.doesNotMatch(source, /<StatusLabel value={brandStage/);
    assert.match(source, /label: "Stage"/);
    assert.doesNotMatch(source, /label: "Wholesale readiness"/);
    assert.doesNotMatch(source, /label: "Pipeline stage"/);
    assert.match(source, /AuthorityIndicator/);
    assert.match(source, /RegisterPagination/);
    assert.match(source, /pageSize = 20/);
  });

  void it("detail source preserves evidence, products, and authority distinctions", () => {
    const source = readFileSync(new URL("./BrandDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Brand research/);
    assert.match(source, /Add verified information, sources, and notes about this brand/);
    assert.match(source, /Finding \/ detail/);
    assert.match(source, /Add finding/);
    assert.doesNotMatch(source, /Evidence statement/);
    assert.doesNotMatch(source, /Classification and source/);
    assert.doesNotMatch(source, /Add evidence/);
    assert.match(source, /Related Products/);
    assert.match(source, /No representation authority yet/);
    assert.match(source, /An active agreement is required before this brand can be represented/);
    assert.match(source, /Open Representation/);
    assert.doesNotMatch(source, /Representation readiness versus authority/);
    assert.doesNotMatch(source, /Brand record never establishes/);
    assert.match(source, /tabWhenStarted/);
    assert.match(source, /brandStageLabel\(record\)/);
    assert.match(source, /brandReadinessLabel\(record\)/);
    assert.match(source, /brandIdentityLabel\(record\)/);
    assert.match(source, /ry-brand-status-sep/);
    assert.doesNotMatch(source, /<StatusLabel value={stage}/);
    assert.doesNotMatch(source, /label: "Stage"/);
    assert.doesNotMatch(source, /Material field/);
    assert.doesNotMatch(source, /Reviewed value/);
    assert.doesNotMatch(source, /Save field/);
    assert.match(source, /brandFieldValueLabel/);
    assert.match(source, />Save</);
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
