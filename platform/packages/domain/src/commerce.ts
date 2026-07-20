import type { Database, Transaction } from "../../database/src/index.js";
import { oneOrNone, withTransaction } from "../../database/src/index.js";
import { AppError, newId } from "../../shared/src/index.js";
import { recordAudit } from "./audit.js";
import { publicDigest } from "./crypto.js";
import { enqueueJob } from "./jobs.js";
import { validateCurrentAuthority } from "./representation.js";

type Db = Database | Transaction;

function databaseText(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "bigint"
    ? String(value)
    : fallback;
}
type CommercialSubject =
  | "protected_account" | "account" | "order" | "reorder"
  | "commission" | "commission_dispute";

type OrderLineInput = {
  productId: string;
  description: string;
  quantity: string;
  unitWholesalePrice: string;
  grossAmount: string;
  discountAmount?: string | undefined;
  returnAmount?: string | undefined;
  cancellationAmount?: string | undefined;
  commissionEligible?: boolean | undefined;
};

const orderSelect = `
  SELECT o.id,o.workspace_id AS "workspaceId",o.account_id AS "accountId",
         o.protected_account_id AS "protectedAccountId",
         o.prior_order_id AS "priorOrderId",
         o.placement_opportunity_id AS "placementOpportunityId",
         o.agreement_id AS "agreementId",o.brand_id AS "brandId",
         o.business_id AS "businessId",o.representative_user_id AS "representativeUserId",
         o.order_number AS "orderNumber",o.external_reference AS "externalReference",
         o.idempotency_key AS "idempotencyKey",o.order_type AS "orderType",
         o.order_date AS "orderDate",o.currency,
         o.wholesale_gross::text AS "wholesaleGross",o.discounts::text,o.returns::text,
         o.cancellations::text,o.net_commissionable::text AS "netCommissionable",
         o.status,o.payment_status AS "paymentStatus",
         o.fulfillment_status AS "fulfillmentStatus",o.source_type AS "sourceType",
         o.source_document_id AS "sourceDocumentId",o.source_reference AS "sourceReference",
         o.verification_status AS "verificationStatus",o.verified_by AS "verifiedBy",
         o.verified_at AS "verifiedAt",o.verification_notes AS "verificationNotes",
         o.current_revision AS "currentRevision",o.version,o.created_at AS "createdAt",
         o.updated_at AS "updatedAt",b.public_name AS "brandName",bu.name AS "businessName"
    FROM orders o JOIN brands b ON b.workspace_id=o.workspace_id AND b.id=o.brand_id
    JOIN businesses bu ON bu.workspace_id=o.workspace_id AND bu.id=o.business_id`;

const commissionSelect = `
  SELECT c.id,c.workspace_id AS "workspaceId",
         c.representative_user_id AS "representativeUserId",c.brand_id AS "brandId",
         c.account_id AS "accountId",c.protected_account_id AS "protectedAccountId",
         c.agreement_id AS "agreementId",c.order_id AS "orderId",
         c.current_calculation_id AS "currentCalculationId",
         c.calculation_basis AS "calculationBasis",c.commission_rate::text AS "commissionRate",
         c.basis_type AS "basisType",c.term_type AS "termType",c.currency,
         c.expected_amount::text AS "expectedAmount",
         c.verified_amount::text AS "verifiedAmount",
         c.approved_amount::text AS "approvedAmount",c.paid_amount::text AS "paidAmount",
         c.payment_due_date AS "paymentDueDate",c.payment_date AS "paymentDate",
         c.status,c.dispute_status AS "disputeStatus",
         c.clawback_status AS "clawbackStatus",c.clawback_amount::text AS "clawbackAmount",
         c.source_document_id AS "sourceDocumentId",
         c.current_order_revision AS "currentOrderRevision",
         c.calculation_explanation AS "calculationExplanation",c.version,
         c.created_at AS "createdAt",c.updated_at AS "updatedAt",
         b.public_name AS "brandName",a.status AS "accountStatus",o.order_number AS "orderNumber"
    FROM commissions c JOIN brands b ON b.workspace_id=c.workspace_id AND b.id=c.brand_id
    JOIN accounts a ON a.workspace_id=c.workspace_id AND a.id=c.account_id
    JOIN orders o ON o.workspace_id=c.workspace_id AND o.id=c.order_id`;

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

function digest(value: unknown): string {
  return publicDigest(canonical(value));
}

function minorUnits(value: string): bigint {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new AppError(422, "money_invalid", "Money must be a non-negative amount with no more than two decimal places.");
  }
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function money(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}

function rateMicros(value: string): bigint {
  if (!/^(?:0(?:\.\d{1,6})?|1(?:\.0{1,6})?)$/.test(value)) {
    throw new AppError(422, "commission_rate_invalid", "Commission rate must be between 0 and 1 with at most six decimal places.");
  }
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

function commissionAmount(base: string, rate: string): string {
  const numerator = minorUnits(base) * rateMicros(rate);
  return money((numerator + 500_000n) / 1_000_000n);
}

function dateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(text)?.[0];
  if (!iso) throw new AppError(422, "date_invalid", "A commercial record contains an invalid date.");
  return iso;
}

function netAmount(gross: string, discounts: string, returns: string, cancellations: string): string {
  const result = minorUnits(gross) - minorUnits(discounts) - minorUnits(returns) - minorUnits(cancellations);
  if (result < 0n) throw new AppError(422, "order_totals_invalid", "Discounts, returns, and cancellations cannot exceed gross wholesale value.");
  return money(result);
}

async function commercialEvent(
  database: Db,
  input: {
    workspaceId: string; subjectType: CommercialSubject; subjectId: string;
    eventType: string; actorUserId?: string | null | undefined;
    origin?: "user" | "system" | "job" | "import" | "provider";
    reason: string; requestId: string; before?: unknown; after?: unknown;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await database.query(
    `INSERT INTO commercial_events
      (id,workspace_id,subject_type,subject_id,event_type,actor_user_id,origin,reason,
       before_snapshot,after_snapshot,metadata,request_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [newId(), input.workspaceId, input.subjectType, input.subjectId, input.eventType,
      input.actorUserId ?? null, input.origin ?? "user", input.reason,
      input.before ?? null, input.after ?? null, input.metadata ?? {}, input.requestId]
  );
}

async function auditCommercial(
  database: Db,
  input: {
    workspaceId: string; actorUserId?: string | null | undefined;
    action: string; targetType: CommercialSubject; targetId: string;
    requestId: string; before?: unknown; after?: unknown;
    actorType?: "user" | "system" | "job";
  }
): Promise<void> {
  await recordAudit(database, {
    workspaceId: input.workspaceId, actorUserId: input.actorUserId ?? null,
    actorType: input.actorType ?? "user", action: input.action,
    targetType: input.targetType, targetId: input.targetId, origin: "api",
    requestId: input.requestId, outcome: "succeeded",
    before: input.before, after: input.after
  });
}

async function activeDocument(database: Db, workspaceId: string, documentId: string): Promise<Record<string, unknown>> {
  const document = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT id,name,sha256,status,scan_status AS "scanStatus"
       FROM documents WHERE workspace_id=$1 AND id=$2`,
    [workspaceId, documentId]
  );
  if (!document) throw new AppError(422, "source_document_missing", "A supporting source document is required.");
  if (document.status !== "active" || document.scanStatus !== "clean") {
    throw new AppError(422, "source_document_unavailable", "The supporting document must be active and have a clean scan.");
  }
  return document;
}

async function orderLines(database: Db, workspaceId: string, orderId: string): Promise<Record<string, unknown>[]> {
  const result = await database.query<Record<string, unknown>>(
    `SELECT l.id,l.product_id AS "productId",p.name AS "productName",l.description,
            l.quantity::text,l.unit_wholesale_price::text AS "unitWholesalePrice",
            l.gross_amount::text AS "grossAmount",l.discount_amount::text AS "discountAmount",
            l.return_amount::text AS "returnAmount",
            l.cancellation_amount::text AS "cancellationAmount",
            l.commission_eligible AS "commissionEligible",
            l.net_commissionable::text AS "netCommissionable"
       FROM order_line_items l JOIN products p ON p.workspace_id=l.workspace_id AND p.id=l.product_id
      WHERE l.workspace_id=$1 AND l.order_id=$2 ORDER BY l.created_at,l.id`,
    [workspaceId, orderId]
  );
  return result.rows;
}

async function orderSnapshot(database: Db, workspaceId: string, orderId: string): Promise<Record<string, unknown>> {
  const order = await oneOrNone<Record<string, unknown>>(
    database, `${orderSelect} WHERE o.workspace_id=$1 AND o.id=$2`, [workspaceId, orderId]
  );
  if (!order) throw new AppError(404, "order_not_found", "Order not found.");
  return { ...order, lines: await orderLines(database, workspaceId, orderId) };
}

async function appendOrderRevision(
  database: Db,
  input: {
    workspaceId: string; orderId: string; revision: number; reason: string;
    sourceDocumentId: string; actorUserId: string;
  }
): Promise<Record<string, unknown>> {
  const snapshot = await orderSnapshot(database, input.workspaceId, input.orderId);
  await database.query(
    `INSERT INTO order_revisions
      (id,workspace_id,order_id,revision,snapshot,snapshot_digest,reason,source_document_id,changed_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [newId(), input.workspaceId, input.orderId, input.revision, snapshot,
      digest(snapshot), input.reason, input.sourceDocumentId, input.actorUserId]
  );
  return snapshot;
}

function lineValues(line: OrderLineInput): {
  gross: string; discount: string; returned: string; canceled: string; net: string;
} {
  const discount = line.discountAmount ?? "0";
  const returned = line.returnAmount ?? "0";
  const canceled = line.cancellationAmount ?? "0";
  return { gross: money(minorUnits(line.grossAmount)), discount: money(minorUnits(discount)),
    returned: money(minorUnits(returned)), canceled: money(minorUnits(canceled)),
    net: netAmount(line.grossAmount, discount, returned, canceled) };
}

function sumLines(lines: OrderLineInput[]): {
  gross: string; discounts: string; returns: string; cancellations: string; net: string;
} {
  let gross = 0n; let discounts = 0n; let returns = 0n; let cancellations = 0n;
  for (const line of lines) {
    const values = lineValues(line);
    gross += minorUnits(values.gross);
    discounts += minorUnits(values.discount);
    returns += minorUnits(values.returned);
    cancellations += minorUnits(values.canceled);
  }
  return { gross: money(gross), discounts: money(discounts), returns: money(returns),
    cancellations: money(cancellations), net: money(gross-discounts-returns-cancellations) };
}

export async function listAccounts(
  database: Database,
  workspaceId: string,
  filters: {
    status?: string | undefined; health?: string | undefined;
    brandId?: string | undefined; businessId?: string | undefined;
  } = {}
): Promise<Record<string, unknown>[]> {
  const values: unknown[] = [workspaceId];
  const clauses = ["a.workspace_id=$1", "a.archived_at IS NULL"];
  if (filters.status) clauses.push(`a.status=$${values.push(filters.status)}`);
  if (filters.health) clauses.push(`a.health=$${values.push(filters.health)}`);
  if (filters.brandId) clauses.push(`a.brand_id=$${values.push(filters.brandId)}`);
  if (filters.businessId) clauses.push(`a.business_id=$${values.push(filters.businessId)}`);
  const result = await database.query<Record<string, unknown>>(
    `SELECT a.id,a.brand_id AS "brandId",a.business_id AS "businessId",
            a.agreement_id AS "agreementId",a.placement_opportunity_id AS "placementOpportunityId",
            a.opening_order_id AS "openingOrderId",a.protected_account_id AS "protectedAccountId",
            a.status,a.health,a.health_rationale AS "healthRationale",a.opened_at AS "openedAt",
            a.ended_at AS "endedAt",a.ended_reason AS "endedReason",a.version,
            b.public_name AS "brandName",bu.name AS "businessName",
            pa.status AS "protectionStatus",pa.protection_ends_on AS "protectionEndsOn",
            last_order.order_date AS "lastOrderDate",last_order.order_number AS "lastOrderNumber"
       FROM accounts a JOIN brands b ON b.workspace_id=a.workspace_id AND b.id=a.brand_id
       JOIN businesses bu ON bu.workspace_id=a.workspace_id AND bu.id=a.business_id
       LEFT JOIN protected_accounts pa ON pa.workspace_id=a.workspace_id AND pa.id=a.protected_account_id
       LEFT JOIN LATERAL (
         SELECT order_date,order_number FROM orders o WHERE o.workspace_id=a.workspace_id
          AND o.account_id=a.id ORDER BY order_date DESC,created_at DESC LIMIT 1
       ) last_order ON true
      WHERE ${clauses.join(" AND ")} ORDER BY a.updated_at DESC`,
    values
  );
  return result.rows;
}

export async function getAccount(
  database: Database,
  workspaceId: string,
  accountId: string
): Promise<Record<string, unknown>> {
  const account = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT a.*,b.public_name AS "brandName",bu.name AS "businessName",
            ra.status AS "agreementStatus",ra.expires_at AS "agreementExpiresAt"
       FROM accounts a JOIN brands b ON b.workspace_id=a.workspace_id AND b.id=a.brand_id
       JOIN businesses bu ON bu.workspace_id=a.workspace_id AND bu.id=a.business_id
       JOIN representation_agreements ra ON ra.workspace_id=a.workspace_id AND ra.id=a.agreement_id
      WHERE a.workspace_id=$1 AND a.id=$2 AND a.archived_at IS NULL`,
    [workspaceId, accountId]
  );
  if (!account) throw new AppError(404, "account_not_found", "Account not found.");
  const [protection, orders, reorders, commissions, events, activities, documents] = await Promise.all([
    database.query(`SELECT id,status,scope_summary AS "scopeSummary",protection_starts_on AS "protectionStartsOn",
      protection_ends_on AS "protectionEndsOn",commission_rights AS "commissionRights",
      reorder_rights AS "reorderRights",supporting_basis_status AS "supportingBasisStatus",
      human_confirmed AS "humanConfirmed",version FROM protected_accounts
      WHERE workspace_id=$1 AND account_id=$2 AND archived_at IS NULL ORDER BY created_at DESC`, [workspaceId, accountId]),
    database.query(`${orderSelect} WHERE o.workspace_id=$1 AND o.account_id=$2 ORDER BY o.order_date DESC`, [workspaceId, accountId]),
    database.query(`SELECT id,status,prior_order_id AS "priorOrderId",new_order_id AS "newOrderId",
      last_order_date AS "lastOrderDate",expected_window_starts_on AS "expectedWindowStartsOn",
      expected_window_ends_on AS "expectedWindowEndsOn",average_order_size::text AS "averageOrderSize",
      currency,account_health AS "accountHealth",reminder_at AS "reminderAt",next_action AS "nextAction",
      likelihood_label AS "likelihoodLabel",likelihood_origin AS "likelihoodOrigin",
      recommended_follow_up AS "recommendedFollowUp",version FROM reorders
      WHERE workspace_id=$1 AND account_id=$2 AND archived_at IS NULL ORDER BY created_at DESC`, [workspaceId, accountId]),
    database.query(`${commissionSelect} WHERE c.workspace_id=$1 AND c.account_id=$2 ORDER BY c.created_at DESC`, [workspaceId, accountId]),
    database.query(`SELECT event_type AS "eventType",reason,origin,before_snapshot AS "before",
      after_snapshot AS "after",occurred_at AS "occurredAt" FROM commercial_events
      WHERE workspace_id=$1 AND subject_type='account' AND subject_id=$2 ORDER BY occurred_at DESC`, [workspaceId, accountId]),
    database.query(`SELECT activity_type AS "activityType",summary,status,occurred_at AS "occurredAt"
      FROM activities WHERE workspace_id=$1 AND subject_id=$2 ORDER BY occurred_at DESC`, [workspaceId, accountId]),
    database.query(`SELECT d.id,d.name,d.document_type AS "documentType",d.status,d.scan_status AS "scanStatus"
      FROM commercial_document_links l JOIN documents d ON d.workspace_id=l.workspace_id AND d.id=l.document_id
      WHERE l.workspace_id=$1 AND l.subject_type='account' AND l.subject_id=$2 ORDER BY l.linked_at DESC`, [workspaceId, accountId])
  ]);
  return { account, protections: protection.rows, orders: orders.rows, reorders: reorders.rows,
    commissions: commissions.rows, events: events.rows, activities: activities.rows,
    documents: documents.rows };
}

export async function listOrders(
  database: Database,
  workspaceId: string,
  filters: {
    status?: string | undefined; paymentStatus?: string | undefined;
    orderType?: string | undefined; accountId?: string | undefined;
  } = {}
): Promise<Record<string, unknown>[]> {
  const values: unknown[] = [workspaceId];
  const clauses = ["o.workspace_id=$1", "o.archived_at IS NULL"];
  if (filters.status) clauses.push(`o.status=$${values.push(filters.status)}`);
  if (filters.paymentStatus) clauses.push(`o.payment_status=$${values.push(filters.paymentStatus)}`);
  if (filters.orderType) clauses.push(`o.order_type=$${values.push(filters.orderType)}`);
  if (filters.accountId) clauses.push(`o.account_id=$${values.push(filters.accountId)}`);
  const result = await database.query<Record<string, unknown>>(
    `${orderSelect} WHERE ${clauses.join(" AND ")} ORDER BY o.order_date DESC,o.created_at DESC`,
    values
  );
  return result.rows;
}

export async function getOrder(
  database: Database,
  workspaceId: string,
  orderId: string
): Promise<Record<string, unknown>> {
  const order = await oneOrNone<Record<string, unknown>>(
    database, `${orderSelect} WHERE o.workspace_id=$1 AND o.id=$2 AND o.archived_at IS NULL`,
    [workspaceId, orderId]
  );
  if (!order) throw new AppError(404, "order_not_found", "Order not found.");
  const [lines, revisions, commissions, events, documents] = await Promise.all([
    orderLines(database, workspaceId, orderId),
    database.query(`SELECT revision,snapshot,snapshot_digest AS "snapshotDigest",reason,
      source_document_id AS "sourceDocumentId",changed_by AS "changedBy",changed_at AS "changedAt"
      FROM order_revisions WHERE workspace_id=$1 AND order_id=$2 ORDER BY revision DESC`, [workspaceId, orderId]),
    database.query(`${commissionSelect} WHERE c.workspace_id=$1 AND c.order_id=$2`, [workspaceId, orderId]),
    database.query(`SELECT event_type AS "eventType",reason,origin,before_snapshot AS "before",
      after_snapshot AS "after",occurred_at AS "occurredAt" FROM commercial_events
      WHERE workspace_id=$1 AND subject_type='order' AND subject_id=$2 ORDER BY occurred_at DESC`, [workspaceId, orderId]),
    database.query(`SELECT d.id,d.name,d.document_type AS "documentType",d.status,d.scan_status AS "scanStatus"
      FROM commercial_document_links l JOIN documents d ON d.workspace_id=l.workspace_id AND d.id=l.document_id
      WHERE l.workspace_id=$1 AND l.subject_type='order' AND l.subject_id=$2 ORDER BY l.linked_at DESC`, [workspaceId, orderId])
  ]);
  return { order, lines, revisions: revisions.rows, commissions: commissions.rows,
    events: events.rows, documents: documents.rows };
}

export async function createOrder(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string;
    placementId: string; accountId?: string | null | undefined;
    priorOrderId?: string | null | undefined; orderNumber: string;
    externalReference?: string | null | undefined; idempotencyKey: string;
    orderType: "opening_order" | "reorder"; orderDate: string; currency: string;
    sourceType: "document" | "external_reference" | "manual_with_evidence" | "imported";
    sourceDocumentId: string; sourceReference?: string | undefined;
    paymentStatus: "unknown" | "unpaid" | "partially_paid" | "paid" | "refunded" | "chargeback";
    fulfillmentStatus: "unknown" | "unfulfilled" | "partial" | "fulfilled" | "returned" | "canceled";
    lines: OrderLineInput[];
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const existing = await oneOrNone<Record<string, unknown>>(
      transaction, `${orderSelect} WHERE o.workspace_id=$1 AND o.idempotency_key=$2`,
      [input.workspaceId, input.idempotencyKey]
    );
    if (existing) return existing;
    const document = await activeDocument(transaction, input.workspaceId, input.sourceDocumentId);
    const placement = await oneOrNone<Record<string, unknown>>(
      transaction,
      `SELECT p.*,ra.reorder_rights FROM placement_opportunities p
       JOIN representation_agreements ra ON ra.workspace_id=p.workspace_id AND ra.id=p.agreement_id
       WHERE p.workspace_id=$1 AND p.id=$2 AND p.archived_at IS NULL FOR UPDATE OF p`,
      [input.workspaceId, input.placementId]
    );
    if (!placement) throw new AppError(422, "placement_required", "A current Placement Opportunity is required.");
    const duplicate = await oneOrNone<{ id: string }>(
      transaction,
      `SELECT id FROM orders
        WHERE workspace_id=$1 AND brand_id=$2 AND archived_at IS NULL
          AND (order_number=$3 OR ($4::text IS NOT NULL AND external_reference=$4))
        LIMIT 1`,
      [input.workspaceId, placement.brand_id, input.orderNumber, input.externalReference ?? null]
    );
    if (duplicate) {
      throw new AppError(
        409,
        "duplicate_order",
        "An Order with this brand order number or external reference already exists."
      );
    }
    if (!["terms_order_discussion","opening_order","active_account","reorder_management"].includes(String(placement.stage))) {
      throw new AppError(409, "order_stage_invalid", "Record Buyer interest and order discussion before creating an Order.");
    }
    if (input.orderType === "opening_order" && input.accountId) {
      throw new AppError(422, "opening_order_account_invalid", "An opening Order creates its Account when verified.");
    }
    if (input.orderType === "reorder" && (!input.accountId || !input.priorOrderId)) {
      throw new AppError(422, "reorder_links_required", "A Reorder requires an Account and prior verified Order.");
    }
    let reorderProtectionId: string | null = null;
    const products = [...new Set(input.lines.map((line) => line.productId))];
    const placementProducts = await transaction.query<{ productId: string }>(
      `SELECT product_id AS "productId" FROM placement_opportunity_products
       WHERE workspace_id=$1 AND placement_opportunity_id=$2 AND product_id=ANY($3::uuid[])`,
      [input.workspaceId, input.placementId, products]
    );
    if (placementProducts.rowCount !== products.length) {
      throw new AppError(422, "order_product_out_of_scope", "Every Order Product must belong to the Placement Opportunity.");
    }
    if (input.orderType === "reorder") {
      const account = await oneOrNone<Record<string, unknown>>(
        transaction,
        `SELECT * FROM accounts WHERE workspace_id=$1 AND id=$2 AND placement_opportunity_id=$3
          AND status IN ('onboarding','active','at_risk','paused')`,
        [input.workspaceId, input.accountId, input.placementId]
      );
      if (!account) throw new AppError(409, "reorder_account_inactive", "Reorder requires a current linked Account.");
      if (!databaseText(placement.reorder_rights).trim()) {
        throw new AppError(409, "reorder_rights_missing", "The Agreement does not document Reorder rights.");
      }
      const prior = await oneOrNone<Record<string, unknown>>(
        transaction,
        `SELECT id FROM orders WHERE workspace_id=$1 AND id=$2 AND account_id=$3
          AND verification_status='verified'`,
        [input.workspaceId, input.priorOrderId, input.accountId]
      );
      if (!prior) throw new AppError(422, "prior_verified_order_required", "Select a verified prior Order for the Reorder.");
      if (account.protected_account_id) {
        const protection = await oneOrNone<Record<string, unknown>>(
          transaction,
          `SELECT id FROM protected_accounts WHERE workspace_id=$1 AND id=$2
            AND status IN ('active','expiring')
            AND protection_starts_on<=$3::date AND protection_ends_on>=$3::date`,
          [input.workspaceId, account.protected_account_id, input.orderDate]
        );
        reorderProtectionId = protection ? String(protection.id) : null;
      }
    }
    const totals = sumLines(input.lines);
    const orderId = newId();
    await transaction.query(
      `INSERT INTO orders
        (id,workspace_id,account_id,protected_account_id,prior_order_id,placement_opportunity_id,agreement_id,brand_id,business_id,
         representative_user_id,order_number,external_reference,idempotency_key,order_type,
         order_date,currency,wholesale_gross,discounts,returns,cancellations,net_commissionable,
         status,payment_status,fulfillment_status,source_type,source_document_id,source_reference,
         verification_status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
              'draft',$22,$23,$24,$25,$26,'review_required')`,
      [orderId, input.workspaceId, input.accountId ?? null, reorderProtectionId,
        input.priorOrderId ?? null, input.placementId,
        placement.agreement_id, placement.brand_id, placement.business_id, input.actorUserId,
        input.orderNumber, input.externalReference ?? null, input.idempotencyKey, input.orderType,
        input.orderDate, input.currency, totals.gross, totals.discounts, totals.returns,
        totals.cancellations, totals.net, input.paymentStatus, input.fulfillmentStatus,
        input.sourceType, input.sourceDocumentId, input.sourceReference ?? ""]
    );
    for (const line of input.lines) {
      const values = lineValues(line);
      await transaction.query(
        `INSERT INTO order_line_items
          (id,workspace_id,order_id,product_id,description,quantity,unit_wholesale_price,
           gross_amount,discount_amount,return_amount,cancellation_amount,
           commission_eligible,net_commissionable)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [newId(), input.workspaceId, orderId, line.productId, line.description, line.quantity,
          line.unitWholesalePrice, values.gross, values.discount, values.returned,
          values.canceled, line.commissionEligible ?? true,
          line.commissionEligible === false ? "0.00" : values.net]
      );
    }
    const snapshot = await appendOrderRevision(transaction, {
      workspaceId: input.workspaceId, orderId, revision: 1,
      reason: "Original Order record", sourceDocumentId: input.sourceDocumentId,
      actorUserId: input.actorUserId
    });
    await transaction.query(
      `INSERT INTO commercial_document_links
       (workspace_id,subject_type,subject_id,document_id,purpose,linked_by)
       VALUES($1,'order',$2,$3,'order_source',$4)`,
      [input.workspaceId, orderId, input.sourceDocumentId, input.actorUserId]
    );
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "order", subjectId: orderId,
      eventType: "order.recorded", actorUserId: input.actorUserId,
      reason: "Order saved for human verification", requestId: input.requestId,
      after: snapshot, metadata: { documentDigest: document.sha256 }
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: "order.created", targetType: "order", targetId: orderId,
      requestId: input.requestId, after: snapshot
    });
    return (await oneOrNone<Record<string, unknown>>(
      transaction, `${orderSelect} WHERE o.workspace_id=$1 AND o.id=$2`,
      [input.workspaceId, orderId]
    ))!;
  });
}

async function calculateCommission(
  database: Db,
  input: {
    workspaceId: string; commissionId: string; agreementId: string; orderId: string;
    actorUserId: string; reason: string;
  }
): Promise<Record<string, unknown>> {
  const order = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT o.*,COALESCE(sum(CASE WHEN l.commission_eligible THEN l.net_commissionable ELSE 0 END),0)::text
            AS eligible_amount
       FROM orders o LEFT JOIN order_line_items l ON l.workspace_id=o.workspace_id AND l.order_id=o.id
      WHERE o.workspace_id=$1 AND o.id=$2 GROUP BY o.id`,
    [input.workspaceId, input.orderId]
  );
  const agreement = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT commission_basis,commission_rate::text AS commission_rate,
            commission_currency,legal_ambiguity_status,source_document_id
       FROM representation_agreements WHERE workspace_id=$1 AND id=$2`,
    [input.workspaceId, input.agreementId]
  );
  if (!order || !agreement) throw new AppError(409, "commission_basis_missing", "Order or Agreement commission basis is unavailable.");
  if (!agreement.commission_rate || !String(agreement.commission_basis).trim()) {
    throw new AppError(409, "commission_rights_missing", "Commission calculation is blocked until an Agreement rate and basis are documented.");
  }
  if (["review_required", "specialist_required"].includes(String(agreement.legal_ambiguity_status))) {
    throw new AppError(409, "commission_rights_ambiguous", "Commission calculation is blocked while Agreement terms are ambiguous.");
  }
  if (agreement.commission_currency !== order.currency) {
    throw new AppError(409, "commission_currency_conflict", "Agreement and Order currencies differ. Add an explicit sourced conversion policy or correct the source.");
  }
  const basisText = String(agreement.commission_basis).toLowerCase();
  const basisType = basisText.includes("gross") && !basisText.includes("net") ? "gross" : "net";
  const base = basisType === "gross" ? String(order.wholesale_gross) : String(order.eligible_amount);
  const rate = databaseText(agreement.commission_rate);
  const result = commissionAmount(base, rate);
  const count = await oneOrNone<{ count: string }>(
    database, "SELECT count(*)::text AS count FROM commission_calculations WHERE workspace_id=$1 AND commission_id=$2",
    [input.workspaceId, input.commissionId]
  );
  const version = Number(count?.count ?? "0") + 1;
  const calculationId = newId();
  const snapshot = {
    agreementId: input.agreementId, orderId: input.orderId,
    orderRevision: Number(order.current_revision), currency: order.currency,
    gross: String(order.wholesale_gross), eligible: String(order.eligible_amount),
    discounts: String(order.discounts), returns: String(order.returns),
    cancellations: String(order.cancellations), commissionable: base,
    basisType, rate, result
  };
  const formula = `${basisType === "gross" ? "gross wholesale" : "eligible net commissionable"} ${base} × rate ${rate} = ${result} ${String(order.currency)}`;
  await database.query(
    `INSERT INTO commission_calculations
      (id,workspace_id,commission_id,calculation_version,agreement_id,order_id,order_revision,
       currency,gross_amount,eligible_amount,discounts,returns,cancellations,commissionable_amount,
       basis_type,rate,result_amount,formula,rounding_rule,input_snapshot,snapshot_digest,reason,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
    [calculationId, input.workspaceId, input.commissionId, version, input.agreementId,
      input.orderId, order.current_revision, order.currency, order.wholesale_gross,
      order.eligible_amount, order.discounts, order.returns, order.cancellations, base,
      basisType, rate, result, formula, "half away from zero to ISO currency minor unit",
      snapshot, digest(snapshot), input.reason, input.actorUserId]
  );
  await database.query(
    `UPDATE commissions SET current_calculation_id=$3,calculation_basis=$4,
      commission_rate=$5,basis_type=$6,currency=$7,expected_amount=$8,
      current_order_revision=$9,calculation_explanation=$10,version=version+1,updated_at=now()
      WHERE workspace_id=$1 AND id=$2`,
    [input.workspaceId, input.commissionId, calculationId, agreement.commission_basis,
      rate, basisType, order.currency, result, order.current_revision, formula]
  );
  return { id: calculationId, version, ...snapshot, formula,
    roundingRule: "half away from zero to ISO currency minor unit" };
}

async function createEstimatedCommission(
  database: Db,
  input: {
    workspaceId: string; actorUserId: string; requestId: string;
    accountId: string; protectedAccountId?: string | null | undefined;
    agreementId: string; brandId: string; orderId: string;
    orderType: "opening_order" | "reorder"; sourceDocumentId: string;
  }
): Promise<Record<string, unknown>> {
  const existing = await oneOrNone<Record<string, unknown>>(
    database, `${commissionSelect} WHERE c.workspace_id=$1 AND c.order_id=$2`,
    [input.workspaceId, input.orderId]
  );
  if (existing) return existing;
  const agreement = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT commission_basis,commission_rate::text AS commission_rate,commission_currency
       FROM representation_agreements WHERE workspace_id=$1 AND id=$2`,
    [input.workspaceId, input.agreementId]
  );
  if (!agreement?.commission_rate || !databaseText(agreement.commission_basis).trim()) {
    throw new AppError(409, "commission_rights_missing", "Agreement evidence must document a commission rate and basis.");
  }
  const order = await oneOrNone<Record<string, unknown>>(
    database, "SELECT currency,current_revision FROM orders WHERE workspace_id=$1 AND id=$2",
    [input.workspaceId, input.orderId]
  );
  if (!order) throw new AppError(404, "order_not_found", "Order not found.");
  const commissionId = newId();
  await database.query(
    `INSERT INTO commissions
      (id,workspace_id,representative_user_id,brand_id,account_id,protected_account_id,
       agreement_id,order_id,calculation_basis,commission_rate,basis_type,term_type,currency,
       expected_amount,status,dispute_status,clawback_status,source_document_id,
       current_order_revision,calculation_explanation)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'net',$11,$12,0,
            'estimated','none','none',$13,$14,'Calculation pending')`,
    [commissionId, input.workspaceId, input.actorUserId, input.brandId, input.accountId,
      input.protectedAccountId ?? null, input.agreementId, input.orderId,
      agreement.commission_basis, agreement.commission_rate, input.orderType,
      order.currency, input.sourceDocumentId, order.current_revision]
  );
  const calculation = await calculateCommission(database, {
    workspaceId: input.workspaceId, commissionId, agreementId: input.agreementId,
    orderId: input.orderId, actorUserId: input.actorUserId,
    reason: "Estimated Commission generated from verified Order"
  });
  const commission = (await oneOrNone<Record<string, unknown>>(
    database, `${commissionSelect} WHERE c.workspace_id=$1 AND c.id=$2`,
    [input.workspaceId, commissionId]
  ))!;
  await commercialEvent(database, {
    workspaceId: input.workspaceId, subjectType: "commission", subjectId: commissionId,
    eventType: "commission.estimated", actorUserId: input.actorUserId,
    reason: "Estimated from the verified Order and documented Agreement rule",
    requestId: input.requestId, after: { commission, calculation }
  });
  await auditCommercial(database, {
    workspaceId: input.workspaceId, actorUserId: input.actorUserId,
    action: "commission.estimated", targetType: "commission", targetId: commissionId,
    requestId: input.requestId, after: commission
  });
  return commission;
}

async function createInitialReorder(
  database: Db,
  input: {
    workspaceId: string; actorUserId: string; requestId: string;
    accountId: string; protectedAccountId?: string | null | undefined;
    orderId: string; orderDate: string; currency: string; amount: string;
  }
): Promise<Record<string, unknown>> {
  const existing = await oneOrNone<Record<string, unknown>>(
    database, "SELECT * FROM reorders WHERE workspace_id=$1 AND prior_order_id=$2",
    [input.workspaceId, input.orderId]
  );
  if (existing) return existing;
  const reorderId = newId();
  await database.query(
    `INSERT INTO reorders
      (id,workspace_id,account_id,protected_account_id,prior_order_id,owner_user_id,
       last_order_date,average_order_size,currency,status,account_health,health_rationale,
       next_action,recommendation_origin,recommended_follow_up,estimate_explanation)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'projected','unknown',
            'Account health requires human review','Set a responsible reorder window after service review',
            'system_rule','Review actual delivery, sell-through and Buyer need before follow-up',
            'No reorder window is inferred from a single Order')`,
    [reorderId, input.workspaceId, input.accountId, input.protectedAccountId ?? null,
      input.orderId, input.actorUserId, input.orderDate, input.amount, input.currency]
  );
  await commercialEvent(database, {
    workspaceId: input.workspaceId, subjectType: "reorder", subjectId: reorderId,
    eventType: "reorder.review_created", actorUserId: input.actorUserId, origin: "system",
    reason: "Initial review created without asserting future revenue", requestId: input.requestId
  });
  return (await oneOrNone<Record<string, unknown>>(
    database, "SELECT * FROM reorders WHERE workspace_id=$1 AND id=$2",
    [input.workspaceId, reorderId]
  ))!;
}

export async function confirmOrder(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string;
    orderId: string; version: number; verificationNotes: string;
    expectedReorderWindowStartsOn?: string | null | undefined;
    expectedReorderWindowEndsOn?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const order = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM orders WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.orderId]
    );
    if (!order) throw new AppError(404, "order_not_found", "Order not found.");
    if (Number(order.version) !== input.version) {
      throw new AppError(409, "version_conflict", "Order changed. Reload and reconcile before verification.");
    }
    if (order.verification_status === "verified") {
      return getOrder(database, input.workspaceId, input.orderId);
    }
    await activeDocument(transaction, input.workspaceId, String(order.source_document_id));
    if (["canceled","returned"].includes(String(order.status))) {
      throw new AppError(409, "order_not_confirmable", "A canceled or fully returned Order cannot be confirmed.");
    }
    const products = await transaction.query<{ productId: string }>(
      "SELECT product_id AS \"productId\" FROM order_line_items WHERE workspace_id=$1 AND order_id=$2",
      [input.workspaceId, input.orderId]
    );
    const authority = await validateCurrentAuthority(transaction, {
      workspaceId: input.workspaceId, brandId: String(order.brand_id),
      productIds: products.rows.map((item) => item.productId),
      businessId: String(order.business_id), agreementId: String(order.agreement_id),
      ignoreProtectedAccountId: order.protected_account_id
        ? databaseText(order.protected_account_id) : null
    });
    if (authority.outcome !== "authorized") {
      throw new AppError(409, "order_authority_invalid", `Order confirmation is blocked: ${authority.reasonCodes.join(", ")}.`);
    }
    const agreement = await oneOrNone<Record<string, unknown>>(
      transaction,
      `SELECT * FROM representation_agreements WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,
      [input.workspaceId, order.agreement_id]
    );
    if (!agreement) throw new AppError(409, "agreement_missing", "Order Agreement is unavailable.");
    let accountId = order.account_id ? databaseText(order.account_id) : "";
    let protectedAccountId: string | null = order.protected_account_id ? databaseText(order.protected_account_id) : null;
    if (order.order_type === "opening_order") {
      const existingAccount = await oneOrNone<Record<string, unknown>>(
        transaction,
        `SELECT id,protected_account_id FROM accounts
          WHERE workspace_id=$1 AND brand_id=$2 AND business_id=$3
          AND agreement_id=$4 AND status<>'ended' FOR UPDATE`,
        [input.workspaceId, order.brand_id, order.business_id, order.agreement_id]
      );
      if (existingAccount) {
        accountId = String(existingAccount.id);
        protectedAccountId = existingAccount.protected_account_id
          ? databaseText(existingAccount.protected_account_id) : null;
      } else {
        accountId = newId();
        await transaction.query(
          `INSERT INTO accounts
            (id,workspace_id,brand_id,business_id,representative_user_id,owner_user_id,
             agreement_id,placement_opportunity_id,status,health,health_rationale,opened_at)
           VALUES($1,$2,$3,$4,$5,$5,$6,$7,'onboarding','unknown',
                  'Opening Order verified; health awaits human account review',now())`,
          [accountId, input.workspaceId, order.brand_id, order.business_id,
            input.actorUserId, order.agreement_id, order.placement_opportunity_id]
        );
      }
      if (!existingAccount && databaseText(agreement.protected_account_rules).trim()) {
        protectedAccountId = newId();
        const starts = dateOnly(order.order_date);
        const ends = new Date(`${starts}T00:00:00.000Z`);
        ends.setUTCFullYear(ends.getUTCFullYear() + 1);
        const endsOn = ends.toISOString().slice(0, 10);
        const rights = {
          accountId, brandId: order.brand_id, businessId: order.business_id,
          agreementId: order.agreement_id, placementId: order.placement_opportunity_id,
          products: products.rows.map((item) => item.productId),
          channels: agreement.channels, territory: agreement.territory_scope,
          startsOn: starts, endsOn, commissionRights: agreement.commission_basis,
          reorderRights: agreement.reorder_rights
        };
        await transaction.query(
          `INSERT INTO protected_accounts
            (id,workspace_id,account_id,brand_id,business_id,representative_user_id,
             agreement_id,placement_opportunity_id,origin_order_id,basis_document_id,
             origin_date,scope_summary,product_ids,channels,territory_scope,
             protection_starts_on,protection_ends_on,protection_term,commission_rights,
             reorder_rights,house_account_exclusions,status,rights_digest,supporting_basis_status)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$11,$16,
                  'One-year review default; confirm exact written term',$17,$18,$19,
                  'pending',$20,'review_required')`,
          [protectedAccountId, input.workspaceId, accountId, order.brand_id, order.business_id,
            input.actorUserId, order.agreement_id, order.placement_opportunity_id, input.orderId,
            agreement.source_document_id, starts, agreement.protected_account_rules,
            products.rows.map((item) => item.productId), agreement.channels,
            agreement.territory_scope, endsOn, agreement.commission_basis,
            agreement.reorder_rights, agreement.house_account_rules, digest(rights)]
        );
        await commercialEvent(transaction, {
          workspaceId: input.workspaceId, subjectType: "protected_account",
          subjectId: protectedAccountId, eventType: "protection.review_created",
          actorUserId: input.actorUserId, origin: "system",
          reason: "Agreement contains a possible protection basis; exact term requires human review",
          requestId: input.requestId, after: rights
        });
      } else if (!existingAccount) {
        const taskId = newId();
        await transaction.query(
          `INSERT INTO tasks
            (id,workspace_id,subject_type,subject_id,title,owner_user_id,status,priority,
             created_reason,mandatory_gate)
           VALUES($1,$2,'account',$3,'Review whether written account-protection rights exist',
                  $4,'open','high','Opening Order has no documented protection rule',true)`,
          [taskId, input.workspaceId, accountId, input.actorUserId]
        );
      }
    } else if (!accountId) {
      throw new AppError(409, "reorder_account_missing", "Reorder Account linkage is missing.");
    }
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE orders SET account_id=$3,protected_account_id=$4,status='confirmed',
        verification_status='verified',verified_by=$5,verified_at=now(),
        verification_notes=$6,version=version+1,updated_at=now()
       WHERE workspace_id=$1 AND id=$2 AND version=$7 RETURNING *`,
      [input.workspaceId, input.orderId, accountId, protectedAccountId,
        input.actorUserId, input.verificationNotes, input.version]
    );
    if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Order changed during verification.");
    if (order.order_type === "opening_order") {
      await transaction.query(
        `UPDATE accounts SET opening_order_id=$3,protected_account_id=$4,version=version+1,
          updated_at=now() WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, accountId, input.orderId, protectedAccountId]
      );
    }
    const commission = await createEstimatedCommission(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, requestId: input.requestId,
      accountId, protectedAccountId, agreementId: String(order.agreement_id),
      brandId: String(order.brand_id), orderId: input.orderId,
      orderType: order.order_type as "opening_order" | "reorder",
      sourceDocumentId: String(order.source_document_id)
    });
    let reorder: Record<string, unknown>;
    if (order.order_type === "opening_order") {
      reorder = await createInitialReorder(transaction, {
        workspaceId: input.workspaceId, actorUserId: input.actorUserId,
        requestId: input.requestId, accountId, protectedAccountId,
        orderId: input.orderId, orderDate: dateOnly(order.order_date),
        currency: String(order.currency), amount: String(order.net_commissionable)
      });
      if (input.expectedReorderWindowStartsOn || input.expectedReorderWindowEndsOn) {
        await transaction.query(
          `UPDATE reorders SET expected_window_starts_on=$3,expected_window_ends_on=$4,
            estimate_explanation='Window entered by the Representative; it is not guaranteed revenue',
            likelihood_origin='user_entered',version=version+1,updated_at=now()
           WHERE workspace_id=$1 AND id=$2`,
          [input.workspaceId, reorder.id, input.expectedReorderWindowStartsOn ?? null,
            input.expectedReorderWindowEndsOn ?? null]
        );
      }
    } else {
      const reorderRow = await oneOrNone<Record<string, unknown>>(
        transaction,
        `UPDATE reorders SET new_order_id=$3,status='ordered',version=version+1,updated_at=now()
          WHERE workspace_id=$1 AND prior_order_id=$2 AND new_order_id IS NULL RETURNING *`,
        [input.workspaceId, order.prior_order_id, input.orderId]
      );
      reorder = reorderRow ?? {};
      const nextReorder = await createInitialReorder(transaction, {
        workspaceId: input.workspaceId, actorUserId: input.actorUserId,
        requestId: input.requestId, accountId, protectedAccountId,
        orderId: input.orderId, orderDate: dateOnly(order.order_date),
        currency: String(order.currency), amount: String(order.net_commissionable)
      });
      reorder = { ...reorder, nextReorderId: nextReorder.id };
      await transaction.query(
        `UPDATE accounts SET status='active',health='healthy',
          health_rationale='Verified Reorder recorded',version=version+1,updated_at=now()
         WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, accountId]
      );
    }
    const placement = await oneOrNone<Record<string, unknown>>(
      transaction,
      "SELECT stage FROM placement_opportunities WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, order.placement_opportunity_id]
    );
    const nextStage = order.order_type === "opening_order" ? "active_account" : "reorder_management";
    if (placement && placement.stage !== nextStage) {
      await transaction.query(
        `UPDATE placement_opportunities SET stage=$3,last_meaningful_action_at=now(),
          version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, order.placement_opportunity_id, nextStage]
      );
      await transaction.query(
        `INSERT INTO placement_stage_events
          (id,workspace_id,placement_opportunity_id,from_stage,to_stage,reason,evidence_ids,actor_user_id)
         VALUES($1,$2,$3,$4,$5,$6,'{}',$7)`,
        [newId(), input.workspaceId, order.placement_opportunity_id, placement.stage,
          nextStage, `Verified ${String(order.order_type).replace("_", " ")}`, input.actorUserId]
      );
    }
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "order", subjectId: input.orderId,
      eventType: "order.verified", actorUserId: input.actorUserId,
      reason: input.verificationNotes, requestId: input.requestId,
      before: order, after: changed.rows[0], metadata: { accountId, protectedAccountId,
        commissionId: commission.id, reorderId: reorder.id }
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: "order.verified_and_converted", targetType: "order", targetId: input.orderId,
      requestId: input.requestId, before: order, after: changed.rows[0]
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: "account.created_or_linked", targetType: "account", targetId: accountId,
      requestId: input.requestId, after: { openingOrderId: input.orderId, protectedAccountId }
    });
    return { order: changed.rows[0], accountId, protectedAccountId, commission, reorder };
  });
}

export async function listProtectedAccounts(
  database: Database,
  workspaceId: string,
  filters: {
    status?: string | undefined; brandId?: string | undefined;
    businessId?: string | undefined; expiringBefore?: string | undefined;
  } = {}
): Promise<Record<string, unknown>[]> {
  const values: unknown[] = [workspaceId];
  const clauses = ["pa.workspace_id=$1", "pa.archived_at IS NULL"];
  if (filters.status) clauses.push(`pa.status=$${values.push(filters.status)}`);
  if (filters.brandId) clauses.push(`pa.brand_id=$${values.push(filters.brandId)}`);
  if (filters.businessId) clauses.push(`pa.business_id=$${values.push(filters.businessId)}`);
  if (filters.expiringBefore) clauses.push(`pa.protection_ends_on<=$${values.push(filters.expiringBefore)}`);
  const result = await database.query<Record<string, unknown>>(
    `SELECT pa.id,pa.account_id AS "accountId",pa.brand_id AS "brandId",
            pa.business_id AS "businessId",pa.agreement_id AS "agreementId",
            pa.origin_order_id AS "originOrderId",pa.origin_date AS "originDate",
            pa.approval_date AS "approvalDate",pa.approved_by AS "approvedBy",
            pa.scope_summary AS "scopeSummary",pa.product_ids AS "productIds",
            pa.channels,pa.territory_scope AS "territoryScope",
            pa.protection_starts_on AS "protectionStartsOn",
            pa.protection_ends_on AS "protectionEndsOn",pa.protection_term AS "protectionTerm",
            pa.renewal_date AS "renewalDate",pa.commission_rights AS "commissionRights",
            pa.reorder_rights AS "reorderRights",
            pa.house_account_exclusions AS "houseAccountExclusions",
            pa.conflict_notes AS "conflictNotes",pa.status,
            pa.supporting_basis_status AS "supportingBasisStatus",
            pa.human_confirmed AS "humanConfirmed",pa.version,
            b.public_name AS "brandName",bu.name AS "businessName"
       FROM protected_accounts pa
       JOIN brands b ON b.workspace_id=pa.workspace_id AND b.id=pa.brand_id
       JOIN businesses bu ON bu.workspace_id=pa.workspace_id AND bu.id=pa.business_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY pa.protection_ends_on,pa.updated_at DESC`,
    values
  );
  return result.rows;
}

export async function createProtectedAccountDraft(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string;
    accountId: string; basisDocumentId: string; originDate: string;
    scopeSummary: string; productIds: string[]; channels: string[];
    territoryScope: Record<string, unknown>; protectionStartsOn: string;
    protectionEndsOn: string; protectionTerm: string; commissionRights: string;
    reorderRights: string; houseAccountExclusions: string; releaseTerms: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    await activeDocument(transaction, input.workspaceId, input.basisDocumentId);
    const account = await oneOrNone<Record<string, unknown>>(
      transaction,
      `SELECT a.*,ra.status AS agreement_status
         FROM accounts a JOIN representation_agreements ra
           ON ra.workspace_id=a.workspace_id AND ra.id=a.agreement_id
        WHERE a.workspace_id=$1 AND a.id=$2 AND a.archived_at IS NULL FOR UPDATE OF a`,
      [input.workspaceId, input.accountId]
    );
    if (!account) throw new AppError(404, "account_not_found", "Account not found.");
    const existing = await oneOrNone<Record<string, unknown>>(
      transaction,
      `SELECT id FROM protected_accounts WHERE workspace_id=$1 AND account_id=$2
        AND status IN ('pending','active','expiring','disputed')`,
      [input.workspaceId, input.accountId]
    );
    if (existing) throw new AppError(409, "protected_account_duplicate", "A current protection review already exists for this Account.");
    const covered = await transaction.query(
      `SELECT product_id FROM representation_agreement_products
        WHERE workspace_id=$1 AND agreement_id=$2 AND product_id=ANY($3::uuid[])`,
      [input.workspaceId, account.agreement_id, input.productIds]
    );
    if (covered.rowCount !== new Set(input.productIds).size || covered.rowCount === 0) {
      throw new AppError(422, "protection_product_out_of_scope", "Protection Products must be within the linked Agreement.");
    }
    const id = newId();
    const artifact = {
      accountId: input.accountId, brandId: account.brand_id,
      businessId: account.business_id, agreementId: account.agreement_id,
      placementId: account.placement_opportunity_id, basisDocumentId: input.basisDocumentId,
      originDate: input.originDate, scopeSummary: input.scopeSummary,
      productIds: input.productIds, channels: input.channels,
      territoryScope: input.territoryScope, startsOn: input.protectionStartsOn,
      endsOn: input.protectionEndsOn, term: input.protectionTerm,
      commissionRights: input.commissionRights, reorderRights: input.reorderRights,
      houseAccountExclusions: input.houseAccountExclusions, releaseTerms: input.releaseTerms
    };
    await transaction.query(
      `INSERT INTO protected_accounts
        (id,workspace_id,account_id,brand_id,business_id,representative_user_id,
         agreement_id,placement_opportunity_id,origin_order_id,basis_document_id,
         origin_date,scope_summary,product_ids,channels,territory_scope,
         protection_starts_on,protection_ends_on,protection_term,commission_rights,
         reorder_rights,house_account_exclusions,release_terms,status,rights_digest,
         supporting_basis_status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
              $19,$20,$21,$22,'pending',$23,'documented')`,
      [id, input.workspaceId, input.accountId, account.brand_id, account.business_id,
        input.actorUserId, account.agreement_id, account.placement_opportunity_id,
        account.opening_order_id, input.basisDocumentId, input.originDate, input.scopeSummary,
        input.productIds, input.channels, input.territoryScope, input.protectionStartsOn,
        input.protectionEndsOn, input.protectionTerm, input.commissionRights,
        input.reorderRights, input.houseAccountExclusions, input.releaseTerms, digest(artifact)]
    );
    await transaction.query(
      `INSERT INTO commercial_document_links
       (workspace_id,subject_type,subject_id,document_id,purpose,linked_by)
       VALUES($1,'protected_account',$2,$3,'rights_basis',$4)`,
      [input.workspaceId, id, input.basisDocumentId, input.actorUserId]
    );
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "protected_account", subjectId: id,
      eventType: "protection.registration_started", actorUserId: input.actorUserId,
      reason: "Documented account-rights basis submitted for overlap and human review",
      requestId: input.requestId, after: artifact
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: "protected_account.created", targetType: "protected_account",
      targetId: id, requestId: input.requestId, after: artifact
    });
    return (await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM protected_accounts WHERE workspace_id=$1 AND id=$2",
      [input.workspaceId, id]
    ))!;
  });
}

export async function getProtectedAccount(
  database: Database,
  workspaceId: string,
  protectedAccountId: string
): Promise<Record<string, unknown>> {
  const protection = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT pa.*,b.public_name AS "brandName",bu.name AS "businessName",
            d.name AS "basisDocumentName",d.status AS "basisDocumentStatus",
            d.scan_status AS "basisDocumentScanStatus"
       FROM protected_accounts pa
       JOIN brands b ON b.workspace_id=pa.workspace_id AND b.id=pa.brand_id
       JOIN businesses bu ON bu.workspace_id=pa.workspace_id AND bu.id=pa.business_id
       LEFT JOIN documents d ON d.workspace_id=pa.workspace_id AND d.id=pa.basis_document_id
      WHERE pa.workspace_id=$1 AND pa.id=$2 AND pa.archived_at IS NULL`,
    [workspaceId, protectedAccountId]
  );
  if (!protection) throw new AppError(404, "protected_account_not_found", "Protected Account not found.");
  const [events, documents, conflicts] = await Promise.all([
    database.query(`SELECT event_type AS "eventType",reason,origin,before_snapshot AS "before",
      after_snapshot AS "after",occurred_at AS "occurredAt" FROM commercial_events
      WHERE workspace_id=$1 AND subject_type='protected_account' AND subject_id=$2
      ORDER BY occurred_at DESC`, [workspaceId, protectedAccountId]),
    database.query(`SELECT d.id,d.name,d.document_type AS "documentType",d.status,d.scan_status AS "scanStatus",l.purpose
      FROM commercial_document_links l JOIN documents d ON d.workspace_id=l.workspace_id AND d.id=l.document_id
      WHERE l.workspace_id=$1 AND l.subject_type='protected_account' AND l.subject_id=$2
      ORDER BY l.linked_at DESC`, [workspaceId, protectedAccountId]),
    database.query(`SELECT id,status,conflict_type AS "conflictType",signals,resolution,updated_at AS "updatedAt"
      FROM placement_conflicts WHERE workspace_id=$1 AND business_id=$2
      ORDER BY updated_at DESC`, [workspaceId, protection.business_id])
  ]);
  return { protection, events: events.rows, documents: documents.rows, conflicts: conflicts.rows };
}

function rightsArtifact(protection: Record<string, unknown>): Record<string, unknown> {
  return {
    id: protection.id, accountId: protection.account_id, brandId: protection.brand_id,
    businessId: protection.business_id, representativeUserId: protection.representative_user_id,
    agreementId: protection.agreement_id, placementId: protection.placement_opportunity_id,
    originOrderId: protection.origin_order_id, basisDocumentId: protection.basis_document_id,
    originDate: protection.origin_date, scopeSummary: protection.scope_summary,
    productIds: protection.product_ids, channels: protection.channels,
    territoryScope: protection.territory_scope, startsOn: protection.protection_starts_on,
    endsOn: protection.protection_ends_on, term: protection.protection_term,
    commissionRights: protection.commission_rights, reorderRights: protection.reorder_rights,
    houseAccountExclusions: protection.house_account_exclusions,
    releaseTerms: protection.release_terms
  };
}

async function protectionOverlap(
  database: Db,
  protection: Record<string, unknown>
): Promise<Record<string, unknown>[]> {
  const result = await database.query<Record<string, unknown>>(
    `SELECT id,account_id AS "accountId",status,product_ids AS "productIds",
            channels,territory_scope AS "territoryScope",
            protection_starts_on AS "startsOn",protection_ends_on AS "endsOn"
       FROM protected_accounts
      WHERE workspace_id=$1 AND id<>$2 AND brand_id=$3 AND business_id=$4
        AND status IN ('pending','active','expiring','disputed')
        AND daterange(protection_starts_on,protection_ends_on,'[]')
            && daterange($5::date,$6::date,'[]')
        AND (
          cardinality(product_ids)=0 OR cardinality($7::uuid[])=0
          OR product_ids && $7::uuid[]
        )
        AND (
          cardinality(channels)=0 OR cardinality($8::text[])=0
          OR channels && $8::text[]
        )`,
    [protection.workspace_id, protection.id, protection.brand_id, protection.business_id,
      protection.protection_starts_on, protection.protection_ends_on,
      protection.product_ids, protection.channels]
  );
  return result.rows;
}

export async function updateProtectedAccountDraft(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string;
    protectedAccountId: string; version: number; basisDocumentId: string;
    scopeSummary: string; productIds: string[]; channels: string[];
    territoryScope: Record<string, unknown>; protectionStartsOn: string;
    protectionEndsOn: string; protectionTerm: string; commissionRights: string;
    reorderRights: string; houseAccountExclusions: string; releaseTerms: string;
    conflictNotes: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const before = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM protected_accounts WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.protectedAccountId]
    );
    if (!before) throw new AppError(404, "protected_account_not_found", "Protected Account not found.");
    if (!["pending","disputed"].includes(String(before.status))) {
      throw new AppError(409, "protected_account_not_editable", "Only pending or disputed protection can be edited; renew active rights through a new reviewed version.");
    }
    await activeDocument(transaction, input.workspaceId, input.basisDocumentId);
    const artifact = {
      ...rightsArtifact(before), basisDocumentId: input.basisDocumentId,
      scopeSummary: input.scopeSummary, productIds: input.productIds, channels: input.channels,
      territoryScope: input.territoryScope, startsOn: input.protectionStartsOn,
      endsOn: input.protectionEndsOn, term: input.protectionTerm,
      commissionRights: input.commissionRights, reorderRights: input.reorderRights,
      houseAccountExclusions: input.houseAccountExclusions, releaseTerms: input.releaseTerms
    };
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE protected_accounts SET basis_document_id=$4,scope_summary=$5,product_ids=$6,
        channels=$7,territory_scope=$8,protection_starts_on=$9,protection_ends_on=$10,
        protection_term=$11,commission_rights=$12,reorder_rights=$13,
        house_account_exclusions=$14,release_terms=$15,conflict_notes=$16,
        rights_digest=$17,supporting_basis_status='documented',
        approval_id=NULL,approved_by=NULL,approval_date=NULL,human_confirmed=false,
        version=version+1,updated_at=now()
       WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.protectedAccountId, input.version, input.basisDocumentId,
        input.scopeSummary, input.productIds, input.channels, input.territoryScope,
        input.protectionStartsOn, input.protectionEndsOn, input.protectionTerm,
        input.commissionRights, input.reorderRights, input.houseAccountExclusions,
        input.releaseTerms, input.conflictNotes, digest(artifact)]
    );
    if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Protection changed. Reload and reconcile.");
    await transaction.query(
      `INSERT INTO commercial_document_links
       (workspace_id,subject_type,subject_id,document_id,purpose,linked_by)
       VALUES($1,'protected_account',$2,$3,'rights_basis',$4)
       ON CONFLICT DO NOTHING`,
      [input.workspaceId, input.protectedAccountId, input.basisDocumentId, input.actorUserId]
    );
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "protected_account",
      subjectId: input.protectedAccountId, eventType: "protection.draft_updated",
      actorUserId: input.actorUserId, reason: "Human-reviewed rights draft updated",
      requestId: input.requestId, before, after: changed.rows[0]
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: "protected_account.updated", targetType: "protected_account",
      targetId: input.protectedAccountId, requestId: input.requestId,
      before, after: changed.rows[0]
    });
    return changed.rows[0];
  });
}

export async function requestProtectedAccountApproval(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; protectedAccountId: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const protection = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM protected_accounts WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.protectedAccountId]
    );
    if (!protection) throw new AppError(404, "protected_account_not_found", "Protected Account not found.");
    if (protection.status !== "pending") {
      throw new AppError(409, "protection_approval_state_invalid", "Only pending protection can be approved.");
    }
    if (protection.supporting_basis_status !== "documented" || !protection.basis_document_id) {
      throw new AppError(409, "protection_basis_unverified", "Documented rights basis and exact reviewed scope are required.");
    }
    await activeDocument(transaction, input.workspaceId, databaseText(protection.basis_document_id));
    const overlaps = await protectionOverlap(transaction, protection);
    if (overlaps.length > 0) {
      await transaction.query(
        `UPDATE protected_accounts SET status='disputed',
          conflict_notes=concat_ws(E'\\n',NULLIF(conflict_notes,''),$3),
          version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, input.protectedAccountId,
          `Blocking overlap requires human resolution: ${overlaps.map((item) => item.id).join(", ")}`]
      );
      throw new AppError(409, "protected_account_overlap", "Protection overlaps another pending or active claim. Resolve the conflict before approval.");
    }
    const artifact = rightsArtifact(protection);
    const artifactDigest = digest(artifact);
    const approvalId = newId();
    await transaction.query(
      `INSERT INTO human_approvals
       (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,
        approver_user_id,status,scope)
       VALUES($1,$2,'protected_account',$3,'activate_protection',$4,$5,'requested',$6)`,
      [approvalId, input.workspaceId, input.protectedAccountId, artifactDigest,
        input.actorUserId, `Exact documented protection scope ${artifactDigest}`]
    );
    await transaction.query(
      `UPDATE protected_accounts SET approval_id=$3,rights_digest=$4,version=version+1,
        updated_at=now() WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, input.protectedAccountId, approvalId, artifactDigest]
    );
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "protected_account",
      subjectId: input.protectedAccountId, eventType: "protection.approval_requested",
      actorUserId: input.actorUserId, reason: "Exact documentary rights submitted for human approval",
      requestId: input.requestId, after: { approvalId, artifactDigest }
    });
    return { id: approvalId, artifactDigest, status: "requested" };
  });
}

export async function decideProtectedAccountApproval(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string;
    protectedAccountId: string; approvalId: string;
    decision: "approved" | "rejected" | "changes_required"; conditions: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const protection = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM protected_accounts WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.protectedAccountId]
    );
    const approval = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM human_approvals WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.approvalId]
    );
    if (!protection || !approval || approval.subject_id !== input.protectedAccountId ||
        protection.approval_id !== input.approvalId || approval.status !== "requested") {
      throw new AppError(409, "protection_approval_invalid", "Protection approval is not current.");
    }
    const currentDigest = digest(rightsArtifact(protection));
    if (currentDigest !== approval.artifact_digest || currentDigest !== protection.rights_digest) {
      await transaction.query(
        "UPDATE human_approvals SET status='expired',decided_at=now() WHERE id=$1",
        [input.approvalId]
      );
      throw new AppError(409, "protection_approval_stale", "Protection scope changed; request a fresh approval.");
    }
    if (input.decision === "approved") {
      const overlaps = await protectionOverlap(transaction, protection);
      if (overlaps.length > 0) throw new AppError(409, "protected_account_overlap", "A current overlap blocks activation.");
    }
    await transaction.query(
      `UPDATE human_approvals SET status=$2,conditions=$3,decided_at=now() WHERE id=$1`,
      [input.approvalId, input.decision, input.conditions]
    );
    const status = input.decision === "approved" ? "active" : "pending";
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE protected_accounts SET status=$3,
        approved_by=CASE WHEN $3='active' THEN $4::uuid ELSE NULL END,
        approval_date=CASE WHEN $3='active' THEN CURRENT_DATE ELSE NULL END,
        human_confirmed=($3='active'),version=version+1,updated_at=now()
       WHERE workspace_id=$1 AND id=$2 RETURNING *`,
      [input.workspaceId, input.protectedAccountId, status, input.actorUserId]
    );
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "protected_account",
      subjectId: input.protectedAccountId,
      eventType: `protection.${input.decision}`,
      actorUserId: input.actorUserId, reason: input.conditions || input.decision,
      requestId: input.requestId, before: protection, after: changed.rows[0]
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: `protected_account.${input.decision}`,
      targetType: "protected_account", targetId: input.protectedAccountId,
      requestId: input.requestId, before: protection, after: changed.rows[0]
    });
    if (input.decision === "approved") {
      await scheduleProtectionJobs(transaction, {
        workspaceId: input.workspaceId, protectedAccountId: input.protectedAccountId,
        endsOn: dateOnly(protection.protection_ends_on),
        actorUserId: input.actorUserId
      });
    }
    return changed.rows[0]!;
  });
}

export async function changeProtectedAccountStatus(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string;
    protectedAccountId: string; version: number;
    action: "renew" | "release" | "end"; reason: string;
    newEndsOn?: string | null | undefined; evidenceDocumentId: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const before = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM protected_accounts WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.protectedAccountId]
    );
    if (!before) throw new AppError(404, "protected_account_not_found", "Protected Account not found.");
    await activeDocument(transaction, input.workspaceId, input.evidenceDocumentId);
    if (input.action === "renew") {
      if (!input.newEndsOn || input.newEndsOn <= dateOnly(before.protection_ends_on)) {
        throw new AppError(422, "renewal_term_invalid", "Renewal requires a later documented protection end date.");
      }
      const changed = await transaction.query<Record<string, unknown>>(
        `UPDATE protected_accounts SET protection_ends_on=$4,renewal_date=CURRENT_DATE,
          basis_document_id=$5,status='pending',supporting_basis_status='documented',
          approval_id=NULL,approved_by=NULL,approval_date=NULL,human_confirmed=false,
          rights_digest=$6,version=version+1,updated_at=now()
         WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
        [input.workspaceId, input.protectedAccountId, input.version, input.newEndsOn,
          input.evidenceDocumentId, digest({ ...rightsArtifact(before), endsOn: input.newEndsOn,
            basisDocumentId: input.evidenceDocumentId })]
      );
      if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Protection changed. Reload and reconcile.");
      await commercialEvent(transaction, {
        workspaceId: input.workspaceId, subjectType: "protected_account",
        subjectId: input.protectedAccountId, eventType: "protection.renewal_proposed",
        actorUserId: input.actorUserId, reason: input.reason, requestId: input.requestId,
        before, after: changed.rows[0]
      });
      return changed.rows[0];
    }
    const status = input.action === "release" ? "released" : "ended";
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE protected_accounts SET status=$4,version=version+1,updated_at=now()
       WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.protectedAccountId, input.version, status]
    );
    if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Protection changed. Reload and reconcile.");
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "protected_account",
      subjectId: input.protectedAccountId, eventType: `protection.${status}`,
      actorUserId: input.actorUserId, reason: input.reason, requestId: input.requestId,
      before, after: changed.rows[0]
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: `protected_account.${status}`, targetType: "protected_account",
      targetId: input.protectedAccountId, requestId: input.requestId,
      before, after: changed.rows[0]
    });
    return changed.rows[0];
  });
}

export async function updateAccount(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; accountId: string;
    version: number; status: "onboarding" | "active" | "at_risk" | "paused" | "ended";
    health: "unknown" | "healthy" | "watch" | "at_risk" | "inactive";
    healthRationale: string; endedReason?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const before = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM accounts WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.accountId]
    );
    if (!before) throw new AppError(404, "account_not_found", "Account not found.");
    if (input.healthRationale.trim().length < 10) {
      throw new AppError(422, "account_health_rationale_required", "Account health changes require a factual rationale.");
    }
    if (input.status === "ended" && !input.endedReason?.trim()) {
      throw new AppError(422, "account_end_reason_required", "Ending an Account requires a reason.");
    }
    if (before.status === "ended" && input.status !== "ended") {
      const agreement = await oneOrNone<Record<string, unknown>>(
        transaction,
        `SELECT status,effective_at,expires_at FROM representation_agreements
          WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, before.agreement_id]
      );
      if (!agreement || agreement.status !== "active") {
        throw new AppError(409, "account_reactivation_authority_missing", "Reactivation requires a current active Agreement and human review.");
      }
    }
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE accounts SET status=$4,health=$5,health_rationale=$6,
        ended_at=CASE WHEN $4='ended' THEN now() ELSE NULL END,
        ended_reason=CASE WHEN $4='ended' THEN $7 ELSE NULL END,
        reactivated_at=CASE WHEN status='ended' AND $4<>'ended' THEN now() ELSE reactivated_at END,
        version=version+1,updated_at=now()
       WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.accountId, input.version, input.status, input.health,
        input.healthRationale, input.endedReason ?? null]
    );
    if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Account changed. Reload and reconcile.");
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "account", subjectId: input.accountId,
      eventType: `account.${input.status}`, actorUserId: input.actorUserId,
      reason: input.endedReason ?? input.healthRationale, requestId: input.requestId,
      before, after: changed.rows[0]
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: `account.${input.status}`, targetType: "account", targetId: input.accountId,
      requestId: input.requestId, before, after: changed.rows[0]
    });
    return changed.rows[0];
  });
}

export async function correctOrder(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; orderId: string;
    version: number; reason: string; sourceDocumentId: string;
    status: "draft" | "submitted" | "confirmed" | "fulfilled" | "partially_returned" | "returned" | "canceled";
    paymentStatus: "unknown" | "unpaid" | "partially_paid" | "paid" | "refunded" | "chargeback";
    fulfillmentStatus: "unknown" | "unfulfilled" | "partial" | "fulfilled" | "returned" | "canceled";
    lines: OrderLineInput[];
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const before = await orderSnapshot(transaction, input.workspaceId, input.orderId);
    const order = before;
    if (Number(order.version) !== input.version) {
      throw new AppError(409, "version_conflict", "Order changed. Reload and reconcile.");
    }
    await activeDocument(transaction, input.workspaceId, input.sourceDocumentId);
    const existingProducts = await transaction.query<{ productId: string }>(
      `SELECT product_id AS "productId" FROM placement_opportunity_products
        WHERE workspace_id=$1 AND placement_opportunity_id=$2`,
      [input.workspaceId, order.placementOpportunityId]
    );
    const permitted = new Set(existingProducts.rows.map((item) => item.productId));
    if (input.lines.some((line) => !permitted.has(line.productId))) {
      throw new AppError(422, "order_product_out_of_scope", "Corrected lines must remain within Placement Product scope.");
    }
    const totals = sumLines(input.lines);
    await transaction.query(
      "DELETE FROM order_line_items WHERE workspace_id=$1 AND order_id=$2",
      [input.workspaceId, input.orderId]
    );
    for (const line of input.lines) {
      const values = lineValues(line);
      await transaction.query(
        `INSERT INTO order_line_items
          (id,workspace_id,order_id,product_id,description,quantity,unit_wholesale_price,
           gross_amount,discount_amount,return_amount,cancellation_amount,
           commission_eligible,net_commissionable)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [newId(), input.workspaceId, input.orderId, line.productId, line.description,
          line.quantity, line.unitWholesalePrice, values.gross, values.discount,
          values.returned, values.canceled, line.commissionEligible ?? true,
          line.commissionEligible === false ? "0.00" : values.net]
      );
    }
    const revision = Number(order.currentRevision) + 1;
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE orders SET wholesale_gross=$4,discounts=$5,returns=$6,cancellations=$7,
        net_commissionable=$8,status=$9,payment_status=$10,fulfillment_status=$11,
        source_document_id=$12,current_revision=$13,
        verification_status=CASE WHEN verification_status='verified' THEN 'review_required'
          ELSE verification_status END,
        version=version+1,updated_at=now()
       WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.orderId, input.version, totals.gross, totals.discounts,
        totals.returns, totals.cancellations, totals.net, input.status, input.paymentStatus,
        input.fulfillmentStatus, input.sourceDocumentId, revision]
    );
    if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Order changed during correction.");
    const after = await appendOrderRevision(transaction, {
      workspaceId: input.workspaceId, orderId: input.orderId, revision,
      reason: input.reason, sourceDocumentId: input.sourceDocumentId,
      actorUserId: input.actorUserId
    });
    const commission = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM commissions WHERE workspace_id=$1 AND order_id=$2 FOR UPDATE",
      [input.workspaceId, input.orderId]
    );
    let calculation: Record<string, unknown> | null = null;
    if (commission) {
      calculation = await calculateCommission(transaction, {
        workspaceId: input.workspaceId, commissionId: String(commission.id),
        agreementId: String(commission.agreement_id), orderId: input.orderId,
        actorUserId: input.actorUserId, reason: input.reason
      });
      if (["approved","payable","paid"].includes(String(commission.status))) {
        const taskId = newId();
        await transaction.query(
          `INSERT INTO tasks
            (id,workspace_id,subject_type,subject_id,title,owner_user_id,status,priority,
             created_reason,mandatory_gate)
           VALUES($1,$2,'commission',$3,'Reconcile Commission after Order correction',
                  $4,'open','critical',$5,true)`,
          [taskId, input.workspaceId, commission.id, input.actorUserId,
            "Approved or paid amount retained; expected calculation changed"]
        );
      }
    }
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "order", subjectId: input.orderId,
      eventType: "order.corrected", actorUserId: input.actorUserId, reason: input.reason,
      requestId: input.requestId, before, after, metadata: { calculation }
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: "order.corrected", targetType: "order", targetId: input.orderId,
      requestId: input.requestId, before, after
    });
    return { order: changed.rows[0], revision: after, calculation };
  });
}

export async function listCommissions(
  database: Database,
  workspaceId: string,
  filters: {
    status?: string | undefined; accountId?: string | undefined;
    overdue?: boolean | undefined;
  } = {}
): Promise<Record<string, unknown>[]> {
  const values: unknown[] = [workspaceId];
  const clauses = ["c.workspace_id=$1", "c.archived_at IS NULL"];
  if (filters.status) clauses.push(`c.status=$${values.push(filters.status)}`);
  if (filters.accountId) clauses.push(`c.account_id=$${values.push(filters.accountId)}`);
  if (filters.overdue) clauses.push("c.payment_due_date<CURRENT_DATE AND c.status IN ('approved','payable')");
  const result = await database.query<Record<string, unknown>>(
    `${commissionSelect} WHERE ${clauses.join(" AND ")}
      ORDER BY c.payment_due_date NULLS LAST,c.updated_at DESC`,
    values
  );
  return result.rows;
}

export async function getCommission(
  database: Database,
  workspaceId: string,
  commissionId: string
): Promise<Record<string, unknown>> {
  const commission = await oneOrNone<Record<string, unknown>>(
    database, `${commissionSelect} WHERE c.workspace_id=$1 AND c.id=$2 AND c.archived_at IS NULL`,
    [workspaceId, commissionId]
  );
  if (!commission) throw new AppError(404, "commission_not_found", "Commission not found.");
  const [calculations, disputes, events, documents] = await Promise.all([
    database.query(`SELECT id,calculation_version AS "calculationVersion",
      agreement_id AS "agreementId",order_id AS "orderId",order_revision AS "orderRevision",
      currency,gross_amount::text AS "grossAmount",eligible_amount::text AS "eligibleAmount",
      discounts::text,returns::text,cancellations::text,
      commissionable_amount::text AS "commissionableAmount",basis_type AS "basisType",
      rate::text,result_amount::text AS "resultAmount",formula,
      rounding_rule AS "roundingRule",input_snapshot AS "inputSnapshot",reason,
      created_by AS "createdBy",created_at AS "createdAt"
      FROM commission_calculations WHERE workspace_id=$1 AND commission_id=$2
      ORDER BY calculation_version DESC`, [workspaceId, commissionId]),
    database.query(`SELECT id,status,reason_code AS "reasonCode",reason,
      disputed_amount::text AS "disputedAmount",currency,next_action AS "nextAction",
      brand_response AS "brandResponse",resolution_amount::text AS "resolutionAmount",
      resolution,resolution_date AS "resolutionDate",version,created_at AS "createdAt",
      updated_at AS "updatedAt" FROM commission_disputes
      WHERE workspace_id=$1 AND commission_id=$2 AND archived_at IS NULL
      ORDER BY created_at DESC`, [workspaceId, commissionId]),
    database.query(`SELECT event_type AS "eventType",reason,origin,before_snapshot AS "before",
      after_snapshot AS "after",occurred_at AS "occurredAt" FROM commercial_events
      WHERE workspace_id=$1 AND subject_type='commission' AND subject_id=$2
      ORDER BY occurred_at DESC`, [workspaceId, commissionId]),
    database.query(`SELECT d.id,d.name,d.document_type AS "documentType",d.status,d.scan_status AS "scanStatus",l.purpose
      FROM commercial_document_links l JOIN documents d ON d.workspace_id=l.workspace_id AND d.id=l.document_id
      WHERE l.workspace_id=$1 AND l.subject_type='commission' AND l.subject_id=$2
      ORDER BY l.linked_at DESC`, [workspaceId, commissionId])
  ]);
  return { commission, calculations: calculations.rows, disputes: disputes.rows,
    events: events.rows, documents: documents.rows };
}

export async function transitionCommission(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string;
    commissionId: string; version: number;
    toStatus: "pending_verification" | "approved" | "payable" | "paid" | "canceled" | "clawed_back";
    reason: string; sourceDocumentId: string;
    verifiedAmount?: string | null | undefined; approvedAmount?: string | null | undefined;
    paidAmount?: string | null | undefined; paymentDueDate?: string | null | undefined;
    paymentDate?: string | null | undefined; clawbackAmount?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const before = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM commissions WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.commissionId]
    );
    if (!before) throw new AppError(404, "commission_not_found", "Commission not found.");
    if (Number(before.version) !== input.version) throw new AppError(409, "version_conflict", "Commission changed. Reload and reconcile.");
    await activeDocument(transaction, input.workspaceId, input.sourceDocumentId);
    const allowed: Record<string, string[]> = {
      estimated: ["pending_verification","canceled"],
      pending_verification: ["approved","canceled"],
      approved: ["payable","canceled","clawed_back"],
      payable: ["paid","canceled","clawed_back"],
      paid: ["clawed_back"],
      disputed: ["approved","canceled","clawed_back"],
      canceled: [], clawed_back: []
    };
    if (!allowed[String(before.status)]?.includes(input.toStatus)) {
      throw new AppError(409, "commission_transition_invalid", `Cannot move ${String(before.status)} to ${input.toStatus}.`);
    }
    if (input.toStatus === "pending_verification") {
      const order = await oneOrNone<Record<string, unknown>>(
        transaction, "SELECT verification_status FROM orders WHERE workspace_id=$1 AND id=$2",
        [input.workspaceId, before.order_id]
      );
      if (order?.verification_status !== "verified") {
        throw new AppError(409, "verified_order_required", "Commission verification requires a currently verified Order revision.");
      }
    }
    if (input.toStatus === "approved" && (!input.verifiedAmount || !input.approvedAmount)) {
      throw new AppError(422, "commission_approval_amounts_required", "Verified and approved amounts are required.");
    }
    if (input.toStatus === "payable" && !input.paymentDueDate) {
      throw new AppError(422, "commission_due_date_required", "Payable Commission requires a due date.");
    }
    if (input.toStatus === "paid" && (!input.paidAmount || !input.paymentDate)) {
      throw new AppError(422, "commission_payment_evidence_required", "Paid requires amount, date, source, and human confirmation.");
    }
    if (input.toStatus === "clawed_back" && !input.clawbackAmount) {
      throw new AppError(422, "clawback_amount_required", "Clawback requires an amount and documented reason.");
    }
    for (const value of [input.verifiedAmount, input.approvedAmount, input.paidAmount, input.clawbackAmount]) {
      if (value) minorUnits(value);
    }
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE commissions SET status=$4,source_document_id=$5,
        verified_amount=COALESCE($6,verified_amount),
        approved_amount=COALESCE($7,approved_amount),
        paid_amount=COALESCE($8,paid_amount),
        payment_due_date=COALESCE($9,payment_due_date),
        payment_date=COALESCE($10,payment_date),
        clawback_amount=COALESCE($11,clawback_amount),
        clawback_status=CASE WHEN $4='clawed_back' THEN 'applied' ELSE clawback_status END,
        human_verified_by=CASE WHEN $4 IN ('pending_verification','approved') THEN $12 ELSE human_verified_by END,
        human_verified_at=CASE WHEN $4 IN ('pending_verification','approved') THEN now() ELSE human_verified_at END,
        approved_by=CASE WHEN $4='approved' THEN $12 ELSE approved_by END,
        approved_at=CASE WHEN $4='approved' THEN now() ELSE approved_at END,
        payment_confirmed_by=CASE WHEN $4='paid' THEN $12 ELSE payment_confirmed_by END,
        version=version+1,updated_at=now()
       WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.commissionId, input.version, input.toStatus,
        input.sourceDocumentId, input.verifiedAmount ?? null, input.approvedAmount ?? null,
        input.paidAmount ?? null, input.paymentDueDate ?? null, input.paymentDate ?? null,
        input.clawbackAmount ?? null, input.actorUserId]
    );
    if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Commission changed during transition.");
    await transaction.query(
      `INSERT INTO commercial_document_links
       (workspace_id,subject_type,subject_id,document_id,purpose,linked_by)
       VALUES($1,'commission',$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [input.workspaceId, input.commissionId, input.sourceDocumentId,
        `commission_${input.toStatus}_evidence`, input.actorUserId]
    );
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "commission",
      subjectId: input.commissionId, eventType: `commission.${input.toStatus}`,
      actorUserId: input.actorUserId, reason: input.reason, requestId: input.requestId,
      before, after: changed.rows[0]
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: `commission.${input.toStatus}`, targetType: "commission",
      targetId: input.commissionId, requestId: input.requestId,
      before, after: changed.rows[0]
    });
    if (input.toStatus === "payable" && input.paymentDueDate) {
      await enqueueJob(transaction, {
        workspaceId: input.workspaceId, kind: "commerce.commission_due",
        idempotencyKey: `commission-due:${input.commissionId}:${input.paymentDueDate}`,
        availableAt: new Date(`${input.paymentDueDate}T12:00:00.000Z`),
        payload: { commissionId: input.commissionId, actorUserId: input.actorUserId }
      });
    }
    return changed.rows[0];
  });
}

export async function listReorders(
  database: Database,
  workspaceId: string,
  filters: {
    status?: string | undefined; health?: string | undefined;
    dueBefore?: string | undefined;
  } = {}
): Promise<Record<string, unknown>[]> {
  const values: unknown[] = [workspaceId];
  const clauses = ["r.workspace_id=$1", "r.archived_at IS NULL"];
  if (filters.status) clauses.push(`r.status=$${values.push(filters.status)}`);
  if (filters.health) clauses.push(`r.account_health=$${values.push(filters.health)}`);
  if (filters.dueBefore) clauses.push(`r.expected_window_starts_on<=$${values.push(filters.dueBefore)}`);
  const result = await database.query<Record<string, unknown>>(
    `SELECT r.id,r.account_id AS "accountId",r.protected_account_id AS "protectedAccountId",
            r.prior_order_id AS "priorOrderId",r.new_order_id AS "newOrderId",
            r.last_order_date AS "lastOrderDate",
            r.expected_window_starts_on AS "expectedWindowStartsOn",
            r.expected_window_ends_on AS "expectedWindowEndsOn",
            r.average_order_size::text AS "averageOrderSize",r.currency,r.status,
            r.account_health AS "accountHealth",r.health_rationale AS "healthRationale",
            r.reminder_at AS "reminderAt",r.next_action AS "nextAction",
            r.likelihood_label AS "likelihoodLabel",r.likelihood_origin AS "likelihoodOrigin",
            r.estimate_explanation AS "estimateExplanation",
            r.recommended_follow_up AS "recommendedFollowUp",
            r.recommendation_origin AS "recommendationOrigin",
            r.defer_or_close_reason AS "deferOrCloseReason",r.version,
            b.public_name AS "brandName",bu.name AS "businessName",a.status AS "accountStatus",
            pa.status AS "protectionStatus",o.order_number AS "priorOrderNumber"
       FROM reorders r JOIN accounts a ON a.workspace_id=r.workspace_id AND a.id=r.account_id
       JOIN brands b ON b.workspace_id=a.workspace_id AND b.id=a.brand_id
       JOIN businesses bu ON bu.workspace_id=a.workspace_id AND bu.id=a.business_id
       JOIN orders o ON o.workspace_id=r.workspace_id AND o.id=r.prior_order_id
       LEFT JOIN protected_accounts pa ON pa.workspace_id=r.workspace_id AND pa.id=r.protected_account_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY r.expected_window_starts_on NULLS LAST,r.updated_at DESC`,
    values
  );
  return result.rows;
}

export async function updateReorder(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; reorderId: string;
    version: number; status: "projected" | "due" | "contacted" | "deferred" | "not_expected" | "closed";
    expectedWindowStartsOn?: string | null | undefined;
    expectedWindowEndsOn?: string | null | undefined;
    reminderAt?: string | null | undefined;
    accountHealth: "unknown" | "healthy" | "watch" | "at_risk" | "inactive";
    healthRationale: string; nextAction: string;
    likelihoodLabel?: "low" | "medium" | "high" | null | undefined;
    likelihoodOrigin?: "user_entered" | "system_estimate" | null | undefined;
    estimateExplanation: string; recommendedFollowUp: string;
    deferOrCloseReason?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const before = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM reorders WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.reorderId]
    );
    if (!before) throw new AppError(404, "reorder_not_found", "Reorder review not found.");
    if (input.healthRationale.trim().length < 10) {
      throw new AppError(422, "reorder_health_rationale_required", "Account health requires a factual rationale.");
    }
    if (["deferred","not_expected","closed"].includes(input.status) && !input.deferOrCloseReason?.trim()) {
      throw new AppError(422, "reorder_outcome_reason_required", "Deferral, not expected, and closure require a reason.");
    }
    if (input.likelihoodOrigin === "system_estimate" && !input.estimateExplanation.trim()) {
      throw new AppError(422, "reorder_estimate_explanation_required", "System estimates require a visible method and limitation.");
    }
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE reorders SET status=$4,expected_window_starts_on=$5,
        expected_window_ends_on=$6,reminder_at=$7,account_health=$8,
        health_rationale=$9,next_action=$10,likelihood_label=$11,
        likelihood_origin=$12,estimate_explanation=$13,recommended_follow_up=$14,
        recommendation_origin='user_entered',defer_or_close_reason=$15,
        version=version+1,updated_at=now()
       WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.reorderId, input.version, input.status,
        input.expectedWindowStartsOn ?? null, input.expectedWindowEndsOn ?? null,
        input.reminderAt ?? null, input.accountHealth, input.healthRationale,
        input.nextAction, input.likelihoodLabel ?? null, input.likelihoodOrigin ?? null,
        input.estimateExplanation, input.recommendedFollowUp,
        input.deferOrCloseReason ?? null]
    );
    if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Reorder review changed. Reload and reconcile.");
    await transaction.query(
      `UPDATE accounts SET health=$3,health_rationale=$4,
        status=CASE WHEN $3='at_risk' THEN 'at_risk'
          WHEN $3='inactive' THEN 'paused' ELSE status END,
        version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, before.account_id, input.accountHealth, input.healthRationale]
    );
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "reorder", subjectId: input.reorderId,
      eventType: `reorder.${input.status}`, actorUserId: input.actorUserId,
      reason: input.deferOrCloseReason ?? input.nextAction, requestId: input.requestId,
      before, after: changed.rows[0]
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: `reorder.${input.status}`, targetType: "reorder",
      targetId: input.reorderId, requestId: input.requestId,
      before, after: changed.rows[0]
    });
    if (input.reminderAt) {
      await enqueueJob(transaction, {
        workspaceId: input.workspaceId, kind: "commerce.reorder_due",
        idempotencyKey: `reorder-due:${input.reorderId}:${input.reminderAt}`,
        availableAt: new Date(input.reminderAt),
        payload: { reorderId: input.reorderId, actorUserId: input.actorUserId }
      });
    }
    return changed.rows[0];
  });
}

export async function listCommissionDisputes(
  database: Database,
  workspaceId: string,
  filters: { status?: string | undefined; commissionId?: string | undefined } = {}
): Promise<Record<string, unknown>[]> {
  const values: unknown[] = [workspaceId];
  const clauses = ["d.workspace_id=$1", "d.archived_at IS NULL"];
  if (filters.status) clauses.push(`d.status=$${values.push(filters.status)}`);
  if (filters.commissionId) clauses.push(`d.commission_id=$${values.push(filters.commissionId)}`);
  const result = await database.query<Record<string, unknown>>(
    `SELECT d.id,d.commission_id AS "commissionId",d.order_id AS "orderId",
            d.agreement_id AS "agreementId",d.reason_code AS "reasonCode",d.reason,
            d.disputed_amount::text AS "disputedAmount",d.currency,d.status,
            d.owner_user_id AS "ownerUserId",d.next_action AS "nextAction",
            d.brand_response AS "brandResponse",
            d.resolution_amount::text AS "resolutionAmount",d.resolution,
            d.resolution_date AS "resolutionDate",d.version,
            d.created_at AS "createdAt",d.updated_at AS "updatedAt",
            b.public_name AS "brandName",bu.name AS "businessName",o.order_number AS "orderNumber"
       FROM commission_disputes d
       JOIN commissions c ON c.workspace_id=d.workspace_id AND c.id=d.commission_id
       JOIN brands b ON b.workspace_id=c.workspace_id AND b.id=c.brand_id
       JOIN accounts a ON a.workspace_id=c.workspace_id AND a.id=c.account_id
       JOIN businesses bu ON bu.workspace_id=a.workspace_id AND bu.id=a.business_id
       JOIN orders o ON o.workspace_id=d.workspace_id AND o.id=d.order_id
      WHERE ${clauses.join(" AND ")} ORDER BY d.updated_at DESC`,
    values
  );
  return result.rows;
}

export async function getCommissionDispute(
  database: Database,
  workspaceId: string,
  disputeId: string
): Promise<Record<string, unknown>> {
  const dispute = await oneOrNone<Record<string, unknown>>(
    database,
    `SELECT d.*,c.expected_amount::text AS "expectedAmount",
            c.approved_amount::text AS "approvedAmount",c.paid_amount::text AS "paidAmount",
            c.status AS "commissionStatus",o.order_number AS "orderNumber"
       FROM commission_disputes d
       JOIN commissions c ON c.workspace_id=d.workspace_id AND c.id=d.commission_id
       JOIN orders o ON o.workspace_id=d.workspace_id AND o.id=d.order_id
      WHERE d.workspace_id=$1 AND d.id=$2 AND d.archived_at IS NULL`,
    [workspaceId, disputeId]
  );
  if (!dispute) throw new AppError(404, "commission_dispute_not_found", "Commission Dispute not found.");
  const [events, notes, documents] = await Promise.all([
    database.query(`SELECT event_type AS "eventType",reason,origin,before_snapshot AS "before",
      after_snapshot AS "after",occurred_at AS "occurredAt" FROM commercial_events
      WHERE workspace_id=$1 AND subject_type='commission_dispute' AND subject_id=$2
      ORDER BY occurred_at DESC`, [workspaceId, disputeId]),
    database.query(`SELECT id,body,note_type AS "noteType",author_user_id AS "authorUserId",
      created_at AS "createdAt",updated_at AS "updatedAt" FROM notes
      WHERE workspace_id=$1 AND subject_type='commission_dispute' AND subject_id=$2
      AND archived_at IS NULL ORDER BY created_at DESC`, [workspaceId, disputeId]),
    database.query(`SELECT d.id,d.name,d.document_type AS "documentType",d.status,d.scan_status AS "scanStatus",l.purpose
      FROM commercial_document_links l JOIN documents d ON d.workspace_id=l.workspace_id AND d.id=l.document_id
      WHERE l.workspace_id=$1 AND l.subject_type='commission_dispute' AND l.subject_id=$2
      ORDER BY l.linked_at DESC`, [workspaceId, disputeId])
  ]);
  return { dispute, events: events.rows, notes: notes.rows, documents: documents.rows };
}

export async function openCommissionDispute(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; commissionId: string;
    reasonCode: string; reason: string; disputedAmount: string; evidenceDocumentId: string;
    nextAction: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    minorUnits(input.disputedAmount);
    await activeDocument(transaction, input.workspaceId, input.evidenceDocumentId);
    const commission = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM commissions WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.commissionId]
    );
    if (!commission) throw new AppError(404, "commission_not_found", "Commission not found.");
    if (["canceled","clawed_back"].includes(String(commission.status))) {
      throw new AppError(409, "commission_dispute_state_invalid", "This Commission state requires a documented correction before dispute.");
    }
    const duplicate = await oneOrNone<Record<string, unknown>>(
      transaction,
      `SELECT id FROM commission_disputes WHERE workspace_id=$1 AND commission_id=$2
        AND status NOT IN ('resolved','rejected','withdrawn')`,
      [input.workspaceId, input.commissionId]
    );
    if (duplicate) throw new AppError(409, "commission_dispute_duplicate", "An active dispute already exists.");
    const disputeId = newId();
    await transaction.query(
      `INSERT INTO commission_disputes
        (id,workspace_id,commission_id,order_id,agreement_id,opened_by,owner_user_id,
         reason_code,reason,disputed_amount,currency,status,next_action)
       VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,'opened',$11)`,
      [disputeId, input.workspaceId, input.commissionId, commission.order_id,
        commission.agreement_id, input.actorUserId, input.reasonCode, input.reason,
        input.disputedAmount, commission.currency, input.nextAction]
    );
    await transaction.query(
      `UPDATE commissions SET status='disputed',dispute_status='open',
        version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, input.commissionId]
    );
    await transaction.query(
      `INSERT INTO commercial_document_links
       (workspace_id,subject_type,subject_id,document_id,purpose,linked_by)
       VALUES($1,'commission_dispute',$2,$3,'initial_dispute_evidence',$4)`,
      [input.workspaceId, disputeId, input.evidenceDocumentId, input.actorUserId]
    );
    const taskId = newId();
    await transaction.query(
      `INSERT INTO tasks
        (id,workspace_id,subject_type,subject_id,title,owner_user_id,status,priority,
         created_reason,mandatory_gate)
       VALUES($1,$2,'commission_dispute',$3,$4,$5,'open','high',$6,true)`,
      [taskId, input.workspaceId, disputeId, input.nextAction, input.actorUserId,
        "Commission dispute opened with evidence"]
    );
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "commission_dispute",
      subjectId: disputeId, eventType: "dispute.opened", actorUserId: input.actorUserId,
      reason: input.reason, requestId: input.requestId,
      after: { commissionId: input.commissionId, disputedAmount: input.disputedAmount,
        evidenceDocumentId: input.evidenceDocumentId, taskId }
    });
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "commission",
      subjectId: input.commissionId, eventType: "commission.disputed",
      actorUserId: input.actorUserId, reason: input.reason, requestId: input.requestId,
      before: commission, after: { status: "disputed", disputeId }
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: "commission_dispute.opened", targetType: "commission_dispute",
      targetId: disputeId, requestId: input.requestId,
      after: { commissionId: input.commissionId, disputedAmount: input.disputedAmount }
    });
    return (await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM commission_disputes WHERE workspace_id=$1 AND id=$2",
      [input.workspaceId, disputeId]
    ))!;
  });
}

export async function updateCommissionDispute(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; disputeId: string;
    version: number; status: "evidence_needed" | "submitted" | "under_review" | "rejected" | "withdrawn";
    nextAction: string; brandResponse: string; reason: string;
    evidenceDocumentId?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const before = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM commission_disputes WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.disputeId]
    );
    if (!before) throw new AppError(404, "commission_dispute_not_found", "Commission Dispute not found.");
    if (["resolved","rejected","withdrawn"].includes(String(before.status))) {
      throw new AppError(409, "dispute_closed", "Closed dispute history cannot be rewritten.");
    }
    if (input.evidenceDocumentId) {
      await activeDocument(transaction, input.workspaceId, input.evidenceDocumentId);
      await transaction.query(
        `INSERT INTO commercial_document_links
         (workspace_id,subject_type,subject_id,document_id,purpose,linked_by)
         VALUES($1,'commission_dispute',$2,$3,'additional_evidence',$4)
         ON CONFLICT DO NOTHING`,
        [input.workspaceId, input.disputeId, input.evidenceDocumentId, input.actorUserId]
      );
    }
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE commission_disputes SET status=$4,next_action=$5,brand_response=$6,
        version=version+1,updated_at=now()
       WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.disputeId, input.version, input.status,
        input.nextAction, input.brandResponse]
    );
    if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Dispute changed. Reload and reconcile.");
    if (["rejected","withdrawn"].includes(input.status)) {
      await transaction.query(
        `UPDATE commissions SET status=CASE WHEN approved_amount IS NOT NULL THEN 'approved'
          ELSE 'pending_verification' END,dispute_status=$3,version=version+1,updated_at=now()
         WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, before.commission_id,
          input.status === "withdrawn" ? "withdrawn" : "resolved"]
      );
    }
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "commission_dispute",
      subjectId: input.disputeId, eventType: `dispute.${input.status}`,
      actorUserId: input.actorUserId, reason: input.reason, requestId: input.requestId,
      before, after: changed.rows[0],
      metadata: { evidenceDocumentId: input.evidenceDocumentId ?? null }
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: `commission_dispute.${input.status}`, targetType: "commission_dispute",
      targetId: input.disputeId, requestId: input.requestId,
      before, after: changed.rows[0]
    });
    return changed.rows[0];
  });
}

export async function resolveCommissionDispute(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; disputeId: string;
    version: number; resolutionAmount: string; resolution: string;
    resolutionDate: string; evidenceDocumentId: string; finalDecisionId: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    minorUnits(input.resolutionAmount);
    await activeDocument(transaction, input.workspaceId, input.evidenceDocumentId);
    const before = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM commission_disputes WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, input.disputeId]
    );
    if (!before) throw new AppError(404, "commission_dispute_not_found", "Commission Dispute not found.");
    if (["resolved","rejected","withdrawn"].includes(String(before.status))) {
      throw new AppError(409, "dispute_closed", "Closed dispute history cannot be rewritten.");
    }
    const decision = await oneOrNone<Record<string, unknown>>(
      transaction,
      `SELECT id FROM decision_records WHERE workspace_id=$1 AND id=$2
        AND owner_user_id=$3 AND status='issued'`,
      [input.workspaceId, input.finalDecisionId, input.actorUserId]
    );
    if (!decision) throw new AppError(422, "human_decision_required", "Resolution requires a fresh issued human Decision.");
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE commission_disputes SET status='resolved',resolution_amount=$4,
        resolution=$5,resolution_date=$6,resolved_by=$7,final_decision_id=$8,
        next_action='Resolution recorded; monitor payment or close documentation',
        version=version+1,updated_at=now()
       WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [input.workspaceId, input.disputeId, input.version, input.resolutionAmount,
        input.resolution, input.resolutionDate, input.actorUserId, input.finalDecisionId]
    );
    if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Dispute changed during resolution.");
    const commissionBefore = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM commissions WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, before.commission_id]
    );
    await transaction.query(
      `UPDATE commissions SET status='approved',dispute_status='resolved',
        approved_amount=$3,approved_by=$4,approved_at=now(),
        source_document_id=$5,version=version+1,updated_at=now()
       WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, before.commission_id, input.resolutionAmount,
        input.actorUserId, input.evidenceDocumentId]
    );
    await transaction.query(
      `INSERT INTO commercial_document_links
       (workspace_id,subject_type,subject_id,document_id,purpose,linked_by)
       VALUES($1,'commission_dispute',$2,$3,'resolution_evidence',$4)
       ON CONFLICT DO NOTHING`,
      [input.workspaceId, input.disputeId, input.evidenceDocumentId, input.actorUserId]
    );
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "commission_dispute",
      subjectId: input.disputeId, eventType: "dispute.resolved",
      actorUserId: input.actorUserId, reason: input.resolution,
      requestId: input.requestId, before, after: changed.rows[0]
    });
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: "commission",
      subjectId: String(before.commission_id), eventType: "commission.dispute_resolved",
      actorUserId: input.actorUserId, reason: input.resolution,
      requestId: input.requestId, before: commissionBefore,
      after: { status: "approved", approvedAmount: input.resolutionAmount,
        decisionId: input.finalDecisionId }
    });
    await auditCommercial(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId,
      action: "commission_dispute.resolved", targetType: "commission_dispute",
      targetId: input.disputeId, requestId: input.requestId,
      before, after: changed.rows[0]
    });
    return changed.rows[0];
  });
}

async function scheduleProtectionJobs(
  database: Db,
  input: {
    workspaceId: string; protectedAccountId: string; endsOn: string; actorUserId: string;
  }
): Promise<void> {
  const end = new Date(`${input.endsOn}T12:00:00.000Z`);
  for (const days of [60, 30, 14, 7, 1, 0]) {
    const availableAt = new Date(end.getTime() - days * 86_400_000);
    await enqueueJob(database, {
      workspaceId: input.workspaceId,
      kind: days === 0 ? "commerce.protection_expired" : "commerce.protection_expiring",
      idempotencyKey: `protection:${input.protectedAccountId}:${input.endsOn}:${days}`,
      availableAt,
      payload: {
        protectedAccountId: input.protectedAccountId, actorUserId: input.actorUserId,
        daysBefore: days
      }
    });
  }
}

async function createAttention(
  database: Db,
  input: {
    workspaceId: string; userId: string; subjectType: CommercialSubject;
    subjectId: string; title: string; reason: string; priority: "medium" | "high" | "critical";
    dueAt?: Date | null | undefined; groupingKey: string; requestId: string;
  }
): Promise<{ taskId: string | null; notificationId: string | null }> {
  const taskId = newId();
  const task = await database.query<{ id: string }>(
    `INSERT INTO tasks
      (id,workspace_id,subject_type,subject_id,title,owner_user_id,status,priority,
       created_reason,due_at,mandatory_gate)
     SELECT $1,$2,$3,$4,$5,$6,'open',$7,$8,$9,false
      WHERE NOT EXISTS (
        SELECT 1 FROM tasks WHERE workspace_id=$2 AND subject_type=$3 AND subject_id=$4
          AND created_reason=$8 AND status IN ('open','in_progress','blocked')
      ) RETURNING id`,
    [taskId, input.workspaceId, input.subjectType, input.subjectId, input.title,
      input.userId, input.priority, input.reason, input.dueAt ?? null]
  );
  const notificationId = newId();
  const notification = await database.query<{ id: string }>(
    `INSERT INTO notifications
      (id,workspace_id,user_id,notification_type,severity,title,reason,
       subject_type,subject_id,grouping_key,status,blocking,due_at)
     SELECT $1,$2,$3,'commercial_review',$4,$5,$6,$7,$8,$9,'unread',false,$10
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications WHERE workspace_id=$2 AND user_id=$3
          AND grouping_key=$9 AND status IN ('unread','read')
      ) RETURNING id`,
    [notificationId, input.workspaceId, input.userId,
      input.priority === "critical" ? "action_required" : "time_sensitive",
      input.title, input.reason, input.subjectType, input.subjectId,
      input.groupingKey, input.dueAt ?? null]
  );
  await commercialEvent(database, {
    workspaceId: input.workspaceId, subjectType: input.subjectType,
    subjectId: input.subjectId, eventType: "attention.created",
    actorUserId: null, origin: "job", reason: input.reason, requestId: input.requestId,
    metadata: { taskId: task.rows[0]?.id ?? null,
      notificationId: notification.rows[0]?.id ?? null }
  });
  return { taskId: task.rows[0]?.id ?? null,
    notificationId: notification.rows[0]?.id ?? null };
}

export async function processCommercialJob(
  database: Database,
  input: {
    workspaceId: string; kind: "commerce.protection_expiring" | "commerce.protection_expired"
      | "commerce.reorder_due" | "commerce.commission_due";
    payload: Record<string, unknown>; requestId: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    if (input.kind === "commerce.protection_expiring" || input.kind === "commerce.protection_expired") {
      const id = databaseText(input.payload.protectedAccountId);
      const protection = await oneOrNone<Record<string, unknown>>(
        transaction, "SELECT * FROM protected_accounts WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
        [input.workspaceId, id]
      );
      if (!protection || !["active","expiring"].includes(String(protection.status))) {
        return { skipped: true, reason: "Protection is no longer current." };
      }
      const expired = new Date(`${dateOnly(protection.protection_ends_on)}T23:59:59.999Z`) < new Date();
      if (input.kind === "commerce.protection_expired" && expired) {
        await transaction.query(
          `UPDATE protected_accounts SET status='expired',version=version+1,updated_at=now()
            WHERE workspace_id=$1 AND id=$2`,
          [input.workspaceId, id]
        );
        await createAttention(transaction, {
          workspaceId: input.workspaceId, userId: String(protection.representative_user_id),
          subjectType: "protected_account", subjectId: id,
          title: "Protected Account term expired",
          reason: "No approved renewal exists. Ongoing protection is not presumed.",
          priority: "critical", groupingKey: `protection-expired:${id}`,
          requestId: input.requestId
        });
        await commercialEvent(transaction, {
          workspaceId: input.workspaceId, subjectType: "protected_account",
          subjectId: id, eventType: "protection.expired", origin: "job",
          reason: "Documented protection end date passed without approved renewal",
          requestId: input.requestId, before: protection, after: { status: "expired" }
        });
        await auditCommercial(transaction, {
          workspaceId: input.workspaceId, action: "protected_account.expired",
          targetType: "protected_account", targetId: id, requestId: input.requestId,
          actorType: "job", before: protection, after: { status: "expired" }
        });
        return { expired: true };
      }
      if (!expired) {
        await transaction.query(
          `UPDATE protected_accounts SET status='expiring',version=version+1,updated_at=now()
            WHERE workspace_id=$1 AND id=$2 AND status='active'`,
          [input.workspaceId, id]
        );
        const days = Number(input.payload.daysBefore ?? 0);
        return createAttention(transaction, {
          workspaceId: input.workspaceId, userId: String(protection.representative_user_id),
          subjectType: "protected_account", subjectId: id,
          title: `Protected Account review due in ${days} day${days === 1 ? "" : "s"}`,
          reason: "Review documented renewal or release; the system cannot extend rights.",
          priority: days <= 7 ? "high" : "medium",
          dueAt: new Date(`${dateOnly(protection.protection_ends_on)}T12:00:00.000Z`),
          groupingKey: `protection-expiring:${id}:${days}`, requestId: input.requestId
        });
      }
      return { skipped: true, reason: "Expiry time has not arrived." };
    }
    if (input.kind === "commerce.reorder_due") {
      const id = databaseText(input.payload.reorderId);
      const reorder = await oneOrNone<Record<string, unknown>>(
        transaction,
        `SELECT r.*,a.status AS account_status,a.owner_user_id,
                pa.status AS protection_status
           FROM reorders r JOIN accounts a ON a.workspace_id=r.workspace_id AND a.id=r.account_id
           LEFT JOIN protected_accounts pa ON pa.workspace_id=r.workspace_id AND pa.id=r.protected_account_id
          WHERE r.workspace_id=$1 AND r.id=$2 FOR UPDATE OF r`,
        [input.workspaceId, id]
      );
      if (!reorder || !["projected","due","deferred"].includes(String(reorder.status)) ||
          ["ended"].includes(String(reorder.account_status))) {
        return { skipped: true, reason: "Reorder review is no longer eligible." };
      }
      await transaction.query(
        `UPDATE reorders SET status='due',version=version+1,updated_at=now()
          WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, id]
      );
      return createAttention(transaction, {
        workspaceId: input.workspaceId, userId: String(reorder.owner_user_id),
        subjectType: "reorder", subjectId: id, title: "Reorder review window is open",
        reason: `Review actual history, Account health, permission, authority, and protection (${databaseText(reorder.protection_status, "none")}) before outreach.`,
        priority: "high", groupingKey: `reorder-due:${id}`, requestId: input.requestId
      });
    }
    const id = databaseText(input.payload.commissionId);
    const commission = await oneOrNone<Record<string, unknown>>(
      transaction, "SELECT * FROM commissions WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [input.workspaceId, id]
    );
    if (!commission || !["approved","payable"].includes(String(commission.status)) ||
        !commission.payment_due_date || new Date(`${databaseText(commission.payment_due_date)}T23:59:59.999Z`) >= new Date()) {
      return { skipped: true, reason: "Commission is not overdue and unpaid." };
    }
    return createAttention(transaction, {
      workspaceId: input.workspaceId, userId: String(commission.representative_user_id),
      subjectType: "commission", subjectId: id, title: "Commission payment is overdue",
      reason: "Review payment evidence, contact the Brand through approved outreach, or open a documented dispute.",
      priority: "critical", groupingKey: `commission-overdue:${id}`, requestId: input.requestId
    });
  });
}

export async function linkCommercialDocument(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string;
    subjectType: CommercialSubject; subjectId: string; documentId: string; purpose: string;
  }
): Promise<void> {
  await withTransaction(database, async (transaction) => {
    await activeDocument(transaction, input.workspaceId, input.documentId);
    const tableByType: Record<CommercialSubject, string> = {
      protected_account: "protected_accounts", account: "accounts", order: "orders",
      reorder: "reorders", commission: "commissions", commission_dispute: "commission_disputes"
    };
    const exists = await oneOrNone<Record<string, unknown>>(
      transaction,
      `SELECT id FROM ${tableByType[input.subjectType]} WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, input.subjectId]
    );
    if (!exists) throw new AppError(404, "commercial_record_not_found", "Commercial record not found.");
    await transaction.query(
      `INSERT INTO commercial_document_links
       (workspace_id,subject_type,subject_id,document_id,purpose,linked_by)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [input.workspaceId, input.subjectType, input.subjectId, input.documentId,
        input.purpose, input.actorUserId]
    );
    await commercialEvent(transaction, {
      workspaceId: input.workspaceId, subjectType: input.subjectType,
      subjectId: input.subjectId, eventType: "document.linked",
      actorUserId: input.actorUserId, reason: input.purpose, requestId: input.requestId,
      metadata: { documentId: input.documentId }
    });
  });
}

function csvCell(value: unknown): string {
  const text = databaseText(value);
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

export async function exportCommercialRecords(
  database: Database,
  workspaceId: string,
  recordType: "account" | "order" | "reorder" | "commission" | "commission_dispute"
): Promise<string> {
  let rows: Record<string, unknown>[];
  if (recordType === "account") rows = await listAccounts(database, workspaceId);
  else if (recordType === "order") rows = await listOrders(database, workspaceId);
  else if (recordType === "reorder") rows = await listReorders(database, workspaceId);
  else if (recordType === "commission") rows = await listCommissions(database, workspaceId);
  else rows = await listCommissionDisputes(database, workspaceId);
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${keys.map(csvCell).join(",")}\n${rows.map((row) => keys.map((key) => csvCell(row[key])).join(",")).join("\n")}`;
}
