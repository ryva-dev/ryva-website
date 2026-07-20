# Journey 8: Send Product Information or Samples

**Trigger:** Engaged Buyer requests or accepts information, catalog, line sheet, sample, or evaluation material.

**Required records:** Opportunity, Buyer/Contact, requested materials/Products, approved documents/claims, sample availability and terms, shipping details if applicable, follow-up.

## Flow

1. User records Buyer request and scope.
2. System validates current approved materials, Product/readiness, authority, Contact, and any sample cost/handling term.
3. AI may assemble a Buyer-specific cover note and checklist.
4. User verifies claims, files, recipient, address, and sample terms.
5. User approves send/log; system records documents or sample shipment/tracking.
6. Opportunity moves to Information or Sample Sent.
7. System creates receipt/evaluation follow-up.
8. User confirms receipt and advances to Buyer Review or records issue/loss.

**Automation:** document version check, sample follow-up, tracking update where integrated.

**Approvals:** exact external message/material set and sample commitment.

**Success:** Buyer receives correct current materials/sample, with documented next decision.

**Failure:** stale material, unavailable sample, wrong address/Product, shipment loss, claim conflict, no receipt.

**Recovery:** stop before send, replace version, correct shipment, disclose issue, reschedule, or return to qualification.

**Audit events:** request, materials/versions, approval, send/shipment, tracking, receipt, stage, follow-up.

