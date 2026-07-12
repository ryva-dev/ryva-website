# Stage C — SQLite → Postgres ETL

One-time data copy after Stage B cutover.

## Prerequisites

1. Postgres reachable via `DATABASE_URL`
2. Schema applied: `npm run migrate`
3. Backup SQLite (`data/app.db`) and Postgres before a live run

## Dry-run (recommended first)

```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/ryva
export PGSSL=disable
npm run migrate
npm run etl:sqlite-to-postgres -- --dry-run
# or: npm run etl:sqlite-to-postgres -- --dry-run --sqlite ./data/app.db
```

## Live copy

```bash
npm run etl:sqlite-to-postgres
```

Behavior:

- Tables copied in FK-safe order
- Shared columns only (schema drift logged)
- `ON CONFLICT DO NOTHING` (re-runnable; won't overwrite existing rows)
- Exit `1` if inserted count looks short unless `--force`

## After ETL

1. Point production `DATABASE_URL` at the migrated database
2. Unset / stop using `DATABASE_PATH` for the app process
3. Set `OBJECT_STORAGE_DRIVER=s3` and sync uploads:
   `npm run sync:uploads-to-s3 -- --dry-run` then without `--dry-run`
4. Smoke-test `/readyz` and `/metrics`
