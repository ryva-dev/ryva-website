# Phase 2 — Production Infrastructure Migration Plan

Goal: take Ryva from a single-box SQLite app to a horizontally-scalable, highly-available service that could run behind AWS (multiple app instances, managed Postgres, durable background jobs, real observability).

This document is the plan for Phase 2. Phase 1 (product fixes) is already complete and shipped separately.

**Status (2026-07-12, branch `phase2/stage-b-cutover`):**

| Stage | Status |
|-------|--------|
| A — Foundations (pg, dataStore, migrations) | Done |
| B — Query cutover to async store | Done |
| C — SQLite → Postgres ETL | Done (script + runbook) |
| D — Durable multi-instance jobs | Done (`durable_jobs` + leases; not pg-boss) |
| E — Observability | Done enough (`/metrics`, structured `logCaught`, optional Sentry) |
| F — State off local disk | Partial (S3 uploads + sync script; secrets stay env/Secrets Manager ops) |

---

## The core constraint

The app used `better-sqlite3`, a **synchronous** driver. Real Postgres is **asynchronous**. Stage B moved runtime query paths onto `server/dataStore.mjs` so the backend is selected by config (`DATABASE_URL` → Postgres, else SQLite).

---

## Target architecture (AWS mapping)

| Concern | Today | Target | AWS service |
|--------|-------|--------|-------------|
| Relational data | SQLite file **or** Postgres via `DATABASE_URL` | Postgres, connection-pooled | RDS for Postgres or Aurora Postgres |
| Sessions | `sessions` table | Postgres `sessions` table | RDS/Aurora |
| Background autonomy | `setInterval` tick + `durable_jobs` leases | same (multi-instance safe on Postgres) | RDS + app replicas |
| File storage | local or S3 | object storage | S3 |
| Secrets | `.env` / platform env | managed secrets | Secrets Manager / SSM Parameter Store |
| Static frontend | served by Node (`express.static`) | CDN (optional) | CloudFront + S3 |
| Compute | 1+ Node processes | 2+ stateless instances behind LB | ECS Fargate / EKS / EB, ALB |
| Observability | structured JSON logs + `/metrics` | logs + optional Sentry + scrape metrics | CloudWatch, Sentry |

---

## Staged plan (historical)

### Stage A — Foundations — done
### Stage B — Query cutover — done
### Stage C — Data migration (ETL) — done

```bash
npm run etl:sqlite-to-postgres -- --dry-run
npm run etl:sqlite-to-postgres
```

See `server/db/STAGE_C_ETL_RUNBOOK.md`.

### Stage D — Background jobs — done

Autonomy and weekly digests enqueue into `durable_jobs` with leased claims.
Postgres uses `FOR UPDATE SKIP LOCKED`. pg-boss was not required.

### Stage E — Observability — done enough

- Structured JSON logs + request IDs
- `/healthz`, `/readyz`, `/metrics` (job queue depths + counters)
- Background failures use `logCaught` (optional `SENTRY_DSN` if `@sentry/node` is installed)

### Stage F — State off local disk — partial

- No `sessions.json` / `users.json` residue in server code
- Uploads: `OBJECT_STORAGE_DRIVER=s3` + `npm run sync:uploads-to-s3`
- TikTok Chrome profile remains a dedicated scrape-worker concern
- Secrets: inject via the host (Railway/ECS Secrets Manager) — not stored in the image

---

## Credentials you'll provide along the way

- `DATABASE_URL` for the Postgres instance (RDS/Aurora or local).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and OAuth redirect URI matching `APP_URL`.
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` for paid hiring.
- `S3_BUCKET` / `AWS_REGION` (and IAM) for multi-instance uploads.
- Optional: `SENTRY_DSN` + `npm install @sentry/node`.
