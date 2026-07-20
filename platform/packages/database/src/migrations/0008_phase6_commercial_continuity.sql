CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  brand_id UUID NOT NULL,
  business_id UUID NOT NULL,
  representative_user_id UUID NOT NULL REFERENCES users(id),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  agreement_id UUID NOT NULL,
  placement_opportunity_id UUID NOT NULL,
  opening_order_id UUID,
  protected_account_id UUID,
  status TEXT NOT NULL CHECK(status IN ('onboarding','active','at_risk','paused','ended')),
  health TEXT NOT NULL CHECK(health IN ('unknown','healthy','watch','at_risk','inactive')),
  health_rationale TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  next_action_task_id UUID,
  support_owner_user_id UUID REFERENCES users(id),
  ended_at TIMESTAMPTZ,
  ended_reason TEXT,
  reactivated_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  FOREIGN KEY(workspace_id,brand_id) REFERENCES brands(workspace_id,id),
  FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id),
  FOREIGN KEY(workspace_id,agreement_id) REFERENCES representation_agreements(workspace_id,id),
  FOREIGN KEY(workspace_id,placement_opportunity_id) REFERENCES placement_opportunities(workspace_id,id),
  FOREIGN KEY(workspace_id,next_action_task_id) REFERENCES tasks(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE UNIQUE INDEX accounts_active_relationship_unique
  ON accounts(workspace_id,brand_id,business_id,agreement_id)
  WHERE status <> 'ended' AND archived_at IS NULL;
CREATE INDEX accounts_status_health_idx
  ON accounts(workspace_id,status,health,updated_at DESC);

CREATE TABLE protected_accounts (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  account_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  business_id UUID NOT NULL,
  representative_user_id UUID NOT NULL REFERENCES users(id),
  agreement_id UUID NOT NULL,
  placement_opportunity_id UUID NOT NULL,
  origin_order_id UUID,
  basis_document_id UUID,
  origin_date DATE NOT NULL,
  approval_date DATE,
  approved_by UUID REFERENCES users(id),
  approval_id UUID,
  scope_summary TEXT NOT NULL,
  product_ids UUID[] NOT NULL DEFAULT '{}',
  channels TEXT[] NOT NULL DEFAULT '{}',
  territory_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  protection_starts_on DATE NOT NULL,
  protection_ends_on DATE NOT NULL,
  protection_term TEXT NOT NULL,
  renewal_date DATE,
  commission_rights TEXT NOT NULL,
  reorder_rights TEXT NOT NULL,
  house_account_exclusions TEXT NOT NULL DEFAULT '',
  release_terms TEXT NOT NULL DEFAULT '',
  conflict_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN (
    'pending','active','expiring','expired','disputed','released','ended'
  )),
  rights_digest TEXT NOT NULL,
  supporting_basis_status TEXT NOT NULL CHECK(supporting_basis_status IN (
    'documented','review_required','ambiguous','unsupported'
  )),
  human_confirmed BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CHECK(protection_ends_on >= protection_starts_on),
  CHECK(status <> 'active' OR (
    basis_document_id IS NOT NULL AND approval_id IS NOT NULL AND approved_by IS NOT NULL
    AND approval_date IS NOT NULL AND human_confirmed AND supporting_basis_status='documented'
  )),
  FOREIGN KEY(workspace_id,account_id) REFERENCES accounts(workspace_id,id),
  FOREIGN KEY(workspace_id,brand_id) REFERENCES brands(workspace_id,id),
  FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id),
  FOREIGN KEY(workspace_id,agreement_id) REFERENCES representation_agreements(workspace_id,id),
  FOREIGN KEY(workspace_id,placement_opportunity_id) REFERENCES placement_opportunities(workspace_id,id),
  FOREIGN KEY(workspace_id,basis_document_id) REFERENCES documents(workspace_id,id),
  FOREIGN KEY(workspace_id,approval_id) REFERENCES human_approvals(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX protected_accounts_scope_idx
  ON protected_accounts(workspace_id,brand_id,business_id,status,protection_starts_on,protection_ends_on);
CREATE INDEX protected_accounts_expiry_idx
  ON protected_accounts(workspace_id,status,protection_ends_on);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  account_id UUID,
  protected_account_id UUID,
  prior_order_id UUID,
  placement_opportunity_id UUID NOT NULL,
  agreement_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  business_id UUID NOT NULL,
  representative_user_id UUID NOT NULL REFERENCES users(id),
  order_number TEXT NOT NULL,
  external_reference TEXT,
  idempotency_key TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK(order_type IN ('opening_order','reorder')),
  order_date DATE NOT NULL,
  currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  wholesale_gross NUMERIC(18,2) NOT NULL CHECK(wholesale_gross >= 0),
  discounts NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(discounts >= 0),
  returns NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(returns >= 0),
  cancellations NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(cancellations >= 0),
  net_commissionable NUMERIC(18,2) NOT NULL CHECK(net_commissionable >= 0),
  status TEXT NOT NULL CHECK(status IN (
    'draft','submitted','confirmed','fulfilled','partially_returned','returned','canceled'
  )),
  payment_status TEXT NOT NULL CHECK(payment_status IN (
    'unknown','unpaid','partially_paid','paid','refunded','chargeback'
  )),
  fulfillment_status TEXT NOT NULL CHECK(fulfillment_status IN (
    'unknown','unfulfilled','partial','fulfilled','returned','canceled'
  )),
  source_type TEXT NOT NULL CHECK(source_type IN ('document','external_reference','manual_with_evidence','imported')),
  source_document_id UUID NOT NULL,
  source_reference TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL CHECK(verification_status IN (
    'unverified','review_required','verified','disputed'
  )),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  verification_notes TEXT NOT NULL DEFAULT '',
  current_revision INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CHECK(net_commissionable =
    round(greatest(0::numeric, wholesale_gross-discounts-returns-cancellations),2)),
  CHECK(verification_status <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  FOREIGN KEY(workspace_id,account_id) REFERENCES accounts(workspace_id,id),
  FOREIGN KEY(workspace_id,protected_account_id) REFERENCES protected_accounts(workspace_id,id),
  FOREIGN KEY(workspace_id,placement_opportunity_id) REFERENCES placement_opportunities(workspace_id,id),
  FOREIGN KEY(workspace_id,agreement_id) REFERENCES representation_agreements(workspace_id,id),
  FOREIGN KEY(workspace_id,brand_id) REFERENCES brands(workspace_id,id),
  FOREIGN KEY(workspace_id,business_id) REFERENCES businesses(workspace_id,id),
  FOREIGN KEY(workspace_id,source_document_id) REFERENCES documents(workspace_id,id),
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,idempotency_key)
);
CREATE UNIQUE INDEX orders_external_reference_unique
  ON orders(workspace_id,brand_id,external_reference)
  WHERE external_reference IS NOT NULL AND archived_at IS NULL;
CREATE UNIQUE INDEX orders_number_unique
  ON orders(workspace_id,brand_id,order_number)
  WHERE archived_at IS NULL;
CREATE INDEX orders_account_date_idx
  ON orders(workspace_id,account_id,order_date DESC);
CREATE INDEX orders_status_idx
  ON orders(workspace_id,verification_status,status,payment_status,order_date DESC);
ALTER TABLE orders
  ADD CONSTRAINT orders_prior_order_fk
  FOREIGN KEY(workspace_id,prior_order_id) REFERENCES orders(workspace_id,id);

ALTER TABLE accounts
  ADD CONSTRAINT accounts_opening_order_fk
  FOREIGN KEY(workspace_id,opening_order_id) REFERENCES orders(workspace_id,id);
ALTER TABLE protected_accounts
  ADD CONSTRAINT protected_accounts_origin_order_fk
  FOREIGN KEY(workspace_id,origin_order_id) REFERENCES orders(workspace_id,id);

CREATE TABLE order_line_items (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(18,4) NOT NULL CHECK(quantity > 0),
  unit_wholesale_price NUMERIC(18,4) NOT NULL CHECK(unit_wholesale_price >= 0),
  gross_amount NUMERIC(18,2) NOT NULL CHECK(gross_amount >= 0),
  discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(discount_amount >= 0),
  return_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(return_amount >= 0),
  cancellation_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(cancellation_amount >= 0),
  commission_eligible BOOLEAN NOT NULL DEFAULT true,
  net_commissionable NUMERIC(18,2) NOT NULL CHECK(net_commissionable >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,order_id) REFERENCES orders(workspace_id,id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,product_id) REFERENCES products(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX order_line_items_order_idx ON order_line_items(workspace_id,order_id);

CREATE TABLE order_revisions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  order_id UUID NOT NULL,
  revision INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  snapshot_digest TEXT NOT NULL,
  reason TEXT NOT NULL,
  source_document_id UUID NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,order_id) REFERENCES orders(workspace_id,id),
  FOREIGN KEY(workspace_id,source_document_id) REFERENCES documents(workspace_id,id),
  UNIQUE(order_id,revision)
);

CREATE TABLE commissions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  representative_user_id UUID NOT NULL REFERENCES users(id),
  brand_id UUID NOT NULL,
  account_id UUID NOT NULL,
  protected_account_id UUID,
  agreement_id UUID NOT NULL,
  order_id UUID NOT NULL,
  current_calculation_id UUID,
  calculation_basis TEXT NOT NULL,
  commission_rate NUMERIC(9,6) NOT NULL CHECK(commission_rate >= 0 AND commission_rate <= 1),
  basis_type TEXT NOT NULL CHECK(basis_type IN ('gross','net')),
  term_type TEXT NOT NULL CHECK(term_type IN ('opening_order','reorder')),
  currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  expected_amount NUMERIC(18,2) NOT NULL CHECK(expected_amount >= 0),
  verified_amount NUMERIC(18,2),
  approved_amount NUMERIC(18,2),
  paid_amount NUMERIC(18,2),
  payment_due_date DATE,
  payment_date DATE,
  status TEXT NOT NULL CHECK(status IN (
    'estimated','pending_verification','approved','payable','paid','disputed','canceled','clawed_back'
  )),
  dispute_status TEXT NOT NULL CHECK(dispute_status IN ('none','open','resolved','withdrawn')),
  clawback_status TEXT NOT NULL CHECK(clawback_status IN ('none','candidate','approved','applied')),
  clawback_amount NUMERIC(18,2),
  source_document_id UUID NOT NULL,
  current_order_revision INTEGER NOT NULL,
  calculation_explanation TEXT NOT NULL,
  human_verified_by UUID REFERENCES users(id),
  human_verified_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  payment_confirmed_by UUID REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CHECK(status <> 'paid' OR (
    paid_amount IS NOT NULL AND payment_date IS NOT NULL
    AND payment_confirmed_by IS NOT NULL AND source_document_id IS NOT NULL
  )),
  FOREIGN KEY(workspace_id,brand_id) REFERENCES brands(workspace_id,id),
  FOREIGN KEY(workspace_id,account_id) REFERENCES accounts(workspace_id,id),
  FOREIGN KEY(workspace_id,protected_account_id) REFERENCES protected_accounts(workspace_id,id),
  FOREIGN KEY(workspace_id,agreement_id) REFERENCES representation_agreements(workspace_id,id),
  FOREIGN KEY(workspace_id,order_id) REFERENCES orders(workspace_id,id),
  FOREIGN KEY(workspace_id,source_document_id) REFERENCES documents(workspace_id,id),
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,order_id)
);
CREATE INDEX commissions_status_due_idx
  ON commissions(workspace_id,status,payment_due_date,updated_at DESC);

CREATE TABLE commission_calculations (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  commission_id UUID NOT NULL,
  calculation_version INTEGER NOT NULL,
  agreement_id UUID NOT NULL,
  order_id UUID NOT NULL,
  order_revision INTEGER NOT NULL,
  currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  gross_amount NUMERIC(18,2) NOT NULL,
  eligible_amount NUMERIC(18,2) NOT NULL,
  discounts NUMERIC(18,2) NOT NULL,
  returns NUMERIC(18,2) NOT NULL,
  cancellations NUMERIC(18,2) NOT NULL,
  commissionable_amount NUMERIC(18,2) NOT NULL,
  basis_type TEXT NOT NULL CHECK(basis_type IN ('gross','net')),
  rate NUMERIC(9,6) NOT NULL,
  result_amount NUMERIC(18,2) NOT NULL,
  formula TEXT NOT NULL,
  rounding_rule TEXT NOT NULL,
  input_snapshot JSONB NOT NULL,
  snapshot_digest TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,commission_id) REFERENCES commissions(workspace_id,id),
  FOREIGN KEY(workspace_id,agreement_id) REFERENCES representation_agreements(workspace_id,id),
  FOREIGN KEY(workspace_id,order_id) REFERENCES orders(workspace_id,id),
  UNIQUE(workspace_id,id),
  UNIQUE(commission_id,calculation_version)
);
ALTER TABLE commissions
  ADD CONSTRAINT commissions_current_calculation_fk
  FOREIGN KEY(workspace_id,current_calculation_id) REFERENCES commission_calculations(workspace_id,id);

CREATE TABLE reorders (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  account_id UUID NOT NULL,
  protected_account_id UUID,
  prior_order_id UUID NOT NULL,
  new_order_id UUID,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  last_order_date DATE NOT NULL,
  expected_window_starts_on DATE,
  expected_window_ends_on DATE,
  average_order_size NUMERIC(18,2),
  currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  status TEXT NOT NULL CHECK(status IN (
    'projected','due','contacted','ordered','deferred','not_expected','closed'
  )),
  account_health TEXT NOT NULL CHECK(account_health IN ('unknown','healthy','watch','at_risk','inactive')),
  health_rationale TEXT NOT NULL,
  reminder_at TIMESTAMPTZ,
  next_action TEXT NOT NULL,
  likelihood_label TEXT CHECK(likelihood_label IN ('low','medium','high')),
  likelihood_origin TEXT CHECK(likelihood_origin IN ('user_entered','system_estimate')),
  estimate_explanation TEXT NOT NULL DEFAULT '',
  recommended_follow_up TEXT NOT NULL DEFAULT '',
  recommendation_origin TEXT NOT NULL CHECK(recommendation_origin IN ('user_entered','system_rule')),
  defer_or_close_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CHECK(expected_window_ends_on IS NULL OR expected_window_starts_on IS NULL
    OR expected_window_ends_on >= expected_window_starts_on),
  FOREIGN KEY(workspace_id,account_id) REFERENCES accounts(workspace_id,id),
  FOREIGN KEY(workspace_id,protected_account_id) REFERENCES protected_accounts(workspace_id,id),
  FOREIGN KEY(workspace_id,prior_order_id) REFERENCES orders(workspace_id,id),
  FOREIGN KEY(workspace_id,new_order_id) REFERENCES orders(workspace_id,id),
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,prior_order_id)
);
CREATE INDEX reorders_window_idx
  ON reorders(workspace_id,status,expected_window_starts_on,reminder_at);

CREATE TABLE commission_disputes (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  commission_id UUID NOT NULL,
  order_id UUID NOT NULL,
  agreement_id UUID NOT NULL,
  opened_by UUID NOT NULL REFERENCES users(id),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  reason_code TEXT NOT NULL,
  reason TEXT NOT NULL,
  disputed_amount NUMERIC(18,2) NOT NULL CHECK(disputed_amount >= 0),
  currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  status TEXT NOT NULL CHECK(status IN (
    'opened','evidence_needed','submitted','under_review','resolved','rejected','withdrawn'
  )),
  next_action TEXT NOT NULL,
  brand_response TEXT NOT NULL DEFAULT '',
  resolution_amount NUMERIC(18,2),
  resolution TEXT,
  resolution_date DATE,
  resolved_by UUID REFERENCES users(id),
  final_decision_id UUID,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CHECK(status <> 'resolved' OR (
    resolution_amount IS NOT NULL AND resolution IS NOT NULL
    AND resolution_date IS NOT NULL AND resolved_by IS NOT NULL
  )),
  FOREIGN KEY(workspace_id,commission_id) REFERENCES commissions(workspace_id,id),
  FOREIGN KEY(workspace_id,order_id) REFERENCES orders(workspace_id,id),
  FOREIGN KEY(workspace_id,agreement_id) REFERENCES representation_agreements(workspace_id,id),
  FOREIGN KEY(workspace_id,final_decision_id) REFERENCES decision_records(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX commission_disputes_status_idx
  ON commission_disputes(workspace_id,status,updated_at DESC);

CREATE TABLE commercial_document_links (
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  subject_type TEXT NOT NULL CHECK(subject_type IN (
    'protected_account','account','order','reorder','commission','commission_dispute'
  )),
  subject_id UUID NOT NULL,
  document_id UUID NOT NULL,
  purpose TEXT NOT NULL,
  linked_by UUID NOT NULL REFERENCES users(id),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,document_id) REFERENCES documents(workspace_id,id),
  PRIMARY KEY(workspace_id,subject_type,subject_id,document_id)
);

CREATE TABLE commercial_events (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  subject_type TEXT NOT NULL CHECK(subject_type IN (
    'protected_account','account','order','reorder','commission','commission_dispute'
  )),
  subject_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id),
  origin TEXT NOT NULL CHECK(origin IN ('user','system','job','import','provider')),
  reason TEXT NOT NULL,
  before_snapshot JSONB,
  after_snapshot JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX commercial_events_subject_idx
  ON commercial_events(workspace_id,subject_type,subject_id,occurred_at DESC);

CREATE OR REPLACE FUNCTION reject_phase6_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Phase 6 financial and rights history is append-only';
END;
$$;

CREATE TRIGGER order_revisions_immutable
BEFORE UPDATE OR DELETE ON order_revisions
FOR EACH ROW EXECUTE FUNCTION reject_phase6_history_mutation();

CREATE TRIGGER commission_calculations_immutable
BEFORE UPDATE OR DELETE ON commission_calculations
FOR EACH ROW EXECUTE FUNCTION reject_phase6_history_mutation();

CREATE TRIGGER commercial_events_immutable
BEFORE UPDATE OR DELETE ON commercial_events
FOR EACH ROW EXECUTE FUNCTION reject_phase6_history_mutation();
