CREATE TABLE system_feature_controls (
  feature TEXT PRIMARY KEY CHECK(feature IN ('ai_generation')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  reason TEXT NOT NULL DEFAULT '',
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);

INSERT INTO system_feature_controls(feature,enabled,reason)
VALUES('ai_generation',true,'Phase 7 default; provider configuration is a separate gate')
ON CONFLICT(feature) DO NOTHING;

CREATE TABLE ai_runs (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  requesting_user_id UUID NOT NULL REFERENCES users(id),
  use_case TEXT NOT NULL CHECK(use_case IN (
    'product_research','brand_research','business_research','evidence_summary',
    'missing_evidence','product_comparison','brand_comparison','business_fit',
    'outreach_personalization','email_draft','follow_up_draft','call_preparation',
    'objection_guidance','meeting_preparation','pipeline_summary',
    'stalled_opportunity','reorder_review','commission_explanation',
    'agreement_summary','document_extraction','duplicate_detection',
    'next_best_action','weekly_briefing','daily_briefing','account_summary',
    'dispute_summary','relationship_closure','contact_role'
  )),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  user_instruction TEXT NOT NULL DEFAULT '',
  prompt_template_key TEXT NOT NULL,
  prompt_template_version INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  context_digest TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed','blocked')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  model_version TEXT NOT NULL,
  provider_retention_mode TEXT NOT NULL,
  provider_training_allowed BOOLEAN NOT NULL DEFAULT false,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_minor_units BIGINT,
  cost_currency TEXT CHECK(cost_currency IS NULL OR cost_currency ~ '^[A-Z]{3}$'),
  latency_ms INTEGER,
  safe_error_code TEXT,
  safe_error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(provider_training_allowed=false),
  UNIQUE(workspace_id,id)
);
CREATE INDEX ai_runs_target_idx
  ON ai_runs(workspace_id,target_type,target_id,created_at DESC);
CREATE INDEX ai_runs_status_idx
  ON ai_runs(status,created_at DESC);

CREATE TABLE ai_run_context_items (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  run_id UUID NOT NULL,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  label TEXT NOT NULL,
  evidence_id UUID,
  source_id UUID,
  document_id UUID,
  evidence_class TEXT NOT NULL CHECK(evidence_class IN (
    'verified_fact','direct_evidence','strong_proxy','weak_proxy','estimate',
    'model_inference','unknown'
  )),
  freshness_at TIMESTAMPTZ,
  limitations TEXT NOT NULL DEFAULT '',
  permitted_use TEXT NOT NULL DEFAULT '',
  content_excerpt TEXT NOT NULL,
  content_digest TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,run_id) REFERENCES ai_runs(workspace_id,id),
  FOREIGN KEY(workspace_id,evidence_id) REFERENCES evidence_records(workspace_id,id),
  FOREIGN KEY(workspace_id,source_id) REFERENCES sources(workspace_id,id),
  FOREIGN KEY(workspace_id,document_id) REFERENCES documents(workspace_id,id),
  UNIQUE(workspace_id,run_id,ordinal),
  UNIQUE(workspace_id,id)
);

CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  run_id UUID NOT NULL,
  requesting_user_id UUID NOT NULL REFERENCES users(id),
  regeneration_parent_id UUID,
  suggestion_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  title TEXT NOT NULL,
  original_content TEXT NOT NULL,
  structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence TEXT NOT NULL CHECK(confidence IN (
    'insufficient','limited','supported','strong'
  )),
  confidence_subject TEXT NOT NULL,
  limitations TEXT[] NOT NULL DEFAULT '{}',
  missing_evidence TEXT[] NOT NULL DEFAULT '{}',
  contrary_evidence TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK(status IN (
    'generated','accepted','edited','rejected','expired'
  )),
  generated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  current_content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,run_id) REFERENCES ai_runs(workspace_id,id),
  FOREIGN KEY(workspace_id,regeneration_parent_id)
    REFERENCES ai_suggestions(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX ai_suggestions_target_idx
  ON ai_suggestions(workspace_id,target_type,target_id,generated_at DESC);
CREATE INDEX ai_suggestions_review_idx
  ON ai_suggestions(workspace_id,status,generated_at DESC);

CREATE TABLE ai_suggestion_statements (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  suggestion_id UUID NOT NULL,
  statement_text TEXT NOT NULL,
  classification TEXT NOT NULL CHECK(classification IN (
    'verified_fact','direct_evidence','strong_proxy','weak_proxy','estimate',
    'model_inference','unknown'
  )),
  confidence TEXT NOT NULL CHECK(confidence IN (
    'insufficient','limited','supported','strong'
  )),
  ordinal INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,suggestion_id)
    REFERENCES ai_suggestions(workspace_id,id),
  UNIQUE(workspace_id,suggestion_id,ordinal),
  UNIQUE(workspace_id,id)
);

CREATE TABLE ai_statement_context_links (
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  statement_id UUID NOT NULL,
  context_item_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,statement_id)
    REFERENCES ai_suggestion_statements(workspace_id,id),
  FOREIGN KEY(workspace_id,context_item_id)
    REFERENCES ai_run_context_items(workspace_id,id),
  PRIMARY KEY(workspace_id,statement_id,context_item_id)
);

CREATE TABLE ai_suggestion_actions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  suggestion_id UUID NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK(action IN (
    'accepted','edited','rejected','regenerated','feedback','reported_problem'
  )),
  original_content TEXT NOT NULL,
  final_content TEXT,
  reason_category TEXT,
  note TEXT NOT NULL DEFAULT '',
  selected_fields TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,suggestion_id)
    REFERENCES ai_suggestions(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX ai_suggestion_actions_history_idx
  ON ai_suggestion_actions(workspace_id,suggestion_id,created_at);

CREATE OR REPLACE FUNCTION prevent_ai_material_rewrite()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.workspace_id IS DISTINCT FROM NEW.workspace_id
     OR OLD.run_id IS DISTINCT FROM NEW.run_id
     OR OLD.requesting_user_id IS DISTINCT FROM NEW.requesting_user_id
     OR OLD.regeneration_parent_id IS DISTINCT FROM NEW.regeneration_parent_id
     OR OLD.suggestion_type IS DISTINCT FROM NEW.suggestion_type
     OR OLD.target_type IS DISTINCT FROM NEW.target_type
     OR OLD.target_id IS DISTINCT FROM NEW.target_id
     OR OLD.title IS DISTINCT FROM NEW.title
     OR OLD.original_content IS DISTINCT FROM NEW.original_content
     OR OLD.structured_payload IS DISTINCT FROM NEW.structured_payload
     OR OLD.confidence IS DISTINCT FROM NEW.confidence
     OR OLD.confidence_subject IS DISTINCT FROM NEW.confidence_subject
     OR OLD.limitations IS DISTINCT FROM NEW.limitations
     OR OLD.missing_evidence IS DISTINCT FROM NEW.missing_evidence
     OR OLD.contrary_evidence IS DISTINCT FROM NEW.contrary_evidence
     OR OLD.generated_at IS DISTINCT FROM NEW.generated_at
     OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
  THEN
    RAISE EXCEPTION 'AI suggestion original and provenance fields are immutable';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER ai_suggestions_material_immutable
BEFORE UPDATE ON ai_suggestions
FOR EACH ROW EXECUTE FUNCTION prevent_ai_material_rewrite();

CREATE OR REPLACE FUNCTION reject_phase7_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Phase 7 AI provenance history is append-only';
END $$;

CREATE TRIGGER ai_suggestions_no_delete
BEFORE DELETE ON ai_suggestions
FOR EACH STATEMENT EXECUTE FUNCTION reject_phase7_history_mutation();
CREATE TRIGGER ai_context_no_update
BEFORE UPDATE OR DELETE ON ai_run_context_items
FOR EACH STATEMENT EXECUTE FUNCTION reject_phase7_history_mutation();
CREATE TRIGGER ai_statements_no_update
BEFORE UPDATE OR DELETE ON ai_suggestion_statements
FOR EACH STATEMENT EXECUTE FUNCTION reject_phase7_history_mutation();
CREATE TRIGGER ai_statement_links_no_update
BEFORE UPDATE OR DELETE ON ai_statement_context_links
FOR EACH STATEMENT EXECUTE FUNCTION reject_phase7_history_mutation();
CREATE TRIGGER ai_actions_no_update
BEFORE UPDATE OR DELETE ON ai_suggestion_actions
FOR EACH STATEMENT EXECUTE FUNCTION reject_phase7_history_mutation();
