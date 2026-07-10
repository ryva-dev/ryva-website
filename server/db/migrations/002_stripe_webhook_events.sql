-- Idempotency ledger for Stripe webhooks. Each delivered event.id is recorded
-- once; retries that carry the same id are ignored, preventing double
-- processing of billing-state changes.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TEXT NOT NULL
);
