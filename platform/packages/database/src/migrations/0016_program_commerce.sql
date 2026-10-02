CREATE TABLE program_checkout_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_checkout_session_id TEXT NOT NULL UNIQUE,
  provider_customer_id TEXT,
  price_id TEXT NOT NULL,
  amount_total INTEGER NOT NULL CHECK (amount_total > 0),
  currency TEXT NOT NULL CHECK (currency = lower(currency)),
  status TEXT NOT NULL CHECK (status IN ('created','paid','failed','expired')),
  provider_event_id TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'paid' AND completed_at IS NOT NULL) OR (status <> 'paid'))
);

CREATE INDEX program_checkout_sessions_user_idx
  ON program_checkout_sessions(user_id, created_at DESC);

