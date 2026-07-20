CREATE TABLE representation_opportunities (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  brand_id UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  brand_contact_id UUID,
  stage TEXT NOT NULL CHECK(stage IN (
    'identified','contact_ready','contacted','conversation','reviewing_terms',
    'agreement_draft','approved','converted','paused','rejected'
  )),
  proposed_channels TEXT[] NOT NULL DEFAULT '{}',
  proposed_territory JSONB NOT NULL DEFAULT '{}'::jsonb,
  brand_objectives TEXT NOT NULL DEFAULT '',
  terms_summary TEXT NOT NULL DEFAULT '',
  missing_terms TEXT[] NOT NULL DEFAULT '{}',
  decision_id UUID,
  next_action_task_id UUID,
  rejection_reason TEXT,
  converted_agreement_id UUID,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  FOREIGN KEY(workspace_id,brand_id) REFERENCES brands(workspace_id,id),
  FOREIGN KEY(workspace_id,brand_contact_id) REFERENCES contacts(workspace_id,id),
  FOREIGN KEY(workspace_id,decision_id) REFERENCES decision_records(workspace_id,id),
  FOREIGN KEY(workspace_id,next_action_task_id) REFERENCES tasks(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX representation_opportunity_stage_idx
  ON representation_opportunities(workspace_id,stage,updated_at DESC);

CREATE TABLE representation_opportunity_products (
  opportunity_id UUID NOT NULL REFERENCES representation_opportunities(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  product_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,product_id) REFERENCES products(workspace_id,id),
  PRIMARY KEY(opportunity_id,product_id)
);

CREATE TABLE representation_opportunity_events (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  opportunity_id UUID NOT NULL REFERENCES representation_opportunities(id),
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  reason TEXT NOT NULL,
  decision_id UUID,
  actor_user_id UUID NOT NULL REFERENCES users(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,decision_id) REFERENCES decision_records(workspace_id,id)
);
CREATE INDEX representation_opportunity_events_idx
  ON representation_opportunity_events(workspace_id,opportunity_id,occurred_at DESC);

CREATE TABLE representation_agreements (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  representation_opportunity_id UUID REFERENCES representation_opportunities(id),
  brand_id UUID NOT NULL,
  representative_user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK(status IN (
    'draft','reviewing','pending_approval','active','suspended','expired','ended'
  )),
  source_document_id UUID,
  effective_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  channels TEXT[] NOT NULL DEFAULT '{}',
  territory_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  authority_summary TEXT NOT NULL DEFAULT '',
  commission_basis TEXT NOT NULL DEFAULT '',
  commission_rate NUMERIC(9,6),
  commission_currency TEXT CHECK(commission_currency IS NULL OR commission_currency ~ '^[A-Z]{3}$'),
  commission_timing TEXT NOT NULL DEFAULT '',
  opening_order_rights TEXT NOT NULL DEFAULT '',
  reorder_rights TEXT NOT NULL DEFAULT '',
  protected_account_rules TEXT NOT NULL DEFAULT '',
  house_account_rules TEXT NOT NULL DEFAULT '',
  termination_terms TEXT NOT NULL DEFAULT '',
  termination_notice_days INTEGER CHECK(termination_notice_days IS NULL OR termination_notice_days >= 0),
  post_termination_commission_rights TEXT NOT NULL DEFAULT '',
  post_termination_commission_ends_at TIMESTAMPTZ,
  renewal_status TEXT NOT NULL DEFAULT 'not_reviewed' CHECK(renewal_status IN (
    'not_reviewed','not_renewing','review_due','renewal_in_progress','renewed'
  )),
  renewal_review_at TIMESTAMPTZ,
  legal_ambiguity_status TEXT NOT NULL DEFAULT 'none' CHECK(legal_ambiguity_status IN (
    'none','review_required','specialist_required','resolved'
  )),
  legal_ambiguity_notes TEXT NOT NULL DEFAULT '',
  approval_id UUID,
  authority_digest TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  suspended_reason TEXT,
  ended_reason TEXT,
  ended_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  FOREIGN KEY(workspace_id,brand_id) REFERENCES brands(workspace_id,id),
  FOREIGN KEY(workspace_id,source_document_id) REFERENCES documents(workspace_id,id),
  FOREIGN KEY(workspace_id,approval_id) REFERENCES human_approvals(workspace_id,id),
  UNIQUE(workspace_id,id),
  CHECK(expires_at IS NULL OR effective_at IS NULL OR expires_at > effective_at)
);
ALTER TABLE representation_opportunities
  ADD CONSTRAINT representation_opportunity_converted_agreement_fk
  FOREIGN KEY(converted_agreement_id) REFERENCES representation_agreements(id);
CREATE INDEX representation_agreement_status_idx
  ON representation_agreements(workspace_id,brand_id,status,effective_at,expires_at);

CREATE TABLE representation_agreement_products (
  agreement_id UUID NOT NULL REFERENCES representation_agreements(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  product_id UUID NOT NULL,
  scope_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,product_id) REFERENCES products(workspace_id,id),
  PRIMARY KEY(agreement_id,product_id)
);

CREATE TABLE agreement_term_candidates (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  agreement_id UUID NOT NULL REFERENCES representation_agreements(id),
  source_document_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  proposed_value JSONB NOT NULL,
  source_page INTEGER CHECK(source_page IS NULL OR source_page > 0),
  source_location TEXT NOT NULL,
  evidence_excerpt TEXT NOT NULL DEFAULT '',
  evidence_class TEXT NOT NULL CHECK(evidence_class IN (
    'verified_fact','direct_evidence','strong_proxy','weak_proxy','estimate',
    'assumption','model_generated_inference','unknown'
  )),
  confidence TEXT NOT NULL CHECK(confidence IN ('insufficient','limited','supported','strong')),
  origin TEXT NOT NULL CHECK(origin IN ('user_entered','imported','ai_suggested')),
  status TEXT NOT NULL CHECK(status IN ('proposed','confirmed','rejected','superseded')),
  material BOOLEAN NOT NULL DEFAULT true,
  ambiguous BOOLEAN NOT NULL DEFAULT false,
  specialist_review_required BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,source_document_id) REFERENCES documents(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX agreement_term_candidates_idx
  ON agreement_term_candidates(workspace_id,agreement_id,status,field_name);

CREATE TABLE agreement_account_restrictions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  agreement_id UUID NOT NULL REFERENCES representation_agreements(id),
  restriction_type TEXT NOT NULL CHECK(restriction_type IN (
    'house_account_exclusion','protected_account_basis','account_exclusion'
  )),
  business_id UUID,
  account_name TEXT NOT NULL,
  normalized_account_name TEXT NOT NULL,
  product_ids UUID[] NOT NULL DEFAULT '{}',
  channels TEXT[] NOT NULL DEFAULT '{}',
  territory_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  source_document_id UUID NOT NULL,
  source_location TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('proposed','confirmed','expired','released')),
  approval_id UUID,
  created_by UUID NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id),
  FOREIGN KEY(workspace_id,source_document_id) REFERENCES documents(workspace_id,id),
  FOREIGN KEY(workspace_id,approval_id) REFERENCES human_approvals(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX agreement_account_restriction_match_idx
  ON agreement_account_restrictions(workspace_id,normalized_account_name,status);

CREATE TABLE representation_agreement_versions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  agreement_id UUID NOT NULL REFERENCES representation_agreements(id),
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  snapshot_digest TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agreement_id,version)
);

CREATE TABLE authority_evaluations (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  agreement_id UUID,
  brand_id UUID NOT NULL,
  product_ids UUID[] NOT NULL DEFAULT '{}',
  business_id UUID,
  action TEXT NOT NULL CHECK(action IN (
    'prepare_outreach','approve_outreach','send_outreach','brand_authorized',
    'brand_active','product_represented','placement_create','placement_stage'
  )),
  outcome TEXT NOT NULL CHECK(outcome IN ('authorized','denied','review_required')),
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  authority_digest TEXT,
  evaluated_by UUID NOT NULL REFERENCES users(id),
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,agreement_id) REFERENCES representation_agreements(workspace_id,id),
  FOREIGN KEY(workspace_id,brand_id) REFERENCES brands(workspace_id,id),
  FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id)
);
CREATE INDEX authority_evaluations_idx
  ON authority_evaluations(workspace_id,brand_id,evaluated_at DESC);

CREATE TABLE placement_opportunities (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  agreement_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  business_id UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  stage TEXT NOT NULL CHECK(stage IN (
    'identified','qualified','prepared','contacted','engaged','information_sample_sent',
    'buyer_review','terms_order_discussion','opening_order','active_account',
    'reorder_management','closed_lost','disqualified'
  )),
  match_thesis TEXT NOT NULL,
  buyer_value_basis TEXT NOT NULL,
  evidence_confidence TEXT NOT NULL CHECK(evidence_confidence IN (
    'insufficient','limited','supported','strong'
  )),
  decision_id UUID NOT NULL,
  next_action_task_id UUID,
  conflict_status TEXT NOT NULL DEFAULT 'clear' CHECK(conflict_status IN (
    'clear','review_required','blocked'
  )),
  loss_reason TEXT,
  disqualification_reason TEXT,
  snoozed_until TIMESTAMPTZ,
  last_meaningful_action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  FOREIGN KEY(workspace_id,agreement_id) REFERENCES representation_agreements(workspace_id,id),
  FOREIGN KEY(workspace_id,brand_id) REFERENCES brands(workspace_id,id),
  FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id),
  FOREIGN KEY(workspace_id,decision_id) REFERENCES decision_records(workspace_id,id),
  FOREIGN KEY(workspace_id,next_action_task_id) REFERENCES tasks(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX placement_opportunity_stage_idx
  ON placement_opportunities(workspace_id,stage,updated_at DESC);

CREATE TABLE placement_opportunity_products (
  placement_opportunity_id UUID NOT NULL REFERENCES placement_opportunities(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  product_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,product_id) REFERENCES products(workspace_id,id),
  PRIMARY KEY(placement_opportunity_id,product_id)
);

CREATE TABLE relationship_triangle_reviews (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  placement_opportunity_id UUID NOT NULL REFERENCES placement_opportunities(id),
  brand_value TEXT NOT NULL,
  brand_obligations TEXT NOT NULL,
  brand_risks TEXT NOT NULL,
  brand_warning_signs TEXT NOT NULL DEFAULT '',
  buyer_value TEXT NOT NULL,
  buyer_obligations TEXT NOT NULL,
  buyer_risks TEXT NOT NULL,
  buyer_warning_signs TEXT NOT NULL DEFAULT '',
  representative_value TEXT NOT NULL,
  representative_obligations TEXT NOT NULL,
  representative_risks TEXT NOT NULL,
  representative_warning_signs TEXT NOT NULL DEFAULT '',
  all_parties_receive_legitimate_value BOOLEAN NOT NULL,
  reviewed_by UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK(status IN ('current','superseded')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);

CREATE TABLE placement_stage_events (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  placement_opportunity_id UUID NOT NULL REFERENCES placement_opportunities(id),
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  reason TEXT NOT NULL,
  decision_id UUID,
  evidence_ids UUID[] NOT NULL DEFAULT '{}',
  actor_user_id UUID NOT NULL REFERENCES users(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,decision_id) REFERENCES decision_records(workspace_id,id)
);
CREATE INDEX placement_stage_events_idx
  ON placement_stage_events(workspace_id,placement_opportunity_id,occurred_at DESC);

CREATE TABLE placement_conflicts (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  placement_opportunity_id UUID REFERENCES placement_opportunities(id),
  agreement_restriction_id UUID REFERENCES agreement_account_restrictions(id),
  business_id UUID NOT NULL,
  conflict_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('possible','blocking','resolved','dismissed')),
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolution TEXT NOT NULL DEFAULT '',
  decision_id UUID,
  approval_id UUID,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id),
  FOREIGN KEY(workspace_id,decision_id) REFERENCES decision_records(workspace_id,id),
  FOREIGN KEY(workspace_id,approval_id) REFERENCES human_approvals(workspace_id,id),
  UNIQUE(workspace_id,id)
);

CREATE OR REPLACE FUNCTION reject_phase4_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Phase 4 history is append-only';
END;
$$;

CREATE TRIGGER representation_agreement_versions_immutable
BEFORE UPDATE OR DELETE ON representation_agreement_versions
FOR EACH ROW EXECUTE FUNCTION reject_phase4_append_only_mutation();

CREATE TRIGGER authority_evaluations_immutable
BEFORE UPDATE OR DELETE ON authority_evaluations
FOR EACH ROW EXECUTE FUNCTION reject_phase4_append_only_mutation();

CREATE TRIGGER placement_stage_events_immutable
BEFORE UPDATE OR DELETE ON placement_stage_events
FOR EACH ROW EXECUTE FUNCTION reject_phase4_append_only_mutation();

CREATE TRIGGER representation_opportunity_events_immutable
BEFORE UPDATE OR DELETE ON representation_opportunity_events
FOR EACH ROW EXECUTE FUNCTION reject_phase4_append_only_mutation();
