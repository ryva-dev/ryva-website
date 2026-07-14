# Mara Migration Plan

| Field | Value |
|---|---|
| Status | Normative migration specification; implementation not started |
| Version | 1.0.0 |
| Owner | Ryva Architecture and Product |
| Last updated | 2026-07-14 |

## Objective

Replace Mara's code-selected workflow with a goal-driven, self-scheduling employee runtime without preserving incorrect architecture merely for compatibility.

This is not a cosmetic prompt refactor. It changes where strategic decisions occur:

- Code owns facts, events, candidates, authority, execution, and reliability.
- Playbooks own inspectable professional standards.
- A premium planner owns diagnosis, prioritization, anticipation, skipping, and task creation.
- Outcomes change future planning.

The migration MUST be incremental enough to protect production data and allow rollback. Incremental delivery does not mean preserving obsolete decision logic in the target design.

## Phase boundary

This documentation phase makes no production-runtime changes.

The first coding phase after approval is Phase 2 and is strictly:

> Build live business state, normalized events, candidate work, and the shadow planner.

It explicitly excludes UI redesign, broad integration expansion, full playbook coverage, and production replacement of the current planner.

## Existing components to retain

Retain concepts or implementations that already provide correct deterministic infrastructure, subject to focused hardening and schema adaptation:

- Authentication, sessions, origin checks, rate limiting, and tenant isolation
- Stripe billing and subscription enforcement
- PostgreSQL storage abstraction and migrations
- OAuth token encryption and integration connection lifecycle
- Durable leased jobs, retry infrastructure, and idempotent execution concepts
- Append-only action audit and evidence provenance concepts
- Canonical opportunity, contact, campaign, commercial-outcome, task, and output records where their semantics remain valid
- Creator intelligence profile fields that map to canonical memory
- Evidence-basis and confidence primitives
- Commercial outcome inference and opportunity re-ranking as inputs to planning
- Account export, deletion, retention, backups, health checks, and observability
- Office concepts for tasks, deliverables, briefings, approvals, history, and commercial progress

Retention means reuse after conformance review. It does not freeze current APIs or schemas.

## Existing components to rewrite

### Autonomy planner

Rewrite `server/maraAutonomyPlanner.mjs` as shared candidate generation plus a premium shadow planner contract. Remove its responsibility for constructing the final ordered work list.

### Mara execution orchestration

Decompose the Mara-specific planning and business-judgment portions of `server/workerEngine.mjs` into:

- State readers/materializer
- Candidate generators
- Worker task executors
- Deterministic validators
- Outcome writers

Executors MAY remain task-specific; strategic selection MUST move out.

### Model layer

Replace provider-specific task defaults in `server/maraLlm.mjs`, `server/agentLlm.mjs`, inbox parsing, onboarding, memory, and office chat with a provider-neutral routing interface and versioned call records.

### Budgeting

Replace call-count-only limits in `server/llmBudget.mjs` with token, cached-token, and dollar accounting linked to tasks and outcomes. A call-count emergency limit MAY remain as a secondary circuit breaker.

### Onboarding

Rewrite onboarding completion so it materializes creator state and emits assessment candidates. It MUST NOT automatically create a universal eight-task starter plan or fixed recurring responsibilities.

### Scheduling

Replace title/regex-mapped recurring responsibilities and stale-artifact refresh decisions with standing responsibilities, normalized events, candidate work, and model-generated tasks.

### Gmail behavior

Rewrite Gmail integration behavior so Mara may read authorized business evidence and detect creator-sent communication, but cannot create provider drafts or send. Prepared communication remains a Ryva artifact.

### Activation journey

Rewrite the sent milestone to accept creator-sent evidence detected through Gmail or explicit verified user confirmation. It MUST NOT depend on a Ryva `send_email` execution.

### Memory

Migrate generic worker-knowledge arrays into canonical memory, live state, episodes, and hypotheses. Preserve source text where needed for audit, but stop treating all knowledge as one prompt section.

### UI data contracts

Eventually rewrite workspace APIs to expose Mara's work calendar, creator calendar, current assessment, reasons, skips, and outcome-linked work. UI implementation is not part of the first coding phase.

## Existing components to delete

Delete once replacement paths are proven:

- `buildMaraInitialWorkPlan` universal task and recurring-responsibility bundle
- `ensure_starter_tasks` as a mandatory autonomy action
- Fixed planner action ordering that decides Mara's strategy in code
- Regex mapping from recurring titles to autonomy actions as strategic control
- Artifact-age rules that directly create work rather than candidates
- Duplicate embedded business-judgment prompt strings superseded by versioned playbooks
- Hard-coded five-brand planning constant and any quota logic that overrides judgment
- Gmail provider-draft creation for Mara
- Gmail approve-and-send execution for Mara
- Mara send permissions, send approval requests, and send policy branches no longer used by other workers
- Activation requirements tied only to Ryva-executed email sends
- Placeholder or deterministic template output presented as professional model work
- Any scheduler path that invokes a model solely because an interval elapsed

Deletion MUST occur after dependent tests, routes, schemas, and metrics migrate.

## Target repository structure

```text
/platform
  /events
  /scheduler
  /permissions
  /approvals
  /usage

/agent-runtime
  /state-materializer
  /candidate-work
  /planner
  /context-builder
  /playbook-retriever
  /model-router
  /task-graph
  /validators
  /memory
  /evaluations

/workers/mara
  worker.yaml
  /playbooks
  /schemas
  /rubrics
  /examples
  /evaluations
```

Exact paths may adapt to the repository's module system, but boundaries MUST remain.

## Schema migrations

Migrations are additive before destructive cleanup.

### Event store

Add `agent_events` with tenant, worker, type, source, entity references, payload, provenance, confidence, occurred/ingested times, idempotency key, and immutable hash.

### State snapshots

Add `worker_business_state_snapshots` with state version, structured domains, material-change summary, source event watermark, and created time.

### Canonical memory

Add versioned `worker_canonical_memory` records with namespace, key, value, provenance, confidence, confirmation state, effective time, supersession, and retention class.

### Episodic memory and hypotheses

Add `worker_episodes` and `worker_hypotheses` with evidence links, confidence, review/expiration conditions, and status.

### Candidate work

Add `agent_work_candidates` with source events, possible objective, evidence, dependencies, risk, cost range, dedupe key, expiration, and planner disposition.

### Planning runs

Add `agent_planning_runs` with worker, state version, trigger set, playbook versions, model usage, assessment, selected and skipped candidate IDs, validation state, and shadow/active mode.

### Durable tasks

Extend or replace current task records with owner, commercial objective, reason, expected effect, horizon, scheduling window, dependencies, cost estimate, approval class, completion condition, reassessment trigger, state version, and expiration.

### Model usage

Add `model_usage_events` with provider, model, task, tokens, cached tokens, cost, latency, retry, result status, acceptance, edits, and commercial outcome links.

### Playbook versions

Add `worker_playbook_releases` or equivalent deployment records linking file version, evaluation run, release cohort, and rollback target.

### Migration principles

- New tables and columns deploy before readers switch.
- Backfills are idempotent and provenance-labeled.
- Unknown legacy values remain unknown rather than invented.
- Dual-write periods are time-bounded and observable.
- Destructive cleanup requires a verified backup and rollback checkpoint.

## Feature flags

Required flags:

- `MARA_STATE_V2_WRITE`: materialize new state alongside legacy state
- `MARA_EVENTS_V2`: emit normalized events
- `MARA_CANDIDATES_V2`: generate candidate work
- `MARA_SHADOW_PLANNER`: run planner without execution
- `MARA_SHADOW_COMPARE`: score shadow and legacy plans
- `MARA_RUNTIME_V2_READ`: serve V2 state to internal tools
- `MARA_RUNTIME_V2_EXECUTE`: execute validated V2 plans for allowlisted tenants
- `MARA_PLAYBOOKS_V1`: retrieve versioned Markdown playbooks
- `MARA_MODEL_ROUTER_V1`: enable provider-neutral routing
- `MARA_EXTERNAL_SEND_DISABLED`: enforce final no-draft/no-send policy

Flags MUST support per-environment, per-tenant, and cohort control. Security invariants such as no external send MUST not depend solely on a remotely mutable flag after cutover.

## Shadow-mode requirements

Shadow mode MUST:

- Read production-like state without creating user-visible work
- Generate candidate work from the same event watermark
- Run the premium planner using versioned playbooks
- Record selected, skipped, and anticipatory intentions
- Apply full policy, budget, schema, and duplication validation
- Never create provider drafts, send, schedule creator-visible tasks, or mutate canonical commercial state
- Compare against legacy actions and human-reviewed expected behavior
- Record estimated execution cost separately from actual planning cost
- Support deterministic replay from a frozen state version
- Redact or minimize private data in evaluation exports

Shadow comparison MUST ask:

1. Did V2 choose meaningfully different work for different creators?
2. Did it skip unnecessary legacy work?
3. Is every selected task commercially justified?
4. Did code force a strategic decision through candidate design?
5. Did V2 anticipate important work the legacy planner missed?
6. Did it assign work to the correct calendar?
7. Did it comply with approvals and budget?
8. Would outcomes and corrections change the next plan?

## Rollback strategy

### Before V2 execution

Disable shadow flags. No user-facing behavior changes.

### During cohort execution

- Stop new V2 planning.
- Preserve V2 events, state, and tasks for audit.
- Cancel only unstarted V2 tasks after dependency review.
- Return allowlisted tenants to the last known safe production behavior.
- Never re-enable Mara provider drafting or sending as a rollback shortcut.
- Reconcile state changes through an explicit repair job.

### After full cutover

Maintain one validated prior runtime release and playbook release. Rollback restores binaries/configuration and replays events from the last compatible watermark. Schema changes remain backward-readable through the rollback window.

Rollback drills are required before general availability.

## Test strategy

### Unit

- Event normalization and idempotency
- State materialization and versioning
- Candidate generation without final priority
- Policy and permission enforcement
- Task graph dependencies and expiration
- Cost calculation and cache keys
- Memory correction and hypothesis invalidation

### Contract

- Planner input/output schemas
- Worker package and playbook metadata
- Model router and provider adapters
- Tool interfaces
- Outcome ingestion

### Scenario evaluation

Run every case in [Mara Evaluation Standard](../product/MARA_EVALUATION_STANDARD.md) against frozen state. Require release thresholds before shadow deployment.

### Replay

Replay anonymized or synthetic event histories to confirm deterministic state and candidate generation, planning differences, and no duplicate tasks.

### Integration

- PostgreSQL migrations and rollback reads
- Gmail read/detect behavior with no provider-draft or send scope
- Job leases, retries, and uncertain failures
- Billing and budget enforcement
- Tenant isolation and erasure

### Adversarial

- Prompt injection through email, web, files, and shared intelligence
- Cross-tenant retrieval
- Unsupported claims and contact mismatch
- Approval and external-action bypass attempts
- Malformed planner outputs
- Provider outage and budget exhaustion

### Production soak

Run shadow mode before active mode, then internal tenants, then a small allowlist. Measure plan quality, unnecessary work, premium cost, creator acceptance, task completion, and commercial outcomes.

## Implementation sequence

### Phase 1: specification gate — current phase

1. Approve the nine authoritative documents.
2. Resolve cross-document contradictions.
3. Freeze V1 specifications and evaluation inputs.
4. Do not change production behavior.

### Phase 2: foundations and shadow planner — first coding phase

1. Define versioned event, state, candidate, planner, and task schemas.
2. Add token/dollar usage accounting needed to measure shadow cost.
3. Emit normalized events from existing canonical records without changing behavior.
4. Build live business-state materialization and deterministic replay.
5. Build candidate-work generation that does not assign final strategic priority.
6. Create the minimum Mara identity, commercial mission, dynamic-planning, anticipation, workload, and approval playbooks.
7. Implement the provider-neutral premium planner interface.
8. Run the planner in shadow mode only.
9. Build automated comparison and human-review reports.
10. Pass the complete evaluation suite and shadow thresholds.

Do not build new UI or every integration in this phase.

### Phase 3: durable task graph and controlled execution

1. Add Mara and creator calendars to the data model.
2. Persist validated V2 plans and dependencies.
3. Route safe internal execution through tiered models and tools.
4. Add reassessment, expiration, backlog, and inactivity behavior.
5. Enable internal tenants, then a small creator cohort.

### Phase 4: memory and outcome learning

1. Migrate canonical memory.
2. Add episodes and working hypotheses.
3. Link creator edits and commercial outcomes to later plans.
4. Add safe shared-intelligence reads and contribution controls.

### Phase 5: product experience

1. Expose completed work, briefings, two calendars, approvals, current priorities, and correction history.
2. Make chat supplementary.
3. Add creator memory correction and workload controls.

### Phase 6: integration and capability expansion

1. Expand content, calendar, Canva, social, creator-platform, and file capabilities according to official access and evaluation.
2. Maintain truthful manual fallbacks when platforms lack APIs.

### Phase 7: legacy deletion and worker generalization

1. Remove fixed planner and starter workflows.
2. Remove Mara Gmail draft/send paths.
3. Remove obsolete prompt and budget systems.
4. Prove a second worker package on the shared runtime.
5. Complete rollback drill and general-availability soak.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Premium planner produces plausible but wrong priorities | Scenario suite, structured evidence, shadow comparison, explicit skips, human review |
| Candidate generator secretly encodes strategy | Candidate audits, multiple candidates per event, no final priority fields, tests proving different dispositions |
| Costs rise despite routing | Dollar accounting, no-change zero-call rule, compact state, caching, cohort budgets |
| Migration loses creator context | Additive schemas, provenance-preserving backfill, dual reads, correction UI later |
| Shadow plans cannot be compared fairly | Frozen state versions, event watermarks, deterministic replay, rubric-based review |
| Planner creates excessive work | Backlog/inactivity controls, cost estimates, creator capacity, duplicate prevention |
| Outcomes create false causal learning | Hypotheses with confidence/counterevidence, minimum samples, reviewed shared learning |
| Gmail scope or behavior violates product policy | Remove provider drafting/sending, enforce in code and scopes, dedicated tests |
| Provider outage halts Mara | Equivalent evaluated providers, deterministic monitoring, honest deferral |
| Big-bang cutover harms users | Feature flags, allowlists, shadow mode, reversible cohorts, rollback drills |
| Shared intelligence leaks private data | Explicit eligibility rules, de-identification, minimum aggregation, tenant-isolation tests |
| Future workers copy Mara assumptions | Worker package boundary, shared contracts, second-worker conformance test |

## Migration exit criteria

Legacy strategic planning can be removed only when:

- Shadow plans pass evaluation and human-review thresholds.
- V2 demonstrates materially different work for different creator states.
- Every material task is commercially justified.
- Candidate generation is proven not to force strategy.
- Mara creates and schedules her own tasks.
- Outcomes and corrections change subsequent plans.
- No-change checkpoints use no premium model.
- Backlog and inactivity behavior prevent waste.
- No Mara path creates provider drafts or sends externally.
- A rollback drill succeeds.
- The shared runtime passes a second-worker conformance test.
