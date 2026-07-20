# Ryva Pro Platform

Production application workspace for Ryva Pro. This is a TypeScript modular monolith with a React/Vite client, Express API, PostgreSQL database, and PostgreSQL-backed worker.

The governing product specification remains in [`../ryva-pro-spec/`](../ryva-pro-spec/README.md). Implementation status is recorded in [`IMPLEMENTATION_LEDGER.md`](IMPLEMENTATION_LEDGER.md).

## Requirements

- Node.js 22 or later
- PostgreSQL 16 or later
- `pg_dump` and `pg_restore` for recovery drills
- Chromium installed by Playwright for browser tests

## Local setup

```bash
createdb ryva_pro_dev
cp .env.example .env
npm install
npm run migrate
npm run seed:synthetic
npm run dev
```

Set `SESSION_PEPPER` and `FIELD_ENCRYPTION_KEY` before seeding. Generate each with `openssl rand -hex 32`. Synthetic seeding refuses production and requires `ALLOW_SYNTHETIC_SEED=1`.

The API listens on `http://127.0.0.1:8787`; Vite listens on `http://127.0.0.1:5173` and proxies `/api`.

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run drill:backup-restore
npm run release:preflight
npm run start
npm run start:worker
```

`npm run test:all` runs static analysis, unit/integration tests, browser tests, and the production build.

## Provider setup

- Certification status enters through an HMAC-signed webhook or an authenticated provider API refresh.
- Stripe Checkout, Billing Portal, and signed subscription webhooks require the values documented in `.env.example`.
- Missing live provider configuration fails safely and leaves the last trusted state visible.
- Provider events are idempotent and auditable.
- Optional external intelligence uses the bounded adapter documented in
  [`docs/phase-3-intelligence.md`](docs/phase-3-intelligence.md). Candidate data never
  qualifies a Product, Brand, Business, Contact, or Buyer without human review.
- Representation authority, immutable Agreement originals, human approval, and
  Placement gates are documented in
  [`docs/phase-4-representation.md`](docs/phase-4-representation.md).
- Human-controlled outreach, email delivery/webhooks, calls, templates,
  sequences, response handling, quiet hours, and suppression are documented in
  [`docs/phase-5-outreach.md`](docs/phase-5-outreach.md).
- Protected Accounts, Order conversion, Reorders, fixed-precision Commission
  calculations, payments, adjustments, and disputes are documented in
  [`docs/phase-6-commercial-continuity.md`](docs/phase-6-commercial-continuity.md).
- Evidence-first AI summaries, drafting, extraction, provenance, human review,
  provider configuration, and the operational kill switch are documented in
  [`docs/phase-7-responsible-ai.md`](docs/phase-7-responsible-ai.md).
- Explainable Home priorities, the shared metric dictionary, currency-separated
  Analytics, transparent ranges, reports, numerical-claim controls, alerts, and
  future model boundaries are documented in
  [`docs/phase-8-analytics-command-center.md`](docs/phase-8-analytics-command-center.md).
- Controlled imports, reversible duplicate resolution, durable JSON/CSV
  portability, safe administration/support, retention/closure controls,
  operational hardening, recovery, and launch readiness are documented in
  [`docs/phase-9-operations-and-launch.md`](docs/phase-9-operations-and-launch.md).

The current launch status is **Not Ready** because required production provider
configuration and specialist launch reviews are not present. The application
reports this from observable configuration; synthetic fixtures never satisfy a
launch gate.

Never use synthetic accounts or local keys in staging or production.
