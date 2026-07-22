import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

void describe("Ryva Platform Operations", () => {
  void it("preserves restricted operational controls and APIs", () => {
    const source = readFileSync(new URL("./OperationsWorkspace.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Platform operations"/);
    assert.match(source, /Least-privilege operational visibility/);
    assert.match(source, /not a general user-content browser/i);
    assert.match(source, /Provider and safety status/);
    assert.match(source, /AI generation kill switch/);
    assert.match(source, /Job health/);
    assert.match(source, /Recent audit events/);
    assert.match(source, /Refresh status/);
    assert.match(source, /Refresh jobs/);
    assert.match(source, /Refresh audit/);
    assert.match(source, /Disable AI generation/);
    assert.match(source, /Enable AI generation/);
    assert.match(source, /Required operational reason/);
    assert.match(source, /ConfirmationDialog/);
    assert.match(source, /\/api\/admin\/jobs/);
    assert.match(source, /\/api\/admin\/jobs\/\$\{confirmation\.job\.id\}\/retry/);
    assert.match(source, /\/api\/admin\/audit/);
    assert.match(source, /\/api\/ai\/status/);
    assert.match(source, /\/api\/admin\/ai-control/);
    assert.match(source, /\/api\/admin\/operational-status/);
  });

  void it("keeps only the safe job error field visible", () => {
    const source = readFileSync(new URL("./OperationsWorkspace.tsx", import.meta.url), "utf8");
    assert.match(source, /lastErrorSafe/);
    assert.doesNotMatch(source, /lastErrorCode/);
  });

  void it("keeps admin CSS token-based and responsive", () => {
    const css = readFileSync(new URL("./admin.css", import.meta.url), "utf8");
    assert.match(css, /ry-admin-/);
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
    assert.doesNotMatch(css, /\b(?:rgb|hsl)a?\(/i);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });
});
