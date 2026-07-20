ALTER TABLE notifications DROP CONSTRAINT notifications_status_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_status_check
  CHECK(status IN ('unread','read','dismissed','resolved','archived'));

CREATE TABLE home_user_states (
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES users(id),
  last_acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,user_id)
);

CREATE TABLE home_priority_actions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES users(id),
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN (
    'completed','snoozed','dismissed','reprioritized','restored'
  )),
  reason TEXT NOT NULL,
  snoozed_until TIMESTAMPTZ,
  manual_priority TEXT CHECK(manual_priority IS NULL OR manual_priority IN (
    'low','medium','high','critical'
  )),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);
CREATE INDEX home_priority_actions_latest_idx
  ON home_priority_actions(workspace_id,user_id,item_type,item_id,created_at DESC);

CREATE TABLE analytics_forecasts (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK(target_type IN (
    'placement_opportunity','account','reorder'
  )),
  target_id UUID NOT NULL,
  currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  low_amount NUMERIC(18,2) NOT NULL CHECK(low_amount >= 0),
  base_amount NUMERIC(18,2) NOT NULL CHECK(base_amount >= low_amount),
  high_amount NUMERIC(18,2) NOT NULL CHECK(high_amount >= base_amount),
  qualitative_likelihood TEXT NOT NULL CHECK(qualitative_likelihood IN (
    'early','possible','supported','strong'
  )),
  horizon_starts_on DATE NOT NULL,
  horizon_ends_on DATE NOT NULL,
  evidence_ids UUID[] NOT NULL DEFAULT '{}',
  assumptions TEXT[] NOT NULL DEFAULT '{}',
  limitations TEXT[] NOT NULL DEFAULT '{}',
  method TEXT NOT NULL DEFAULT 'user_entered_range',
  status TEXT NOT NULL CHECK(status IN ('current','superseded','realized','canceled')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(horizon_ends_on >= horizon_starts_on),
  CHECK(method='user_entered_range'),
  UNIQUE(workspace_id,id)
);
CREATE INDEX analytics_forecasts_target_idx
  ON analytics_forecasts(workspace_id,target_type,target_id,status,updated_at DESC);

CREATE TABLE external_metric_observations (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  subject_type TEXT NOT NULL CHECK(subject_type IN ('product','brand','business')),
  subject_id UUID NOT NULL,
  metric_code TEXT NOT NULL,
  numeric_value NUMERIC(24,6) NOT NULL,
  unit TEXT NOT NULL,
  currency CHAR(3) CHECK(currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  period_starts_on DATE,
  period_ends_on DATE,
  observed_at TIMESTAMPTZ NOT NULL,
  freshness_expires_at TIMESTAMPTZ,
  source_id UUID NOT NULL,
  evidence_id UUID NOT NULL,
  provider TEXT NOT NULL,
  provider_record_id TEXT NOT NULL,
  method_version TEXT NOT NULL,
  limitations TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK(verification_status IN (
    'unverified','reviewed','verified','disputed'
  )),
  status TEXT NOT NULL CHECK(status IN ('current','stale','superseded','withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,source_id) REFERENCES sources(workspace_id,id),
  FOREIGN KEY(workspace_id,evidence_id) REFERENCES evidence_records(workspace_id,id),
  UNIQUE(workspace_id,provider,provider_record_id,metric_code),
  UNIQUE(workspace_id,id)
);
CREATE INDEX external_metric_observations_subject_idx
  ON external_metric_observations(workspace_id,subject_type,subject_id,metric_code,observed_at DESC);

CREATE TABLE analytics_report_definitions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN (
    'representative_activity','pipeline','product_performance','brand_performance',
    'buyer_performance','accounts','orders','reorders','commissions','disputes',
    'portfolio_health','outreach_health'
  )),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  columns TEXT[] NOT NULL DEFAULT '{}',
  schedule JSONB,
  status TEXT NOT NULL CHECK(status IN ('active','archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,owner_user_id,name),
  UNIQUE(workspace_id,id)
);

CREATE TABLE analytics_report_runs (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  report_definition_id UUID,
  requested_by UUID NOT NULL REFERENCES users(id),
  report_type TEXT NOT NULL,
  filters JSONB NOT NULL,
  metric_definition_versions JSONB NOT NULL,
  currency_list TEXT[] NOT NULL DEFAULT '{}',
  actual_estimate_labels TEXT[] NOT NULL DEFAULT '{}',
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('generated','failed')),
  safe_error TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,report_definition_id)
    REFERENCES analytics_report_definitions(workspace_id,id),
  UNIQUE(workspace_id,id)
);

CREATE TABLE outreach_analytics_claims (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  message_id UUID NOT NULL,
  metric_code TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  source_record_type TEXT NOT NULL,
  source_record_id UUID NOT NULL,
  evidence_id UUID,
  external_observation_id UUID,
  period_starts_on DATE,
  period_ends_on DATE,
  freshness_at TIMESTAMPTZ,
  freshness_status TEXT NOT NULL CHECK(freshness_status IN ('current','stale','unknown')),
  selected_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,message_id) REFERENCES outreach_messages(workspace_id,id),
  FOREIGN KEY(workspace_id,evidence_id) REFERENCES evidence_records(workspace_id,id),
  FOREIGN KEY(workspace_id,external_observation_id)
    REFERENCES external_metric_observations(workspace_id,id),
  CHECK(evidence_id IS NOT NULL OR external_observation_id IS NOT NULL),
  UNIQUE(workspace_id,id)
);

CREATE OR REPLACE FUNCTION reject_phase8_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Phase 8 history is append-only';
END $$;

CREATE TRIGGER home_priority_actions_immutable
BEFORE UPDATE OR DELETE ON home_priority_actions
FOR EACH STATEMENT EXECUTE FUNCTION reject_phase8_history_mutation();
CREATE TRIGGER analytics_report_runs_immutable
BEFORE UPDATE OR DELETE ON analytics_report_runs
FOR EACH STATEMENT EXECUTE FUNCTION reject_phase8_history_mutation();
CREATE TRIGGER outreach_analytics_claims_immutable
BEFORE UPDATE OR DELETE ON outreach_analytics_claims
FOR EACH STATEMENT EXECUTE FUNCTION reject_phase8_history_mutation();
