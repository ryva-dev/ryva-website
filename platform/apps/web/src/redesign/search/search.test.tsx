import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

void describe("Ryva connected-context search", () => {
  void it("preserves the authorized search contract", () => {
    const source = readFileSync(new URL("./SearchWorkspace.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Find connected context"/);
    assert.match(source, /aria-label="Search workspace"/);
    assert.match(source, /aria-label="Filter by record type"/);
    assert.match(source, />Search</);
    assert.match(source, /No authorized records match this search\./);
    assert.match(source, /\/api\/search/);
  });

  void it("preserves result paths for every established record type", () => {
    const source = readFileSync(new URL("./SearchWorkspace.tsx", import.meta.url), "utf8");
    assert.match(source, /\/records\/\$\{result\.type\}\/\$\{result\.id\}/);
    assert.match(source, /\/accounts\/\$\{result\.id\}/);
    assert.match(source, /\/orders\/\$\{result\.id\}/);
    assert.match(source, /\/commissions\/\$\{result\.id\}/);
    assert.match(source, /\/placements\/\$\{result\.id\}/);
  });

  void it("keeps search CSS token-based and responsive", () => {
    const css = readFileSync(new URL("./search.css", import.meta.url), "utf8");
    assert.match(css, /ry-search-/);
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
    assert.doesNotMatch(css, /\b(?:rgb|hsl)a?\(/i);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });
});
