import type { Database, Transaction } from "../../database/src/index.js";
import { oneOrNone, withTransaction } from "../../database/src/index.js";
import { AppError, newId } from "../../shared/src/index.js";
import { getAccessDecision } from "./access.js";
import { recordAudit } from "./audit.js";
import { publicDigest } from "./crypto.js";
import { enqueueJob } from "./jobs.js";
import { validateCurrentAuthority } from "./representation.js";

export type EmailDeliveryProvider = {
  send(input: {
    idempotencyKey: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    headers: Record<string, string>;
  }): Promise<{
    status: "accepted" | "uncertain" | "rejected";
    providerMessageId?: string | undefined;
    safeDetail?: string | undefined;
  }>;
};

type MessageContext = {
  id: string;
  workspaceId: string;
  placementOpportunityId: string;
  authorityChannel: string;
  agreementId: string;
  brandId: string;
  businessId: string;
  contactId: string;
  ownerUserId: string;
  channel: "email" | "social";
  direction: "outbound" | "inbound";
  senderAddress: string;
  recipientAddress: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date | null;
  approvalId: string | null;
  approvedDigest: string | null;
  version: number;
  products: string[];
  claims: Array<{
    id: string;
    claimText: string;
    status: string;
    evidenceId: string | null;
    evidenceStatus: string | null;
    evidenceVerificationStatus: string | null;
    evidencePermittedUse: string | null;
  }>;
  attachments: Array<{
    documentId: string;
    sha256: string;
    attachedSha256: string;
    status: string;
    scanStatus: string;
  }>;
};

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

async function loadMessage(
  database: Database | Transaction,
  workspaceId: string,
  messageId: string,
  lock = false
): Promise<MessageContext> {
  const message = await oneOrNone<Omit<MessageContext, "products" | "claims" | "attachments">>(
    database,
    `SELECT m.id,m.workspace_id AS "workspaceId",
            placement_opportunity_id AS "placementOpportunityId",
            p.authority_channel AS "authorityChannel",
            m.agreement_id AS "agreementId",m.brand_id AS "brandId",
            m.business_id AS "businessId",m.contact_id AS "contactId",
            m.owner_user_id AS "ownerUserId",m.channel,m.direction,
            m.sender_address AS "senderAddress",m.recipient_address AS "recipientAddress",
            m.subject,m.body,m.status,m.scheduled_at AS "scheduledAt",m.approval_id AS "approvalId",
            m.approved_digest AS "approvedDigest",m.version
       FROM outreach_messages m
       JOIN placement_opportunities p ON p.workspace_id=m.workspace_id
        AND p.id=m.placement_opportunity_id
      WHERE m.workspace_id=$1 AND m.id=$2${lock ? " FOR UPDATE OF m" : ""}`,
    [workspaceId, messageId]
  );
  if (!message) throw new AppError(404, "outreach_message_not_found", "Outreach message not found.");
  const products = await database.query<{ productId: string }>(
      `SELECT product_id AS "productId" FROM outreach_message_products
        WHERE workspace_id=$1 AND message_id=$2 ORDER BY product_id`,
      [workspaceId, messageId]
    );
  const claims = await database.query<MessageContext["claims"][number]>(
      `SELECT c.id,c.claim_text AS "claimText",c.status,c.evidence_id AS "evidenceId",
              e.status AS "evidenceStatus",e.verification_status AS "evidenceVerificationStatus",
              e.permitted_use AS "evidencePermittedUse"
         FROM outreach_message_claims c
         LEFT JOIN evidence_records e ON e.workspace_id=c.workspace_id AND e.id=c.evidence_id
        WHERE c.workspace_id=$1 AND c.message_id=$2 ORDER BY c.id`,
      [workspaceId, messageId]
    );
  const attachments = await database.query<MessageContext["attachments"][number]>(
      `SELECT a.document_id AS "documentId",d.sha256,a.attached_sha256 AS "attachedSha256",
              d.status,d.scan_status AS "scanStatus"
         FROM outreach_message_attachments a
         JOIN documents d ON d.workspace_id=a.workspace_id AND d.id=a.document_id
        WHERE a.workspace_id=$1 AND a.message_id=$2 ORDER BY a.document_id`,
      [workspaceId, messageId]
    );
  return {
    ...message,
    products: products.rows.map((item) => item.productId),
    claims: claims.rows,
    attachments: attachments.rows
  };
}

function localMinuteOfDay(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function parseClock(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (hour === undefined || minute === undefined || hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

async function assertOutsideQuietHours(
  database: Database | Transaction,
  message: MessageContext,
  at: Date
): Promise<void> {
  const setting = await oneOrNone<{ timeZone: string; quietHours: Record<string, unknown> }>(
    database,
    `SELECT u.time_zone AS "timeZone",s.quiet_hours AS "quietHours"
       FROM users u JOIN workspace_settings s ON s.workspace_id=$2
      WHERE u.id=$1`,
    [message.ownerUserId, message.workspaceId]
  );
  if (!setting) return;
  const start = parseClock(setting.quietHours.start);
  const end = parseClock(setting.quietHours.end);
  if (start === null || end === null || start === end) return;
  const minute = localMinuteOfDay(at, setting.timeZone);
  const quiet = start < end ? minute >= start && minute < end : minute >= start || minute < end;
  if (quiet) {
    throw new AppError(
      409,
      "quiet_hours_conflict",
      "Delivery timing falls inside configured quiet hours. Choose a permissible time and request fresh approval."
    );
  }
}

function messageDigest(message: MessageContext): string {
  return publicDigest(canonical({
    messageId: message.id,
    placementOpportunityId: message.placementOpportunityId,
    agreementId: message.agreementId,
    brandId: message.brandId,
    businessId: message.businessId,
    contactId: message.contactId,
    communicationChannel: message.channel,
    authorityChannel: message.authorityChannel,
    direction: message.direction,
    senderAddress: message.senderAddress.toLowerCase(),
    recipientAddress: message.recipientAddress.toLowerCase(),
    subject: message.subject,
    body: message.body,
    scheduledAt: message.scheduledAt?.toISOString() ?? null,
    products: message.products,
    claims: message.claims.map((claim) => ({
      claimText: claim.claimText,
      evidenceId: claim.evidenceId,
      status: claim.status,
      evidenceStatus: claim.evidenceStatus,
      evidenceVerificationStatus: claim.evidenceVerificationStatus
    })),
    attachments: message.attachments.map((attachment) => ({
      documentId: attachment.documentId,
      sha256: attachment.sha256
    }))
  }));
}

async function suppressionReasons(
  database: Database | Transaction,
  message: MessageContext
): Promise<string[]> {
  const contact = await oneOrNone<{ permissionStatus: string; email: string | null }>(
    database,
    `SELECT permission_status AS "permissionStatus",email
       FROM contacts WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL`,
    [message.workspaceId, message.contactId]
  );
  const reasons: string[] = [];
  if (!contact) reasons.push("contact_unavailable");
  else {
    if (["opted_out", "prohibited"].includes(contact.permissionStatus)) reasons.push("contact_permission_prohibited");
    if (message.channel === "email" && contact.email?.toLowerCase() !== message.recipientAddress.toLowerCase()) {
      reasons.push("recipient_does_not_match_contact");
    }
  }
  const suppressions = await database.query<{ reason: string }>(
    `SELECT reason FROM communication_suppressions
      WHERE workspace_id=$1 AND contact_id=$2 AND status='active'
        AND channel IN ($3,'all')`,
    [message.workspaceId, message.contactId, message.channel]
  );
  reasons.push(...suppressions.rows.map((item) => `suppressed_${item.reason}`));
  return reasons;
}

async function validateMessage(
  database: Database | Transaction,
  message: MessageContext
): Promise<{ digest: string; authorityDigest: string }> {
  if (message.direction !== "outbound") {
    throw new AppError(409, "outbound_message_required", "Only outbound messages can be approved or sent.");
  }
  if (message.products.length === 0) {
    throw new AppError(422, "product_scope_required", "At least one represented Product is required.");
  }
  if (/{{[^}]+}}/.test(`${message.subject}\n${message.body}`)) {
    throw new AppError(422, "template_variables_unresolved", "Resolve every template variable before approval.");
  }
  if (message.channel === "email" && !/(unsubscribe|opt[ -]?out)/i.test(message.body)) {
    throw new AppError(422, "opt_out_language_required", "Email must preserve a clear opt-out instruction.");
  }
  if (!message.senderAddress.trim()) {
    throw new AppError(422, "sender_identity_required", "A clear sender identity is required.");
  }
  const suppressed = await suppressionReasons(database, message);
  if (suppressed.length > 0) {
    throw new AppError(409, "outreach_suppressed", `Outreach is blocked: ${suppressed.join(", ")}.`);
  }
  const authority = await validateCurrentAuthority(database, {
    workspaceId: message.workspaceId,
    brandId: message.brandId,
    productIds: message.products,
    businessId: message.businessId,
    channel: message.authorityChannel,
    agreementId: message.agreementId,
    requireTerritoryProof: true
  });
  if (authority.outcome !== "authorized") {
    throw new AppError(
      409,
      authority.outcome === "review_required" ? "authority_conflict_review_required" : "representation_authority_invalid",
      `Outreach is blocked: ${authority.reasonCodes.join(", ")}.`
    );
  }
  const badClaims = message.claims.filter((claim) =>
    claim.status !== "supported" ||
    !claim.evidenceId ||
    claim.evidenceStatus !== "current" ||
    !["reviewed", "verified"].includes(claim.evidenceVerificationStatus ?? "")
  );
  if (badClaims.length > 0) {
    throw new AppError(409, "outreach_claim_not_supported", "Every material claim requires current reviewed evidence.");
  }
  const badAttachments = message.attachments.filter((attachment) =>
    attachment.status !== "active" ||
    attachment.scanStatus !== "clean" ||
    attachment.sha256 !== attachment.attachedSha256
  );
  if (badAttachments.length > 0) {
    throw new AppError(409, "outreach_attachment_unavailable", "Every attachment must be the same clean immutable Document that was reviewed.");
  }
  return { digest: messageDigest(message), authorityDigest: authority.authorityDigest! };
}

export async function listOutreach(
  database: Database,
  workspaceId: string,
  filters: { status?: string | undefined; channel?: string | undefined; placementId?: string | undefined }
): Promise<Record<string, unknown>[]> {
  const values: unknown[] = [workspaceId];
  const where = ["m.workspace_id=$1"];
  if (filters.status) where.push(`m.status=$${values.push(filters.status)}`);
  if (filters.channel) where.push(`m.channel=$${values.push(filters.channel)}`);
  if (filters.placementId) where.push(`m.placement_opportunity_id=$${values.push(filters.placementId)}`);
  const result = await database.query<Record<string, unknown>>(
    `SELECT m.id,m.channel,m.direction,m.subject,m.status,m.recipient_address AS "recipientAddress",
            m.placement_opportunity_id AS "placementOpportunityId",
            b.name AS "businessName",br.public_name AS "brandName",c.name AS "contactName",
            m.scheduled_at AS "scheduledAt",m.accepted_at AS "acceptedAt",
            m.version,m.updated_at AS "updatedAt"
       FROM outreach_messages m
       JOIN businesses b ON b.workspace_id=m.workspace_id AND b.id=m.business_id
       JOIN brands br ON br.workspace_id=m.workspace_id AND br.id=m.brand_id
       JOIN contacts c ON c.workspace_id=m.workspace_id AND c.id=m.contact_id
      WHERE ${where.join(" AND ")}
      ORDER BY m.updated_at DESC LIMIT 250`,
    values
  );
  return result.rows;
}

export async function getOutreachMessage(
  database: Database,
  workspaceId: string,
  messageId: string
): Promise<Record<string, unknown>> {
  const message = await loadMessage(database, workspaceId, messageId);
  return { message, digest: messageDigest(message) };
}

export async function createOutreachMessage(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    placementId: string;
    contactId: string;
    channel: "email" | "social";
    senderAddress: string;
    recipientAddress: string;
    subject: string;
    body: string;
    productIds: string[];
    claimLinks: Array<{ claimText: string; productId?: string | null | undefined; evidenceId?: string | null | undefined }>;
    attachmentIds: string[];
    templateVersionId?: string | null | undefined;
    scheduledAt?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const placement = await oneOrNone<{
      agreementId: string; brandId: string; businessId: string; stage: string; channel: string;
    }>(
      transaction,
      `SELECT agreement_id AS "agreementId",brand_id AS "brandId",
              business_id AS "businessId",stage,authority_channel AS channel
         FROM placement_opportunities
        WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL`,
      [input.workspaceId, input.placementId]
    );
    if (!placement) throw new AppError(404, "placement_not_found", "Placement Opportunity not found.");
    if (!["prepared", "contacted", "engaged", "information_sample_sent", "buyer_review", "terms_order_discussion"].includes(placement.stage)) {
      throw new AppError(409, "placement_not_ready_for_outreach", "Placement must be prepared before outreach.");
    }
    const permittedProducts = await transaction.query<{ id: string }>(
      `SELECT product_id AS id FROM placement_opportunity_products
        WHERE workspace_id=$1 AND placement_opportunity_id=$2 AND product_id=ANY($3::uuid[])`,
      [input.workspaceId, input.placementId, input.productIds]
    );
    if (permittedProducts.rowCount !== new Set(input.productIds).size || permittedProducts.rowCount === 0) {
      throw new AppError(422, "placement_product_scope_invalid", "Products must belong to the Placement.");
    }
    const contact = await oneOrNone<{ businessId: string | null }>(
      transaction,
      `SELECT business_id AS "businessId" FROM contacts
        WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL`,
      [input.workspaceId, input.contactId]
    );
    if (!contact || contact.businessId !== placement.businessId) {
      throw new AppError(422, "placement_contact_invalid", "Choose a Contact belonging to the Placement Business.");
    }
    const id = newId();
    await transaction.query(
      `INSERT INTO outreach_messages
        (id,workspace_id,placement_opportunity_id,agreement_id,brand_id,business_id,
         contact_id,owner_user_id,channel,direction,sender_address,recipient_address,
         subject,body,status,template_version_id,origin,scheduled_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'outbound',$10,$11,$12,$13,'draft',$14,'user_entered',$15)`,
      [id, input.workspaceId, input.placementId, placement.agreementId, placement.brandId,
        placement.businessId, input.contactId, input.actorUserId, input.channel,
        input.senderAddress, input.recipientAddress, input.subject, input.body,
        input.templateVersionId ?? null, input.scheduledAt ?? null]
    );
    for (const productId of input.productIds) {
      await transaction.query(
        `INSERT INTO outreach_message_products(workspace_id,message_id,product_id) VALUES($1,$2,$3)`,
        [input.workspaceId, id, productId]
      );
    }
    for (const claim of input.claimLinks) {
      await transaction.query(
        `INSERT INTO outreach_message_claims
          (id,workspace_id,message_id,claim_text,product_id,evidence_id,status,validated_at)
         VALUES($1,$2,$3,$4,$5,$6,
          CASE WHEN $6::uuid IS NULL THEN 'unsupported' ELSE 'supported' END,
          CASE WHEN $6::uuid IS NULL THEN NULL ELSE now() END)`,
        [newId(), input.workspaceId, id, claim.claimText, claim.productId ?? null, claim.evidenceId ?? null]
      );
    }
    for (const documentId of input.attachmentIds) {
      const document = await oneOrNone<{ sha256: string }>(
        transaction,
        `SELECT sha256 FROM documents WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, documentId]
      );
      if (!document) throw new AppError(422, "attachment_not_found", "Attachment not found.");
      await transaction.query(
        `INSERT INTO outreach_message_attachments(workspace_id,message_id,document_id,attached_sha256)
         VALUES($1,$2,$3,$4)`,
        [input.workspaceId, id, documentId, document.sha256]
      );
    }
    const created = await loadMessage(transaction, input.workspaceId, id);
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "outreach_message.created", targetType: "outreach_message", targetId: id,
      origin: "api", requestId: input.requestId, outcome: "succeeded",
      after: { channel: input.channel, placementId: input.placementId, productIds: input.productIds }
    });
    return created;
  });
}

export async function updateOutreachMessage(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; messageId: string;
    version: number; recipientAddress: string; senderAddress: string; subject: string;
    body: string; scheduledAt?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const before = await loadMessage(transaction, input.workspaceId, input.messageId, true);
    if (["queued", "accepted", "delivered", "replied", "received"].includes(before.status)) {
      throw new AppError(409, "sent_message_immutable", "Sent and received communications are immutable.");
    }
    const changed = await transaction.query(
      `UPDATE outreach_messages SET recipient_address=$4,sender_address=$5,subject=$6,body=$7,
              scheduled_at=$8,status='draft',approval_id=NULL,approved_digest=NULL,
              artifact_digest=NULL,version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND version=$3 RETURNING id`,
      [input.workspaceId, input.messageId, input.version, input.recipientAddress,
        input.senderAddress, input.subject, input.body, input.scheduledAt ?? null]
    );
    if (!changed.rows[0]) throw new AppError(409, "version_conflict", "Message changed. Reload before saving.");
    await transaction.query(
      `UPDATE human_approvals SET status='expired',decided_at=now()
        WHERE workspace_id=$1 AND subject_type='outreach_message' AND subject_id=$2
          AND status IN ('requested','approved')`,
      [input.workspaceId, input.messageId]
    );
    const after = await loadMessage(transaction, input.workspaceId, input.messageId);
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "outreach_message.materially_edited", targetType: "outreach_message",
      targetId: input.messageId, origin: "api", requestId: input.requestId,
      outcome: "succeeded", before: { digest: messageDigest(before) },
      after: { digest: messageDigest(after), approvalInvalidated: true }
    });
    return after;
  });
}

export async function requestOutreachApproval(
  database: Database,
  input: { workspaceId: string; actorUserId: string; requestId: string; messageId: string }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const message = await loadMessage(transaction, input.workspaceId, input.messageId, true);
    const validated = await validateMessage(transaction, message);
    const id = newId();
    await transaction.query(
      `UPDATE human_approvals SET status='expired',decided_at=now()
        WHERE workspace_id=$1 AND subject_type='outreach_message' AND subject_id=$2
          AND status IN ('requested','approved')`,
      [input.workspaceId, input.messageId]
    );
    const approval = await transaction.query<Record<string, unknown>>(
      `INSERT INTO human_approvals
        (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,
         approver_user_id,status,scope)
       VALUES($1,$2,'outreach_message',$3,'send_external_outreach',$4,$5,'requested',$6)
       RETURNING id,status,artifact_digest AS "artifactDigest",scope,requested_at AS "requestedAt"`,
      [id, input.workspaceId, input.messageId, validated.digest, input.actorUserId,
        `Exact ${message.channel} to ${message.recipientAddress}`]
    );
    await transaction.query(
      `UPDATE outreach_messages SET status='approval_requested',approval_id=$3,
              artifact_digest=$4,version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, input.messageId, id, validated.digest]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "outreach_message.approval_requested", targetType: "outreach_message",
      targetId: input.messageId, origin: "api", requestId: input.requestId,
      outcome: "succeeded", metadata: {
        approvalId: id, artifactDigest: validated.digest, authorityDigest: validated.authorityDigest
      }
    });
    return approval.rows[0]!;
  });
}

export async function decideOutreachApproval(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; messageId: string;
    approvalId: string; decision: "approved" | "rejected" | "changes_required";
    conditions: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const message = await loadMessage(transaction, input.workspaceId, input.messageId, true);
    const validated = await validateMessage(transaction, message);
    const decided = await transaction.query<{ id: string }>(
      `UPDATE human_approvals SET status=$6,conditions=$7,decided_at=now()
        WHERE workspace_id=$1 AND id=$2 AND subject_type='outreach_message'
          AND subject_id=$3 AND approver_user_id=$4 AND artifact_digest=$5
          AND status='requested' RETURNING id`,
      [input.workspaceId, input.approvalId, input.messageId, input.actorUserId,
        validated.digest, input.decision, input.conditions]
    );
    if (!decided.rows[0]) {
      throw new AppError(409, "approval_artifact_changed", "Approval is unavailable or the exact outreach artifact changed.");
    }
    const status = input.decision === "approved" ? "approved" : "draft";
    const updated = await transaction.query<Record<string, unknown>>(
      `UPDATE outreach_messages SET status=$3,
              approved_digest=CASE WHEN $3='approved' THEN $4 ELSE NULL END,
              version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2
        RETURNING id,status,approved_digest AS "approvedDigest",version`,
      [input.workspaceId, input.messageId, status, validated.digest]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: `outreach_message.${input.decision}`, targetType: "outreach_message",
      targetId: input.messageId, origin: "api", requestId: input.requestId,
      outcome: "succeeded", metadata: { approvalId: input.approvalId, artifactDigest: validated.digest }
    });
    return updated.rows[0]!;
  });
}

export async function queueOutreachMessage(
  database: Database,
  input: { workspaceId: string; actorUserId: string; requestId: string; messageId: string }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const access = await getAccessDecision(transaction, input.actorUserId, input.workspaceId);
    if (!access?.capabilities.includes("external:approve")) {
      throw new AppError(403, "outreach_access_restricted", "Current access does not permit external outreach.");
    }
    const message = await loadMessage(transaction, input.workspaceId, input.messageId, true);
    const validated = await validateMessage(transaction, message);
    if (message.status !== "approved" || message.approvedDigest !== validated.digest || !message.approvalId) {
      throw new AppError(409, "exact_outreach_approval_required", "Approve the current exact outreach artifact before sending.");
    }
    const approval = await oneOrNone<{ id: string }>(
      transaction,
      `SELECT id FROM human_approvals
        WHERE workspace_id=$1 AND id=$2 AND subject_type='outreach_message' AND subject_id=$3
          AND status='approved' AND artifact_digest=$4`,
      [input.workspaceId, message.approvalId, message.id, validated.digest]
    );
    if (!approval) throw new AppError(409, "exact_outreach_approval_required", "Current exact approval is unavailable.");
    const availableAt = message.scheduledAt && message.scheduledAt > new Date()
      ? message.scheduledAt
      : new Date();
    await assertOutsideQuietHours(transaction, message, availableAt);
    const job = await enqueueJob(transaction, {
      workspaceId: input.workspaceId,
      kind: "outreach.send",
      payload: { messageId: message.id, actorUserId: input.actorUserId },
      idempotencyKey: `outreach.send:${message.id}:${validated.digest}`,
      availableAt
    });
    await transaction.query(
      `UPDATE outreach_messages SET status='queued',provider_status='queued',
              version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, message.id]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "outreach_message.queued", targetType: "outreach_message",
      targetId: message.id, origin: "api", requestId: input.requestId,
      outcome: "succeeded", metadata: { jobId: job.id, inserted: job.inserted, artifactDigest: validated.digest }
    });
    return { id: message.id, status: "queued", jobId: job.id, scheduledAt: availableAt.toISOString() };
  });
}

async function markPlacementContacted(
  transaction: Transaction,
  message: MessageContext,
  actorUserId: string,
  activityId: string
): Promise<void> {
  const placement = await oneOrNone<{ stage: string; decisionId: string | null }>(
    transaction,
    `SELECT stage,decision_id AS "decisionId" FROM placement_opportunities
      WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,
    [message.workspaceId, message.placementOpportunityId]
  );
  if (!placement || placement.stage !== "prepared") return;
  const taskId = newId();
  await transaction.query(
    `INSERT INTO tasks
      (id,workspace_id,subject_type,subject_id,title,owner_user_id,status,priority,
       created_reason,due_at,mandatory_gate)
     VALUES($1,$2,'placement_opportunity',$3,'Review outreach response or follow up',
            $4,'open','high','Provider accepted first outreach',now()+interval '3 days',false)`,
    [taskId, message.workspaceId, message.placementOpportunityId, actorUserId]
  );
  await transaction.query(
    `UPDATE placement_opportunities SET stage='contacted',next_action_task_id=$3,
            last_meaningful_action_at=now(),version=version+1,updated_at=now()
      WHERE workspace_id=$1 AND id=$2`,
    [message.workspaceId, message.placementOpportunityId, taskId]
  );
  await transaction.query(
    `INSERT INTO placement_stage_events
      (id,workspace_id,placement_opportunity_id,from_stage,to_stage,reason,
       decision_id,evidence_ids,actor_user_id)
     VALUES($1,$2,$3,'prepared','contacted','Provider accepted approved outreach',
            $4,'{}',$5)`,
    [newId(), message.workspaceId, message.placementOpportunityId, placement.decisionId, actorUserId]
  );
  await transaction.query(
    `UPDATE activities SET metadata=metadata||$3::jsonb WHERE workspace_id=$1 AND id=$2`,
    [message.workspaceId, activityId, JSON.stringify({ placementAdvancedTo: "contacted" })]
  );
}

export async function processOutreachSend(
  database: Database,
  provider: EmailDeliveryProvider,
  input: { workspaceId: string; messageId: string; actorUserId: string }
): Promise<Record<string, unknown>> {
  const prepared = await withTransaction(database, async (transaction) => {
    const message = await loadMessage(transaction, input.workspaceId, input.messageId, true);
    if (message.status === "accepted" || message.status === "delivered" || message.status === "replied") {
      return { outcome: "already_accepted" as const, message };
    }
    const access = await getAccessDecision(transaction, input.actorUserId, input.workspaceId);
    if (!access?.capabilities.includes("external:approve")) {
      await suppressQueuedMessage(
        transaction, message, input.actorUserId, "access_restricted",
        "Access changed before delivery."
      );
      return { outcome: "suppressed" as const, message, reason: "access_restricted" };
    }
    let validated: { digest: string; authorityDigest: string };
    try {
      validated = await validateMessage(transaction, message);
    } catch (error) {
      if (error instanceof AppError && [
        "outreach_suppressed", "representation_authority_invalid",
        "authority_conflict_review_required", "outreach_claim_not_supported",
        "outreach_attachment_unavailable"
      ].includes(error.type)) {
        await suppressQueuedMessage(
          transaction, message, input.actorUserId, error.type, error.message
        );
        return { outcome: "suppressed" as const, message, reason: error.type };
      }
      throw error;
    }
    await assertOutsideQuietHours(transaction, message, new Date());
    if (message.status !== "queued" || message.approvedDigest !== validated.digest) {
      throw new AppError(409, "exact_outreach_approval_required", "Queued outreach no longer matches its approval.");
    }
    return { outcome: "ready" as const, message, digest: validated.digest };
  });
  if (prepared.outcome === "already_accepted") {
    return { id: prepared.message.id, status: prepared.message.status, idempotent: true };
  }
  if (prepared.outcome === "suppressed") {
    return { id: prepared.message.id, status: "suppressed", reason: prepared.reason };
  }
  if (prepared.message.channel !== "email") {
    throw new AppError(409, "manual_channel_required", "Social outreach must be sent and confirmed by a human.");
  }
  const result = await provider.send({
    idempotencyKey: `outreach:${prepared.message.id}:${prepared.digest}`,
    from: prepared.message.senderAddress,
    to: prepared.message.recipientAddress,
    subject: prepared.message.subject,
    body: prepared.message.body,
    headers: {
      "x-ryva-message-id": prepared.message.id,
      "list-unsubscribe": `<mailto:${prepared.message.senderAddress}?subject=unsubscribe>`
    }
  });
  const finalized = await withTransaction(database, async (transaction) => {
    const current = await loadMessage(transaction, input.workspaceId, input.messageId, true);
    if (["accepted", "delivered", "replied"].includes(current.status)) {
      return { id: current.id, status: current.status, idempotent: true };
    }
    if (result.status === "uncertain") {
      await transaction.query(
        `UPDATE outreach_messages SET provider_status='uncertain',provider_safe_detail=$3,
                updated_at=now() WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, input.messageId, result.safeDetail ?? "Provider result is uncertain; retry uses the same idempotency key."]
      );
      return { outcome: "uncertain" as const };
    }
    if (result.status === "rejected") {
      await transaction.query(
        `UPDATE outreach_messages SET status='failed',provider_status='rejected',
                provider_safe_detail=$3,version=version+1,updated_at=now()
          WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, input.messageId, result.safeDetail ?? "Provider rejected the message."]
      );
      return { outcome: "rejected" as const, id: input.messageId, status: "failed" };
    }
    const activityId = newId();
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,
         summary,status,metadata)
       VALUES($1,$2,'email_sent',$3,'placement_opportunity',$4,$5,'completed',$6)`,
      [activityId, input.workspaceId, input.actorUserId, current.placementOpportunityId,
        `Email accepted for ${current.recipientAddress}`,
        { outreachMessageId: current.id, providerMessageId: result.providerMessageId }]
    );
    await transaction.query(
      `UPDATE outreach_messages SET status='accepted',provider_status='accepted',
              provider_message_id=$3,provider_safe_detail=$4,accepted_at=now(),
              sent_activity_id=$5,version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, input.messageId, result.providerMessageId ?? null,
        result.safeDetail ?? null, activityId]
    );
    await markPlacementContacted(transaction, current, input.actorUserId, activityId);
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "outreach_message.provider_accepted", targetType: "outreach_message",
      targetId: input.messageId, origin: "job", requestId: input.messageId,
      outcome: "succeeded", metadata: {
        providerMessageId: result.providerMessageId, activityId, artifactDigest: prepared.digest
      }
    });
    return { outcome: "accepted" as const, id: input.messageId, status: "accepted", providerMessageId: result.providerMessageId, activityId };
  });
  if (finalized.outcome === "uncertain") {
    throw new AppError(503, "email_delivery_uncertain", "Provider acceptance is uncertain. The message remains safe to retry.");
  }
  return finalized;
}

async function suppressQueuedMessage(
  transaction: Transaction,
  message: MessageContext,
  actorUserId: string,
  reason: string,
  safeDetail: string
): Promise<void> {
  await transaction.query(
    `UPDATE outreach_messages SET status='suppressed',provider_status='suppressed',
            provider_safe_detail=$3,version=version+1,updated_at=now()
      WHERE workspace_id=$1 AND id=$2`,
    [message.workspaceId, message.id, safeDetail]
  );
  await transaction.query(
    `UPDATE outreach_sequence_enrollments SET status='stopped',stop_reason=$3,
            stopped_at=now(),version=version+1,updated_at=now()
      WHERE workspace_id=$1 AND contact_id=$2 AND status='active'`,
    [message.workspaceId, message.contactId, reason]
  );
  await recordAudit(transaction, {
    workspaceId: message.workspaceId, actorUserId, actorType: "user",
    action: "outreach_message.execution_suppressed", targetType: "outreach_message",
    targetId: message.id, origin: "job", requestId: message.id,
    outcome: "denied", metadata: { reason, safeDetail }
  });
}

export async function confirmManualOutreach(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; messageId: string;
    occurredAt: string; confirmation: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const access = await getAccessDecision(transaction, input.actorUserId, input.workspaceId);
    if (!access?.capabilities.includes("external:approve")) {
      throw new AppError(403, "outreach_access_restricted", "Current access does not permit external outreach.");
    }
    const message = await loadMessage(transaction, input.workspaceId, input.messageId, true);
    if (message.channel !== "social") {
      throw new AppError(409, "manual_confirmation_channel_invalid", "Email acceptance must come from the configured provider.");
    }
    const validated = await validateMessage(transaction, message);
    if (message.status !== "approved" || message.approvedDigest !== validated.digest) {
      throw new AppError(409, "exact_outreach_approval_required", "Approve the exact social message before confirming an external send.");
    }
    const approval = await oneOrNone<{ id: string }>(
      transaction,
      `SELECT id FROM human_approvals WHERE workspace_id=$1 AND id=$2
        AND subject_type='outreach_message' AND subject_id=$3
        AND status='approved' AND artifact_digest=$4`,
      [input.workspaceId, message.approvalId, message.id, validated.digest]
    );
    if (!approval) throw new AppError(409, "exact_outreach_approval_required", "Current exact approval is unavailable.");
    const activityId = newId();
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,
         summary,status,occurred_at,metadata)
       VALUES($1,$2,'social_sent',$3,'placement_opportunity',$4,
              'Human confirmed approved social outreach','completed',$5,$6)`,
      [activityId, input.workspaceId, input.actorUserId, message.placementOpportunityId,
        input.occurredAt, { outreachMessageId: message.id, confirmation: input.confirmation }]
    );
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE outreach_messages SET status='accepted',provider_status='human_confirmed',
              accepted_at=$3,sent_activity_id=$4,version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2
        RETURNING id,status,accepted_at AS "acceptedAt",version`,
      [input.workspaceId, message.id, input.occurredAt, activityId]
    );
    await markPlacementContacted(transaction, message, input.actorUserId, activityId);
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "outreach_message.manual_send_confirmed", targetType: "outreach_message",
      targetId: message.id, origin: "api", requestId: input.requestId,
      outcome: "succeeded", metadata: { artifactDigest: validated.digest, activityId, confirmation: input.confirmation }
    });
    return changed.rows[0]!;
  });
}

export async function addSuppression(
  database: Database,
  input: {
    workspaceId: string; actorUserId?: string | null; requestId: string;
    contactId: string; channel: "email" | "social" | "call" | "all";
    reason: "opt_out" | "complaint" | "hard_bounce" | "prohibited" | "invalid_authority" | "account_conflict" | "manual";
    source: string; sourceEventId?: string | null;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const existing = await oneOrNone<Record<string, unknown>>(
      transaction,
      `SELECT id,channel,reason,status FROM communication_suppressions
        WHERE workspace_id=$1 AND contact_id=$2 AND channel=$3 AND reason=$4 AND status='active'`,
      [input.workspaceId, input.contactId, input.channel, input.reason]
    );
    if (existing) return existing;
    const id = newId();
    const created = await transaction.query<Record<string, unknown>>(
      `INSERT INTO communication_suppressions
        (id,workspace_id,contact_id,channel,reason,status,source,source_event_id,created_by)
       VALUES($1,$2,$3,$4,$5,'active',$6,$7,$8)
       RETURNING id,contact_id AS "contactId",channel,reason,status,created_at AS "createdAt"`,
      [id, input.workspaceId, input.contactId, input.channel, input.reason,
        input.source, input.sourceEventId ?? null, input.actorUserId ?? null]
    );
    if (input.reason === "opt_out" || input.reason === "prohibited") {
      await transaction.query(
        `UPDATE contacts SET permission_status=$3,opted_out_at=CASE WHEN $3='opted_out' THEN now() ELSE opted_out_at END,
                version=version+1,updated_at=now()
          WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, input.contactId, input.reason === "opt_out" ? "opted_out" : "prohibited"]
      );
    }
    await transaction.query(
      `UPDATE outreach_sequence_enrollments SET status='stopped',stop_reason=$3,
              stopped_at=now(),version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND contact_id=$2 AND status='active'`,
      [input.workspaceId, input.contactId, input.reason]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId ?? null,
      actorType: input.actorUserId ? "user" : "provider",
      action: "communication.suppressed", targetType: "contact", targetId: input.contactId,
      origin: input.source, requestId: input.requestId, outcome: "succeeded",
      metadata: { channel: input.channel, reason: input.reason, suppressionId: id }
    });
    return created.rows[0]!;
  });
}

export async function correctSuppression(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; suppressionId: string;
    reason: string; evidence: string;
  }
): Promise<Record<string, unknown>> {
  const changed = await database.query<Record<string, unknown>>(
    `UPDATE communication_suppressions SET status='corrected',corrected_by=$3,
            corrected_reason=$4,correction_evidence=$5,corrected_at=now()
      WHERE workspace_id=$1 AND id=$2 AND status='active'
      RETURNING id,contact_id AS "contactId",channel,reason,status,corrected_at AS "correctedAt"`,
    [input.workspaceId, input.suppressionId, input.actorUserId, input.reason, input.evidence]
  );
  if (!changed.rows[0]) throw new AppError(409, "suppression_correction_unavailable", "Active suppression not found.");
  await recordAudit(database, {
    workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
    action: "communication.suppression_corrected", targetType: "communication_suppression",
    targetId: input.suppressionId, origin: "api", requestId: input.requestId,
    outcome: "succeeded", after: changed.rows[0], metadata: { evidence: input.evidence }
  });
  return changed.rows[0];
}

export async function logOutreachCall(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; placementId: string;
    contactId: string; status: "planned" | "completed" | "no_answer" | "voicemail" | "canceled";
    objective: string; preparation: string; questions: string[];
    objectionGuidance: Record<string, unknown>[]; authorityLimits: string;
    voicemailScript: string; notes: string; outcome: string;
    durationSeconds?: number | null | undefined; occurredAt?: string | null | undefined;
    nextActionTitle?: string | null | undefined; nextActionDueAt?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const placement = await oneOrNone<{
      agreementId: string; brandId: string; businessId: string; stage: string; channel: string;
    }>(
      transaction,
      `SELECT agreement_id AS "agreementId",brand_id AS "brandId",
              business_id AS "businessId",stage,authority_channel AS channel
         FROM placement_opportunities WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL`,
      [input.workspaceId, input.placementId]
    );
    if (!placement) throw new AppError(404, "placement_not_found", "Placement Opportunity not found.");
    const products = await transaction.query<{ productId: string }>(
      `SELECT product_id AS "productId" FROM placement_opportunity_products
        WHERE workspace_id=$1 AND placement_opportunity_id=$2`,
      [input.workspaceId, input.placementId]
    );
    const authority = await validateCurrentAuthority(transaction, {
      workspaceId: input.workspaceId, brandId: placement.brandId,
      productIds: products.rows.map((item) => item.productId), businessId: placement.businessId,
      channel: placement.channel, agreementId: placement.agreementId,
      requireTerritoryProof: true
    });
    if (authority.outcome !== "authorized") {
      throw new AppError(409, "representation_authority_invalid", `Call is blocked: ${authority.reasonCodes.join(", ")}.`);
    }
    const shell = await loadContactSuppression(transaction, input.workspaceId, input.contactId, "call");
    if (shell.length > 0) throw new AppError(409, "outreach_suppressed", `Call is blocked: ${shell.join(", ")}.`);
    const id = newId();
    let activityId: string | null = null;
    if (["completed", "no_answer", "voicemail"].includes(input.status)) {
      activityId = newId();
      await transaction.query(
        `INSERT INTO activities
          (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
         VALUES($1,$2,$7,$3,'placement_opportunity',$4,$5,'completed',$6)`,
        [activityId, input.workspaceId, input.actorUserId, input.placementId,
          `Call logged: ${input.status}`, { outreachCallId: id, outcome: input.outcome },
          input.status === "completed" ? "call_connected" :
            input.status === "voicemail" ? "call_voicemail" : "call_no_answer"]
      );
    }
    const created = await transaction.query<Record<string, unknown>>(
      `INSERT INTO outreach_calls
        (id,workspace_id,placement_opportunity_id,agreement_id,brand_id,business_id,
         contact_id,owner_user_id,status,objective,preparation,questions,objection_guidance,
         authority_limits,voicemail_script,notes,outcome,duration_seconds,occurred_at,activity_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id,status,objective,notes,outcome,occurred_at AS "occurredAt",version`,
      [id, input.workspaceId, input.placementId, placement.agreementId, placement.brandId,
        placement.businessId, input.contactId, input.actorUserId, input.status, input.objective,
        input.preparation, input.questions, input.objectionGuidance, input.authorityLimits,
        input.voicemailScript, input.notes, input.outcome, input.durationSeconds ?? null,
        input.occurredAt ?? (input.status === "planned" ? null : new Date().toISOString()), activityId]
    );
    if (input.nextActionTitle) {
      await transaction.query(
        `INSERT INTO tasks
          (id,workspace_id,subject_type,subject_id,title,owner_user_id,status,priority,
           created_reason,due_at,mandatory_gate)
         VALUES($1,$2,'placement_opportunity',$3,$4,$5,'open','medium','Call follow-up',$6,false)`,
        [newId(), input.workspaceId, input.placementId, input.nextActionTitle,
          input.actorUserId, input.nextActionDueAt ?? null]
      );
    }
    if (placement.stage === "prepared" && ["completed", "voicemail"].includes(input.status) && activityId) {
      const messageShape = {
        workspaceId: input.workspaceId,
        placementOpportunityId: input.placementId
      } as MessageContext;
      await markPlacementContacted(transaction, messageShape, input.actorUserId, activityId);
    }
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: `outreach_call.${input.status}`, targetType: "outreach_call", targetId: id,
      origin: "api", requestId: input.requestId, outcome: "succeeded",
      after: created.rows[0], metadata: { authorityDigest: authority.authorityDigest, humanPlaced: true }
    });
    return created.rows[0]!;
  });
}

async function loadContactSuppression(
  database: Database | Transaction,
  workspaceId: string,
  contactId: string,
  channel: string
): Promise<string[]> {
  const result = await database.query<{ reason: string }>(
    `SELECT reason FROM communication_suppressions
      WHERE workspace_id=$1 AND contact_id=$2 AND status='active'
        AND channel IN ($3,'all')`,
    [workspaceId, contactId, channel]
  );
  return result.rows.map((item) => item.reason);
}

export async function createOutreachTemplate(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; name: string;
    channel: "email" | "social" | "call" | "voicemail" | "objection" | "follow_up";
    purpose: string; subject: string; body: string; requiredVariables: string[];
    requiredComplianceBlocks: string[];
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const id = newId();
    const versionId = newId();
    const template = await transaction.query<Record<string, unknown>>(
      `INSERT INTO outreach_templates
        (id,workspace_id,name,channel,purpose,status,current_version,owner_user_id)
       VALUES($1,$2,$3,$4,$5,'active',1,$6)
       RETURNING id,name,channel,purpose,status,current_version AS "currentVersion"`,
      [id, input.workspaceId, input.name, input.channel, input.purpose, input.actorUserId]
    );
    await transaction.query(
      `INSERT INTO outreach_template_versions
        (id,workspace_id,template_id,version,subject,body,required_variables,
         required_compliance_blocks,change_reason,created_by)
       VALUES($1,$2,$3,1,$4,$5,$6,$7,'Initial version',$8)`,
      [versionId, input.workspaceId, id, input.subject, input.body,
        input.requiredVariables, input.requiredComplianceBlocks, input.actorUserId]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "outreach_template.created", targetType: "outreach_template",
      targetId: id, origin: "api", requestId: input.requestId,
      outcome: "succeeded", after: template.rows[0]
    });
    return { ...template.rows[0], versionId };
  });
}

export async function listOutreachTemplates(
  database: Database,
  workspaceId: string
): Promise<Record<string, unknown>[]> {
  const result = await database.query<Record<string, unknown>>(
    `SELECT t.id,t.name,t.channel,t.purpose,t.status,t.current_version AS "currentVersion",
            v.id AS "versionId",v.subject,v.body,v.required_variables AS "requiredVariables",
            v.required_compliance_blocks AS "requiredComplianceBlocks",t.updated_at AS "updatedAt"
       FROM outreach_templates t
       JOIN outreach_template_versions v ON v.workspace_id=t.workspace_id AND v.template_id=t.id
        AND v.version=t.current_version
      WHERE t.workspace_id=$1 AND t.status<>'archived' ORDER BY t.name`,
    [workspaceId]
  );
  return result.rows;
}

export async function createSequence(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; name: string;
    purpose: string; steps: Array<{
      stepType: "email" | "social" | "call" | "task"; delayMinutes: number;
      templateVersionId?: string | null | undefined; taskTitle?: string | null | undefined; instructions: string;
    }>;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const id = newId();
    const sequence = await transaction.query<Record<string, unknown>>(
      `INSERT INTO outreach_sequences
        (id,workspace_id,name,purpose,status,owner_user_id)
       VALUES($1,$2,$3,$4,'active',$5)
       RETURNING id,name,purpose,status,current_version AS "currentVersion"`,
      [id, input.workspaceId, input.name, input.purpose, input.actorUserId]
    );
    for (const [index, step] of input.steps.entries()) {
      if (["email", "social"].includes(step.stepType) && !step.templateVersionId) {
        throw new AppError(422, "sequence_template_required", "External sequence steps require a template version.");
      }
      await transaction.query(
        `INSERT INTO outreach_sequence_steps
          (id,workspace_id,sequence_id,sequence_version,position,step_type,delay_minutes,
           template_version_id,task_title,instructions,created_by)
         VALUES($1,$2,$3,1,$4,$5,$6,$7,$8,$9,$10)`,
        [newId(), input.workspaceId, id, index + 1, step.stepType, step.delayMinutes,
          step.templateVersionId ?? null, step.taskTitle ?? null, step.instructions, input.actorUserId]
      );
    }
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "outreach_sequence.created", targetType: "outreach_sequence",
      targetId: id, origin: "api", requestId: input.requestId,
      outcome: "succeeded", after: sequence.rows[0], metadata: { stepCount: input.steps.length }
    });
    return sequence.rows[0]!;
  });
}

export async function listSequences(
  database: Database,
  workspaceId: string
): Promise<Record<string, unknown>[]> {
  const result = await database.query<Record<string, unknown>>(
    `SELECT s.id,s.name,s.purpose,s.status,s.current_version AS "currentVersion",
            count(st.id)::int AS "stepCount",
            count(e.id) FILTER(WHERE e.status='active')::int AS "activeEnrollments",
            s.updated_at AS "updatedAt"
       FROM outreach_sequences s
       LEFT JOIN outreach_sequence_steps st ON st.workspace_id=s.workspace_id
        AND st.sequence_id=s.id AND st.sequence_version=s.current_version
       LEFT JOIN outreach_sequence_enrollments e ON e.workspace_id=s.workspace_id
        AND e.sequence_id=s.id
      WHERE s.workspace_id=$1 AND s.status<>'archived'
      GROUP BY s.id ORDER BY s.updated_at DESC`,
    [workspaceId]
  );
  return result.rows;
}

export async function enrollSequence(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string;
    sequenceId: string; placementId: string; contactId: string;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const sequence = await oneOrNone<{ version: number; status: string }>(
      transaction,
      `SELECT current_version AS version,status FROM outreach_sequences
        WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, input.sequenceId]
    );
    if (!sequence || sequence.status !== "active") {
      throw new AppError(409, "sequence_unavailable", "Sequence is not active.");
    }
    const placement = await oneOrNone<{ agreementId: string; brandId: string; businessId: string; channel: string }>(
      transaction,
      `SELECT agreement_id AS "agreementId",brand_id AS "brandId",
              business_id AS "businessId",authority_channel AS channel
        FROM placement_opportunities WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, input.placementId]
    );
    if (!placement) throw new AppError(404, "placement_not_found", "Placement Opportunity not found.");
    const products = await transaction.query<{ productId: string }>(
      `SELECT product_id AS "productId" FROM placement_opportunity_products
        WHERE workspace_id=$1 AND placement_opportunity_id=$2`,
      [input.workspaceId, input.placementId]
    );
    const authority = await validateCurrentAuthority(transaction, {
      workspaceId: input.workspaceId, brandId: placement.brandId,
      productIds: products.rows.map((item) => item.productId), businessId: placement.businessId,
      channel: placement.channel, agreementId: placement.agreementId, requireTerritoryProof: true
    });
    if (authority.outcome !== "authorized") {
      throw new AppError(409, "representation_authority_invalid", "Sequence enrollment requires current authority.");
    }
    if ((await loadContactSuppression(transaction, input.workspaceId, input.contactId, "all")).length > 0) {
      throw new AppError(409, "outreach_suppressed", "Suppressed Contacts cannot enter a sequence.");
    }
    const first = await oneOrNone<{ delayMinutes: number }>(
      transaction,
      `SELECT delay_minutes AS "delayMinutes" FROM outreach_sequence_steps
        WHERE workspace_id=$1 AND sequence_id=$2 AND sequence_version=$3 AND position=1`,
      [input.workspaceId, input.sequenceId, sequence.version]
    );
    if (!first) throw new AppError(422, "sequence_steps_required", "Sequence has no steps.");
    const id = newId();
    const nextAt = new Date(Date.now() + first.delayMinutes * 60_000);
    const created = await transaction.query<Record<string, unknown>>(
      `INSERT INTO outreach_sequence_enrollments
        (id,workspace_id,sequence_id,sequence_version,placement_opportunity_id,
         contact_id,owner_user_id,status,current_position,next_step_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,'active',0,$8)
       RETURNING id,status,current_position AS "currentPosition",next_step_at AS "nextStepAt"`,
      [id, input.workspaceId, input.sequenceId, sequence.version, input.placementId,
        input.contactId, input.actorUserId, nextAt]
    );
    await enqueueJob(transaction, {
      workspaceId: input.workspaceId, kind: "outreach.sequence_step",
      payload: { enrollmentId: id, actorUserId: input.actorUserId },
      idempotencyKey: `outreach.sequence:${id}:1`, availableAt: nextAt
    });
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "outreach_sequence.enrolled", targetType: "outreach_sequence_enrollment",
      targetId: id, origin: "api", requestId: input.requestId, outcome: "succeeded",
      metadata: { authorityDigest: authority.authorityDigest }
    });
    return created.rows[0]!;
  });
}

export async function processSequenceStep(
  database: Database,
  input: { workspaceId: string; enrollmentId: string; actorUserId: string }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const enrollment = await oneOrNone<{
      id: string; sequenceId: string; sequenceVersion: number; placementId: string;
      contactId: string; currentPosition: number; status: string;
    }>(
      transaction,
      `SELECT id,sequence_id AS "sequenceId",sequence_version AS "sequenceVersion",
              placement_opportunity_id AS "placementId",contact_id AS "contactId",
              current_position AS "currentPosition",status
         FROM outreach_sequence_enrollments
        WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,
      [input.workspaceId, input.enrollmentId]
    );
    if (!enrollment || enrollment.status !== "active") {
      return { status: "stopped", reason: "enrollment_inactive" };
    }
    const step = await oneOrNone<{
      id: string; stepType: string; taskTitle: string | null; instructions: string;
    }>(
      transaction,
      `SELECT id,step_type AS "stepType",task_title AS "taskTitle",instructions
         FROM outreach_sequence_steps
        WHERE workspace_id=$1 AND sequence_id=$2 AND sequence_version=$3 AND position=$4`,
      [input.workspaceId, enrollment.sequenceId, enrollment.sequenceVersion, enrollment.currentPosition + 1]
    );
    if (!step) {
      await transaction.query(
        `UPDATE outreach_sequence_enrollments SET status='completed',next_step_at=NULL,
                version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, enrollment.id]
      );
      return { status: "completed" };
    }
    const taskId = newId();
    await transaction.query(
      `INSERT INTO tasks
        (id,workspace_id,subject_type,subject_id,title,owner_user_id,status,priority,
         created_reason,due_at,mandatory_gate)
       VALUES($1,$2,'placement_opportunity',$3,$4,$5,'open','high',$6,now(),false)`,
      [taskId, input.workspaceId, enrollment.placementId,
        step.stepType === "task" ? (step.taskTitle ?? "Complete sequence task") :
          `Prepare and approve ${step.stepType} sequence step`,
        input.actorUserId,
        `Sequence step ${enrollment.currentPosition + 1}; external action is not automatic. ${step.instructions}`]
    );
    await transaction.query(
      `UPDATE outreach_sequence_enrollments SET current_position=current_position+1,
              next_step_at=NULL,version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2`,
      [input.workspaceId, enrollment.id]
    );
    return { status: "awaiting_human_action", taskId, stepType: step.stepType };
  });
}

export async function unifiedOutreachHistory(
  database: Database,
  workspaceId: string,
  placementId?: string
): Promise<Record<string, unknown>[]> {
  const result = await database.query<Record<string, unknown>>(
    `SELECT * FROM (
       SELECT m.id,'message' AS kind,m.channel AS type,m.status,
              CASE WHEN m.direction='inbound' THEN 'Received: ' ELSE 'Sent/draft: ' END||
                COALESCE(NULLIF(m.subject,''),left(m.body,120)) AS summary,
              m.placement_opportunity_id AS "placementId",m.updated_at AS "occurredAt"
         FROM outreach_messages m WHERE m.workspace_id=$1
       UNION ALL
       SELECT c.id,'call', 'call',c.status,c.objective,c.placement_opportunity_id,c.updated_at
         FROM outreach_calls c WHERE c.workspace_id=$1
       UNION ALL
       SELECT a.id,'activity',a.activity_type,a.status,a.summary,
              CASE WHEN a.subject_type='placement_opportunity' THEN a.subject_id ELSE NULL END,
              a.occurred_at FROM activities a WHERE a.workspace_id=$1
       UNION ALL
       SELECT t.id,'task','task',t.status,t.title,
              CASE WHEN t.subject_type='placement_opportunity' THEN t.subject_id ELSE NULL END,
              t.updated_at FROM tasks t WHERE t.workspace_id=$1
     ) history
     WHERE ($2::uuid IS NULL OR "placementId"=$2)
     ORDER BY "occurredAt" DESC LIMIT 500`,
    [workspaceId, placementId ?? null]
  );
  return result.rows;
}

export async function processOutreachProviderEvent(
  database: Database,
  input: {
    providerEventId: string;
    providerMessageId?: string | null | undefined;
    messageId?: string | null | undefined;
    eventType: "accepted" | "delivered" | "bounced" | "complained" | "replied" | "opted_out";
    replyBody?: string | null | undefined;
    payloadDigest: string;
    requestId: string;
  }
): Promise<{ processed: boolean; reason?: string }> {
  return withTransaction(database, async (transaction) => {
    const receiptId = newId();
    const receipt = await transaction.query<{ id: string }>(
      `INSERT INTO outreach_provider_events
        (id,provider_event_id,provider_message_id,event_type,signature_verified,payload_digest)
       VALUES($1,$2,$3,$4,true,$5)
       ON CONFLICT(provider_event_id) DO NOTHING RETURNING id`,
      [receiptId, input.providerEventId, input.providerMessageId ?? null, input.eventType, input.payloadDigest]
    );
    if (!receipt.rows[0]) return { processed: false, reason: "duplicate" };
    const message = await oneOrNone<{
      id: string; workspaceId: string; contactId: string; placementId: string;
      ownerUserId: string; enrollmentId: string | null; subject: string;
    }>(
      transaction,
      `SELECT id,workspace_id AS "workspaceId",contact_id AS "contactId",
              placement_opportunity_id AS "placementId",owner_user_id AS "ownerUserId",
              sequence_enrollment_id AS "enrollmentId",subject
         FROM outreach_messages
        WHERE ($1::text IS NOT NULL AND provider_message_id=$1)
           OR ($2::uuid IS NOT NULL AND id=$2)
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [input.providerMessageId ?? null, input.messageId ?? null]
    );
    if (!message) {
      await transaction.query(
        `UPDATE outreach_provider_events SET processed_at=now() WHERE id=$1`,
        [receiptId]
      );
      return { processed: false, reason: "message_not_found" };
    }
    const mappedStatus: Record<typeof input.eventType, string> = {
      accepted: "accepted",
      delivered: "delivered",
      bounced: "bounced",
      complained: "suppressed",
      replied: "replied",
      opted_out: "suppressed"
    };
    await transaction.query(
      `UPDATE outreach_messages SET status=$3,provider_status=$4,
              delivered_at=CASE WHEN $4='delivered' THEN now() ELSE delivered_at END,
              replied_at=CASE WHEN $4='replied' THEN now() ELSE replied_at END,
              version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2`,
      [message.workspaceId, message.id, mappedStatus[input.eventType], input.eventType]
    );
    const activityId = newId();
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,subject_type,subject_id,summary,status,metadata)
       VALUES($1,$2,$3,'placement_opportunity',$4,$5,'completed',$6)`,
      [activityId, message.workspaceId, `email_${input.eventType}`, message.placementId,
        `Email ${input.eventType}: ${message.subject || "outreach"}`,
        { outreachMessageId: message.id, providerEventId: input.providerEventId }]
    );
    if (["replied", "opted_out", "bounced", "complained"].includes(input.eventType)) {
      await transaction.query(
        `UPDATE outreach_sequence_enrollments SET status='stopped',stop_reason=$3,
                stopped_at=now(),version=version+1,updated_at=now()
          WHERE workspace_id=$1 AND contact_id=$2 AND status='active'`,
        [message.workspaceId, message.contactId, input.eventType]
      );
    }
    if (["opted_out", "bounced", "complained"].includes(input.eventType)) {
      const reason = input.eventType === "opted_out"
        ? "opt_out"
        : input.eventType === "bounced" ? "hard_bounce" : "complaint";
      await transaction.query(
        `INSERT INTO communication_suppressions
          (id,workspace_id,contact_id,channel,reason,status,source,source_event_id)
         SELECT $1,$2,$3,'email',$4,'active','provider_webhook',$5
          WHERE NOT EXISTS(
            SELECT 1 FROM communication_suppressions
             WHERE workspace_id=$2 AND contact_id=$3 AND channel='email'
               AND reason=$4 AND status='active'
          )`,
        [newId(), message.workspaceId, message.contactId, reason, input.providerEventId]
      );
      if (input.eventType === "opted_out") {
        await transaction.query(
          `UPDATE contacts SET permission_status='opted_out',opted_out_at=now(),
                  version=version+1,updated_at=now()
            WHERE workspace_id=$1 AND id=$2`,
          [message.workspaceId, message.contactId]
        );
      }
    }
    if (input.eventType === "replied") {
      await transaction.query(
        `INSERT INTO outreach_messages
          (id,workspace_id,placement_opportunity_id,agreement_id,brand_id,business_id,
           contact_id,owner_user_id,channel,direction,sender_address,recipient_address,
           subject,body,status,origin,provider_message_id,replied_at)
         SELECT $1,workspace_id,placement_opportunity_id,agreement_id,brand_id,business_id,
                contact_id,owner_user_id,'email','inbound',recipient_address,sender_address,
                'Re: '||subject,$2,'received','provider',$3,now()
           FROM outreach_messages WHERE workspace_id=$4 AND id=$5`,
        [newId(), input.replyBody ?? "(Reply content unavailable)", `${input.providerMessageId ?? message.id}:reply`,
          message.workspaceId, message.id]
      );
      await transaction.query(
        `INSERT INTO tasks
          (id,workspace_id,subject_type,subject_id,title,owner_user_id,status,priority,
           created_reason,due_at,mandatory_gate)
         VALUES($1,$2,'placement_opportunity',$3,'Review Buyer reply',$4,'open','high',
                'Provider recorded an inbound reply',now(),false)`,
        [newId(), message.workspaceId, message.placementId, message.ownerUserId]
      );
      await transaction.query(
        `INSERT INTO notifications
          (id,workspace_id,user_id,notification_type,severity,title,reason,
           subject_type,subject_id,status,blocking)
         VALUES($1,$2,$3,'outreach_reply','action_required','Buyer reply received',
                'Review and classify the response before the next external action.',
                'placement_opportunity',$4,'unread',false)`,
        [newId(), message.workspaceId, message.ownerUserId, message.placementId]
      );
    }
    await transaction.query(
      `UPDATE outreach_provider_events SET processed_at=now() WHERE id=$1`,
      [receiptId]
    );
    await recordAudit(transaction, {
      workspaceId: message.workspaceId, actorType: "provider",
      action: `outreach_provider.${input.eventType}`, targetType: "outreach_message",
      targetId: message.id, origin: "webhook", requestId: input.requestId,
      outcome: "succeeded", metadata: {
        providerEventId: input.providerEventId, activityId,
        sequenceStopped: ["replied", "opted_out", "bounced", "complained"].includes(input.eventType)
      }
    });
    return { processed: true };
  });
}

export async function classifyOutreachResponse(
  database: Database,
  input: {
    workspaceId: string; actorUserId: string; requestId: string; messageId: string;
    classification: "interested" | "not_now" | "objection" | "question" | "opt_out" | "wrong_contact" | "not_fit";
    notes: string; nextActionTitle?: string | null | undefined; nextActionDueAt?: string | null | undefined;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const message = await oneOrNone<{
      id: string; contactId: string; placementId: string; status: string;
    }>(
      transaction,
      `SELECT id,contact_id AS "contactId",placement_opportunity_id AS "placementId",status
         FROM outreach_messages WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,
      [input.workspaceId, input.messageId]
    );
    if (!message || !["replied", "received"].includes(message.status)) {
      throw new AppError(409, "response_classification_unavailable", "Only a recorded Buyer response can be classified.");
    }
    const changed = await transaction.query<Record<string, unknown>>(
      `UPDATE outreach_messages SET response_classification=$3,response_notes=$4,
              classified_by=$5,classified_at=now(),version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2
        RETURNING id,response_classification AS "responseClassification",
                  response_notes AS "responseNotes",classified_at AS "classifiedAt",version`,
      [input.workspaceId, input.messageId, input.classification, input.notes, input.actorUserId]
    );
    const activityId = newId();
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,
         summary,status,metadata)
       VALUES($1,$2,'buyer_reply',$3,'placement_opportunity',$4,$5,'completed',$6)`,
      [activityId, input.workspaceId, input.actorUserId, message.placementId,
        `Buyer response classified: ${input.classification}`,
        { outreachMessageId: input.messageId, notes: input.notes }]
    );
    if (input.classification === "opt_out") {
      await transaction.query(
        `INSERT INTO communication_suppressions
          (id,workspace_id,contact_id,channel,reason,status,source,created_by)
         SELECT $1,$2,$3,'email','opt_out','active','human_response_classification',$4
          WHERE NOT EXISTS(
            SELECT 1 FROM communication_suppressions
             WHERE workspace_id=$2 AND contact_id=$3 AND channel='email'
               AND reason='opt_out' AND status='active'
          )`,
        [newId(), input.workspaceId, message.contactId, input.actorUserId]
      );
      await transaction.query(
        `UPDATE contacts SET permission_status='opted_out',opted_out_at=now(),
                version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2`,
        [input.workspaceId, message.contactId]
      );
      await transaction.query(
        `UPDATE outreach_sequence_enrollments SET status='stopped',stop_reason='opt_out',
                stopped_at=now(),version=version+1,updated_at=now()
          WHERE workspace_id=$1 AND contact_id=$2 AND status='active'`,
        [input.workspaceId, message.contactId]
      );
    }
    if (input.nextActionTitle) {
      await transaction.query(
        `INSERT INTO tasks
          (id,workspace_id,subject_type,subject_id,title,owner_user_id,status,priority,
           created_reason,due_at,mandatory_gate)
         VALUES($1,$2,'placement_opportunity',$3,$4,$5,'open','high',
                'Human-classified Buyer response',$6,false)`,
        [newId(), input.workspaceId, message.placementId, input.nextActionTitle,
          input.actorUserId, input.nextActionDueAt ?? null]
      );
    }
    await recordAudit(transaction, {
      workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorType: "user",
      action: "outreach_response.classified", targetType: "outreach_message",
      targetId: input.messageId, origin: "api", requestId: input.requestId,
      outcome: "succeeded", after: changed.rows[0],
      metadata: { classification: input.classification, activityId, humanOwned: true }
    });
    return changed.rows[0]!;
  });
}
