# Mara Task Scheduling

| Field | Value |
|---|---|
| Status | Normative target architecture |
| Version | 1.0.0 |
| Owner | Ryva Architecture |
| Last updated | 2026-07-14 |

## Purpose

Mara is a self-scheduling employee. The creator does not define all of her recurring tasks. The system detects meaningful conditions, a premium planner decides what work matters, and code makes the plan durable and reliable.

Scheduling MUST be dynamic, commercially justified, event-driven, and separated into Mara-owned and creator-owned calendars.

## Event taxonomy

All events are immutable, tenant-scoped, timestamped, idempotent, and provenance-bearing.

### Creator events

- `creator_onboarding_completed`
- `creator_profile_corrected`
- `creator_goal_changed`
- `creator_niche_changed`
- `creator_availability_changed`
- `creator_busy_period_started|ended`
- `creator_task_completed|ignored|dismissed`
- `creator_draft_edited|approved|rejected`
- `creator_workload_reduced|resumed`
- `creator_paused|resumed`

### Communication events

- `business_message_received`
- `creator_message_sent_detected`
- `message_bounced`
- `reply_received`
- `reply_classified`
- `follow_up_became_due`
- `contact_suppressed`

### Opportunity and deal events

- `opportunity_discovered`
- `opportunity_qualified|disqualified`
- `opportunity_became_stale|expired`
- `application_deadline_approaching`
- `deal_stage_changed`
- `deal_won|lost|stalled`
- `deliverable_due|completed`

### Financial events

- `invoice_preparation_needed`
- `invoice_issued_detected`
- `payment_due_soon|overdue|received`
- `revenue_recorded`
- `expense_recorded`
- `non_cash_benefit_recorded`

### Content and portfolio events

- `content_uploaded_for_review`
- `content_performance_ready`
- `portfolio_created|updated`
- `portfolio_link_broken`
- `portfolio_evidence_became_stale`
- `positioning_changed`

### Research and intelligence events

- `brand_evidence_changed`
- `contact_evidence_changed`
- `trend_signal_published`
- `risk_signal_detected`
- `shared_intelligence_corrected`

### System events

- `scheduled_checkpoint`
- `task_due|blocked|failed|completed|expired`
- `approval_requested|resolved`
- `integration_connected|degraded|disconnected`
- `budget_threshold_reached`
- `worker_hired|paused|fired|rehired`

## Candidate-work generation

Deterministic rules turn facts into candidate work. Candidates are invitations for planner judgment, not final tasks.

Each candidate includes:

- Candidate type and source event IDs
- Possible commercial objective
- Relevant entity IDs
- Earliest and latest useful execution times
- Known prerequisites and dependencies
- Risk and approval class
- Estimated execution tier and cost range
- Evidence requirements
- Expiration condition
- Deduplication key

Example:

```json
{
  "candidate_type": "prepare_follow_up",
  "source_events": ["evt-followup-due-44"],
  "possible_commercial_objective": "increase_reply_probability",
  "not_before": "2026-07-16T09:00:00-04:00",
  "expires_at": "2026-07-18T17:00:00-04:00",
  "dependencies": ["contact-not-suppressed", "no-reply-received"],
  "risk_class": "external_draft_only",
  "dedupe_key": "followup:opp-18:attempt-1"
}
```

The candidate generator MUST NOT assign final priority based on a hidden product workflow.

## Dynamic task creation

The premium planner selects, rejects, combines, defers, or replaces candidates and may propose anticipatory tasks. A material task requires:

- Accountable owner
- Commercial objective
- Trigger and reason
- Expected business effect
- Priority and horizon
- Scheduled window
- Dependencies
- Creator effort estimate where applicable
- Estimated cost
- Approval class
- Completion condition
- Reassessment trigger
- Expiration policy

The policy engine validates the task. Validation may reject a plan but MUST NOT silently substitute a hard-coded strategy.

## Task ownership

### Mara-owned tasks

Mara can own safe internal work such as:

- Research and evidence collection
- Opportunity assessment
- Contact validation
- Draft preparation inside Ryva
- Inbox analysis
- Content or performance analysis
- Pipeline and state maintenance
- Schedule and briefing preparation
- Invoice preparation inside Ryva
- Risk investigation
- Outcome synthesis

### Creator-owned tasks

The creator owns actions requiring identity, physical creation, external communication, legal or commercial commitment, or unavailable platform access:

- Film, edit, upload, or publish content
- Review or revise prepared communication
- Send external communication
- Choose or confirm rates and terms
- Sign agreements
- Approve final invoices or external submissions
- Complete platform applications Ryva cannot submit
- Supply missing information or evidence

Task ownership cannot be ambiguous. A handoff changes ownership through an auditable event.

## Planning horizons

### Immediate

Minutes to hours: new reply, urgent deadline, severe risk, approval, bounce, or newly unblocked task.

### Daily

What Mara should complete today, what the creator should do, and what briefing or decision should be ready.

### Weekly

Whether targeting works, workload is sustainable, the pipeline is healthy, content or portfolio work is warranted, and upcoming obligations are covered.

### Longer-term

Niche performance, rate and revenue progression, recurring constraints, creator readiness for a different employee, and whether Mara remains the right role.

Planning horizons are coordinated but not regenerated unnecessarily.

## Weekday opportunity responsibility

Monday through Friday, the planner considers candidate work to maintain a pipeline capable of producing up to three new primarily paid opportunities when appropriate.

The planner SHOULD skip or reduce opportunity work when:

- Opportunity backlog is excessive
- Urgent replies or active deals need attention
- The creator lacks capacity to act
- Portfolio or positioning is a demonstrated constraint
- Contact quality is insufficient
- Time-sensitive applications or deadlines dominate expected value
- The creator requested a temporary reduction
- Research would produce lower value than existing work

Weekends have no prescribed task category. The planner chooses work from live state.

## Dependencies and task graph

Tasks form a directed graph. Dependencies may include:

- Required creator decision
- Required evidence or contact confidence
- Integration availability
- Preceding task completion
- Waiting period or provider data maturity
- Budget availability
- Approval state
- Another worker's artifact

Blocked tasks do not repeatedly invoke premium models unless a meaningful dependency changes.

## Idempotency and duplication

Every task has a semantic idempotency key based on tenant, entity, purpose, attempt, and relevant state version. The scheduler MUST prevent duplicate execution across retries, deploys, and overlapping checkpoints.

The system checks:

- Exact duplicate tasks
- Equivalent active intentions
- Recently completed equivalent work
- Stale-input regeneration
- Duplicate opportunity recommendations to the same creator
- Duplicate external-draft content

## Reassessment triggers

Every planned task identifies when its relevance should be reconsidered, such as:

- New reply or bounce
- Creator approval, edit, rejection, or completion
- Material state correction
- Deadline threshold
- Integration recovery or failure
- Research evidence update
- Outcome recorded
- 24-hour or weekly checkpoint
- Backlog crossing a threshold
- Creator capacity change

Reassessment may keep, reschedule, modify, replace, or cancel work.

## Expiration

Tasks expire when their useful window closes, evidence becomes invalid, the underlying opportunity expires, dependencies cannot resolve in time, or a newer plan supersedes them.

Expiration archives the task with a reason; it does not erase history. Drafts tied to expired opportunities MUST no longer appear ready for use without revalidation.

## Pausing and resuming

### Temporary workload reduction

The creator may declare a busy period. Mara reduces volume and creator effort while maintaining urgent monitoring and live obligations.

### User pause

Pause suspends nonessential proactive work. Billing behavior follows product policy. Essential deterministic monitoring may continue if authorized and disclosed.

### System pause

The system pauses expensive work because of backlog, inactivity, budget, provider degradation, or safety. It records a reason and resume condition.

### Resume

Resume requires the relevant trigger, such as backlog reduction, creator activity, budget reset, integration recovery, or explicit user action. The system MUST reassess stale tasks before execution.

## Backlog management

Twenty unsent opportunities is the initial hard pause threshold for new opportunity discovery. Resume SHOULD use hysteresis, initially below 15, so research does not toggle repeatedly.

At the pause threshold Mara redirects effort toward:

- Ranking existing opportunities
- Improving or dismissing weak drafts
- Making creator review manageable
- Resolving missing contacts or evidence
- Live deals, replies, deadlines, invoices, and content work

The planner may pause earlier when creator capacity or engagement indicates overwhelm.

### Contactless-opportunity back burner

Contact discovery is always Mara-owned. A failed discovery attempt moves the opportunity to `contact_needed`, records a future retry time, and removes it from pitch and creator-action queues. The planner uses available discovery capacity for alternative revenue-ready opportunities instead of repeatedly drafting for or deep-refreshing the parked brand. A due retry may restore the opportunity to `contact_found`; another failure reschedules it idempotently. Missing contact data alone MUST NOT create a creator-owned task, approval, or blocker.

## Inactivity throttling

When the creator repeatedly ignores or does not complete work:

1. Reduce expensive research and new drafts.
2. Continue low-cost state maintenance and urgent monitoring.
3. Present one clear re-entry task.
4. Enter dormant mode after the configured threshold.
5. Resume only after meaningful engagement or an urgent event.

Dormant mode MUST NOT continue generating plans, content, or encouragement merely to appear active.

## Scheduling around availability

Creator tasks use:

- Recurring availability and unavailable periods
- Job, classes, childcare, appointments, and routines
- Preferred work times and work style
- Task duration and energy requirements
- Deadlines and dependencies
- Temporary workload adjustments
- Connected calendar conflicts where authorized

Mara-owned work is scheduled to deliver inputs before the creator needs them. It does not need to mirror the creator's work hours unless an immediate collaboration is required.

Time zones are explicit. Calendar writes are idempotent and reversible.

## Scheduling acceptance criteria

- Mara can create a future task without a user prompt.
- The same event can produce different tasks for different creator states.
- Code can produce a candidate that the planner skips.
- Every material task has a commercial objective.
- Weekends generate no automatic portfolio task.
- Twenty unsent opportunities pauses discovery.
- Dormant users do not consume repeated premium planning calls.
- Creator tasks fit known availability and remain separate from Mara's calendar.
- A reply, payment, correction, or rejection can cancel or change future work.
