# UI Redesign Increment 17 — Structural Consolidation

**Status:** Structurally complete

**Date:** 2026-07-22

**Commit status:** Nothing in this increment is committed or pushed.

## Purpose and boundary

Increment 17 is a consolidation pass, not a feature increment. It unifies
route ownership, shell metadata, structural QA, and the final route inventory
without changing product behavior, domain policy, server authority, routes, or
deep-link compatibility.

It does not start Railway deployment, Stripe work, certification changes, live
provider integrations, marketing work, or a Closing Program. It also does not
invent routes, reports, transfer-job registers, payout/statement surfaces, or
provider-backed data.

## Consolidated ownership

Protected Account detail moves from `pages/CommercePages.tsx` to the canonical
`redesign/commerce/ProtectedAccountDetail.tsx` module. The route remains
`/protected-accounts/:id`, and its established Consequential Review behavior
remains unchanged: proposal, exact scope and digest, readiness, human
approval/denial, completed outcome, and audit remain distinct.
`pages/CommercePages.tsx` re-exports the redesign module for historical callers.

The compatibility boundary remains deliberate:

- `pages/RecordsPage.tsx` remains the route-compatible generic-record adapter.
- Inc 4 Sources, Territories, Documents, Tasks, and Notifications remain in
  `pages/*` while composing `redesign/register`.
- Copilot remains intentionally legacy; its list route is not brand-polished.
- Login remains the legacy authentication route and is not brand-polished.
- Legacy CommercePages page implementations remain retained unwired for
  history and caller proof. Retention does not imply that they remain routed.

## Shell and route metadata

The shell owns document titles through `shellDocumentTitle`, aligned with
consolidated navigation labels. Login sets the same title helper outside the
protected shell. Mobile bottom destinations derive from
`mobileBottomNavigation` rather than duplicated hard-coded paths.

Global navigation remains capability-derived. Reports remains an Analytics
query view (`/analytics?view=reports`), data transfer remains Import/Export,
and contextual routes such as Contacts, Sources, Territories, and Copilot do
not gain new navigation authority merely through metadata consolidation.

## Responsive, accessibility, and truthfulness

The existing token system and tokenized breakpoints are retained. A source scan
found no redesign `overflow-x: hidden` workaround. Reduced-motion preferences
remain honored in shared CSS. Skip-link and `#main-content` landmarks remain
required shell contracts.

Cross-product Playwright coverage lives in `tests/e2e/increment-17.spec.ts`
and asserts titles, landmarks, overflow absence, restricted honesty,
cross-route continuity, and key truthfulness distinctions.

Exact validation totals are recorded in `IMPLEMENTATION_LEDGER.md`.

## Screenshots

Authenticated captures live under
`docs/ui-redesign-spec/screenshots/increment-17/`.

## Deferral

Final brand beautification is deferred to a separate Claude pass. That pass may
refine typography, color, spacing, surfaces, controls, and visual cohesion, but
must preserve the route inventory, responsive behavior, accessibility, server
truthfulness, capability boundaries, and consequential-review controls
consolidated here.
