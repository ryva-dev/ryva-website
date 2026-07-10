# Data layer — Postgres migration (Phase 2)

This directory is part of the SQLite → Postgres migration. It is **additive**:
on this branch the app still runs on SQLite. Nothing here activates until
`DATABASE_URL` is set and the query cutover (Stage B) lands.

## What's here (Stage A — done)

- `migrations/001_initial_schema.sql` — the full Postgres schema (39 tables),
  translated 1:1 from `server/db.mjs` + `initWorkerTables`, with every runtime
  `ensureColumn()` addition folded in, plus indexes on the hot `(user_id,
  worker)` access paths.
- `../dataStore.mjs` — the async data-access layer (`query`, `queryOne`,
  `execute`, `tx`, `ping`) built on a `pg` connection pool. Includes
  `toPgPlaceholders` to convert `?` → `$1, $2, …`.
- `../migrate.mjs` — migration runner. `npm run migrate` applies pending files
  once each, tracked in `schema_migrations`.

## Running it

```bash
# point at any Postgres (local, RDS, Aurora)
export DATABASE_URL=postgres://user:pass@host:5432/ryva
export PGSSL=disable        # local only; leave unset for managed hosts
npm install                 # pulls in pg
npm run migrate             # creates the schema
```

## Remaining stages

- **B — query cutover:** rewrite the 313 `db.prepare(...).get/all/run(...)` sites
  to `await store.queryOne/query/execute(...)`, smallest files first, cascading
  `async` up call chains. Watch for SQLite-only SQL that needs translating:
  `INSERT OR REPLACE`, `lower(hex(randomblob(16)))` (→ `gen_random_uuid()`),
  any `strftime`/`datetime('now')`, and `PRAGMA`.
- **C — data ETL:** copy existing `data/app.db` rows into Postgres, FK-safe.
- **D — job queue:** replace the in-process `setInterval` autonomy loop with
  pg-boss so multiple instances don't double-run.
- **E — observability**, **F — state off local disk** (see the root
  `PHASE2_POSTGRES_MIGRATION_PLAN.md`).
