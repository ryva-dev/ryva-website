# UI Redesign Increment 13 — Outreach Center

**Status:** Structurally complete

**Date:** 2026-07-22

**Scope boundary:** Outreach workspace, Templates, Sequences, exact-artifact
detail, and call logging only. Accounts, Orders, Reorders, and Protection
(Increment 14) were not started. Final whole-product visual refinement remains
deferred.

## Delivered pattern

Increment 13 migrates the Outreach Center into approved structural patterns:

- **Communication workspace / Standard Register** for `/outreach` with history,
  prepare draft, call logging, message register, filters, saved views, density,
  and mobile semantic rows;
- **Standard Relationship Detail** for `/outreach/:id`;
- **Consequential Review** for exact-artifact approval, queue, and manual social
  confirmation;
- **Library pages** for `/outreach/templates` and `/outreach/sequences` that
  preserve Phase 5 create contracts while distinguishing reusable content from
  exact Outreach artifacts.

Module lives in `apps/web/src/redesign/outreach/` and reuses Increments 1–12
foundations. Legacy `apps/web/src/pages/OutreachPages.tsx` remains unwired.

## Routes migrated

| Route | Pattern | Notes |
|---|---|---|
| `/outreach` | Communication workspace + message register | Honors `?placementId=`; history + prepare + call + messages |
| `/outreach/:id` | Relationship Detail + Consequential Review | Exact message, Contact/permission, Placement, approval/send, activity, response |
| `/outreach/templates` | Library + create form | Template ≠ exact approved message |
| `/outreach/sequences` | Library + create form | Sequence ≠ auto-send; schedules reviewable work only |

## Outreach workspace structure

Desktop preserves operational density with history and prepare side-by-side,
then call logging and a Standard Register message table. Mobile uses semantic
rows for messages and keeps prepare, call, and review actions accessible.

The workspace surfaces Buyer/Contact, channel, status, Placement context,
permission/suppression honesty, and next permitted human action without
exposing every field or inventing engagement analytics.

## Relationship Detail and Consequential Review

Detail tabs distinguish exact message content, Contact permission/verification,
Placement/Product/Brand context, approval versus send, activity, and response
classification. Consequential review uses ExactArtifact, ValidationSummary,
ApprovalPanel, ConfirmationDialog, digest/version, optimistic concurrency, and
duplicate-submission prevention.

## Permission, verification, suppression, and channel handling

The UI keeps these states distinct and text-labeled:

- verification vs permission;
- address present vs Outreach allowed;
- Placement readiness vs Outreach approval;
- approved vs queued vs delivered;
- reply classification vs Order/commercial outcome;
- unknown vs allowed.

Server validators, suppression rules, channel rules, and audit behavior are
unchanged. No external send capability was added beyond existing queue and
manual social confirmation flows.

## Template and sequence treatment

Templates and sequences remain in scope and were migrated structurally.
Templates never carry approval. Sequences schedule human review work and never
auto-send. No fabricated performance statistics were added.

## Follow-up behavior

Existing call logging and response-classification next-action fields are
preserved. No unsupported automatic follow-up sending was added. Eligibility is
not inferred from elapsed time alone.

## Placement, Representation, and authority boundaries

Placement may be linked and preselected via query string. Authority evaluation
uses existing `prepare_outreach` / `approve_outreach` / `send_outreach` actions.
Placement stage and Representation authority never auto-approve or send.

## Commercial boundary

Accounts, Orders, Reorders, and Protection routes remain unchanged. A reply or
sent message does not invent commercial success. Increment 14 was not started.

## Responsive and accessibility

Token breakpoints at `64rem` / `48rem`, no `overflow-x: hidden` workarounds,
Context Rail / drawer, sticky mobile actions, keyboard tabs, Escape/focus
restoration via shared overlays, and status meaning independent of color alone.

## Validation results

- `npm run lint:tokens`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:unit`: 71 passed, including 6 Outreach contracts.
- `npm run test:integration`: 62 passed against PostgreSQL.
- Focused Outreach Playwright: 19 passed, 3 intentional skips.
- Complete `npm run test:e2e` run 1: 158 passed, 0 failed, 24 intentional skips.
- Complete `npm run test:e2e` run 2: 158 passed, 0 failed, 24 intentional skips.
- `npm run build`: passed.
- `git diff --check`: passed.

## Screenshots

Captured under `docs/ui-redesign-spec/screenshots/increment-13/`:

- `outreach-workspace-populated-desktop-1440x900.png`
- `outreach-workspace-mobile-390x844.png`
- `outreach-workspace-no-result-desktop-1440x900.png`
- `outreach-workspace-restricted-desktop-1440x900.png`
- `outreach-detail-populated-desktop-1440x900.png`
- `outreach-detail-populated-mobile-390x844.png`
- `outreach-detail-permission-desktop-1440x900.png`
- `outreach-detail-placement-desktop-1440x900.png`
- `outreach-detail-exact-message-desktop-1440x900.png`
- `outreach-detail-activity-desktop-1440x900.png`
- `outreach-review-valid-desktop-1440x900.png`
- `outreach-review-permission-blocker-desktop-1440x900.png`
- `outreach-review-placeholder-blocker-desktop-1440x900.png`
- `outreach-review-completed-audit-desktop-1440x900.png`
- `outreach-review-mobile-390x844.png`
- `outreach-templates-desktop-1440x900.png`
- `outreach-sequences-desktop-1440x900.png`

## Intentionally deferred

- Increment 14 Accounts, Orders, Reorders, and Protection.
- Final whole-product visual and brand refinement.
- Removal of unused legacy `OutreachPages.tsx` after caller proof.
- Stale/conflict screenshot when not safely reproducible in seeded flows.
- Full communication-workspace conversation list redesign beyond the approved
  register + history + prepare split that preserves Phase 5 workflows.

No schema, migration, API contract, permission rule, suppression rule, channel
rule, or audit behavior change was authorized for this increment.
