# Build Sequence

## Delivery position

Build the complete first production version as a modular monolith. The sequence below is incremental, but each increment becomes part of the final product; none is a disposable prototype. A vertical slice is released internally only after its authorization, audit, error, empty, and responsive states are present.

## Working method

- Maintain one product backlog traced to this specification and acceptance IDs.
- Ship database migrations forward-only with tested recovery procedures.
- Put all consequential business rules in server-side domain services, not only UI guards.
- Establish design-system primitives and record-page patterns once, then reuse them.
- Use feature flags for incomplete internal work, never to weaken authority or audit controls.
- Test provider adapters with fakes before sandbox integrations.
- Seed only clearly synthetic demonstration data.
- Review every phase against The Ryva Standard and the five foundational frameworks.

## Phase 0 — Founder sign-off and delivery baseline

**Deliver**

- Resolve or explicitly accept the eight [Founder decisions](founder-decisions/README.md).
- Confirm supported browsers, deployment environment, transactional email provider, object storage, certification authority, subscription products, privacy terms, retention schedule owner, and initial support process.
- Turn `acceptance-tests.md` into the release traceability suite.
- Inventory reusable historical code without restoring obsolete application behavior by default.
- Create threat model, data classification, backup/recovery targets, error budget, and observability baseline.

**Gate**

- No implementation begins with an unresolved decision that changes schema ownership, legal rights, credential access, or financial calculations.
- The Founder approves architecture and Phase 1 scope.

## Phase 1 — Platform foundation and secure access

**Deliver**

- TypeScript monorepo/module boundaries, linting, tests, CI, migration runner, environment validation.
- React/Vite application shell and Express API.
- PostgreSQL connection, transaction helpers, typed repositories, identifiers, timestamps, optimistic concurrency.
- Workspace, User, Membership, Certification Credential, Subscription Entitlement, session, roles, and policy enforcement.
- Login, certification access check, subscription activation, certification status, subscription, profile, and settings shells.
- Append-only Audit Event service, correlation IDs, structured logs, safe errors, rate limits, CSRF/security headers.
- Background-job table/worker with leases, retry, dead-letter state, idempotency, and admin visibility.

**Gate**

- ACC-001 through ACC-010 and applicable QLT tests pass.
- Cross-workspace and revoked-session tests pass at API and browser layers.
- Backup/restore and migration drills succeed.

## Phase 2 — Connected record kernel

**Deliver**

- Core Brand, Product, Business Buyer, Contact, Source, Evidence Record, Risk Flag, Decision Record, Human Approval, Note, Activity, Task, Document, Territory, Saved View, and Notification entities.
- Record ownership, relationships, validation, history, file metadata/storage, and evidence provenance.
- Reusable record header, relationship panel, timeline, task panel, evidence drawer, risk panel, decision panel, filters, table/card/list views, responsive shell.
- Global search using PostgreSQL full-text/trigram indexes with authorization applied before results.
- Import preview/validation and duplicate candidate services for initial entities.

**Gate**

- Evidence can never be upgraded silently.
- Timeline and audit are materially complete.
- Search, import, duplicate suggestions, empty states, keyboard navigation, and responsive record layouts pass.

## Phase 3 — Product, Brand, and Buyer Intelligence

**Deliver**

- Product Intelligence views: Discover, Watchlist, Under Review, Qualified, Rejected, Represented, Recently Updated.
- Product detail, comparison, evidence qualification, notes, monitoring metadata, and buyer-category recommendations.
- Brand Intelligence detail and complete representation pipeline before agreement authorization.
- Business and Buyer Intelligence search, saved lists, geography-ready list filters, qualification, contact verification state, and product–business match review.
- No map vendor in the initial build unless geographic list filtering proves insufficient; preserve coordinates/address model for later.
- Data freshness and source adapters behind explicit provider interfaces; legally/technically unavailable TikTok indicators remain absent/unknown.

**Gate**

- Journeys 01, 02, and 04 pass.
- Classification, unknown, unsupported-claim, and Human Judgment behavior is usable without opening framework source documents.
- No numerical Product Score or false source certainty appears.

## Phase 4 — Representation authority and Placement CRM

**Deliver**

- Representation Opportunity and Representation Agreement, scope, Product/channel/territory/dates, documents, extraction review, agreement status, end/pause behavior.
- Placement Opportunity, Product/contact junctions, Placement Stage events, required-field rules, conflict checks, Relationship Triangle and Decision Review.
- Kanban, table, timeline, calendar, saved views, stage confirmation, stalled logic, loss/disqualification, reopening.
- Server-side authority validator shared by stage, approval, and send paths.
- Home first useful version: owned next actions, overdue work, stalled records, evidence/authority risks, and recent changes.

**Gate**

- Journeys 03 and 05 pass.
- PLC-001 through PLC-010 pass.
- No buyer outreach path can bypass agreement scope or conflict enforcement.

## Phase 5 — Outreach Center

**Deliver**

- Email drafts, templates, sequences, social-message drafts, call workspace/logging, voicemail scripts, notes, tasks, unified activity, reply/opt-out state.
- Exact-artifact Human Approval with invalidation on material change.
- Provider adapter, webhook verification, send idempotency, bounce/reply/opt-out processing, quiet/scheduling rules, compliance safeguards.
- Follow-up automation and user-visible suppression/retry states.
- Mobile call logging, notes, task completion, buyer lookup, and safe stage update.

**Gate**

- Journeys 06–09 and OUT-001 through OUT-009 pass.
- A chaos/replay test demonstrates no duplicate send.
- An unavailable provider leaves a clear, recoverable state.

## Phase 6 — Accounts, orders, reorders, and commissions

**Deliver**

- Protected Account as an agreement-derived, human-approved rights record; Account operational record; conflict lifecycle and expiry.
- Orders and line items, documents, corrections, statuses, payment state.
- Decimal-based Commission calculation/versioning with visible formula and source basis.
- Commission status lifecycle, verification, approvals, due/paid state, cancellation/clawback.
- Reorders, reorder windows, account health observations, reminders, and links to protection and commissions.
- Commission Disputes with chronology, documents, resolution, and immutable calculation history.
- Relationship-ending workflow that preserves surviving rights and obligations.

**Gate**

- Journeys 10–15 and COM-001 through COM-011 pass.
- Financial fixtures reconcile exactly and remain explainable after corrections.
- Account/protection claims never arise solely from a system event.

## Phase 7 — AI assistance layer

**Deliver**

- Provider-neutral AI service with approved use cases, policy checks, source packaging, structured outputs, run history, cost/latency telemetry, and failure isolation.
- AI Suggestion UI: inspect sources, accept, edit, reject, regenerate, feedback, approval status, edit history.
- Research summaries, match suggestions, draft personalization, call preparation, objection/follow-up suggestions, pipeline summary, stalled/missing-data detection, extraction, priorities, duplicate/enrichment suggestions.
- Prompt-injection defenses, data minimization, model/provider retention configuration, evaluation fixtures, and red-team tests.
- Manual workflow remains available for every feature.

**Gate**

- AI-001 through AI-007 pass.
- Evaluation demonstrates classifications and citations remain visible and unsupported claims are surfaced.
- No AI path sends, negotiates, approves agreements, creates rights, or makes final consequential decisions.

## Phase 8 — Analytics, Home completion, and notifications

**Deliver**

- Representative, Product, Brand, and Portfolio dashboards with metric dictionary, filters, currency-safe display, drill-down, and freshness.
- Home command center: priority queue, changes, overdue follow-ups, stalled Opportunities, Product/Brand review, reorder candidates, commissions, risks, onboarding state.
- In-app and permitted email notifications, preferences, deduplication, digest, mark/read/archive behavior.
- Forecast ranges and explicitly user-entered qualitative likelihood only; no system weighted pipeline until validated.
- Exportable reports where permitted.

**Gate**

- Analytics reconcile to source records in fixture and sampled production-like datasets.
- Every metric is explainable and drillable.
- Home prioritization never hides the reason or impersonates a final human decision.

## Phase 9 — Data portability, administration, and operational hardening

**Deliver**

- Complete CSV imports for Contacts, Products, Buyers, Brands, Opportunities, Accounts as allowed; row-level reports, safe upsert, duplicate review/merge.
- Complete export scope, asynchronous generation, signed expiry, audit, deletion.
- Admin areas for credential/subscription state review, job failures, provider status, support grants, audit lookup, feature configuration, and policy-safe correction—not routine access to Representative content.
- Retention/deletion jobs after specialist-approved exact schedule.
- Performance tuning, indexes, pagination, rate/budget protection, alerts, runbooks, incident and recovery procedures.
- Accessibility, browser/device, security, privacy, load, recovery, and migration validation.

**Gate**

- DAT and QLT suites pass.
- Least-privilege review and production threat-model review have no unresolved critical issue.
- Founder approves operational readiness.

## Phase 10 — Controlled production launch

**Deliver**

- Internal seed accounts, then a small cohort of eligible certified Representatives.
- Guided migration/import, support escalation, metric verification, feedback capture.
- Observe access denials, send suppressions, duplicate/merge errors, job failures, provider responses, commission corrections, and user confusion.
- Fix release-blocking issues before cohort expansion.
- Publish only claims supported by actual production evidence; do not rely on pilot results as public proof.

**Launch gate**

- [Acceptance exit criteria](acceptance-tests.md#exit-criteria) pass.
- Privacy, terms, retention, support, billing, credential, and incident processes are live.
- The Founder approves general availability based on evidence, not calendar pressure.

## Parallel work that does not change dependencies

- Content design and synthetic fixtures can progress alongside Phases 1–3.
- Provider evaluation can progress alongside core domain work, but provider integration cannot bypass policy adapters.
- Accessibility review starts with the design system and repeats each phase.
- Analytics event definitions start when entities stabilize; dashboards wait for trusted records.
- AI evaluation datasets can be prepared early; material AI features wait for evidence and approval primitives.

## Build-order rationale

The sequence follows dependency and risk: identity before records, records before intelligence, authority before outreach, outreach before commercial continuity, trusted financial records before analytics, and provenance/human approval before AI. This preserves a coherent production system while exposing the highest-risk assumptions early.

## First implementation increment

The first implementation task is Phase 1 only: establish the secure platform foundation and prove certification-gated access plus audit behavior end to end. Do not scaffold all later screens with fake workflows; add later modules as complete vertical slices.
