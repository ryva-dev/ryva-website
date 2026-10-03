CREATE TABLE legal_acceptances (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('terms_of_use','privacy_policy')),
  document_version TEXT NOT NULL,
  acceptance_action TEXT NOT NULL CHECK (acceptance_action IN ('accepted','acknowledged')),
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_type, document_version)
);
CREATE INDEX legal_acceptances_user_idx
  ON legal_acceptances(user_id, occurred_at DESC);

CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > issued_at)
);
CREATE INDEX password_reset_tokens_active_idx
  ON password_reset_tokens(user_id, expires_at)
  WHERE used_at IS NULL;

CREATE TABLE transactional_email_outbox (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message_kind TEXT NOT NULL CHECK (message_kind IN ('password_reset')),
  recipient_address TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('queued','sent','failed')) DEFAULT 'queued',
  provider_message_id TEXT,
  last_error_code TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX transactional_email_outbox_status_idx
  ON transactional_email_outbox(status, created_at);

CREATE TABLE staff_mfa_enrollment_challenges (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  secret_ciphertext TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > issued_at)
);
CREATE INDEX staff_mfa_enrollment_active_idx
  ON staff_mfa_enrollment_challenges(user_id, expires_at)
  WHERE consumed_at IS NULL;
