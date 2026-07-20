import type { Database, Transaction } from "../../database/src/index.js";
import { oneOrNone, withTransaction } from "../../database/src/index.js";
import { AppError, newId } from "../../shared/src/index.js";
import { recordAudit } from "./audit.js";
import { getCoreRecord } from "./records.js";
import { validateCurrentAuthority } from "./representation.js";

type EvidenceOrigin =
  | "user_entered"
  | "human_confirmed"
  | "externally_sourced"
  | "imported"
  | "ai_suggested"
  | "system_derived";

const productFields: Record<string, string> = {
  consumerPrice: "consumer_price",
  currency: "currency",
  reviewVolume: "review_volume",
  reviewQualitySummary: "review_quality_summary",
  salesEvidenceSummary: "sales_evidence_summary",
  trendDirection: "trend_direction",
  repeatPurchaseHypothesis: "repeat_purchase_hypothesis",
  differentiation: "differentiation",
  physicalRetailPresence: "physical_retail_presence",
  packagingReadiness: "packaging_readiness",
  wholesaleReadiness: "wholesale_readiness",
  inventoryNotes: "inventory_notes",
  fulfillmentNotes: "fulfillment_notes",
  returnsNotes: "returns_notes",
  monitoringStatus: "monitoring_status"
};

const brandFields: Record<string, string> = {
  ownershipSummary: "ownership_summary",
  wholesaleStatus: "wholesale_status",
  distributionSummary: "distribution_summary",
  operationsSummary: "operations_summary",
  inventoryCapability: "inventory_capability",
  fulfillmentNotes: "fulfillment_notes",
  communicationCondition: "communication_condition",
  communicationRationale: "communication_rationale",
  contactPurpose: "contact_purpose",
  stopFlag: "stop_flag"
};

const businessFields: Record<string, string> = {
  locations: "locations",
  assortmentSummary: "assortment_summary",
  targetCustomerSummary: "target_customer_summary",
  pricePositioning: "price_positioning",
  currentVendorsSummary: "current_vendors_summary",
  geography: "geography",
  fitRationale: "fit_rationale"
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function verifyEvidence(
  database: Database | Transaction,
  workspaceId: string,
  subjectType: "product" | "brand" | "business",
  subjectId: string,
  evidenceIds: string[]
): Promise<void> {
  if (evidenceIds.length === 0) {
    throw new AppError(422, "field_evidence_required", "Every changed intelligence field requires supporting evidence or an Unknown record.");
  }
  const result = await database.query<{ id: string }>(
    `SELECT id FROM evidence_records
      WHERE workspace_id=$1 AND subject_type=$2 AND subject_id=$3
        AND id=ANY($4::uuid[]) AND status IN ('current','disputed')`,
    [workspaceId, subjectType, subjectId, evidenceIds]
  );
  if (result.rowCount !== new Set(evidenceIds).size) {
    throw new AppError(422, "field_evidence_invalid", "One or more evidence links are unavailable for this record.");
  }
}

async function updateIntelligenceFields(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    subjectType: "product" | "brand" | "business";
    subjectId: string;
    version: number;
    changes: Record<string, unknown>;
    evidenceByField: Record<string, string[]>;
    origin: Exclude<EvidenceOrigin, "ai_suggested" | "system_derived">;
  }
): Promise<Record<string, unknown>> {
  const definition =
    input.subjectType === "product"
      ? { table: "products", fields: productFields }
      : input.subjectType === "brand"
        ? { table: "brands", fields: brandFields }
        : { table: "businesses", fields: businessFields };
  const changes = Object.entries(input.changes).filter(([field]) => field in definition.fields);
  if (changes.length === 0) throw new AppError(422, "no_changes", "No intelligence changes were supplied.");
  return withTransaction(database, async (transaction) => {
    const before = await getCoreRecord(transaction, input.workspaceId, input.subjectType, input.subjectId);
    if (!before) throw new AppError(404, "record_not_found", "Record not found.");
    for (const [field] of changes) {
      await verifyEvidence(
        transaction,
        input.workspaceId,
        input.subjectType,
        input.subjectId,
        input.evidenceByField[field] ?? []
      );
    }
    const values: unknown[] = [input.workspaceId, input.subjectId, input.version];
    const sets = changes.map(([field, value]) => {
      values.push(value);
      return `${definition.fields[field]}=$${values.length}`;
    });
    const result = await transaction.query(
      `UPDATE ${definition.table}
          SET ${sets.join(",")},last_reviewed_at=now(),version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND version=$3 AND archived_at IS NULL`,
      values
    );
    if (result.rowCount !== 1) {
      throw new AppError(409, "version_conflict", "The record changed. Reload and reconcile before saving.");
    }
    for (const [field] of changes) {
      for (const evidenceId of new Set(input.evidenceByField[field])) {
        await transaction.query(
          `INSERT INTO intelligence_field_evidence
            (id,workspace_id,subject_type,subject_id,field_name,evidence_id,origin,linked_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT(workspace_id,subject_type,subject_id,field_name,evidence_id) DO NOTHING`,
          [
            newId(),
            input.workspaceId,
            input.subjectType,
            input.subjectId,
            field,
            evidenceId,
            input.origin,
            input.actorUserId
          ]
        );
      }
    }
    const after = await transaction.query<Record<string, unknown>>(
      `SELECT * FROM ${definition.table} WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, input.subjectId]
    );
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
       VALUES($1,$2,'intelligence_updated',$3,$4,$5,'Intelligence fields updated','completed',$6)`,
      [newId(), input.workspaceId, input.actorUserId, input.subjectType, input.subjectId, { fields: changes.map(([field]) => field) }]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: `${input.subjectType}.intelligence_updated`,
      targetType: input.subjectType,
      targetId: input.subjectId,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      before,
      after: after.rows[0],
      metadata: { fields: changes.map(([field]) => field), origin: input.origin }
    });
    return after.rows[0] ?? {};
  });
}

export const updateProductIntelligence = updateIntelligenceFields;
export const updateBrandIntelligence = updateIntelligenceFields;
export const updateBusinessIntelligence = updateIntelligenceFields;

export async function listProductIntelligence(
  database: Database,
  input: {
    workspaceId: string;
    view: "discover" | "watchlist" | "under_review" | "qualified" | "rejected" | "represented" | "recently_updated";
    query?: string;
    category?: string;
    brandId?: string;
    confidence?: string;
    risk?: string;
    readiness?: string;
    limit: number;
    offset: number;
  }
): Promise<{ products: Record<string, unknown>[]; total: number }> {
  const values: unknown[] = [input.workspaceId];
  const conditions = ["p.workspace_id=$1", "p.archived_at IS NULL"];
  if (input.view === "recently_updated") conditions.push("p.updated_at >= now()-interval '30 days'");
  else conditions.push(`p.status=$${values.push(input.view === "discover" ? "discovered" : input.view)}`);
  if (input.query) conditions.push(`p.name ILIKE '%'||$${values.push(input.query)}||'%'`);
  if (input.category) conditions.push(`p.category=$${values.push(input.category)}`);
  if (input.brandId) conditions.push(`p.brand_id=$${values.push(input.brandId)}`);
  if (input.readiness) conditions.push(`p.wholesale_readiness=$${values.push(input.readiness)}`);
  if (input.risk) {
    conditions.push(
      `EXISTS (SELECT 1 FROM risk_flags r WHERE r.workspace_id=p.workspace_id
        AND r.subject_type='product' AND r.subject_id=p.id AND r.status IN ('open','reviewing')
        AND r.severity=$${values.push(input.risk)})`
    );
  }
  if (input.confidence) {
    conditions.push(
      `(SELECT min(CASE e.confidence WHEN 'insufficient' THEN 1 WHEN 'limited' THEN 2
                  WHEN 'supported' THEN 3 WHEN 'strong' THEN 4 END)
          FROM evidence_records e WHERE e.workspace_id=p.workspace_id
            AND e.subject_type='product' AND e.subject_id=p.id AND e.status='current')
       = CASE $${values.push(input.confidence)} WHEN 'insufficient' THEN 1 WHEN 'limited' THEN 2
           WHEN 'supported' THEN 3 WHEN 'strong' THEN 4 END`
    );
  }
  const where = conditions.join(" AND ");
  const count = await database.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM products p WHERE ${where}`,
    values
  );
  values.push(input.limit, input.offset);
  const result = await database.query(
    `SELECT p.id,p.name,p.category,p.status,p.identity_status AS "identityStatus",
            p.wholesale_readiness AS "wholesaleReadiness",
            p.packaging_readiness AS "packagingReadiness",
            p.trend_direction AS "trendDirection",
            p.physical_retail_presence AS "physicalRetailPresence",
            p.consumer_price::text AS "consumerPrice",p.currency,p.review_volume AS "reviewVolume",
            p.monitoring_status AS "monitoringStatus",p.last_reviewed_at AS "lastReviewedAt",
            p.updated_at AS "updatedAt",p.version,b.id AS "brandId",b.public_name AS "brandName",
            coalesce((SELECT min(CASE e.confidence WHEN 'insufficient' THEN 1 WHEN 'limited' THEN 2
                      WHEN 'supported' THEN 3 WHEN 'strong' THEN 4 END)
              FROM evidence_records e WHERE e.workspace_id=p.workspace_id
                AND e.subject_type='product' AND e.subject_id=p.id AND e.status='current'),0) AS "confidenceLevel",
            (SELECT count(*)::int FROM evidence_records e WHERE e.workspace_id=p.workspace_id
              AND e.subject_type='product' AND e.subject_id=p.id AND e.status='current'
              AND e.evidence_class='unknown') AS "unknownCount",
            (SELECT count(*)::int FROM risk_flags r WHERE r.workspace_id=p.workspace_id
              AND r.subject_type='product' AND r.subject_id=p.id AND r.status IN ('open','reviewing')
              AND r.severity IN ('high','critical')) AS "criticalRiskCount",
            t.title AS "nextAction",t.due_at AS "nextActionDueAt"
       FROM products p JOIN brands b ON b.workspace_id=p.workspace_id AND b.id=p.brand_id
       LEFT JOIN tasks t ON t.workspace_id=p.workspace_id AND t.id=p.next_action_task_id
      WHERE ${where}
      ORDER BY p.updated_at DESC,p.id
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { products: result.rows as Record<string, unknown>[], total: count.rows[0]?.count ?? 0 };
}

export async function getProductIntelligence(
  database: Database,
  workspaceId: string,
  productId: string
): Promise<Record<string, unknown>> {
  const result = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT p.*,b.public_name AS brand_name,b.pipeline_stage AS brand_pipeline_stage,
            b.identity_status AS brand_identity_status
       FROM products p JOIN brands b ON b.workspace_id=p.workspace_id AND b.id=p.brand_id
      WHERE p.workspace_id=$1 AND p.id=$2 AND p.archived_at IS NULL`,
    [workspaceId, productId]
  );
  if (!result) throw new AppError(404, "product_not_found", "Product not found.");
  const [evidence, links, risks, decisions, observations, recommendations, matches] = await Promise.all([
    database.query<{ evidenceClass: string }>(
      `SELECT e.id,e.exact_claim AS "exactClaim",e.evidence_class AS "evidenceClass",
              e.verification_status AS "verificationStatus",e.confidence,e.supports,
              e.does_not_support AS "doesNotSupport",e.unknown_reason AS "unknownReason",
              e.limitations,e.contrary_evidence AS "contraryEvidence",e.observed_at AS "observedAt",
              e.reassess_at AS "reassessAt",e.status,s.reference AS "sourceReference",s.url AS "sourceUrl"
         FROM evidence_records e LEFT JOIN sources s
           ON s.workspace_id=e.workspace_id AND s.id=e.source_id
        WHERE e.workspace_id=$1 AND e.subject_type='product' AND e.subject_id=$2
        ORDER BY e.reviewed_at DESC`,
      [workspaceId, productId]
    ),
    database.query(
      `SELECT field_name AS "fieldName",evidence_id AS "evidenceId",origin,linked_at AS "linkedAt"
         FROM intelligence_field_evidence
        WHERE workspace_id=$1 AND subject_type='product' AND subject_id=$2`,
      [workspaceId, productId]
    ),
    database.query(
      `SELECT id,risk_type AS "riskType",severity,status,description,mitigation,due_at AS "dueAt"
         FROM risk_flags WHERE workspace_id=$1 AND subject_type='product' AND subject_id=$2
        ORDER BY created_at DESC`,
      [workspaceId, productId]
    ),
    database.query(
      `SELECT id,question,outcome,rationale,confidence,status,decided_at AS "decidedAt",
              next_action AS "nextAction"
         FROM decision_records WHERE workspace_id=$1 AND subject_type='product' AND subject_id=$2
        ORDER BY created_at DESC`,
      [workspaceId, productId]
    ),
    database.query(
      `SELECT id,metric_code AS "metricCode",value,unit,evidence_class AS "evidenceClass",
              confidence,unknown_reason AS "unknownReason",observed_at AS "observedAt",
              geography,acquisition_context AS "acquisitionContext",limitations,status,origin
         FROM intelligence_observations
        WHERE workspace_id=$1 AND subject_type='product' AND subject_id=$2
        ORDER BY created_at DESC`,
      [workspaceId, productId]
    ),
    database.query(
      `SELECT id,buyer_category AS "buyerCategory",rationale,confidence,evidence_ids AS "evidenceIds",
              missing_evidence AS "missingEvidence",contrary_evidence AS "contraryEvidence",
              origin,status,reviewed_at AS "reviewedAt",version
         FROM product_buyer_category_recommendations
        WHERE workspace_id=$1 AND product_id=$2 AND status<>'superseded' ORDER BY created_at DESC`,
      [workspaceId, productId]
    ),
    database.query(
      `SELECT m.id,m.business_id AS "businessId",b.name AS "businessName",m.context,m.rationale,
              m.confidence,m.material_statements AS "materialStatements",
              m.evidence_ids AS "evidenceIds",m.missing_evidence AS "missingEvidence",
              m.contrary_evidence AS "contraryEvidence",m.origin,m.status,m.version
         FROM product_business_match_reviews m JOIN businesses b
           ON b.workspace_id=m.workspace_id AND b.id=m.business_id
        WHERE m.workspace_id=$1 AND m.product_id=$2 AND m.status<>'superseded'
        ORDER BY m.updated_at DESC`,
      [workspaceId, productId]
    )
  ]);
  return {
    product: result,
    evidence: evidence.rows,
    fieldEvidence: links.rows,
    risks: risks.rows,
    decisions: decisions.rows,
    observations: observations.rows,
    recommendations: recommendations.rows,
    matches: matches.rows,
    unsupportedClaims: evidence.rows.filter((item) =>
      ["weak_proxy", "estimate", "assumption", "model_generated_inference"].includes(String(item.evidenceClass))
    ),
    unknowns: evidence.rows.filter((item) => item.evidenceClass === "unknown")
  };
}

async function requireIssuedDecision(
  database: Database | Transaction,
  input: {
    workspaceId: string;
    subjectType: string;
    subjectId: string;
    decisionId: string;
    actorUserId: string;
  }
): Promise<void> {
  const decision = await database.query(
    `SELECT id FROM decision_records WHERE id=$1 AND workspace_id=$2
      AND subject_type=$3 AND subject_id=$4 AND owner_user_id=$5 AND status='issued'`,
    [input.decisionId, input.workspaceId, input.subjectType, input.subjectId, input.actorUserId]
  );
  if (!decision.rows[0]) {
    throw new AppError(422, "human_decision_required", "An issued decision owned by the current reviewer is required.");
  }
}

export async function transitionProductStatus(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    productId: string;
    version: number;
    toStatus: "watchlist" | "under_review" | "qualified" | "rejected" | "represented";
    decisionId: string;
    nextActionTaskId?: string | null;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const product = await oneOrNone<Record<string, unknown>>(
      transaction,
      "SELECT * FROM products WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL FOR UPDATE",
      [input.workspaceId, input.productId]
    );
    if (!product) throw new AppError(404, "product_not_found", "Product not found.");
    await requireIssuedDecision(transaction, {
      workspaceId: input.workspaceId,
      subjectType: "product",
      subjectId: input.productId,
      decisionId: input.decisionId,
      actorUserId: input.actorUserId
    });
    if (input.toStatus === "represented") {
      const authority = await validateCurrentAuthority(transaction, {
        workspaceId: input.workspaceId,
        brandId: String(product.brand_id),
        productIds: [input.productId]
      });
      if (authority.outcome !== "authorized") {
        throw new AppError(
          409,
          "representation_agreement_required",
          `Represented status requires current approved Agreement coverage: ${authority.reasonCodes.join(", ")}.`
        );
      }
    }
    if (input.toStatus === "qualified") {
      const evidence = await transaction.query<{ count: number; unknowns: number }>(
        `SELECT count(*)::int AS count,
                count(*) FILTER (WHERE evidence_class='unknown')::int AS unknowns
           FROM evidence_records WHERE workspace_id=$1 AND subject_type='product'
            AND subject_id=$2 AND status='current'`,
        [input.workspaceId, input.productId]
      );
      if ((evidence.rows[0]?.count ?? 0) === 0) {
        throw new AppError(422, "qualification_evidence_required", "Product qualification requires classified evidence.");
      }
      if (!product.wholesale_readiness || product.wholesale_readiness === "not_reviewed") {
        throw new AppError(422, "readiness_review_required", "Wholesale readiness must be reviewed before qualification.");
      }
    }
    if (input.toStatus !== "rejected" && !input.nextActionTaskId) {
      throw new AppError(422, "next_action_required", "A linked next action is required.");
    }
    if (input.nextActionTaskId) {
      const task = await transaction.query(
        "SELECT id FROM tasks WHERE workspace_id=$1 AND id=$2 AND subject_type='product' AND subject_id=$3",
        [input.workspaceId, input.nextActionTaskId, input.productId]
      );
      if (!task.rows[0]) throw new AppError(422, "next_action_invalid", "Next action must belong to this Product.");
    }
    const updated = await transaction.query<Record<string, unknown>>(
      `UPDATE products SET status=$4,qualification_decision_id=$5,next_action_task_id=$6,
              last_reviewed_at=now(),version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND version=$3
        RETURNING *`,
      [input.workspaceId, input.productId, input.version, input.toStatus, input.decisionId, input.nextActionTaskId ?? null]
    );
    if (!updated.rows[0]) throw new AppError(409, "version_conflict", "Product changed. Reload before deciding.");
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
       VALUES($1,$2,'product_status_changed',$3,'product',$4,$5,'completed',$6)`,
      [newId(), input.workspaceId, input.actorUserId, input.productId, `Product moved to ${input.toStatus}`, { from: product.status, to: input.toStatus, decisionId: input.decisionId }]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: "product.status_changed",
      targetType: "product",
      targetId: input.productId,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      before: product,
      after: updated.rows[0]
    });
    return updated.rows[0];
  });
}

export async function transitionBrandStage(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    brandId: string;
    version: number;
    toStage:
      | "researching"
      | "contact_ready"
      | "contacted"
      | "conversation"
      | "reviewing_terms"
      | "authorized"
      | "active"
      | "paused"
      | "ended"
      | "rejected";
    reason: string;
    decisionId: string;
    nextActionTaskId?: string | null;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const brand = await oneOrNone<Record<string, unknown>>(
      transaction,
      "SELECT * FROM brands WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL FOR UPDATE",
      [input.workspaceId, input.brandId]
    );
    if (!brand) throw new AppError(404, "brand_not_found", "Brand not found.");
    await requireIssuedDecision(transaction, {
      workspaceId: input.workspaceId,
      subjectType: "brand",
      subjectId: input.brandId,
      decisionId: input.decisionId,
      actorUserId: input.actorUserId
    });
    if (["authorized", "active"].includes(input.toStage)) {
      const products = await transaction.query<{ id: string }>(
        `SELECT id FROM products WHERE workspace_id=$1 AND brand_id=$2
          AND archived_at IS NULL`,
        [input.workspaceId, input.brandId]
      );
      if (products.rows.length === 0) {
        throw new AppError(
          409,
          "representation_agreement_required",
          "Authorized and Active require an approved Agreement with at least one scoped Product."
        );
      }
      const authorized = [];
      for (const product of products.rows) {
        const authority = await validateCurrentAuthority(transaction, {
          workspaceId: input.workspaceId,
          brandId: input.brandId,
          productIds: [product.id]
        });
        if (authority.outcome === "authorized") authorized.push(product.id);
      }
      if (authorized.length === 0) {
        throw new AppError(
          409,
          "representation_agreement_required",
          "Authorized and Active require a current human-approved Agreement covering at least one Product."
        );
      }
    }
    if (["contacted", "conversation", "reviewing_terms"].includes(input.toStage)) {
      throw new AppError(
        409,
        "later_workflow_required",
        "This stage requires outreach or agreement workflow that is not yet authorized."
      );
    }
    if (input.toStage === "contact_ready") {
      const contact = await transaction.query(
          `SELECT id FROM contacts WHERE workspace_id=$1 AND brand_id=$2 AND archived_at IS NULL
            AND (email IS NOT NULL OR phone IS NOT NULL)
            AND verification_status IN ('verified','stale') LIMIT 1`,
          [input.workspaceId, input.brandId]
        );
      const evidence = await transaction.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM evidence_records
            WHERE workspace_id=$1 AND subject_type='brand' AND subject_id=$2 AND status='current'`,
          [input.workspaceId, input.brandId]
        );
      const risks = await transaction.query(
          `SELECT id FROM risk_flags WHERE workspace_id=$1 AND subject_type='brand' AND subject_id=$2
            AND status IN ('open','reviewing') AND severity IN ('high','critical') LIMIT 1`,
          [input.workspaceId, input.brandId]
        );
      if (!["reviewing", "verified"].includes(String(brand.identity_status))) {
        throw new AppError(422, "brand_identity_required", "Brand identity must be reviewing or verified.");
      }
      if (!String(brand.contact_purpose).trim()) {
        throw new AppError(422, "contact_purpose_required", "A legitimate professional contact purpose is required.");
      }
      if (brand.stop_flag === true) throw new AppError(409, "brand_stop_flag", "A Brand stop flag blocks Contact Ready.");
      if (!contact.rows[0]) throw new AppError(422, "verified_contact_required", "A sourced professional Contact route is required.");
      if (Number(evidence.rows[0]?.count ?? 0) === 0) {
        throw new AppError(422, "brand_evidence_required", "Brand diligence evidence is required.");
      }
      if (risks.rows[0]) throw new AppError(409, "blocking_risk", "Resolve high or critical Brand risks first.");
    }
    if (input.toStage !== "rejected" && !input.nextActionTaskId) {
      throw new AppError(422, "next_action_required", "A linked next action is required.");
    }
    if (input.nextActionTaskId) {
      const task = await transaction.query(
        "SELECT id FROM tasks WHERE workspace_id=$1 AND id=$2 AND subject_type='brand' AND subject_id=$3",
        [input.workspaceId, input.nextActionTaskId, input.brandId]
      );
      if (!task.rows[0]) throw new AppError(422, "next_action_invalid", "Next action must belong to this Brand.");
    }
    const updated = await transaction.query<Record<string, unknown>>(
      `UPDATE brands SET pipeline_stage=$4,qualification_decision_id=$5,
              next_action_task_id=$6,last_reviewed_at=now(),version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.brandId, input.version, input.toStage, input.decisionId, input.nextActionTaskId ?? null]
    );
    if (!updated.rows[0]) throw new AppError(409, "version_conflict", "Brand changed. Reload before deciding.");
    await transaction.query(
      `INSERT INTO brand_stage_events
        (id,workspace_id,brand_id,from_stage,to_stage,reason,decision_id,actor_user_id,request_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [newId(), input.workspaceId, input.brandId, brand.pipeline_stage, input.toStage, input.reason, input.decisionId, input.actorUserId, input.requestId]
    );
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
       VALUES($1,$2,'brand_stage_changed',$3,'brand',$4,$5,'completed',$6)`,
      [newId(), input.workspaceId, input.actorUserId, input.brandId, `Brand moved to ${input.toStage}`, { from: brand.pipeline_stage, to: input.toStage, decisionId: input.decisionId }]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: "brand.pipeline_stage_changed",
      targetType: "brand",
      targetId: input.brandId,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      before: brand,
      after: updated.rows[0],
      metadata: { reason: input.reason }
    });
    return updated.rows[0];
  });
}

export async function listBrandIntelligence(
  database: Database,
  input: {
    workspaceId: string;
    stage?: string;
    query?: string;
    wholesaleStatus?: string;
    risk?: string;
    limit: number;
    offset: number;
  }
): Promise<{ brands: Record<string, unknown>[]; total: number }> {
  const values: unknown[] = [input.workspaceId];
  const conditions = ["b.workspace_id=$1", "b.archived_at IS NULL"];
  if (input.stage) conditions.push(`b.pipeline_stage=$${values.push(input.stage)}`);
  if (input.query) conditions.push(`b.public_name ILIKE '%'||$${values.push(input.query)}||'%'`);
  if (input.wholesaleStatus) conditions.push(`b.wholesale_status=$${values.push(input.wholesaleStatus)}`);
  if (input.risk) {
    conditions.push(
      `EXISTS (SELECT 1 FROM risk_flags r WHERE r.workspace_id=b.workspace_id
        AND r.subject_type='brand' AND r.subject_id=b.id AND r.status IN ('open','reviewing')
        AND r.severity=$${values.push(input.risk)})`
    );
  }
  const where = conditions.join(" AND ");
  const count = await database.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM brands b WHERE ${where}`,
    values
  );
  values.push(input.limit, input.offset);
  const result = await database.query(
    `SELECT b.id,b.public_name AS name,b.legal_name AS "legalName",b.identity_status AS "identityStatus",
            b.pipeline_stage AS "pipelineStage",b.wholesale_status AS "wholesaleStatus",
            b.inventory_capability AS "inventoryCapability",
            b.communication_condition AS "communicationCondition",
            b.representation_status AS "representationStatus",b.stop_flag AS "stopFlag",
            b.last_reviewed_at AS "lastReviewedAt",b.updated_at AS "updatedAt",b.version,
            (SELECT count(*)::int FROM products p WHERE p.workspace_id=b.workspace_id
              AND p.brand_id=b.id AND p.archived_at IS NULL) AS "productCount",
            (SELECT count(*)::int FROM risk_flags r WHERE r.workspace_id=b.workspace_id
              AND r.subject_type='brand' AND r.subject_id=b.id
              AND r.status IN ('open','reviewing')) AS "riskCount",
            t.title AS "nextAction",t.due_at AS "nextActionDueAt"
       FROM brands b LEFT JOIN tasks t
         ON t.workspace_id=b.workspace_id AND t.id=b.next_action_task_id
      WHERE ${where} ORDER BY b.updated_at DESC,b.id
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { brands: result.rows as Record<string, unknown>[], total: count.rows[0]?.count ?? 0 };
}

export async function getBrandIntelligence(
  database: Database,
  workspaceId: string,
  brandId: string
): Promise<Record<string, unknown>> {
  const brand = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT b.*,t.title AS next_action,t.due_at AS next_action_due_at
       FROM brands b LEFT JOIN tasks t ON t.workspace_id=b.workspace_id AND t.id=b.next_action_task_id
      WHERE b.workspace_id=$1 AND b.id=$2 AND b.archived_at IS NULL`,
    [workspaceId, brandId]
  );
  if (!brand) throw new AppError(404, "brand_not_found", "Brand not found.");
  const [products, contacts, evidence, links, risks, decisions, events] = await Promise.all([
    database.query(
      `SELECT id,name,category,status,wholesale_readiness AS "wholesaleReadiness",
              last_reviewed_at AS "lastReviewedAt"
         FROM products WHERE workspace_id=$1 AND brand_id=$2 AND archived_at IS NULL
        ORDER BY updated_at DESC`,
      [workspaceId, brandId]
    ),
    database.query(
      `SELECT id,name,role,email,phone,verification_status AS "verificationStatus",
              permission_status AS "permissionStatus",source_id AS "sourceId",
              last_verified_at AS "lastVerifiedAt",source_observed_at AS "sourceObservedAt"
         FROM contacts WHERE workspace_id=$1 AND brand_id=$2 AND archived_at IS NULL ORDER BY name`,
      [workspaceId, brandId]
    ),
    database.query<{ evidenceClass: string }>(
      `SELECT e.id,e.exact_claim AS "exactClaim",e.evidence_class AS "evidenceClass",
              e.confidence,e.unknown_reason AS "unknownReason",e.limitations,e.status,
              e.observed_at AS "observedAt",e.reassess_at AS "reassessAt",
              s.reference AS "sourceReference",s.url AS "sourceUrl"
         FROM evidence_records e LEFT JOIN sources s
           ON s.workspace_id=e.workspace_id AND s.id=e.source_id
        WHERE e.workspace_id=$1 AND e.subject_type='brand' AND e.subject_id=$2
        ORDER BY e.reviewed_at DESC`,
      [workspaceId, brandId]
    ),
    database.query(
      `SELECT field_name AS "fieldName",evidence_id AS "evidenceId",origin,linked_at AS "linkedAt"
         FROM intelligence_field_evidence
        WHERE workspace_id=$1 AND subject_type='brand' AND subject_id=$2`,
      [workspaceId, brandId]
    ),
    database.query(
      `SELECT id,risk_type AS "riskType",severity,status,description,mitigation
         FROM risk_flags WHERE workspace_id=$1 AND subject_type='brand' AND subject_id=$2
        ORDER BY created_at DESC`,
      [workspaceId, brandId]
    ),
    database.query(
      `SELECT id,question,outcome,rationale,confidence,status,decided_at AS "decidedAt"
         FROM decision_records WHERE workspace_id=$1 AND subject_type='brand' AND subject_id=$2
        ORDER BY created_at DESC`,
      [workspaceId, brandId]
    ),
    database.query(
      `SELECT id,from_stage AS "fromStage",to_stage AS "toStage",reason,
              decision_id AS "decisionId",actor_user_id AS "actorUserId",occurred_at AS "occurredAt"
         FROM brand_stage_events WHERE workspace_id=$1 AND brand_id=$2 ORDER BY occurred_at DESC`,
      [workspaceId, brandId]
    )
  ]);
  return {
    brand,
    products: products.rows,
    contacts: contacts.rows,
    evidence: evidence.rows,
    fieldEvidence: links.rows,
    risks: risks.rows,
    decisions: decisions.rows,
    stageEvents: events.rows,
    unknowns: evidence.rows.filter((item) => item.evidenceClass === "unknown"),
    unsupportedClaims: evidence.rows.filter((item) =>
      ["weak_proxy", "estimate", "assumption", "model_generated_inference"].includes(String(item.evidenceClass))
    ),
    authority: {
      status: "not_established",
      reason: "A current verified Representation Agreement is required before authority exists."
    }
  };
}

export async function listBusinessIntelligence(
  database: Database,
  input: {
    workspaceId: string;
    query?: string;
    businessType?: string;
    category?: string;
    qualificationStatus?: string;
    geography?: string;
    buyerVerification?: string;
    limit: number;
    offset: number;
  }
): Promise<{ businesses: Record<string, unknown>[]; total: number }> {
  const values: unknown[] = [input.workspaceId];
  const conditions = ["b.workspace_id=$1", "b.archived_at IS NULL"];
  if (input.query) conditions.push(`b.name ILIKE '%'||$${values.push(input.query)}||'%'`);
  if (input.businessType) conditions.push(`b.business_type=$${values.push(input.businessType)}`);
  if (input.category) conditions.push(`b.category=$${values.push(input.category)}`);
  if (input.qualificationStatus) conditions.push(`b.qualification_status=$${values.push(input.qualificationStatus)}`);
  if (input.geography) conditions.push(`b.geography::text ILIKE '%'||$${values.push(input.geography)}||'%'`);
  if (input.buyerVerification) {
    conditions.push(
      `EXISTS (SELECT 1 FROM business_buyers bb WHERE bb.workspace_id=b.workspace_id
        AND bb.business_id=b.id AND bb.verification_status=$${values.push(input.buyerVerification)})`
    );
  }
  const where = conditions.join(" AND ");
  const count = await database.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM businesses b WHERE ${where}`,
    values
  );
  values.push(input.limit, input.offset);
  const result = await database.query(
    `SELECT b.id,b.name,b.business_type AS "businessType",b.category,b.website,b.geography,
            b.locations,b.assortment_summary AS "assortmentSummary",
            b.target_customer_summary AS "targetCustomerSummary",
            b.price_positioning AS "pricePositioning",
            b.qualification_status AS "qualificationStatus",
            b.conflict_status AS "conflictStatus",b.conflict_rationale AS "conflictRationale",
            b.fit_rationale AS "fitRationale",b.last_reviewed_at AS "lastReviewedAt",
            b.updated_at AS "updatedAt",b.version,
            (SELECT count(*)::int FROM contacts c WHERE c.workspace_id=b.workspace_id
              AND c.business_id=b.id AND c.archived_at IS NULL) AS "contactCount",
            (SELECT count(*)::int FROM business_buyers bb WHERE bb.workspace_id=b.workspace_id
              AND bb.business_id=b.id AND bb.verification_status='verified') AS "verifiedBuyerCount",
            (SELECT count(*)::int FROM risk_flags r WHERE r.workspace_id=b.workspace_id
              AND r.subject_type='business' AND r.subject_id=b.id
              AND r.status IN ('open','reviewing')) AS "riskCount",
            t.title AS "nextAction"
       FROM businesses b LEFT JOIN tasks t
         ON t.workspace_id=b.workspace_id AND t.id=b.next_action_task_id
      WHERE ${where} ORDER BY b.updated_at DESC,b.id
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { businesses: result.rows as Record<string, unknown>[], total: count.rows[0]?.count ?? 0 };
}

export async function getBusinessIntelligence(
  database: Database,
  workspaceId: string,
  businessId: string
): Promise<Record<string, unknown>> {
  const business = await oneOrNone<Record<string, unknown>>(
    database,
    "SELECT * FROM businesses WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL",
    [workspaceId, businessId]
  );
  if (!business) throw new AppError(404, "business_not_found", "Business not found.");
  const [contacts, buyers, evidence, links, risks, decisions, matches] = await Promise.all([
    database.query(
      `SELECT id,name,role,email,phone,professional_handle AS "professionalHandle",
              verification_status AS "verificationStatus",permission_status AS "permissionStatus",
              source_id AS "sourceId",last_verified_at AS "lastVerifiedAt",
              source_observed_at AS "sourceObservedAt"
         FROM contacts WHERE workspace_id=$1 AND business_id=$2 AND archived_at IS NULL ORDER BY name`,
      [workspaceId, businessId]
    ),
    database.query(
      `SELECT bb.id,bb.contact_id AS "contactId",c.name,bb.buyer_role AS "buyerRole",
              bb.decision_context AS "decisionContext",bb.authority_evidence AS "authorityEvidence",
              bb.authority_evidence_id AS "authorityEvidenceId",
              bb.stated_needs AS "statedNeeds",bb.buying_window AS "buyingWindow",
              bb.decision_process AS "decisionProcess",
              bb.verification_status AS "verificationStatus",bb.verified_at AS "verifiedAt",bb.version
         FROM business_buyers bb JOIN contacts c
           ON c.workspace_id=bb.workspace_id AND c.id=bb.contact_id
        WHERE bb.workspace_id=$1 AND bb.business_id=$2 ORDER BY c.name`,
      [workspaceId, businessId]
    ),
    database.query<{ evidenceClass: string }>(
      `SELECT e.id,e.exact_claim AS "exactClaim",e.evidence_class AS "evidenceClass",
              e.confidence,e.unknown_reason AS "unknownReason",e.limitations,e.status,
              e.observed_at AS "observedAt",s.reference AS "sourceReference"
         FROM evidence_records e LEFT JOIN sources s
           ON s.workspace_id=e.workspace_id AND s.id=e.source_id
        WHERE e.workspace_id=$1 AND e.subject_type='business' AND e.subject_id=$2
        ORDER BY e.reviewed_at DESC`,
      [workspaceId, businessId]
    ),
    database.query(
      `SELECT field_name AS "fieldName",evidence_id AS "evidenceId",origin
         FROM intelligence_field_evidence
        WHERE workspace_id=$1 AND subject_type='business' AND subject_id=$2`,
      [workspaceId, businessId]
    ),
    database.query(
      `SELECT id,risk_type AS "riskType",severity,status,description,mitigation
         FROM risk_flags WHERE workspace_id=$1 AND subject_type='business' AND subject_id=$2
        ORDER BY created_at DESC`,
      [workspaceId, businessId]
    ),
    database.query(
      `SELECT id,question,outcome,rationale,confidence,status,decided_at AS "decidedAt"
         FROM decision_records WHERE workspace_id=$1 AND subject_type='business' AND subject_id=$2
        ORDER BY created_at DESC`,
      [workspaceId, businessId]
    ),
    database.query(
      `SELECT m.id,m.product_id AS "productId",p.name AS "productName",br.public_name AS "brandName",
              m.context,m.rationale,m.confidence,m.material_statements AS "materialStatements",
              m.evidence_ids AS "evidenceIds",m.missing_evidence AS "missingEvidence",
              m.contrary_evidence AS "contraryEvidence",m.origin,m.status,m.version
         FROM product_business_match_reviews m JOIN products p
           ON p.workspace_id=m.workspace_id AND p.id=m.product_id
         JOIN brands br ON br.workspace_id=p.workspace_id AND br.id=p.brand_id
        WHERE m.workspace_id=$1 AND m.business_id=$2 AND m.status<>'superseded'
        ORDER BY m.updated_at DESC`,
      [workspaceId, businessId]
    )
  ]);
  return {
    business,
    contacts: contacts.rows,
    buyers: buyers.rows,
    evidence: evidence.rows,
    fieldEvidence: links.rows,
    risks: risks.rows,
    decisions: decisions.rows,
    matches: matches.rows,
    unknowns: evidence.rows.filter((item) => item.evidenceClass === "unknown"),
    conflictScope: "Current Ryva workspace records only; recheck before any Opportunity or outreach."
  };
}

export async function transitionBusinessQualification(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    businessId: string;
    version: number;
    toStatus: "researching" | "qualified" | "conditional" | "rejected";
    decisionId: string;
    nextActionTaskId?: string | null;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const business = await oneOrNone<Record<string, unknown>>(
      transaction,
      "SELECT * FROM businesses WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL FOR UPDATE",
      [input.workspaceId, input.businessId]
    );
    if (!business) throw new AppError(404, "business_not_found", "Business not found.");
    await requireIssuedDecision(transaction, {
      workspaceId: input.workspaceId,
      subjectType: "business",
      subjectId: input.businessId,
      decisionId: input.decisionId,
      actorUserId: input.actorUserId
    });
    if (["qualified", "conditional"].includes(input.toStatus)) {
      const contact = await transaction.query(
          `SELECT id FROM contacts WHERE workspace_id=$1 AND business_id=$2
            AND archived_at IS NULL AND verification_status IN ('verified','stale')
            AND permission_status<>'prohibited' LIMIT 1`,
          [input.workspaceId, input.businessId]
        );
      const buyer = await transaction.query(
          `SELECT bb.id FROM business_buyers bb JOIN contacts c
             ON c.workspace_id=bb.workspace_id AND c.id=bb.contact_id
            WHERE bb.workspace_id=$1 AND bb.business_id=$2
              AND bb.verification_status='verified'
              AND bb.buyer_role IN ('decision_maker','authorized_purchaser')
              AND bb.authority_evidence_id IS NOT NULL
              AND c.verification_status IN ('verified','stale')
              AND c.permission_status<>'prohibited' LIMIT 1`,
          [input.workspaceId, input.businessId]
        );
      const evidence = await transaction.query(
          `SELECT count(*)::int AS count FROM evidence_records
            WHERE workspace_id=$1 AND subject_type='business' AND subject_id=$2 AND status='current'`,
          [input.workspaceId, input.businessId]
        );
      const match = await transaction.query(
          `SELECT id FROM product_business_match_reviews WHERE workspace_id=$1 AND business_id=$2
            AND status IN ('qualified','conditional') LIMIT 1`,
          [input.workspaceId, input.businessId]
        );
      const risk = await transaction.query(
          `SELECT id FROM risk_flags WHERE workspace_id=$1 AND subject_type='business' AND subject_id=$2
            AND status IN ('open','reviewing') AND severity IN ('high','critical') LIMIT 1`,
          [input.workspaceId, input.businessId]
        );
      const requiredText = [
        business.assortment_summary,
        business.target_customer_summary,
        business.fit_rationale
      ].every((value) => text(value).trim());
      if (!requiredText || String(business.price_positioning) === "unknown") {
        throw new AppError(422, "business_profile_incomplete", "Assortment, customer, price positioning, and fit rationale are required.");
      }
      if (Number((evidence.rows[0] as { count?: number } | undefined)?.count ?? 0) === 0) {
        throw new AppError(422, "business_evidence_required", "Business qualification requires classified evidence.");
      }
      if (!contact.rows[0]) throw new AppError(422, "business_contact_required", "A sourced professional Contact is required.");
      if (input.toStatus === "qualified" && !buyer.rows[0]) {
        throw new AppError(422, "verified_buyer_required", "Full qualification requires a human-verified decision maker or authorized purchaser with linked authority evidence.");
      }
      if (!match.rows[0]) throw new AppError(422, "match_review_required", "A human-reviewed Product match is required.");
      if (risk.rows[0] && input.toStatus === "qualified") {
        throw new AppError(409, "blocking_risk", "High or critical Business risk prevents full qualification.");
      }
    }
    if (input.toStatus !== "rejected" && !input.nextActionTaskId) {
      throw new AppError(422, "next_action_required", "A linked next action is required.");
    }
    if (input.nextActionTaskId) {
      const task = await transaction.query(
        "SELECT id FROM tasks WHERE workspace_id=$1 AND id=$2 AND subject_type='business' AND subject_id=$3",
        [input.workspaceId, input.nextActionTaskId, input.businessId]
      );
      if (!task.rows[0]) throw new AppError(422, "next_action_invalid", "Next action must belong to this Business.");
    }
    const conflictStatus = input.toStatus === "qualified" ? "clear" : "not_checked";
    const conflictRationale =
      input.toStatus === "qualified"
        ? "No blocking conflict is recorded in current workspace records; recheck is mandatory before Opportunity or outreach."
        : text(business.conflict_rationale);
    const updated = await transaction.query<Record<string, unknown>>(
      `UPDATE businesses SET qualification_status=$4,
              status=CASE WHEN $4='qualified' THEN 'qualified' ELSE status END,
              conflict_status=$5,conflict_rationale=$6,qualification_decision_id=$7,
              next_action_task_id=$8,last_reviewed_at=now(),
              version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.businessId, input.version, input.toStatus, conflictStatus, conflictRationale, input.decisionId, input.nextActionTaskId ?? null]
    );
    if (!updated.rows[0]) throw new AppError(409, "version_conflict", "Business changed. Reload before deciding.");
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
       VALUES($1,$2,'business_qualification_changed',$3,'business',$4,$5,'completed',$6)`,
      [newId(), input.workspaceId, input.actorUserId, input.businessId, `Business qualification: ${input.toStatus}`, { from: business.qualification_status, to: input.toStatus, decisionId: input.decisionId }]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: "business.qualification_changed",
      targetType: "business",
      targetId: input.businessId,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      before: business,
      after: updated.rows[0]
    });
    return updated.rows[0];
  });
}

export async function createIntelligenceObservation(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    subjectType: "product" | "brand" | "business" | "contact";
    subjectId: string;
    metricCode: string;
    value: unknown;
    unit?: string | null;
    evidenceClass: string;
    confidence: string;
    sourceId?: string | null;
    unknownReason?: string | null;
    observedAt?: string | null;
    geography?: string | null;
    acquisitionContext: string;
    limitations: string;
    origin: "user_entered" | "externally_sourced" | "imported";
    supersedesId?: string | null;
  }
): Promise<Record<string, unknown>> {
  if (input.evidenceClass === "unknown" ? !input.unknownReason : !input.sourceId) {
    throw new AppError(422, "observation_provenance_required", "Observation requires a Source or an explicit Unknown reason.");
  }
  const subject = await getCoreRecord(database, input.workspaceId, input.subjectType, input.subjectId);
  if (!subject) throw new AppError(404, "record_not_found", "Record not found.");
  return withTransaction(database, async (transaction) => {
    if (input.sourceId) {
      const source = await transaction.query(
        "SELECT id FROM sources WHERE workspace_id=$1 AND id=$2 AND status<>'deleted'",
        [input.workspaceId, input.sourceId]
      );
      if (!source.rows[0]) throw new AppError(422, "source_not_found", "Observation Source was not found.");
    }
    if (input.supersedesId) {
      const prior = await transaction.query(
        `UPDATE intelligence_observations SET status='superseded'
          WHERE id=$1 AND workspace_id=$2 AND subject_type=$3 AND subject_id=$4
            AND metric_code=$5 AND status IN ('current','stale','source_unavailable')
          RETURNING id`,
        [input.supersedesId, input.workspaceId, input.subjectType, input.subjectId, input.metricCode]
      );
      if (!prior.rows[0]) throw new AppError(422, "observation_supersedes_invalid", "Prior observation could not be superseded.");
    }
    const id = newId();
    const result = await transaction.query<Record<string, unknown>>(
      `INSERT INTO intelligence_observations
        (id,workspace_id,subject_type,subject_id,metric_code,value,unit,evidence_class,
         confidence,source_id,unknown_reason,observed_at,geography,acquisition_context,
         limitations,status,supersedes_id,origin,reviewed_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'current',$16,$17,$18)
       RETURNING *`,
      [
        id, input.workspaceId, input.subjectType, input.subjectId, input.metricCode,
        JSON.stringify(input.value), input.unit ?? null, input.evidenceClass, input.confidence,
        input.sourceId ?? null, input.unknownReason ?? null, input.observedAt ?? null,
        input.geography ?? null, input.acquisitionContext, input.limitations,
        input.supersedesId ?? null, input.origin, input.actorUserId
      ]
    );
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
       VALUES($1,$2,'observation_recorded',$3,$4,$5,$6,'completed',$7)`,
      [newId(), input.workspaceId, input.actorUserId, input.subjectType, input.subjectId, `Observation: ${input.metricCode}`, { observationId: id, origin: input.origin }]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: "intelligence_observation.created",
      targetType: "intelligence_observation",
      targetId: id,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      after: result.rows[0]
    });
    return result.rows[0] ?? {};
  });
}

async function verifyMatchEvidence(
  database: Database | Transaction,
  input: {
    workspaceId: string;
    productId: string;
    businessId: string;
    evidenceIds: string[];
  }
): Promise<void> {
  if (input.evidenceIds.length === 0) {
    throw new AppError(422, "match_evidence_required", "A Product–Business match requires linked evidence.");
  }
  const result = await database.query(
    `SELECT id FROM evidence_records WHERE workspace_id=$1 AND id=ANY($2::uuid[])
      AND status IN ('current','disputed')
      AND ((subject_type='product' AND subject_id=$3) OR
           (subject_type='business' AND subject_id=$4))`,
    [input.workspaceId, input.evidenceIds, input.productId, input.businessId]
  );
  if (result.rowCount !== new Set(input.evidenceIds).size) {
    throw new AppError(422, "match_evidence_invalid", "Match evidence must belong to the selected Product or Business.");
  }
}

export async function createProductBusinessMatch(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    productId: string;
    businessId: string;
    context: Record<string, unknown>;
    contextDigest: string;
    rationale: string;
    confidence: string;
    materialStatements: Array<{ statement: string; classification: string }>;
    evidenceIds: string[];
    missingEvidence: string[];
    contraryEvidence: string;
    origin: "user_entered" | "imported";
  }
): Promise<Record<string, unknown>> {
  const [product, business] = await Promise.all([
    getCoreRecord(database, input.workspaceId, "product", input.productId),
    getCoreRecord(database, input.workspaceId, "business", input.businessId)
  ]);
  if (!product || !business) throw new AppError(404, "match_record_not_found", "Product or Business was not found.");
  await verifyMatchEvidence(database, input);
  const id = newId();
  try {
    const result = await database.query<Record<string, unknown>>(
      `INSERT INTO product_business_match_reviews
        (id,workspace_id,product_id,business_id,context,context_digest,rationale,
         confidence,material_statements,evidence_ids,missing_evidence,contrary_evidence,
         origin,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'proposed')
       RETURNING *`,
      [
        id, input.workspaceId, input.productId, input.businessId, input.context,
        input.contextDigest, input.rationale, input.confidence, JSON.stringify(input.materialStatements),
        input.evidenceIds, input.missingEvidence, input.contraryEvidence, input.origin
      ]
    );
    await recordAudit(database, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: "product_business_match.created",
      targetType: "product_business_match",
      targetId: id,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      after: result.rows[0]
    });
    return result.rows[0] ?? {};
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new AppError(409, "match_context_exists", "This Product and Business already have a review for the same context.");
    }
    throw error;
  }
}

export async function decideProductBusinessMatch(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    matchId: string;
    version: number;
    status: "under_review" | "qualified" | "conditional" | "rejected";
    decisionId: string;
    nextActionTaskId?: string | null;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const match = await oneOrNone<Record<string, unknown>>(
      transaction,
      "SELECT * FROM product_business_match_reviews WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.matchId]
    );
    if (!match) throw new AppError(404, "match_not_found", "Match review was not found.");
    await requireIssuedDecision(transaction, {
      workspaceId: input.workspaceId,
      subjectType: "business",
      subjectId: String(match.business_id),
      decisionId: input.decisionId,
      actorUserId: input.actorUserId
    });
    if (["qualified", "conditional"].includes(input.status) && !String(match.rationale).trim()) {
      throw new AppError(422, "match_rationale_required", "Human qualification requires a fit rationale.");
    }
    if (input.status !== "rejected" && !input.nextActionTaskId) {
      throw new AppError(422, "next_action_required", "A Business-owned next action is required.");
    }
    if (input.nextActionTaskId) {
      const task = await transaction.query(
        `SELECT id FROM tasks WHERE workspace_id=$1 AND id=$2
          AND subject_type='business' AND subject_id=$3`,
        [input.workspaceId, input.nextActionTaskId, match.business_id]
      );
      if (!task.rows[0]) throw new AppError(422, "next_action_invalid", "Next action must belong to this Business.");
    }
    const updated = await transaction.query<Record<string, unknown>>(
      `UPDATE product_business_match_reviews
          SET status=$4,decision_id=$5,next_action_task_id=$6,reviewed_by=$7,
              reviewed_at=now(),version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.matchId, input.version, input.status, input.decisionId, input.nextActionTaskId ?? null, input.actorUserId]
    );
    if (!updated.rows[0]) throw new AppError(409, "version_conflict", "Match review changed. Reload before deciding.");
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
       VALUES($1,$2,'product_match_decided',$3,'business',$4,$5,'completed',$6)`,
      [newId(), input.workspaceId, input.actorUserId, match.business_id, `Product match ${input.status}`, { matchId: input.matchId, productId: match.product_id, decisionId: input.decisionId }]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: "product_business_match.decided",
      targetType: "product_business_match",
      targetId: input.matchId,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      before: match,
      after: updated.rows[0]
    });
    return updated.rows[0];
  });
}

export async function createBuyerCategoryRecommendation(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    productId: string;
    buyerCategory: string;
    rationale: string;
    confidence: string;
    evidenceIds: string[];
    missingEvidence: string[];
    contraryEvidence: string;
    origin: "user_entered" | "imported";
  }
): Promise<Record<string, unknown>> {
  if (!(await getCoreRecord(database, input.workspaceId, "product", input.productId))) {
    throw new AppError(404, "product_not_found", "Product not found.");
  }
  await verifyEvidence(database, input.workspaceId, "product", input.productId, input.evidenceIds);
  const id = newId();
  const result = await database.query<Record<string, unknown>>(
    `INSERT INTO product_buyer_category_recommendations
      (id,workspace_id,product_id,buyer_category,rationale,confidence,evidence_ids,
       missing_evidence,contrary_evidence,origin,status)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'proposed') RETURNING *`,
    [
      id, input.workspaceId, input.productId, input.buyerCategory, input.rationale,
      input.confidence, input.evidenceIds, input.missingEvidence,
      input.contraryEvidence, input.origin
    ]
  );
  await recordAudit(database, {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorType: "user",
    action: "buyer_category_recommendation.created",
    targetType: "buyer_category_recommendation",
    targetId: id,
    origin: "api",
    requestId: input.requestId,
    outcome: "succeeded",
    after: result.rows[0]
  });
  return result.rows[0] ?? {};
}

export async function decideBuyerCategoryRecommendation(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    recommendationId: string;
    version: number;
    status: "confirmed" | "rejected";
  }
): Promise<Record<string, unknown>> {
  const result = await database.query<Record<string, unknown>>(
    `UPDATE product_buyer_category_recommendations
        SET status=$4,reviewed_by=$5,reviewed_at=now(),version=version+1,updated_at=now()
      WHERE workspace_id=$1 AND id=$2 AND version=$3 AND status='proposed'
      RETURNING *`,
    [input.workspaceId, input.recommendationId, input.version, input.status, input.actorUserId]
  );
  if (!result.rows[0]) throw new AppError(409, "recommendation_changed", "Recommendation is unavailable or changed.");
  await recordAudit(database, {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorType: "user",
    action: `buyer_category_recommendation.${input.status}`,
    targetType: "buyer_category_recommendation",
    targetId: input.recommendationId,
    origin: "api",
    requestId: input.requestId,
    outcome: "succeeded",
    after: result.rows[0]
  });
  return result.rows[0];
}

export async function createProductComparison(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    name: string;
    productIds: string[];
    context: Record<string, unknown>;
  }
): Promise<Record<string, unknown>> {
  if (input.productIds.length < 2 || input.productIds.length > 4 || new Set(input.productIds).size !== input.productIds.length) {
    throw new AppError(422, "comparison_product_count", "Choose two to four distinct Products.");
  }
  const products = await database.query(
    "SELECT id FROM products WHERE workspace_id=$1 AND id=ANY($2::uuid[]) AND archived_at IS NULL",
    [input.workspaceId, input.productIds]
  );
  if (products.rowCount !== input.productIds.length) {
    throw new AppError(422, "comparison_product_invalid", "One or more Products are unavailable.");
  }
  return withTransaction(database, async (transaction) => {
    const id = newId();
    await transaction.query(
      `INSERT INTO product_comparisons
        (id,workspace_id,owner_user_id,name,context,status)
       VALUES($1,$2,$3,$4,$5,'draft')`,
      [id, input.workspaceId, input.actorUserId, input.name, input.context]
    );
    for (const [index, productId] of input.productIds.entries()) {
      await transaction.query(
        `INSERT INTO product_comparison_items(comparison_id,workspace_id,product_id,position)
         VALUES($1,$2,$3,$4)`,
        [id, input.workspaceId, productId, index + 1]
      );
    }
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: "product_comparison.created",
      targetType: "product_comparison",
      targetId: id,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      metadata: { productIds: input.productIds, context: input.context }
    });
    return getProductComparison(transaction, input.workspaceId, id);
  });
}

export async function getProductComparison(
  database: Database | Transaction,
  workspaceId: string,
  comparisonId: string
): Promise<Record<string, unknown>> {
  const comparison = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT id,name,context,selected_product_id AS "selectedProductId",
            selection_rationale AS "selectionRationale",decision_id AS "decisionId",
            status,version,created_at AS "createdAt",updated_at AS "updatedAt"
       FROM product_comparisons WHERE workspace_id=$1 AND id=$2`,
    [workspaceId, comparisonId]
  );
  if (!comparison) throw new AppError(404, "comparison_not_found", "Comparison not found.");
  const products = await database.query(
    `SELECT i.position,p.id,p.name,p.category,p.status,p.consumer_price::text AS "consumerPrice",
            p.currency,p.review_volume AS "reviewVolume",
            p.review_quality_summary AS "reviewQualitySummary",
            p.sales_evidence_summary AS "salesEvidenceSummary",
            p.trend_direction AS "trendDirection",
            p.repeat_purchase_hypothesis AS "repeatPurchaseHypothesis",
            p.differentiation,p.physical_retail_presence AS "physicalRetailPresence",
            p.packaging_readiness AS "packagingReadiness",
            p.wholesale_readiness AS "wholesaleReadiness",
            p.inventory_notes AS "inventoryNotes",p.fulfillment_notes AS "fulfillmentNotes",
            p.returns_notes AS "returnsNotes",p.last_reviewed_at AS "lastReviewedAt",
            b.public_name AS "brandName",
            (SELECT count(*)::int FROM evidence_records e WHERE e.workspace_id=p.workspace_id
              AND e.subject_type='product' AND e.subject_id=p.id AND e.status='current') AS "evidenceCount",
            (SELECT count(*)::int FROM evidence_records e WHERE e.workspace_id=p.workspace_id
              AND e.subject_type='product' AND e.subject_id=p.id AND e.status='current'
              AND e.evidence_class='unknown') AS "unknownCount",
            (SELECT count(*)::int FROM risk_flags r WHERE r.workspace_id=p.workspace_id
              AND r.subject_type='product' AND r.subject_id=p.id
              AND r.status IN ('open','reviewing')) AS "riskCount"
       FROM product_comparison_items i
       JOIN products p ON p.workspace_id=i.workspace_id AND p.id=i.product_id
       JOIN brands b ON b.workspace_id=p.workspace_id AND b.id=p.brand_id
      WHERE i.workspace_id=$1 AND i.comparison_id=$2 ORDER BY i.position`,
    [workspaceId, comparisonId]
  );
  return {
    comparison,
    products: products.rows,
    limitations: [
      "No numerical Product Score or ranking is calculated.",
      "Unknown values remain Unknown and are not treated as average.",
      "Every conclusion requires source inspection and human judgment."
    ]
  };
}

export async function decideProductComparison(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    comparisonId: string;
    version: number;
    selectedProductId: string;
    rationale: string;
    decisionId: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const current = await oneOrNone<Record<string, unknown>>(
      transaction,
      "SELECT * FROM product_comparisons WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.comparisonId]
    );
    if (!current) throw new AppError(404, "comparison_not_found", "Comparison not found.");
    const item = await transaction.query(
      `SELECT product_id FROM product_comparison_items
        WHERE workspace_id=$1 AND comparison_id=$2 AND product_id=$3`,
      [input.workspaceId, input.comparisonId, input.selectedProductId]
    );
    if (!item.rows[0]) throw new AppError(422, "comparison_selection_invalid", "Selected Product is not in this comparison.");
    await requireIssuedDecision(transaction, {
      workspaceId: input.workspaceId,
      subjectType: "product",
      subjectId: input.selectedProductId,
      decisionId: input.decisionId,
      actorUserId: input.actorUserId
    });
    const updated = await transaction.query(
      `UPDATE product_comparisons
          SET selected_product_id=$4,selection_rationale=$5,decision_id=$6,
              status='decided',version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING id`,
      [input.workspaceId, input.comparisonId, input.version, input.selectedProductId, input.rationale, input.decisionId]
    );
    if (!updated.rows[0]) throw new AppError(409, "version_conflict", "Comparison changed. Reload before deciding.");
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: "product_comparison.decided",
      targetType: "product_comparison",
      targetId: input.comparisonId,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      before: current,
      metadata: { selectedProductId: input.selectedProductId, rationale: input.rationale, decisionId: input.decisionId }
    });
    return getProductComparison(transaction, input.workspaceId, input.comparisonId);
  });
}
