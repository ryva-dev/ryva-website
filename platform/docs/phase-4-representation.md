# Phase 4 — Representation authority operations

Phase 4 adds the Representation and Placement workspaces while preserving the Phase
1–3 access, provenance, audit, and human-ownership controls.

## Authority lifecycle

1. Complete Brand diligence and move the Brand to `contact_ready`.
2. Open a Representation Opportunity with scoped Products, proposed channels and
   territory, an issued human Brand decision, and an owned next action.
3. Upload the original Agreement to the Opportunity. Uploads are hash verified and
   quarantined until the configured document scanner reports `clean`.
4. Create the Agreement from that clean original.
5. Review and edit every material term. Extraction candidates retain the original
   Document, page/location, origin, evidence class, confidence, ambiguity, and human
   disposition.
6. Record written house-account exclusions or protected-account bases. These are
   Agreement restrictions, not operational Protected Account records.
7. Request approval. Ryva creates an exact digest of the immutable original plus
   material scope and terms.
8. A human approves that exact digest. Any material edit clears approval and requires
   a new request.
9. Only an active, effective, unexpired, clean-document, human-approved Agreement can
   authorize Brand `authorized`/`active`, Product `represented`, Placement advancement,
   or future Outreach approval/send.
10. Suspending, expiring, or ending an Agreement immediately makes subsequent
    authority checks fail closed.

An upload, extracted candidate, proposed Territory, imported row, or Ryva-generated
record never creates representation rights.

## Documents and extraction

The existing provider callback remains the trust boundary for malware scanning.
Local uploads move to `scanning`; an authenticated scanner callback must set them to
`clean` before Agreement review or activation. Production requires object storage and
scanner provider credentials documented in `deployment.md`.

Original bytes use a stable storage key and write-once local semantics. Agreement
versions contain snapshots and digests; Agreement versions, authority evaluations,
and stage events have PostgreSQL mutation-prevention triggers.

AI execution remains Phase 7. The public Phase 4 API accepts manual or imported
extraction candidates only. AI may later suggest evidence-linked terms, but it cannot
approve authority or create binding interpretations.

## Shared authority decision

`POST /api/authority/evaluate` records a durable authority evaluation for:

- outreach preparation, approval, and send;
- Brand Authorized and Active;
- Product represented;
- Placement creation and stage advancement.

The result is `authorized`, `denied`, or `review_required` with reason codes and
visible conflict evidence. Phase 5 must call this same service; it must not implement
an independent UI-only authority check.

## Placement boundaries

Placement creation requires:

- current scoped Agreement authority;
- qualified or represented Products;
- a qualified or conditional Business;
- a qualified or conditional human Product–Business match review;
- an issued human decision;
- concrete Buyer value and a complete Relationship Triangle.

Commission-only Buyer rationales are rejected. Phase 4 permits evidence-backed
`identified`, `qualified`, and `prepared` states plus loss, disqualification, and
reopen history. Stages that claim Outreach, Order, Account, or Reorder activity remain
blocked until their construction increments.

## Imports

CSV preview supports Representation Opportunity and Agreement term mappings. It
validates fields and records provenance implications, but never commits or activates
authority. Controlled import commit remains Phase 9.

## Operational checks

Run:

```bash
npm run migrate
npm run test:all
npm run drill:backup-restore
```

Confirm document storage and scanner credentials before testing Agreement uploads in
a non-local environment. Legal or contractual ambiguity must be marked
`review_required` or `specialist_required`; the system does not interpret it.
