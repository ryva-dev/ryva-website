CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE brands (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  public_name TEXT NOT NULL,
  legal_name TEXT,
  website TEXT,
  identity_status TEXT NOT NULL CHECK (identity_status IN ('unverified','reviewing','verified','disputed')),
  status TEXT NOT NULL CHECK (status IN ('discovered','researching','contact_ready','contacted','conversation','reviewing_terms','authorized','active','paused','ended','rejected','archived')),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);
CREATE INDEX brands_workspace_status_idx ON brands (workspace_id,status) WHERE archived_at IS NULL;
CREATE INDEX brands_name_trgm_idx ON brands USING gin (public_name gin_trgm_ops);

CREATE TABLE products (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  brand_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  identity_status TEXT NOT NULL CHECK (identity_status IN ('unverified','reviewing','verified','disputed')),
  status TEXT NOT NULL CHECK (status IN ('discovered','watchlist','under_review','qualified','rejected','represented','archived')),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id,brand_id) REFERENCES brands(workspace_id,id),
  UNIQUE (workspace_id,id)
);
CREATE INDEX products_workspace_status_idx ON products (workspace_id,status) WHERE archived_at IS NULL;
CREATE INDEX products_name_trgm_idx ON products USING gin (name gin_trgm_ops);

CREATE TABLE businesses (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  legal_name TEXT,
  business_type TEXT NOT NULL,
  category TEXT NOT NULL,
  website TEXT,
  status TEXT NOT NULL CHECK (status IN ('research','qualified','active','inactive','closed','archived')),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  geography JSONB NOT NULL DEFAULT '{}'::jsonb,
  fit_rationale TEXT NOT NULL DEFAULT '',
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id)
);
CREATE INDEX businesses_workspace_status_idx ON businesses (workspace_id,status) WHERE archived_at IS NULL;
CREATE INDEX businesses_name_trgm_idx ON businesses USING gin (name gin_trgm_ops);

CREATE TABLE contacts (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  brand_id UUID,
  business_id UUID,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('unverified','verified','stale','disputed')),
  permission_status TEXT NOT NULL CHECK (permission_status IN ('unknown','professional_purpose','opted_out','prohibited')),
  source_id UUID,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  opted_out_at TIMESTAMPTZ,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(brand_id,business_id)=1),
  FOREIGN KEY (workspace_id,brand_id) REFERENCES brands(workspace_id,id),
  FOREIGN KEY (workspace_id,business_id) REFERENCES businesses(workspace_id,id),
  UNIQUE (workspace_id,id)
);
CREATE UNIQUE INDEX contacts_verified_email_unique ON contacts(workspace_id,lower(email))
  WHERE email IS NOT NULL AND verification_status='verified' AND archived_at IS NULL;
CREATE INDEX contacts_name_trgm_idx ON contacts USING gin (name gin_trgm_ops);

CREATE TABLE business_buyers (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  contact_id UUID NOT NULL,
  business_id UUID NOT NULL,
  buyer_role TEXT NOT NULL CHECK (buyer_role IN ('unknown','influencer','evaluator','decision_maker','authorized_purchaser')),
  decision_context TEXT NOT NULL,
  authority_evidence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id,contact_id) REFERENCES contacts(workspace_id,id),
  FOREIGN KEY (workspace_id,business_id) REFERENCES businesses(workspace_id,id),
  UNIQUE (workspace_id,contact_id,business_id)
);

CREATE TABLE sources (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  source_type TEXT NOT NULL,
  reference TEXT NOT NULL,
  url TEXT,
  owner_or_provider TEXT NOT NULL,
  rights_classification TEXT NOT NULL CHECK (rights_classification IN ('owned','licensed','public_reference','restricted','unknown')),
  confidentiality TEXT NOT NULL CHECK (confidentiality IN ('normal','confidential','restricted')),
  observed_from TIMESTAMPTZ,
  observed_to TIMESTAMPTZ,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('active','inaccessible','corrected','deleted')),
  created_by UUID NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id)
);

ALTER TABLE contacts ADD CONSTRAINT contacts_source_fk
  FOREIGN KEY (workspace_id,source_id) REFERENCES sources(workspace_id,id);

CREATE TABLE evidence_records (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('brand','product','business','contact','source')),
  subject_id UUID NOT NULL,
  exact_claim TEXT NOT NULL,
  evidence_class TEXT NOT NULL CHECK (evidence_class IN ('verified_fact','direct_evidence','strong_proxy','weak_proxy','estimate','assumption','model_generated_inference','unknown')),
  verification_status TEXT NOT NULL CHECK (verification_status IN ('unverified','reviewed','verified','disputed')),
  source_id UUID,
  unknown_reason TEXT,
  supports TEXT NOT NULL DEFAULT '',
  does_not_support TEXT NOT NULL DEFAULT '',
  confidence TEXT NOT NULL CHECK (confidence IN ('insufficient','limited','supported','strong')),
  context TEXT NOT NULL DEFAULT '',
  limitations TEXT NOT NULL DEFAULT '',
  contrary_evidence TEXT NOT NULL DEFAULT '',
  permitted_use TEXT NOT NULL DEFAULT '',
  prohibited_inference TEXT NOT NULL DEFAULT '',
  observed_at TIMESTAMPTZ,
  reassess_at TIMESTAMPTZ,
  reviewed_by UUID NOT NULL REFERENCES users(id),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('current','stale','disputed','superseded')),
  supersedes_id UUID REFERENCES evidence_records(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((evidence_class='unknown' AND unknown_reason IS NOT NULL) OR
         (evidence_class<>'unknown' AND source_id IS NOT NULL)),
  FOREIGN KEY (workspace_id,source_id) REFERENCES sources(workspace_id,id),
  UNIQUE (workspace_id,id)
);
CREATE INDEX evidence_subject_idx ON evidence_records(workspace_id,subject_type,subject_id,status);
CREATE INDEX evidence_reassess_idx ON evidence_records(workspace_id,reassess_at) WHERE status='current';

CREATE TABLE risk_flags (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  risk_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL CHECK (status IN ('open','reviewing','mitigated','accepted','closed')),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  mitigation TEXT NOT NULL DEFAULT '',
  specialist_review TEXT,
  due_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);
CREATE INDEX risk_subject_idx ON risk_flags(workspace_id,subject_type,subject_id,status);

CREATE TABLE decision_records (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  question TEXT NOT NULL,
  scope TEXT NOT NULL,
  outcome TEXT NOT NULL,
  rationale TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('insufficient','limited','supported','strong')),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  next_action TEXT NOT NULL DEFAULT '',
  conditions TEXT NOT NULL DEFAULT '',
  alternatives TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft','issued','superseded')),
  supersedes_id UUID REFERENCES decision_records(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);
CREATE INDEX decision_subject_idx ON decision_records(workspace_id,subject_type,subject_id,status);

CREATE TABLE human_approvals (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  artifact_digest TEXT NOT NULL,
  approver_user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('requested','approved','rejected','changes_required','expired')),
  scope TEXT NOT NULL,
  conditions TEXT NOT NULL DEFAULT '',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);

CREATE TABLE notes (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  author_user_id UUID NOT NULL REFERENCES users(id),
  note_type TEXT NOT NULL DEFAULT 'general',
  body TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);
CREATE INDEX notes_subject_idx ON notes(workspace_id,subject_type,subject_id,created_at DESC);
CREATE INDEX notes_body_fts_idx ON notes USING gin(to_tsvector('english',body));

CREATE TABLE note_versions (
  id UUID PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes(id),
  body TEXT NOT NULL,
  version INTEGER NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(note_id,version)
);

CREATE TABLE activities (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  activity_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id),
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned','completed','failed','canceled','corrected')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  correction_of_id UUID REFERENCES activities(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);
CREATE INDEX activities_subject_idx ON activities(workspace_id,subject_type,subject_id,occurred_at DESC);

CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  title TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('open','in_progress','blocked','completed','canceled')),
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')),
  created_reason TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  blocker TEXT,
  recurrence JSONB,
  completion_evidence TEXT,
  mandatory_gate BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);
CREATE INDEX tasks_owner_due_idx ON tasks(workspace_id,owner_user_id,status,due_at);
CREATE INDEX tasks_subject_idx ON tasks(workspace_id,subject_type,subject_id,status);

CREATE TABLE documents (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  media_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK(byte_size>=0),
  storage_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  scan_status TEXT NOT NULL CHECK(scan_status IN ('pending','clean','quarantined','failed')),
  confidentiality TEXT NOT NULL CHECK(confidentiality IN ('normal','confidential','restricted')),
  status TEXT NOT NULL CHECK(status IN ('uploading','scanning','active','quarantined','archived','deleted')),
  version_of_id UUID REFERENCES documents(id),
  expires_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);
CREATE INDEX documents_subject_idx ON documents(workspace_id,subject_type,subject_id,status);
CREATE INDEX documents_name_trgm_idx ON documents USING gin(name gin_trgm_ops);

CREATE TABLE territories (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  territory_type TEXT NOT NULL CHECK(territory_type IN ('geography','channel','account_list','hybrid')),
  scope JSONB NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('proposed','active','expired','ended')),
  effective_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);

CREATE TABLE saved_views (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  record_type TEXT NOT NULL,
  name TEXT NOT NULL,
  definition JSONB NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('private','workspace')),
  status TEXT NOT NULL CHECK(status IN ('active','archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,owner_user_id,record_type,name)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES users(id),
  notification_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('critical','action_required','time_sensitive','informational')),
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  subject_type TEXT,
  subject_id UUID,
  source_event_id UUID,
  grouping_key TEXT,
  status TEXT NOT NULL CHECK(status IN ('unread','read','dismissed','resolved')),
  blocking BOOLEAN NOT NULL DEFAULT false,
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);
CREATE INDEX notifications_user_idx ON notifications(workspace_id,user_id,status,created_at DESC);

CREATE TABLE import_previews (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES users(id),
  record_type TEXT NOT NULL CHECK(record_type IN ('brand','product','business','contact')),
  source_name TEXT NOT NULL,
  source_digest TEXT NOT NULL,
  mapping JSONB NOT NULL,
  rows JSONB NOT NULL,
  summary JSONB NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('validated','expired','canceled')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,source_digest,record_type)
);

CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  record_type TEXT NOT NULL CHECK(record_type IN ('brand','product','business','contact')),
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK(field_type IN ('text','number','date','single_select','multi_select','url','boolean')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK(status IN ('active','archived')),
  created_by UUID NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,record_type,field_key)
);
