import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

void describe("Ryva data transfer redesign", () => {
  void it("preserves the exact import review contract", () => {
    const source = readFileSync(new URL("./ImportReview.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Import and review"/);
    assert.match(source, /Validate preview/);
    assert.match(source, /title="Validation result"/);
    assert.match(source, /awaiting explicit approval/);
    assert.match(source, /label="Approval rationale"/);
    assert.match(source, /Approve exact preview and commit/);
    assert.match(source, /Import committed\./);
    assert.match(source, /crypto\.subtle\.digest\("SHA-256"/);
    assert.match(source, /ConsequentialReviewLayout/);
    assert.match(source, /ConfirmationDialog/);
  });

  void it("preserves the secure export contract", () => {
    const source = readFileSync(new URL("./ExportReview.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Secure exports"/);
    assert.match(source, /replaceAll\("_", " "\)/);
    assert.match(source, /Generate audited export/);
    assert.match(source, /"Export queued"/);
    assert.match(source, /durable worker will generate/i);
    assert.match(source, /ConfirmationDialog/);
    assert.match(source, /setInterval/);
  });

  void it("exports both transfer pages and uses responsive tokens", () => {
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const css = readFileSync(new URL("./transfer.css", import.meta.url), "utf8");
    assert.match(index, /ImportReviewPage/);
    assert.match(index, /ExportReviewPage/);
    assert.match(css, /ry-transfer-/);
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });
});
