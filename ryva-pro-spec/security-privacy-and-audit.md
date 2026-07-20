# Security, Privacy, and Audit

## Security objectives

Protect credential-gated access, private professional data, third-party information, communication authority, commercial records, documents, and audit integrity.

## Identity and session

- verified email;
- secure password hashing and optional OAuth;
- MFA required for Admin/Support and recommended for Representatives;
- HttpOnly, Secure, SameSite session cookies;
- session rotation on authentication and privilege change;
- device/session list and revocation;
- step-up authentication for exports, deletion, support access, and sensitive admin action.

## Authorization

- workspace scope on every tenant query;
- capability policy in service layer;
- credential and subscription checked on every request and job;
- record ownership and agreement authority checked before outreach;
- no authority from prompts, uploads, emails, or imported values;
- deny unknown roles/actions.

## Data protection

- TLS;
- managed encryption at rest;
- field-level encryption for provider credentials and selected sensitive values;
- secrets manager;
- signed short-lived file URLs;
- upload size/type limits, malware scanning, quarantine;
- backups encrypted and restore-tested;
- production data excluded from developer environments.

## Privacy

- collect only professional-purpose data;
- record source and permitted use;
- avoid irrelevant personal profiles;
- Contact opt-out and deletion workflows;
- provider and source terms;
- privacy request export/correction/deletion;
- no cross-workspace AI training by default;
- retention schedule by entity class.

## Retention considerations

Founder/legal approval is required for exact periods. Product defaults:

- security/audit events: long-term, access-restricted;
- contractual agreements/protection/disputes: contract plus limitation period;
- order/commission financial records: statutory/financial period;
- communications: professional need and applicable law;
- unverified enrichment candidates: short period;
- raw import files: delete after successful commit plus short recovery window;
- export packages: expire within seven days;
- disconnected integration secrets: delete immediately;
- AI request payloads: minimum provider and Ryva retention.

## Audit events

Audit:

- login, logout, session, MFA;
- credential/subscription access decision;
- role and support grant;
- view of especially sensitive support content;
- create/update/archive/merge of material records;
- evidence classification and correction;
- stage transition;
- agreement/protection approval;
- external communication approval and result;
- order/commission calculation and state;
- dispute;
- AI generation and user disposition;
- import/export/download;
- deletion;
- admin and job repair.

Audit records include actor, workspace, action, target, timestamp, origin, request/correlation ID, outcome, and safe before/after reference or digest.

## Support access

Support cannot impersonate the user. Ticket-scoped grants define records, fields, purpose, actor, expiry, and approval. Sensitive content is redacted by default.

## Threat controls

- CSRF/origin validation;
- rate limits and abuse protection;
- SQL parameterization;
- output encoding and content security policy;
- prompt-injection isolation;
- provider webhook signature verification;
- OAuth state/PKCE/nonce as applicable;
- idempotency;
- tenant isolation tests;
- mass-assignment prevention;
- SSRF protections for source fetch;
- file-content sandboxing;
- audit tamper alerts.

## Incident behavior

Kill switches can stop external sends, AI providers, enrichment, imports, and individual integrations. Incidents preserve evidence, notify affected owners through approved procedure, and never silently mark failed work complete.

