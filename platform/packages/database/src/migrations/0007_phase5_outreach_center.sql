ALTER TABLE placement_opportunities
  ADD COLUMN authority_channel TEXT NOT NULL DEFAULT 'unspecified';

CREATE TABLE outreach_templates (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('email','social','call','voicemail','objection','follow_up')),
  purpose TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','active','archived')),
  current_version INTEGER NOT NULL DEFAULT 1,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,name,channel)
);

CREATE TABLE outreach_template_versions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  template_id UUID NOT NULL,
  version INTEGER NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  required_variables TEXT[] NOT NULL DEFAULT '{}',
  required_compliance_blocks TEXT[] NOT NULL DEFAULT '{}',
  change_reason TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,template_id) REFERENCES outreach_templates(workspace_id,id),
  UNIQUE(template_id,version)
);

CREATE TABLE outreach_messages (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  placement_opportunity_id UUID NOT NULL,
  agreement_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  business_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  channel TEXT NOT NULL CHECK(channel IN ('email','social')),
  direction TEXT NOT NULL CHECK(direction IN ('outbound','inbound')),
  sender_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN
    ('draft','approval_requested','approved','queued','accepted','delivered','replied',
     'bounced','failed','suppressed','canceled','received')),
  template_version_id UUID REFERENCES outreach_template_versions(id),
  sequence_enrollment_id UUID,
  sequence_step_id UUID,
  origin TEXT NOT NULL CHECK(origin IN ('user_entered','imported','ai_suggested','provider')),
  scheduled_at TIMESTAMPTZ,
  approval_id UUID REFERENCES human_approvals(id),
  artifact_digest TEXT,
  approved_digest TEXT,
  provider_message_id TEXT,
  provider_status TEXT,
  provider_safe_detail TEXT,
  accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  response_classification TEXT CHECK(response_classification IS NULL OR response_classification IN
    ('interested','not_now','objection','question','opt_out','wrong_contact','not_fit')),
  response_notes TEXT NOT NULL DEFAULT '',
  classified_by UUID REFERENCES users(id),
  classified_at TIMESTAMPTZ,
  sent_activity_id UUID REFERENCES activities(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,placement_opportunity_id) REFERENCES placement_opportunities(workspace_id,id),
  FOREIGN KEY(workspace_id,agreement_id) REFERENCES representation_agreements(workspace_id,id),
  FOREIGN KEY(workspace_id,brand_id) REFERENCES brands(workspace_id,id),
  FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id),
  FOREIGN KEY(workspace_id,contact_id) REFERENCES contacts(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX outreach_messages_context_idx
  ON outreach_messages(workspace_id,placement_opportunity_id,created_at DESC);
CREATE UNIQUE INDEX outreach_messages_provider_id_unique
  ON outreach_messages(provider_message_id) WHERE provider_message_id IS NOT NULL;

CREATE TABLE outreach_message_products (
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  message_id UUID NOT NULL,
  product_id UUID NOT NULL,
  FOREIGN KEY(workspace_id,message_id) REFERENCES outreach_messages(workspace_id,id),
  FOREIGN KEY(workspace_id,product_id) REFERENCES products(workspace_id,id),
  PRIMARY KEY(message_id,product_id)
);

CREATE TABLE outreach_message_claims (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  message_id UUID NOT NULL,
  claim_text TEXT NOT NULL,
  product_id UUID,
  evidence_id UUID,
  status TEXT NOT NULL CHECK(status IN ('supported','unsupported','stale','disputed')),
  validated_at TIMESTAMPTZ,
  FOREIGN KEY(workspace_id,message_id) REFERENCES outreach_messages(workspace_id,id),
  FOREIGN KEY(workspace_id,product_id) REFERENCES products(workspace_id,id),
  FOREIGN KEY(workspace_id,evidence_id) REFERENCES evidence_records(workspace_id,id),
  UNIQUE(workspace_id,id)
);

CREATE TABLE outreach_message_attachments (
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  message_id UUID NOT NULL,
  document_id UUID NOT NULL,
  attached_sha256 TEXT NOT NULL,
  FOREIGN KEY(workspace_id,message_id) REFERENCES outreach_messages(workspace_id,id),
  FOREIGN KEY(workspace_id,document_id) REFERENCES documents(workspace_id,id),
  PRIMARY KEY(message_id,document_id)
);

CREATE TABLE communication_suppressions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  contact_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('email','social','call','all')),
  reason TEXT NOT NULL CHECK(reason IN
    ('opt_out','complaint','hard_bounce','prohibited','invalid_authority','account_conflict','manual')),
  status TEXT NOT NULL CHECK(status IN ('active','corrected')),
  source TEXT NOT NULL,
  source_event_id TEXT,
  corrected_reason TEXT,
  correction_evidence TEXT,
  created_by UUID REFERENCES users(id),
  corrected_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  corrected_at TIMESTAMPTZ,
  FOREIGN KEY(workspace_id,contact_id) REFERENCES contacts(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX communication_suppressions_active_idx
  ON communication_suppressions(workspace_id,contact_id,channel) WHERE status='active';

CREATE TABLE outreach_calls (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  placement_opportunity_id UUID NOT NULL,
  agreement_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  business_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK(status IN ('planned','completed','no_answer','voicemail','canceled')),
  objective TEXT NOT NULL,
  preparation TEXT NOT NULL DEFAULT '',
  questions TEXT[] NOT NULL DEFAULT '{}',
  objection_guidance JSONB NOT NULL DEFAULT '[]'::jsonb,
  authority_limits TEXT NOT NULL DEFAULT '',
  voicemail_script TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER CHECK(duration_seconds IS NULL OR duration_seconds>=0),
  occurred_at TIMESTAMPTZ,
  activity_id UUID REFERENCES activities(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,placement_opportunity_id) REFERENCES placement_opportunities(workspace_id,id),
  FOREIGN KEY(workspace_id,agreement_id) REFERENCES representation_agreements(workspace_id,id),
  FOREIGN KEY(workspace_id,brand_id) REFERENCES brands(workspace_id,id),
  FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id),
  FOREIGN KEY(workspace_id,contact_id) REFERENCES contacts(workspace_id,id),
  UNIQUE(workspace_id,id)
);

CREATE TABLE outreach_sequences (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','active','paused','archived')),
  stop_conditions TEXT[] NOT NULL DEFAULT
    ARRAY['reply','opt_out','closed','disqualified','access_restricted','authority_invalid','conflict'],
  current_version INTEGER NOT NULL DEFAULT 1,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,name)
);

CREATE TABLE outreach_sequence_steps (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  sequence_id UUID NOT NULL,
  sequence_version INTEGER NOT NULL,
  position INTEGER NOT NULL CHECK(position>0),
  step_type TEXT NOT NULL CHECK(step_type IN ('email','social','call','task')),
  delay_minutes INTEGER NOT NULL CHECK(delay_minutes>=0),
  template_version_id UUID REFERENCES outreach_template_versions(id),
  task_title TEXT,
  instructions TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,sequence_id) REFERENCES outreach_sequences(workspace_id,id),
  UNIQUE(sequence_id,sequence_version,position)
);

CREATE TABLE outreach_sequence_enrollments (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  sequence_id UUID NOT NULL,
  sequence_version INTEGER NOT NULL,
  placement_opportunity_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK(status IN ('active','paused','completed','stopped')),
  current_position INTEGER NOT NULL DEFAULT 0,
  next_step_at TIMESTAMPTZ,
  stop_reason TEXT,
  stopped_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,sequence_id) REFERENCES outreach_sequences(workspace_id,id),
  FOREIGN KEY(workspace_id,placement_opportunity_id) REFERENCES placement_opportunities(workspace_id,id),
  FOREIGN KEY(workspace_id,contact_id) REFERENCES contacts(workspace_id,id),
  UNIQUE(workspace_id,id)
);
ALTER TABLE outreach_messages ADD CONSTRAINT outreach_messages_enrollment_fk
  FOREIGN KEY(workspace_id,sequence_enrollment_id)
  REFERENCES outreach_sequence_enrollments(workspace_id,id);
ALTER TABLE outreach_messages ADD CONSTRAINT outreach_messages_step_fk
  FOREIGN KEY(sequence_step_id) REFERENCES outreach_sequence_steps(id);

CREATE TABLE outreach_provider_events (
  id UUID PRIMARY KEY,
  provider_event_id TEXT NOT NULL UNIQUE,
  provider_message_id TEXT,
  event_type TEXT NOT NULL CHECK(event_type IN
    ('accepted','delivered','bounced','complained','replied','opted_out')),
  signature_verified BOOLEAN NOT NULL,
  payload_digest TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION prevent_outreach_version_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'outreach version records are append-only';
END $$;
CREATE TRIGGER outreach_template_versions_immutable
  BEFORE UPDATE OR DELETE ON outreach_template_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_outreach_version_mutation();
CREATE TRIGGER outreach_provider_events_immutable
  BEFORE UPDATE OR DELETE ON outreach_provider_events
  FOR EACH ROW WHEN (OLD.processed_at IS NOT NULL)
  EXECUTE FUNCTION prevent_outreach_version_mutation();
