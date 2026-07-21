# UI Redesign Increment 7 — Home Command Center

**Status:** Structurally complete

**Date:** 2026-07-21

**Scope boundary:** `/` Home route only. Command Center pattern migration with
existing Home APIs, priority logic, currency separation, AI degradation, and
honest empty states preserved.

## Delivered pattern

Increment 7 migrates Home into the approved Command Center composition:

- compact greeting, access/freshness line, and primary next action;
- distinct **Today** commitments using the existing `today` field;
- **Material changes** as a compact `ActivityTimeline`;
- ordered **Priority queue** with expandable rule explanations;
- pipeline **exceptions** in a supporting rail when non-zero counts exist;
- **Currency-separated commercial continuity** using `CurrencyValue`;
- visually subordinate **AI briefing** through `AIRecommendation`; and
- stable loading, empty, error, read-only, and AI-unavailable states.

The shared additions are `CommandCenter`, `CommandCenterBriefing`, and
`home.css`. They compose Increment 1 tokens, Increment 2 controls and data
display, Increment 3 shell, and Increment 5 `RelationshipSection`,
`ContextRail`, and `StickyMobileAction`.

## Route and preserved behavior

| Route | Behavior | Preserved server truth |
|---|---|---|
| `/` | Command Center for priorities, changes, pipeline exceptions, commercial summaries, and AI briefing entry | `GET /api/home-command-center`, `POST /api/home/acknowledge`, `POST /api/home/priorities/:itemType/:itemId/actions`, `GET /api/ai/status`, `POST /api/ai/generate` |

No schema, migration, route, payload, permission, capability, validator, audit,
AI policy, or commerce-domain change was authorized for this increment.

## Functional boundaries preserved

- Priority ordering, explanations, blocking behavior, and manual reprioritization
  remain server-owned.
- Currency totals remain separated by ISO currency; no cross-currency
  aggregation was introduced.
- AI briefing remains optional and visibly degraded when the provider or
  workspace preference is unavailable.
- Empty workspaces explain first setup actions without fabricated zeros or
  activity.
- Read-only sessions retain inspection of permitted priorities and summaries
  while disabling acknowledge, snooze, dismiss, complete, and reprioritize
  actions.

## Responsive and accessibility behavior

- Desktop uses a reading-width primary column with a 320 px exception rail when
  pipeline blockers exist.
- Tablet reflows the rail into the main column; mobile prioritizes Today,
  changes, and the highest-priority action with a sticky permitted next action
  above shell bottom navigation.
- Priority reasons use expandable `<details>`; queues use ordered lists; change
  entries use descriptive links; currency values expose explicit amount labels.
- No live region announces passive refresh; acknowledge and retry remain explicit
  user actions.

## Validation results

- `npm run lint`: passed, including the token-only redesign policy.
- `npm run typecheck`: passed for strict server and web projects.
- `npm run test:unit`: 38 passed, including 4 Command Center contracts.
- `npm run test:integration`: 62 passed against PostgreSQL.
- Focused Home Playwright: 10 passed with 2 intentional duplicate-project
  skips, covering populated and empty states, expandable reasons, read-only
  access, API recovery, AI degradation, and mobile sticky action geometry.
- Complete `npm run test:e2e`: 80 passed with 12 intentional duplicate-project
  skips across desktop and mobile Chromium.
- `npm run build`: passed; Vite transformed 94 modules and emitted the
  production client/server build. The existing bundle-size advisory remains.

## Screenshots

Captured from the authenticated synthetic application:

- [Populated desktop Command Center](screenshots/increment-7/home-populated-desktop-1440x900.png)
- [Populated mobile Command Center](screenshots/increment-7/home-populated-mobile-390x844.png)
- [Empty workspace](screenshots/increment-7/home-empty-desktop-1440x900.png)
- [API error recovery](screenshots/increment-7/home-error-desktop-1440x900.png)
- [Read-only session](screenshots/increment-7/home-restricted-desktop-1440x900.png)
- [AI degraded briefing](screenshots/increment-7/home-ai-degraded-desktop-1440x900.png)

## Intentionally deferred

- Final Ryva brand-level visual refinement remains deferred until all structural
  increments are complete.
- Product Intelligence and later domain migrations remain in Increments 8–16.
- EvidenceDrawer support for priority supporting evidence remains deferred until
  a later workflow increment requires it on Home.

Increment 8 has not started.
