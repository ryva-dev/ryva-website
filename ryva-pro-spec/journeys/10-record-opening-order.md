# Journey 10: Record an Opening Order

**Trigger:** Authorized Order or equivalent verified commercial commitment is received.

**Required records:** Opportunity, active Agreement, Brand/Business, Products/quantities, order reference/date, commercial values, terms, source document, Buyer/authorized party.

## Flow

1. User uploads/imports/enters Order and source.
2. AI/parser may extract candidate fields.
3. User verifies identity, Products, quantity, values, discounts, returns/cancellation terms, payment/fulfillment state.
4. System calculates net commissionable amount from confirmed inputs.
5. User confirms Opening Order.
6. Transaction creates Order, Account, estimated Commission, initial reorder review, and draft Protected Account if Agreement supports it.
7. Opportunity moves Opening Order then Account onboarding; stage does not depend on payment.
8. User assigns support and handoff tasks.

**Automation:** idempotency/duplicate order; account conversion; commission calculation; protection draft; account/reorder tasks.

**Approvals:** Human Order verification; separate protection approval. Commission remains Estimated/Pending Verification.

**Success:** connected verified Order, Account, explainable estimated Commission, support owner, and complete history.

**Failure:** duplicate, missing source, inconsistent totals, inactive authority, returned/canceled before confirmation, transaction failure.

**Recovery:** save draft, correct source, reconcile external reference, retry transaction idempotently, roll back incomplete conversion.

**Audit events:** document/extraction/edit, verification, Order revision, calculation, created records, stage, tasks.

