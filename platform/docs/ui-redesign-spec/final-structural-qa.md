# Final Structural QA

**Purpose:** consolidation QA for Increment 17. This checklist verifies that
the completed structural system remains coherent across the app; it is not a
claim that final brand art direction has been completed.

**Status key:** **Pass** = established by the structural implementation and
existing route coverage; **Validate-in-suite** = must be exercised by the final
suite before release; **Deferred-to-visual-refinement** = intentionally reserved
for the separate final brand pass.

## Required viewports

Run the applicable routes and high-risk states at:

- desktop: **1440 × 900**;
- tablet: **1024 × 768** and **768 × 1024**;
- mobile: **390 × 844**, **375 × 812**, and **320 × 568**;
- accessibility reflow: **320 CSS px** and **200% zoom**.

## Shell and navigation

- [x] **Pass** — Protected routes compose the shared Application Shell; Login
  remains outside it.
- [x] **Pass** — Desktop sidebar, tablet rail, mobile top bar, bottom
  navigation, and More sheet preserve capability-derived destinations.
- [x] **Pass** — Search, notifications, profile, certification, subscription,
  settings, and sign-out utilities retain existing routes and access behavior.
- [x] **Pass** — Mobile safe-area handling, internal navigation scrolling, and
  focus-managed disclosures avoid hiding essential navigation.
- [ ] **Validate-in-suite** — Check active-route metadata and
  `shellRouteDocumentTitle` titles for every declared route, including dynamic
  detail and compatibility paths.
- [ ] **Validate-in-suite** — Check deep links, back/forward behavior, and
  unknown-route redirect through the shell.
- [ ] **Deferred-to-visual-refinement** — Refine final brand expression of
  shell typography, surfaces, icon treatment, and navigation density without
  changing capability logic.

## Registers and intelligence workspaces

- [x] **Pass** — Standard Register remains the common structural contract for
  operational lists: filters, saved views, sorting, columns, density,
  pagination, preview context, and semantic mobile rows.
- [x] **Pass** — Inc 4 Sources, Territories, Documents, Tasks, and
  Notifications retain their `pages/*` route modules while composing the
  shared register system.
- [x] **Pass** — Product, Brand, Buyer, Placement, commercial, Commission,
  Dispute, Search, and Operations lists retain their domain-specific truth
  rather than becoming generic entities.
- [ ] **Validate-in-suite** — Exercise populated, loading, empty, filtered
  no-result, restricted/read-only, and recoverable-error paths where each
  register supports them.
- [ ] **Validate-in-suite** — Verify desktop/tablet tables and mobile
  structured rows show the same permitted records, actions, status, and
  recovery options.
- [ ] **Deferred-to-visual-refinement** — Tune visual hierarchy and density
  only after structural state parity is confirmed.

## Relationship details and consequential reviews

- [x] **Pass** — Relationship details preserve identity, trail, tabs, next
  action, activity, evidence, and contextual blockers.
- [x] **Pass** — Desktop Context Rail reflows at tablet and becomes a
  focus-managed mobile context drawer; mobile primary actions remain reachable.
- [x] **Pass** — Consequential reviews present readiness, exact artifact,
  validation, evidence/authority, explicit human decision, confirmation, and
  audit outcome in reading order.
- [x] **Pass** — Protected Account detail is canonically owned by
  `redesign/commerce/ProtectedAccountDetail.tsx` after Increment 17; proposal,
  current digest, approval, and audit are not conflated.
- [ ] **Validate-in-suite** — Exercise stale-version, duplicate-submission,
  server rejection, read-only, completed-decision, and retry/reload flows for
  each consequential route.
- [ ] **Validate-in-suite** — Confirm Account, protection, Order, Reorder,
  Commission, Agreement, Placement, and Outreach links do not imply authority,
  eligibility, payment, or approval not supplied by the server.

## Responsive behavior

- [x] **Pass** — Structural breakpoints remain token-driven at `64rem` and
  `48rem`; mobile registers use semantic rows rather than document-wide
  horizontal scrolling.
- [x] **Pass** — No `overflow-x: hidden` declaration was found in the web
  source; bounded table/code regions use intentional `overflow-x: auto`.
- [x] **Pass** — Existing CSS tokens and token-only implementation conventions
  remain retained.
- [ ] **Validate-in-suite** — At every required viewport, assert
  `scrollWidth === clientWidth` where document overflow is not intentional and
  inspect visible control rectangles against the visual viewport.
- [ ] **Validate-in-suite** — Verify no clipped action, focus target, dialog,
  drawer, rail, mobile bottom-navigation cell, or sticky action at 320 px.

## Accessibility and state truthfulness

- [x] **Pass** — Skip link, landmarks, named navigation, headings, table
  captions, explicit control names, and visible focus remain structural
  requirements.
- [x] **Pass** — Tabs, drawers, dialogs, and mobile sheets retain keyboard,
  focus containment, Escape, inert background, scroll-lock, and trigger-focus
  restoration behavior as applicable.
- [x] **Pass** — State meaning does not depend on color alone; unknown,
  stale, partial, restricted, proposed, approved, paid, and completed remain
  distinguishable.
- [ ] **Validate-in-suite** — Run automated accessibility checks and manual
  keyboard/screen-reader smoke tests for shell, register, detail, and review
  representatives.
- [ ] **Validate-in-suite** — Test reduced motion, 200% zoom, chart/table
  alternatives, table sort semantics, live alerts, error focus, and dialog
  initial focus.
- [ ] **Validate-in-suite** — Confirm empty is not rendered as no-result,
  provider degradation is not rendered as zero, and recoverable failures
  preserve permitted input and retry context.

## Cross-route continuity, performance, and races

- [x] **Pass** — Existing routes and valid deep links remain the boundary;
  reports stay under `/analytics?view=reports`, and no detail routes are
  invented for Reorders, payouts, statements, or transfer jobs.
- [x] **Pass** — RecordsPage remains the compatibility adapter for legacy
  generic paths; Copilot and Login are intentionally legacy surfaces.
- [x] **Pass** — Server authority, workspace isolation, capabilities, CSRF,
  audit behavior, exact artifacts, and domain validators remain authoritative.
- [ ] **Validate-in-suite** — Run route-transition and back/forward checks
  across shell links, compatibility paths, contextual links, and query-view
  navigation without stale content flashes.
- [ ] **Validate-in-suite** — Simulate slow, failed, superseded, and
  out-of-order requests; ensure stale responses cannot overwrite newer route,
  filter, review-version, or submission state.
- [ ] **Validate-in-suite** — Check rapid dialog/drawer open-close, repeated
  submit, retry, route-unmount, and session-restriction transitions for focus,
  pending-control, and memory-leak regressions.
- [ ] **Validate-in-suite** — Run lint, typecheck, unit, integration, full
  browser, build, token, markdown-whitespace, and diff checks; record exact
  counts only in `IMPLEMENTATION_LEDGER.md`.
- [ ] **Deferred-to-visual-refinement** — Perform final brand beautification
  as a separate Claude pass after structural and behavioral validation is
  complete.
