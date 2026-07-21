# UI Redesign Increment 8 — Product Intelligence

**Status:** Structurally complete

**Date:** 2026-07-21

**Scope boundary:** Product Intelligence routes and Product-compatible generic
record routes only. Brand Intelligence (Increment 9) was not started.

## Delivered pattern

Increment 8 migrates Product Intelligence into the approved structural patterns:

- **Split Intelligence Workspace** for `/products` and `/records/product`;
- **Standard Relationship Detail** for `/products/:id` and `/records/product/:id`;
- focused comparison creation at `/products/compare`;
- analytical comparison detail at `/products/comparisons/:comparisonId`; and
- generic Product compatibility without migrating other record types.

The module lives in `apps/web/src/redesign/product/` and composes Increment 1
tokens, Increment 2 controls, Increment 3 shell, Increment 4 Standard Register
primitives, and Increment 5 Relationship Detail foundations.

## Routes migrated

| Route | Pattern | Notes |
|---|---|---|
| `/products` | Split Intelligence Workspace | Results, selected summary, context rail, inline create |
| `/products/:id` | Standard Relationship Detail | Overview, Evidence, Qualification, Related, Activity |
| `/products/compare` | Focused comparison creation | 2–4 Product selection preserved |
| `/products/comparisons/:comparisonId` | Analytical comparison | Desktop matrix + mobile focus/diff strategy |
| `/records/product` | Canonical Product register | Compatibility notice; same APIs |
| `/records/product/:id` | Canonical Product detail | Compatibility notice; same APIs |

## Preserved server truth

- All Product intelligence APIs, comparison contracts, qualification gates,
  evidence rules, observation handling, and status transitions remain
  server-owned.
- No Product Score, ranking, fabricated evidence, or client-side comparison
  logic was introduced.
- Unknown, insufficient-evidence, and missing values remain explicitly labeled.
- Brand, Buyer, Business, Representation, Placement, Account, Order, and other
  generic record variants were not migrated.

## Evidence, qualification, and no-score treatment

- `EvidenceLabel`, `RiskIndicator`, and `AuthorityIndicator` distinguish stored
  facts, sourced claims, explicit unknowns, and authority boundaries.
- Comparison pages surface server-provided interpretation limits and prohibit
  superiority or outreach-authority inference.
- Qualification decisions, observations, and evidence-linked field updates
  retain existing API endpoints and validators.

## Responsive and accessibility behavior

- Register uses Standard Register filters, sortable headers, column controls,
  pagination, and semantic mobile rows.
- Comparison detail uses a desktop attribute matrix and a mobile focus-product
  panel with explicit cross-product difference disclosure.
- Relationship tabs are keyboard-operable; comparison values retain product
  association labels; read-only and restricted sessions expose explicit alerts.

## Validation results

- `npm run lint:tokens`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed for strict server and web projects.
- `npm run test:unit`: 44 passed, including 6 Product Intelligence contracts.
- `npm run test:integration`: 62 passed against PostgreSQL.
- Focused Product Playwright (`tests/e2e/product.spec.ts`): 13 passed, 1
  intentional duplicate-project skip.
- Focused access Product journey under parallel workers (`--repeat-each=5
  --workers=4`): 10 passed, 0 failed.
- Complete `npm run test:e2e` run 1: 93 passed, 0 failed, 13 intentional skips.
- Complete `npm run test:e2e` run 2: 93 passed, 0 failed, 13 intentional skips.
- `npm run build`: passed.
- `git diff --check`: passed.

### Intermittent failure root cause and correction

Under parallel suite load, Product evidence/observation tests could proceed while
an in-flight save was still completing. The claim text was already visible in
the Evidence textarea, so assertions that only looked for that string resolved
before the server reload finished. When the mutation then called
`setActiveTab("evidence")`, inactive Relationship tab panels unmounted and
detached the Qualification form mid-interaction.

Correction:

- Application: after async Product mutations, do not steal tab focus if the
  representative already moved to another tab; use silent reloads after
  successful writes so existing detail is not forced through a loading reset.
- Tests: wait for durable saved state (status message, evidence list item, and
  cleared claim field) and scope Metric/Value/observation actions to the
  Qualification tabpanel.

No assertions were removed or weakened. Parallelism remains enabled.

## Screenshots

Captured from the authenticated synthetic application under
`docs/ui-redesign-spec/screenshots/increment-8/`:

- `product-register-populated-desktop-1440x900.png`
- `product-register-populated-mobile-390x844.png`
- `product-register-empty-desktop-1440x900.png`
- `product-register-restricted-desktop-1440x900.png`
- `product-detail-evidence-desktop-1440x900.png`
- `product-detail-evidence-mobile-390x844.png`
- `product-comparison-create-desktop-1440x900.png`
- `product-comparison-populated-desktop-1440x900.png`
- `product-comparison-populated-mobile-390x844.png`

Comparison interpretation limits and explicit unknown handling are visible in the
populated comparison screenshots. Dedicated loading-state capture remains
limited because the seeded application resolves Product routes quickly; error
states are covered structurally through `ErrorState` and restricted-session
tests.

## Intentionally deferred

- Increment 9 Brand Intelligence.
- Final whole-product visual and brand refinement.
- Consolidation of legacy Product code inside `IntelligencePages.tsx` for brand
  and business routes (Product routes no longer use that module).

No schema, migration, API contract, permission, capability, scoring formula,
qualification threshold, or comparison calculation change was authorized for
this increment.
