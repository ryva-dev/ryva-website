# Deployment

## Shape

- one web/API service from `ops/Dockerfile`;
- one worker process from the same image with command `node dist/apps/api/src/worker.js`;
- one managed PostgreSQL database;
- TLS termination at the platform edge;
- managed secret storage;
- private S3-compatible object storage with server-side encryption;
- a malware scanner that signs result callbacks;
- Stripe webhooks routed to the API. The legacy certification webhook is optional
  and retained only for historical credential reconciliation.
- a transactional email provider with idempotent send support and signed
  delivery, reply, complaint, bounce, and opt-out callbacks.

## Release sequence

1. Back up the database and verify the most recent restore drill.
2. Build and scan the image.
3. Run migrations as a controlled release task using the new image.
4. Deploy the API image with the worker disabled.
5. Verify `/healthz`, `/readyz`, login, access evaluation, and provider endpoints.
6. Deploy or restart the worker.
7. Monitor request failures, access denials, dead jobs, provider reconciliation, and audit integrity.
8. Record the single launch decision from `/api/launch-readiness`; do not
   override a `Not Ready` status in release notes.

Migrations are forward-only. Application changes must remain compatible with the prior schema during rolling deployment. A release rollback returns the prior application image; schema correction uses a new migration, never an edited applied migration.

The API process never runs migrations at startup. Every environment must run
`npm run migrate` explicitly before starting a release that requires new schema.
This prevents concurrent API replicas from racing migration execution and keeps
database changes inside the operator-controlled release step.

## Required production checks

- `NODE_ENV=production`
- HTTPS `APP_URL`
- verified PostgreSQL TLS (`PGSSL=verify-full` preferred)
- synthetic seeding disabled
- high-entropy session and encryption keys
- signed Stripe webhook secret; certification-provider configuration is optional
  and does not control representative product access
- `STORAGE_DRIVER=s3`, bucket/region configuration, and a signed malware-scanner webhook secret
- configured Stripe one-time Program price (`STRIPE_PROGRAM_PRICE_ID`) and
  recurring Ryva Pro price (`STRIPE_PRICE_ID`)
- configured and verified email sender, provider token, signed callback secret,
  `OUTREACH_SEND_ENABLED=1`, and a running durable worker
- a separately configured transactional identity-email provider and verified
  sender for password recovery
- bundled Terms and Privacy pages with immutable document version identifiers;
  optional external overrides must use HTTPS
- monitored support email
- backup schedule and restore target
- staff MFA enrollment
- provider retry/replay procedures

The server refuses production startup when critical security/provider configuration is absent.
Run `npm run release:preflight` in the target environment before migrations.
It prints names and pass/block state only; it never prints secret values.

Document originals use short-lived signed upload URLs and remain quarantined
until `/api/webhooks/malware-scan` receives a valid signed `clean` result.
Downloads use five-minute signed URLs. Local disk storage is development-only
and production startup rejects it.

Email outreach remains queued if the provider is unavailable or acceptance is
uncertain. Operators must retry the durable job rather than create another
message; the adapter reuses the exact artifact idempotency key.

## Health

- `/healthz` confirms the process is alive.
- `/readyz` performs a database query and returns failure if PostgreSQL is unavailable.

Do not route traffic until readiness succeeds.
