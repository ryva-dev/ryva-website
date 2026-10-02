ALTER TABLE legal_acceptances DROP CONSTRAINT legal_acceptances_document_type_check;
ALTER TABLE legal_acceptances ADD CONSTRAINT legal_acceptances_document_type_check
  CHECK (document_type IN (
    'terms_of_use','privacy_policy','refund_policy','commercial_disclaimer','recurring_billing'
  ));

ALTER TABLE legal_acceptances DROP CONSTRAINT legal_acceptances_user_id_fkey;
ALTER TABLE legal_acceptances ADD CONSTRAINT legal_acceptances_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE legal_acceptances DROP CONSTRAINT legal_acceptances_user_id_document_type_document_version_key;

ALTER TABLE legal_acceptances
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id),
  ADD COLUMN acceptance_context TEXT NOT NULL DEFAULT 'account_creation'
    CHECK (acceptance_context IN ('account_creation','program_purchase','program_checkout','ryva_pro_subscription')),
  ADD COLUMN associated_record_type TEXT,
  ADD COLUMN associated_record_id TEXT,
  ADD COLUMN ip_hash TEXT,
  ADD COLUMN user_agent TEXT,
  ADD COLUMN acceptance_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT legal_acceptances_association_complete CHECK (
    (associated_record_type IS NULL AND associated_record_id IS NULL)
    OR (associated_record_type IS NOT NULL AND associated_record_id IS NOT NULL)
  );

CREATE UNIQUE INDEX legal_acceptances_event_unique
  ON legal_acceptances (
    user_id,document_type,document_version,acceptance_context,
    coalesce(associated_record_type,''),coalesce(associated_record_id,'')
  );
CREATE INDEX legal_acceptances_context_idx
  ON legal_acceptances(user_id,acceptance_context,occurred_at DESC);

CREATE FUNCTION prevent_legal_acceptance_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'legal_acceptances are append-only';
END;
$$;

CREATE TRIGGER legal_acceptances_append_only
BEFORE UPDATE OR DELETE ON legal_acceptances
FOR EACH ROW EXECUTE FUNCTION prevent_legal_acceptance_mutation();

ALTER TABLE program_checkout_sessions
  ADD COLUMN provider_payment_intent_id TEXT;

CREATE TABLE subscription_checkout_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  provider_checkout_session_id TEXT NOT NULL UNIQUE,
  provider_subscription_id TEXT,
  checkout_url TEXT,
  price_id TEXT NOT NULL,
  amount_total INTEGER NOT NULL CHECK (amount_total > 0),
  currency TEXT NOT NULL CHECK (currency = lower(currency)),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month')),
  status TEXT NOT NULL CHECK (status IN ('created','completed','failed','expired')),
  provider_event_id TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR status <> 'completed')
);
CREATE INDEX subscription_checkout_sessions_user_idx
  ON subscription_checkout_sessions(user_id,created_at DESC);
CREATE UNIQUE INDEX subscription_checkout_sessions_one_open_per_user_idx
  ON subscription_checkout_sessions(user_id) WHERE status='created';
