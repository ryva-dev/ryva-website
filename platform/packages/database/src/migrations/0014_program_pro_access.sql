CREATE TABLE program_entitlements (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active','refunded','revoked')),
  entitlement_source TEXT NOT NULL CHECK (
    entitlement_source IN ('manual','stripe_program_purchase','migration','synthetic')
  ),
  granted_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  pro_trial_started_at TIMESTAMPTZ,
  pro_trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (completed_at IS NULL AND pro_trial_started_at IS NULL AND pro_trial_ends_at IS NULL)
    OR
    (completed_at IS NOT NULL AND pro_trial_started_at IS NOT NULL
      AND pro_trial_ends_at IS NOT NULL AND pro_trial_ends_at > pro_trial_started_at)
  )
);
CREATE INDEX program_entitlements_status_idx
  ON program_entitlements(status, granted_at);
