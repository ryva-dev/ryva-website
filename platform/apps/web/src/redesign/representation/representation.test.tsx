import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

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
    assert.match(source, /No Representation Opportunities yet\. A Brand must be Contact Ready first\./);
    assert.match(source, /Loading representation authority/);
    assert.match(source, /\/api\/representation\/opportunities/);
  });

  void it("detail source preserves upload, agreement-creation, and stage-transition contracts", () => {
    const source = readFileSync(new URL("./RepresentationDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /Written terms, original documents, decisions, and next actions remain connected and auditable\./);
    assert.match(source, /SHA-256/);
    assert.match(source, /\/api\/documents/);
    assert.match(source, /createAgreementFromOriginal/);
    assert.match(source, /\/stage/);
    assert.match(source, /AuthorityIndicator/);
    assert.match(source, /StickyMobileAction/);
    assert.match(source, /RelationshipTrail/);
  });

  void it("agreement detail migrates to the Consequential Review pattern without hand-typed approval IDs", () => {
    const source = readFileSync(new URL("./AgreementDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /ConsequentialReviewLayout/);
    assert.match(source, /ApprovalPanel/);
    assert.match(source, /ConfirmationDialog/);
    assert.match(source, /AuditHistory/);
    assert.match(source, /AuthorityIndicator/);
    assert.match(source, /Request exact-scope approval/);
    assert.match(source, /Human approve and activate/);
    assert.match(source, /authorityDigest/);
    assert.match(source, /Material terms are evidence-linked, editable, and non-authoritative until exact-artifact human approval\./);
    assert.match(source, /AI may later suggest candidates, but it cannot approve or interpret them\./);
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
});
