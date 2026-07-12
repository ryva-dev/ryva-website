# Stage B — query cutover runbook

Goal: move all data access onto the async `dataStore` layer so the app runs on
either SQLite (dev) or Postgres (prod) via one config flag (`DATABASE_URL`).

Run `node scripts/analyze-db-callsites.mjs` any time for the current, exact map.
As of the Stage A/foundation commit:

| Metric | Count |
|--------|------:|
| `prepare()` call sites | **305** |
| → `.queryOne` (was `.get`) | 76 |
| → `.query` (was `.all`) | 75 |
| → `.execute` (was `.run`) | 152 |
| unclassified (inspect) | 2 |
| `db.transaction(...)` blocks | 1 |
| dialect-specific SQL to translate | ~2 real |

The small dialect surface is the key finding: this is overwhelmingly a
mechanical rewrite, not a re-architecture.

## Mechanical rewrite

```
db.prepare(SQL).get(A)   ->  await store.queryOne(SQL, A)
db.prepare(SQL).all(A)   ->  await store.query(SQL, A)
db.prepare(SQL).run(A)   ->  await store.execute(SQL, A)
db.transaction(fn)(args) ->  await store.tx(async (t) => { ... })
```

Then mark the enclosing function `async` and add `await` at every caller,
cascading up the chain. `import * as store from "./dataStore.mjs"`.

Return-shape notes:
- `.run()` returned `{ changes, lastInsertRowid }`. `store.execute()` returns
  `{ rowCount, changes, rows }` — `changes` is preserved. No code uses
  `lastInsertRowid` (all ids are app-generated UUID strings), so nothing breaks.
- `.get()` returned `undefined` when missing; `store.queryOne()` returns `null`.
  Verify truthiness checks (`if (row)`) — both are falsy, so these are safe.

## Dialect translations (the only non-mechanical edits)

1. **`server/db.mjs:585`** — hire backfill uses `lower(hex(randomblob(16)))`
   for an id. On Postgres use `gen_random_uuid()` (pgcrypto is enabled in the
   migration). Better: move this backfill out of schema-bootstrap into an
   idempotent app-start step that works on both backends.
2. **`ensureColumn()` (`db.mjs:34`, `workerEngine.mjs:490`)** — uses
   `PRAGMA table_info`. On Postgres the schema is fully defined by migrations,
   so `ensureColumn` should be a **no-op when the active driver is Postgres**
   (guard with `store.activeDriver() === "sqlite"`), and unchanged for SQLite.
3. Re-run the analyzer after edits to confirm the dialect list is empty.

## Schema bootstrap split

- **SQLite (dev):** `db.mjs` keeps creating tables on boot (as today).
- **Postgres (prod):** tables come from `npm run migrate`; `db.mjs`'s
  `CREATE TABLE`/`ensureColumn` block must be skipped when
  `store.activeDriver() === "postgres"`.

## Order of work (smallest blast radius first)

1. `server/agentLlm.mjs` (2 sites) → convert + await its callers.
2. `server/maraTrendOps.mjs` (3), `server/maraInboxOps.mjs` (8).
3. `server/workerEngine.mjs` (49).
4. `server/index.mjs` (235) — do it route-group by route-group.
5. Delete direct `better-sqlite3` usage from app code; only `dataStore` imports it.

## Test gate (do not skip)

Run on a machine with native modules + a real Postgres (this is why the cutover
is done on your Mac, not in the CI sandbox):

```bash
npm install
npm test                      # SQLite driver — must stay green after each file
export DATABASE_URL=postgres://…:5432/ryva && export PGSSL=disable
npm run migrate
npm test                      # Postgres driver — same suite, both backends green
```

Every file's conversion is a separate reviewable commit. A file is "done" only
when the suite is green on **both** drivers.

## Test isolation (important) — use the injectable store

`dataStore.mjs` exports `createStore(options)`, so the existing threaded-
dependency pattern keeps working: functions that used to take a raw `db` now
take a `store`, and tests pass an isolated instance instead of the shared one.

```js
import { createStore } from "./dataStore.mjs";

const store = createStore({ databasePath: ":memory:" }); // per-test, isolated
await store.init();
// create the schema on this store's connection, then call the converted fn:
const result = await someConvertedFn(store, { ...args });
// no global state to reset between tests.
```

Production keeps using the shared default instance (module-level `query`/
`queryOne`/`execute`, or `import * as store`). `agentLlm.mjs`'s budget counter is
the reference for the shared-store shape; DI-style modules (`maraTrendOps`,
`workerEngine`, …) should take a `store` param, mirroring how they took `db`.

Because both drivers are async, converting a function makes it `async` and every
caller must `await` — the keyword cascades upward. That's why each unit of work
is "one module + its callers + its tests," green before moving on.

## After Stage B

Stage B query cutover is complete on `phase2/stage-b-cutover`:

- Runtime modules use `await store.query/queryOne/execute`
- `DATABASE_URL` enables Postgres; SQLite is not opened in that mode
- Autonomy + weekly digests use `durable_jobs` with leased claims

Remaining:

- **C — ETL:** copy `data/app.db` rows into Postgres (FK-safe order).
- **E — observability:** metrics backends / error tracking productization.
- **F — state off local disk:** Secrets Manager, TikTok profile off local disk.
