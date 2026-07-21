# UI Redesign Increment 10 — Businesses, Buyers, and Contacts

**Status:** Structurally complete

**Date:** 2026-07-21

**Scope boundary:** Business / Buyer Intelligence routes, Contact register and
detail compatibility, and mobile call-preparation context only. Representation
and Agreement authority (Increment 11) was not started.

## Delivered pattern

Increment 10 migrates Businesses, Buyers, and Contacts into approved structural
patterns:

- **Standard Register / Split Intelligence Workspace** for `/buyers` and
  `/records/business`;
- **Standard Relationship Detail** for `/buyers/:id` and
  `/records/business/:id`;
- **Contact Standard Register** for `/records/contact`;
- **Contact Relationship Detail** (Increment 5 pilot preserved and extended)
  for `/contacts/:id` and `/records/contact/:id`;
- mobile Buyer lookup and Contact call-preparation context using existing
  routes and stored data.

Modules live in:

- `apps/web/src/redesign/buyer/`
- `apps/web/src/redesign/contact/`

They compose Increment 1–5 foundations plus Product (8) and Brand (9) patterns.

## Routes migrated

| Route | Pattern | Notes |
|---|---|---|
| `/buyers` | Split Intelligence Workspace | Business results, selected summary, context rail, unqualified create |
| `/buyers/:id` | Standard Relationship Detail | Overview, Contacts, Buyers, Fit, Evidence, Qualification, Activity |
| `/contacts/:id` | Relationship Detail | Increment 5 pilot + call preparation / Business context |
| `/records/business` | Canonical Buyer register | Compatibility notice |
| `/records/business/:id` | Canonical Buyer detail | Compatibility notice |
| `/records/contact` | Contact register | Compatibility notice |
| `/records/contact/:id` | Canonical Contact detail | Compatibility notice |

Product and Brand routes from Increments 8–9 remain on their canonical modules.

## Business, Buyer, and Contact distinctions

UI copy and section structure keep the entities distinct:

- **Business** — organization / commercial entity;
- **Buyer** — buyer profile or purchasing role linked to a Business
  (`business_buyers`);
- **Contact** — individual person and professional route.

The UI does not present a Contact as a Buyer, a Buyer as representation
authority, or verification as permission to contact.

## Contact pilot preservation and expansion

Preserved from Increment 5:

- Overview / Activity / Evidence tabs;
- Context Rail and mobile Review context drawer;
- human verification and note workflows;
- verification freshness and permission / suppression distinctions;
- authority boundary language;
- focus and Escape behavior for drawers.

Expanded for Increment 10:

- Overview **Call preparation** section;
- explicit associated Business organization labeling;
- text-only guidance that Buyer roles live on the Business;
- silent post-mutation reload with active-tab preservation.

Contact verification APIs and rules are unchanged.

## Fit, evidence, verification, permission, and authority

Preserved server-owned behavior for Business qualification, Product match
reviews, Buyer verification, Contact verification, evidence provenance, and
permission / suppression fields.

UI distinctions remain explicit (not color-only):

- fit assessed / not assessed / blocked via match status;
- evidence present / missing / Unknown;
- Contact verified / unverified / stale;
- permission allowed / unknown / denied or suppressed;
- Buyer role stored versus Buyer authority verified;
- representation authority not established by Business or Contact records.

## Generic compatibility

`RecordsPage` / `RecordDetailPage` now delegate all four record types
(`product`, `brand`, `business`, `contact`) to canonical redesign modules.
Backward-compatible `/records/...` links remain.

## Responsive and accessibility behavior

- Buyer register: desktop density + mobile semantic rows;
- Buyer detail: Context Rail → Review context drawer on narrow viewports;
- Contact: sticky permitted action; call-prep facts remain readable;
- token breakpoints `64rem` / `48rem` without overflow-hiding workarounds;
- keyboard tabs, Escape, focus restore, and non-color status labels.

## Validation results

- `npm run lint:tokens`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed for strict server and web projects.
- `npm run test:unit`: 56 passed, including Buyer and Contact contracts.
- `npm run test:integration`: 62 passed against PostgreSQL.
- Focused Buyer Playwright (`tests/e2e/buyer.spec.ts`): 13 passed, 1
  intentional duplicate-project skip.
- Focused access Buyer journey: 2 passed.
- Complete `npm run test:e2e` run 1: 117 passed, 0 failed, 15 intentional skips.
- Complete `npm run test:e2e` run 2: 117 passed, 0 failed, 15 intentional skips.
- `npm run build`: passed.
- `git diff --check`: passed.

## Screenshots

Captured from the authenticated synthetic application under
`docs/ui-redesign-spec/screenshots/increment-10/`:

- `buyer-register-populated-desktop-1440x900.png`
- `buyer-register-populated-mobile-390x844.png`
- `buyer-register-empty-desktop-1440x900.png`
- `buyer-register-restricted-desktop-1440x900.png`
- `buyer-detail-populated-desktop-1440x900.png`
- `buyer-detail-populated-mobile-390x844.png`
- `buyer-detail-evidence-desktop-1440x900.png`
- `buyer-detail-evidence-mobile-390x844.png`
- `buyer-detail-buyers-desktop-1440x900.png`
- `contact-detail-call-prep-desktop-1440x900.png`
- `contact-detail-call-prep-mobile-390x844.png`

## Intentionally deferred

- Increment 11 Representation and Agreement authority.
- Final whole-product visual and brand refinement.
- Removal of unused legacy Business/Brand list code remaining inside
  `IntelligencePages.tsx` for non-routed kinds.

No schema, migration, API contract, permission, capability, fit rule,
verification rule, suppression rule, or authority calculation change was
authorized for this increment.
