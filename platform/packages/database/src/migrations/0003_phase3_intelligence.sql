-- Phase 3: Product, Brand, and Buyer Intelligence.
-- Values remain typed; provenance is linked separately to avoid a generic EAV model.

ALTER TABLE products
  ADD COLUMN consumer_price NUMERIC(14,2) CHECK (consumer_price IS NULL OR consumer_price >= 0),
  ADD COLUMN currency CHAR(3),
  ADD COLUMN review_volume INTEGER CHECK (review_volume IS NULL OR review_volume >= 0),
  ADD COLUMN review_quality_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN sales_evidence_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN trend_direction TEXT CHECK (trend_direction IS NULL OR trend_direction IN ('rising','stable','declining','volatile','unknown')),
  ADD COLUMN repeat_purchase_hypothesis TEXT NOT NULL DEFAULT '',
  ADD COLUMN differentiation TEXT NOT NULL DEFAULT '',
  ADD COLUMN physical_retail_presence TEXT CHECK (physical_retail_presence IS NULL OR physical_retail_presence IN ('none_observed','limited','moderate','broad','unknown')),
  ADD COLUMN packaging_readiness TEXT CHECK (packaging_readiness IS NULL OR packaging_readiness IN ('not_reviewed','not_ready','conditional','ready','unknown')),
  ADD COLUMN wholesale_readiness TEXT CHECK (wholesale_readiness IS NULL OR wholesale_readiness IN ('not_reviewed','not_ready','conditional','ready','unknown')),
  ADD COLUMN inventory_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN fulfillment_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN returns_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN monitoring_status TEXT NOT NULL DEFAULT 'not_monitored'
    CHECK (monitoring_status IN ('not_monitored','active','paused','source_unavailable')),
  ADD COLUMN monitored_at TIMESTAMPTZ,
  ADD COLUMN last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN qualification_decision_id UUID,
  ADD COLUMN next_action_task_id UUID;

ALTER TABLE products
  ADD CONSTRAINT products_qualification_decision_fk
    FOREIGN KEY (workspace_id,qualification_decision_id)
    REFERENCES decision_records(workspace_id,id),
  ADD CONSTRAINT products_next_action_fk
    FOREIGN KEY (workspace_id,next_action_task_id)
    REFERENCES tasks(workspace_id,id);

ALTER TABLE brands
  ADD COLUMN pipeline_stage TEXT NOT NULL DEFAULT 'discovered'
    CHECK (pipeline_stage IN (
      'discovered','researching','contact_ready','contacted','conversation',
      'reviewing_terms','authorized','active','paused','ended','rejected'
    )),
  ADD COLUMN ownership_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN wholesale_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (wholesale_status IN ('unknown','not_offered','inquiry_required','available','restricted')),
  ADD COLUMN distribution_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN operations_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN inventory_capability TEXT NOT NULL DEFAULT 'unknown'
    CHECK (inventory_capability IN ('unknown','insufficient','conditional','supported')),
  ADD COLUMN fulfillment_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN communication_condition TEXT NOT NULL DEFAULT 'not_reviewed'
    CHECK (communication_condition IN ('not_reviewed','concerning','conditional','professional')),
  ADD COLUMN communication_rationale TEXT NOT NULL DEFAULT '',
  ADD COLUMN contact_purpose TEXT NOT NULL DEFAULT '',
  ADD COLUMN stop_flag BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN representation_status TEXT NOT NULL DEFAULT 'none'
    CHECK (representation_status IN ('none','considering','authorized','active','paused','ended')),
  ADD COLUMN last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN qualification_decision_id UUID,
  ADD COLUMN next_action_task_id UUID;

ALTER TABLE brands
  ADD CONSTRAINT brands_qualification_decision_fk
    FOREIGN KEY (workspace_id,qualification_decision_id)
    REFERENCES decision_records(workspace_id,id),
  ADD CONSTRAINT brands_next_action_fk
    FOREIGN KEY (workspace_id,next_action_task_id)
    REFERENCES tasks(workspace_id,id);

ALTER TABLE businesses
  ADD COLUMN locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN assortment_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN target_customer_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN price_positioning TEXT NOT NULL DEFAULT 'unknown'
    CHECK (price_positioning IN ('unknown','value','mid_market','premium','luxury','mixed')),
  ADD COLUMN current_vendors_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN qualification_status TEXT NOT NULL DEFAULT 'not_reviewed'
    CHECK (qualification_status IN ('not_reviewed','researching','qualified','rejected','conditional')),
  ADD COLUMN conflict_status TEXT NOT NULL DEFAULT 'not_checked'
    CHECK (conflict_status IN ('not_checked','clear','possible','blocking')),
  ADD COLUMN conflict_rationale TEXT NOT NULL DEFAULT '',
  ADD COLUMN last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN qualification_decision_id UUID,
  ADD COLUMN next_action_task_id UUID;

ALTER TABLE businesses
  ADD CONSTRAINT businesses_qualification_decision_fk
    FOREIGN KEY (workspace_id,qualification_decision_id)
    REFERENCES decision_records(workspace_id,id),
  ADD CONSTRAINT businesses_next_action_fk
    FOREIGN KEY (workspace_id,next_action_task_id)
    REFERENCES tasks(workspace_id,id);

ALTER TABLE contacts
  ADD COLUMN professional_handle TEXT,
  ADD COLUMN seniority TEXT,
  ADD COLUMN location JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN last_verified_at TIMESTAMPTZ,
  ADD COLUMN source_observed_at TIMESTAMPTZ,
  ADD COLUMN verification_notes TEXT NOT NULL DEFAULT '';

ALTER TABLE business_buyers
  ADD COLUMN stated_needs TEXT NOT NULL DEFAULT '',
  ADD COLUMN buying_window TEXT NOT NULL DEFAULT '',
  ADD COLUMN decision_process TEXT NOT NULL DEFAULT '',
  ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','reviewing','verified','stale','disputed')),
  ADD COLUMN verified_at TIMESTAMPTZ,
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

CREATE TABLE intelligence_field_evidence (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('product','brand','business','contact','business_buyer')),
  subject_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  evidence_id UUID NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('user_entered','human_confirmed','externally_sourced','imported','ai_suggested','system_derived')),
  linked_by UUID NOT NULL REFERENCES users(id),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id,evidence_id) REFERENCES evidence_records(workspace_id,id),
  UNIQUE(workspace_id,subject_type,subject_id,field_name,evidence_id)
);
CREATE INDEX intelligence_field_evidence_subject_idx
  ON intelligence_field_evidence(workspace_id,subject_type,subject_id,field_name);

CREATE TABLE intelligence_observations (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('product','brand','business','contact')),
  subject_id UUID NOT NULL,
  metric_code TEXT NOT NULL,
  value JSONB NOT NULL,
  unit TEXT,
  evidence_class TEXT NOT NULL CHECK (evidence_class IN (
    'verified_fact','direct_evidence','strong_proxy','weak_proxy','estimate',
    'assumption','model_generated_inference','unknown'
  )),
  confidence TEXT NOT NULL CHECK (confidence IN ('insufficient','limited','supported','strong')),
  source_id UUID,
  unknown_reason TEXT,
  observed_at TIMESTAMPTZ,
  geography TEXT,
  acquisition_context TEXT NOT NULL,
  limitations TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('current','stale','disputed','superseded','source_unavailable')),
  supersedes_id UUID REFERENCES intelligence_observations(id),
  origin TEXT NOT NULL CHECK (origin IN ('user_entered','externally_sourced','imported','ai_suggested')),
  reviewed_by UUID NOT NULL REFERENCES users(id),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (evidence_class='unknown' AND unknown_reason IS NOT NULL) OR
    (evidence_class<>'unknown' AND source_id IS NOT NULL)
  ),
  FOREIGN KEY (workspace_id,source_id) REFERENCES sources(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX intelligence_observations_subject_idx
  ON intelligence_observations(workspace_id,subject_type,subject_id,metric_code,status);

CREATE TABLE product_buyer_category_recommendations (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  product_id UUID NOT NULL,
  buyer_category TEXT NOT NULL,
  rationale TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('insufficient','limited','supported','strong')),
  evidence_ids UUID[] NOT NULL DEFAULT '{}',
  missing_evidence TEXT[] NOT NULL DEFAULT '{}',
  contrary_evidence TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL CHECK (origin IN ('user_entered','imported','ai_suggested')),
  status TEXT NOT NULL CHECK (status IN ('proposed','confirmed','rejected','superseded')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id,product_id) REFERENCES products(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX buyer_category_product_idx
  ON product_buyer_category_recommendations(workspace_id,product_id,status);

CREATE TABLE product_business_match_reviews (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  product_id UUID NOT NULL,
  business_id UUID NOT NULL,
  context JSONB NOT NULL,
  context_digest TEXT NOT NULL,
  rationale TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('insufficient','limited','supported','strong')),
  material_statements JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids UUID[] NOT NULL DEFAULT '{}',
  missing_evidence TEXT[] NOT NULL DEFAULT '{}',
  contrary_evidence TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL CHECK (origin IN ('user_entered','imported','ai_suggested')),
  status TEXT NOT NULL CHECK (status IN ('proposed','under_review','qualified','conditional','rejected','superseded')),
  decision_id UUID,
  next_action_task_id UUID,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id,product_id) REFERENCES products(workspace_id,id),
  FOREIGN KEY (workspace_id,business_id) REFERENCES businesses(workspace_id,id),
  FOREIGN KEY (workspace_id,decision_id) REFERENCES decision_records(workspace_id,id),
  FOREIGN KEY (workspace_id,next_action_task_id) REFERENCES tasks(workspace_id,id),
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,product_id,business_id,context_digest)
);
CREATE INDEX product_business_match_status_idx
  ON product_business_match_reviews(workspace_id,status,updated_at DESC);

CREATE TABLE product_comparisons (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  context JSONB NOT NULL,
  selected_product_id UUID,
  selection_rationale TEXT,
  decision_id UUID,
  status TEXT NOT NULL CHECK (status IN ('draft','decided','archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id,selected_product_id) REFERENCES products(workspace_id,id),
  FOREIGN KEY (workspace_id,decision_id) REFERENCES decision_records(workspace_id,id),
  UNIQUE(workspace_id,id)
);

CREATE TABLE product_comparison_items (
  comparison_id UUID NOT NULL REFERENCES product_comparisons(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  product_id UUID NOT NULL,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id,product_id) REFERENCES products(workspace_id,id),
  PRIMARY KEY(comparison_id,product_id),
  UNIQUE(comparison_id,position)
);

CREATE TABLE brand_stage_events (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  brand_id UUID NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  reason TEXT NOT NULL,
  decision_id UUID,
  actor_user_id UUID NOT NULL REFERENCES users(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id UUID NOT NULL,
  FOREIGN KEY (workspace_id,brand_id) REFERENCES brands(workspace_id,id),
  FOREIGN KEY (workspace_id,decision_id) REFERENCES decision_records(workspace_id,id)
);
CREATE INDEX brand_stage_events_brand_idx
  ON brand_stage_events(workspace_id,brand_id,occurred_at DESC);

CREATE FUNCTION prevent_intelligence_history_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'intelligence history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brand_stage_events_append_only
  BEFORE UPDATE OR DELETE ON brand_stage_events
  FOR EACH ROW EXECUTE FUNCTION prevent_intelligence_history_mutation();

CREATE INDEX products_intelligence_views_idx
  ON products(workspace_id,status,last_reviewed_at DESC,updated_at DESC)
  WHERE archived_at IS NULL;
CREATE INDEX brands_pipeline_idx
  ON brands(workspace_id,pipeline_stage,updated_at DESC)
  WHERE archived_at IS NULL;
CREATE INDEX businesses_qualification_idx
  ON businesses(workspace_id,qualification_status,updated_at DESC)
  WHERE archived_at IS NULL;
