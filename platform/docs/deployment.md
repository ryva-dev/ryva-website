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
- Resend for transactional identity and (when explicitly enabled) outreach
  email, with idempotent sends and signed delivery-event callbacks.

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
  and a running durable worker; `OUTREACH_SEND_ENABLED=0` is the safe prelaunch
  state and does not prevent transactional identity email
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

On AWS S3, the SDK reads `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from
its standard credential chain when static Railway credentials are used.
`AWS_SESSION_TOKEN` is required only for temporary credentials. `S3_ENDPOINT`
must remain empty for AWS S3; setting it enables a custom endpoint and
path-style addressing for a non-AWS S3-compatible provider. `S3_BUCKET` and
`S3_REGION` remain Ryva's explicit storage configuration.

Email outreach remains queued if the provider is unavailable or acceptance is
uncertain. Operators must retry the durable job rather than create another
message; the adapter reuses the exact artifact idempotency key.

The Resend callback is `POST /api/webhooks/email/resend` and is verified from
the raw request body using `RESEND_WEBHOOK_SECRET` plus the `svix-id`,
`svix-timestamp`, and `svix-signature` headers. Ryva maps `email.delivered`,
`email.bounced`, and `email.complained` to its existing delivered, bounced, and
complained states. Provider acceptance is captured synchronously from the
Resend send response, so `email.sent` is not subscribed or mapped. Other
authenticated Resend events are acknowledged but ignored. In particular, Ryva
does not infer replies from `email.received` or opt-outs from contact events
because those events do not reliably identify the originating outreach message.

## Health

- `/healthz` confirms the process is alive.
- `/readyz` performs a database query and returns failure if PostgreSQL is unavailable.

Do not route traffic until readiness succeeds.
