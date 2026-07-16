# Ryva production operations runbook

This runbook is part of the paying-user launch gate. Record the owner, provider-specific commands, and evidence links in the deployment system; do not mark an item complete from local simulation alone.

## Ownership and response

- Primary incident owner: the person monitoring `SUPPORT_EMAIL`, deployment alerts, Stripe, and Google OAuth.

## Google OAuth callback configuration

The Google Cloud OAuth client must be a **Web application** and must list both production callbacks under **Authorized redirect URIs** exactly—scheme, host, path, and trailing slash behavior all matter:

- `https://www.ryvaforge.com/api/auth/google/callback`
- `https://www.ryvaforge.com/api/office/workers/mara-vale/gmail/callback`

Ryva derives these from `APP_URL`. If the production domain changes, update `APP_URL` and the Google Cloud client together. A `redirect_uri_mismatch` response occurs before Ryva receives a callback and therefore cannot be repaired by retrying or reconnecting inside the product.
- Severity 1: login unavailable, checkout charging incorrectly, cross-tenant exposure, widespread email mis-send, or data loss. Pause autonomy, disable checkout if affected, preserve logs, and notify affected users promptly.
- Severity 2: delayed autonomy, provider degradation, isolated Gmail reconnect, or non-critical feature outage. Communicate a workaround and expected next update.
- Never delete uncertain external-action records. Reconcile Gmail/Stripe provider state before retrying.

## Required alerts

- `/readyz` is non-200 for two consecutive checks.
- `jobs.dead > 0` or oldest queued job exceeds 30 minutes.
- Reclaimed job leases spike above the normal baseline.
- Stripe webhook failures or checkout price mismatch events occur.
- Gmail refresh failures exceed three users or repeat for one user.
- Tenant/fleet LLM budget exhaustion rises.
- Sentry reports a cross-tenant, authorization, billing, or send-path exception.

## Database backup and restore

- Enable managed Postgres point-in-time recovery before launch.
- Retain at least 7 daily backups and 4 weekly backups; increase based on customer and legal requirements.
- Encrypt backups and restrict restore privileges to the incident owner.
- Run a restore drill into an isolated database before launch and at least quarterly.
- Restore verification must confirm: schema current, tenant isolation queries, hired workers, billing references, approval records, external-action executions, and audit-chain readability.
- Initial targets: RPO 24 hours and RTO 8 hours. Do not advertise stronger targets until drills prove them.

## Object storage

- Enable S3 versioning and default encryption.
- Block public access at account and bucket level.
- Add lifecycle rules consistent with the published retention policy.
- Quarterly restore drill: retrieve one tenant document and one video asset using their canonical database records.

## Deployment and rollback

1. Run migrations against a backup-protected database.
2. Confirm `npm test`, `npm run build`, `npm run test:e2e`, dependency audit, and Postgres integration.
3. Deploy one canary, verify `/healthz`, `/readyz`, `/metrics`, login, and a non-sending Mara work pass.
4. Confirm the configured Stripe price matches the displayed worker salary.
5. Roll forward for data migrations when possible. Application rollback must use a version compatible with the current schema.
6. Keep autonomy disabled on extra web replicas unless they are intended queue consumers.

## External-action incident procedure

1. Pause the affected worker or fleet scheduler.
2. Inspect `external_action_executions`; treat `uncertain` as requiring provider reconciliation.
3. Check Gmail Sent/Drafts or Stripe directly using provider IDs.
4. Do not retry an uncertain action until its provider outcome is known.
5. Record the decision and evidence in the append-only action audit.
6. Notify the user if a communication was duplicated, misdirected, or delayed materially.

## Paying-stranger release evidence

- Complete `docs/MARA_PAID_SOAK.md` on the actual Postgres/S3/Stripe/Gmail deployment.
- Record timestamps and screenshots/log links for signup, checkout webhook, hire activation, Gmail connection, autonomous work, approval/send, reply classification, account export, cancellation, and deletion.
- A failed item resets the relevant soak section after the fix.
