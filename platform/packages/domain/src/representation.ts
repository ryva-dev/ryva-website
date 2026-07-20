import type { Database, Transaction } from "../../database/src/index.js";
import { oneOrNone, withTransaction } from "../../database/src/index.js";
import { AppError, newId } from "../../shared/src/index.js";
import { recordAudit } from "./audit.js";
import { publicDigest } from "./crypto.js";

const materialAgreementFields: Record<string, string> = {
  effectiveAt: "effective_at",
  expiresAt: "expires_at",
  channels: "channels",
  territoryScope: "territory_scope",
  authoritySummary: "authority_summary",
  commissionBasis: "commission_basis",
  commissionRate: "commission_rate",
  commissionCurrency: "commission_currency",
  commissionTiming: "commission_timing",
  openingOrderRights: "opening_order_rights",
  reorderRights: "reorder_rights",
  protectedAccountRules: "protected_account_rules",
  houseAccountRules: "house_account_rules",
  terminationTerms: "termination_terms",
  terminationNoticeDays: "termination_notice_days",
  postTerminationCommissionRights: "post_termination_commission_rights",
  postTerminationCommissionEndsAt: "post_termination_commission_ends_at",
  renewalStatus: "renewal_status",
  renewalReviewAt: "renewal_review_at",
  legalAmbiguityStatus: "legal_ambiguity_status",
  legalAmbiguityNotes: "legal_ambiguity_notes"
};

const agreementSelect = `
  a.id,a.brand_id AS "brandId",b.public_name AS "brandName",
  a.representation_opportunity_id AS "representationOpportunityId",
  a.representative_user_id AS "representativeUserId",a.status,
  a.source_document_id AS "sourceDocumentId",d.name AS "documentName",
  d.sha256 AS "documentSha256",
  d.status AS "documentStatus",d.scan_status AS "documentScanStatus",
  a.effective_at AS "effectiveAt",a.expires_at AS "expiresAt",a.channels,
  a.territory_scope AS "territoryScope",a.authority_summary AS "authoritySummary",
  a.commission_basis AS "commissionBasis",a.commission_rate::text AS "commissionRate",
  a.commission_currency AS "commissionCurrency",a.commission_timing AS "commissionTiming",
  a.opening_order_rights AS "openingOrderRights",a.reorder_rights AS "reorderRights",
  a.protected_account_rules AS "protectedAccountRules",a.house_account_rules AS "houseAccountRules",
  a.termination_terms AS "terminationTerms",a.termination_notice_days AS "terminationNoticeDays",
  a.post_termination_commission_rights AS "postTerminationCommissionRights",
  a.post_termination_commission_ends_at AS "postTerminationCommissionEndsAt",
  a.renewal_status AS "renewalStatus",a.renewal_review_at AS "renewalReviewAt",
  a.legal_ambiguity_status AS "legalAmbiguityStatus",
  a.legal_ambiguity_notes AS "legalAmbiguityNotes",a.approval_id AS "approvalId",
  a.authority_digest AS "authorityDigest",a.approved_by AS "approvedBy",
  a.approved_at AS "approvedAt",a.suspended_reason AS "suspendedReason",
  a.ended_reason AS "endedReason",a.ended_at AS "endedAt",a.version,
  a.created_at AS "createdAt",a.updated_at AS "updatedAt"`;

type AuthorityAction =
  | "prepare_outreach"
  | "approve_outreach"
  | "send_outreach"
  | "brand_authorized"
  | "brand_active"
  | "product_represented"
  | "placement_create"
  | "placement_stage";

export type AuthorityResult = {
  outcome: "authorized" | "denied" | "review_required";
  agreementId: string | null;
  authorityDigest: string | null;
  reasonCodes: string[];
  conflicts: Record<string, unknown>[];
};

function normalizeAccountName(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function agreementSnapshot(
  database: Database | Transaction,
  workspaceId: string,
  agreementId: string
): Promise<{ agreement: Record<string, unknown>; products: string[]; restrictions: Record<string, unknown>[]; digest: string }> {
  const agreement = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT ${agreementSelect} FROM representation_agreements a
      JOIN brands b ON b.workspace_id=a.workspace_id AND b.id=a.brand_id
      LEFT JOIN documents d ON d.workspace_id=a.workspace_id AND d.id=a.source_document_id
     WHERE a.workspace_id=$1 AND a.id=$2 AND a.archived_at IS NULL`,
    [workspaceId, agreementId]
  );
  if (!agreement) throw new AppError(404, "agreement_not_found", "Representation Agreement not found.");
  const products = await database.query<{ productId: string }>(
    `SELECT product_id AS "productId" FROM representation_agreement_products
      WHERE workspace_id=$1 AND agreement_id=$2 ORDER BY product_id`,
    [workspaceId, agreementId]
  );
  const restrictions = await database.query<Record<string, unknown>>(
    `SELECT id,restriction_type AS "restrictionType",business_id AS "businessId",
            account_name AS "accountName",product_ids AS "productIds",channels,
            territory_scope AS "territoryScope",effective_at AS "effectiveAt",
            expires_at AS "expiresAt",source_document_id AS "sourceDocumentId",
            source_location AS "sourceLocation",status
       FROM agreement_account_restrictions
      WHERE workspace_id=$1 AND agreement_id=$2 AND status='confirmed' ORDER BY id`,
    [workspaceId, agreementId]
  );
  const scopedProducts = products.rows.map((item) => item.productId);
  const scopedRestrictions = restrictions.rows;
  const material = {
    agreementId: agreement.id,
    brandId: agreement.brandId,
    representativeUserId: agreement.representativeUserId,
    sourceDocumentId: agreement.sourceDocumentId,
    documentSha256: agreement.documentSha256,
    effectiveAt: agreement.effectiveAt,
    expiresAt: agreement.expiresAt,
    channels: agreement.channels,
    territoryScope: agreement.territoryScope,
    authoritySummary: agreement.authoritySummary,
    commissionBasis: agreement.commissionBasis,
    commissionRate: agreement.commissionRate,
    commissionCurrency: agreement.commissionCurrency,
    commissionTiming: agreement.commissionTiming,
    openingOrderRights: agreement.openingOrderRights,
    reorderRights: agreement.reorderRights,
    protectedAccountRules: agreement.protectedAccountRules,
    houseAccountRules: agreement.houseAccountRules,
    terminationTerms: agreement.terminationTerms,
    terminationNoticeDays: agreement.terminationNoticeDays,
    postTerminationCommissionRights: agreement.postTerminationCommissionRights,
    postTerminationCommissionEndsAt: agreement.postTerminationCommissionEndsAt,
    renewalReviewAt: agreement.renewalReviewAt,
    legalAmbiguityStatus: agreement.legalAmbiguityStatus,
    legalAmbiguityNotes: agreement.legalAmbiguityNotes,
    products: scopedProducts,
    restrictions: scopedRestrictions
  };
  return {
    agreement,
    products: scopedProducts,
    restrictions: scopedRestrictions,
    digest: publicDigest(canonical(material))
  };
}

async function appendAgreementVersion(
  database: Database | Transaction,
  input: { workspaceId: string; agreementId: string; actorUserId: string; reason: string }
): Promise<string> {
  const snapshot = await agreementSnapshot(database, input.workspaceId, input.agreementId);
  await database.query(
    `INSERT INTO representation_agreement_versions
      (id,workspace_id,agreement_id,version,snapshot,snapshot_digest,reason,changed_by)
     VALUES($1,$2,$3,((SELECT count(*) FROM representation_agreement_versions WHERE agreement_id=$3)+1),
            $4,$5,$6,$7)`,
    [newId(), input.workspaceId, input.agreementId, snapshot, snapshot.digest, input.reason, input.actorUserId]
  );
  return snapshot.digest;
}

export async function listRepresentationOpportunities(
  database: Database,
  workspaceId: string,
  filters: { stage?: string; query?: string }
): Promise<Record<string, unknown>[]> {
  const values: unknown[] = [workspaceId];
  const where = ["o.workspace_id=$1", "o.archived_at IS NULL"];
  if (filters.stage) where.push(`o.stage=$${values.push(filters.stage)}`);
  if (filters.query) where.push(`b.public_name ILIKE '%'||$${values.push(filters.query)}||'%'`);
  const result = await database.query(
    `SELECT o.id,o.brand_id AS "brandId",b.public_name AS "brandName",o.stage,
            o.proposed_channels AS "proposedChannels",o.proposed_territory AS "proposedTerritory",
            o.brand_objectives AS "brandObjectives",o.terms_summary AS "termsSummary",
            o.missing_terms AS "missingTerms",o.next_action_task_id AS "nextActionTaskId",
            t.title AS "nextAction",t.due_at AS "nextActionDueAt",o.version,o.updated_at AS "updatedAt"
       FROM representation_opportunities o
       JOIN brands b ON b.workspace_id=o.workspace_id AND b.id=o.brand_id
       LEFT JOIN tasks t ON t.workspace_id=o.workspace_id AND t.id=o.next_action_task_id
      WHERE ${where.join(" AND ")} ORDER BY o.updated_at DESC LIMIT 250`,
    values
  );
  return result.rows as Record<string, unknown>[];
}

export async function getRepresentationOpportunity(
  database: Database,
  workspaceId: string,
  opportunityId: string
): Promise<Record<string, unknown>> {
  const opportunity = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT o.id,o.brand_id AS "brandId",b.public_name AS "brandName",
            o.brand_contact_id AS "brandContactId",c.name AS "brandContactName",
            o.stage,o.proposed_channels AS "proposedChannels",
            o.proposed_territory AS "proposedTerritory",
            o.brand_objectives AS "brandObjectives",o.terms_summary AS "termsSummary",
            o.missing_terms AS "missingTerms",o.decision_id AS "decisionId",
            o.next_action_task_id AS "nextActionTaskId",t.title AS "nextAction",
            t.due_at AS "nextActionDueAt",o.rejection_reason AS "rejectionReason",
            o.converted_agreement_id AS "convertedAgreementId",o.version,
            o.created_at AS "createdAt",o.updated_at AS "updatedAt"
       FROM representation_opportunities o
       JOIN brands b ON b.workspace_id=o.workspace_id AND b.id=o.brand_id
       LEFT JOIN contacts c ON c.workspace_id=o.workspace_id AND c.id=o.brand_contact_id
       LEFT JOIN tasks t ON t.workspace_id=o.workspace_id AND t.id=o.next_action_task_id
      WHERE o.workspace_id=$1 AND o.id=$2 AND o.archived_at IS NULL`,
    [workspaceId, opportunityId]
  );
  if (!opportunity) {
    throw new AppError(404, "representation_opportunity_not_found", "Representation Opportunity not found.");
  }
  const [products, events, documents] = await Promise.all([
    database.query(
      `SELECT p.id,p.name,p.status FROM representation_opportunity_products op
        JOIN products p ON p.workspace_id=op.workspace_id AND p.id=op.product_id
       WHERE op.workspace_id=$1 AND op.opportunity_id=$2 ORDER BY p.name`,
      [workspaceId, opportunityId]
    ),
    database.query(
      `SELECT from_stage AS "fromStage",to_stage AS "toStage",reason,
              decision_id AS "decisionId",actor_user_id AS "actorUserId",
              occurred_at AS "occurredAt"
         FROM representation_opportunity_events
        WHERE workspace_id=$1 AND opportunity_id=$2 ORDER BY occurred_at DESC`,
      [workspaceId, opportunityId]
    ),
    database.query(
      `SELECT id,name,document_type AS "documentType",media_type AS "mediaType",
              byte_size::text AS "byteSize",sha256,scan_status AS "scanStatus",
              confidentiality,status,created_at AS "createdAt"
         FROM documents WHERE workspace_id=$1
          AND subject_type='representation_opportunity' AND subject_id=$2
          AND status<>'deleted' ORDER BY created_at DESC`,
      [workspaceId, opportunityId]
    )
  ]);
  return { opportunity, products: products.rows, events: events.rows, documents: documents.rows };
}

export async function createRepresentationOpportunity(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; brandId: string;
    brandContactId?: string | null | undefined; productIds: string[]; proposedChannels: string[];
    proposedTerritory: Record<string, unknown>; brandObjectives: string; termsSummary: string;
    missingTerms: string[]; decisionId: string; nextActionTaskId: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const brand = await oneOrNone<{ pipelineStage: string }>(
      transaction,
      `SELECT pipeline_stage AS "pipelineStage" FROM brands
        WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL FOR UPDATE`,
      [input.workspaceId, input.brandId]
    );
    if (!brand) throw new AppError(404, "brand_not_found", "Brand not found.");
    if (!["contact_ready", "contacted", "conversation", "reviewing_terms"].includes(brand.pipelineStage)) {
      throw new AppError(409, "brand_not_contact_ready", "The Brand must complete diligence and be Contact Ready.");
    }
    const decision = await transaction.query(
      `SELECT id FROM decision_records WHERE workspace_id=$1 AND id=$2
        AND subject_type='brand' AND subject_id=$3 AND owner_user_id=$4 AND status='issued'`,
      [input.workspaceId, input.decisionId, input.brandId, input.actorUserId]
    );
    if (!decision.rows[0]) throw new AppError(422, "human_decision_required", "An issued human Brand decision is required.");
    const task = await transaction.query(
      `SELECT id FROM tasks WHERE workspace_id=$1 AND id=$2
        AND subject_type='brand' AND subject_id=$3 AND owner_user_id=$4`,
      [input.workspaceId, input.nextActionTaskId, input.brandId, input.actorUserId]
    );
    if (!task.rows[0]) throw new AppError(422, "next_action_invalid", "The next action must belong to this Brand.");
    const products = await transaction.query<{ id: string }>(
      `SELECT id FROM products WHERE workspace_id=$1 AND brand_id=$2
        AND id=ANY($3::uuid[]) AND archived_at IS NULL`,
      [input.workspaceId, input.brandId, input.productIds]
    );
    if (products.rowCount !== new Set(input.productIds).size || products.rowCount === 0) {
      throw new AppError(422, "product_scope_invalid", "Select one or more Products belonging to the Brand.");
    }
    if (input.brandContactId) {
      const contact = await transaction.query(
        `SELECT id FROM contacts WHERE workspace_id=$1 AND id=$2 AND brand_id=$3
          AND archived_at IS NULL AND verification_status IN ('verified','stale')`,
        [input.workspaceId, input.brandContactId, input.brandId]
      );
      if (!contact.rows[0]) throw new AppError(422, "brand_contact_invalid", "Select a sourced Brand Contact.");
    }
    const id = newId();
    const created = await transaction.query<Record<string, unknown>>(
      `INSERT INTO representation_opportunities
        (id,workspace_id,brand_id,owner_user_id,brand_contact_id,stage,proposed_channels,
         proposed_territory,brand_objectives,terms_summary,missing_terms,decision_id,next_action_task_id)
       VALUES($1,$2,$3,$4,$5,'identified',$6,$7,$8,$9,$10,$11,$12)
       RETURNING id,brand_id AS "brandId",stage,proposed_channels AS "proposedChannels",
                 proposed_territory AS "proposedTerritory",brand_objectives AS "brandObjectives",
                 terms_summary AS "termsSummary",missing_terms AS "missingTerms",version`,
      [id, input.workspaceId, input.brandId, input.actorUserId, input.brandContactId ?? null,
        input.proposedChannels, input.proposedTerritory, input.brandObjectives, input.termsSummary,
        input.missingTerms, input.decisionId, input.nextActionTaskId]
    );
    for (const productId of input.productIds) {
      await transaction.query(
        `INSERT INTO representation_opportunity_products(opportunity_id,workspace_id,product_id)
         VALUES($1,$2,$3)`,
        [id, input.workspaceId, productId]
      );
    }
    await transaction.query(
      `INSERT INTO representation_opportunity_events
       (id,workspace_id,opportunity_id,to_stage,reason,decision_id,actor_user_id)
       VALUES($1,$2,$3,'identified','Human opened representation review',$4,$5)`,
      [newId(), input.workspaceId, id, input.decisionId, input.actorUserId]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "representation_opportunity.created", targetType: "representation_opportunity",
      targetId: id, origin: "api", requestId: input.requestId, outcome: "succeeded",
      after: created.rows[0], metadata: { productIds: input.productIds }
    });
    return created.rows[0]!;
  });
}

export async function transitionRepresentationOpportunity(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; opportunityId: string;
    version: number;
    toStage: "contact_ready" | "contacted" | "conversation" | "reviewing_terms" |
      "agreement_draft" | "paused" | "rejected";
    reason: string; decisionId: string; nextActionTaskId?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const before = await oneOrNone<Record<string, unknown>>(
      transaction,
      `SELECT * FROM representation_opportunities
        WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL FOR UPDATE`,
      [input.workspaceId, input.opportunityId]
    );
    if (!before) {
      throw new AppError(404, "representation_opportunity_not_found", "Representation Opportunity not found.");
    }
    if (["converted", "rejected"].includes(String(before.stage)) && input.toStage !== "paused") {
      throw new AppError(409, "representation_stage_terminal", "This Representation Opportunity is closed.");
    }
    const decision = await transaction.query(
      `SELECT id FROM decision_records WHERE workspace_id=$1 AND id=$2
        AND subject_type='brand' AND subject_id=$3 AND owner_user_id=$4 AND status='issued'`,
      [input.workspaceId, input.decisionId, before.brand_id, input.actorUserId]
    );
    if (!decision.rows[0]) {
      throw new AppError(422, "human_decision_required", "An issued human Brand decision is required.");
    }
    if (input.toStage !== "rejected" && !input.nextActionTaskId) {
      throw new AppError(422, "next_action_required", "A next action is required.");
    }
    if (input.nextActionTaskId) {
      const task = await transaction.query(
        `SELECT id FROM tasks WHERE workspace_id=$1 AND id=$2
          AND subject_type='brand' AND subject_id=$3 AND owner_user_id=$4`,
        [input.workspaceId, input.nextActionTaskId, before.brand_id, input.actorUserId]
      );
      if (!task.rows[0]) throw new AppError(422, "next_action_invalid", "The next action must belong to this Brand.");
    }
    if (input.toStage === "agreement_draft") {
      const document = await transaction.query(
        `SELECT id FROM documents WHERE workspace_id=$1
          AND subject_type='representation_opportunity' AND subject_id=$2
          AND status='active' AND scan_status='clean' LIMIT 1`,
        [input.workspaceId, input.opportunityId]
      );
      if (!document.rows[0]) {
        throw new AppError(409, "agreement_original_required", "A clean immutable Agreement original is required.");
      }
    }
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE representation_opportunities SET stage=$4,decision_id=$5,
              next_action_task_id=$6,rejection_reason=CASE WHEN $4='rejected' THEN $7 ELSE NULL END,
              version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.opportunityId, input.version, input.toStage,
        input.decisionId, input.nextActionTaskId ?? null, input.reason]
    );
    if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Opportunity changed. Reload and reconcile.");
    await transaction.query(
      `INSERT INTO representation_opportunity_events
       (id,workspace_id,opportunity_id,from_stage,to_stage,reason,decision_id,actor_user_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [newId(), input.workspaceId, input.opportunityId, before.stage, input.toStage,
        input.reason, input.decisionId, input.actorUserId]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "representation_opportunity.stage_changed", targetType: "representation_opportunity",
      targetId: input.opportunityId, origin: "api", requestId: input.requestId,
      outcome: "succeeded", before, after: changed.rows[0], metadata: { reason: input.reason }
    });
    return changed.rows[0];
  });
}

export async function listAgreements(
  database: Database,
  workspaceId: string,
  filters: { status?: string; query?: string }
): Promise<Record<string, unknown>[]> {
  const values: unknown[] = [workspaceId];
  const where = ["a.workspace_id=$1", "a.archived_at IS NULL"];
  if (filters.status) where.push(`a.status=$${values.push(filters.status)}`);
  if (filters.query) where.push(`b.public_name ILIKE '%'||$${values.push(filters.query)}||'%'`);
  const result = await database.query(
    `SELECT ${agreementSelect},
       (SELECT count(*)::int FROM representation_agreement_products ap
         WHERE ap.workspace_id=a.workspace_id AND ap.agreement_id=a.id) AS "productCount"
     FROM representation_agreements a
     JOIN brands b ON b.workspace_id=a.workspace_id AND b.id=a.brand_id
     LEFT JOIN documents d ON d.workspace_id=a.workspace_id AND d.id=a.source_document_id
     WHERE ${where.join(" AND ")} ORDER BY a.updated_at DESC LIMIT 250`,
    values
  );
  return result.rows as Record<string, unknown>[];
}

export async function createAgreement(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string;
    representationOpportunityId: string; sourceDocumentId?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const opportunity = await oneOrNone<{ brandId: string; ownerUserId: string }>(
      transaction,
      `SELECT brand_id AS "brandId",owner_user_id AS "ownerUserId"
       FROM representation_opportunities WHERE workspace_id=$1 AND id=$2
       AND archived_at IS NULL FOR UPDATE`,
      [input.workspaceId, input.representationOpportunityId]
    );
    if (!opportunity) throw new AppError(404, "representation_opportunity_not_found", "Representation Opportunity not found.");
    if (input.sourceDocumentId) {
      const document = await database.query(
        `SELECT id FROM documents WHERE workspace_id=$1 AND id=$2
          AND subject_type='representation_opportunity' AND subject_id=$3`,
        [input.workspaceId, input.sourceDocumentId, input.representationOpportunityId]
      );
      if (!document.rows[0]) throw new AppError(422, "agreement_document_invalid", "The document is not linked to this opportunity.");
    }
    const id = newId();
    const created = await transaction.query<Record<string, unknown>>(
      `INSERT INTO representation_agreements
       (id,workspace_id,representation_opportunity_id,brand_id,representative_user_id,status,source_document_id)
       VALUES($1,$2,$3,$4,$5,'draft',$6) RETURNING id,brand_id AS "brandId",status,version`,
      [id, input.workspaceId, input.representationOpportunityId, opportunity.brandId, input.actorUserId, input.sourceDocumentId ?? null]
    );
    const products = await transaction.query<{ productId: string }>(
      `SELECT product_id AS "productId" FROM representation_opportunity_products
        WHERE workspace_id=$1 AND opportunity_id=$2`,
      [input.workspaceId, input.representationOpportunityId]
    );
    for (const { productId } of products.rows) {
      await transaction.query(
        `INSERT INTO representation_agreement_products(agreement_id,workspace_id,product_id)
         VALUES($1,$2,$3)`,
        [id, input.workspaceId, productId]
      );
    }
    await appendAgreementVersion(transaction, {
      workspaceId: input.workspaceId, agreementId: id, actorUserId: input.actorUserId, reason: "Agreement created"
    });
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "representation_agreement.created", targetType: "representation_agreement",
      targetId: id, origin: "api", requestId: input.requestId, outcome: "succeeded",
      after: created.rows[0]
    });
    return created.rows[0]!;
  });
}

export async function getAgreement(
  database: Database,
  workspaceId: string,
  agreementId: string
): Promise<Record<string, unknown>> {
  const snapshot = await agreementSnapshot(database, workspaceId, agreementId);
  const candidates = await database.query(
    `SELECT id,field_name AS "fieldName",proposed_value AS "proposedValue",
            source_document_id AS "sourceDocumentId",source_page AS "sourcePage",
            source_location AS "sourceLocation",evidence_excerpt AS "evidenceExcerpt",
            evidence_class AS "evidenceClass",confidence,origin,status,material,ambiguous,
            specialist_review_required AS "specialistReviewRequired",
            reviewed_by AS "reviewedBy",reviewed_at AS "reviewedAt",review_notes AS "reviewNotes",version
       FROM agreement_term_candidates WHERE workspace_id=$1 AND agreement_id=$2
      ORDER BY created_at DESC`,
    [workspaceId, agreementId]
  );
  const versions = await database.query(
    `SELECT id,version,snapshot_digest AS "snapshotDigest",reason,changed_by AS "changedBy",
            changed_at AS "changedAt"
       FROM representation_agreement_versions WHERE workspace_id=$1 AND agreement_id=$2
      ORDER BY version DESC`,
    [workspaceId, agreementId]
  );
  return { agreement: snapshot.agreement, products: snapshot.products, restrictions: snapshot.restrictions,
    candidates: candidates.rows, versions: versions.rows, reviewArtifact: canonical({
      agreementId, authorityDigest: snapshot.digest, agreement: snapshot.agreement,
      products: snapshot.products, restrictions: snapshot.restrictions
    }), authorityDigest: snapshot.digest };
}

export async function updateAgreement(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; agreementId: string;
    version: number; changes: Record<string, unknown>; productIds?: string[] | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const before = await oneOrNone<Record<string, unknown>>(
      transaction,
      `SELECT * FROM representation_agreements WHERE workspace_id=$1 AND id=$2
        AND archived_at IS NULL FOR UPDATE`,
      [input.workspaceId, input.agreementId]
    );
    if (!before) throw new AppError(404, "agreement_not_found", "Representation Agreement not found.");
    if (!["draft", "reviewing", "pending_approval"].includes(String(before.status))) {
      throw new AppError(409, "agreement_immutable_while_authoritative", "Suspend or end authority before changing material terms.");
    }
    const entries = Object.entries(input.changes).filter(([field]) => field in materialAgreementFields);
    if (entries.length === 0 && !input.productIds) throw new AppError(422, "no_changes", "No Agreement changes were supplied.");
    const values: unknown[] = [input.workspaceId, input.agreementId, input.version];
    const sets = entries.map(([field, value]) => {
      values.push(value);
      return `${materialAgreementFields[field]}=$${values.length}`;
    });
    sets.push("status='reviewing'", "approval_id=NULL", "authority_digest=NULL", "approved_by=NULL", "approved_at=NULL",
      "version=version+1", "updated_at=now()");
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE representation_agreements SET ${sets.join(",")}
        WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      values
    );
    if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Agreement changed. Reload and reconcile.");
    if (input.productIds) {
      const products = await transaction.query<{ id: string }>(
        `SELECT id FROM products WHERE workspace_id=$1 AND brand_id=$2
          AND id=ANY($3::uuid[]) AND archived_at IS NULL`,
        [input.workspaceId, before.brand_id, input.productIds]
      );
      if (products.rowCount !== new Set(input.productIds).size || products.rowCount === 0) {
        throw new AppError(422, "product_scope_invalid", "Agreement product scope must contain Products from this Brand.");
      }
      await transaction.query("DELETE FROM representation_agreement_products WHERE workspace_id=$1 AND agreement_id=$2",
        [input.workspaceId, input.agreementId]);
      for (const productId of input.productIds) {
        await transaction.query(
          "INSERT INTO representation_agreement_products(agreement_id,workspace_id,product_id) VALUES($1,$2,$3)",
          [input.agreementId, input.workspaceId, productId]
        );
      }
    }
    const digest = await appendAgreementVersion(transaction, {
      workspaceId: input.workspaceId, agreementId: input.agreementId,
      actorUserId: input.actorUserId, reason: "Material terms edited by a human"
    });
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "representation_agreement.terms_updated", targetType: "representation_agreement",
      targetId: input.agreementId, origin: "api", requestId: input.requestId,
      outcome: "succeeded", before, after: changed.rows[0], metadata: { digest }
    });
    return changed.rows[0];
  });
}

export async function createTermCandidate(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; agreementId: string;
    sourceDocumentId: string; fieldName: string; proposedValue: unknown; sourcePage?: number | null | undefined;
    sourceLocation: string; evidenceExcerpt: string; evidenceClass: string; confidence: string;
    origin: "user_entered" | "imported"; material: boolean; ambiguous: boolean;
    specialistReviewRequired: boolean;
  }
): Promise<Record<string, unknown>> {
  if (!(input.fieldName in materialAgreementFields)) throw new AppError(422, "agreement_field_unknown", "Unsupported Agreement field.");
  const agreement = await oneOrNone<{ sourceDocumentId: string | null }>(
    database,
    `SELECT source_document_id AS "sourceDocumentId" FROM representation_agreements
      WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL`,
    [input.workspaceId, input.agreementId]
  );
  if (!agreement) throw new AppError(404, "agreement_not_found", "Representation Agreement not found.");
  if (agreement.sourceDocumentId !== input.sourceDocumentId) {
    throw new AppError(422, "candidate_source_invalid", "Extraction must link to the Agreement's immutable original.");
  }
  const document = await database.query(
    `SELECT id FROM documents WHERE workspace_id=$1 AND id=$2 AND status='active' AND scan_status='clean'`,
    [input.workspaceId, input.sourceDocumentId]
  );
  if (!document.rows[0]) throw new AppError(409, "agreement_document_not_clean", "The original must pass scanning before review.");
  const id = newId();
  const result = await database.query<Record<string, unknown>>(
    `INSERT INTO agreement_term_candidates
      (id,workspace_id,agreement_id,source_document_id,field_name,proposed_value,source_page,
       source_location,evidence_excerpt,evidence_class,confidence,origin,status,material,ambiguous,
       specialist_review_required)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'proposed',$13,$14,$15)
     RETURNING *`,
    [id, input.workspaceId, input.agreementId, input.sourceDocumentId, input.fieldName,
      JSON.stringify(input.proposedValue), input.sourcePage ?? null, input.sourceLocation, input.evidenceExcerpt,
      input.evidenceClass, input.confidence, input.origin, input.material, input.ambiguous,
      input.specialistReviewRequired]
  );
  await recordAudit(database, {
    workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
    action: "agreement_term_candidate.proposed", targetType: "agreement_term_candidate",
    targetId: id, origin: "api", requestId: input.requestId, outcome: "succeeded",
    metadata: { fieldName: input.fieldName, sourceDocumentId: input.sourceDocumentId }
  });
  return result.rows[0]!;
}

export async function reviewTermCandidate(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; candidateId: string;
    version: number; decision: "confirmed" | "rejected"; editedValue?: unknown; reviewNotes: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const candidate = await oneOrNone<Record<string, unknown>>(
      transaction,
      `SELECT * FROM agreement_term_candidates WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,
      [input.workspaceId, input.candidateId]
    );
    if (!candidate) throw new AppError(404, "term_candidate_not_found", "Term candidate not found.");
    if (candidate.status !== "proposed" || Number(candidate.version) !== input.version) {
      throw new AppError(409, "version_conflict", "Term candidate changed. Reload and reconcile.");
    }
    if (input.decision === "confirmed") {
      const column = materialAgreementFields[String(candidate.field_name)];
      const value = input.editedValue === undefined ? candidate.proposed_value : input.editedValue;
      await transaction.query(
        `UPDATE representation_agreements SET ${column}=$3,status='reviewing',
          approval_id=NULL,authority_digest=NULL,approved_by=NULL,approved_at=NULL,
          version=version+1,updated_at=now()
          WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, candidate.agreement_id, value]
      );
      if (candidate.ambiguous === true) {
        await transaction.query(
          `UPDATE representation_agreements SET
            legal_ambiguity_status=CASE WHEN $3 THEN 'specialist_required' ELSE 'review_required' END,
            legal_ambiguity_notes=concat_ws(E'\\n',nullif(legal_ambiguity_notes,''),$4)
           WHERE workspace_id=$1 AND id=$2`,
          [input.workspaceId, candidate.agreement_id, candidate.specialist_review_required,
            `Ambiguous ${String(candidate.field_name)} at ${String(candidate.source_location)}`]
        );
      }
      await appendAgreementVersion(transaction, {
        workspaceId: input.workspaceId, agreementId: String(candidate.agreement_id),
        actorUserId: input.actorUserId, reason: `Human confirmed extracted ${String(candidate.field_name)}`
      });
    }
    const reviewed = await transaction.query<Record<string, unknown>>(
      `UPDATE agreement_term_candidates SET status=$4,reviewed_by=$5,reviewed_at=now(),
              review_notes=$6,version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.candidateId, input.version, input.decision,
        input.actorUserId, input.reviewNotes]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: `agreement_term_candidate.${input.decision}`, targetType: "agreement_term_candidate",
      targetId: input.candidateId, origin: "api", requestId: input.requestId,
      outcome: "succeeded", before: candidate, after: reviewed.rows[0]
    });
    return reviewed.rows[0]!;
  });
}

export async function addAgreementRestriction(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; agreementId: string;
    restrictionType: "house_account_exclusion" | "protected_account_basis" | "account_exclusion";
    businessId?: string | null | undefined; accountName: string; productIds: string[]; channels: string[];
    territoryScope: Record<string, unknown>; effectiveAt?: string | null | undefined; expiresAt?: string | null | undefined;
    sourceDocumentId: string; sourceLocation: string;
  }
): Promise<Record<string, unknown>> {
  const agreement = await oneOrNone<{ sourceDocumentId: string | null; status: string }>(
    database,
    `SELECT source_document_id AS "sourceDocumentId",status FROM representation_agreements
      WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL`,
    [input.workspaceId, input.agreementId]
  );
  if (!agreement) throw new AppError(404, "agreement_not_found", "Representation Agreement not found.");
  if (agreement.sourceDocumentId !== input.sourceDocumentId) {
    throw new AppError(422, "restriction_source_required", "A restriction must cite the Agreement original.");
  }
  if (!["draft", "reviewing", "pending_approval"].includes(agreement.status)) {
    throw new AppError(409, "agreement_immutable_while_authoritative", "Suspend authority before changing restrictions.");
  }
  const id = newId();
  const result = await database.query<Record<string, unknown>>(
    `INSERT INTO agreement_account_restrictions
      (id,workspace_id,agreement_id,restriction_type,business_id,account_name,
       normalized_account_name,product_ids,channels,territory_scope,effective_at,expires_at,
       source_document_id,source_location,status,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'confirmed',$15)
     RETURNING *`,
    [id, input.workspaceId, input.agreementId, input.restrictionType, input.businessId ?? null,
      input.accountName, normalizeAccountName(input.accountName), input.productIds, input.channels,
      input.territoryScope, input.effectiveAt ?? null, input.expiresAt ?? null,
      input.sourceDocumentId, input.sourceLocation, input.actorUserId]
  );
  await appendAgreementVersion(database, {
    workspaceId: input.workspaceId, agreementId: input.agreementId,
    actorUserId: input.actorUserId, reason: `Written ${input.restrictionType} recorded`
  });
  await recordAudit(database, {
    workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
    action: "agreement_account_restriction.recorded", targetType: "agreement_account_restriction",
    targetId: id, origin: "api", requestId: input.requestId, outcome: "succeeded",
    after: result.rows[0]
  });
  return result.rows[0]!;
}

export async function validateCurrentAuthority(
  database: Database | Transaction,
  input: {
    workspaceId: string; brandId: string; productIds: string[];
    businessId?: string | null | undefined; channel?: string | null | undefined;
    agreementId?: string | null | undefined; requireTerritoryProof?: boolean | undefined;
    ignoreProtectedAccountId?: string | null | undefined;
  }
): Promise<AuthorityResult> {
  const reasons: string[] = [];
  const parameters: unknown[] = [input.workspaceId, input.brandId];
  const agreementCondition = input.agreementId ? `AND a.id=$${parameters.push(input.agreementId)}` : "";
  const agreement = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT a.*,d.status AS document_status,d.scan_status AS document_scan_status
       FROM representation_agreements a
       LEFT JOIN documents d ON d.workspace_id=a.workspace_id AND d.id=a.source_document_id
      WHERE a.workspace_id=$1 AND a.brand_id=$2 ${agreementCondition}
        AND a.status='active' AND a.effective_at<=now()
        AND (a.expires_at IS NULL OR a.expires_at>now())
      ORDER BY a.approved_at DESC NULLS LAST LIMIT 1`,
    parameters
  );
  if (!agreement) return { outcome: "denied", agreementId: null, authorityDigest: null,
    reasonCodes: ["no_current_active_agreement"], conflicts: [] };
  if (agreement.document_status !== "active" || agreement.document_scan_status !== "clean") {
    reasons.push("agreement_original_not_clean");
  }
  if (!agreement.approval_id || !agreement.approved_by || !agreement.authority_digest) reasons.push("human_authority_approval_missing");
  if (["review_required", "specialist_required"].includes(String(agreement.legal_ambiguity_status))) {
    reasons.push("legal_ambiguity_unresolved");
  }
  const covered = await database.query<{ productId: string }>(
    `SELECT product_id AS "productId" FROM representation_agreement_products
      WHERE workspace_id=$1 AND agreement_id=$2 AND product_id=ANY($3::uuid[])`,
    [input.workspaceId, agreement.id, input.productIds]
  );
  if (covered.rowCount !== new Set(input.productIds).size || covered.rowCount === 0) reasons.push("product_out_of_scope");
  if (input.channel && !(agreement.channels as string[]).includes(input.channel)) reasons.push("channel_out_of_scope");
  const conflicts: Record<string, unknown>[] = [];
  if (input.businessId) {
    const business = await oneOrNone<{ name: string; geography: Record<string, unknown> }>(
      database, "SELECT name,geography FROM businesses WHERE workspace_id=$1 AND id=$2",
      [input.workspaceId, input.businessId]
    );
    if (!business) reasons.push("business_not_found");
    else {
      if (input.requireTerritoryProof) {
        const agreementTerritory = (agreement.territory_scope ?? {}) as Record<string, unknown>;
        const buyerGeography = business.geography ?? {};
        const dimensions = [
          ["countries", "country"], ["regions", "region"], ["states", "state"],
          ["cities", "city"], ["postalCodes", "postalCode"]
        ] as const;
        for (const [plural, singular] of dimensions) {
          const allowedRaw = agreementTerritory[plural] ?? agreementTerritory[singular];
          if (allowedRaw === undefined || allowedRaw === null || allowedRaw === "") continue;
          const actualRaw = buyerGeography[plural] ?? buyerGeography[singular];
          const allowed = (Array.isArray(allowedRaw) ? allowedRaw : [allowedRaw])
            .map((item) => String(item).trim().toLowerCase()).filter(Boolean);
          const actual = (Array.isArray(actualRaw) ? actualRaw : actualRaw ? [actualRaw] : [])
            .map((item) => String(item).trim().toLowerCase()).filter(Boolean);
          if (actual.length === 0) reasons.push("territory_scope_unverifiable");
          else if (!actual.some((item) => allowed.includes(item))) reasons.push("territory_out_of_scope");
        }
      }
      const conflictResult = await database.query<Record<string, unknown>>(
        `SELECT id,restriction_type AS "restrictionType",business_id AS "businessId",
                account_name AS "accountName",source_document_id AS "sourceDocumentId",
                source_location AS "sourceLocation"
           FROM agreement_account_restrictions
          WHERE workspace_id=$1 AND agreement_id=$2 AND status='confirmed'
            AND (effective_at IS NULL OR effective_at<=now())
            AND (expires_at IS NULL OR expires_at>now())
            AND (business_id=$3 OR normalized_account_name=$4)`,
        [input.workspaceId, agreement.id, input.businessId, normalizeAccountName(business.name)]
      );
      conflicts.push(...conflictResult.rows);
      if (conflicts.some((item) => item.businessId === input.businessId)) reasons.push("written_account_exclusion");
      else if (conflicts.length > 0) reasons.push("possible_account_name_conflict");
      const protectionResult = await database.query<Record<string, unknown>>(
        `SELECT id,status,agreement_id AS "agreementId",account_id AS "accountId",
                protection_starts_on AS "protectionStartsOn",
                protection_ends_on AS "protectionEndsOn"
           FROM protected_accounts
          WHERE workspace_id=$1 AND brand_id=$2 AND business_id=$3
            AND status IN ('pending','active','expiring','disputed')
            AND protection_starts_on<=CURRENT_DATE AND protection_ends_on>=CURRENT_DATE
            AND (agreement_id<>$4 OR status IN ('pending','disputed'))
            AND ($5::uuid IS NULL OR id<>$5::uuid)`,
        [input.workspaceId, input.brandId, input.businessId, agreement.id,
          input.ignoreProtectedAccountId ?? null]
      );
      conflicts.push(...protectionResult.rows.map((item) => ({
        ...item, conflictType: "protected_account"
      })));
      if (protectionResult.rows.some((item) => item.status === "disputed")) {
        reasons.push("protected_account_conflict");
      } else if (protectionResult.rows.length > 0) {
        reasons.push("possible_protected_account_conflict");
      }
    }
  }
  const reviewOnly = reasons.length === 1 &&
    ["possible_account_name_conflict","possible_protected_account_conflict"].includes(reasons[0]!);
  return {
    outcome: reasons.length === 0 ? "authorized" : reviewOnly ? "review_required" : "denied",
    agreementId: String(agreement.id), authorityDigest: String(agreement.authority_digest),
    reasonCodes: reasons, conflicts
  };
}

export async function evaluateAuthority(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; action: AuthorityAction;
    brandId: string; productIds: string[]; businessId?: string | null | undefined;
    channel?: string | null | undefined; agreementId?: string | null | undefined;
    context?: Record<string, unknown> | undefined;
  }
): Promise<AuthorityResult> {
  const result = await validateCurrentAuthority(database, input);
  const id = newId();
  await database.query(
    `INSERT INTO authority_evaluations
      (id,workspace_id,agreement_id,brand_id,product_ids,business_id,action,outcome,
       reason_codes,context,authority_digest,evaluated_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, input.workspaceId, result.agreementId, input.brandId, input.productIds,
      input.businessId ?? null, input.action, result.outcome, result.reasonCodes,
      input.context ?? {}, result.authorityDigest, input.actorUserId]
  );
  await recordAudit(database, {
    workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
    action: `authority.${input.action}.${result.outcome}`, targetType: "authority_evaluation",
    targetId: id, origin: "api", requestId: input.requestId, outcome: "succeeded",
    metadata: { agreementId: result.agreementId, reasonCodes: result.reasonCodes }
  });
  return result;
}

export async function requestAgreementApproval(
  database: Database,
  input: { workspaceId: string; actorUserId: string; requestId: string; agreementId: string; scope: string }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const snapshot = await agreementSnapshot(transaction, input.workspaceId, input.agreementId);
    const agreement = snapshot.agreement;
    if (agreement.documentStatus !== "active" || agreement.documentScanStatus !== "clean") {
      throw new AppError(409, "agreement_document_not_clean", "A clean immutable Agreement original is required.");
    }
    if (!agreement.effectiveAt || snapshot.products.length === 0 || !(agreement.channels as string[]).length) {
      throw new AppError(422, "agreement_scope_incomplete", "Effective date, channel and Product scope are required.");
    }
    const proposed = await transaction.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM agreement_term_candidates
        WHERE workspace_id=$1 AND agreement_id=$2 AND material AND status='proposed'`,
      [input.workspaceId, input.agreementId]
    );
    if ((proposed.rows[0]?.count ?? 0) > 0) throw new AppError(409, "material_term_review_pending", "Review every material extraction before approval.");
    if (["review_required", "specialist_required"].includes(String(agreement.legalAmbiguityStatus))) {
      throw new AppError(409, "legal_ambiguity_unresolved", "Resolve or obtain specialist review for legal ambiguity.");
    }
    const id = newId();
    const result = await transaction.query<Record<string, unknown>>(
      `INSERT INTO human_approvals
       (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,
        approver_user_id,status,scope)
       VALUES($1,$2,'representation_agreement',$3,'activate_representation_agreement',$4,$5,'requested',$6)
       RETURNING id,action_type AS "actionType",artifact_digest AS "artifactDigest",status,scope,
                 requested_at AS "requestedAt"`,
      [id, input.workspaceId, input.agreementId, snapshot.digest, input.actorUserId, input.scope]
    );
    await transaction.query(
      `UPDATE representation_agreements SET status='pending_approval',version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, input.agreementId]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "representation_agreement.approval_requested", targetType: "representation_agreement",
      targetId: input.agreementId, origin: "api", requestId: input.requestId, outcome: "succeeded",
      metadata: { approvalId: id, artifactDigest: snapshot.digest }
    });
    return result.rows[0]!;
  });
}

export async function decideAndActivateAgreement(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; agreementId: string;
    approvalId: string; decision: "approved" | "rejected" | "changes_required"; conditions: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const snapshot = await agreementSnapshot(transaction, input.workspaceId, input.agreementId);
    const approval = await transaction.query<{ id: string }>(
      `UPDATE human_approvals SET status=$6,conditions=$7,decided_at=now()
        WHERE workspace_id=$1 AND id=$2 AND subject_type='representation_agreement'
          AND subject_id=$3 AND action_type='activate_representation_agreement'
          AND approver_user_id=$4 AND artifact_digest=$5 AND status='requested'
          AND (expires_at IS NULL OR expires_at>now()) RETURNING id`,
      [input.workspaceId, input.approvalId, input.agreementId, input.actorUserId,
        snapshot.digest, input.decision, input.conditions]
    );
    if (!approval.rows[0]) {
      throw new AppError(409, "approval_artifact_changed", "Approval is unavailable or material terms changed.");
    }
    if (input.decision !== "approved") {
      await transaction.query(
        `UPDATE representation_agreements SET status='reviewing',version=version+1,updated_at=now()
          WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, input.agreementId]
      );
      await recordAudit(transaction, {
        workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
        action: `representation_agreement.${input.decision}`, targetType: "representation_agreement",
        targetId: input.agreementId, origin: "api", requestId: input.requestId,
        outcome: "succeeded", metadata: { approvalId: input.approvalId }
      });
      return { id: input.agreementId, status: "reviewing" };
    }
    const document = snapshot.agreement;
    if (document.documentStatus !== "active" || document.documentScanStatus !== "clean" ||
        ["review_required", "specialist_required"].includes(String(document.legalAmbiguityStatus))) {
      throw new AppError(409, "authority_conditions_changed", "Agreement authority conditions changed.");
    }
    const updated = await transaction.query<Record<string, unknown>>(
      `UPDATE representation_agreements
          SET status='active',approval_id=$3,authority_digest=$4,approved_by=$5,
              approved_at=now(),version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND status='pending_approval'
        RETURNING id,status,approval_id AS "approvalId",authority_digest AS "authorityDigest",
                  approved_by AS "approvedBy",approved_at AS "approvedAt",version`,
      [input.workspaceId, input.agreementId, input.approvalId, snapshot.digest, input.actorUserId]
    );
    if (!updated.rows[0]) throw new AppError(409, "agreement_not_pending", "Agreement is not awaiting approval.");
    await transaction.query(
      `UPDATE representation_opportunities
        SET stage='converted',converted_agreement_id=$3,version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, snapshot.agreement.representationOpportunityId, input.agreementId]
    );
    if (snapshot.agreement.renewalReviewAt) {
      await transaction.query(
        `INSERT INTO tasks(id,workspace_id,subject_type,subject_id,title,owner_user_id,status,
          priority,created_reason,due_at,mandatory_gate)
         VALUES($1,$2,'representation_agreement',$3,'Review Agreement renewal',$4,'open',
                'high','Agreement renewal tracking',$5,true)`,
        [newId(), input.workspaceId, input.agreementId, input.actorUserId, snapshot.agreement.renewalReviewAt]
      );
    }
    await appendAgreementVersion(transaction, {
      workspaceId: input.workspaceId, agreementId: input.agreementId,
      actorUserId: input.actorUserId, reason: "Human approved representation authority"
    });
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "representation_agreement.activated", targetType: "representation_agreement",
      targetId: input.agreementId, origin: "api", requestId: input.requestId,
      outcome: "succeeded", after: updated.rows[0],
      metadata: { approvalId: input.approvalId, artifactDigest: snapshot.digest }
    });
    return updated.rows[0];
  });
}

export async function changeAgreementStatus(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; agreementId: string;
    version: number; status: "suspended" | "ended"; reason: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE representation_agreements SET status=$4,
          suspended_reason=CASE WHEN $4='suspended' THEN $5 ELSE suspended_reason END,
          ended_reason=CASE WHEN $4='ended' THEN $5 ELSE ended_reason END,
          ended_at=CASE WHEN $4='ended' THEN now() ELSE ended_at END,
          version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND version=$3 AND status='active' RETURNING *`,
      [input.workspaceId, input.agreementId, input.version, input.status, input.reason]
    );
    if (!changed.rows[0]) throw new AppError(409, "agreement_status_conflict", "Only current active authority can be suspended or ended.");
    const suppressedMessages = await transaction.query<{ id: string }>(
      `UPDATE outreach_messages
          SET status='suppressed',provider_status='authority_invalid',
              provider_safe_detail=$3,version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND agreement_id=$2
          AND status IN ('draft','approval_requested','approved','queued')
        RETURNING id`,
      [
        input.workspaceId,
        input.agreementId,
        `Agreement ${input.status}; external delivery is prohibited.`
      ]
    );
    const stoppedEnrollments = await transaction.query<{ id: string }>(
      `UPDATE outreach_sequence_enrollments e
          SET status='stopped',stop_reason=$3,version=e.version+1,updated_at=now()
         FROM placement_opportunities p
        WHERE e.workspace_id=$1 AND p.workspace_id=e.workspace_id
          AND p.id=e.placement_opportunity_id AND p.agreement_id=$2
          AND e.status IN ('active','paused')
        RETURNING e.id`,
      [input.workspaceId, input.agreementId, `Agreement ${input.status}`]
    );
    if (suppressedMessages.rows.length > 0) {
      await transaction.query(
        `UPDATE durable_jobs
            SET status='canceled',last_error='Agreement authority no longer valid',
                lease_owner=NULL,lease_expires_at=NULL,updated_at=now()
          WHERE workspace_id=$1 AND kind='outreach.send'
            AND status IN ('queued','leased')
            AND payload->>'messageId'=ANY($2::text[])`,
        [input.workspaceId, suppressedMessages.rows.map((message) => message.id)]
      );
    }
    const continuity = await oneOrNone<{
      protectedCount: string;
      commissionCount: string;
      postTerminationRights: string;
    }>(
      transaction,
      `SELECT
        (SELECT count(*)::text FROM protected_accounts
          WHERE workspace_id=$1 AND agreement_id=$2
            AND status IN ('pending_approval','active','expiring')) AS "protectedCount",
        (SELECT count(*)::text FROM commissions
          WHERE workspace_id=$1 AND agreement_id=$2
            AND status NOT IN ('paid','clawed_back','waived')) AS "commissionCount",
        coalesce(post_termination_commission_rights,'') AS "postTerminationRights"
       FROM representation_agreements WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, input.agreementId]
    );
    if (continuity && (
      Number(continuity.protectedCount) > 0 ||
      Number(continuity.commissionCount) > 0 ||
      continuity.postTerminationRights.trim().length > 0
    )) {
      await transaction.query(
        `INSERT INTO tasks
          (id,workspace_id,subject_type,subject_id,title,owner_user_id,status,
           priority,created_reason,due_at,mandatory_gate)
         VALUES($1,$2,'representation_agreement',$3,
                'Review surviving account and commission rights',$4,'open','high',
                'Agreement authority ended or suspended; existing rights require human review',
                now(),true)`,
        [newId(), input.workspaceId, input.agreementId, input.actorUserId]
      );
    }
    await appendAgreementVersion(transaction, {
      workspaceId: input.workspaceId, agreementId: input.agreementId,
      actorUserId: input.actorUserId, reason: `${input.status}: ${input.reason}`
    });
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: `representation_agreement.${input.status}`, targetType: "representation_agreement",
      targetId: input.agreementId, origin: "api", requestId: input.requestId,
      outcome: "succeeded", after: changed.rows[0],
      metadata: {
        reason: input.reason,
        suppressedMessageCount: suppressedMessages.rows.length,
        stoppedEnrollmentCount: stoppedEnrollments.rows.length,
        commercialRecordsPreserved: true
      }
    });
    return changed.rows[0];
  });
}

export async function listPlacements(
  database: Database,
  workspaceId: string,
  filters: { stage?: string; query?: string }
): Promise<Record<string, unknown>[]> {
  const values: unknown[] = [workspaceId];
  const where = ["p.workspace_id=$1", "p.archived_at IS NULL"];
  if (filters.stage) where.push(`p.stage=$${values.push(filters.stage)}`);
  if (filters.query) where.push(`(b.name ILIKE '%'||$${values.push(filters.query)}||'%' OR br.public_name ILIKE '%'||$${values.length}||'%')`);
  const result = await database.query(
    `SELECT p.id,p.agreement_id AS "agreementId",p.brand_id AS "brandId",br.public_name AS "brandName",
            p.business_id AS "businessId",b.name AS "businessName",p.stage,p.match_thesis AS "matchThesis",
            p.buyer_value_basis AS "buyerValueBasis",p.evidence_confidence AS "evidenceConfidence",
            p.conflict_status AS "conflictStatus",p.next_action_task_id AS "nextActionTaskId",
            t.title AS "nextAction",t.due_at AS "nextActionDueAt",p.last_meaningful_action_at AS "lastMeaningfulActionAt",
            (p.snoozed_until IS NULL OR p.snoozed_until<=now()) AND
             (t.id IS NULL OR (t.status NOT IN ('completed','canceled') AND t.due_at<now()) OR
              p.last_meaningful_action_at<now()-interval '14 days') AS stalled,
            p.version,p.updated_at AS "updatedAt"
       FROM placement_opportunities p
       JOIN brands br ON br.workspace_id=p.workspace_id AND br.id=p.brand_id
       JOIN businesses b ON b.workspace_id=p.workspace_id AND b.id=p.business_id
       LEFT JOIN tasks t ON t.workspace_id=p.workspace_id AND t.id=p.next_action_task_id
      WHERE ${where.join(" AND ")} ORDER BY p.updated_at DESC LIMIT 250`,
    values
  );
  return result.rows as Record<string, unknown>[];
}

export async function createPlacement(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; agreementId: string;
    businessId: string; productIds: string[]; channel: string; matchThesis: string;
    buyerValueBasis: string; evidenceConfidence: "insufficient" | "limited" | "supported" | "strong";
    decisionId: string; nextActionTaskId?: string | null | undefined;
    triangle: {
      brandValue: string; brandObligations: string; brandRisks: string; brandWarningSigns: string;
      buyerValue: string; buyerObligations: string; buyerRisks: string; buyerWarningSigns: string;
      representativeValue: string; representativeObligations: string; representativeRisks: string;
      representativeWarningSigns: string; allPartiesReceiveLegitimateValue: boolean;
    };
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const agreement = await oneOrNone<{ brandId: string }>(
      transaction,
      `SELECT brand_id AS "brandId" FROM representation_agreements
        WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL`,
      [input.workspaceId, input.agreementId]
    );
    if (!agreement) throw new AppError(404, "agreement_not_found", "Representation Agreement not found.");
    const authority = await validateCurrentAuthority(transaction, {
      workspaceId: input.workspaceId, brandId: agreement.brandId, productIds: input.productIds,
      businessId: input.businessId, channel: input.channel, agreementId: input.agreementId
    });
    if (authority.outcome === "denied") {
      throw new AppError(409, "representation_authority_invalid", `Placement is blocked: ${authority.reasonCodes.join(", ")}.`);
    }
    if (!input.triangle.allPartiesReceiveLegitimateValue) {
      throw new AppError(422, "relationship_triangle_value_required", "All three parties must receive legitimate value.");
    }
    const buyerValue = `${input.buyerValueBasis} ${input.triangle.buyerValue}`.toLowerCase();
    if ((buyerValue.includes("commission") || buyerValue.includes("representative earning")) &&
        !/(customer|assortment|margin|buyer|operations|demand|guest|member)/.test(buyerValue)) {
      throw new AppError(422, "commission_only_rationale", "Representative earnings do not establish legitimate Buyer value.");
    }
    const business = await oneOrNone<{ qualificationStatus: string }>(
      transaction,
      `SELECT qualification_status AS "qualificationStatus" FROM businesses
        WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL`,
      [input.workspaceId, input.businessId]
    );
    if (!business || !["conditional", "qualified"].includes(business.qualificationStatus)) {
      throw new AppError(422, "qualified_business_required", "The Business must be conditionally or fully qualified.");
    }
    const qualifiedProducts = await transaction.query<{ id: string }>(
      `SELECT id FROM products WHERE workspace_id=$1 AND id=ANY($2::uuid[])
        AND archived_at IS NULL AND status IN ('qualified','represented')`,
      [input.workspaceId, input.productIds]
    );
    if (qualifiedProducts.rowCount !== new Set(input.productIds).size) {
      throw new AppError(422, "qualified_product_required", "Every scoped Product must be qualified or represented.");
    }
    const qualifiedMatches = await transaction.query<{ productId: string }>(
      `SELECT DISTINCT product_id AS "productId" FROM product_business_match_reviews
        WHERE workspace_id=$1 AND business_id=$2 AND product_id=ANY($3::uuid[])
          AND status IN ('qualified','conditional')`,
      [input.workspaceId, input.businessId, input.productIds]
    );
    if (qualifiedMatches.rowCount !== new Set(input.productIds).size) {
      throw new AppError(422, "qualified_match_required", "Every Product–Business match requires a human qualified or conditional review.");
    }
    const decision = await transaction.query(
      `SELECT id FROM decision_records WHERE workspace_id=$1 AND id=$2
        AND subject_type='business' AND subject_id=$3 AND owner_user_id=$4 AND status='issued'`,
      [input.workspaceId, input.decisionId, input.businessId, input.actorUserId]
    );
    if (!decision.rows[0]) throw new AppError(422, "human_decision_required", "An issued human placement decision is required.");
    const id = newId();
    const created = await transaction.query<Record<string, unknown>>(
      `INSERT INTO placement_opportunities
       (id,workspace_id,agreement_id,brand_id,business_id,owner_user_id,stage,authority_channel,match_thesis,
        buyer_value_basis,evidence_confidence,decision_id,next_action_task_id,conflict_status)
       VALUES($1,$2,$3,$4,$5,$6,'identified',$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [id, input.workspaceId, input.agreementId, agreement.brandId, input.businessId,
        input.actorUserId, input.channel, input.matchThesis, input.buyerValueBasis, input.evidenceConfidence,
        input.decisionId, input.nextActionTaskId ?? null,
        authority.outcome === "review_required" ? "review_required" : "clear"]
    );
    for (const productId of input.productIds) {
      await transaction.query(
        `INSERT INTO placement_opportunity_products(placement_opportunity_id,workspace_id,product_id)
         VALUES($1,$2,$3)`,
        [id, input.workspaceId, productId]
      );
    }
    await transaction.query(
      `INSERT INTO relationship_triangle_reviews
       (id,workspace_id,placement_opportunity_id,brand_value,brand_obligations,brand_risks,
        brand_warning_signs,buyer_value,buyer_obligations,buyer_risks,buyer_warning_signs,
        representative_value,representative_obligations,representative_risks,
        representative_warning_signs,all_parties_receive_legitimate_value,reviewed_by,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'current')`,
      [newId(), input.workspaceId, id, input.triangle.brandValue, input.triangle.brandObligations,
        input.triangle.brandRisks, input.triangle.brandWarningSigns, input.triangle.buyerValue,
        input.triangle.buyerObligations, input.triangle.buyerRisks, input.triangle.buyerWarningSigns,
        input.triangle.representativeValue, input.triangle.representativeObligations,
        input.triangle.representativeRisks, input.triangle.representativeWarningSigns,
        input.triangle.allPartiesReceiveLegitimateValue, input.actorUserId]
    );
    await transaction.query(
      `INSERT INTO placement_stage_events
       (id,workspace_id,placement_opportunity_id,to_stage,reason,decision_id,actor_user_id)
       VALUES($1,$2,$3,'identified','Human created evidence-supported placement',$4,$5)`,
      [newId(), input.workspaceId, id, input.decisionId, input.actorUserId]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "placement_opportunity.created", targetType: "placement_opportunity",
      targetId: id, origin: "api", requestId: input.requestId, outcome: "succeeded",
      after: created.rows[0], metadata: { authority, productIds: input.productIds }
    });
    return created.rows[0]!;
  });
}

export async function getPlacement(
  database: Database,
  workspaceId: string,
  placementId: string
): Promise<Record<string, unknown>> {
  const placement = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT p.*,br.public_name AS "brandName",b.name AS "businessName",t.title AS "nextAction",
            t.due_at AS "nextActionDueAt"
       FROM placement_opportunities p
       JOIN brands br ON br.workspace_id=p.workspace_id AND br.id=p.brand_id
       JOIN businesses b ON b.workspace_id=p.workspace_id AND b.id=p.business_id
       LEFT JOIN tasks t ON t.workspace_id=p.workspace_id AND t.id=p.next_action_task_id
      WHERE p.workspace_id=$1 AND p.id=$2 AND p.archived_at IS NULL`,
    [workspaceId, placementId]
  );
  if (!placement) throw new AppError(404, "placement_not_found", "Placement Opportunity not found.");
  const [products, triangle, events, conflicts] = await Promise.all([
    database.query(`SELECT product_id AS "productId" FROM placement_opportunity_products WHERE workspace_id=$1 AND placement_opportunity_id=$2`, [workspaceId, placementId]),
    database.query(`SELECT * FROM relationship_triangle_reviews WHERE workspace_id=$1 AND placement_opportunity_id=$2 AND status='current'`, [workspaceId, placementId]),
    database.query(`SELECT from_stage AS "fromStage",to_stage AS "toStage",reason,decision_id AS "decisionId",evidence_ids AS "evidenceIds",occurred_at AS "occurredAt" FROM placement_stage_events WHERE workspace_id=$1 AND placement_opportunity_id=$2 ORDER BY occurred_at DESC`, [workspaceId, placementId]),
    database.query(`SELECT * FROM placement_conflicts WHERE workspace_id=$1 AND placement_opportunity_id=$2 ORDER BY created_at DESC`, [workspaceId, placementId])
  ]);
  return { placement, products: products.rows, triangle: triangle.rows[0] ?? null, events: events.rows, conflicts: conflicts.rows };
}

const placementStages = [
  "identified","qualified","prepared","contacted","engaged","information_sample_sent",
  "buyer_review","terms_order_discussion","opening_order","active_account",
  "reorder_management","closed_lost","disqualified"
] as const;

export async function transitionPlacement(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; placementId: string;
    version: number; toStage: typeof placementStages[number]; reason: string;
    decisionId: string; evidenceIds: string[]; nextActionTaskId?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const placement = await oneOrNone<Record<string, unknown>>(
      transaction,
      `SELECT * FROM placement_opportunities WHERE workspace_id=$1 AND id=$2
        AND archived_at IS NULL FOR UPDATE`,
      [input.workspaceId, input.placementId]
    );
    if (!placement) throw new AppError(404, "placement_not_found", "Placement Opportunity not found.");
    const from = String(placement.stage);
    if (["opening_order","active_account","reorder_management"].includes(input.toStage)) {
      throw new AppError(409, "later_workflow_required", "This stage requires the later Order or Account workflow.");
    }
    const products = await transaction.query<{ productId: string }>(
      `SELECT product_id AS "productId" FROM placement_opportunity_products
        WHERE workspace_id=$1 AND placement_opportunity_id=$2`,
      [input.workspaceId, input.placementId]
    );
    const authority = await validateCurrentAuthority(transaction, {
      workspaceId: input.workspaceId, brandId: String(placement.brand_id),
      productIds: products.rows.map((item) => item.productId),
      businessId: String(placement.business_id), agreementId: String(placement.agreement_id)
    });
    if (["qualified","prepared","contacted","engaged","information_sample_sent",
      "buyer_review","terms_order_discussion"].includes(input.toStage) &&
      authority.outcome !== "authorized") {
      throw new AppError(409, "representation_authority_invalid", `Stage is blocked: ${authority.reasonCodes.join(", ")}.`);
    }
    if (input.toStage === "qualified" && placement.conflict_status !== "clear") {
      throw new AppError(409, "placement_conflict_unresolved", "Resolve the account conflict before qualification.");
    }
    if (input.toStage === "contacted") {
      const contact = await transaction.query(
        `SELECT id FROM activities WHERE workspace_id=$1
          AND subject_type='placement_opportunity' AND subject_id=$2
          AND activity_type IN ('email_sent','call_connected','call_voicemail','social_sent')
          AND status='completed' LIMIT 1`,
        [input.workspaceId, input.placementId]
      );
      if (!contact.rows[0]) {
        throw new AppError(409, "verified_outreach_required", "Contacted requires provider-accepted email or a human-confirmed call/social action.");
      }
    }
    if (input.toStage === "engaged") {
      const engagement = await transaction.query(
        `SELECT id FROM activities WHERE workspace_id=$1
          AND subject_type='placement_opportunity' AND subject_id=$2
          AND activity_type IN ('email_replied','buyer_reply','call_connected') AND status='completed' LIMIT 1`,
        [input.workspaceId, input.placementId]
      );
      if (!engagement.rows[0]) {
        throw new AppError(409, "buyer_engagement_required", "Engaged requires a recorded Buyer reply or connected call.");
      }
    }
    if (input.toStage === "information_sample_sent") {
      const material = await transaction.query(
        `SELECT m.id FROM outreach_messages m
          JOIN outreach_message_attachments a ON a.workspace_id=m.workspace_id AND a.message_id=m.id
         WHERE m.workspace_id=$1 AND m.placement_opportunity_id=$2
           AND m.status IN ('accepted','delivered','replied') LIMIT 1`,
        [input.workspaceId, input.placementId]
      );
      if (!material.rows[0]) {
        throw new AppError(409, "verified_material_send_required", "Information/Sample Sent requires an accepted message with a reviewed clean attachment.");
      }
    }
    if (input.toStage === "buyer_review" && !["engaged","information_sample_sent","buyer_review"].includes(from)) {
      throw new AppError(409, "buyer_review_entry_invalid", "Buyer Review requires recorded engagement or information delivery.");
    }
    if (input.toStage === "terms_order_discussion" && input.reason.trim().length < 20) {
      throw new AppError(422, "open_conditions_required", "Record Buyer interest and open commercial conditions without binding interpretation.");
    }
    const terminal = ["closed_lost", "disqualified"].includes(input.toStage);
    const reopening = ["closed_lost", "disqualified"].includes(from) && !terminal;
    const backward = !terminal && placementStages.indexOf(input.toStage) < placementStages.indexOf(from as typeof placementStages[number]);
    if ((terminal || reopening || backward) && (!input.reason.trim() || input.evidenceIds.length === 0)) {
      throw new AppError(422, "transition_basis_required", "Backward, closure and reopen transitions require a reason and evidence.");
    }
    const decision = await transaction.query(
      `SELECT id FROM decision_records WHERE workspace_id=$1 AND id=$2
        AND owner_user_id=$3 AND status='issued'`,
      [input.workspaceId, input.decisionId, input.actorUserId]
    );
    if (!decision.rows[0]) throw new AppError(422, "human_decision_required", "A fresh issued human decision is required.");
    if (!terminal && !input.nextActionTaskId) throw new AppError(422, "next_action_required", "A next action is required.");
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE placement_opportunities SET stage=$4,decision_id=$5,next_action_task_id=$6,
          loss_reason=CASE WHEN $4='closed_lost' THEN $7 ELSE NULL END,
          disqualification_reason=CASE WHEN $4='disqualified' THEN $7 ELSE NULL END,
          last_meaningful_action_at=now(),version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.placementId, input.version, input.toStage,
        input.decisionId, input.nextActionTaskId ?? null, input.reason]
    );
    if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Placement changed. Reload and reconcile.");
    await transaction.query(
      `INSERT INTO placement_stage_events
       (id,workspace_id,placement_opportunity_id,from_stage,to_stage,reason,decision_id,evidence_ids,actor_user_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [newId(), input.workspaceId, input.placementId, from, input.toStage,
        input.reason, input.decisionId, input.evidenceIds, input.actorUserId]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "placement_opportunity.stage_changed", targetType: "placement_opportunity",
      targetId: input.placementId, origin: "api", requestId: input.requestId,
      outcome: "succeeded", before: placement, after: changed.rows[0],
      metadata: { reason: input.reason, authority }
    });
    return changed.rows[0];
  });
}
