# Mara Phase 3 Acceptance Report

Date: 2026-07-15

Branch: `mara/outcome-flywheel`

Scope: durable task graph, deterministic scheduling, controlled internal execution, reassessment, and evidence-backed briefings.

## Executive result

Phase 3 meets its repository acceptance gate in offline evaluation. Validated plans become tenant-scoped, commercially justified task graphs; Mara and creator work are scheduled separately; replay is idempotent; low-risk internal execution is allowlisted and claim-based; changed circumstances can invalidate or reschedule work; and prohibited external actions cannot compile or execute.

Production controlled execution remains off by default and tenant-allowlisted. No Gmail draft, send, publish, purchase, deal acceptance, rate agreement, rights acceptance, external deadline change, or destructive capability was added.

## Files created

- `server/db/migrations/010_mara_phase3_task_graph.sql`
- `server/maraTaskGraph.mjs`
- `server/maraDeterministicScheduler.mjs`
- `server/maraPlanTaskCompiler.mjs`
- `server/maraControlledExecution.mjs`
- `server/maraReassessment.mjs`
- `server/maraWorkloadPolicy.mjs`
- `server/maraBriefings.mjs`
- `server/maraPhase3Runtime.mjs`
- `server/maraPhase3Runtime.test.mjs`
- `docs/evaluations/MARA_PHASE3_ACCEPTANCE_2026-07-15.md`

## Files changed

- `.env.example`: safe-off V3 feature flags, mode, allowlist, pause/resume, dormancy, and cost defaults.
- `server/maraFeatureFlags.mjs`: three runtime modes and controlled-execution tenant allowlist.
- `server/maraRuntimeStorage.mjs`: SQLite/Postgres-compatible runtime tables for local tests and runtime initialization.
- `server/accountErasure.mjs`: every new tenant table participates in account erasure.
- `server/workerEngine.mjs`: the existing autonomy cycle invokes the V3 wrapper behind flags; legacy behavior remains present during migration.

## Schema and migration

Migration `010_mara_phase3_task_graph.sql` adds eight tables:

1. `agent_tasks_v2`: task identity, tenant/worker/owner, kind, source plan/state/events/candidates, commercial rationale, priority, effort and cost, capability/tool requirements, approval and routing tier, schedule, completion/reassessment/expiration rules, confidence, lifecycle, failure/retry state, idempotency, claims, outputs, and timestamps.
2. `agent_task_relationships`: typed graph edges for dependency, blocking, supersession, replacement, invalidation, generation, approval, and information requirements.
3. `agent_task_audit_history`: append-only task transition and correction history.
4. `agent_task_calendar_entries`: distinct `mara` and `creator` calendars with start/end/timezone/status and idempotency.
5. `agent_task_compilation_runs`: complete compiler reports per plan and mode.
6. `agent_task_execution_attempts`: claims, tier, results, errors, and timing for every attempt.
7. `agent_dynamic_responsibilities`: recurring responsibilities that emit idempotent state events and advance their cadence rather than creating fixed output sequences.
8. `agent_briefings_v2`: briefings plus exact source task and event IDs.

The migration is additive. It does not alter or delete legacy task tables.

## Compilation rules

- The premium planner can propose work but cannot write task tables.
- The compiler revalidates the complete planner schema.
- Shared work is resolved to Mara when creator effort is zero and to the creator when creator time is required.
- Blocking planner questions become creator-owned `information_request` tasks.
- Dependencies resolve by task identity and circular graphs fail before persistence.
- Unsupported/unavailable tools and prohibited external actions fail closed.
- Strong portfolio work, dormant speculative work, and opportunity discovery at the backlog threshold are rejected as obsolete or unjustified.
- Semantic idempotency uses tenant, worker, state, normalized title, owner, and commercial objective. Replayed plans reuse valid tasks and do not duplicate calendar entries.
- Every material task retains a commercial objective, expected effect, completion condition, reassessment trigger, provenance, confidence, expiration, and retry policy.

## Scheduling rules

Code—not the model—resolves exact timestamps from relative windows, timezone, creator availability, deadlines, urgency, duration, existing calendar conflicts, and completed dependency end times. Past or unsupported model dates are rejected or normalized before compilation. Creator work receives explicit duration and a creator-calendar entry. Mara work receives a separate Mara-calendar entry. Availability changes cancel the old entry, preserve its history, and create/reactivate the corrected schedule.

## Execution permissions and routing

Routing tiers are `code`, `small`, `mid`, and `premium`; creator work is human action. Estimated task cost is recorded by tier. Execution checks tenant allowlist, owner, task kind, approval, dependency completion, freshness, attempts, budget, current state, safe tool allowlist, actual tool availability, and existing output.

Only Mara-owned, reversible internal work can run. Claims are atomic. Accepted outputs complete once. Timeouts, missing executors, quality failures, and partial results are recorded without inventing completion. A result finishing after task invalidation is discarded. A stale claim is recoverable after restart. The built-in code executor is intentionally limited to deterministic monitoring, reassessment, and internal-record checks; substantive analysis/research needs an explicit executor.

## Approvals, blocked work, and reassessment

The lifecycle supports proposed, scheduled, ready, running, awaiting approval, awaiting creator action, awaiting information, awaiting external event, blocked, rescheduled, completed, failed, superseded, invalidated, expired, and cancelled. One blocked task does not prevent unrelated runnable work.

Payment and reply/deal outcomes can invalidate stale work. Availability changes reschedule creator work. Expired tasks and approvals stop. Candidate work with an expired validity window is marked expired. Every important change is appended to audit history rather than silently rewriting the task.

## Backlog and dormant behavior

- New opportunity discovery pauses at 20 unsent opportunities.
- A persisted paused state remains paused until the configurable lower resume threshold (default 14), preventing oscillation.
- Inactivity and repeated ignoring enter dormant behavior.
- Dormant mode suppresses speculative work while retaining deadlines, replies, payment, risk, and low-friction re-entry work.
- Temporary capacity reductions are carried into planning and creator availability scheduling.

## Briefings

Briefings are derived only from persisted tasks and normalized events. They separate accepted completed deliverables, creator attention, planned next work, blockers/failures, material changes, commercial movement, and corrections. Monitoring and waiting are not counted as completed deliverables.

## Feature flags and modes

- `MARA_TASK_GRAPH_V1`
- `MARA_DETERMINISTIC_SCHEDULING_V1`
- `MARA_CONTROLLED_INTERNAL_EXECUTION_V1`
- `MARA_REASSESSMENT_V1`
- `MARA_BRIEFINGS_V2`
- `MARA_RUNTIME_V2_MODE=shadow|task_creation|controlled_execution`
- `MARA_CONTROLLED_EXECUTION_USER_IDS`
- `MARA_OPPORTUNITY_PAUSE_THRESHOLD` (default 20)
- `MARA_OPPORTUNITY_RESUME_THRESHOLD` (default 14)
- `MARA_DORMANT_IGNORED_TASK_THRESHOLD` (default 5)

Task creation requires its flag, deterministic scheduling flag, and a non-shadow mode. Controlled execution additionally requires its flag, controlled mode, and exact tenant allowlisting.

## Sixteen-scenario evaluation

| Creator state | Graph behavior proved |
|---|---|
| No niche/no portfolio | Positioning bottleneck becomes commercially grounded work; no premature discovery |
| Strong portfolio | Pipeline work may proceed; no portfolio task |
| Strong content/no replies | Contact/deliverability diagnosis, distinct from generic response work |
| Twenty unsent | Backlog reduction; no new discovery |
| Urgent active deals | Mara preparation precedes creator review through a dependency |
| Limited time | Creator work capped at 10 minutes and placed in stated availability |
| Suspicious outreach | Internal risk investigation; no reply/send action |
| Gifted preference | Strategic assessment without external acceptance |
| Historical import | Historical learning and response diagnosis retained as separate justified work |
| Repeatedly ignored | Low-friction re-entry retained; speculative work suppressed |
| International/multilingual | International-fit assessment retains evidence and objective |
| Conflicting preferences | Creator boundary resolution, not silent assumption |
| Overdue payment | Internal collection preparation; payment event invalidates it |
| Poor contact quality | Contact-quality work instead of scaling outreach |
| Low response | Segment/value-proposition diagnosis distinct from deliverability diagnosis |
| Portfolio should be left alone | Empty graph is valid; no work created merely due to age |

## Failure recovery results

Passed: duplicate planning replay, circular/missing dependency validation, prohibited compilation, controlled-execution denial, dependency blocking, transient database rollback and retry, duplicate event delivery (Phase 2 retained test), tool timeout, model-tier timeout, low-quality partial result, worker restart/stale claim, expired approval/task, availability change, task invalidated during execution, blocked-task independence, and evidence-only briefing generation.

## Verification and cost

- Phase 3 suite: 15 tests passed, 0 failed.
- Full repository suite: 227 passed, 0 failed, 1 skipped (the opt-in Postgres integration case).
- Production build: passed (`tsc -b && vite build`).
- Static syntax and whitespace checks: passed. The repository has no configured lint script, so no separate linter was available to run.
- Postgres migration: applied successfully; second migration check reported no pending migrations.
- Live provider calls in Phase 3: 0.
- Anthropic/OpenAI cost in Phase 3: **$0.00**. Ordinary regression tests explicitly cleared both provider keys.

## Known gaps

- Controlled execution is deliberately not globally enabled. It needs a small internal cohort and production soak before expansion.
- Research, analysis, invoice generation, and artifact production require individually implemented and evaluated executor adapters; missing adapters fail closed instead of producing placeholder work.
- This phase exposes internal calendar/task query functions, not a redesigned customer UI.
- Cross-instance claim contention is covered by conditional database claims and SQLite failure injection; the opt-in Postgres integration suite should run in deployment CI against an isolated database.
- More sophisticated capacity optimization across many simultaneous creators belongs after production telemetry proves the current deterministic scheduler.

## Phase 4 acceptance gate

Do not proceed to broad UI or integration expansion until a controlled tenant cohort proves, over a meaningful soak window:

1. real normalized events consistently produce the correct V3 plan and task graph;
2. task/calendar deduplication remains exact across restarts and multiple worker instances;
3. each substantive executor meets task-specific acceptance thresholds without external side effects;
4. reassessment cancels or replaces stale work before execution;
5. creator attention load remains within declared availability;
6. briefings match audited work and commercial outcomes;
7. cost per accepted result is measured by tier and stays within the configured cohort budget;
8. no Gmail draft, external send, irreversible action, or cross-tenant access occurs.

Phase 4 should then connect the validated task/calendar/briefing data to the user experience and add executor/integration adapters one at a time, each behind its own evaluation and rollback gate.
