# Development and Testing

## Database lifecycle

The application uses PostgreSQL only. Migrations are ordered SQL files in `packages/database/src/migrations/` and are applied under a PostgreSQL advisory lock. Each unapplied file executes in one transaction and is recorded in `schema_migrations`.

For a fresh local database:

```bash
createdb ryva_pro_dev
DATABASE_URL=postgres://localhost/ryva_pro_dev PGSSL=disable npm run migrate
```

Do not edit a migration after it has been applied outside a disposable local database. Add a new forward migration.

## Synthetic fixtures

`npm run seed:synthetic` creates clearly labeled accounts covering active, uncertified, grace, expired, suspended, revoked, subscription cancellation, Admin, and Support states. It is idempotent by stable synthetic IDs. The command prints temporary synthetic staff TOTP secrets and refuses production.

## Test database

The default integration/browser database is `ryva_pro_test`. Tests drop and recreate only that database's `public` schema, migrate it, and seed synthetic fixtures. Override it using `TEST_DATABASE_URL`.

Never point `TEST_DATABASE_URL` at development, staging, or production.

## Quality gates

- ESLint uses type-aware rules.
- Both server and browser TypeScript compile in strict mode.
- Unit tests cover policy/configuration/cryptography.
- PostgreSQL integration tests cover ACC-001–ACC-010 and applicable Phase 1 QLT behavior.
- Playwright runs core access journeys in desktop and mobile Chromium profiles.
- Vite and TypeScript produce the production image inputs.

## Module boundaries

- `packages/config`: environment parsing and fail-fast production rules.
- `packages/database`: PostgreSQL primitives and migrations.
- `packages/domain`: access, audit, cryptography, sessions, reconciliation, profiles/settings, and jobs.
- `packages/shared`: identifiers, validation primitives, and safe application errors.
- `apps/api`: transport, security middleware, provider edges, and process entrypoints.
- `apps/web`: accessible user interface and API client.

Cross-module persistence changes belong in domain services and transactions, not route handlers where a reusable command exists.
