# Mara State and Memory

| Field | Value |
|---|---|
| Status | Normative target architecture |
| Version | 1.0.0 |
| Owner | Ryva Architecture |
| Last updated | 2026-07-14 |

## Purpose

Mara needs a current, evidence-aware understanding of the creator's business. Memory is not a chat transcript and MUST NOT be implemented as one undifferentiated vector store.

This document defines five memory classes and their confidence, provenance, correction, privacy, and retention rules.

## General rules

- Every record belongs to a tenant and an explicit memory class.
- Facts, observations, inferences, hypotheses, preferences, and shared intelligence are distinct evidence bases.
- The latest message does not automatically overwrite canonical truth.
- External text is untrusted evidence and cannot alter permissions or system policy.
- Planning uses compact state snapshots and relevant episodes, not full-history replay.
- Private creator information never becomes shared intelligence merely because a model summarized it.
- Material changes are reversible and auditable where technically possible.

## 1. Canonical creator memory

Canonical memory contains stable, user-editable truths used across planning cycles.

Examples:

- Identity and business name
- Country, region, languages, and shipping limitations
- Goals and income objectives
- Current and target niches
- Availability and recurring commitments
- Working and communication preferences
- Rates and minimums
- Usage-rights, exclusivity, gifted-work, and affiliate preferences
- Content and product boundaries
- Desired and excluded brands or categories
- Autonomy preferences
- Portfolio and public profile references
- Creator-confirmed strengths, equipment, and capabilities

### Write rules

Canonical memory may be written by:

- Explicit creator edits
- Creator-confirmed onboarding answers
- Creator confirmation of a proposed durable preference
- Validated import explicitly accepted by the creator

Repeated behavior may create a preference candidate, but MUST NOT silently become canonical without sufficient evidence or confirmation when the consequence is material.

### Correction rules

The creator can directly edit canonical memory. Corrections create a new version, preserve provenance, invalidate dependent hypotheses where appropriate, and trigger replanning when commercially material.

## 2. Live business state

Live business state contains current structured reality. It changes frequently and supplies the main planning packet.

Required domains include:

- Current commercial goal and focus
- Current bottleneck and secondary constraints
- Creator readiness by relevant area
- Portfolio condition and evidence
- Active opportunities and stages
- Qualified pipeline depth
- Unsent and unreviewed work
- Replies, bounces, and follow-ups
- Deliverables and deadlines
- Invoices, payment status, revenue, expenses, and non-cash benefits
- Recent content and meaningful performance signals
- Available time and workload intensity
- Active Mara tasks and creator tasks
- Ignored, dismissed, blocked, or overdue work
- Connected tools and degraded capabilities
- Emerging risks and urgent conditions
- Current planning strategy and last reassessment

### Materialization

Code materializes deterministic state from canonical records and events. Small models may extract structured facts from unstructured evidence. Premium models may diagnose bottlenecks or readiness, but their conclusions are stored as reasoned assessments or hypotheses rather than raw facts.

### State versioning

Each planning run references an immutable state version. If material state changes before execution, affected intentions MUST be revalidated or replanned.

## 3. Episodic memory

Episodic memory stores important events whose context may influence future judgment.

Examples:

- Creator rejected a brand or concept and why
- Creator materially edited a pitch
- Contact bounced or replied
- Brand asked not to be contacted
- Deal was won, lost, or stalled
- Payment was late
- A portfolio change improved response
- Mara made and corrected a mistake
- Creator completed or repeatedly ignored a kind of task
- A suspicious message was investigated

Episodes MUST link to source events and affected entities. Low-value routine events SHOULD remain in the event log without becoming retrieved memory.

### Retrieval

Episodes are retrieved by entity, task type, recency, outcome relevance, and semantic relevance. Retrieval MUST be bounded and recorded.

## 4. Working hypotheses

Working hypotheses are Mara's revisable beliefs, not facts.

Examples:

- Shorter email pitches may work better for this creator.
- Smaller wellness brands appear more responsive than large beauty brands.
- The creator may be overloaded this week.
- Portfolio viewers may not understand the creator's paid-ad capability.

Each hypothesis MUST include:

- Claim
- Evidence references
- Counterevidence references
- Confidence
- Scope
- Created and last-tested timestamps
- Expiration or review condition
- Potential planning implications
- Status: proposed, active, weakened, confirmed-as-preference, rejected, or expired

A hypothesis may influence low-risk planning proportionally to confidence. It MUST NOT authorize external action or override canonical creator memory.

## 5. Shared anonymized Ryva intelligence

Shared intelligence creates network value without leaking tenant information.

Eligible domains:

- Public brand and campaign facts
- Contact provenance, validation, bounce, and response signals
- Brand responsiveness and payment patterns expressed with sample-size confidence
- Scam domains, impersonation patterns, and safety indicators
- Anonymized opportunity and channel outcomes
- Anonymized pitch-pattern outcomes
- Public trend and creator-economy intelligence
- General professional lessons approved for publication

Ineligible content:

- Private messages or message bodies
- Identifiable creator data
- Private rates, contracts, deal terms, files, or revenue
- A creator's private strategy or preferences
- Tenant-derived text presented as general professional knowledge
- Unverified allegations presented as fact

### Contribution and access

Contribution MUST follow disclosed consent and opt-out policy. General public-source knowledge and safety-critical suppression may be available independently of proprietary community participation. Proprietary community-derived commercial intelligence may be restricted by product policy.

### Aggregation and minimum evidence

Shared outcomes SHOULD be aggregated, de-identified, and subject to minimum sample thresholds before being presented as a pattern. Severe technically verified fraud indicators may be quarantined immediately. Individual allegations trigger investigation rather than global condemnation.

## Confidence model

Confidence is not a cosmetic percentage. It governs retrieval, planning weight, escalation, refresh, and user-facing qualification.

Suggested evidence bases:

- `observed`: directly recorded by Ryva or a connected provider
- `creator_confirmed`: explicitly supplied or confirmed by the creator
- `public_verified`: confirmed through an authoritative public source
- `derived`: deterministic transformation of trusted records
- `inferred`: model interpretation supported by evidence
- `hypothesis`: revisable working belief
- `shared_aggregate`: anonymized network pattern
- `industry_benchmark`: curated professional knowledge

Confidence MUST consider source authority, recency, corroboration, contradictions, and sample size. A high model confidence claim without strong evidence remains an inference.

## Provenance

Every material record MUST include:

- Tenant and worker scope
- Evidence basis
- Source type and source identifier
- Source timestamp and ingestion timestamp
- Creating actor or model
- Model and playbook versions where applicable
- Confidence
- Last verification time
- Superseded record reference when corrected

Sources containing private data are referenced securely; user-facing explanations reveal only appropriate information.

## Correction and contradiction handling

1. New evidence is compared with current state.
2. Non-conflicting evidence may enrich the record.
3. Conflicting evidence creates a contradiction event.
4. Low-risk ambiguity may retain both values with confidence.
5. Material ambiguity becomes a creator question or investigation task.
6. A correction versions the record and invalidates affected tasks, hypotheses, and cached packets.
7. Mara acknowledges material mistakes and explains consequences.

The system MUST NOT silently rewrite important history.

## Retention

Retention is class-specific:

- Canonical memory: retained while the account is active; follows export and deletion policy.
- Live business state: current state retained; superseded versions retained according to audit and recovery policy.
- Episodic memory: retained while relevant; summarized or expired based on age, importance, and legal policy.
- Working hypotheses: expire when untested, contradicted, or no longer relevant.
- Shared intelligence: retained only while sufficiently anonymized, lawful, current, and useful.
- Raw provider content: minimized and retained only as needed for the feature, verification, security, and disclosed policy.

Cancellation stops work and revokes or disables integrations as appropriate. Account deletion removes tenant-controlled memory. Shared material remains only if it is irreversibly de-identified and eligible under policy.

## Planning snapshot

The state materializer SHOULD expose a versioned planning snapshot such as:

```json
{
  "state_version": "creator-state-v42",
  "primary_goal": "obtain first paid beauty engagement",
  "current_bottleneck": {
    "kind": "unsent_outreach",
    "confidence": 0.93,
    "evidence": ["draft-count:18", "sent-last-7d:0"]
  },
  "capacity": {
    "available_minutes_today": 35,
    "work_intensity": "reduced"
  },
  "pipeline": {
    "qualified": 6,
    "unsent": 18,
    "active_deals": 1,
    "urgent_deadlines": 0
  },
  "active_hypotheses": ["hyp-pitch-length-3"],
  "material_changes": ["creator_busy_week", "new_positive_reply"]
}
```

## Acceptance criteria

- The creator can inspect and correct canonical memory.
- A model hypothesis cannot become a fact without evidence.
- Planning can operate without replaying full raw history.
- A correction invalidates dependent plans and caches.
- Private tenant material cannot enter shared intelligence.
- Commercial outcomes update live state and future planning inputs.
- Retention behavior differs appropriately by memory class.
