import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

void describe("Ryva Placement", () => {
  void it("register source preserves pipeline copy, views, and create contracts", () => {
    const source = readFileSync(new URL("./PlacementRegister.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Placement Opportunities"/);
    assert.match(source, /three-party value/i);
    assert.match(source, /Create a Placement Opportunity/);
    assert.match(source, /Active Agreement/);
    assert.match(source, /Concrete Buyer value/);
    assert.match(source, /Brand, Business Buyer, and Representative/);
    assert.match(source, /Kanban/);
    assert.match(source, /Table/);
    assert.match(source, /No Placement Opportunities\. Create one only when authority and Buyer value are supportable\./);
    assert.match(source, /Loading placement work/);
    assert.match(source, /\/api\/placements/);
    assert.match(source, /ry-placement-mobile-groups/);
  });

  void it("detail source preserves authority, triangle, and consequential stage review", () => {
    const source = readFileSync(new URL("./PlacementDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Every advancement rechecks authority, conflict state, three-party value, human decision, and next action\./);
    assert.match(source, /Authority blocks advancement or outreach/);
    assert.match(source, /Relationship Triangle/);
    assert.match(source, /ConsequentialReviewLayout/);
    assert.match(source, /ConfirmationDialog/);
    assert.match(source, /\/api\/placements\/\$\{id\}\/stage/);
    assert.match(source, /\/api\/authority\/evaluate/);
    assert.match(source, /AuthorityIndicator/);
    assert.match(source, /StickyMobileAction/);
    assert.match(source, /Open Outreach/);
    assert.match(source, /Increment 13/);
    assert.match(source, /Increment 14/);
    assert.match(source, /caught instanceof ApiProblem/);
    assert.match(source, /status === 409/);
  });

  void it("placement css uses token breakpoints without overflow-hiding workarounds", () => {
    const css = readFileSync(new URL("./placement.css", import.meta.url), "utf8");
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });

  void it("index exposes the register and detail pages", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    assert.match(source, /PlacementRegisterPage/);
    assert.match(source, /PlacementDetailPage/);
  });
});
