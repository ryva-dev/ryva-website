import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { displayBusiness, displayBrand, displayName, defaultNextStage, placementStageTone } from "./utils";

void describe("Ryva Placement", () => {
  void it("strips fixture suffixes from brand and business display names", () => {
    assert.equal(
      displayName("Increment12 Business detail-chromium-desktop-1784734627049"),
      "Increment12 Business"
    );
    assert.equal(
      displayName("Increment14 Brand acct-m-1784734662784"),
      "Increment14 Brand"
    );
    assert.equal(
      displayBrand({ brandName: "Increment12 Brand detail-chromium-mobile-1784734676346" }),
      "Increment12 Brand"
    );
    assert.equal(
      displayBusiness({ businessName: "Increment12 Business detail-chromium-desktop-1784734627049" }),
      "Increment12 Business"
    );
  });

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
    assert.match(source, /RegisterPagination/);
    assert.match(source, /PAGE_SIZE/);
    assert.match(source, /ry-placement-mobile-groups/);
    assert.match(source, /kanbanLanes/);
    assert.match(source, /ry-placement-kanban-drag/);
    assert.match(source, /ry-placement-kanban-card-menu/);
    assert.match(source, /ry-placement-kanban-open/);
    assert.match(source, /ry-placement-kanban-card-actions/);
    assert.match(source, /<div className="ry-placement-kanban-card-main">/);
    assert.match(source, /ryva\.placement\.register\.view/);
    assert.match(source, /selectView/);
    assert.doesNotMatch(source, /Keyboard move/);
    assert.doesNotMatch(source, /No conflict/);
  });

  void it("detail source preserves authority, triangle, and advance placement review", () => {
    const source = readFileSync(new URL("./PlacementDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Placement overview/);
    assert.match(source, /Placement rationale/);
    assert.match(source, /Value alignment/);
    assert.match(source, /Complete review/);
    assert.match(source, /value-alignment/);
    assert.match(source, /Complete the value alignment review before advancing this placement\./);
    assert.match(source, /ry-placement-timeline/);
    assert.match(source, /overviewTimelineStages/);
    assert.match(source, /Agreement coverage/);
    assert.match(source, /This placement is covered by the active agreement\./);
    assert.match(source, /Authorized territory/);
    assert.match(source, /Authorized channel/);
    assert.match(source, /Products covered/);
    assert.match(source, /Advance placement/);
    assert.match(source, /defaultNextStage/);
    assert.doesNotMatch(source, /: "qualified"\)/);
    assert.match(source, /Before advancing/);
    assert.match(source, /Review and advance/);
    assert.match(source, /Commercial activity/);
    assert.match(source, /Orders, account activity, and reorders connected to this placement will appear here\./);
    assert.match(source, /commercialLinks/);
    assert.doesNotMatch(source, /Increment 14/);
    assert.doesNotMatch(source, /Commercial stages/);
    assert.doesNotMatch(source, /Commercial context/);
    assert.doesNotMatch(source, /Placement stage does not invent revenue/);
    assert.match(source, /Agreement coverage/);
    assert.match(source, /Conflict review/);
    assert.match(source, /Value alignment/);
    assert.match(source, /"Complete"/);
    assert.match(source, /"Incomplete"/);
    assert.match(source, /"Required"/);
    assert.match(source, /"Needs attention"/);
    assert.match(source, /"Missing"/);
    assert.doesNotMatch(source, /\bPassed\b/);
    assert.doesNotMatch(source, /\bFailed\b/);
    assert.doesNotMatch(source, /Requires Review/);
    assert.doesNotMatch(source, /Agreement coverage confirmed/);
    assert.doesNotMatch(source, /No conflict found/);
    assert.doesNotMatch(source, /Value alignment incomplete/);
    assert.doesNotMatch(source, /Next action required/);
    assert.match(source, /Advance to \$\{readable\(toStage\)\}/);
    assert.match(source, /label="Decision"/);
    assert.match(source, /label="Notes"/);
    assert.match(source, /ry-placement-advance-advanced/);
    assert.doesNotMatch(source, /ConsequentialReviewLayout/);
    assert.doesNotMatch(source, /Exact Placement stage change/);
    assert.doesNotMatch(source, /server-side transition validator/);
    assert.doesNotMatch(source, /Fresh decision/);
    assert.doesNotMatch(source, /Evidence IDs/);
    assert.doesNotMatch(source, /Blockers and required review/);
    assert.doesNotMatch(source, /Prepare confirmation/);
    assert.doesNotMatch(source, /Confirm Placement stage change/);
    assert.doesNotMatch(source, /Record stage transition/);
    assert.doesNotMatch(source, /Representation and Agreement authority/);
    assert.doesNotMatch(source, /Placement stage never overrides or creates authority/);
    assert.doesNotMatch(source, /Only an active, in-scope Agreement with clean original and approval establishes current representation authority for Placement advancement/);
    assert.match(source, /ConfirmationDialog/);
    assert.match(source, /\/api\/placements\/\$\{id\}\/stage/);
    assert.match(source, /\/api\/authority\/evaluate/);
    assert.match(source, /Authority blocks advancement or outreach\./);
    assert.match(source, /authorityBlockedAlertContent/);
    assert.match(source, /Review agreement →/);
    assert.doesNotMatch(source, /reasonCodes\.join/);
    assert.match(source, /StickyMobileAction/);
    assert.match(source, /Advance stage/);
    assert.match(source, /Start outreach/);
    assert.match(source, /Resolve agreement coverage/);
    assert.match(source, /authorityBlocksActions/);
    assert.match(source, /DisabledActionHint/);
    assert.match(source, /Placement timeline/);
    assert.match(source, /No activity yet/);
    assert.match(source, /Stage changes, outreach, notes, and decisions will appear here\./);
    assert.doesNotMatch(source, /Stage history/);
    assert.doesNotMatch(source, /No stage change has been recorded/);
    assert.doesNotMatch(source, /Newest-first audited stage events/);
    assert.match(source, /Complete the missing placement details before advancing this opportunity\./);
    assert.match(source, /title=\{brandName\}/);
    assert.match(source, /\{businessName\}/);
    assert.match(source, /Agreement active/);
    assert.match(source, /Placement status/);
    assert.match(source, /ry-placement-status-rail/);
    assert.match(source, /authorityStatusLabel/);
    assert.match(source, /title="Outreach"/);
    assert.match(source, /Prepare and manage buyer communication for this placement\./);
    assert.doesNotMatch(source, /Increment 13/);
    assert.doesNotMatch(source, /Outreach context/);
    assert.doesNotMatch(source, /Exact-artifact approval/);
    assert.match(source, /caught instanceof ApiProblem/);
    assert.match(source, /status === 409/);
    assert.doesNotMatch(source, /Opportunity basis/);
    assert.doesNotMatch(source, /Fit language is qualitative/);
    assert.doesNotMatch(source, /Relationship Triangle/);
    assert.doesNotMatch(source, /Placement identity/);
    assert.doesNotMatch(source, /Documented progression/);
    assert.doesNotMatch(source, /Review stage change/);
    assert.doesNotMatch(source, /Open Outreach/);
    assert.doesNotMatch(source, /Recheck authority, triangle, decision, and next action before any stage change\./);
    assert.doesNotMatch(source, /Placement stage does not create Representation authority\. Only the evaluated Agreement scope does\./);
  });

  void it("maps placement stages to palette-aligned tones", () => {
    assert.equal(placementStageTone("contacted"), "info");
    assert.equal(placementStageTone("buyer_review"), "success");
    assert.equal(placementStageTone("active_account"), "success");
    assert.equal(placementStageTone("closed_lost"), "danger");
  });

  void it("derives the next selectable stage from the current placement stage", () => {
    assert.equal(defaultNextStage("identified"), "qualified");
    assert.equal(defaultNextStage("qualified"), "prepared");
    assert.equal(defaultNextStage("prepared"), "contacted");
    assert.equal(defaultNextStage("contacted"), "engaged");
    assert.equal(defaultNextStage("engaged"), "information_sample_sent");
    assert.equal(defaultNextStage("information_sample_sent"), "buyer_review");
    assert.equal(defaultNextStage("buyer_review"), "terms_order_discussion");
    assert.equal(defaultNextStage("terms_order_discussion"), "terms_order_discussion");
    assert.equal(defaultNextStage("closed_lost"), "closed_lost");
    assert.equal(defaultNextStage("active_account"), "terms_order_discussion");
  });

  void it("placement css uses token breakpoints without overflow-hiding workarounds", () => {
    const css = readFileSync(new URL("./placement.css", import.meta.url), "utf8");
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
    assert.match(css, /\.ry-placement-page \.ry-status-label\.status-contacted/);
    assert.match(css, /--color-chart-blue/);
    assert.match(css, /--color-chart-olive/);
    assert.match(css, /--color-chart-plum/);
  });

  void it("index exposes the register and detail pages", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    assert.match(source, /PlacementRegisterPage/);
    assert.match(source, /PlacementDetailPage/);
  });
});
