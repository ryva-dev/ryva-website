CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  time_zone TEXT NOT NULL DEFAULT 'UTC',
  locale TEXT NOT NULL DEFAULT 'en-US',
  mfa_secret_ciphertext TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled', 'deleted')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE status <> 'deleted';

CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'read_only', 'closed')),
  default_time_zone TEXT NOT NULL DEFAULT 'UTC',
  default_currency CHAR(3) NOT NULL DEFAULT 'USD',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspace_memberships (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('representative', 'mentor', 'instructor', 'admin', 'support')),
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX workspace_memberships_user_idx ON workspace_memberships (user_id, status);

CREATE TABLE certification_credentials (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  credential_type TEXT NOT NULL,
  credential_number_masked TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'expiring', 'expired', 'suspended', 'revoked', 'surrendered')),
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ NOT NULL,
  provider_reference TEXT NOT NULL,
  provider_event_id TEXT,
  suspension_read_only_allowed BOOLEAN NOT NULL DEFAULT false,
  status_reason_code TEXT,
  renewal_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_reference)
);
CREATE INDEX certification_credentials_user_idx ON certification_credentials (user_id, verified_at DESC);
CREATE UNIQUE INDEX certification_credentials_event_unique
  ON certification_credentials (provider_event_id) WHERE provider_event_id IS NOT NULL;

CREATE TABLE subscription_entitlements (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('none', 'trial', 'active', 'past_due', 'retry_failed', 'canceled', 'ended')),
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  past_due_since TIMESTAMPTZ,
  price_id TEXT,
  provider_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE NULLS NOT DISTINCT (provider_subscription_id)
);
CREATE UNIQUE INDEX subscription_event_unique
  ON subscription_entitlements (provider_event_id) WHERE provider_event_id IS NOT NULL;

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash TEXT NOT NULL,
  mfa_verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_active_idx ON sessions (user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  professional_title TEXT NOT NULL DEFAULT '',
  outreach_name TEXT NOT NULL DEFAULT '',
  outreach_signature TEXT NOT NULL DEFAULT '',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  category_interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  business_type_interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  geographic_preferences JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience_level TEXT NOT NULL DEFAULT 'not_set',
  working_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspace_settings (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  quiet_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  task_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_preferences JSONB NOT NULL DEFAULT '{"enabled": false}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE support_grants (
  id UUID PRIMARY KEY,
  support_user_id UUID NOT NULL REFERENCES users(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  ticket_reference TEXT NOT NULL,
  reason TEXT NOT NULL,
  allowed_record_types TEXT[] NOT NULL DEFAULT '{}',
  allowed_record_ids UUID[] NOT NULL DEFAULT '{}',
  allowed_fields TEXT[] NOT NULL DEFAULT '{}',
  approved_by UUID NOT NULL REFERENCES users(id),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);
CREATE INDEX support_grants_lookup_idx
  ON support_grants (support_user_id, workspace_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  actor_user_id UUID REFERENCES users(id),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'provider', 'job')),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  origin TEXT NOT NULL,
  request_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed')),
  before_digest TEXT,
  after_digest TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_events_workspace_time_idx ON audit_events (workspace_id, occurred_at DESC);
CREATE INDEX audit_events_target_idx ON audit_events (target_type, target_id, occurred_at DESC);
CREATE INDEX audit_events_actor_idx ON audit_events (actor_user_id, occurred_at DESC);

CREATE FUNCTION prevent_audit_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only';
END;
$$;

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

CREATE TABLE durable_jobs (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'dead', 'canceled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_safe TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX durable_jobs_claim_idx ON durable_jobs (available_at, created_at)
  WHERE status IN ('queued', 'running');
CREATE INDEX durable_jobs_admin_idx ON durable_jobs (status, updated_at DESC);

CREATE TABLE provider_events (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  outcome TEXT,
  request_id TEXT NOT NULL,
  UNIQUE (provider, external_event_id)
);

CREATE TABLE rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL CHECK (hits >= 0),
  reset_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX rate_limit_buckets_reset_idx ON rate_limit_buckets (reset_at);
