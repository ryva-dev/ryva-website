/**
 * Deterministic opportunity state engine.
 * LLMs may propose; this module validates evidence and persists stage events.
 */
import { randomUUID } from "node:crypto";
import {
  isValidLifecycleTransition,
  legacyStatusFromLifecycle,
  mergeResearchLifecycle,
  normalizeLifecycleStage,
  buildNextAction,
  detectStall,
  TERMINAL_OR_ADVANCED_STAGES
} from "./maraOpportunityLifecycle.mjs";

function nowIso() {
  return new Date().toISOString();
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function ensureOpportunityLifecycleSchema(store) {
  // SQLite / dual-backend additive columns — ignore if already present.
  const alters = [
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN lifecycle_stage TEXT`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN previous_lifecycle_stage TEXT`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN stage_changed_at TEXT`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN estimated_deal_value REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN confirmed_deal_value REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN expected_revenue REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN actual_revenue REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN next_action_json TEXT`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN next_action_due_at TEXT`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN blocking_reason TEXT`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN attribution TEXT NOT NULL DEFAULT 'uncertain'`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN loss_reason TEXT`,
    `ALTER TABLE mara_creator_brand_opportunities ADD COLUMN deal_terms_json TEXT`,
    `ALTER TABLE office_leads ADD COLUMN opportunity_id TEXT`,
    `ALTER TABLE office_campaigns ADD COLUMN opportunity_id TEXT`
  ];
  for (const sql of alters) {
    try {
      await store.execute(sql);
    } catch {
      // column exists
    }
  }

  await store.execute(`
    CREATE TABLE IF NOT EXISTS mara_opportunity_stage_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      opportunity_id TEXT NOT NULL,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0,
      requires_confirmation INTEGER NOT NULL DEFAULT 0,
      confirmed INTEGER NOT NULL DEFAULT 0,
      evidence_json TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'system',
      reason TEXT,
      created_at TEXT NOT NULL
    )
  `);
  try {
    await store.execute(
      `CREATE INDEX IF NOT EXISTS idx_mara_stage_events_opp ON mara_opportunity_stage_events(user_id, worker_id, opportunity_id, created_at)`
    );
  } catch {
    // ignore
  }
}

export function classifyTransitionSensitivity({ toStage, confidence = 0, source = "system" } = {}) {
  const stage = normalizeLifecycleStage(toStage);
  const financial = new Set(["won", "paid", "invoiced", "payment_due", "overdue", "lost"]);
  const irreversible = new Set(["paid", "lost", "archived", "disqualified"]);
  const highConfidence = Number(confidence) >= 75;
  const requiresConfirmation =
    source === "user_correction"
      ? false
      : financial.has(stage) || irreversible.has(stage) || Number(confidence) < 55;
  return {
    requiresConfirmation,
    autoApply: !requiresConfirmation && (highConfidence || source === "user_correction" || source === "approved_send")
  };
}

export async function recordStageEvent(store, {
  userId,
  workerId,
  opportunityId,
  fromStage,
  toStage,
  confidence = 70,
  evidence = [],
  source = "system",
  reason = "",
  requiresConfirmation = false,
  confirmed = false
}) {
  const id = randomUUID();
  await store.execute(
    `INSERT INTO mara_opportunity_stage_events
      (id, user_id, worker_id, opportunity_id, from_stage, to_stage, confidence, requires_confirmation, confirmed, evidence_json, source, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    userId,
    workerId,
    opportunityId,
    fromStage || null,
    toStage,
    Number(confidence) || 0,
    requiresConfirmation ? 1 : 0,
    confirmed ? 1 : 0,
    JSON.stringify(evidence || []),
    source,
    reason || null,
    nowIso()
  );
  return id;
}

export async function getOpportunityRow(store, userId, workerId, opportunityId) {
  return store.queryOne(
    `SELECT id, user_id AS "userId", worker_id AS "workerId", status,
            lifecycle_stage AS "lifecycleStage", previous_lifecycle_stage AS "previousLifecycleStage",
            stage_changed_at AS "stageChangedAt", score_total AS "scoreTotal", confidence,
            estimated_deal_value AS "estimatedDealValue", confirmed_deal_value AS "confirmedDealValue",
            expected_revenue AS "expectedRevenue", actual_revenue AS "actualRevenue",
            next_action_json AS "nextActionJson", next_action_due_at AS "nextActionDueAt",
            blocking_reason AS "blockingReason", attribution, loss_reason AS "lossReason",
            deal_terms_json AS "dealTermsJson", opportunity_package_json AS "packageJson",
            evidence_json AS "evidenceJson", decision, updated_at AS "updatedAt", created_at AS "createdAt"
     FROM mara_creator_brand_opportunities
     WHERE id = ? AND user_id = ? AND worker_id = ?`,
    opportunityId,
    userId,
    workerId
  );
}

export async function transitionOpportunityStage(store, {
  userId,
  workerId,
  opportunityId,
  toStage,
  confidence = 70,
  evidence = [],
  source = "system",
  reason = "",
  force = false,
  estimatedDealValue = null,
  confirmedDealValue = null,
  actualRevenue = null,
  attribution = null,
  lossReason = null,
  dealTerms = null
}) {
  const row = await getOpportunityRow(store, userId, workerId, opportunityId);
  if (!row) throw new Error("Opportunity not found.");

  const fromStage = normalizeLifecycleStage(row.lifecycleStage, { legacyStatus: row.status });
  const target = normalizeLifecycleStage(toStage);
  if (!force && !isValidLifecycleTransition(fromStage, target)) {
    return {
      applied: false,
      requiresConfirmation: true,
      reason: `Invalid transition ${fromStage} → ${target}`,
      fromStage,
      toStage: target
    };
  }

  const sensitivity = classifyTransitionSensitivity({ toStage: target, confidence, source });
  if (!force && sensitivity.requiresConfirmation && source !== "user_correction" && source !== "approved_send") {
    await recordStageEvent(store, {
      userId,
      workerId,
      opportunityId,
      fromStage,
      toStage: target,
      confidence,
      evidence,
      source,
      reason: reason || "Awaiting confirmation for sensitive stage change",
      requiresConfirmation: true,
      confirmed: false
    });
    const proposedNext = buildNextAction({ lifecycleStage: target });
    await store.execute(
      `UPDATE mara_creator_brand_opportunities
       SET next_action_json = ?, blocking_reason = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      JSON.stringify({
        ...proposedNext,
        pendingStage: target,
        pendingReason: reason,
        requiresConfirmation: true
      }),
      reason || proposedNext.blockingReason || "Stage change needs confirmation",
      nowIso(),
      opportunityId,
      userId
    );
    return {
      applied: false,
      requiresConfirmation: true,
      fromStage,
      toStage: target,
      confidence,
      evidence
    };
  }

  const next = buildNextAction({ lifecycleStage: target });
  const legacyStatus = legacyStatusFromLifecycle(target);
  await store.execute(
    `UPDATE mara_creator_brand_opportunities
     SET lifecycle_stage = ?, previous_lifecycle_stage = ?, stage_changed_at = ?, status = ?,
         next_action_json = ?, next_action_due_at = ?, blocking_reason = ?,
         estimated_deal_value = COALESCE(?, estimated_deal_value),
         confirmed_deal_value = COALESCE(?, confirmed_deal_value),
         actual_revenue = COALESCE(?, actual_revenue),
         attribution = COALESCE(?, attribution),
         loss_reason = COALESCE(?, loss_reason),
         deal_terms_json = COALESCE(?, deal_terms_json),
         updated_at = ?
     WHERE id = ? AND user_id = ? AND worker_id = ?`,
    target,
    fromStage,
    nowIso(),
    legacyStatus,
    JSON.stringify(next),
    null,
    next.blockingReason,
    estimatedDealValue,
    confirmedDealValue,
    actualRevenue,
    attribution,
    lossReason,
    dealTerms ? JSON.stringify(dealTerms) : null,
    nowIso(),
    opportunityId,
    userId,
    workerId
  );

  await recordStageEvent(store, {
    userId,
    workerId,
    opportunityId,
    fromStage,
    toStage: target,
    confidence,
    evidence,
    source,
    reason,
    requiresConfirmation: false,
    confirmed: true
  });

  return { applied: true, fromStage, toStage: target, legacyStatus, nextAction: next };
}

/**
 * Infer a proposed stage from structured commercial signals (no LLM mutation).
 */
export function inferStageFromSignals({
  currentStage = "discovered",
  hasObservedEvidence = false,
  decision = null,
  hasOutreachContact = false,
  draftPrepared = false,
  approvalPending = false,
  sent = false,
  followUpDue = false,
  replyClass = null,
  hired = false,
  declined = false,
  briefReceived = false,
  producing = false,
  submitted = false,
  revisionRequested = false,
  brandApproved = false,
  invoiced = false,
  paymentDue = false,
  overdue = false,
  paid = false,
  giftedOnly = false
} = {}) {
  const current = normalizeLifecycleStage(currentStage);
  let proposed = current;
  let confidence = 60;
  let reason = "No material commercial signal";

  if (declined) {
    return { stage: "lost", confidence: 85, reason: "Decline language observed", requiresConfirmation: true };
  }
  if (paid) {
    return { stage: "paid", confidence: 80, reason: "Payment confirmed language", requiresConfirmation: true };
  }
  if (overdue) {
    return { stage: "overdue", confidence: 70, reason: "Overdue payment signal", requiresConfirmation: true };
  }
  if (paymentDue) {
    return { stage: "payment_due", confidence: 65, reason: "Payment due language", requiresConfirmation: true };
  }
  if (invoiced) {
    return { stage: "invoiced", confidence: 70, reason: "Invoice sent/received", requiresConfirmation: false };
  }
  if (brandApproved) {
    return { stage: "approved_by_brand", confidence: 75, reason: "Brand approved deliverable", requiresConfirmation: false };
  }
  if (revisionRequested) {
    return { stage: "revision_requested", confidence: 80, reason: "Revision request observed", requiresConfirmation: false };
  }
  if (submitted) {
    return { stage: "submitted", confidence: 70, reason: "Deliverable submitted", requiresConfirmation: false };
  }
  if (producing) {
    return { stage: "producing", confidence: 65, reason: "Production activity", requiresConfirmation: false };
  }
  if (briefReceived) {
    return { stage: "brief_received", confidence: 80, reason: "Campaign brief received", requiresConfirmation: false };
  }
  if (hired && !giftedOnly) {
    return { stage: "won", confidence: 85, reason: "Hire/contract language", requiresConfirmation: true };
  }
  if (giftedOnly) {
    return {
      stage: current === "replied" || current === "interested" ? "interested" : current,
      confidence: 70,
      reason: "Gifted/product-only offer — not paid revenue",
      requiresConfirmation: false,
      flags: ["gifted_not_paid"]
    };
  }

  if (replyClass) {
    const map = {
      positive_interest: { stage: "interested", confidence: 75 },
      request_for_rates: { stage: "interested", confidence: 80 },
      request_for_portfolio: { stage: "interested", confidence: 75 },
      request_for_concepts: { stage: "interested", confidence: 75 },
      negotiation: { stage: "negotiating", confidence: 80 },
      contract_or_usage: { stage: "negotiating", confidence: 85 },
      rejection: { stage: "lost", confidence: 85 },
      not_now: { stage: "cold", confidence: 70 },
      gifted_collaboration: { stage: "interested", confidence: 70 },
      paid_opportunity: { stage: "interested", confidence: 80 },
      invoice_or_payment: { stage: "payment_due", confidence: 70 },
      deliverable_or_revision: { stage: "revision_requested", confidence: 75 },
      unclear: { stage: "replied", confidence: 55 },
      out_of_office: { stage: current, confidence: 60 },
      referral: { stage: "contact_found", confidence: 65 },
      suspected_scam: { stage: "disqualified", confidence: 70 }
    };
    const hit = map[replyClass];
    if (hit) {
      return {
        stage: hit.stage,
        confidence: hit.confidence,
        reason: `Reply classified as ${replyClass}`,
        requiresConfirmation: hit.stage === "lost" || hit.stage === "disqualified" || hit.confidence < 60
      };
    }
    proposed = "replied";
    confidence = 70;
    reason = "Brand replied";
  }

  if (followUpDue && (current === "sent" || current === "follow_up_due")) {
    return { stage: "follow_up_due", confidence: 90, reason: "Follow-up cadence due", requiresConfirmation: false };
  }
  if (sent) {
    return { stage: "sent", confidence: 95, reason: "Pitch sent from creator Gmail", requiresConfirmation: false };
  }
  if (approvalPending) {
    return { stage: "approval_needed", confidence: 95, reason: "Send approval pending", requiresConfirmation: false };
  }
  if (draftPrepared) {
    return { stage: "pitch_preparing", confidence: 85, reason: "Pitch draft prepared", requiresConfirmation: false };
  }
  if (hasOutreachContact && (current === "qualified" || current === "contact_needed" || current === "discovered")) {
    return { stage: "contact_found", confidence: 80, reason: "Outreach-ready contact found", requiresConfirmation: false };
  }
  if (!hasOutreachContact && (decision === "pursue" || current === "qualified")) {
    return { stage: "contact_needed", confidence: 75, reason: "Qualified but contact missing", requiresConfirmation: false };
  }
  if (decision === "pursue" && hasObservedEvidence) {
    return { stage: hasOutreachContact ? "contact_found" : "contact_needed", confidence: 70, reason: "Pursue decision", requiresConfirmation: false };
  }
  if (hasObservedEvidence && current === "discovered") {
    return { stage: "researching", confidence: 65, reason: "Research evidence present", requiresConfirmation: false };
  }

  return { stage: proposed, confidence, reason, requiresConfirmation: false };
}

export async function syncOpportunityCommercialFields(store, {
  userId,
  workerId,
  opportunityId,
  hasOutreachContact = false,
  estimatedDealValue = null
}) {
  const row = await getOpportunityRow(store, userId, workerId, opportunityId);
  if (!row) return null;
  const stage = normalizeLifecycleStage(row.lifecycleStage, { legacyStatus: row.status });
  const next = buildNextAction({
    lifecycleStage: stage,
    hasOutreachContact,
    estimatedValue: estimatedDealValue ?? row.estimatedDealValue
  });
  const stall = detectStall({
    lifecycleStage: stage,
    stageChangedAt: row.stageChangedAt || row.updatedAt,
    estimatedValue: estimatedDealValue ?? row.estimatedDealValue,
    hasOutreachContact
  });
  await store.execute(
    `UPDATE mara_creator_brand_opportunities
     SET lifecycle_stage = COALESCE(lifecycle_stage, ?),
         status = ?,
         next_action_json = ?,
         blocking_reason = ?,
         estimated_deal_value = COALESCE(?, estimated_deal_value),
         updated_at = ?
     WHERE id = ? AND user_id = ?`,
    stage,
    legacyStatusFromLifecycle(stage),
    JSON.stringify({ ...next, stall }),
    next.blockingReason || stall?.likelyReason || null,
    estimatedDealValue,
    nowIso(),
    opportunityId,
    userId
  );
  return { stage, next, stall };
}

export async function listBookOfBusiness(store, userId, workerId, { limit = 40 } = {}) {
  const rows = await store.query(
    `SELECT o.id, o.status, o.lifecycle_stage AS "lifecycleStage", o.previous_lifecycle_stage AS "previousLifecycleStage",
            o.stage_changed_at AS "stageChangedAt", o.score_total AS "scoreTotal", o.confidence,
            o.estimated_deal_value AS "estimatedDealValue", o.confirmed_deal_value AS "confirmedDealValue",
            o.actual_revenue AS "actualRevenue", o.next_action_json AS "nextActionJson",
            o.blocking_reason AS "blockingReason", o.attribution, o.decision, o.updated_at AS "updatedAt",
            o.created_at AS "createdAt",
            COALESCE(pb.brand_name, bp.brand_name, 'Unknown brand') AS "brandName",
            COALESCE(pb.website, bp.website) AS website
     FROM mara_creator_brand_opportunities o
     LEFT JOIN mara_public_brands pb ON pb.id = COALESCE(o.public_brand_id, o.brand_profile_id)
     LEFT JOIN mara_brand_profiles bp ON bp.id = o.brand_profile_id
     WHERE o.user_id = ? AND o.worker_id = ?
     ORDER BY
       CASE
         WHEN o.lifecycle_stage IN ('approval_needed','replied','interested','negotiating','overdue','payment_due') THEN 0
         WHEN o.lifecycle_stage IN ('won','brief_received','producing','submitted','revision_requested') THEN 1
         WHEN o.lifecycle_stage IN ('contact_found','pitch_preparing','follow_up_due','sent') THEN 2
         ELSE 3
       END,
       o.estimated_deal_value DESC,
       o.score_total DESC,
       o.updated_at DESC
     LIMIT ?`,
    userId,
    workerId,
    limit
  );

  return rows.map((row) => {
    const stage = normalizeLifecycleStage(row.lifecycleStage, { legacyStatus: row.status });
    const nextAction = parseJson(row.nextActionJson, null) || buildNextAction({ lifecycleStage: stage });
    const stall = detectStall({
      lifecycleStage: stage,
      stageChangedAt: row.stageChangedAt || row.updatedAt,
      estimatedValue: row.estimatedDealValue
    });
    return {
      ...row,
      lifecycleStage: stage,
      nextAction,
      stall,
      package: null
    };
  });
}

export async function listStalledOpportunities(store, userId, workerId) {
  const book = await listBookOfBusiness(store, userId, workerId, { limit: 80 });
  return book.filter((item) => item.stall).sort((a, b) => (b.stall.valueAtRisk || 0) - (a.stall.valueAtRisk || 0));
}

export { mergeResearchLifecycle, TERMINAL_OR_ADVANCED_STAGES, parseJson };
