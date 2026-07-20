# Journey 12: Track Commission

**Trigger:** Verified Order created or agreement/order inputs change.

**Required records:** Agreement/commission rule, Order and revision, Account, Brand, Representative, Protection if relevant, source documents.

## Flow

1. System selects applicable agreement/rule and calculates Estimated amount.
2. Commission detail explains gross, eligible lines, discounts, returns/cancellations, net commissionable amount, rate/rule, expected amount.
3. User reviews source and moves to Pending Verification.
4. Brand statement/payment evidence is uploaded/imported.
5. AI may extract approved/payable/paid fields and variance.
6. User verifies and records Approved, Payable, or Paid with evidence/date.
7. System alerts overdue payment and maintains expected/approved/paid separation.
8. Returns/cancellations create versioned adjustment/clawback event.

**Automation:** calculation, due alert, statement extraction, variance, overdue, clawback candidate.

**Approvals:** Human verification of source and each consequential monetary status.

**Success:** explainable current commission with source, correct status, amounts, due/payment dates, and history.

**Failure:** missing rule/source, conflicting agreement, incorrect Order, nonpayment, unexplained variance.

**Recovery:** correct upstream source through revision, request evidence, open dispute, recalculate with preserved prior version.

**Audit events:** formula/version/inputs, every amount/status, document, human verification, alert, adjustment.

