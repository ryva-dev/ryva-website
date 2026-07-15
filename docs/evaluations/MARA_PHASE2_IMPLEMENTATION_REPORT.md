# Mara Phase 2 Implementation Report

| Field | Result |
|---|---|
| Date | 2026-07-14 |
| Scope | Events, business state, candidate work, playbooks, premium shadow planner, usage accounting, evaluation |
| Production execution | Disabled; shadow plans cannot create or execute user-facing work |
| Structural gate | Passed: 16/16 scenarios |
| Offline planning-quality gate | Intentionally not accepted as proof: 14/16 using a schema-only test double |
| Live premium gate | Passed after layer-specific corrections; see `MARA_PHASE2_LIVE_EVALUATION_2026-07-14.md` |
| Phase 3 authorization | Eligible for founder review; production execution remains disabled |

## Executive result

The Phase 2 foundation is implemented and deployed additively at the database layer. It does not replace the legacy planner, redesign UI, create Gmail drafts, send communication, or execute shadow work.

The repository now proves that all 16 creator states produce the correct observable candidate space, that plan schemas and playbook selection work, that state is tenant-isolated and idempotent, that a payment changes future candidates, and that an unchanged state terminates before a second premium call.

The later live evaluation proves the founder's decisive acceptance criterion across all 16 scenarios, with 16 distinct signatures and scenario-specific commercial behavior. The full results, failure-layer corrections, and credit accounting are in [MARA_PHASE2_LIVE_EVALUATION_2026-07-14.md](MARA_PHASE2_LIVE_EVALUATION_2026-07-14.md). The offline test double remains deliberately non-strategic and is not treated as behavioral proof.

## Files and components

- `server/maraEvents.mjs`: normalized event validation, ingestion, idempotency, scoped reads, processing watermark.
- `server/maraBusinessState.mjs`: durable materialized creator-business state and event reduction.
- `server/maraCandidateWork.mjs`: observable possible-work generation without final selection or ordering.
- `server/maraPlaybooks.mjs` and `workers/mara/playbooks/*.md`: validated, versioned, conditionally retrieved professional judgment.
- `server/maraShadowPlanner.mjs`: strict premium planner contract and output validation.
- `server/maraShadowRuntime.mjs`: state-hash gate, shadow persistence, comparison diagnostics, and no execution path.
- `server/modelUsageAccounting.mjs`: token, cost, latency, outcome-disposition, and commercial linkage accounting.
- `server/maraFeatureFlags.mjs`: disabled-by-default Phase 2 controls.
- `server/maraPhase2Scenarios.mjs`, `scripts/evaluate-mara-phase2.mjs`, and `server/maraPhase2Runtime.test.mjs`: frozen scenarios, live/offline evaluator, and automated invariants.
- `server/db/migrations/009_mara_phase2_shadow_runtime.sql`: additive Postgres schema.
- Existing Anthropic and media provider paths now retain the existing daily hard call limit and optionally add detailed usage rows.
- `server/workerEngine.mjs` invokes V2 only when shadow mode is enabled and discards its output from the user-facing legacy cycle.

## Schema changes

Five tenant-scoped tables were added:

1. `agent_events`
2. `worker_business_state_snapshots`
3. `agent_work_candidates`
4. `agent_planning_runs`
5. `model_usage_events`

All carry `user_id`; worker runtime records also carry `worker_id`. Account erasure includes every new table. Migration `009_mara_phase2_shadow_runtime.sql` was applied successfully to the configured Postgres database.

## Event taxonomy

Implemented events cover business messages and creator sends; bounces and due follow-ups; opportunity deadlines and state changes; invoice due, overdue, and payment; approvals, rejections, and edits; task completion, ignore, dismissal, and rescheduling; uploads and analytics; portfolio and positioning changes; availability and inactivity; stale evidence; creator context and historical import; and commercial outcomes.

Events require a tenant, worker, type, source, occurrence time, provenance-capable payload, confidence, and an idempotency key. Duplicate delivery is ignored within the tenant/worker boundary.

## Business-state contract

The materialized state includes commercial objective and bottleneck; active opportunities; unsent backlog; replies and follow-ups; deadlines; portfolio and readiness; content/outreach performance; workload and capacity; ignored/blocked work; revenue and invoices; risks and emerging needs; strategy and rationale; preferences and geography/languages; hypotheses; evidence; confidence; and the last meaningful change. It is hashed and versioned, so planning does not replay chat history.

## Candidate-work contract

Each candidate stores its trigger events, possible commercial objective, urgency, dependencies, suggested owner, required capabilities, user-action possibility, risk class, evidence, expiration, and tenant-scoped dedupe key. Candidates intentionally do not contain final priority, final schedule, or an instruction to execute.

## Planner contracts

Input contains the live state, meaningful events, candidate work, relevant playbooks, tools, permissions, subscription/cost budget, and existing scheduled work.

Output contains the situation, bottleneck, emerging needs, work to create and skip, ownership, candidate provenance, commercial objective, expected effect, urgency, creator effort, dependencies, schedule/window, approval, execution model tier, completion condition, reassessment trigger, confidence, evidence, and focused creator questions.

The validator rejects missing fields, invalid tiers/owners/urgency, invalid confidence, and instructions to send email/messages or create Gmail drafts.

## Playbook metadata

Every minimum playbook declares: ID, semantic version, applicable task types, load and do-not-load conditions, required and optional context, allowed tools, autonomy level, model tier, maximum context tokens, output schema, quality rubric, and escalation rules. Retrieval loaded readiness guidance for the beginner state and did not load it for the validated-portfolio state.

## Routing and cost behavior

- Code: idempotency, state materialization, no-change hashing, candidates, permissions, validation, persistence, and accounting.
- Premium model: diagnosis, prioritization, anticipation, personalized work selection, schedule judgment, and explicit skips.
- Execution tier: selected separately per planned task in the structured output.
- No-change: zero model calls.
- Existing hard protection: per-user daily call cap remains active.
- Detailed accounting: user, worker, task type, provider/model, input/output/cache tokens, estimated dollars, latency, retries, request result, output disposition, and related event/task/opportunity/outcome.
- Configurable estimation defaults: input $3/M tokens, output $15/M tokens, cached input $0.30/M tokens, Whisper $0.006/minute. These are operational defaults, not pricing claims, and must be recalibrated when provider pricing changes.

## Feature flags

All default to off:

- `MARA_EVENTS_V2`
- `MARA_STATE_V2_WRITE`
- `MARA_CANDIDATES_V2`
- `MARA_SHADOW_PLANNER`
- `MARA_PLAYBOOKS_V1`
- `MARA_MODEL_USAGE_V1`

`MARA_SHADOW_MAX_PLAN_COST_USD` supplies the planning budget. V2 execution has no implementation path in this phase.

## Shadow behavior and diagnostics

The legacy plan continues normally. When enabled, shadow mode separately records why it ran, state and event references, loaded playbook versions, considered candidates, selected and skipped work, schema failures, estimated cost, and a legacy/shadow count comparison. Shadow output is not returned in the legacy cycle summary and is never converted into tasks or actions.

## Scenario evaluation

| Scenario | Candidate/state gate | Schema-only signature | Planning-quality observation |
|---|---:|---|---|
| No niche and no portfolio | Pass | positioning; portfolio gap; pipeline possibility | Test double correctly failed avoid-work gate; premium planner must skip premature pipeline work |
| Strong existing portfolio | Pass | strengthen pipeline | Portfolio left alone |
| Strong content but no replies | Pass | diagnose response; contact quality; pipeline possibility | Diagnosis present; portfolio left alone |
| Twenty unsent opportunities | Pass | reduce backlog | No discovery candidate generated at this threshold |
| Active deals with urgent deadlines | Pass | protect deadline | Revenue protection dominates |
| Very limited time | Pass | strengthen pipeline | Premium proof must differentiate scheduling and creator burden from strong-portfolio case |
| Suspicious outreach | Pass | risk investigation; pipeline possibility | Risk investigation present; external execution prohibited |
| Gifted preference | Pass | assess gifted offer; portfolio gap; pipeline possibility | Gifted value remains distinct from cash |
| Historical import | Pass | learn from import; diagnose response; pipeline possibility | Bulk evidence becomes hypotheses rather than full-history prompts |
| Repeatedly ignored tasks | Pass | throttle/re-enter; pipeline possibility | Test double correctly failed avoid-work gate; premium planner must skip pipeline expansion |
| International/multilingual | Pass | international fit; pipeline possibility | Geography/language evidence retained |
| Conflicting preferences | Pass | resolve conflict; pipeline possibility | Canonical boundary is not overwritten |
| Overdue payment | Pass | resolve payment | Payment collection dominates; creator owns send |
| Poor contacts | Pass | improve contacts; pipeline possibility | Contact validation precedes send-ready work |
| Low response rate | Pass | diagnose response; pipeline possibility | Outcome diagnosis available without portfolio rebuild |
| Portfolio should be left alone | Pass | no work | Portfolio left alone and no expensive work manufactured |

Structural result: 16/16. Schema-only signatures: 15 unique. The duplicate is intentional and unresolved by the non-strategic test double: “strong portfolio” and “limited time” both expose pipeline work, while the premium planner must create different capacity-aware schedules.

## Cost measurements

- Offline structural run: $0 and no external model.
- No-change second run: $0, zero model calls.
- Live premium attempt: provider returned HTTP 400 before inference because the account had insufficient credits; recorded model tokens and cost are therefore zero.
- Actual cost-per-accepted-plan cannot be reported until a provider completes the 16 live runs and a reviewer accepts/edits/rejects each result.

## Verification

- Repository tests: 213 total; 212 passed; 1 intentionally skipped; 0 failed.
- Phase 2 tests: 5/5 passed.
- Production TypeScript/Vite build: passed.
- SQL migration: applied successfully.
- Diff whitespace check: passed.
- Lint: no lint script or lint configuration exists in this repository, so no separate lint command was available.

## Known gaps and Phase 3 gate

The live planning gate and human review are complete. Before any Phase 3 execution rollout:

1. Wire normalized events from real production change points incrementally and verify source-specific idempotency.
2. Expand the legacy-to-V2 state adapter; its current role is deliberately partial while V2 is shadow-only.
3. Add an evaluated same-tier provider fallback and per-tenant/cohort flag service before production shadow rollout.
4. Keep the 16 live scenarios as a release gate for provider, model, playbook, state, or routing changes.
