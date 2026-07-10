# Phase 2 — Production Infrastructure Migration Plan

Goal: take Ryva from a single-box SQLite app to a horizontally-scalable, highly-available service that could run behind AWS (multiple app instances, managed Postgres, durable background jobs, real observability).

This document is the plan for Phase 2. Phase 1 (product fixes) is already complete and shipped separately.

---

## The core constraint

The app uses `better-sqlite3`, which is a **synchronous** driver. There are **313 prepared statements** and **~335 query executions** (`.get` / `.all` / `.run`) spread across:

| File | Prepared statements |
|------|--------------------:|
| `server/index.mjs` | 235 |
| `server/workerEngine.mjs` | 49 |
| `server/maraInboxOps.mjs` | 8 |
| `server/maraTrendOps.mjs` | 3 |
| `server/agentLlm.mjs` | 2 |
| `server/db.mjs` | 1 (schema) |

Real Postgres (`pg` / node-postgres) is **asynchronous**. Migrating means every query execution becomes `await`, and every function that runs a query (and everything that calls it) becomes `async`. This is mechanical but pervasive, so it must be done in stages on an isolated branch, with the app kept runnable at every step.

There is no production-grade *synchronous* Postgres driver for Node, so "keep it synchronous" is not an option if the goal is true multi-instance scale. The async refactor is the honest path.

---

## Target architecture (AWS mapping)

| Concern | Today | Target | AWS service |
|--------|-------|--------|-------------|
| Relational data | `data/app.db` (SQLite file) | Postgres, connection-pooled | RDS for Postgres or Aurora Postgres |
| Sessions | `sessions` table in SQLite (+ `data/sessions.json`) | Postgres `sessions` table | RDS/Aurora |
| Background autonomy | in-process `setInterval` + module-level boolean lock | durable job queue with per-user locks | pg-boss (Postgres-backed) or SQS + worker |
| File storage / Chrome profile | local `data/` directory | object storage | S3 |
| Secrets (`ANTHROPIC_API_KEY`, Stripe, Google) | `.env` file | managed secrets | Secrets Manager / SSM Parameter Store |
| Static frontend | served by Node (`express.static`) | CDN | CloudFront + S3 (optional) |
| Compute | single Node process | 2+ stateless instances behind LB | ECS Fargate / EKS / EB, ALB |
| Observability | `console.error` (swallowed) | structured logs + error tracking + metrics | CloudWatch, Sentry, OpenTelemetry |

---

## Staged plan

### Stage A — Foundations (no behavior change, low risk)
1. Add `pg` and a pooled client created from `DATABASE_URL`.
2. Introduce `server/dataStore.mjs` — a thin async data-access layer:
   - `query(sql, params) -> rows[]`
   - `queryOne(sql, params) -> row | null`
   - `execute(sql, params) -> { rowCount }`
   - `tx(async (client) => { ... })` for transactions
   - Placeholder translation helper (`?` → `$1, $2, …`) so existing SQL strings port with minimal edits.
3. Translate the 33-table schema (`server/db.mjs`) into Postgres DDL as versioned migration files:
   - `INTEGER` boolean flags (`paused`, `requires_approval`, stored as 0/1) → `boolean` or `smallint` (pick one convention and hold it).
   - Timestamps are ISO strings in TEXT today — keep as `text` initially to avoid semantic drift, tighten to `timestamptz` later.
   - JSON-in-TEXT columns (`*_json`) → keep `text` first; optional move to `jsonb` in a later pass.
   - `ON CONFLICT ... DO UPDATE` upserts are Postgres-compatible; verify each has a matching unique constraint.
4. Add a migration runner (plain SQL files + a small runner, or `node-pg-migrate`).

**Outcome:** Postgres schema exists and is reachable; app still runs on SQLite. Nothing breaks.

### Stage B — Query cutover (the big one)
1. Replace `db.prepare(sql).get/all/run(params)` with `await store.queryOne/query/execute(sql, params)`, file by file, smallest first (`agentLlm`, `maraTrendOps`, `maraInboxOps`, then `workerEngine`, then `index`).
2. Convert `?` placeholders to `$n`.
3. Make containing functions `async`; add `await` at call sites; cascade upward.
4. Convert `db.transaction(...)` blocks to `await store.tx(...)`.
5. Keep the test suite green after each file (tests currently need a native rebuild per-platform; run them on the target OS).

**Outcome:** App runs entirely on Postgres. This is where regressions hide — do it incrementally with tests, not in one commit.

### Stage C — Data migration (ETL)
One-time script: read the existing SQLite `app.db`, insert rows into Postgres table-by-table in FK-safe order. Dry-run + row-count reconciliation before cutover.

### Stage D — Background jobs → durable queue
1. Replace `setInterval(runScheduledMaraAutonomy)` and the module-level `maraAutonomyRunning` boolean with **pg-boss** (Postgres-backed queue; no new infra since we're already on Postgres).
2. Enqueue per-user autonomy jobs; pg-boss gives locking, retries, backoff, and scheduling so **multiple app instances don't double-run** the same user.
3. Same for `sendWeeklyDigests`.

**Outcome:** Safe to run 2+ instances. This is the actual unlock for horizontal scale.

### Stage E — Observability & resilience
1. Structured logging (`pino`) with request IDs.
2. Error tracking (Sentry) — stop swallowing `console.error` in the autonomy loop and per-user catch blocks; log + alert.
3. `/healthz` (liveness) and `/readyz` (DB reachable) endpoints for the load balancer.
4. Basic metrics (request latency, job success/fail, LLM call counts vs. the daily budget).

### Stage F — State off local disk
1. Move `data/sessions.json` / `data/users.json` residue fully into Postgres (verify nothing still reads the JSON files).
2. Move uploaded files and the TikTok Chrome profile to S3 (or a dedicated scraping worker) so app instances stay stateless.
3. Move secrets from `.env` to Secrets Manager / SSM.

---

## Sequencing & risk

- Stages A, C, E, F are low-to-medium risk and independently shippable.
- Stage B is the high-risk core — incremental, test-gated, reviewable in chunks.
- Stage D is what actually enables multi-instance; it depends on B.
- All of it happens on an **isolated branch/worktree**, never directly on the running app.

## Credentials you'll provide along the way
- `DATABASE_URL` for the Postgres instance (RDS/Aurora).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (also unblocks the Gmail connect shipped in Phase 1) and the OAuth redirect URI registered to match `APP_URL`.
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` to enable paid hiring.
