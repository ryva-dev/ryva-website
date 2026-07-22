# UI Redesign Increment 16 — Analytics, Transfer, Settings, and Operations

**Status:** Structurally complete; validation results remain in the ledger.

**Date:** 2026-07-22

**Scope boundary:** Existing routes only. This increment migrates `/analytics`
(including `?view=reports` and `?view=definitions`), `/imports`, `/exports`,
`/settings`, `/admin`, `/access`, `/certification`, `/subscription`,
`/subscription/activate`, `/profile`, and `/search`.

## Route and ownership boundaries

No separate Reports register, transfer-job register, or membership/role-admin
pages were created because those routes do not exist. Founder decision: Reports
remain under `/analytics?view=reports`.

Home remains owned by Increment 7. Sources, Territories, Documents, Tasks, and
Notifications remain owned by Increment 4. Copilot is untouched.

## Analytics and reports

`/analytics` is an Analytical Workspace with Tabs, FilterBar, DateRangePicker,
metrics, and tables. Its Reports and Definitions views stay in the same
workspace.

- Monetary values remain separated by currency.
- Partial data is labeled as partial; unavailable is not shown as zero.
- Forecasts use `ForecastRange` for user-entered values only.
- External sources show `Not Connected`; no external metric is fabricated.
- Saved reports use in-page `GET`/`POST /api/analytics/reports`.
- CSV export uses `/api/analytics/export`.
- No report-generation queue is invented.

## Import, export, and operations

`/imports` uses `ImportReviewPage`: staged preview, Consequential Review,
ConfirmationDialog, and digest approval. Existing import mapping is unchanged.

`/exports` uses `ExportReviewPage` with Consequential Review and
ConfirmationDialog. It distinguishes queued, ready, and downloaded states.
Export generation and import approval are consequential actions.

There is no separate data-transfer job register; jobs live in Admin Operations.
`/admin` provides System status, AI, Jobs, and Audit tabs. Operations exposes
only `lastErrorSafe`; Audit is a Recent audit events list. Job retry uses a
ConfirmationDialog.

## Settings, access, and integrations

`/settings` uses section Tabs for Preferences, AI, Sessions, and Closure.
Profile, Access, Certification, and Subscription remain separate routes.

No dedicated membership or role-management UI exists. Access displays the
session mode and reason, while capabilities gate writes. Admin shows provider
status only; it does not provide live provider connection.

Session revocation, account closure, the AI kill switch, and job retry are
destructive or consequential actions and require ConfirmationDialog.

## Shared implementation standards

The migrated screens reuse design-system and consequential components. Responsive
behavior uses the `64rem` and `48rem` tokens and never `overflow-x: hidden`.
Landmarks, table captions, and exact dialogs are provided. Charts have
table-based alternatives.

Unit coverage expanded to include analytics, transfer, settings, admin, and
search contracts. Focused Increment 16 / Analytics / Operations desktop: 12
passed. Focused Increment 16 mobile: 7 passed, 1 intentional skip. Complete
Playwright suite twice: 198 passed, 28 intentional skips each run. See
`IMPLEMENTATION_LEDGER.md` for the full validation record.

## Screenshots

Screenshot paths are under `docs/ui-redesign-spec/screenshots/increment-16/`.

## Limitations and deferrals

- No separate report-detail route.
- No membership administration.
- No import mapping beyond existing behavior.
- No live provider connections.
- No fabricated metrics.
- Increment 17 owns whole-product responsive, accessibility, and visual
  consistency consolidation.
- Final brand and visual refinement is deferred to Increment 17.

Increment 17 has not started. This document records implementation scope and
does not claim any pending agent work is committed.
