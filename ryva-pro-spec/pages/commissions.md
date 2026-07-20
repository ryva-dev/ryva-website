# Page: Commissions

## Purpose and user

Provide transparent, explainable tracking from estimated commission through verification, approval, payment, dispute, cancellation, or clawback.

## Data displayed

Representative, Brand, Account, Order, calculation basis/rate, commissionable amount, expected/approved/paid amounts, variance, status, due/payment dates, dispute/clawback, source documents, owner.

Views: All, Needs Verification, Approved/Payable, Overdue, Paid, Disputed, Adjusted.

## Actions

Primary: Verify Commission / Record Payment / Open Dispute according to state.  
Secondary: attach statement, correct source, inspect formula, export reconciliation, add task/note.

## Filters

Status, due/paid period, Brand, Account, Order, amount/variance, overdue, dispute/clawback, documentation.

## States

- **Empty:** explain creation from verified Orders.
- **Loading:** rows before summary totals; actual/estimate grouped.
- **Error:** exclude affected calculation from totals and show repair.

## Permissions and responsive

Representative. Mobile supports status, explanation, document, payment, and dispute review.

## Linked records and AI

Agreement, Order, Account, Protection, Dispute, Documents, Audit. AI extracts statements and flags variance; human verifies.

## Acceptance criteria

- every calculation shows inputs/rule/version;
- status vocabulary exact;
- estimated not counted paid;
- Paid requires evidence/date;
- dispute preserves original and communication;
- returns/cancellations/clawbacks update through versioned events.

