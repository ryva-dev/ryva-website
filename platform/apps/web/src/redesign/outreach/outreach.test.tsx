import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { displayOutreachRecipient, outreachPermissionLabel, outreachVerificationLabel } from "./utils";

void describe("Ryva Outreach", () => {
  void it("workspace source preserves Phase 5 workflows and placement query context", () => {
    const source = readFileSync(new URL("./OutreachWorkspace.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Outreach"/);
    assert.match(source, /Prepare buyer messages, log calls, and review replies/);
    assert.match(source, /Activity/);
    assert.match(source, /Prepare message/);
    assert.match(source, /label="Placement"/);
    assert.match(source, /Log call/);
    assert.match(source, /Create draft/);
    assert.match(source, /Save call/);
    assert.match(source, /Supporting details & attachments/);
    assert.match(source, /placementId/);
    assert.match(source, /useSearchParams/);
    assert.match(source, /\/api\/outreach/);
    assert.match(source, /\/api\/outreach\/calls/);
    assert.match(source, /RegisterMobileList/);
    assert.match(source, /ry-outreach-activity-list/);
    assert.match(source, /displayName/);
    assert.match(source, /placementContacts/);
    assert.match(source, /Select a placement first/);
    assert.match(source, /RegisterPagination/);
    assert.match(source, /ACTIVITY_PAGE_SIZE/);
    assert.match(source, /ry-outreach-surface/);
    assert.match(source, /ry-outreach-surface-primary/);
    assert.match(source, /ry-outreach-surface-context/);
    assert.doesNotMatch(source, /Communication and activity/);
    assert.doesNotMatch(source, /Prepared Placement/);
    assert.doesNotMatch(source, /Create reviewable draft/);
    assert.doesNotMatch(source, /Exact body/);
    assert.doesNotMatch(source, /Evidence ID/);
    assert.doesNotMatch(source, /task-row/);
    assert.doesNotMatch(source, /human/i);
  });

  void it("detail source softens subject review while preserving approval and send workflows", () => {
    const source = readFileSync(new URL("./OutreachDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /ry-outreach-status-rail/);
    assert.doesNotMatch(source, /eyebrow="Outreach Message"/);
    assert.match(source, /Before approving/);
    assert.match(source, /Still needed/);
    assert.match(source, /Review and continue/);
    assert.match(source, /authorityBlocksActions/);
    assert.match(source, /Review agreement →/);
    assert.match(source, /Verify contact →/);
    assert.match(source, /Linked placement and agreement context for this outreach/);
    assert.doesNotMatch(source, /Placement stage does not authorize send/);
    assert.doesNotMatch(source, /Destination/);
    assert.match(source, /ConfirmationDialog/);
    assert.match(source, /Request approval/);
    assert.match(source, /Approve message/);
    assert.match(source, /Queue message/);
    assert.match(source, /Confirm I sent this/);
    assert.match(source, /Record classification/);
    assert.match(source, /Approval does not send/);
    assert.match(source, /Sending is a separate step/);
    assert.match(source, /does not create an order/);
    assert.match(source, /hasUnresolvedPlaceholders/);
    assert.match(source, /caught instanceof ApiProblem/);
    assert.match(source, /status === 409/);
    assert.match(source, /prepare_outreach|approve_outreach|send_outreach/);
    assert.match(source, /StickyMobileAction/);
    assert.match(source, /View technical details/);
    assert.doesNotMatch(source, /ConsequentialReviewLayout/);
    assert.doesNotMatch(source, /ExactArtifact/);
    assert.doesNotMatch(source, /ApprovalPanel/);
    assert.doesNotMatch(source, /Passed|Failed/);
    assert.doesNotMatch(source, /Approved ≠ sent/);
    assert.doesNotMatch(source, /human/i);
  });

  void it("templates and sequences distinguish reusable content from exact artifacts", () => {
    const templates = readFileSync(new URL("./OutreachTemplates.tsx", import.meta.url), "utf8");
    const sequences = readFileSync(new URL("./OutreachSequences.tsx", import.meta.url), "utf8");
    assert.match(templates, /title="Templates"/);
    assert.match(templates, /Create template/);
    assert.match(templates, /Save template/);
    assert.match(templates, /Used for/);
    assert.match(templates, /First outreach/);
    assert.match(templates, /Fill-in names/);
    assert.match(templates, /fillInOptions/);
    assert.match(templates, /Buyer name/);
    assert.match(templates, /Checkbox/);
    assert.doesNotMatch(templates, /buyer_name, brand_name/);
    assert.doesNotMatch(templates, /Placeholders/);
    assert.match(templates, /Edit template/);
    assert.match(templates, /Save changes/);
    assert.match(templates, /\/versions/);
    assert.match(templates, /openTemplate/);
    assert.match(templates, /Remove/);
    assert.match(templates, /method: "DELETE"/);
    assert.match(templates, /Drawer/);
    assert.doesNotMatch(templates, /Version \{/);
    assert.doesNotMatch(templates, /StatusLabel/);
    assert.match(templates, /\/api\/outreach\/templates/);
    assert.match(sequences, /title="Sequences"/);
    assert.match(sequences, /Create sequence/);
    assert.match(sequences, /Save sequence/);
    assert.match(sequences, /Opening email/);
    assert.match(sequences, /Days before follow-up review/);
    assert.match(sequences, /Drawer/);
    assert.match(sequences, /displayName/);
    assert.match(sequences, /\/api\/outreach\/sequences/);
    assert.doesNotMatch(sequences, /Create a two-step sequence/);
    assert.doesNotMatch(sequences, /Follow-up review delay \(minutes\)/);
    assert.doesNotMatch(templates, /human/i);
    assert.doesNotMatch(sequences, /human/i);
  });

  void it("utils keep permission and status vocabularies distinct", () => {
    const source = readFileSync(new URL("./utils.ts", import.meta.url), "utf8");
    assert.match(source, /messageStatuses/);
    assert.match(source, /approval_requested/);
    assert.match(source, /hasUnresolvedPlaceholders/);
    assert.match(source, /displayName/);
    assert.match(source, /displayAddress/);
    assert.match(source, /displayOutreachRecipient/);
    assert.match(source, /outreachPermissionLabel/);
    assert.ok(source.includes("\\{\\{"));
    assert.match(source, /placementReadyStages/);
  });

  void it("softens internal recipient and permission labels for outreach detail", () => {
    const recipient = displayOutreachRecipient("buyer", { name: "Avery Morgan" }, "Bergdorf Goodman");
    assert.match(recipient.label, /Avery Morgan/);
    assert.match(recipient.label, /Bergdorf Goodman/);
    assert.equal(outreachPermissionLabel("unknown", false), "Not confirmed");
    assert.equal(outreachVerificationLabel(false, null), "Not verified");
  });

  void it("maps message statuses to palette-aligned tones", () => {
    const source = readFileSync(new URL("./utils.ts", import.meta.url), "utf8");
    assert.match(source, /messageStatusTone/);
  });

  void it("outreach css uses token breakpoints without overflow-hiding workarounds", () => {
    const css = readFileSync(new URL("./outreach.css", import.meta.url), "utf8");
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
    assert.match(css, /\.ry-outreach-page \.ry-status-label\.status-queued/);
    assert.match(css, /--color-chart-blue/);
    assert.match(css, /ry-outreach-surface-primary/);
    assert.match(css, /ry-outreach-surface-context/);
    assert.match(css, /--color-chart-plum/);
  });

  void it("index exposes workspace, detail, templates, and sequences", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    assert.match(source, /OutreachWorkspacePage/);
    assert.match(source, /OutreachDetailPage/);
    assert.match(source, /OutreachTemplatesPage/);
    assert.match(source, /OutreachSequencesPage/);
  });
});
