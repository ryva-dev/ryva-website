# UI Redesign Increment 5 — Standard Relationship Detail

**Status:** Structurally complete

**Date:** 2026-07-21

**Scope boundary:** Reusable Standard Relationship Detail composition and the
Contact Detail pilot at `/contacts/:id` only.

## Delivered pattern

Increment 5 establishes the relationship-centered detail model that later
record workspaces can adopt without changing their domain behavior. The pattern
connects:

- a true relationship trail and stable record identity;
- one human-owned next action and the actions already permitted for that record;
- keyboard-operated Overview, Activity, and Evidence views;
- current operational facts and a semantic activity timeline;
- a persistent desktop Context Rail for freshness, permission, authority
  boundaries, blockers, and open work;
- a focus-managed mobile Context drawer; and
- focus-managed verification and note drawers that preserve entered values on
  recoverable errors.

The shared additions are `RelationshipTrail`, `RelationshipTabs`,
`RelationshipTabPanel`, `RelationshipDetailLayout`, `RelationshipSection`,
`ContextRail`, and `StickyMobileAction`. They consume the approved design tokens
and compose existing Increment 2 primitives and the Increment 4 Drawer.

## Contact pilot and preserved behavior

The existing `/contacts/:id` route remains canonical. It still reads
`GET /api/records/contact/:id` and `GET /api/sources`; human verification still
uses the exact optimistic-version payload accepted by
`PATCH /api/contacts/:contactId/verification`; notes still use the existing
connected-record endpoint.

No schema, migration, endpoint, payload, route, capability, access decision,
workspace boundary, audit rule, or domain policy changed. The server remains
authoritative for every mutation.

The Contact page deliberately distinguishes the following facts:

- a professional route can be verified without proving Buyer authority;
- stored permission status does not clear channel suppression;
- a Contact never creates Brand, Product, territory, channel, Buyer, Agreement,
  Protected Account, or Outreach authority;
- read-only mode comes from the server-issued session decision and capability
  set; and
- the Activity view shows persisted Activities plus a labeled snapshot of the
  current persisted verification record, not invented historical events.

Email and telephone remain explicit user-invoked links. The page does not send,
call, negotiate, approve, infer authority, or bypass the shared Outreach
validator.

## State and focus model

- Loading retains the relationship trail and record-type identity while
  announcing progress.
- Failure retains the same context and exposes an explicit retry action.
- Populated state keeps identity, next action, status, parent relationship, and
  contextual blockers visible without duplicating the whole record in cards.
- Read-only state keeps truthful inspection while verification and note
  mutations are unavailable.
- Verification requires a human-selected status and Source, includes observed
  time and notes, retains the optimistic record version, and preserves form
  input if the server rejects the submission.
- Drawers are named dialogs with initial focus, Tab containment, Escape close,
  background inerting, body scroll lock, and trigger focus restoration.

## Responsive and accessibility behavior

At wide desktop the main relationship record and 320 px Context Rail share one
connected layout. At tablet width the rail reflows below the primary record. On
mobile it becomes a viewport-bounded Context drawer and the permitted primary
action remains reachable above the safe-area-aware bottom navigation.

The relationship trail uses navigation/current-page semantics. Tabs implement
the WAI keyboard model with Arrow Left/Right, Home, and End. Timeline entries
use list/time semantics, headings remain ordered, actions have explicit names,
and page identity survives loading and error states.

Exact authenticated audits at 1440 × 900, 1024 × 768, 390 × 844, 375 × 812,
and 320 × 568 found no document-level horizontal overflow or visible viewport
offenders. The 320 px Context drawer remained exactly viewport-bounded and
scrollable, with focus restored to Review context after close.

## Validation evidence

- `npm run lint`: passed, including token policy.
- `npm run typecheck`: passed for strict server and web projects.
- `npm run test:unit`: 31 passed; 3 cover Standard Relationship Detail
  contracts.
- `npm run test:integration`: 62 passed against PostgreSQL.
- Focused relationship Playwright: 6 passed and 2 intentional
  duplicate-project skips.
- Complete Playwright: 61 passed and 5 intentional duplicate-project skips
  across desktop and mobile Chromium.
- `npm run build`: passed; Vite transformed 90 modules. The existing large
  client-chunk advisory remains non-blocking.
- Authenticated browser inspection reported no console or page errors.

## Review captures

- [Contact overview desktop](screenshots/increment-5/contact-overview-desktop-1440x900.png)
- [Verification drawer desktop](screenshots/increment-5/contact-verification-drawer-desktop-1440x900.png)
- [Activity tablet](screenshots/increment-5/contact-activity-tablet-1024x768.png)
- [Contact mobile](screenshots/increment-5/contact-mobile-390x844.png)
- [Mobile Context drawer](screenshots/increment-5/contact-context-mobile-390x844.png)
- [Loading state](screenshots/increment-5/contact-loading-desktop-1440x900.png)
- [Error recovery state](screenshots/increment-5/contact-error-desktop-1440x900.png)
- [Restricted-session state](screenshots/increment-5/contact-restricted-desktop-1440x900.png)

## Increment boundary and remaining risk

Increment 5 proves the detail state and focus model on Contact without losing
existing action, provenance, or history. Product, Brand, Buyer, Representation,
Placement, Account, Order, and Commission detail migrations remain in their
documented later increments. Increment 6 Consequential Review has not started.

The current Contact response does not contain a complete historical sequence of
verification revisions or a combined Outreach authority/suppression decision.
The UI therefore shows only stored facts and directs users to the existing
Outreach validator rather than fabricating either result. A future page may
surface richer server truth only when its documented domain increment and API
contract provide it.

Current styling is an accepted structural expression, not the final Ryva brand
art direction. A cohesive whole-product UI/UX refinement remains intentionally
deferred until every documented redesign increment is structurally complete.
That pass may refine typography, color, control styling, spacing, surfaces,
timeline polish, drawer presentation, and overall visual cohesion while
preserving this functionality, responsiveness, accessibility, and policy.

No material founder decision was required.
