import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { authorityBlockedActionReason, authorityBlockedAlertContent, authorityReasonMessages, authorityRecoveryLabel } from "./utils";

void describe("Ryva Representation", () => {
  void it("register source preserves phase4 copy contracts and the create workflow", () => {
    const source = readFileSync(new URL("./RepresentationRegister.tsx", import.meta.url), "utf8");
    assert.match(source, /title="Representation"/);
    assert.match(source, /uploaded agreement as permission/i);
    assert.match(source, /Representation Opportunities/);
    assert.match(source, /Representation Agreements/);
    assert.match(source, /Open a Representation Opportunity/);
    assert.match(source, /Contact Ready Brand/);
    assert.match(source, /Open opportunity/);
    assert.match(source, /createOpen/);
    assert.match(source, /<Drawer/);
    assert.match(source, /ry-representation-create-drawer/);
    assert.match(source, /No Representation Opportunities yet\. A Brand must be Contact Ready first\./);
    assert.match(source, /Loading representation authority/);
    assert.match(source, /\/api\/representation\/opportunities/);
  });

  void it("detail source preserves upload, agreement-creation, and stage-transition contracts", () => {
    const source = readFileSync(new URL("./RepresentationDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Review the proposed scope, agreement status, decisions, and next action\./);
    assert.match(source, /SHA-256/);
    assert.match(source, /\/api\/documents/);
    assert.match(source, /createAgreementFromOriginal/);
    assert.match(source, /\/stage/);
    assert.match(source, /AuthorityIndicator/);
    assert.match(source, /StickyMobileAction/);
    assert.match(source, /RelationshipTrail/);
  });

  void it("agreement detail uses a document-review workspace without hand-typed approval IDs", () => {
    const source = readFileSync(new URL("./AgreementDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /AgreementDocumentViewer|ry-agreement-viewer/);
    assert.match(source, /Preview unavailable\. Download the agreement to review it\./);
    assert.match(source, /Loading agreement preview/);
    assert.match(source, /Request approval/);
    assert.match(source, /Confirm and activate/);
    assert.match(source, /ConfirmationDialog/);
    assert.match(source, /What changed/);
    assert.match(source, /AuthorityIndicator/);
    assert.match(source, /authorityDigest/);
    assert.match(source, /Authority not active/);
    assert.match(source, /Add the representation agreement/);
    assert.match(source, /View technical details/);
    assert.doesNotMatch(source, /placeholder="Approval ID from this review"/);
    assert.doesNotMatch(source, /aria-label="Approval ID"/);
    assert.match(source, /\/api\/agreements\/\$\{id\}\/approval/);
    assert.match(source, /\/api\/agreements\/\$\{id\}\/activate/);
    assert.match(source, /caught instanceof ApiProblem/);
    assert.match(source, /status === 409/);
  });

  void it("representation css uses token breakpoints without overflow-hiding workarounds", () => {
    const css = readFileSync(new URL("./representation.css", import.meta.url), "utf8");
    assert.match(css, /64rem/);
    assert.match(css, /48rem/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  });

  void it("index exposes the register, detail, and agreement pages", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    assert.match(source, /RepresentationRegisterPage/);
    assert.match(source, /RepresentationDetailPage/);
    assert.match(source, /AgreementDetailPage/);
  });

  void it("maps authority reason codes to human guidance", () => {
    const productScope = authorityReasonMessages(["product_out_of_scope"]);
    assert.equal(productScope.length, 1);
    assert.match(productScope[0]!.summary, /isn't covered by the current representation agreement/);
    assert.match(productScope[0]!.guidance, /select an eligible product/);

    const blocked = authorityBlockedAlertContent(["product_out_of_scope"]);
    assert.equal(blocked.messages.length, 1);
    assert.equal(blocked.showAgreementLink, true);
    assert.match(authorityBlockedActionReason(["product_out_of_scope"]), /isn't covered by the current representation agreement/);
    assert.equal(authorityRecoveryLabel(["product_out_of_scope"]), "Resolve agreement coverage");

    const unknown = authorityReasonMessages(["custom_internal_code"]);
    assert.match(unknown[0]!.summary, /Custom Internal Code/);
  });
});
