/**
 * Post-win production + payment ops — advances won opportunities toward paid.
 */
import { randomUUID } from "node:crypto";
import { transitionOpportunityStage, listBookOfBusiness } from "./maraOpportunityStateEngine.mjs";
import { createWorkerTask, createWorkerOutput, createWorkerActivityLog } from "./workerEngine.mjs";

function nowIso() {
  return new Date().toISOString();
}

function parseJson(value, fallback) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function buildProductionTimeline({ brandName, dueDate = null, deliverableCount = 2 } = {}) {
  const start = new Date();
  const due = dueDate ? new Date(dueDate) : new Date(Date.now() + 10 * 24 * 3600_000);
  return {
    brandName,
    deliverableCount,
    milestones: [
      { id: "brief_lock", label: "Lock brief + talking points", dueAt: new Date(start.getTime() + 1 * 86400000).toISOString() },
      { id: "concept_options", label: "Send 2–3 concept options", dueAt: new Date(start.getTime() + 2 * 86400000).toISOString() },
      { id: "film", label: "Film primary takes", dueAt: new Date(start.getTime() + 5 * 86400000).toISOString() },
      { id: "rough_cut", label: "Submit rough cut", dueAt: new Date(Math.min(due.getTime() - 3 * 86400000, start.getTime() + 7 * 86400000)).toISOString() },
      { id: "final", label: "Submit final", dueAt: due.toISOString() },
      { id: "invoice", label: "Invoice after brand approval", dueAt: new Date(due.getTime() + 1 * 86400000).toISOString() }
    ]
  };
}

export async function ensureCampaignForWonOpportunity(store, {
  userId,
  workerId,
  opportunityId,
  brandName,
  estimatedValue = 0
}) {
  const existing = await store.queryOne(
    `SELECT id, campaign_status AS "campaignStatus", opportunity_id AS "opportunityId"
     FROM office_campaigns
     WHERE user_id = ? AND worker_slug = ? AND (opportunity_id = ? OR lower(brand_name) = lower(?))
     ORDER BY updated_at DESC LIMIT 1`,
    userId,
    workerId,
    opportunityId,
    brandName
  ).catch(() => null);

  if (existing?.id) {
    try {
      await store.execute(
        `UPDATE office_campaigns SET opportunity_id = COALESCE(opportunity_id, ?), updated_at = ? WHERE id = ? AND user_id = ?`,
        opportunityId,
        nowIso(),
        existing.id,
        userId
      );
    } catch {
      /* column may be missing */
    }
    return { campaignId: existing.id, created: false };
  }

  const id = randomUUID();
  const now = nowIso();
  try {
    await store.execute(
      `INSERT INTO office_campaigns
        (id, user_id, worker_slug, brand_name, campaign_status, payment_status, payment_amount,
         brief_text, source_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'brief_received', 'pending_terms', ?, ?, ?, ?, ?)`,
      id,
      userId,
      workerId,
      brandName,
      estimatedValue > 0 ? String(estimatedValue) : "",
      `Created by Mara after win for opportunity ${opportunityId}.`,
      `opportunity:${opportunityId}`,
      now,
      now
    );
  } catch {
    // Minimal schema fallback
    await store.execute(
      `INSERT INTO office_campaigns
        (id, user_id, worker_slug, brand_name, campaign_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'brief_received', ?, ?)`,
      id,
      userId,
      workerId,
      brandName,
      now,
      now
    );
  }
  try {
    await store.execute(`UPDATE office_campaigns SET opportunity_id = ? WHERE id = ?`, opportunityId, id);
  } catch {
    /* optional */
  }
  return { campaignId: id, created: true };
}

export async function advanceWonOpportunity(store, {
  userId,
  workerId,
  opportunity,
  createTask = createWorkerTask,
  createOutput = createWorkerOutput,
  logActivity = createWorkerActivityLog
}) {
  const brandName = opportunity.brandName || "Brand";
  const opportunityId = opportunity.id;
  const value = Number(opportunity.estimatedDealValue || opportunity.confirmedDealValue || 0);
  const stage = String(opportunity.lifecycleStage || opportunity.status || "won");

  const notes = [];
  const { campaignId, created } = await ensureCampaignForWonOpportunity(store, {
    userId,
    workerId,
    opportunityId,
    brandName,
    estimatedValue: value
  });
  notes.push(created ? `Created campaign for ${brandName}` : `Linked campaign for ${brandName}`);

  if (["won", "brief_received"].includes(stage)) {
    const timeline = buildProductionTimeline({ brandName });
    await createOutput(store, {
      userId,
      workerId,
      outputType: "production_plan",
      title: `Production plan — ${brandName}`,
      content: [
        `Production plan for ${brandName}`,
        ...timeline.milestones.map((m) => `- ${m.label} (due ${m.dueAt.slice(0, 10)})`)
      ].join("\n"),
      structuredContent: { timeline, campaignId, opportunityId },
      source: "post_win_ops"
    });

    await createTask(store, {
      userId,
      workerId,
      title: `Structure deliverables for ${brandName}`,
      description: "Turn the brand brief into deliverables, due dates, and missing requirements.",
      taskType: "ugc_shot_list",
      priority: "high",
      status: "approved",
      source: "post_win_ops",
      requiredPermissions: []
    }).catch(() => null);

    await transitionOpportunityStage(store, {
      userId,
      workerId,
      opportunityId,
      toStage: stage === "won" ? "brief_received" : "producing",
      confidence: 75,
      evidence: [{ claim: "Post-win production plan created" }],
      source: "post_win_ops",
      reason: "Advance won deal into production",
      force: true
    }).catch(() => null);
    notes.push("Production plan + deliverable task queued");
  }

  if (["approved_by_brand", "invoice_needed"].includes(stage)) {
    await createOutput(store, {
      userId,
      workerId,
      outputType: "ops_brief",
      title: `Invoice reminder — ${brandName}`,
      content: `Brand approved work for ${brandName}. Reminder: send invoice${value ? ` for ~$${Math.round(value)}` : ""}. Mara will not mark paid until payment evidence exists.`,
      structuredContent: {
        opportunityId,
        campaignId,
        reminder: "invoice_needed",
        estimatedValue: value
      },
      source: "post_win_ops"
    });
    await transitionOpportunityStage(store, {
      userId,
      workerId,
      opportunityId,
      toStage: "invoice_needed",
      confidence: 80,
      source: "post_win_ops",
      reason: "Brand approved — invoice reminder",
      force: true
    }).catch(() => null);
    notes.push("Invoice reminder prepared");
  }

  if (["payment_due", "overdue", "invoiced"].includes(stage)) {
    await createOutput(store, {
      userId,
      workerId,
      outputType: "ops_brief",
      title: `Payment follow-up draft — ${brandName}`,
      content: `Draft for approval: polite payment follow-up for ${brandName}. Mara will not send without approval.`,
      structuredContent: {
        opportunityId,
        requiresApproval: true,
        draft: `Hi — checking on payment status for the ${brandName} deliverables. Happy to resend the invoice if helpful.`
      },
      source: "post_win_ops"
    });
    notes.push("Payment follow-up draft ready for approval");
  }

  await logActivity(store, {
    userId,
    workerId,
    eventType: "post_win_ops",
    title: `Advanced ${brandName} commercial ops`,
    description: notes.join(" · "),
    metadata: { opportunityId, campaignId, stage }
  }).catch(() => null);

  return { opportunityId, campaignId, notes };
}

export async function runPostWinOpsPass(store, userId, workerId, { limit = 5 } = {}) {
  const book = await listBookOfBusiness(store, userId, workerId, { limit: 40 });
  const targets = book.filter((item) =>
    ["won", "brief_received", "producing", "approved_by_brand", "invoice_needed", "invoiced", "payment_due", "overdue"].includes(
      item.lifecycleStage
    )
  );
  const results = [];
  for (const opportunity of targets.slice(0, limit)) {
    results.push(await advanceWonOpportunity(store, { userId, workerId, opportunity }));
  }
  return { processed: results.length, results };
}

export function extractMissingBriefRequirements(briefText = "") {
  const text = String(briefText || "");
  const missing = [];
  if (!/\bdue|deadline|by\b/i.test(text)) missing.push("due_date");
  if (!/\bvideo|asset|deliverable|reel|tiktok|ugc\b/i.test(text)) missing.push("deliverable_count_or_format");
  if (!/\busage|organic|paid|whitelist|spark\b/i.test(text)) missing.push("usage_rights");
  if (!/\brate|budget|\$|payment\b/i.test(text)) missing.push("compensation");
  if (!/\bhook|talking point|script|must say|mention\b/i.test(text)) missing.push("talking_points");
  return {
    missing,
    complete: missing.length === 0,
    parsedHints: parseJson(null, {})
  };
}
