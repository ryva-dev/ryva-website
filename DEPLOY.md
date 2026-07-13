# Deploying Ryva

The app supports two data planes:

- **SQLite (default / single-instance / local dev):** set `DATABASE_PATH` / `STORAGE_ROOT`. Do not run multiple application replicas against one SQLite file. Production refuses SQLite.
- **Postgres (required for paid public SaaS):** set `DATABASE_URL`, use S3 for uploads (`OBJECT_STORAGE_DRIVER=s3`), and run with migrate-on-boot (default) or an init container. Autonomy and digests use the durable job queue with leased claims + heartbeats (`FOR UPDATE SKIP LOCKED` on Postgres).

## Build & run the container

```bash
docker build -t ryva .
docker run -p 8787:8787 --env-file .env ryva
```

The image builds the frontend (`npm run build`), runs idempotent migrations when `DATABASE_URL` is set, then starts `node server/index.mjs` under `dumb-init` so SIGTERM triggers graceful shutdown.

## Required configuration (production)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string (required in production). |
| `PGSSL` | Default `verify-full`. Use `require` for Railway/self-signed managed certificates (TLS stays encrypted); use `disable` only for local Postgres without TLS. |
| `ENCRYPTION_KEY` | 32-byte key (64 hex chars) encrypting OAuth tokens at rest. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `ANTHROPIC_API_KEY` | AI provider key; without it workers emit honest placeholders. |
| `APP_URL` | Public base URL (OAuth redirects and links). |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | **Required in production** for paid hires. |
| `STRIPE_PRICE_ID_MARA_VALE` or `STRIPE_PRICE_ID` | Optional Stripe Price ID (preferred for receipts); else inline `price_data`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | **Required in production** for advertised Google login + Gmail OAuth. |
| `SMTP_*` | **Required in production** for email verification + digests. |
| `SUPPORT_EMAIL` | **Required in production.** Monitored human support shown on Privacy/Terms/Security pages. |
| `MARA_DISABLE_VIDEO_QA` | Set `1` to hide video QA, **or** configure real Whisper + Anthropic multimodal. |
| `MARA_TRANSCRIPTION_PROVIDER` / `OPENAI_API_KEY` | Real video transcription when QA enabled. |
| `MARA_MULTIMODAL_PROVIDER=anthropic` | Real creative review path when QA enabled. |
| `MARA_REQUIRE_REAL_MEDIA=1` | Refuse mock media analysis. |
| `META_ACCESS_TOKEN` / `TIKTOK_ACCESS_TOKEN` / `HUNTER_API_KEY` / `APOLLO_API_KEY` | Optional launch senses (ads + contact enrichment). |
| `PORT` / `HOST` | Default `8787` / `0.0.0.0`. |
| `OBJECT_STORAGE_DRIVER` | Must be `s3` in production. |
| `S3_BUCKET` / `AWS_REGION` | Tenant upload bucket and region. |
| `S3_ENDPOINT` / `S3_FORCE_PATH_STYLE` | Set for S3-compatible providers such as Railway Buckets; use the URL style shown by the provider. |
| `METRICS_TOKEN` | Bearer token required for `GET /metrics` in production. |
| `MIGRATE_ON_BOOT` | Default `1`. Set `0` only if an init container runs `npm run migrate`. |
| `AUTONOMY_SCHEDULER_ENABLED` | **Required explicitly in production.** `1` only on designated scheduler/worker replicas; `0` on web-only replicas. |
| `SENTRY_DSN` | Optional; enables `@sentry/node` error reporting when set. |

`SESSION_SECRET` is **unused** (sessions are DB cookies). You can omit it.

The app calls `validateConfig()` at boot and refuses to start in production if Postgres, S3, `APP_URL`, Stripe, Google OAuth, SMTP, a valid `ENCRYPTION_KEY`, authenticated metrics, AI configuration, or video QA policy are incomplete.

### Launch soak (paying strangers)

Before marketing Mara as ready for strangers, run the checklist in `docs/MARA_PAID_SOAK.md` on a Postgres+S3 deploy (fresh signup → pay → hire → Gmail → 48h return → money moves).
Operational ownership, backup/restore drills, incident response, and rollback requirements are in `docs/PRODUCTION_OPERATIONS.md`.

Run the read-only release preflight against the deployed app before starting that soak:

```bash
npm run release:preflight -- --remote https://your-app.example --live-providers
```

This fails unless production configuration is complete, the public URL uses HTTPS, support contact syntax is valid, health/readiness/authorized metrics respond, Stripe is live with an active $79 USD monthly price, and the configured S3 bucket is reachable. It does not create a charge, send email, or mutate provider data.

### Gmail connect smoke checklist

1. Google Cloud OAuth client: authorized redirect URIs must include:
   - `{APP_URL}/api/auth/google/callback` (login)
   - `{APP_URL}/api/office/workers/mara-vale/gmail/callback` (Gmail connect)
2. Connect Gmail from the Mara desk → expect `?notice=gmail-connected`.
3. Disconnect and reconnect: refresh token must survive (Google often omits it on re-consent).
4. Trigger an autonomy tick with Gmail connected and confirm drafts appear without double-send claims.

## Database migration

```bash
DATABASE_URL=postgres://user:pass@host:5432/ryva npm run migrate
```

Containers migrate automatically before listen unless `MIGRATE_ON_BOOT=0`. `/readyz` returns 503 if schema migrations lag.

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
- `GET /readyz` — readiness (database reachable + schema current); returns 503 when not.
- `GET /metrics` — JSON counters + durable job queue depths. Requires `Authorization: Bearer $METRICS_TOKEN`; query-string secrets are not accepted.

## Scaling notes (accurate)

- **SQLite:** local/dev only; exactly one process.
- **Postgres + S3:** multiple app replicas are supported when:
  - Every replica uses the same Postgres and S3 bucket.
  - Job leases are heartbeated for long autonomy/video work (built-in).
  - Trend SoT is `worker_trend_snapshots` in Postgres (local trend files are cache-only).
- Set `AUTONOMY_SCHEDULER_ENABLED=1` on at least one designated scheduler/worker replica and `0` on ordinary web replicas. `MARA_AUTONOMY_INTERVAL_MINUTES` controls its cadence. Durable jobs and leases still prevent duplicate execution across multiple designated consumers.

## Alerts (wire these in CloudWatch / Datadog / etc.)

| Signal | Why |
|--------|-----|
| `jobs.dead` rising | Autonomy/video jobs exhausted retries — investigate `last_error`. |
| Metric `jobs_reclaimed_expired_lease` spikes | Workers dying mid-job or leases too short / heartbeat broken. |
| Oldest queued job age | Backlog / under-capacity. |
| Gmail refresh failures in logs (`Missing Gmail refresh token` / refresh HTTP errors) | Users lose inbox sync until reconnect. |
| LLM budget exhaustion (`AGENT_DAILY_LLM_CALL_LIMIT`) | Product degradation / cost incidents. |
| `/readyz` 503 | DB down or schema lag after deploy. |

## Rate limits

Expensive office routes (chat, autonomy, deep research, video, task run) use a **Postgres/SQLite-backed** limiter (`rate_limit_buckets`) so multi-replica deploys share the same ceilings. In-memory-only limiting is not used for these paths.

## Account deletion

- Password accounts: confirm with password in Settings.
- Google-only accounts (`password_is_set=0`): Settings redirects to `/api/account/delete/google` for re-auth, then erases.
- API also accepts `{ googleAccessToken }` after a Google userinfo-capable access token is obtained.
