# UI Redesign Increment 12 — Placement CRM and Detail

**Status:** Structurally complete

**Date:** 2026-07-21

**Scope boundary:** Placement register/pipeline and Placement detail with
consequential stage review only. Outreach Center (Increment 13) and commercial
Accounts/Orders (Increment 14) were not started.

## Delivered pattern

Increment 12 migrates Placement CRM into approved structural patterns:

- **Standard Register / Pipeline** for `/placements` with Table and Kanban
  views, filters, saved views, density, and create drawer;
- **stage-grouped mobile list** (no horizontal Kanban on narrow viewports);
- **Standard Relationship Detail** for `/placements/:id`;
- **Consequential Review** for human-confirmed stage transitions.

Module lives in `apps/web/src/redesign/placement/` and reuses Increments 1–11
foundations.

## Routes migrated

| Route | Pattern | Notes |
|---|---|---|
| `/placements` | Pipeline / Standard Register | Table ↔ Kanban; create drawer; mobile stage groups |
| `/placements/:id` | Relationship Detail + stage Consequential Review | Overview, Fit, Authority, Stage review, Activity, Outreach link, Commercial link |

## Pipeline and view behavior

Desktop supports Table and Kanban switching. Kanban drag or keyboard stage
select opens `/placements/:id?toStage=…#stage-review` — the board never treats
drag completion as success. The server must accept the transition.

Mobile hides Table/Kanban and shows stage-grouped semantic rows.

## Relationship Detail and Consequential Review

Detail tabs distinguish Placement identity, Product/Brand/Business links, fit
and Relationship Triangle, Representation/Agreement authority evaluation,
stage progression, activity, Outreach entry point, and commercial route links.

Stage review uses ConsequentialReviewLayout, ExactArtifact, ValidationSummary,
ApprovalPanel, and ConfirmationDialog. Version conflicts surface via
ApiProblem 409 with input preservation.

## Authority handling

Authority comes from `POST /api/authority/evaluate` with action
`placement_stage`. Placement stage never creates Representation authority.
Agreement scope is linked for inspection. Stalled is a server flag, not a stage.

## Outreach and commercial boundaries

- Outreach: existing `/outreach?placementId=` link only; no templates/sequences.
- Commercial: links to existing `/orders` and `/accounts` only; no Order metrics.

## Validation results

- `npm run lint:tokens`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:unit`: 65 passed, including 4 Placement contracts.
- `npm run test:integration`: 62 passed against PostgreSQL.
- Focused Placement + phase4 Playwright: 17 passed, 3 intentional skips.
- Complete `npm run test:e2e` run 1: 145 passed, 0 failed, 21 intentional skips.
- Complete `npm run test:e2e` run 2: 145 passed, 0 failed, 21 intentional skips.
- `npm run build`: passed.
- `git diff --check`: passed.

## Screenshots

Captured under `docs/ui-redesign-spec/screenshots/increment-12/`:

- `placement-register-table-desktop-1440x900.png`
- `placement-register-kanban-desktop-1440x900.png`
- `placement-register-mobile-stage-grouped-390x844.png`
- `placement-register-empty-desktop-1440x900.png`
- `placement-register-restricted-desktop-1440x900.png`
- `placement-detail-populated-desktop-1440x900.png`
- `placement-detail-populated-mobile-390x844.png`
- `placement-detail-authority-desktop-1440x900.png`
- `placement-detail-activity-desktop-1440x900.png`
- `placement-transition-review-desktop-1440x900.png`
- `placement-transition-review-mobile-390x844.png`
- `placement-transition-blocker-desktop-1440x900.png`
- `placement-transition-completed-audit-desktop-1440x900.png`

## Intentionally deferred

- Increment 13 Outreach Center.
- Increment 14 Accounts, Orders, Reorders, and Protection.
- Final whole-product visual and brand refinement.
- Removal of unused legacy `PlacementPages.tsx` after caller proof.

No schema, migration, API contract, stage rule, authority calculation, or
audit behavior change was authorized for this increment.
