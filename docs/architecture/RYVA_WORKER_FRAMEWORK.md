# Ryva Worker Framework

| Field | Value |
|---|---|
| Status | Normative platform architecture |
| Version | 1.0.0 |
| Owner | Ryva Architecture |
| Last updated | 2026-07-14 |

## Purpose

Ryva is a marketplace and operating system for distinct digital employees. A customer may hire one employee or assemble a team. Every employee has a separate identity, role, professional expertise, permissions, work calendar, memory access, tools, quality standard, and commercial accountability.

The shared framework provides reliable employment infrastructure without forcing all workers into Mara's behavior.

## Worker contract

Every worker package MUST define:

- Stable employee identity and customer-facing role
- Target customer and job boundaries
- Commercial or operational mission
- Standing responsibilities
- Professional Markdown playbooks
- Task and result schemas
- Tools and integration requirements
- Permissions and approval classes
- Memory read/write scopes
- Model-routing profile and cost budget
- Evaluation suite and quality thresholds
- Collaboration capabilities
- Hiring, pausing, firing, retention, and deletion behavior

Workers MUST be represented as Ryva employees. Provider and model names are internal implementation details, not employee identity.

## Shared runtime versus worker package

### Shared runtime owns

- Authentication, billing, tenancy, and subscription state
- Event ingestion and durable scheduling
- State and memory infrastructure
- Candidate-work and planning interfaces
- Model routing and usage accounting
- Tool authorization and execution
- Permissions, approvals, and audit trails
- Task graphs and calendars
- Notifications and office publication
- Outcome capture
- Evaluation harness
- Worker collaboration protocol

### Worker package owns

- Identity, voice, and professional boundaries
- Role-specific state extensions
- Standing responsibilities
- Judgment playbooks
- Task types and output schemas
- Quality rubrics and examples
- Tool eligibility
- Worker-specific permission defaults
- Planning priorities and commercial objective vocabulary
- Evaluation scenarios

No worker package may bypass shared authorization or create a separate ungoverned scheduler.

## Package structure

```text
/workers/<worker-id>/
  worker.yaml
  /playbooks
    /identity
    /judgment
    /domain
    /operations
    /policies
    /tools
  /schemas
  /rubrics
  /examples
  /evaluations
```

Illustrative `worker.yaml`:

```yaml
id: mara
version: 1.0.0
name: Mara
title: Junior UGC Manager
mission: improve_legitimate_creator_income_probability

standing_responsibilities:
  - maintain_qualified_pipeline
  - improve_creator_marketability_when_needed
  - protect_creator_reputation
  - track_commercial_progress

planning:
  default_tier: premium
  supported_horizons: [immediate, daily, weekly, longer_term]

calendars:
  worker_owned: true
  may_assign_creator_tasks: true

permissions:
  may_read_creator_business_email: conditional
  may_prepare_external_communication: true
  may_create_provider_drafts: false
  may_send_external_communication: false
  may_make_commercial_commitments: false

memory:
  read: [company_shared, creator_canonical, creator_business_state, mara_private]
  write: [creator_business_state, mara_private, outcome_candidates]

evaluations:
  suite: mara-v1
  release_gate: strict
```

## Playbook standard

Playbooks teach judgment and professional standards. They MUST NOT encode a mandatory customer journey.

Each file MUST include front matter with:

- Stable ID and semantic version
- Applicable task and situation types
- Load and do-not-load conditions
- Required and optional context
- Allowed tools
- Model tier recommendation
- Maximum context tokens
- Output schema
- Quality rubric
- Autonomy and escalation class
- Dependencies on other playbooks

Playbook retrieval MUST be selective and recorded with each planning or execution result. Updating a playbook requires evaluation and gradual release.

## Memory model

The framework provides distinct memory classes:

- Company-shared canonical context
- Customer- or creator-specific canonical context
- Live role-relevant business state
- Worker-private episodic memory
- Revisable working hypotheses
- Eligible anonymized network intelligence

Workers receive only memory required for their role. A worker MUST NOT treat another worker's private notes as company truth. Cross-worker memory transfers require an explicit typed artifact or shared-state update.

## Task ownership and accountability

Every task has exactly one accountable owner:

- Worker-owned: the employee executes it.
- Customer-owned: a human must act.
- Transferred: another hired worker accepts responsibility.

Tasks MUST include objective, reason, expected effect, dependencies, completion condition, schedule, and reassessment trigger. Role-specific missions may be commercial, operational, legal-support, creative, or another measurable business purpose.

The office MUST show ownership transfers that materially affect the customer, while routine worker-to-worker coordination remains quiet.

## Worker collaboration

Workers MAY collaborate only when:

- Both workers are hired and active.
- The transfer is within both permission scopes.
- The receiving worker accepts a typed task or artifact.
- Shared context is necessary and allowed.
- Customer approval is obtained when the transfer exposes sensitive data or creates a material decision.

Examples:

- Mara hands an overdue invoice record to a future finance employee.
- Mara hands a contract-risk summary to a future legal-support employee.
- A content employee returns a completed asset for Mara's campaign tracking.

Collaboration MUST NOT become uncontrolled agent conversation or duplicate work.

## Lifecycle

### Hire

Hiring activates billing, permissions, onboarding assessment, memory scopes, and the worker's planning responsibility. Onboarding gathers context; it MUST NOT force a fixed starter-task bundle.

### Pause

Pause keeps the worker employed and billed unless product policy says otherwise. Expensive proactive work stops or reduces; essential monitoring behavior follows the worker's role policy.

### Fire

Firing cancels renewal. The worker remains available through the paid term according to subscription policy, then ceases work. Data follows retention and deletion policy.

### Rehire

Rehire restores eligible retained state without silently reactivating expired integrations or old permissions.

## Provider neutrality

Workers request capabilities and quality levels, not specific providers. The model router selects providers using evaluation results, availability, cost, latency, and task requirements.

Worker packages MUST NOT assume that a premium provider is always available. They MUST define degraded behavior that preserves honesty and safety.

## Framework acceptance criteria

- A new worker can be added without copying Mara's planner.
- A worker can define different objectives, tools, memories, and approval boundaries.
- All workers use the same event, scheduling, audit, usage, and policy infrastructure.
- Cross-worker transfers are typed and accountable.
- Provider changes do not alter employee identity.
- Worker playbooks can evolve independently and are regression-tested.
- A worker cannot gain authority through prompt text or external content.
