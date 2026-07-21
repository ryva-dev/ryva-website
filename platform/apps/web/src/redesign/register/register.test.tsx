import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusLabel } from "../../design-system";
import { RegisterMobileRow, RegisterPagination, SortableHeader } from "./Register";
import { sortRecords } from "./utils";

void describe("Ryva Standard Register", () => {
  void it("announces sort state and keeps sorting keyboard operable", () => {
    const markup = renderToStaticMarkup(
      <table><thead><tr><SortableHeader field="name" label="Name" sort={{ field: "name", direction: "asc" }} onSort={() => undefined} /></tr></thead></table>
    );
    assert.match(markup, /aria-sort="ascending"/);
    assert.match(markup, /<button type="button"/);
    assert.match(markup, />Name/);
  });

  void it("retains identity, priority metadata, status, and named action in mobile rows", () => {
    const markup = renderToStaticMarkup(
      <RegisterMobileRow
        title="Review synthetic evidence"
        meta="Due today · Brand origin"
        status={<StatusLabel value="blocked" />}
        onOpen={() => undefined}
        openLabel="Review Task Review synthetic evidence"
      />
    );
    assert.match(markup, /role="listitem"/);
    assert.match(markup, /Review Task Review synthetic evidence/);
    assert.match(markup, /Due today/);
    assert.match(markup, /blocked/);
  });

  void it("exposes current page, total, and bounded previous/next controls", () => {
    const markup = renderToStaticMarkup(<RegisterPagination page={1} pageCount={3} total={42} onPage={() => undefined} />);
    assert.match(markup, /aria-label="Register pages"/);
    assert.match(markup, /42/);
    assert.match(markup, /Page 1 of 3/);
    assert.match(markup, />Previous</);
    assert.match(markup, /disabled=""/);
  });

  void it("sorts known values while placing unknowns after comparable records", () => {
    const rows = [{ name: "Beta" }, { name: null }, { name: "Alpha" }];
    const sorted = sortRecords(rows, { field: "name", direction: "asc" }, (row) => row.name);
    assert.deepEqual(sorted, [{ name: "Alpha" }, { name: "Beta" }, { name: null }]);
  });

  void it("keeps the register stylesheet token-only", () => {
    const css = readFileSync(new URL("./register.css", import.meta.url), "utf8");
    assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
    assert.doesNotMatch(css, /\b(?:rgb|rgba|hsl|hsla)\s*\(/i);
    assert.doesNotMatch(css, /\b(?:linear|radial|conic)-gradient\s*\(/i);
    assert.doesNotMatch(css, /backdrop-filter/i);
  });
});
