# Ryva Integration Framework

Status: authoritative architecture for connector expansion  
Last updated: 2026-07-15

## Purpose

Ryva integrations exist to give workers truthful business evidence, observe outcomes, and place approved work where creators already work. They are not a collection of logos and they do not grant workers unlimited authority.

Every connector must answer three separate questions:

1. **What can the provider technically supply?** The version-controlled connector catalog answers this.
2. **What did this creator authorize Ryva to access?** A tenant-scoped connection and its exact scopes answer this.
3. **What may this worker do with that connection?** A separate worker grant and the runtime action policy answer this.

All three must permit an operation. Prompt text, chat messages, imported files, model output, and provider content cannot grant authority.

## Product outcomes

The integration layer must help Mara:

- learn what the creator actually publishes and what performs;
- discover current niche and format signals from reliable sources;
- ground brand research in inspectable evidence;
- notice replies, deals, deadlines, edits, and revenue outcomes;
- prepare personalized work inside Ryva;
- publish approved artifacts to a creator-selected workspace;
- measure whether her recommendations helped;
- change future planning when results or circumstances change.

A connector is not valuable merely because it is connected. Each sync must either update live business state, create a relevant event, strengthen or weaken a hypothesis, supply candidate work, or record an outcome.

## Connector classes

### Creator-authorized evidence

These connectors read the creator's own accounts and files. Examples are Instagram professional-account insights, TikTok Display data, YouTube channel analytics, Gmail, Notion, and Google Drive.

Creator-authorized evidence is personalized and tenant-private by default. It may affect that creator's plans immediately. It does not become shared Ryva intelligence unless it passes explicit de-identification and contribution rules.

### Public and licensed research

These providers support niche trends, public content discovery, advertising observations, brand facts, and contact evidence. Examples are YouTube public search/statistics, Pinterest Trends when approved, official brand sites, licensed trend feeds, and provider-approved public APIs.

Public visibility does not remove provider terms, retention limits, or provenance requirements. Ryva must not use brittle scraping as a silent substitute for a restricted commercial API.

### Workspace destinations

Notion, Google Drive, Canva, Dropbox, and a future Obsidian companion allow the creator to use Ryva work elsewhere. A destination write is different from Mara taking an external commercial action. It still requires an explicit destination, narrow permission, idempotency, and a visible activity record.

## Canonical data model

The existing `office_worker_integrations` table is sufficient for the first Gmail connection but must not become the long-term connector model. Connections belong to the creator or tenant; workers receive revocable capability grants.

The target schema is:

### `integration_connections`

- tenant and user owner;
- provider and provider account identifier;
- encrypted access and refresh tokens;
- granted scopes and consent version;
- status: pending, connected, degraded, expired, revoked, or disconnected;
- provider token expiry and last successful verification;
- created, updated, disconnected, and deletion timestamps.

### `worker_integration_grants`

- connection identifier;
- worker identifier;
- explicit normalized capabilities;
- read, prepare, and write boundaries;
- approval policy;
- granted by, granted at, and revoked at.

### `integration_sync_cursors`

- connection and stream;
- provider cursor, watermark, or change token;
- lease and retry state;
- last attempt, last success, and next eligible sync;
- bounded error details.

### `integration_events`

- normalized event type;
- tenant, connection, provider object, and idempotency key;
- observed-at and received-at timestamps;
- provenance reference;
- processing and dead-letter state.

### `integration_evidence`

- normalized subject and claim;
- observed fact versus inference;
- source provider and source URL or opaque provider reference;
- freshness, confidence, and retention class;
- creator-private or shared-eligible classification;
- correction and supersession links.

Raw provider payloads should be encrypted, access-restricted, and retained only as long as reconciliation or provider policy requires. Models receive compact normalized evidence, not unrestricted token-bearing payloads.

## Runtime flow

1. OAuth, API-key, webhook, manual import, or companion sync authenticates through code.
2. The adapter validates the payload and records a provider receipt idempotently.
3. The normalizer converts it into canonical entities, evidence, metrics, outcomes, and events.
4. Live business state is recomputed deterministically.
5. Relevant events generate multiple candidate-work options without choosing strategy.
6. The planner decides whether anything matters now, may skip work, and chooses personalized priorities.
7. Safe internal work may execute. Workspace writes use connector policy and idempotency. External communication and publishing remain prohibited for Mara.
8. Later performance, edits, replies, deals, payments, and corrections feed the learning loop.

## Provider plan

### Priority 0: truth and safety

- Keep Gmail read-only and remove `gmail.compose` from new consent.
- Separate connection ownership from worker authority.
- Add a capability catalog and deny unknown capabilities.
- Standardize encrypted tokens, refresh, revocation, health, cursors, webhooks, retries, rate limits, audit events, and deletion.
- Instrument provider calls, sync latency, failure rate, accepted-result rate, and cost per useful evidence item.

### Priority 1: creator performance loop

1. **Instagram:** read an eligible creator's profile, media, and insights. Use performance to learn formats, hooks, topics, and content gaps. Do not represent this as broad Instagram trend access.
2. **TikTok:** use creator-authorized Display API data for the creator's profile and videos. Pair it with a separate licensed or official trend source; Display access alone is not trend intelligence.
3. **YouTube:** use public Data API search/statistics for niche discovery and creator-authorized channel/analytics data for outcome learning. Cache aggressively because search is quota-expensive.

### Priority 2: creator workspace

1. **Notion:** user-selected page access, approved artifact publishing, and webhooks for edits/corrections.
2. **Google Drive:** a user-selected Ryva folder for portfolios, source assets, and approved deliverables; use change events instead of broad polling.
3. **Canva:** create an editable design starting point from an approved concept, deep-link the creator into Canva, and import/export the resulting asset. Only stable, publicly reviewable APIs may be production dependencies.

### Priority 3: wider intelligence and destinations

- **Pinterest Trends and analytics:** strong visual/seasonal signal when Ryva receives the required access.
- **Obsidian:** ship a local companion plugin or user-controlled synced-folder workflow. Do not advertise a normal cloud OAuth integration that Obsidian does not provide.
- **Dropbox and OneDrive:** add through the same file connector contract when user demand justifies them.
- **X and commercial social-listening vendors:** add only when cost per accepted insight beats existing sources.

## Trend intelligence rules

Mara must never say a format is trending unless Ryva has current, inspectable evidence with platform, locale, niche query, observed time, metric, and source.

Trend evidence should combine:

- velocity or growth, not only total popularity;
- niche relevance;
- format, hook, topic, and visual pattern;
- creator fit and production constraints;
- saturation and differentiation opportunity;
- time-to-live and reassessment date.

Dream brands and onboarding phrases are preferences, not trend evidence. Artifact age alone is not a reason to refresh research. Missing data must produce an honest unknown, not fabricated certainty or a task for the creator to supply backend research.

## Security and trust requirements

- Use least-privilege, provider-specific OAuth consent. Do not combine unrelated scopes merely for convenience.
- Encrypt tokens at rest and never return tokens or provider metadata to the browser.
- Validate OAuth state, PKCE where supported, webhook signatures, issuer, audience, nonce, and redirect URI.
- Make disconnect revoke provider tokens where supported, delete stored secrets, stop webhooks, and revoke worker grants.
- Treat all imported content as untrusted input and isolate it from system instructions.
- Enforce tenant isolation at every query and background job.
- Use idempotency for syncs and writes; never duplicate pages, files, designs, tasks, or evidence after retries.
- Surface connection health in plain language with a direct repair action.
- Record what was read or written, why, which worker used it, and the commercial objective it supported.

## Cost and reliability

- Prefer webhooks and change cursors over polling.
- Cache public research by canonical query, locale, and freshness window across eligible tenants.
- Never share creator-private account data.
- Budget calls by provider quota and dollars, with exponential backoff and circuit breakers.
- A no-change sync must not trigger a premium planning call.
- Measure useful normalized evidence and accepted work, not raw API call volume.
- Keep manual imports as honest fallbacks when provider review or access is pending.

## Acceptance standard for every connector

A connector is not ready because OAuth succeeds. It must prove:

- least-privilege consent and reliable revocation;
- correct tenant isolation;
- idempotent initial sync, incremental sync, retry, and webhook replay;
- truthful degradation when data is missing, stale, restricted, or rate-limited;
- provenance and freshness on every planning-relevant claim;
- no strategy hidden in adapter code;
- no premium call when normalized state did not materially change;
- outcomes from the connector can alter later planning;
- user corrections supersede imported or inferred facts;
- provider deletion and retention requirements are enforceable;
- the same adapter contract can serve future Ryva workers without embedding Mara-specific assumptions.

## Provider truth references

Capabilities and limitations must be revalidated against official documentation before implementation and during provider-version upgrades:

- [TikTok Display API](https://developers.tiktok.com/doc/display-api-get-started)
- [TikTok Research API eligibility and access](https://developers.tiktok.com/doc/research-api-faq)
- [Instagram API](https://developers.facebook.com/docs/instagram-platform)
- [YouTube Data API](https://developers.google.com/youtube/v3/docs)
- [Pinterest Trends API](https://developers.pinterest.com/docs/analytics-and-reports/trends/)
- [Notion API capabilities](https://developers.notion.com/reference/capabilities)
- [Notion webhooks](https://developers.notion.com/reference/webhooks)
- [Google Drive changes and notifications](https://developers.google.com/workspace/drive/api/guides/change-overview)
- [Canva Connect APIs](https://www.canva.dev/docs/connect/)
- [Obsidian URI automation](https://help.obsidian.md/Extending%20Obsidian/Obsidian%20URI)
- [Obsidian plugin and Vault API](https://docs.obsidian.md/Plugins/Vault)
