# Phase 8 Home and Analytics Command Center

Phase 8 turns current, workspace-authorized Ryva records into an explainable
operating view. It does not add a Product Score, hidden weight, stage
probability, statistical forecast, currency conversion, autonomous decision, or
fabricated external intelligence.

## Shared calculation source

`packages/domain/src/analytics.ts` owns the versioned metric dictionary and
calculations consumed by Home, Analytics, report exports, alerts, and Phase 7
workspace briefings. Each definition records its business meaning, formula,
included and excluded records, period and currency behavior, value status,
freshness, limitations, source record types, and version.

Money is grouped by stored ISO currency. Verified Order actuals and Commission
expected, approved, payable, paid, disputed, overdue, and clawback values remain
separate. Expected Commission uses the current immutable Phase 6 calculation
when present and the explicitly labeled expected record only as a compatibility
fallback. Empty provider state is “not connected,” never a manufactured zero.

## Home priority behavior

Home presents at most seven items. The deterministic rule order is:

1. authority, legal ambiguity, protection, conflict, and dispute blockers;
2. mandatory approvals and overdue human commitments;
3. unclassified replies and messages waiting for exact-content approval;
4. due Commission, protection, and Reorder records;
5. stalled Placement Opportunities and missing next actions;
6. stale Evidence and lower-severity Risk Flags.

Every item displays its source reason, contributing factors, linked record, and
required action. User snooze, dismissal, completion, restoration, and manual
reprioritization append history. A Home action cannot silently resolve an
Agreement, protection, or Commission-dispute blocker; those must be resolved in
their authoritative workflow. “What Changed” advances only through an explicit
user acknowledgement.

## Forecasting boundary

Forecast records are human-entered low, base, and high ranges with a qualitative
likelihood, date horizon, assumptions, limitations, and one or more authorized
Evidence records. The database enforces low ≤ base ≤ high. Weighted pipeline,
stage probabilities, guaranteed-income language, and system-generated
predictions are disabled under RPD-004.

`FutureIntelligenceModelContract` is an interface contract only. It describes
future lineage, model/output versions, evidence, review, monitoring, and
rollback requirements but has no execution path.

## Reports and outreach claims

Saved report definitions preserve filters and selected columns. CSV export is
permission-controlled and audited, and includes generation time, filters,
metric-definition versions, currency separation, and value-status labels.
Restricted security, session, credential, and provider payload data are never
included.

A numerical outreach claim must select a current reviewed/verified Direct
Evidence or Verified Fact, or a verified external observation. Every number in
the draft claim must occur in that source. Stale sources are rejected. This
selection does not approve or send the message; Phase 5 authority, suppression,
conflict, exact-content approval, and delivery controls still apply.

## Alerts and worker operation

The PostgreSQL worker refreshes Phase 8 alerts daily with leased, idempotent
jobs. Alert grouping prevents duplicates while an equivalent notification is
active. Alert conditions use the same Home priority source plus outreach-health
and certification checks. Start the worker with:

```bash
npm run start:worker
```

No additional credential is required for stored-record analytics. A future
external intelligence adapter must write provenance-linked, verified
observations with an explicit freshness window before values become available.

