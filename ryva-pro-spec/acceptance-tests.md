# Acceptance Tests

**Purpose:** Release-gating end-to-end behavior for Ryva Pro first production.  
**Execution:** Automate stable paths; run human usability and accessibility checks where judgment is required.  
**Rule:** A critical failure blocks production release. Test fixtures must use synthetic people, brands, products, and businesses.

## Test conventions

- `P0` protects access, authority, trust, financial integrity, or material audit history.
- `P1` protects a complete core journey or user-owned data.
- `P2` protects quality, guidance, or operational efficiency.
- Given/When/Then results must be observable in the UI and persisted record state.
- Every mutating API test also verifies workspace ownership and authorization.
- Dates use the workspace timezone while persisted timestamps remain UTC.
- Calculated money uses fixed-precision decimals and a stored currency.
- External sends, imports, scheduled jobs, extraction, and webhooks are tested for idempotency.

## Certification, subscription, and access

| ID | Priority | Scenario and expected behavior |
|---|---|---|
| ACC-001 | P0 | **Given** an authenticated user without an eligible credential, **when** they request any protected UI route or API, **then** access is denied, no protected data is returned, and the certification access-check page explains the next action. |
| ACC-002 | P0 | **Given** an active credential and active subscription, **when** the user signs in, **then** they reach Home and can use Representative permissions. |
| ACC-003 | P0 | **Given** a credential expires, **when** access is evaluated, **then** the user enters the configured 30-day read-only grace state, cannot send, create, edit, import, or approve, can review and export permitted records, and sees expiry and renewal guidance. |
| ACC-004 | P0 | **Given** grace ends without renewal, **when** the user accesses Ryva Pro, **then** operational records are inaccessible, certification/subscription/profile surfaces remain available, and retained data is not deleted merely because access ended. |
| ACC-005 | P0 | **Given** a credential is suspended, **when** the user opens the product, **then** access follows the suspension restriction, the reason is not overexposed, external action is blocked, and reinstatement can restore access without losing history. |
| ACC-006 | P0 | **Given** a credential is revoked, **when** any protected UI or API is requested, **then** access is blocked immediately, active sessions are invalidated, and the event is audited. |
| ACC-007 | P1 | **Given** a subscription is canceled but paid access remains through period end, **when** the user signs in before and after that date, **then** full access continues only before the entitlement ends and configured retention/export behavior follows afterward. |
| ACC-008 | P0 | **Given** two workspaces, **when** one user guesses the other workspace's record ID, **then** UI and API reveal neither the record nor whether it exists. |
| ACC-009 | P0 | **Given** a Support user without an approved ticket-scoped grant, **when** they request Representative data, **then** access is denied; a time-boxed grant exposes only its scope and creates audit events. |
| ACC-010 | P0 | **Given** a Representative, **when** they attempt an Admin-only action, **then** the server denies it regardless of hidden UI controls. |

## Onboarding and empty states

| ID | Priority | Scenario and expected behavior |
|---|---|---|
| ONB-001 | P1 | **Given** first eligible access, **when** onboarding starts, **then** credential and subscription are already verified and the user is guided through profile, interests, geography, relationships, accounts, preferences, and optional import. |
| ONB-002 | P1 | **Given** partial onboarding, **when** the session ends and resumes, **then** completed setup is retained and the next real setup action is shown. |
| ONB-003 | P1 | **Given** an existing relationship or account import, **when** validation succeeds, **then** records are created or matched without implying representation or protected-account rights that lack documents and approval. |
| ONB-004 | P2 | **Given** no Products, Brands, Businesses, Opportunities, Orders, or Commissions, **when** each relevant page opens, **then** its empty state explains value and offers the correct permission-safe next action. |
| ONB-005 | P1 | **Given** the user saves the first Product, creates a Brand and Business, creates an Opportunity, and approves first outreach, **when** milestones complete, **then** onboarding reflects the real records rather than a cosmetic checklist. |

## Intelligence and evidence

| ID | Priority | Scenario and expected behavior |
|---|---|---|
| INT-001 | P1 | **Given** a Product with evidence, **when** its detail opens, **then** evidence labels, source, observed date, confidence, unsupported claims, unknowns, risks, human decision, and provenance are visible. |
| INT-002 | P0 | **Given** an unsupported performance claim, **when** a draft uses it, **then** the claim is visibly flagged and cannot be treated as Verified Fact through AI output. |
| INT-003 | P1 | **Given** external data changes, **when** a refresh is accepted, **then** source observation history remains available and user-entered facts are not silently overwritten. |
| INT-004 | P1 | **Given** two Products, **when** compared, **then** the same fields, evidence gaps, risks, and last-updated context appear without a production numerical rank. |
| INT-005 | P1 | **Given** a Brand under review, **when** moved to Contact Ready, **then** identity, contact purpose, relevant channel, material risks, and required evidence criteria are enforced. |
| INT-006 | P1 | **Given** a Business candidate, **when** qualified, **then** assortment, customer, positioning, geography, Contact, fit rationale, account status, conflict result, unknowns, and next action can be reviewed. |
| INT-007 | P0 | **Given** AI suggests a Product–Business match, **when** displayed, **then** it identifies evidence, confidence, fact/inference/estimate/unknown labels, missing data, and required human review. |
| INT-008 | P1 | **Given** records share normalized identity signals, **when** duplicate detection runs, **then** candidates are suggested with reasons and are not auto-merged. |

## Representation, Placement, and conflicts

| ID | Priority | Scenario and expected behavior |
|---|---|---|
| PLC-001 | P0 | **Given** no active Representation Agreement authorizes the Product, territory, channel, and date, **when** buyer outreach is attempted, **then** preparation may be saved but approval and sending are blocked with the missing authority explained. |
| PLC-002 | P0 | **Given** an expired, ended, paused, or out-of-scope agreement, **when** outreach is attempted, **then** authorization fails at send time even if a draft was approved earlier. |
| PLC-003 | P0 | **Given** a Business conflicts with an active Protected Account or exclusion, **when** an Opportunity is created or prepared, **then** the conflict is visible and outreach is blocked until a documented human resolution permits it. |
| PLC-004 | P1 | **Given** only a possible conflict, **when** matching runs, **then** the record is marked review-required rather than falsely declared clear, and the underlying match signals are visible. |
| PLC-005 | P0 | **Given** a required stage field, approval, authority, evidence, or next action is absent, **when** stage advancement is attempted by drag, menu, or API, **then** it is rejected atomically with a field-level explanation. |
| PLC-006 | P1 | **Given** a valid stage move, **when** confirmed, **then** stage, actor, time, prior value, rationale where required, automation results, and audit event are recorded once. |
| PLC-007 | P1 | **Given** a backward move, loss, disqualification, or reopening, **when** confirmed, **then** the required reason and evidence are preserved and reopening rules are enforced. |
| PLC-008 | P1 | **Given** no activity or an overdue/missing next action beyond the configured threshold, **when** stalled logic runs, **then** a visible stalled reason and recommended owned action appear without changing stage. |
| PLC-009 | P0 | **Given** an Opportunity has Products outside the linked agreement, **when** it reaches Prepared, **then** the transition is blocked until scope is corrected. |
| PLC-010 | P1 | **Given** the Relationship Triangle reveals no legitimate Buyer value, **when** the user records a decision, **then** the rationale is required and a commission-only rationale does not satisfy qualification. |

## Outreach, communication, and tasks

| ID | Priority | Scenario and expected behavior |
|---|---|---|
| OUT-001 | P0 | **Given** an AI- or user-drafted external message, **when** scheduled or sent, **then** the exact recipient, channel, content, attachments, sender, and timing require explicit user approval. |
| OUT-002 | P0 | **Given** an approved draft is materially edited or its recipient/attachment changes, **when** send is attempted, **then** prior approval is invalid and reapproval is required. |
| OUT-003 | P0 | **Given** an opt-out, invalid channel, unresolved conflict, lost authority, or credential restriction, **when** a sequence step becomes due, **then** sending is suppressed and the reason is audited. |
| OUT-004 | P1 | **Given** an approved email send succeeds, **when** the provider confirms acceptance, **then** one Email and Activity record are logged and a configurable follow-up Task is created. |
| OUT-005 | P1 | **Given** a send returns uncertain or duplicate provider responses, **when** retried, **then** the idempotency key prevents duplicate external sends and the user sees a recoverable status. |
| OUT-006 | P1 | **Given** a call is logged on mobile, **when** saved, **then** participants, outcome, notes, duration where known, related records, and next action persist and appear on the unified timeline. |
| OUT-007 | P1 | **Given** a sequence contact replies or opts out, **when** the event is recorded, **then** remaining automated reminders/sends stop according to policy and the Representative is notified. |
| OUT-008 | P1 | **Given** a material claim in a template, **when** reused for another Product, **then** Product-specific evidence is revalidated and stale approval is not inherited. |
| OUT-009 | P2 | **Given** an overdue Task, **when** Home and Tasks load, **then** it is visible with linked record, reason, priority, and completion/reschedule actions. |

## AI assistance and human responsibility

| ID | Priority | Scenario and expected behavior |
|---|---|---|
| AI-001 | P0 | **Given** any material AI suggestion, **when** shown, **then** supporting sources/evidence, confidence, output classification, model/run metadata, approval state, and generated time are inspectable. |
| AI-002 | P0 | **Given** an AI suggestion, **when** the user accepts, edits, rejects, regenerates, or gives feedback, **then** the original and final values and actor action remain in history. |
| AI-003 | P0 | **Given** AI proposes a final qualification, consequential stage, agreement approval, binding term, external send, or Opportunity close/reject, **when** the workflow runs, **then** no material state changes without a named human confirmation. |
| AI-004 | P1 | **Given** no adequate source supports a requested summary, **when** AI responds, **then** it identifies unknowns rather than inventing facts or confidence. |
| AI-005 | P0 | **Given** malicious text in an uploaded document or fetched page, **when** AI processes it, **then** source content cannot override product policy, gain tools, or trigger external action. |
| AI-006 | P1 | **Given** extraction from an agreement or commission document, **when** values are proposed, **then** each field links to source location, remains uncommitted, and requires human review. |
| AI-007 | P1 | **Given** an unavailable AI provider, **when** a core record workflow runs, **then** manual operation remains available and the failure does not corrupt or advance the record. |

## Orders, accounts, reorders, and commissions

| ID | Priority | Scenario and expected behavior |
|---|---|---|
| COM-001 | P0 | **Given** a verified opening Order with agreement and Opportunity, **when** it is confirmed, **then** the system atomically creates or links the Account, creates a draft/review-required Protected Account basis, creates an Estimated Commission, advances the Opportunity appropriately, and records audit events. |
| COM-002 | P0 | **Given** no document supports protected-account rights, **when** the Account opens, **then** the platform does not assert protection; it marks status unverified/review-required and requests agreement evidence and human approval. |
| COM-003 | P0 | **Given** quantity, unit price, discounts, returns, cancellations, commission basis, and rate, **when** expected commission is calculated, **then** the UI shows each input, formula, rounding rule, currency, source, assumptions, and result. |
| COM-004 | P0 | **Given** a correction to an Order or commission term, **when** recalculated, **then** the prior calculation remains in history, the new basis is explained, and approved/paid values are not silently changed. |
| COM-005 | P0 | **Given** a Reorder on a protected Account, **when** recorded, **then** it links the prior Order, Account, Protected Account, agreement basis, and its own Commission; protection validity is evaluated on the relevant date. |
| COM-006 | P1 | **Given** an expected reorder window approaches, **when** the reminder job runs, **then** one visible Task/Notification is created with account health and suggested follow-up, subject to user approval before external contact. |
| COM-007 | P0 | **Given** protection is near expiry or expired, **when** rights are evaluated, **then** alerts appear, no ongoing right is presumed, and renewal/expiration actions require evidence and approval. |
| COM-008 | P0 | **Given** a Commission enters Disputed, **when** notes, documents, status, amounts, or resolution change, **then** the Commission Dispute retains chronology, parties, claims, evidence, decisions, and linked audit events. |
| COM-009 | P0 | **Given** a Commission is Paid, Canceled, or Clawed Back, **when** the transition occurs, **then** required amount/date/source/reason fields are enforced and previous values remain traceable. |
| COM-010 | P1 | **Given** a Brand relationship ends, **when** the agreement is ended, **then** new unauthorized outreach stops while existing Accounts, Orders, Commissions, disputes, documents, and any surviving documented rights remain accessible according to policy. |
| COM-011 | P1 | **Given** multiple currencies, **when** analytics aggregate money, **then** values are separated by currency unless an explicit sourced conversion policy is enabled; raw amounts never silently combine. |

## Search, views, import, export, and documents

| ID | Priority | Scenario and expected behavior |
|---|---|---|
| DAT-001 | P1 | **Given** records and permitted document metadata, **when** global search is used, **then** results cover Products, Brands, Businesses, Contacts, Opportunities, Accounts, Orders, Commissions, Notes, and Documents and respect access boundaries. |
| DAT-002 | P1 | **Given** a saved filtered view, **when** reopened, **then** filters, sort, columns, presentation mode, and ownership/share scope restore without stale inaccessible records. |
| DAT-003 | P1 | **Given** a valid CSV, **when** previewed, **then** mapping, field validation, duplicate candidates, row errors, authority implications, and create/update counts are shown before commit. |
| DAT-004 | P0 | **Given** an import commit is retried, **when** the same import key is submitted, **then** records are not duplicated and a row-level outcome report remains downloadable. |
| DAT-005 | P1 | **Given** duplicate Brand, Business, Contact, Product, Opportunity, or Account candidates, **when** merged by an authorized user, **then** a field-level preview is approved, relationships are repointed safely, losing values are retained in history, and merge is audited. |
| DAT-006 | P0 | **Given** a user requests a permitted export, **when** generated, **then** it includes user-owned operational records and provenance as policy allows, excludes secrets/internal security data/other workspaces, is time-limited, and is audited. |
| DAT-007 | P1 | **Given** a read-only grace user, **when** exporting, **then** only allowed data and formats are available and no export mutates records. |
| DAT-008 | P0 | **Given** a malicious or unsupported upload, **when** processed, **then** it is rejected or quarantined, not executed, and no document is treated as verified evidence merely by upload. |

## Audit, security, reliability, and accessibility

| ID | Priority | Scenario and expected behavior |
|---|---|---|
| QLT-001 | P0 | **Given** a material state change—access, stage, decision, approval, agreement, outreach, account right, Order, Commission, dispute, import, export, merge, or support grant—**when** committed, **then** an append-only Audit Event captures actor, time, action, entity, before/after or safe diff, request correlation, and origin. |
| QLT-002 | P0 | **Given** an ordinary user, **when** attempting to alter or delete audit history, **then** the server refuses it. |
| QLT-003 | P0 | **Given** concurrent updates to a consequential record, **when** the stale version saves, **then** optimistic concurrency prevents silent overwrite and offers reload/reconcile behavior. |
| QLT-004 | P0 | **Given** background automation retries after partial failure, **when** it resumes, **then** transactions and idempotency prevent duplicate Tasks, Accounts, Commissions, notifications, and sends. |
| QLT-005 | P1 | **Given** a recoverable provider or validation error, **when** it appears, **then** the message states what failed, what was preserved, and the safe next action without exposing credentials or internals. |
| QLT-006 | P0 | **Given** a session, upload, webhook, or API request, **when** security controls run, **then** CSRF, injection, authorization, signature, size/type, rate, and secret-handling controls behave as specified. |
| QLT-007 | P1 | **Given** desktop, tablet, and mobile breakpoints, **when** core mobile workflows run, **then** task completion, buyer lookup, call logging, notes, stage updates, and commission review are operable without horizontal loss of required content. |
| QLT-008 | P1 | **Given** keyboard-only and assistive-technology use, **when** navigating core journeys, **then** focus, labels, errors, dialog behavior, status announcements, color contrast, and reduced motion meet WCAG 2.2 AA target behavior. |
| QLT-009 | P1 | **Given** dashboard metrics, **when** opened, **then** definitions, date range, timezone, filters, currency, included/excluded statuses, and drill-down records explain every number. |
| QLT-010 | P1 | **Given** a deployment migration, **when** executed and rolled back under the release plan, **then** user records remain consistent, migrations are forward-safe, and backups/restore checks meet the documented recovery target. |

## Critical release journeys

The following must pass as cohesive browser tests, not only isolated API tests:

1. eligible certification → subscription → real-record onboarding → Home;
2. Product discovery → evidence review → human qualification;
3. Brand research → contact → agreement review → authorization;
4. Business qualification → conflict check → Placement Opportunity;
5. Prepared outreach → exact-content approval → send → follow-up;
6. sample/information → Buyer review → order discussion;
7. opening Order → Account → protection review → explainable Commission;
8. Reorder → renewed Order → linked Commission;
9. overdue Commission → Dispute → resolution with evidence history;
10. credential expiry → grace export → renewal and restored access;
11. Brand relationship end while surviving commercial records remain intact.

## Exit criteria

- All P0 tests pass in production-like staging.
- All P1 tests pass or have a Founder-approved, time-bounded release exception that does not weaken a P0 control.
- No known cross-workspace data leak, unauthorized external action, incorrect commission mutation, or missing material audit event.
- Core journeys pass on current supported desktop and mobile browser targets.
- Empty, loading, error, permission, and offline/interrupted states are manually reviewed for every required page.
- Accessibility review covers the critical release journeys.
- Backup restore, job retry, webhook replay, provider outage, and export expiry drills pass.
- Pilot users can complete the five central daily tasks without needing framework documents open: qualify, prepare, send, advance, reconcile.
