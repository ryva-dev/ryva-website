# Mara Model Routing

| Field | Value |
|---|---|
| Status | Normative target architecture |
| Version | 1.0.0 |
| Owner | Ryva Architecture |
| Last updated | 2026-07-14 |

## Purpose

Mara uses models where judgment creates customer value. She does not use a premium model for work code or a smaller model can perform reliably.

The objective is not minimum model usage. It is the lowest sustainable cost per accepted, useful customer outcome while preserving quality, trust, and safety.

## Provider-neutral interface

Tasks request a capability tier, context size, modality, latency class, structured-output support, and quality threshold. They do not hard-code a provider.

Provider assignments are configuration selected through evaluation. A provider change MUST NOT alter Mara's identity or authority.

## Tier 0: code only

Use no model for:

- Authentication, billing, and subscription enforcement
- Permissions and approvals
- Scheduling and calendar math
- Backlog and usage counts
- Exact duplicate detection
- Known state transitions
- Reminder timing
- Event routing and idempotency
- Email-thread and entity matching when deterministic keys exist
- File and integration state
- Invoice arithmetic and revenue totals
- Data retention and expiration
- Trigger detection
- Token and dollar budgets
- Tool execution and audit records
- Schema and basic evidence validation

Code-only work MUST remain observable and tested.

## Tier 1: small model

Use a low-cost model with strict schemas for:

- Email and message classification
- Basic intent detection
- Entity, deadline, amount, and deliverable extraction
- Message-to-opportunity matching when rules are insufficient
- Memory-candidate extraction
- Source-type classification
- Basic summaries
- User-edit comparison
- Routing and query generation
- Simple language detection or translation support

Tier 1 output is not final strategic judgment. Low-confidence or materially consequential results escalate.

## Tier 2: mid-tier model

Use a capable economical model for:

- Routine follow-up drafts
- Briefing synthesis from an approved plan
- Standard opportunity summaries
- Routine reply interpretation
- Schedule wording and time-block presentation
- Standard creator-platform applications
- Pitch revision after explicit creator direction
- Normal invoice descriptions
- Basic content feedback when evidence and rubric are clear
- Consolidation of multiple structured results

Tier 2 may produce customer-facing work only when it meets the task's quality threshold.

## Tier 3: premium model

Reserve the strongest evaluated model for meaningful judgment:

- Dynamic business diagnosis and planning
- Bottleneck identification and anticipation
- Niche and positioning strategy
- Deep brand and opportunity judgment
- High-quality personalized value propositions and outreach
- Ambiguous or sensitive reply interpretation
- Scam, reputation, or conflicting-evidence judgment
- Complex content and portfolio strategy
- High-value proactive intervention
- Correction of a materially flawed plan
- Work with high commercial or trust consequences

Planning is normally Tier 3 because it defines Mara's intelligence. A no-change checkpoint MUST not call it.

## Routing criteria

The router considers:

- Task and output type
- Required reasoning depth
- Ambiguity and evidence conflict
- Risk and reversibility
- Customer visibility and expected impact
- Commercial value at stake
- Required context and modality
- Structured-output reliability
- Historical model quality for this task
- Latency requirement
- Provider availability and rate limits
- Estimated input, output, and cached-token cost
- Subscription and user budget
- Retry history
- Whether a lower tier already failed

The cheapest model that reliably clears the task's quality threshold SHOULD be selected.

## Budget and accounting

Every request records:

- Tenant, subscription, worker, task, and planning run
- Provider, model, region if relevant, and prompt/playbook versions
- Input, output, reasoning, and cached tokens where reported
- Estimated and final dollar cost
- Latency and time to first token where available
- Retry and fallback count
- Success, schema failure, policy failure, or provider failure
- Output acceptance, edits, rejection, or abandonment
- Linked send, reply, opportunity, deal, payment, and revenue outcomes

Budgets MUST be dollar- and token-aware rather than call-count-only.

Budget policy prioritizes:

1. Safety and suspicious-activity handling
2. Active deals, deadlines, replies, and payments
3. High-value planning and current creator commitments
4. Qualified opportunity and creator-development work
5. Nonurgent refreshes and speculative research

## Caching

Eligible caches include:

- Stable system and worker identity prefixes
- Playbook retrieval results by version and state conditions
- Creator planning snapshots by state hash
- Public brand research by source and verification timestamp
- Shared trend and contact intelligence
- Deterministic extraction results by content hash
- Duplicate task and output detection
- Model output reuse when every material input and policy version is unchanged

Caches MUST include tenant scope where private data is involved, input hash, model and playbook version, expiration, and invalidation triggers.

The system MUST NOT reuse personalized output across tenants.

## Fallbacks

### Provider unavailable

- Try an evaluated equivalent within the same tier.
- If unavailable, defer nonurgent work.
- Degrade to a lower tier only when that tier clears the task's threshold.
- Preserve deterministic monitoring and urgent notifications.
- Never present placeholders or templates as completed professional judgment.

### Schema failure

- Apply deterministic parsing or one constrained repair attempt.
- Do not pay a second model merely to reformat routinely malformed JSON.
- Repeated failure lowers that model's task-specific routing score.

### Budget pressure

- Batch low-urgency tasks.
- Reuse current valid intelligence.
- Defer speculative work.
- Maintain active commercial and safety obligations.
- Explain material delays without exposing token accounting.

### Quality failure

- Retry with corrected evidence or a stronger tier when expected value justifies it.
- Otherwise return a blocker or request clarification.
- Do not silently downgrade quality on high-risk work.

## Quality thresholds

Each task type has a versioned rubric and minimum threshold covering:

- Factual and evidence correctness
- Creator specificity
- Professional usefulness
- Commercial relevance
- Safety and policy compliance
- Schema validity
- Unsupported-claim absence
- Duplication and generic-language limits
- Appropriate confidence and uncertainty

Premium review is required only when:

- Expected commercial value is high
- Risk or ambiguity is material
- Deterministic validation fails in a way requiring judgment
- The creator previously rejected similar work
- Scam, reputation, or contract-adjacent concerns exist
- The first model's confidence is below threshold

## Cost-per-accepted-result

Routing optimization uses accepted outcomes, not raw calls.

Required measures include:

- Cost per valid structured result
- Cost per creator-accepted deliverable
- Cost per materially edited deliverable
- Cost per approved pitch
- Cost per creator-sent pitch
- Cost per qualified contact and opportunity
- Cost per reply and positive reply
- Cost per progressed or won deal
- Cost per dollar of influenced revenue

A cheap output that is rejected, damages trust, or creates no progress is expensive. A higher-cost result that materially improves a valuable commercial outcome may be efficient.

## Initial planning cost policy

Before production rollout, evaluation scenarios define maximum reasonable per-event costs. These are internal launch ceilings, not customer promises. They MUST be recalibrated against actual provider pricing and acceptance data.

Routine no-change checks target $0 premium cost. Normal premium planning SHOULD target no more than $0.15 per meaningful assessment. Complex high-risk or multi-modal planning MAY use up to $0.40 only when the scenario standard explicitly allows it.

## Routing acceptance criteria

- A no-change checkpoint invokes no model.
- Extraction does not default to the premium model.
- Premium planning receives compact relevant context.
- Every call has token and dollar accounting.
- A provider outage has an honest degraded mode.
- A lower-cost model is promoted only after passing task evaluations.
- Accepted-result cost can be calculated through a commercial outcome.
- Model selection is configurable without changing worker identity or product policy.
