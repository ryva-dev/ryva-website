# Exact Next Codex Prompt

Copy the prompt below verbatim into the next implementation task.

---

You are continuing work inside the existing Ryva repository.

The complete first-production specification is in `/ryva-pro-spec/`. Read its `README.md`, `00-existing-state-and-architecture.md`, `technical-architecture.md`, `roles-and-access.md`, `security-privacy-and-audit.md`, `data-model.md`, `entity-field-dictionary.md`, `acceptance-tests.md`, `build-sequence.md`, all applicable Phase 1 page specifications, and every founder decision before editing code. Also inspect the current repository and preserve user-owned changes.

Implement **Phase 1 — Platform foundation and secure access** from `/ryva-pro-spec/build-sequence.md` as a complete production-quality vertical slice. Do not implement later product workspaces yet, and do not restore deleted historical application files unless inspection shows that doing so is explicitly appropriate and does not overwrite user changes.

Required outcomes:

1. Establish the TypeScript modular-monolith project structure specified by the architecture.
2. Implement environment validation, PostgreSQL migrations and connection/transaction primitives, stable identifiers, UTC timestamps, optimistic concurrency foundations, structured logging, correlation IDs, safe error handling, and CI-quality lint/type/test commands.
3. Implement Workspace, User, Membership, Certification Credential, Subscription Entitlement, secure cookie sessions, roles, and server-enforced policy checks.
4. Implement Login, Certification Access Check, Subscription Activation, Certification Status, Subscription, Profile, and the minimum Settings surfaces defined in `/ryva-pro-spec/pages/`.
5. Implement active, grace/read-only, expired, suspended, revoked, and subscription-entitlement behavior exactly as specified.
6. Implement the append-only Audit Event service and record all access and administrative material changes.
7. Implement the PostgreSQL-backed durable job foundation with leases, idempotency, retry, dead-letter state, and minimal Admin visibility.
8. Add security headers, CSRF protection, rate limiting, input validation, workspace isolation, secret-safe logging, and least-privilege admin/support foundations.
9. Add synthetic seed fixtures only.
10. Implement automated tests for ACC-001 through ACC-010 and applicable QLT tests, including API authorization and browser journeys.
11. Add concise local-development, migration, test, and deployment documentation.

Use the smallest coherent implementation that supports the full future specification. Put consequential policy in server-side domain services, not only UI guards. Keep adapters around certification, billing, email, storage, and other providers. Do not add microservices, a generic EAV system, autonomous AI, production scoring, or skeletal versions of later workspaces.

Before implementation, report the relevant existing files reviewed, assumptions, conflicts, and exact Phase 1 file plan. Then implement, run the full available validation suite, fix failures, and report:

- files created and modified;
- migrations and security controls;
- tests and exact results;
- remaining Phase 1 gaps;
- risks and manual setup;
- the next recommended implementation increment.

Do not stop after an outline or scaffold. Complete Phase 1 and verify it.

---
