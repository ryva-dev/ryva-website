# Phase 6 Commercial Continuity

Phase 6 connects verified opening Orders to operational Accounts, documentary
Protected Account review, Reorders, explainable Commissions, payment history,
and Commission Disputes.

## Financial calculation

Money is stored as fixed-precision PostgreSQL `NUMERIC` with an ISO currency.
The expected Commission calculation uses the Agreement's reviewed rate and
gross/net basis, the exact Order revision, eligible lines, discounts, returns,
and cancellations. The result is rounded half away from zero to the currency
minor unit. Each calculation is an immutable version with its formula, inputs,
source identifiers, reason, actor, and digest.

Currencies are grouped and exported separately. Ryva does not silently convert
or aggregate different currencies.

## Human-controlled states

- Order upload or entry is not verification.
- Opening Order verification atomically creates or links the Account, creates
  only a review-required protection basis when written terms exist, creates an
  Estimated Commission, and creates the first Reorder review.
- Protected Account activation and renewal require a clean source, exact scope,
  overlap check, and human approval.
- Pending Verification, Approved, Payable, Paid, Canceled, Clawed Back, and
  dispute resolution require explicit human actions and their state-specific
  evidence.
- Corrections append Order and calculation versions. Approved and paid values
  are retained until a human reconciliation changes their state.

## Durable jobs

Run `npm run start:worker` with the API. Phase 6 job handlers provide:

- protection alerts at 60, 30, 14, 7, and 1 day and fail-closed expiry;
- one idempotent Reorder review Task/Notification when a reviewed window opens;
- one overdue Commission Task/Notification after a documented due date.

Jobs create attention and history. They cannot approve rights, verify Orders,
mark payments, resolve disputes, or contact a Buyer.

## Contractual and accounting boundaries

Ryva records the Agreement and supporting documents; it does not create,
interpret, or adjudicate contractual rights. Ambiguous commission or protection
terms block calculation/activation and require human or specialist review.
Ryva Pro is not payroll, invoicing, tax, or general-ledger software. Live
accounting/payment integrations, if later approved, must remain evidence
providers behind the same human confirmation and audit controls.
