# Security Operations

## Enforced controls

- Passwords use salted scrypt with an application pepper.
- Session and CSRF tokens are random and stored only as keyed digests.
- Session cookies are HttpOnly, Secure in production, and SameSite; CSRF uses a separately persisted double-submit token plus origin enforcement.
- Admin and Support password sessions require TOTP before creation.
- Every tenant query derives workspace identity from the server-side session.
- Unknown roles and capabilities are denied.
- Credential revocation invalidates all active user sessions in the same transaction.
- Security headers include a restrictive content-security policy, frame denial, and no-referrer behavior.
- Login attempts use a PostgreSQL-backed shared rate limit.
- Structured logs redact names matching password, secret, token, authorization, cookie, body, payload, and content.
- Provider webhooks require cryptographic signatures and idempotent event IDs.
- Audit events are protected by a database trigger against update and deletion.
- Support cannot impersonate. Profile access requires a live ticket-scoped grant and returns only approved fields.
- Optimistic concurrency prevents silent profile/settings overwrite.
- Imports bind approval to the exact SHA-256 digest and expected row/action
  counts. Consequential rows cannot bypass their domain approval workflow.
- Duplicate resolution uses explicit, reversible canonical aliases; it does not
  rewrite agreement authority or commercial history.
- Exports are workspace/capability scoped, use bounded scope registries, redact
  storage keys, record an integrity digest, expire, and are audit recorded.
- Administrative controls require an Admin capability, MFA, CSRF, and a
  written reason. Provider status exposes configuration booleans only.

## Secret handling

Production requires:

- `SESSION_PEPPER`
- `FIELD_ENCRYPTION_KEY`
- `CREDENTIAL_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`

Store these in the deployment secret manager. Rotate provider secrets using overlapping verification windows where the provider supports them. Rotating the field-encryption key requires a controlled re-encryption operation; do not replace it without one.

## Operational limits

Phase 1 stores no commercial Contacts, documents, outreach, orders, or commissions. Later modules must use the same workspace, audit, approval, and provider boundaries.

Exact retention periods remain pending specialist approval. Do not activate destructive retention jobs until that decision is recorded.

## Phase 9 threat model

| Threat | Boundary and mitigation |
|---|---|
| Cross-workspace import, search, merge, or export | Workspace ID always comes from the authenticated server session and is present in every query and composite relationship check. Unknown records return not found. |
| CSV formula or parser abuse | Imports are parsed as data, never rendered as executable spreadsheet formulas, use a fixed mapping allowlist, enforce row/byte limits, and reject malformed column counts. Export is JSON; future CSV generation must prefix formula-leading cells. |
| Import creates false authority | Consequential types enter a no-effect review queue. Conservative core rows are explicitly unverified. Existing authority domain services remain the only activation path. |
| Duplicate merge expands rights or changes money | Canonical aliases preserve both originals. Authority, protected rights, Orders, Commissions, evidence, and documents are not combined or rewritten. |
| Export exfiltration | Export capability, requester ownership, workspace scope, bounded table registry, storage-key redaction, expiry, digest, and audit are enforced server-side. Document bytes require a separate authorization path. |
| Admin or support privilege escalation | Deny-by-default capabilities, staff MFA, CSRF, reason capture, time/field/ticket-scoped grants, and immutable audits. No impersonation endpoint exists. |
| Job replay or duplicate side effect | Durable jobs have unique idempotency keys, leases, bounded retries, dead state, and completion ownership. Export processing is idempotent. |
| Secret or sensitive-content leakage | Configuration status is boolean-only; structured logging redacts sensitive key names and never logs request bodies, export payloads, document contents, or credentials. |
| Retention destroys required evidence | Destructive automation is disabled while policy periods are null or specialist review is incomplete. Active legal holds block closure/disposition. |
| Dependency compromise | Locked dependencies, production audit in CI, container scanning requirement, minimal runtime image, and deliberate migration from deprecated `otplib` v12 to v13. |

Residual risks before launch include provider contract/security review, malware
scanner and webhook verification in the target environment, managed database
and object-storage configuration, specialist retention/privacy decisions, and
manual accessibility validation. These force `Not Ready` when unresolved.
