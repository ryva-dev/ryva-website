# UI Redesign Increment 9 — Brand Intelligence

**Status:** Structurally complete

**Date:** 2026-07-21

**Scope boundary:** Brand Intelligence routes and Brand-compatible generic
record routes only. Businesses, Buyers, and Contacts (Increment 10) were not
started.

## Delivered pattern

Increment 9 migrates Brand Intelligence into the approved structural patterns:

- **Standard Register / Split Intelligence Workspace** for `/brands` and
  `/records/brand`;
- **Standard Relationship Detail** for `/brands/:id` and `/records/brand/:id`;
- generic Brand compatibility without migrating Buyer, Business, Contact, or
  other later-increment record types;
- preservation of Product Intelligence routes migrated in Increment 8.

The module lives in `apps/web/src/redesign/brand/` and composes Increment 1
tokens, Increment 2 controls, Increment 3 shell, Increment 4 Standard Register
primitives, and Increment 5 Relationship Detail foundations.

## Routes migrated

| Route | Pattern | Notes |
|---|---|---|
| `/brands` | Split Intelligence Workspace | Results, selected summary, context rail, unqualified create |
| `/brands/:id` | Standard Relationship Detail | Overview, Products, Evidence, Qualification, Representation, Relationships, Activity |
| `/records/brand` | Canonical Brand register | Compatibility notice; same Brand APIs |
| `/records/brand/:id` | Canonical Brand detail | Compatibility notice; same Brand APIs |

## Standard Register reuse

`BrandRegisterPage` reuses shared register primitives:

- `FilterBar`, `SearchInput`, `RegisterSavedViews`, `RegisterColumnSelector`
- `SortableHeader`, `RegisterPagination`, `RegisterMobileList` / `RegisterMobileRow`
- `ActiveFilters`, `RegisterFilterSheet`
- `ContextRail` for selected Brand diligence summary
- `AuthorityIndicator`, `EvidenceLabel`, `RiskIndicator`, `StatusLabel`

High-value Brand columns prioritize identity, pipeline stage, wholesale status,
Product count, risk, representation status, next action, and last reviewed.
Create remains labeled as unqualified Brand creation and does not imply
outreach permission or representation authority.

## Relationship Detail reuse

`BrandDetailPage` uses:

- `IdentityHeader`, `RelationshipTrail`, `RelationshipTabs` / `RelationshipTabPanel`
- `RelationshipDetailLayout`, `RelationshipSection`, `ContextRail`
- `ActivityTimeline`, `StickyMobileAction`
- `EvidenceLabel`, `AuthorityIndicator`, `RiskIndicator`, `StatusLabel`
- `EmptyState`, `LoadingState`, `ErrorState`, `Alert`, `Drawer` (via Context Rail)

Tabs distinguish stored Brand facts, Product relationships, evidence,
qualification, representation readiness versus authority, professional
contacts, and activity history.

## Generic Brand compatibility

`RecordsPage` delegates Brand and Product variants to the canonical redesign
modules. Business and Contact remain on the legacy generic path for later
increments. Backward-compatible `/records/brand` and `/records/brand/:id`
links are preserved.

## Product relationship treatment

Linked Products appear on Brand detail as commercial context only. Copy and
empty states state that Product relationships do not create Brand authority.
Product register/detail/comparison routes from Increment 8 remain on
`apps/web/src/redesign/product/` and continue to pass focused and full-suite
regression coverage.

## Evidence, qualification, representation, and authority boundaries

Preserved server-owned behavior:

- Brand intelligence APIs (`GET/PATCH /api/intelligence/brands`, stage updates,
  evidence, observations, decisions, contacts)
- qualification and identity-review workflows
- evidence provenance and explicit Unknown handling
- representation readiness language that is not Agreement authority
- existing roles, capabilities, and restricted-session messaging

UI distinctions:

- evidence present / missing / unknown (not collapsed to good/bad)
- qualification outcomes versus pipeline stage
- representation readiness versus `AuthorityIndicator` status
- Product and Contact relationships never presented as Brand authority
- post-mutation silent reload with active-tab preservation (`tabWhenStarted`)

No qualification rules, evidence freshness rules, Agreement rules, authority
calculations, server validators, schema, or Brand API contracts were changed.

## Responsive and accessibility behavior

- Desktop register maintains comparison density with disciplined columns and
  selected-summary context.
- Mobile uses semantic rows; Context Rail becomes a Review context drawer.
- Relationship tabs remain keyboard-operable; Escape closes drawers.
- Status meaning uses labels and rationales, not color alone.
- Loading, empty, no-result, error, and read-only restricted states are
  explicit.
- Brand CSS uses token breakpoints (`64rem` / `48rem`) without overflow-hiding
  workarounds.

## Validation results

- `npm run lint:tokens`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed for strict server and web projects.
- `npm run test:unit`: 48 passed, including 4 Brand Intelligence contracts.
- `npm run test:integration`: 62 passed against PostgreSQL.
- Focused Brand Playwright (`tests/e2e/brand.spec.ts`): 11 passed, 1
  intentional duplicate-project skip.
- Focused Product + access Playwright: 25 passed, 1 intentional skip.
- Complete `npm run test:e2e` run 1: 104 passed, 0 failed, 14 intentional skips.
- Complete `npm run test:e2e` run 2: 104 passed, 0 failed, 14 intentional skips.
- `npm run build`: passed.
- `git diff --check`: passed.

### Intermittent failure root cause and correction

Adding Brand e2e coverage increased authenticated login volume above the prior
e2e `RATE_LIMIT_LOGIN_MAX=100` ceiling, so late mobile Product sign-in
assertions failed under the full suite even though focused Product tests
passed.

Correction: raise the e2e-only login rate limit to `500` in `package.json`
(`test:e2e`) and `playwright.config.ts` webServer env. Production defaults are
unchanged. No Product or Brand assertions were removed or weakened.

## Screenshots

Captured from the authenticated synthetic application under
`docs/ui-redesign-spec/screenshots/increment-9/`:

- `brand-register-populated-desktop-1440x900.png`
- `brand-register-populated-mobile-390x844.png`
- `brand-register-empty-desktop-1440x900.png`
- `brand-register-restricted-desktop-1440x900.png`
- `brand-detail-populated-desktop-1440x900.png`
- `brand-detail-populated-mobile-390x844.png`
- `brand-detail-evidence-desktop-1440x900.png`
- `brand-detail-evidence-mobile-390x844.png`
- `brand-detail-products-desktop-1440x900.png`
- `brand-detail-representation-desktop-1440x900.png`
- `brand-detail-representation-mobile-390x844.png`

Dedicated loading-state capture remains limited because Brand routes resolve
quickly in the seeded application; error and restricted states are covered by
`ErrorState` / read-only messaging and restricted-session screenshots.

## Intentionally deferred

- Increment 10 Businesses, Buyers, and Contacts.
- Final whole-product visual and brand refinement.
- Consolidation or removal of legacy Brand paths remaining inside
  `IntelligencePages.tsx` for non-migrated kinds.

No schema, migration, API contract, permission, capability, qualification
threshold, Agreement rule, or authority calculation change was authorized for
this increment.
