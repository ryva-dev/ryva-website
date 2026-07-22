# UI Redesign Increment 14 — Accounts, Orders, Reorders, and Protection

**Status:** Structurally complete

**Date:** 2026-07-22

**Scope boundary:** Accounts, Orders, Reorders, and Protection commercial
registers, relationship detail, and consequential commercial review only.
Commissions and Disputes (Increment 15) were not started. Final whole-product
visual refinement remains deferred.

## Delivered pattern

Increment 14 migrates commercial continuity surfaces into approved structural
patterns:

- **Standard Register** for `/accounts`, `/protected-accounts`, `/orders`, and
  `/reorders`;
- **Standard Relationship Detail** for `/accounts/:id` and `/orders/:id`;
- **Consequential Review** for Account health review, Order confirmation, and
  Protected Account exact-artifact approval (detail remains the Increment 6
  consequential surface at `/protected-accounts/:id`);
- **Commercial subnav** linking Accounts, Protection, Orders, Reorders,
  Commissions, and Disputes without redesigning commission workflows.

Module lives in `apps/web/src/redesign/commerce/`. Legacy Account, Order, and
Reorder page exports in `apps/web/src/pages/CommercePages.tsx` remain unwired
except Commissions, Disputes, and Protected Account detail.

## Routes migrated

| Route | Pattern | Notes |
|---|---|---|
| `/accounts` | Standard Register | Continuity copy; mobile semantic rows |
| `/accounts/:id` | Relationship Detail + Consequential health review | Protection/Orders/Reorders tabs; commission link only |
| `/protected-accounts` | Standard Register + pending-basis create form | Documentary-rights honesty preserved |
| `/protected-accounts/:id` | Consequential Review (existing Inc 6 surface) | Exact scope, digest, approval/denial |
| `/orders` | Standard Register + multi-line create form | Verification kept separate from entry |
| `/orders/:id` | Relationship Detail + Consequential confirmation | Exact lines/totals; version concurrency |
| `/reorders` | Standard Register + inline human review | No `/reorders/:id` route exists in the API |

## Account Register and Detail

Account register preserves search/filter/sort/saved views/density/export,
loading/empty/no-result/error/restricted states, and mobile semantic rows
prioritizing Business, Brand/Product context, status, protection, latest Order,
Reorder state, blocker, and next action.

Account detail distinguishes Account identity, Business, Brand, protection,
Orders, Reorders, health review, activity, and commission context links. Health
changes use exact-artifact Consequential Review with optimistic concurrency and
required rationale.

## Order Register and Detail

Order register preserves multi-line source-backed entry, Placement and clean
document selection, and verification separation. Amounts displayed are stored
values only.

Order detail distinguishes operational status, payment status, fulfillment
status, and verification status. Lines, quantities, prices, and totals come from
stored Order data. Confirmation uses ExactArtifact, ValidationSummary,
ConfirmationDialog, version checks, duplicate-submission prevention, and audit
reload.

## Protected Accounts

Register creates pending documentary-rights reviews only. Detail keeps proposal,
approved, expired/released/ended, exact Product/channel/territory/term scope,
evidence, and Agreement reference distinct from Representation authority.
Protection never implies permanence, universal Brand/Product coverage, or
commission entitlement.

## Reorders

Reorder register distinguishes projected/due/deferred/closed stored workflow
states from eligibility. Prior Order context is shown. Time alone never
establishes Buyer need, authority, permission, protection, or guaranteed
revenue. No automatic Reorder sending was added. No `/reorders/:id` route was
invented.

## Authority, Agreement, and protection boundaries

Representation authority, Agreement scope, Account protection, Order validity,
and Reorder eligibility remain separate. The UI does not change validators,
authority calculations, Agreement rules, protection rules, Account rules, Order
rules, Reorder rules, audit behavior, or server contracts.

## Placement and Outreach boundaries

Placement and Outreach routes remain migrated from prior increments. Placement
commercial tab links to Orders, Accounts, Reorders, and Protection. A reply or
Placement stage does not invent an Order or Account outcome.

## Commission boundary

Increment 15 owns Commissions and Disputes. Increment 14 shows commission
context only through existing links or stored summary fields. Order value is
never presented as commission owed. No commission ledgers, payouts, statements,
disputes, or calculations were redesigned.

## Responsive and accessibility

Token breakpoints at `64rem` / `48rem`, no `overflow-x: hidden` workarounds,
Context Rail / drawer, sticky mobile actions, keyboard tabs/filters, Escape and
focus restoration via shared overlays, and status meaning independent of color
alone. Mobile prioritizes identity, Business/Buyer, Brand/Product, commercial
status, authority/protection, blocker, and required action.

## Validation results

- `npm run lint:tokens`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:unit`: 80 passed, including 9 Commerce contracts.
- `npm run test:integration`: 62 passed against PostgreSQL.
- Focused commerce Playwright: 21 passed, 1 intentional skip.
- Focused Placement/Outreach/Representation/Buyer + commerce regression: 81 passed, 11 intentional skips.
- Complete `npm run test:e2e` run 1: 171 passed, 0 failed, 25 intentional skips.
- Complete `npm run test:e2e` run 2: 171 passed, 0 failed, 25 intentional skips.
- `npm run build`: passed.
- `git diff --check`: passed.
- Markdown trailing-whitespace check: passed.

## Screenshots

Captured under `docs/ui-redesign-spec/screenshots/increment-14/`:

- `accounts-register-populated-desktop-1440x900.png`
- `accounts-register-mobile-390x844.png`
- `accounts-register-restricted-desktop-1440x900.png`
- `account-detail-desktop-1440x900.png`
- `account-detail-mobile-390x844.png`
- `account-detail-protection-desktop-1440x900.png`
- `account-detail-orders-desktop-1440x900.png`
- `protection-register-desktop-1440x900.png`
- `protection-review-pending-desktop-1440x900.png`
- `protection-review-approved-desktop-1440x900.png`
- `protection-review-expired-desktop-1440x900.png`
- `orders-register-desktop-1440x900.png`
- `orders-register-mobile-390x844.png`
- `order-detail-lines-desktop-1440x900.png`
- `order-detail-mobile-390x844.png`
- `order-review-valid-desktop-1440x900.png`
- `order-review-mobile-390x844.png`
- `reorders-register-desktop-1440x900.png`
- `reorders-register-mobile-390x844.png`
- `reorders-register-states-desktop-1440x900.png`

## Intentionally deferred

- Increment 15 Commissions and Disputes redesign.
- Final whole-product visual and brand refinement.
- Removal of unused legacy Commerce Account/Order/Reorder exports after caller
  proof.
- Inventing a `/reorders/:id` route (API has no dedicated getReorder detail).
- Unsupported financial forecasts, ARR charts, or inferred commission owed.

No schema, migration, API contract, permission rule, protection rule, Order
validator, Reorder rule, or audit behavior change was authorized for this
increment.
