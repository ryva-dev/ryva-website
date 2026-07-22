import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

void describe("Ryva Analytics", () => {
  void it("workspace preserves analytics routes, views, and evidence boundaries", () => {
    const source = readFileSync(new URL("./AnalyticsWorkspace.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Analytics Command Center"/);
    assert.match(source, /No Product Score or hidden probability\./);
    assert.match(source, /Representative Performance/);
    assert.match(source, /Product Performance/);
    assert.match(source, /Brand Performance/);
    assert.match(source, /Buyer Performance/);
    assert.match(source, /Pipeline Analytics/);
    assert.match(source, /Commercial Analytics/);
    assert.match(source, /Portfolio Health/);
    assert.match(source, /Metric Definitions/);
    assert.match(source, /\/api\/analytics\?\$\{query\}/);
    assert.match(source, /\/api\/analytics\/export/);
    assert.match(source, /\/api\/analytics\/reports/);
    assert.match(source, /method: "POST"/);
    assert.match(source, /Grouped by ISO currency; currencies are never combined\./);
    assert.match(source, /Weighted pipeline disabled/);
    assert.match(source, /Expected commission/);
    assert.match(source, /No verified external intelligence is connected/);
    assert.match(source, /StatusLabel value=\{data\.externalIntelligence\.status\}/);
    assert.match(source, /ForecastRange/);
  });

  void it("uses token-only analytics styling without clipping content", () => {
    const css = readFileSync(new URL("./analytics.css", import.meta.url), "utf8");
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.match(css, /var\(--color-border\)/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });

  void it("exports the analytics workspace", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    assert.match(source, /AnalyticsWorkspacePage/);
  });

  void it("keeps domain boundaries honest in source contracts", () => {
    const analytics = readFileSync(new URL("./AnalyticsWorkspace.tsx", import.meta.url), "utf8");
    const transferImport = readFileSync(new URL("../transfer/ImportReview.tsx", import.meta.url), "utf8");
    const transferExport = readFileSync(new URL("../transfer/ExportReview.tsx", import.meta.url), "utf8");
    const admin = readFileSync(new URL("../admin/OperationsWorkspace.tsx", import.meta.url), "utf8");
    assert.match(analytics, /Unavailable — denominator or provider data is absent/);
    assert.match(analytics, /partialData/);
    assert.doesNotMatch(analytics, /industry average|close probability|revenue projection/i);
    assert.match(transferImport, /Validate preview/);
    assert.match(transferImport, /Approve exact preview and commit/);
    assert.doesNotMatch(transferImport, /rolled back automatically|validation commits/i);
    assert.match(transferExport, /Export queued/);
    assert.match(transferExport, /Download export/);
    assert.match(admin, /lastErrorSafe/);
    assert.doesNotMatch(admin, /stackTrace|access_token|client_secret/i);
  });
});
