# UI Redesign Increment 4 — Standard Register

**Status:** Structurally complete and accepted

**Date:** 2026-07-21

**Scope boundary:** Standard Register pattern and the Sources, Territories,
Documents, Tasks, and Notifications registers only.

## Structural acceptance

The Standard Register architecture is structurally complete. Its functionality,
responsive behavior, mobile filter drawer, table behavior, state coverage, and
accessibility behavior are accepted as the correct implementation foundation.
The implementation and its existing automated coverage are preserved.

Final cross-product visual refinement and Ryva brand-level polish are
intentionally deferred until every documented redesign increment is
structurally complete. That whole-product UI/UX pass may refine typography,
color, control styling, spacing, surfaces, table polish, drawer presentation,
and overall visual cohesion. It must preserve the accepted functionality,
information structure, responsive behavior, accessibility, routes, and domain
controls documented here.

## Delivered pattern

Increment 4 introduces one composable Standard Register for bounded operational
datasets. It combines a compact page identity, one clear primary action, saved
views, visible filters, active-filter disclosure, result count, sortable table,
density and column controls, pagination, structured mobile rows, and a
contextual preview drawer. The pattern consumes the Increment 1 tokens and
Increment 2 components within the Increment 3 shell.

Shared additions are:

- `Drawer`, with a named dialog, initial focus, Tab containment, Escape close,
  background inerting, body scroll lock, and trigger focus restoration;
- register saved-view, filter-sheet, active-filter, sortable-header,
  column-selector, pagination, and mobile-row compositions; and
- stable record sorting with explicit treatment of missing values.

No domain record was converted into a generic entity abstraction. The shared
layer owns visual and interaction structure; each page continues to own its
domain labels, evidence, authority, risk, actions, and existing API contract.

## Migrated routes and preserved behavior

| Route | Register behavior | Preserved consequential behavior |
|---|---|---|
| `/sources` | Provenance, source type, rights, freshness, and evidence-use visibility; registration and preview drawers | Source registration remains human-authored provenance and does not establish evidence truth |
| `/territories` | Scope, status, authority, and proposal context; proposal and preview drawers | Every new Territory remains proposed; no Agreement authority or account protection is inferred |
| `/documents` | Immutable identity, hash, scanner/quarantine status, related-record context, upload and preview drawers | Original upload/hash path and clean-only download enforcement remain unchanged |
| `/tasks` | Today, Upcoming, Blocked, and Completed views with due/status/owner filters and selected Task context | Optimistic version and mandatory-gate completion evidence remain server-enforced |
| `/notifications` | Action required, All, and Read views with severity/status filters and ordered reason context | Current-user scope, state constraints, mark-read mutation, and audit remain unchanged |

Saved views use the existing `/api/saved-views` route. All record mutations use
the pre-existing page endpoints and payload shapes. Workspace isolation,
capabilities, restricted-session behavior, append-only audit, authority,
provenance, and document security remain server-owned.

## State model

- Loading retains the page identity and announces progress.
- Dataset-empty states explain what belongs in the register and expose only the
  permitted creation action.
- Filter-no-result states preserve the query context and offer a clear-filter
  recovery action rather than implying that the dataset is empty.
- API errors retain the page identity, use a live alert, and expose retry.
- Read-only sessions retain truthful inspection while creation, mutation, and
  saved-view writes are unavailable.
- Selected-record drawers provide context without replacing a future
  Relationship Detail page.

## Responsive and accessibility behavior

Desktop and tablet retain the dense comparison table. Below 768 px, records
become semantic structured rows; primary identity and state remain first, while
supporting facts reflow without horizontal scrolling. Filters move to a
full-width, focus-managed Drawer. Advanced saved-view creation stays
desktop-first, while saved-view selection remains available on mobile.

Tables have accessible names and column scope; sort controls expose
`aria-sort`; row identities and actions have unique accessible names; result
and pagination text stay explicit; drawers restore focus; touch controls use the
approved minimum target; and exact audits at 390, 375, and 320 CSS pixels found
no clipped register controls or document overflow.

## Reference synthesis

- **Venture CRM:** influenced table alignment, restrained borders, comparable
  columns, toolbar density, and disciplined data surfaces. Its marketing layout
  and literal visual values were not copied.
- **Relationship-centered CRM:** influenced selected-record context, visible
  next-action cues, and the decision to keep identity and operating status near
  actions. Its bright palette, floating-card density, and detail-page layout
  were not copied.
- **Stratus CRM:** informed the clear distinction between a proposed scope and
  actual authority. No workflow-canvas treatment was introduced because these
  routes are registers, not connected workflow pages.
- **Ryva public concept:** informed stronger editorial hierarchy, controlled
  warm character, dark authoritative type, and restrained accent use. Its
  palette is optional inspiration only; no marketing hero, display-serif data
  UI, storytelling layout, or decorative certification treatment was copied.

The resulting expression evolves the approved product tokens rather than
switching palettes or assembling literal reference fragments.

## Validation evidence

- `npm run lint`: passed, including token policy.
- `npm run typecheck`: passed for strict server and web projects.
- `npm run test:unit`: 28 passed; 5 cover Standard Register contracts.
- `npm run test:integration`: 62 passed against PostgreSQL.
- Focused register Playwright: 8 passed, 2 intentional duplicate-project skips.
- Complete Playwright: 55 passed, 3 intentional duplicate-project skips across
  desktop and mobile Chromium.
- `npm run build`: passed; Vite transformed 88 modules. The existing large
  client-chunk advisory remains non-blocking.
- Live authenticated inspection at 1440 × 900, 1024 × 768, 390 × 844,
  375 × 812, and 320 × 568 found no console/page errors, no document overflow,
  and no clipped visible controls.

## Review captures

- [Sources desktop](screenshots/increment-4/sources-desktop-1440x900.png)
- [Source registration drawer](screenshots/increment-4/sources-register-drawer-desktop-1440x900.png)
- [Territories tablet](screenshots/increment-4/territories-tablet-1024x768.png)
- [Sources mobile](screenshots/increment-4/sources-mobile-390x844.png)
- [Mobile filter sheet](screenshots/increment-4/sources-filter-sheet-mobile-390x844.png)
- [Documents loading](screenshots/increment-4/documents-loading-desktop-1440x900.png)
- [Documents empty](screenshots/increment-4/documents-empty-desktop-1440x900.png)
- [Sources error recovery](screenshots/increment-4/sources-error-desktop-1440x900.png)
- [Sources restricted session](screenshots/increment-4/sources-restricted-desktop-1440x900.png)
- [Tasks mobile](screenshots/increment-4/tasks-mobile-390x844.png)
- [Notifications empty](screenshots/increment-4/notifications-empty-desktop-1440x900.png)

## Increment boundary and remaining risk

Increment 5 Relationship Detail was not started. The preview drawer intentionally
contains bounded context rather than a complete relationship workspace.

No additional Increment 4 visual-polish pass is planned before Increment 5.
Current styling is an accepted structural expression, not the final Ryva
whole-product art direction. Visual refinements listed in the structural
acceptance section are explicitly reserved for the later cohesive UI/UX pass.

Current list endpoints are server-bounded and the register paginates their
returned records client-side. Server-side register pagination will be necessary
before those endpoint limits are raised, but changing the API was outside this
increment and is not required at current bounded volumes.

No migration, schema, route, API, permission, policy, or business-logic change
was made. No material founder decision was required.
