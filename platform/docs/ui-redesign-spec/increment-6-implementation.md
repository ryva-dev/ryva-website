# UI Redesign Increment 6 — Consequential Review

**Status:** Structurally complete

**Date:** 2026-07-21

**Scope boundary:** Reusable Consequential Review composition, with the AI
Suggestion pilot at `/copilot/:suggestionId` and the Protected Account pilot at
`/protected-accounts/:id` only.

## Delivered pattern

Increment 6 establishes a consistent review model for decisions whose
consequences, evidence, version, authority, and human ownership must remain
explicit. The reusable composition connects:

- stable review identity and the affected record or relationship;
- a readiness and blocker summary that appears before the artifact in semantic
  and responsive reading order;
- the exact stored artifact or proposed scope, including its current version or
  digest;
- authored validation results that distinguish pass, failure, and required
  human review without relying on color;
- evidence, provenance, risk, and authority context;
- an `ApprovalPanel` with no preselected outcome, required rationale, and the
  exact consequence of each API-supported decision;
- a focus-managed `ConfirmationDialog` before a consequential submission; and
- completed outcomes and append-only audit history.

The shared additions are `ConsequentialReviewLayout`, `ReadinessSummary`,
`ValidationSummary`, `ExactArtifact`, `ReviewSection`, `ReviewOutcome`,
`ReviewErrorSummary`, `ConfirmationDialog`, `AuditEntry`, and `AuditHistory`.
They compose existing Increment 2 controls, evidence and authority indicators,
Drawers, the Increment 3 shell, and server-issued access capabilities.

## AI Suggestion pilot

`/copilot/:suggestionId` now presents the current stored suggestion content and
version as the exact review artifact. It exposes the stored suggestion type,
target reference, provider/model/policy provenance, material statements,
classification, confidence subject, citations, source freshness and
limitations, missing evidence, contrary evidence, field-extraction candidates,
and immutable disposition history where available.

The existing API permits accepted, edited, rejected, feedback, problem, and
regeneration actions. The page retains those actions without broadening them:

- accepting records review of the exact stored artifact only;
- editing submits the exact human revision displayed in the decision control;
- rejecting records deliberate non-use;
- feedback and problem reports remain separate from disposition;
- regeneration creates a child suggestion rather than overwriting the reviewed
  artifact; and
- no disposition executes the suggestion or changes the target record.

AI does not approve itself, establish authority, send, negotiate, qualify,
score, or create a hidden downstream action. Missing evidence remains Unknown,
not negative evidence.

## Protected Account pilot

`/protected-accounts/:id` now separates account identity, proposed documentary
scope, active protection, Agreement reference, current validation readiness,
human approval, and audit outcome. The exact scope shows stored products,
channels, territory, term, commission/reorder terms, exclusions, release terms,
source document, version, and rights-artifact digest.

A proposal remains a review record only. Requesting approval runs the existing
server checks and creates no protection. A human may then approve, reject, or
require changes using the existing approval-decision endpoint. Only a
server-confirmed approval of the current exact digest can activate documentary
protection. The page never treats the Account relationship, governing Agreement
reference, visible validator result, or proposal itself as representation or
protection authority.

## Concurrency, recovery, and access

- AI decisions submit the loaded suggestion version. A `409` announces that
  the record changed, retains the exact revision and rationale, focuses the
  error, and requires a reload/reconciliation before retry.
- Protected Account decisions remain bound to the approval ID returned by the
  current request and the server-computed rights-artifact digest. Existing
  overlap, clean-document, scope, and approval-state checks remain
  authoritative.
- Both pilots disable pending submissions and use an in-memory submission guard
  so a double activation produces one request.
- Recoverable validation failures preserve review selections and entered text;
  server failures are never rendered as success.
- Read-only sessions retain permitted inspection while all mutation controls
  are disabled or withheld according to the server-issued access decision.
- Completed decisions remain inspectable and cannot be resubmitted.

No schema, migration, endpoint, payload, route, capability, permission,
workspace-isolation rule, audit behavior, AI policy, authority rule, validator,
or business-domain contract changed.

## Responsive and accessibility behavior

Wide screens use a connected primary review region with a 320 px readiness
rail. At tablet and mobile widths the rail moves ahead of the exact artifact so
blockers and authority context are encountered before decision controls. Long
versions and artifacts wrap or use a bounded internal code region without
creating document-level overflow. Decision controls remain in normal reading
order above the safe-area-aware bottom navigation.

The pilots retain one level-one identity, semantic navigation and sections,
authored validation labels, ordered audit events, named regions for exact
artifacts, explicit fieldset/legend decision controls, live and focusable error
summaries, and touch-sized actions. Drawers and the new alert dialog trap focus,
close with Escape when safe, restore the trigger, inert the background, lock
body scrolling, and honor reduced motion. The destructive/consequential dialog
initially focuses Cancel and states the exact consequence before submission.

Automated geometry checks at 1440 × 900, 1024 × 768, 390 × 844, 375 × 812,
and 320 × 568 found no document-level horizontal overflow or visible viewport
offenders on either pilot. Authenticated in-app inspection confirmed the real
seeded AI review’s semantic order and user-visible authority boundaries without
console or page errors.

## Validation evidence

- `npm run lint`: passed, including the design-token policy.
- `npm run typecheck`: passed for strict server and web projects.
- `npm run test:unit`: 34 passed; 3 cover Consequential Review contracts.
- `npm run test:integration`: 62 passed against PostgreSQL.
- Focused Consequential Review Playwright: 9 passed with 5 intentional
  duplicate-project skips across desktop and mobile Chromium.
- Complete `npm run test:e2e`: 70 passed with 10 intentional
  duplicate-project skips across desktop and mobile Chromium.
- `npm run build`: passed; Vite transformed 92 modules and emitted the
  production client/server build. The existing large client-chunk advisory
  remains non-blocking.
- Console/page-error and exact geometry assertions passed for both pilots at
  every approved viewport.

## Review captures

- [AI populated desktop review](screenshots/increment-6/ai-suggestion-populated-desktop-1440x900.png)
- [AI validation, blocker, and evidence state](screenshots/increment-6/ai-suggestion-validation-blocker-evidence-desktop-1440x900.png)
- [AI completed audit state](screenshots/increment-6/ai-suggestion-completed-audit-desktop-1440x900.png)
- [AI mobile review](screenshots/increment-6/ai-suggestion-mobile-390x844.png)
- [AI error state](screenshots/increment-6/ai-suggestion-error-desktop-1440x900.png)
- [Protected Account proposed desktop review](screenshots/increment-6/protected-account-proposed-desktop-1440x900.png)
- [Protected Account proposed mobile review](screenshots/increment-6/protected-account-proposed-mobile-390x844.png)
- [Protected Account completed audit state](screenshots/increment-6/protected-account-completed-audit-desktop-1440x900.png)

The capture command is
`CAPTURE_INCREMENT_6_SCREENSHOTS=1 npm run test:e2e -- tests/e2e/consequential.spec.ts`.
All captures use synthetic test-only records in the authenticated application;
none is represented as external or live commercial intelligence.

## Increment boundary and deferred work

This increment pilots the reusable pattern on two routes only. Agreement,
Placement, Outreach, Import, Order, broader Protection, Commission, and Dispute
workflow migrations remain assigned to later documented increments. The
existing Protected Account detail contract returns a decision reference only
when the current browser session requests approval; the UI does not infer that
a historical approval reference is current after reload. A richer persisted
resume experience would require an explicitly documented API contract in the
later Protection migration.

The current styling is a structurally accepted expression, not final Ryva brand
art direction. Whole-product UI/UX refinement remains intentionally deferred
until every documented structural increment is complete. That pass may refine
typography, color, controls, spacing, surfaces, review density, drawers,
dialogs, and overall visual cohesion while preserving the behavior, evidence,
authority, responsiveness, and accessibility established here.

No material founder decision was required. Increment 7 was not started.
