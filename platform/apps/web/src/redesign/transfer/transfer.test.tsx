import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

void describe("Ryva data transfer redesign", () => {
  void it("preserves the exact import review contract", () => {
    const source = readFileSync(new URL("./ImportReview.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Import data"/);
    assert.match(source, /Preview import/);
    assert.match(source, /Map → Preview → Import/);
    assert.match(source, /\+ Add field mapping/);
    assert.match(source, /Paste CSV data/);
    assert.match(source, /No source linked/);
    assert.match(source, /title="Preview result"/);
    assert.doesNotMatch(source, /Validate preview/);
    assert.doesNotMatch(source, /Import and review/);
    assert.doesNotMatch(source, /The preview is bound to the CSV/);
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
    assert.match(source, /Create an audited export of selected Ryva data\./);
    assert.match(source, /SCOPE_LABELS/);
    assert.match(source, /Businesses & Buyers/);
    assert.match(source, /Select all/);
    assert.match(source, /Include document files/);
    assert.match(source, /Generate export/);
    assert.match(source, /No exports yet/);
    assert.match(source, /"Export queued"/);
    assert.match(source, /durable worker will generate/i);
    assert.match(source, /ConfirmationDialog/);
    assert.match(source, /setInterval/);
    assert.doesNotMatch(source, /Generate audited export/);
    assert.doesNotMatch(source, /Request document inclusion review/);
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
