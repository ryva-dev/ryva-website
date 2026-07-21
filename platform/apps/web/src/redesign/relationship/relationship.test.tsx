import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  RelationshipTabPanel,
  RelationshipTabs,
  RelationshipTrail
} from "./RelationshipDetail";

void describe("Ryva Standard Relationship Detail", () => {
  void it("renders a true relationship trail with current-page semantics", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <RelationshipTrail items={[{ label: "Contacts", to: "/records/contact" }, { label: "Synthetic Buyer" }]} />
      </MemoryRouter>
    );
    assert.match(markup, /aria-label="Relationship trail"/);
    assert.match(markup, /href="\/records\/contact"/);
    assert.match(markup, /aria-current="page"/);
  });

  void it("associates selected tabs and panels without rendering inactive content", () => {
    const tabs = [{ id: "overview", label: "Overview" }, { id: "activity", label: "Activity", count: 2 }];
    const markup = renderToStaticMarkup(
      <>
        <RelationshipTabs tabs={tabs} active="activity" onChange={() => undefined} label="Contact views" baseId="contact" />
        <RelationshipTabPanel id="contact" tabId="activity" active>Two events</RelationshipTabPanel>
        <RelationshipTabPanel id="contact" tabId="overview" active={false}>Hidden overview</RelationshipTabPanel>
      </>
    );
    assert.match(markup, /role="tablist"/);
    assert.match(markup, /aria-selected="true"/);
    assert.match(markup, /aria-controls="contact-panel-activity"/);
    assert.match(markup, /role="tabpanel"/);
    assert.doesNotMatch(markup, /Hidden overview/);
  });

  void it("keeps the relationship stylesheet token-only", () => {
    const css = readFileSync(new URL("./relationship.css", import.meta.url), "utf8");
    assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
    assert.doesNotMatch(css, /\b(?:rgb|rgba|hsl|hsla)\s*\(/i);
    assert.doesNotMatch(css, /\b(?:linear|radial|conic)-gradient\s*\(/i);
    assert.doesNotMatch(css, /backdrop-filter/i);
  });
});
