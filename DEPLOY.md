# Deploying Ryva

The app is a single Node service that serves the API and the built frontend from
`dist/`. It's stateless when backed by Postgres + object storage, so it can run
as N replicas behind a load balancer.

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
| `DATABASE_URL` | Postgres connection string. **Required in production** — SQLite is single-instance only. When unset, the app falls back to a local SQLite file (dev only). |
| `ENCRYPTION_KEY` | 32-byte key (64 hex chars) encrypting OAuth tokens at rest. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `SESSION_SECRET` | Session security. |
| `ANTHROPIC_API_KEY` | AI provider key; without it workers emit honest placeholders. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail OAuth. Redirect URI must match `APP_URL`. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing (must be set together). |
| `APP_URL` | Public base URL (used for OAuth redirects and links). |
| `PORT` / `HOST` | Default `8787` / `0.0.0.0`. |

The app calls `validateConfig()` at boot and refuses to start in production if
config is incomplete (e.g., SQLite in prod, or a half-configured Stripe pair).

## Database migration

Run once against your Postgres before/at deploy:

```bash
DATABASE_URL=postgres://user:pass@host:5432/ryva npm run migrate
```

## Health checks (for the load balancer / orchestrator)

- `GET /healthz` — liveness (process is up).
- `GET /readyz` — readiness (database reachable); returns 503 when not.

## Scaling notes

- Multiple replicas are safe for request handling once on Postgres.
- The background autonomy scheduler currently runs in-process (`setInterval`).
  Before running many replicas, move it to a durable queue (Phase 2 Stage D,
  pg-boss) so jobs aren't double-executed. Until then, run the scheduler on a
  single instance (e.g., set `MARA_AUTONOMY_INTERVAL_MINUTES=0` on extra
  replicas and keep it enabled on one).
- Uploaded files currently write to local `data/` — mount a volume, or move to
  object storage (S3) for a fully stateless deployment.
