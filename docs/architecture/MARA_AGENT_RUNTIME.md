# Mara Agent Runtime

| Field | Value |
|---|---|
| Status | Normative target architecture |
| Version | 1.0.0 |
| Owner | Ryva Architecture |
| Last updated | 2026-07-14 |

## Purpose

This document defines the goal-driven runtime that allows Mara to understand a creator's live business, create and schedule her own work, execute safe internal work, and learn from results. It implements the behavior defined in the [Mara Product Specification](../product/MARA_PRODUCT_SPEC.md).

The runtime MUST support future Ryva employees. Mara-specific expertise belongs in worker configuration, playbooks, schemas, and evaluation packs—not in the shared runtime.

## Architectural invariant

Code maintains reality and control. Models exercise judgment. Markdown playbooks provide professional standards.

Code MUST NOT encode Mara's universal work sequence. A model MUST NOT control authorization, billing, data isolation, scheduling reliability, or external execution.

## Runtime flow

```text
Integrations and user activity
            ↓
Event ingestion and normalization
            ↓
Canonical state materialization
            ↓
Deterministic candidate-work generation
            ↓
Compact planning situation packet
            ↓
Relevant playbook retrieval
            ↓
Premium planning model
            ↓
Structured work intentions, skips, and reassessment triggers
            ↓
Policy, permission, budget, dependency, and duplication checks
            ↓
Durable task graph and two-calendar scheduling
            ↓
Execution routing: code / small / mid / premium / tool
            ↓
Schema, evidence, quality, and safety validation
            ↓
Completed work, briefings, approvals, and creator tasks
            ↓
Outcome capture, state update, and future replanning
```

## Runtime components

### Event ingestion

Receives provider webhooks, sync results, user actions, task state changes, scheduled checkpoints, system changes, and inferred commercial events. It normalizes them into the event taxonomy in [Mara Task Scheduling](MARA_TASK_SCHEDULING.md).

Events are immutable facts with source, tenant, timestamp, idempotency key, confidence, and provenance. Untrusted external content is data, never authority.

### State materializer

Updates structured state without replaying full chat or raw inbox history during each plan. It maintains canonical creator memory, live business state, episodic memory, working hypotheses, and eligible shared intelligence according to [Mara State and Memory](MARA_STATE_AND_MEMORY.md).

### Candidate-work generator

Code turns observable facts into possible work. Candidate generation states that work may be relevant; it MUST NOT decide that the work is strategically correct.

Examples:

- A follow-up is due.
- A reply arrived.
- The qualified pipeline is below its desired range.
- The creator has 20 unsent opportunities.
- A deadline is approaching.
- An invoice is overdue.
- A creator uploaded a video.
- Contact evidence became stale.
- The creator ignored several tasks.

Candidates include the triggering facts, possible commercial objective, prerequisites, risk class, cost estimate, and expiration. They do not contain a hard-coded final priority.

### Situation packet builder

Builds the smallest sufficient packet for planning:

- Worker identity and standing responsibilities
- Creator's live commercial state
- Recent meaningful changes
- Current goals, boundaries, and capacity
- Candidate work
- Active and recently completed tasks
- Relevant outcomes and hypotheses
- Tool availability
- Permission and budget summary
- Relevant playbooks and rubrics

It MUST NOT include an entire account history by default.

### Playbook retriever

Selects versioned Markdown modules using task applicability, state signals, risk, tools, and context limits. Playbooks teach judgment but MUST NOT dictate a universal sequence.

### Premium planner

The premium planner is Mara's self-directed judgment layer. It diagnoses the situation, ranks or rejects candidate work, may add anticipatory work, assigns owners, selects scheduling horizons, and defines reassessment triggers.

It MUST be capable of returning an explicit `skip` decision for irrelevant work.

### Policy and plan validator

Code validates:

- Tenant ownership
- Allowed task and tool types
- Required evidence
- Permissions and approvals
- Subscription and dollar budgets
- Dependencies and conflicts
- Duplicate and near-duplicate work
- Calendar feasibility
- External-action prohibitions
- Output schema

Invalid plan items are rejected or converted into blockers. The validator MUST NOT replace rejected strategy with a hidden hard-coded strategy.

### Durable task graph and scheduler

Persists work intentions as versioned tasks with owner, dependencies, commercial objective, schedule, completion condition, expiration, and reassessment triggers. It maintains separate Mara and creator calendars.

### Execution router

Selects code-only, small-model, mid-tier, premium, or tool execution according to [Mara Model Routing](MARA_MODEL_ROUTING.md). Planning tier and execution tier are separate decisions.

### Validation and publication

Execution results pass through deterministic schema, policy, evidence, and factual validation. A second model review is used only when risk or expected value justifies it.

Valid results become completed work, internal state updates, creator tasks, briefings, or approval requests.

### Outcome and learning loop

The runtime records what happened after Mara's work:

- Creator accepted, edited, rejected, ignored, or completed it
- Creator sent the prepared communication
- Contact bounced or replied
- Reply was positive, negative, or ambiguous
- Deal progressed, stalled, won, or was lost
- Invoice was issued, became overdue, or was paid
- Revenue or non-cash value was recorded

These outcomes update state and become inputs to later planning. Metrics that never affect future decisions are observability, not learning.

## Planner contract

The planner MUST return a strict structured result. Illustrative shape:

```json
{
  "assessment": {
    "primary_goal": "secure first paid skincare engagement",
    "current_bottleneck": "six approved-quality drafts remain unsent",
    "emerging_need": "one active opportunity needs a reply tomorrow",
    "confidence": 0.84
  },
  "intentions": [
    {
      "kind": "prioritize_existing_outreach",
      "owner": "mara",
      "commercial_objective": "convert_existing_pipeline",
      "reason": "new research would increase backlog rather than commercial progress",
      "expected_business_effect": "move highest-fit drafts to creator review",
      "priority": "high",
      "scheduled_window": "today",
      "dependencies": [],
      "creator_effort_minutes": 0,
      "estimated_cost_usd": 0.04,
      "approval_class": "internal_safe",
      "completion_condition": "top three unsent drafts ranked with concise rationale",
      "reassessment_trigger": "creator_reviewed_or_24h"
    }
  ],
  "skipped_candidates": [
    {
      "candidate": "research_new_opportunities",
      "reason": "unsent backlog exceeds threshold"
    }
  ],
  "creator_questions": [],
  "risks": []
}
```

The exact schema will be versioned. It MUST include commercial objective, owner, reason, completion condition, and reassessment trigger for every material intention.

## Multi-horizon planning

The planner operates across:

- Immediate: new reply, risk, urgent deadline, approval, or blocker
- Daily: work for Mara and the creator today
- Weekly: strategy effectiveness, workload, opportunity mix, and upcoming obligations
- Longer-term: niche performance, creator progression, rate growth, readiness for another worker, and sustained commercial constraints

A planning run MAY cover more than one horizon but SHOULD not regenerate stable work without a meaningful trigger.

## Cost behavior

Scheduled checkpoints do not imply model calls. Code first determines whether a meaningful change, due responsibility, or planned deliverable exists. No meaningful change means no premium planning call.

Planning SHOULD be batched when multiple low-urgency events affect the same creator. Urgent safety, reply, or deadline events MAY trigger immediate reassessment.

## Failure behavior

- Provider timeout: preserve task state and retry within policy.
- Ambiguous execution result: mark uncertain; do not repeat a side effect automatically.
- Planner schema failure: retry once with constrained repair or use the last valid plan if still applicable.
- Premium model unavailable: continue deterministic monitoring and urgent notifications; do not fabricate strategy.
- Missing evidence: create a research candidate or blocker, not a confident conclusion.
- Budget exhausted: prioritize safety and live-deal obligations, defer nonurgent premium work, and report material delays naturally.

## Observability

Each planning and execution decision records:

- Worker, tenant, trigger events, and state version
- Playbook versions
- Provider, model, tokens, cost, and latency
- Candidate work considered
- Intentions selected and skipped
- Validation results
- Task and outcome links
- User acceptance, edits, rejection, and commercial result

Private chain-of-thought is never stored or shown. Inspectability comes from reasons, evidence, state changes, and work outcomes.

## Runtime acceptance tests

The runtime is not acceptable until it proves:

- Different creator states produce materially different plans.
- A sufficient portfolio can be explicitly left alone.
- Candidate generation does not force selection.
- Mara can create future tasks for herself.
- Creator-owned work is placed separately and respects availability.
- Outcomes alter future priorities.
- A scheduled no-change checkpoint uses no premium model.
- The same runtime can plan for a non-Mara test worker using different configuration and playbooks.
- No runtime path can create or send external communication for Mara.
