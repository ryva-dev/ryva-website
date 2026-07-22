# UI Redesign Increment 15 — Commissions and Disputes

**Status:** Structurally complete

**Date:** 2026-07-22

**Scope boundary:** Commission register/detail, consequential status
transitions, dispute register/detail, and dispute resolution only. No separate
statement, payout, or adjustment routes exist in the repository; those concepts
appear as stored Commission statuses and calculation/event history. Analytics,
Reports, Data Transfer, Settings, and Operations (Increment 16) were not
started. Final whole-product visual refinement remains deferred.

## Delivered pattern

Increment 15 migrates compensation surfaces into approved structural patterns:

- **Standard Register** for `/commissions` and `/commission-disputes`;
- **Standard Relationship Detail** for `/commissions/:id`;
- **Consequential Review** for Commission status transitions, dispute opening,
  and dispute resolution;
- **Commercial subnav** shared with Increment 14 commercial routes.

Module lives in `apps/web/src/redesign/commerce/` alongside Accounts/Orders.
Legacy Commission and Dispute exports in `apps/web/src/pages/CommercePages.tsx`
remain unwired.

## Routes migrated

| Route | Pattern | Notes |
|---|---|---|
| `/commissions` | Standard Register | Currency-separated sums of listed stored amounts; mobile semantic rows |
| `/commissions/:id` | Relationship Detail + Consequential Review | Calculation transparency; status transitions; open dispute |
| `/commission-disputes` | Standard Register | Allegation-labeled claims; export preserved |
| `/commission-disputes/:id` | Relationship Detail + Consequential Review | Evidence versus verification; final human resolution |

No `/statements`, `/payouts`, or `/adjustments` routes exist. Payable/paid and
clawback remain Commission status transitions with stored dates and amounts.

## Commission Register and Detail

Register preserves filter/sort/saved views/columns/density/export,
loading/empty/no-result/error/restricted states, and CurrencyValue display.
Listed currency totals sum stored expected/approved/paid amounts only and are
labeled as estimates versus human-confirmed actuals.

Detail distinguishes expected, approved, paid, dispute, clawback, payment due,
and payment date. Calculation tab shows the server formula and inputs without
client recomputation. Human review uses ExactArtifact, ValidationSummary,
ConfirmationDialog, version concurrency, and duplicate-submission prevention.

## Calculation transparency

Where the server returns calculation rows, the UI shows gross, eligible,
discounts/returns/cancellations, commissionable amount, basis, rate, result,
rounding, Agreement, and Order revision. Incomplete calculation is shown as a
blocker. No tax, legal, or accounting advice is implied.

## Statements, payouts, adjustments, and reversals

- **Payable** stores a due date and is not presented as receipt.
- **Paid** requires stored payment amount and date and remains distinct from
  approved/payable.
- **Clawback** remains a governed status with stored amount.
- Adjustment/payment history appears through commercial events.
- No payment integrations or live providers were added.

## Dispute Register, Detail, and resolution

Dispute register preserves documentary-rights honesty and empty-state guidance
to open cases from Commission context. Detail distinguishes allegation,
submitted evidence, document/scan status, linked Commission money states, and
final resolution. Resolution requires amount, rationale, evidence document ID,
and issued human Decision ID. Withdrawal never implies Brand correctness.

## Order, Account, Agreement, and protection boundaries

Order value is not commission owed. Protection does not guarantee commission.
Agreement and Account links remain inspectable without inventing eligibility.
Prior commercial, Placement, Outreach, and Representation routes are unchanged
aside from shared subnav and commission context copy.

## Analytics and operations boundary

Increment 16 owns Analytics, Reports, Data Transfer, Settings, and Operations.
Increment 15 does not redesign those surfaces or add forecasts.

## Responsive and accessibility

Token breakpoints at `64rem` / `48rem`, no `overflow-x: hidden` workarounds,
Context Rail / drawer, sticky mobile actions, keyboard tabs/filters, Escape and
focus restoration via shared overlays, tabular currency amounts with accessible
names, and status meaning independent of color alone.

## Validation results

- `npm run lint:tokens`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:unit`: 83 passed, including 12 Commerce/Commission contracts.
- `npm run test:integration`: 62 passed against PostgreSQL.
- Focused commission Playwright: 12 passed, 2 intentional skips.
- Focused commission/commerce/Placement/Outreach/Representation/Buyer regression: 93 passed, 13 intentional skips.
- Complete `npm run test:e2e` run 1: 183 passed, 0 failed, 27 intentional skips.
- Complete `npm run test:e2e` run 2: 183 passed, 0 failed, 27 intentional skips.
- `npm run build`: passed.
- `git diff --check`: passed.
- Markdown trailing-whitespace check: passed.

## Screenshots

Captured under `docs/ui-redesign-spec/screenshots/increment-15/`:

- `commissions-register-populated-desktop-1440x900.png`
- `commissions-register-mobile-390x844.png`
- `commissions-register-restricted-desktop-1440x900.png`
- `commission-detail-desktop-1440x900.png`
- `commission-detail-mobile-390x844.png`
- `commission-detail-calculation-desktop-1440x900.png`
- `commission-detail-payable-desktop-1440x900.png`
- `commission-detail-paid-desktop-1440x900.png`
- `commission-review-valid-desktop-1440x900.png`
- `commission-review-mobile-390x844.png`
- `disputes-register-populated-desktop-1440x900.png`
- `disputes-register-mobile-390x844.png`
- `dispute-detail-evidence-desktop-1440x900.png`
- `dispute-review-unresolved-desktop-1440x900.png`
- `dispute-review-mobile-390x844.png`
- `dispute-detail-resolved-desktop-1440x900.png`

## Intentionally deferred

- Increment 16 Analytics, Reports, Data Transfer, Settings, and Operations.
- Final whole-product visual and brand refinement.
- Removal of unused legacy Commission/Dispute exports after caller proof.
- Inventing statement/payout routes that do not exist in the API.
- Unsupported financial forecasts, celebratory payout graphics, or inferred
  commission owed from Order value.

No schema, migration, API contract, calculation rule, dispute rule, permission
rule, or audit behavior change was authorized for this increment.
