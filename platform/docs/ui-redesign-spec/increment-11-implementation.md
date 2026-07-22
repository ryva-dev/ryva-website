# UI Redesign Increment 11 — Representation and Agreement Authority

**Status:** Structurally complete

**Date:** 2026-07-21

**Scope boundary:** Representation register and detail, Agreement Consequential
Review, and authority / readiness visualization only. Placement CRM
(Increment 12) was not started.

## Delivered pattern

Increment 11 migrates Representation and Agreement authority into approved
structural patterns:

- **Standard Register** for `/representation`;
- **Standard Relationship Detail** for `/representation/:id`;
- **Consequential Review** for `/agreements/:id`;
- agreement-readiness and representation-authority visualization using stored
  facts and server-validated outcomes only.

Module lives in `apps/web/src/redesign/representation/` and composes Increment
1–6 foundations plus Product, Brand, Buyer, and Contact patterns.

## Routes migrated

| Route | Pattern | Notes |
|---|---|---|
| `/representation` | Standard Register | Opportunities table + Agreements list + open-opportunity form |
| `/representation/:id` | Standard Relationship Detail | Overview, Agreements & Documents, Scope, Activity |
| `/agreements/:id` | Consequential Review | Exact-artifact material terms, validation, human approval activation |

There is no Representation or Agreement generic `/records/...` route in the
migration plan. Product, Brand, Business, and Contact generic routes remain on
their Increment 8–10 modules.

## Standard Register reuse

`RepresentationRegisterPage` reuses:

- RegisterSavedViews, RegisterFilterSheet, ActiveFilters;
- RegisterColumnSelector and density;
- SortableHeader / Table on desktop;
- RegisterMobileList / RegisterMobileRow on mobile;
- EmptyState, LoadingState, ErrorState, StatusLabel;
- restricted-session Alert when write capability is absent.

High-value columns prioritize Brand, stage, channels, and next action. Agreement
cards remain separate from Opportunities so written-authority records are not
confused with pipeline readiness.

## Relationship Detail reuse

`RepresentationDetailPage` reuses IdentityHeader, RelationshipTrail,
RelationshipTabs / RelationshipTabPanel, RelationshipSection, ContextRail /
Drawer, ActivityTimeline, AuthorityIndicator, StickyMobileAction, and shared
status / empty / error components.

Sections distinguish:

- Brand relationship and Representation Opportunity identity;
- readiness stage versus not-established authority;
- proposed scope (Products, channels, territory) as non-Agreement scope;
- uploaded originals as evidence that never create authority alone;
- stage history as Activity.

## Consequential Review reuse

`AgreementDetailPage` reuses ConsequentialReviewLayout, ReadinessSummary,
ExactArtifact, ValidationSummary, ApprovalPanel, ConfirmationDialog,
ReviewOutcome, ReviewErrorSummary, AuthorityIndicator, AuditHistory, and Drawer
for the immutable original.

Exact-artifact behavior:

- material terms shown are the stored Agreement version and digest;
- approval requests the current server-validated artifact;
- activation posts the stored approval id with decision `approved`;
- draft / reviewing / pending never display as active authority;
- suspended / ended display as not current;
- blockers, conflict / stale messaging, duplicate-submission prevention, and
  input preservation follow Increment 6 Consequential Review patterns.

## Authority and readiness visualization

ReadinessSummary and ValidationSummary surface:

- immutable original active + clean;
- effective date, Product scope, and channel scope;
- material term candidates;
- legal ambiguity status;
- human approval preparation / completion.

AuthorityIndicator states remain explicit text (not color-only): established,
not_established, suspended, ended. Representation Opportunity stage is never
labeled as authority.

## Scope handling

UI presents only stored scope fields:

- Product links on the Agreement;
- channels array;
- territory_scope JSON;
- commission and written commercial terms;
- written account restrictions and candidates when present.

No territory proposal, Brand relationship, or uploaded document is presented as
contractual authority beyond the exact stored Agreement digest.

## Generic compatibility

Representation and Agreement do not use `/records/...` variants. Regression
coverage confirms `/records/product`, `/records/brand`, `/records/business`, and
`/records/contact` still resolve to Increments 8–10 modules. Placement and later
record types remain on legacy pages.

## Responsive and accessibility behavior

- Desktop register keeps comparison density; mobile uses semantic rows.
- Agreement Brand tags and document names wrap (`overflow-wrap: anywhere`) so
  long fixture names do not force document-level horizontal overflow.
- Create-form fields use `min-width: 0` / `max-width: 100%` so long option labels
  cannot expand the page.
- Context Rail becomes Review context drawer on narrow viewports.
- Sticky mobile actions, Escape / focus restore, keyboard tabs, and non-color
  status meaning are preserved.
- Token breakpoints `64rem` / `48rem` without overflow-hiding workarounds.

## Validation results

- `npm run lint:tokens`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed for strict server and web projects.
- `npm run test:unit`: 61 passed, including 5 Representation contracts.
- `npm run test:integration`: 62 passed against PostgreSQL.
- Focused Representation Playwright (`tests/e2e/representation.spec.ts`):
  15 passed, 3 intentional duplicate-project skips.
- Prior phase4 / consequential / Product / Brand / Buyer regressions exercised
  during full suite.
- Complete `npm run test:e2e` run 1: 132 passed, 0 failed, 18 intentional skips.
- Complete `npm run test:e2e` run 2: 132 passed, 0 failed, 18 intentional skips.
- `npm run build`: passed.
- `git diff --check`: passed.

## Screenshots

Captured from the authenticated synthetic application under
`docs/ui-redesign-spec/screenshots/increment-11/`:

- `representation-register-populated-desktop-1440x900.png`
- `representation-register-populated-mobile-390x844.png`
- `representation-register-empty-desktop-1440x900.png`
- `representation-register-restricted-desktop-1440x900.png`
- `representation-detail-populated-desktop-1440x900.png`
- `representation-detail-populated-mobile-390x844.png`
- `representation-detail-scope-desktop-1440x900.png`
- `representation-detail-readiness-documents-desktop-1440x900.png`
- `agreement-review-exact-artifact-desktop-1440x900.png`
- `agreement-review-draft-mobile-390x844.png`
- `agreement-review-completed-audit-desktop-1440x900.png`
- `agreement-review-blocker-validation-desktop-1440x900.png`

## Limitations and founder decisions

- Agreement activation UI preserves the existing approved-only decision path;
  reject / request-changes controls were not added because server contracts for
  this route remain approval-then-activate.
- Stale / conflict screenshots rely on live conflict messaging when concurrency
  fails; a dedicated conflict-only fixture was not required for acceptance.
- Legacy `RepresentationPages.tsx` remains in the tree but is unwired.

## Intentionally deferred

- Increment 12 Placement CRM and detail.
- Final whole-product visual and brand refinement.
- Removal of unused legacy Representation page modules after caller proof.

No schema, migration, API contract, permission, capability, authority
calculation, Agreement status logic, readiness rule, signature requirement,
validator, evidence rule, or audit behavior change was authorized for this
increment.
