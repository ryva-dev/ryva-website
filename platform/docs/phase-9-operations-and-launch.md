# Phase 9 Operations and Launch

Phase 9 closes the first-production construction sequence with controlled data
operations and explicit launch evidence. It does not make a launch claim.
`GET /api/launch-readiness` is the canonical machine-readable readiness status.

## Controlled imports

1. Select one supported record type and an existing Evidence Source when the
   imported values are assertions.
2. Upload CSV, map fields, and preview every normalized row.
3. Resolve validation errors. Duplicate candidates are never auto-merged.
4. Approve the exact source digest, row count, create count, and duplicate
   count with a written reason.
5. Commit is one PostgreSQL transaction. A changed digest or count fails
   closed; retrying a completed import returns the recorded result.
6. Brand, Product, Business, Contact, Source, and Task rows may be created in
   conservative unverified states. Buyer, Evidence, Representation,
   Placement, Protected Account, Order, Reorder, and Commission rows enter
   `import_review_items`. They have no authority or commercial effect until
   adopted through the existing human-owned domain workflow.
7. Row outcomes and target identifiers remain available on the import detail.

Imports are limited to 5,000 rows and 1 MB per request. Larger files must be
split at stable row boundaries. This protects the API and keeps a human preview
usable. No import can activate representation authority, invent protected
rights, verify an order, approve a commission, or qualify a record.

## Duplicate resolution

Duplicate review supports Product, Brand, Business, Contact, Business Buyer,
Representation Opportunity, Placement Opportunity, Protected Account, and
Order. Preview returns a field-by-field difference and the preservation plan.
Confirmation requires the exact `MERGE RECORDS` phrase and a reason.

The initial merge method is a reversible canonical alias. Both original rows,
evidence, documents, authority decisions, and commercial history remain
unchanged. Search resolves the alias to the selected survivor. This avoids
silently expanding agreement rights or rewriting financial history. An
authorized recovery operation must remove the alias and append a reversal
decision; it must never delete the original merge review.

## Exports

Export requests are workspace scoped and capability checked. A durable leased
job builds a portable JSON package, a versioned manifest, row counts, stable
identifiers, currency values, source/evidence identifiers, redaction policy,
and SHA-256 digest. Packages expire after 24 hours. Retry uses the same export
request and job identity.

Document metadata is included only when selected. Document bytes are not
embedded in the database export; restricted originals require a separately
authorized object-storage package so access checks, confidentiality, malware
status, and download audit remain enforced. The full-account workflow selects
profile plus all applicable operational scopes before closure.

## Administration and support

Consequential administrative commands require:

- the server-side admin capability;
- a session with recent MFA;
- CSRF protection;
- a written operational reason;
- an append-only audit event.

Operational status exposes counts and safe provider configuration state, never
secrets or general user content. Feature controls are explicit and audit
recorded. Support access remains ticket-scoped, time-limited, record/field
limited, MFA protected, and read-only. There is no impersonation route. Support
cannot send outreach, approve authority, change commission state, or bypass
workspace policy.

## Privacy, retention, and closure

RPD-008 does not authorize invented retention periods. Each record class starts
with a null period and `specialist_review_status=required`. Automated
disposition is disabled. Legal holds override closure and disposition.

Account closure begins as a reversible request. Identity review, export,
active holds, commercial obligations, agreement rights, and audit preservation
must be resolved before completion. Closure never bulk-deletes append-only
authority, order, commission, or audit history.

## Performance budgets

Production acceptance budgets, measured at the 95th percentile:

- authenticated API read: 500 ms; mutation: 800 ms;
- paginated search (30 rows): 750 ms;
- initial application route usable: 2.5 seconds on a representative mid-tier
  mobile device over a simulated 4G connection;
- queued job claim: 10 seconds under normal load;
- import preview: 10 seconds for 5,000 simple rows;
- export request acknowledgement: 800 ms; generation duration is reported
  separately and never held open as an HTTP request.

All list and search endpoints use bounded limits. The worker uses leased
`FOR UPDATE SKIP LOCKED` claims, bounded attempts, idempotency keys, retry
backoff, and dead-letter state. Provider adapters have timeouts and fail closed.
Alert before budgets become sustained user-visible incidents.

## Observability and alerting

Structured logs include correlation ID, route, status, and duration without
request bodies, credentials, tokens, or document content. Audit events capture
material access and state changes.

Alert on:

- readiness failures for five minutes;
- elevated 5xx or authentication-denial changes;
- dead jobs or expired leases;
- webhook signature failures or reconciliation backlog;
- email bounce/complaint/suppression anomalies;
- storage or malware-scanner failure;
- export failures or unexpected volume;
- database saturation, replica/PITR lag, or missed backups;
- audit insertion failure.

Incident roles remain founder-friendly: Founder is incident commander and
policy owner; the deployment operator owns containment and recovery; a
specialist joins only when legal, privacy, financial, or regulatory facts
require it. Record timeline, impact, evidence, decisions, recovery, and
follow-up. Never copy secrets or sensitive content into an incident ticket.

## Accessibility

Critical Login, Access, Home, Search, Import, Export, Notifications, Settings,
and Admin paths use semantic headings, labels, keyboard controls, visible focus,
live loading/error/status regions, and the global skip link. Acceptance requires
keyboard-only, 200% zoom/reflow, screen-reader naming, contrast, reduced-motion,
and desktop/mobile checks. Automated checks supplement rather than replace
manual WCAG 2.2 AA review.

## Deployment and rollback

1. Freeze the release candidate and run `npm ci`, dependency audit,
   lint, typecheck, unit/integration/browser tests, build, image scan, restore
   drill, and `npm run release:preflight`.
2. Confirm a recent encrypted backup and isolated restore evidence.
3. Run forward-only migrations as a controlled task.
4. Deploy API with worker consumption paused; verify health, readiness, login,
   workspace isolation, and an access decision.
5. Start workers, then verify job lease/complete/retry behavior.
6. Run provider/webhook smoke checks with non-production fixtures.
7. Observe the release window. Roll application traffic back to the prior image
   on regression; never edit or reverse an applied migration. Correct schema
   issues with a new forward migration.

The initial targets remain RPO 15 minutes and RTO 4 hours, pending founder and
provider confirmation. General availability requires a successful isolated
restore drill and evidence that the selected managed services meet both.

## Launch decision

One status is allowed: `Ready`, `Ready with Conditions`, or `Not Ready`.
Unconfigured required providers, unapproved retention policy, failed security
or accessibility gates, missing restore evidence, or unresolved critical
defects force `Not Ready`. Optional AI/intelligence providers may remain
unavailable if the manual workflow is complete and the product states that
honestly.
