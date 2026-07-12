# Deploying Ryva

The app supports two data planes:

- **SQLite (default / single-instance):** set `DATABASE_PATH` / `STORAGE_ROOT`. Do not run multiple application replicas against one SQLite file.
- **Postgres (multi-instance ready):** set `DATABASE_URL`, run `npm run migrate`, and use S3 for uploads (`OBJECT_STORAGE_DRIVER=s3`). Autonomy and weekly digests run through the durable job queue with leased claims (`FOR UPDATE SKIP LOCKED` on Postgres).

## Build & run the container

```bash
docker build -t ryva .
docker run -p 8787:8787 --env-file .env ryva
```

The image builds the frontend (`npm run build`) and runs `node server/index.mjs`
under `dumb-init` so SIGTERM triggers the app's graceful shutdown.

## Required configuration

| Variable | Purpose |
|----------|---------|
| `DATABASE_PATH` / `STORAGE_ROOT` | Absolute persistent SQLite/storage location when **not** using Postgres. |
| `DATABASE_URL` | Postgres connection string. When set, SQLite is not opened. Run migrations before boot. |
| `PGSSL` | Set `disable` for local Postgres without TLS. Managed hosts keep certificate verification. |
| `ENCRYPTION_KEY` | 32-byte key (64 hex chars) encrypting OAuth tokens at rest. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `SESSION_SECRET` | Session security. |
| `ANTHROPIC_API_KEY` | AI provider key; without it workers emit honest placeholders. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail OAuth. Redirect URI must match `APP_URL`. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing (must be set together). |
| `APP_URL` | Public base URL (used for OAuth redirects and links). |
| `PORT` / `HOST` | Default `8787` / `0.0.0.0`. |
| `OBJECT_STORAGE_DRIVER` | `s3` in production multi-instance; `local` for development. |
| `S3_BUCKET` / `AWS_REGION` | Tenant upload bucket and region when using S3. |

The app calls `validateConfig()` at boot and refuses to start in production if
secrets or AI configuration are incomplete.

## Database migration

```bash
DATABASE_URL=postgres://user:pass@host:5432/ryva npm run migrate
```

Apply migrations before the first Postgres boot. The SQLite schema continues to
bootstrap automatically for local development without `DATABASE_URL`.

### One-time data copy (Stage C)

```bash
npm run etl:sqlite-to-postgres -- --dry-run
npm run etl:sqlite-to-postgres
```

See `server/db/STAGE_C_ETL_RUNBOOK.md`.

### Upload sync (Stage F)

```bash
OBJECT_STORAGE_DRIVER=s3 S3_BUCKET=… AWS_REGION=… npm run sync:uploads-to-s3 -- --dry-run
OBJECT_STORAGE_DRIVER=s3 S3_BUCKET=… AWS_REGION=… npm run sync:uploads-to-s3
```

## Health checks (for the load balancer / orchestrator)

- `GET /healthz` — liveness (process is up).
- `GET /readyz` — readiness (database reachable); returns 503 when not.
- `GET /metrics` — JSON counters + durable job queue depths (scrape or alert on `jobs.dead`).

## Scaling notes

- **SQLite:** run exactly one application replica.
- **Postgres:** multiple replicas are supported. Each process may run the
  scheduler tick (`MARA_AUTONOMY_INTERVAL_MINUTES`); work is enqueued into
  `durable_jobs` and claimed with a lease so jobs are not double-executed.
  Set `MARA_AUTONOMY_INTERVAL_MINUTES=0` on replicas that should not tick if
  you want a single scheduler process.
- Uploaded files use the object-storage abstraction. Configure the S3 driver in
  production multi-instance deployments.
- Production operations must alert on dead-job count and oldest queued-job age.
