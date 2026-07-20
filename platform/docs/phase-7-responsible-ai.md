# Phase 7 Responsible AI Assistance

Phase 7 adds an evidence-first copilot. It creates reviewable suggestions; it
does not become a Representative, approve a record, send a communication,
negotiate a term, or change an operational or financial state.

## Provider configuration

Configure the provider-neutral HTTPS adapter with:

- `AI_GENERATION_ENABLED=1`
- `AI_PROVIDER_URL`
- `AI_PROVIDER_TOKEN`
- `AI_MODEL` and `AI_MODEL_VERSION`
- `AI_PROVIDER_RETENTION_MODE`
- `AI_PROVIDER_TRAINING_ALLOWED=0`

The provider endpoint receives a versioned structured request at `POST
/generate`. It must return the statement, classification, citation, confidence,
missing-evidence, limitation, contrary-evidence, usage, and optional extraction
candidate fields defined by the adapter schema. Tool access is always an empty
list. Production startup rejects provider training and incomplete enabled
configuration.

AI is also an opt-in workspace preference. If the provider, system control, or
workspace preference is off, existing suggestions remain inspectable and all
manual workflows remain available. Admins with MFA can use the audited global
kill switch.

## Evidence and human review

Each run stores an immutable snapshot of the authorized supporting records,
evidence class, source identifiers, freshness, limitations, permitted use, and
content digest. Every material output statement must cite that snapshot.
Unsupported statements are downgraded to `Unknown`; confidence cannot exceed
the packaged evidence.

Suggestions are editable and retain their original content. Accept, edit,
reject, feedback, problem reports, and regeneration append human actions.
Acceptance means “reviewed content” only and never applies fields or decisions
to a Product, Brand, Buyer, Agreement, Placement, Outreach record, Account,
Order, Reorder, Commission, or Dispute.

Clean, non-restricted document uploads can enqueue an opt-in durable extraction
job. Extracted fields require exact source locations and are explicitly
uncommitted and human-review-required. Restricted documents are never
automatically submitted; an authorized user may deliberately request extraction
when policy and provider terms permit it.

## Privacy, security, and operations

- Context is workspace-scoped before it reaches the provider.
- Secrets, credentials, tokens, direct email/phone values, storage keys, and
  raw provider payloads are excluded from model context.
- Provider training is prohibited and recorded as false on every run.
- Prompt instructions cannot add tools or override authority, suppression,
  conflict, human-approval, or commercial controls.
- Provider failures create a safe failed run and do not mutate target records.
- Request/run provenance, latency, token usage, cost metadata, dispositions,
  kill-switch changes, and job outcomes are audited.
- Run the PostgreSQL-backed worker with `npm run start:worker` for automatic
  extraction suggestions.

## Future intelligence hooks

The adapter, versioned context package, structured response schema, use-case
registry, evidence citations, and model/version telemetry allow later approved
intelligence models to be connected without changing the review contract.
Phase 7 intentionally contains no Product Score, hidden weight, predictive
forecast, autonomous agent, or placeholder prediction.

