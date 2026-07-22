import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

void describe("Ryva Outreach", () => {
  void it("workspace source preserves Phase 5 workflows and placement query context", () => {
    const source = readFileSync(new URL("./OutreachWorkspace.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Human-approved communication"/);
    assert.match(source, /never sends or calls autonomously/i);
    assert.match(source, /Communication and activity/);
    assert.match(source, /Prepare outreach/);
    assert.match(source, /Prepared Placement/);
    assert.match(source, /Log a call/);
    assert.match(source, /Create reviewable draft/);
    assert.match(source, /Log human-placed call/);
    assert.match(source, /placementId/);
    assert.match(source, /useSearchParams/);
    assert.match(source, /\/api\/outreach/);
    assert.match(source, /\/api\/outreach\/calls/);
    assert.match(source, /RegisterMobileList/);
    assert.match(source, /record-list/);
    assert.match(source, /task-row/);
    assert.match(source, /Placement readiness does not authorize Outreach/);
  });

  void it("detail source preserves exact-artifact consequential review boundaries", () => {
    const source = readFileSync(new URL("./OutreachDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Exact outreach artifact/);
    assert.match(source, /ConsequentialReviewLayout/);
    assert.match(source, /ExactArtifact/);
    assert.match(source, /ConfirmationDialog/);
    assert.match(source, /ApprovalPanel/);
    assert.match(source, /Request exact approval/);
    assert.match(source, /Approve exact artifact/);
    assert.match(source, /Queue approved message/);
    assert.match(source, /Confirm I sent this exact message/);
    assert.match(source, /Record human classification/);
    assert.match(source, /Approval does not send/);
    assert.match(source, /Queued does not mean delivered/);
    assert.match(source, /does not create an Order/);
    assert.match(source, /Verified does not mean allowed/);
    assert.match(source, /Address presence does not imply permission/);
    assert.match(source, /Placement readiness does not authorize Outreach/);
    assert.match(source, /hasUnresolvedPlaceholders/);
    assert.match(source, /caught instanceof ApiProblem/);
    assert.match(source, /status === 409/);
    assert.match(source, /prepare_outreach|approve_outreach|send_outreach/);
    assert.match(source, /StickyMobileAction/);
  });

  void it("templates and sequences distinguish reusable content from exact artifacts", () => {
    const templates = readFileSync(new URL("./OutreachTemplates.tsx", import.meta.url), "utf8");
    const sequences = readFileSync(new URL("./OutreachSequences.tsx", import.meta.url), "utf8");
    assert.match(templates, /title="Versioned templates"/);
    assert.match(templates, /Create immutable v1/);
    assert.match(templates, /Template is not the exact message/);
    assert.match(templates, /\/api\/outreach\/templates/);
    assert.match(sequences, /title="Human-controlled sequences"/);
    assert.match(sequences, /never auto-send/i);
    assert.match(sequences, /Create a two-step sequence/);
    assert.match(sequences, /First-step email template/);
    assert.match(sequences, /Follow-up review delay \(minutes\)/);
    assert.match(sequences, /Sequence is not a sent message/);
    assert.match(sequences, /\/api\/outreach\/sequences/);
  });

  void it("utils keep permission and status vocabularies distinct", () => {
    const source = readFileSync(new URL("./utils.ts", import.meta.url), "utf8");
    assert.match(source, /messageStatuses/);
    assert.match(source, /approval_requested/);
    assert.match(source, /hasUnresolvedPlaceholders/);
    assert.ok(source.includes("\\{\\{"));
    assert.match(source, /placementReadyStages/);
  });

  void it("outreach css uses token breakpoints without overflow-hiding workarounds", () => {
    const css = readFileSync(new URL("./outreach.css", import.meta.url), "utf8");
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });

  void it("index exposes workspace, detail, templates, and sequences", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    assert.match(source, /OutreachWorkspacePage/);
    assert.match(source, /OutreachDetailPage/);
    assert.match(source, /OutreachTemplatesPage/);
    assert.match(source, /OutreachSequencesPage/);
  });
});
