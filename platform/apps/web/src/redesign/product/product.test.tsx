import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { catalogReadiness, catalogWholesaleSignals, formatProductEvidenceDisplay, productDataCompleteness, productStageLabel, productViewLabel } from "./utils";

void describe("Ryva Product Intelligence", () => {
  void it("register source exposes create drawer, catalog tiles, and no Product Score language", () => {
    const source = readFileSync(new URL("./ProductRegister.tsx", import.meta.url), "utf8");
    assert.match(source, /Product Intelligence/);
    assert.match(source, /No numerical ranking is calculated/);
    assert.match(source, /Create product/);
    assert.match(source, /ry-product-create-drawer/);
    assert.match(source, /Drawer/);
    assert.match(source, /ry-product-catalog/);
    assert.match(source, /ry-product-tile/);
    assert.match(source, /Preview \$\{label\}/);
    assert.match(source, /Dialog/);
    assert.match(source, /ry-product-preview-dialog/);
    assert.match(source, /Open product/);
    assert.match(source, /addToCompare/);
    assert.match(source, /Compare/);
    assert.match(source, /Add to comparison/);
    assert.match(source, /previewPrimaryRisk/);
    assert.match(source, /catalogWholesaleSignals/);
    assert.match(source, /ry-product-tile-image/);
    assert.match(source, /Product status/);
    assert.match(source, /productViewLabel/);
    assert.match(source, /Data confidence/);
    assert.match(source, /ry-product-tile-meta/);
    assert.doesNotMatch(source, /Create a research record/);
    assert.doesNotMatch(source, /Product Score/);
    assert.doesNotMatch(source, />Close</);
  });

  void it("detail source uses product-review language and drops authority framing", () => {
    const source = readFileSync(new URL("./ProductDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Back to products/);
    assert.match(source, /Product overview/);
    assert.match(source, /productDataCompleteness/);
    assert.match(source, /Stage/);
    assert.match(source, /Review outcome/);
    assert.match(source, /Data completeness/);
    assert.match(source, /At a glance/);
    assert.match(source, /productStageLabel/);
    assert.match(source, /productDataCompleteness/);
    assert.match(source, /productReviewOutcomeLabel/);
    assert.doesNotMatch(source, /Current status:/);
    assert.doesNotMatch(source, /Product status:/);
    assert.doesNotMatch(source, /title="Product status"/);
    assert.match(source, /Suggested retail/);
    assert.match(source, /ry-product-area-switch/);
    assert.match(source, /detailAreas = \["Commercial", "Merchandising", "Performance", "Market", "Identity"\]/);
    assert.match(source, /Save \$\{detailArea\.toLowerCase\(\)\}/);
    assert.match(source, /Save review/);
    assert.match(source, /Buyer types/);
    assert.match(source, /Add buyer type/);
    assert.match(source, /Added by you/);
    assert.match(source, /Ryva suggestion/);
    assert.match(source, /Business matches/);
    assert.match(source, /\/buyers\//);
    assert.doesNotMatch(source, /Reviewed buyer matches/);
    assert.doesNotMatch(source, /Suggest buyer type/);
    assert.doesNotMatch(source, /Suggested buyer types/);
    assert.match(source, /Independent gift/);
    assert.match(source, /EvidenceLabel/);
    assert.match(source, /ry-product-form-compact/);
    assert.match(source, /Commercial readiness/);
    assert.match(source, /ry-product-readiness-row/);
    assert.match(source, /openReadinessDetail/);
    assert.match(source, /product-field-summary/);
    assert.doesNotMatch(source, /Update readiness/);
    assert.match(source, /formatProductEvidenceDisplay/);
    assert.match(source, /ry-product-evidence-meta/);
    assert.match(source, /ry-product-identity-status/);
    assert.match(source, /ry-product-identity-status/);
    assert.doesNotMatch(source, /ry-product-status-chips/);
    assert.doesNotMatch(source, /ry-product-chip/);
    assert.doesNotMatch(source, /Review product/);
    assert.doesNotMatch(source, /Detail area/);
    assert.doesNotMatch(source, /AuthorityIndicator/);
    assert.doesNotMatch(source, /Exact claim or unknown/);
    assert.doesNotMatch(source, /Add evidence/);
    assert.doesNotMatch(source, /Material field/);
    assert.doesNotMatch(source, /Decision gate/);
    assert.doesNotMatch(source, /Stored Product facts/);
  });

  void it("comparison create source preserves selection and validation messaging", () => {
    const source = readFileSync(new URL("./ProductComparison.tsx", import.meta.url), "utf8");
    assert.match(source, /Compare products/);
    assert.match(source, /Save comparison/);
    assert.match(source, /Review missing details/);
    assert.match(source, /Compare for buyer/);
    assert.match(source, /Comparing for/);
    assert.match(source, /Change buyer/);
    assert.match(source, /No clear commercial advantage yet/);
    assert.match(source, /Comparison blocked by incomplete data/);
    assert.match(source, /Complete product details/);
    assert.match(source, /Awaiting pricing/);
    assert.match(source, /Confirm MOQ/);
    assert.match(source, /Confirm lead time/);
    assert.match(source, /readiness checks complete/);
    assert.match(source, /coreComparisonGaps/);
    assert.match(source, /ry-product-comparison-lede/);
    assert.match(source, /ry-product-comparison-workspace/);
    assert.match(source, /ry-product-comparison-summary/);
    assert.match(source, /ry-product-comparison-sticky/);
    assert.match(source, /ry-product-comparison-table/);
    assert.match(source, /ry-product-comparison-header-actions/);
    assert.match(source, /Select at least one more product/);
    assert.match(source, /More than four products becomes hard to read/);
    assert.match(source, /normalizeComparisonProduct/);
    assert.match(source, /ry-product-comparison-drawer/);
    assert.match(source, /Drawer/);
    assert.match(source, /Buyer type/);
    assert.match(source, /Comparison name/);
    assert.doesNotMatch(source, /Basic comparison/);
    assert.doesNotMatch(source, /Show more/);
    assert.doesNotMatch(source, /title="Create comparison"/);
    assert.doesNotMatch(source, /Product Score/);
  });

  void it("comparison detail source exposes mobile focus controls and interpretation limits", () => {
    const source = readFileSync(new URL("./ProductComparison.tsx", import.meta.url), "utf8");
    assert.match(source, /ry-product-comparison-mobile/);
    assert.match(source, /Interpretation limits/);
    assert.match(source, /No ranking or recommendation/);
  });

  void it("product css uses token breakpoints, catalog grid, and no overflow-hiding workarounds", () => {
    const css = readFileSync(new URL("./product.css", import.meta.url), "utf8");
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.match(css, /\.ry-product-catalog/);
    assert.match(css, /aspect-ratio:\s*4\s*\/\s*5/);
    assert.match(css, /\.ry-product-create-drawer/);
    assert.match(css, /\.ry-product-form-compact/);
    assert.match(css, /\.ry-product-form-grid/);
    assert.match(css, /\.ry-product-area-switch/);
    assert.match(css, /\.ry-product-readiness-row/);
    assert.match(css, /\.ry-product-comparison-lede/);
    assert.match(css, /\.ry-product-comparison-workspace/);
    assert.match(css, /\.ry-product-comparison-summary/);
    assert.match(css, /\.ry-product-comparison-sticky/);
    assert.match(css, /\.ry-product-comparison-table/);
    assert.match(css, /\.ry-product-comparison-header-actions/);
    assert.match(css, /\.ry-product-comparison-readiness/);
    assert.match(css, /\.ry-product-comparison-risk-chip/);
    assert.match(css, /\.is-different/);
    assert.match(css, /\.is-same/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });

  void it("catalog cards summarize wholesale signals and readiness", () => {
    const signals = catalogWholesaleSignals({
      id: "p1",
      name: "Candle No. 03",
      version: 1,
      wholesalePrice: 28,
      currency: "USD",
      moq: 12
    });
    assert.match(signals, /\$28\.00 wholesale/);
    assert.match(signals, /MOQ 12/);
    assert.equal(catalogReadiness({ id: "p1", name: "Candle", version: 1, wholesaleReadiness: "not_reviewed" }), "Needs review");
    assert.equal(productViewLabel("discover"), "Discovered");
    assert.equal(productViewLabel("under_review"), "Researching");
    assert.equal(productViewLabel("qualified"), "Ready for wholesale");
    assert.equal(productViewLabel("represented"), "Active");
    assert.equal(productStageLabel("discovered"), "Discovered");
    assert.equal(productStageLabel("under_review"), "Researching");
    assert.equal(productStageLabel("qualified"), "Ready for wholesale");
    assert.equal(productStageLabel("represented"), "Active");
    assert.equal(
      productDataCompleteness(
        { wholesaleReadiness: "ready", packagingReadiness: "ready" },
        true,
        "$12",
        "$24",
        "24",
        "3 weeks"
      ),
      "Complete"
    );
    assert.equal(
      productDataCompleteness({ wholesaleReadiness: "not_reviewed", packagingReadiness: "not_reviewed" }, false, "", "", "", ""),
      "Needs information"
    );
  });

  void it("formats product evidence for intelligence-style display", () => {
    const sales = formatProductEvidenceDisplay({
      exactClaim: "Verified 25 units sold during 2026-06-01 to 2026-06-30.",
      evidenceClass: "verified_fact",
      sourceReference: "Synthetic verified sales statement",
      supports: "June first-party units"
    });
    assert.equal(sales.headline, "25 units sold in June 2026");
    assert.equal(sales.meta, "Verified sales data · First-party source");
    assert.doesNotMatch(JSON.stringify(sales), /Synthetic/i);

    const syntheticSource = formatProductEvidenceDisplay({
      exactClaim: "Verified 25 units sold during 2026-06-01 to 2026-06-30.",
      evidenceClass: "verified_fact",
      sourceReference: "Synthetic verified sales statement"
    });
    assert.doesNotMatch(JSON.stringify(syntheticSource), /Synthetic/i);
    assert.equal(syntheticSource.meta, "Verified sales data · Verified Sales Statement");

    const commercial = formatProductEvidenceDisplay({
      exactClaim: "Wholesale $12; Retail $24; MOQ 24",
      evidenceClass: "direct_evidence",
      sourceReference: "Brand price sheet"
    });
    assert.equal(commercial.headline, "$12 wholesale · $24 retail · MOQ 24");
    assert.match(commercial.meta, /Verified product data/);
    assert.match(commercial.meta, /Brand Price Sheet/);
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
