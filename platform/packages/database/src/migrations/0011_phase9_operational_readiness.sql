ALTER TABLE import_previews DROP CONSTRAINT import_previews_record_type_check;
ALTER TABLE import_previews ADD CONSTRAINT import_previews_record_type_check
  CHECK(record_type IN (
    'product','brand','business','contact','business_buyer','source','evidence','task',
    'representation_opportunity','representation_agreement','placement_opportunity',
    'protected_account','order','reorder','commission'
  ));
ALTER TABLE import_previews DROP CONSTRAINT import_previews_status_check;
ALTER TABLE import_previews ADD CONSTRAINT import_previews_status_check
  CHECK(status IN ('validated','approval_required','approved','committing','completed','failed','expired','canceled'));
ALTER TABLE import_previews
  ADD COLUMN source_id UUID,
  ADD COLUMN observed_at TIMESTAMPTZ,
  ADD COLUMN approved_by UUID REFERENCES users(id),
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN committed_at TIMESTAMPTZ,
  ADD COLUMN result JSONB,
  ADD COLUMN failure_code TEXT,
  ADD COLUMN idempotency_key TEXT,
  ADD CONSTRAINT import_previews_source_fk
    FOREIGN KEY(workspace_id,source_id) REFERENCES sources(workspace_id,id);
CREATE UNIQUE INDEX import_previews_idempotency_idx
  ON import_previews(workspace_id,idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE import_rows (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  import_id UUID NOT NULL REFERENCES import_previews(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL CHECK(row_number >= 2),
  raw JSONB NOT NULL,
  normalized JSONB NOT NULL,
  validation_errors TEXT[] NOT NULL DEFAULT '{}',
  duplicate_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_action TEXT NOT NULL CHECK(proposed_action IN ('create','review_duplicate','reject')),
  committed_action TEXT CHECK(committed_action IS NULL OR committed_action IN (
    'created','staged_for_review','skipped_duplicate','rejected','failed'
  )),
  target_type TEXT,
  target_id UUID,
  safe_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(import_id,row_number),
  UNIQUE(workspace_id,id)
);
CREATE INDEX import_rows_review_idx
  ON import_rows(workspace_id,import_id,proposed_action,row_number);

CREATE TABLE import_approvals (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  import_id UUID NOT NULL REFERENCES import_previews(id),
  approver_user_id UUID NOT NULL REFERENCES users(id),
  source_digest TEXT NOT NULL,
  expected_row_count INTEGER NOT NULL,
  expected_create_count INTEGER NOT NULL,
  expected_review_count INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('approved','rejected','canceled')),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);

CREATE TABLE import_review_items (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  import_id UUID NOT NULL REFERENCES import_previews(id),
  import_row_id UUID NOT NULL REFERENCES import_rows(id),
  record_type TEXT NOT NULL,
  candidate JSONB NOT NULL,
  authority_effect TEXT NOT NULL DEFAULT 'none',
  status TEXT NOT NULL CHECK(status IN ('pending','adopted','rejected','needs_information')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(import_row_id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX import_review_items_queue_idx
  ON import_review_items(workspace_id,status,record_type,created_at);

CREATE TABLE record_merge_reviews (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  record_type TEXT NOT NULL CHECK(record_type IN (
    'product','brand','business','contact','business_buyer',
    'representation_opportunity','placement_opportunity','protected_account','order'
  )),
  survivor_id UUID NOT NULL,
  duplicate_id UUID NOT NULL,
  field_diff JSONB NOT NULL,
  preservation_plan JSONB NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','confirmed','rejected','reversed')),
  reason TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES users(id),
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES users(id),
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(survivor_id <> duplicate_id),
  UNIQUE(workspace_id,id)
);
CREATE UNIQUE INDEX record_merge_active_duplicate_idx
  ON record_merge_reviews(workspace_id,record_type,duplicate_id)
  WHERE status='confirmed';

CREATE TABLE record_aliases (
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  record_type TEXT NOT NULL,
  alias_id UUID NOT NULL,
  canonical_id UUID NOT NULL,
  merge_review_id UUID NOT NULL REFERENCES record_merge_reviews(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,record_type,alias_id),
  CHECK(alias_id <> canonical_id)
);

CREATE TABLE data_export_requests (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  requested_by UUID NOT NULL REFERENCES users(id),
  export_scope TEXT[] NOT NULL,
  export_format TEXT NOT NULL CHECK(export_format IN ('json','csv_bundle')),
  include_documents BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK(status IN (
    'queued','generating','ready','failed','canceled','expired'
  )),
  redaction_policy TEXT NOT NULL DEFAULT 'workspace_authorized_v1',
  manifest JSONB,
  payload JSONB,
  payload_digest TEXT,
  row_count INTEGER,
  safe_error TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(workspace_id,id)
);
CREATE INDEX data_export_requests_user_idx
  ON data_export_requests(workspace_id,requested_by,created_at DESC);

CREATE TABLE feature_controls (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  control_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT(workspace_id,control_key)
);

CREATE TABLE retention_policies (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  record_class TEXT NOT NULL,
  retention_days INTEGER CHECK(retention_days IS NULL OR retention_days > 0),
  disposition TEXT NOT NULL CHECK(disposition IN ('retain','review','anonymize','delete')),
  specialist_review_status TEXT NOT NULL CHECK(specialist_review_status IN (
    'not_started','required','approved'
  )),
  legal_basis_notes TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT(workspace_id,record_class)
);
INSERT INTO retention_policies
  (id,workspace_id,record_class,retention_days,disposition,specialist_review_status,legal_basis_notes)
VALUES
  (gen_random_uuid(),NULL,'identity_and_access',NULL,'retain','required',
   'Exact retention period pending specialist review under RPD-008.'),
  (gen_random_uuid(),NULL,'commercial_and_authority_history',NULL,'retain','required',
   'Preserve agreement, authority, order, commission, and audit history until specialist review.'),
  (gen_random_uuid(),NULL,'communications_and_activity',NULL,'review','required',
   'Automated deletion is disabled until legal and privacy review.'),
  (gen_random_uuid(),NULL,'documents_and_evidence',NULL,'review','required',
   'Rights, confidentiality, holds, and commercial obligations must be evaluated before disposition.'),
  (gen_random_uuid(),NULL,'provider_and_job_telemetry',NULL,'review','required',
   'Operational telemetry period pending security and privacy review.');

CREATE TABLE legal_holds (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  subject_type TEXT NOT NULL,
  subject_id UUID,
  reason TEXT NOT NULL,
  ticket_reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','released')),
  placed_by UUID NOT NULL REFERENCES users(id),
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_by UUID REFERENCES users(id),
  released_at TIMESTAMPTZ,
  release_reason TEXT,
  UNIQUE(workspace_id,id)
);
CREATE INDEX legal_holds_active_idx
  ON legal_holds(workspace_id,subject_type,subject_id) WHERE status='active';

CREATE TABLE account_closure_requests (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  export_requested BOOLEAN NOT NULL DEFAULT false,
  legal_hold_status TEXT NOT NULL CHECK(legal_hold_status IN ('clear','active','review_required')),
  status TEXT NOT NULL CHECK(status IN (
    'requested','identity_review','export_pending','hold','approved','completed','rejected','canceled'
  )),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  completed_at TIMESTAMPTZ,
  UNIQUE(workspace_id,id)
);

CREATE TABLE provider_readiness_checks (
  id UUID PRIMARY KEY,
  provider_key TEXT NOT NULL,
  environment TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('available','degraded','unavailable','not_configured')),
  safe_detail TEXT NOT NULL,
  checked_by UUID REFERENCES users(id),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX provider_readiness_latest_idx
  ON provider_readiness_checks(provider_key,environment,checked_at DESC);

CREATE TABLE launch_access_entries (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK(status IN ('allowed','paused','ended')),
  reason TEXT NOT NULL,
  approved_by UUID NOT NULL REFERENCES users(id),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,user_id)
);

ALTER TABLE notifications
  ADD COLUMN occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK(occurrence_count > 0),
  ADD COLUMN first_occurred_at TIMESTAMPTZ,
  ADD COLUMN last_occurred_at TIMESTAMPTZ,
  ADD COLUMN expires_at TIMESTAMPTZ;
UPDATE notifications SET first_occurred_at=created_at,last_occurred_at=created_at;
ALTER TABLE notifications
  ALTER COLUMN first_occurred_at SET NOT NULL,
  ALTER COLUMN first_occurred_at SET DEFAULT now(),
  ALTER COLUMN last_occurred_at SET NOT NULL,
  ALTER COLUMN last_occurred_at SET DEFAULT now();
CREATE TABLE notification_events (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  notification_id UUID NOT NULL REFERENCES notifications(id),
  source_event_type TEXT NOT NULL,
  source_event_id UUID,
  reason TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);
CREATE INDEX notification_events_history_idx
  ON notification_events(workspace_id,notification_id,occurred_at DESC);

CREATE INDEX activities_workspace_time_idx
  ON activities(workspace_id,occurred_at DESC,id);
CREATE INDEX placement_opportunities_search_idx
  ON placement_opportunities(workspace_id,stage,updated_at DESC,id);
CREATE INDEX orders_export_idx ON orders(workspace_id,created_at DESC,id);
CREATE INDEX commissions_export_idx ON commissions(workspace_id,created_at DESC,id);
CREATE INDEX evidence_export_idx ON evidence_records(workspace_id,created_at DESC,id);

CREATE OR REPLACE FUNCTION reject_phase9_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Phase 9 decision history is append-only';
END $$;

CREATE TRIGGER import_approvals_immutable
BEFORE UPDATE OR DELETE ON import_approvals
FOR EACH ROW EXECUTE FUNCTION reject_phase9_append_only_mutation();
