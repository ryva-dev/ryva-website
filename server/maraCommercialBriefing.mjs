/**
 * "While you were away" commercial briefing — money moves first, not activity dumps.
 */
import { listBookOfBusiness, listStalledOpportunities } from "./maraOpportunityStateEngine.mjs";
import { getCommercialFunnelMetrics } from "./maraRevenueAttribution.mjs";
import { getRevenueInfluenceMetrics } from "./maraIntelligence.mjs";

function parseJson(value, fallback) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function item({
  kind,
  title,
  whatHappened,
  whyItMatters,
  commercialImpact = null,
  recommendedAction,
  onApprove = null,
  deadline = null,
  urgency = "normal",
  confidence = 70,
  opportunityId = null,
  approvalId = null
}) {
  return {
    kind,
    title,
    whatHappened,
    whyItMatters,
    commercialImpact,
    recommendedAction,
    onApprove,
    deadline,
    urgency,
    confidence,
    opportunityId,
    approvalId
  };
}

export async function buildCommercialReturnBriefing(store, userId, workerId, { sinceHours = 72 } = {}) {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  const book = await listBookOfBusiness(store, userId, workerId, { limit: 50 });
  const stalled = await listStalledOpportunities(store, userId, workerId);
  const funnel = await getCommercialFunnelMetrics(store, userId, workerId);
  const northStar = await getRevenueInfluenceMetrics(store, userId, workerId);

  const pendingApprovals = await store.query(
    `SELECT id, title, description, action_type AS "actionType", payload_json AS "payloadJson", created_at AS "createdAt"
     FROM worker_approval_requests
     WHERE user_id = ? AND worker_id = ? AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 20`,
    userId,
    workerId
  ).catch(() => []);

  const recentThreads = await store.query(
    `SELECT id, brand_name AS "brandName", subject, snippet, thread_status AS "threadStatus",
            received_at AS "receivedAt", category
     FROM office_email_threads
     WHERE user_id = ? AND worker_slug = ? AND brand_related = 1 AND received_at >= ?
     ORDER BY received_at DESC
     LIMIT 15`,
    userId,
    workerId,
    since
  ).catch(() => []);

  const recentActivity = await store.query(
    `SELECT title, description, event_type AS "eventType", created_at AS "createdAt"
     FROM worker_activity_log
     WHERE user_id = ? AND worker_id = ? AND created_at >= ?
     ORDER BY created_at DESC
     LIMIT 20`,
    userId,
    workerId,
    since
  ).catch(() => []);

  const sections = {
    urgentDecisions: [],
    brandReplies: [],
    draftsReady: [],
    negotiationsOrDeadlines: [],
    wonAndValue: [],
    deliverablesAtRisk: [],
    invoicesOrOverdue: [],
    highestValueNew: [],
    autonomousWork: [],
    background: []
  };

  for (const approval of pendingApprovals || []) {
    const payload = parseJson(approval.payloadJson, {});
    const isSend = /send/i.test(approval.actionType || "") || /send|gmail/i.test(`${approval.title} ${approval.description}`);
    // Mara never sends external communication. Historical send approvals must
    // not resurface as actions in the customer briefing.
    if (isSend) continue;
    const entry = item({
      kind: "decision",
      title: approval.title,
      whatHappened: approval.description || "Awaiting your decision.",
      whyItMatters: "Mara is blocked on a decision only you can make.",
      commercialImpact: payload.estimatedValue || null,
      recommendedAction: "Review and decide",
      onApprove: null,
      urgency: "normal",
      confidence: 95,
      approvalId: approval.id,
      opportunityId: payload.opportunityId || null
    });
    sections.urgentDecisions.push(entry);
  }

  for (const thread of recentThreads || []) {
    const needsAttention = /needs_reply|inbound|replied|brief_received/i.test(thread.threadStatus || "") ||
      /revision|brief|payment/i.test(thread.category || "");
    if (!needsAttention) continue;
    sections.brandReplies.push(
      item({
        kind: "brand_reply",
        title: `${thread.brandName || "Brand"}: ${thread.subject || "Reply"}`,
        whatHappened: thread.snippet || "Brand thread updated.",
        whyItMatters: "Brand replies are the shortest path to deals.",
        recommendedAction: "Open the thread — Mara can prepare reply copy inside Ryva",
        urgency: /payment|revision/i.test(`${thread.category} ${thread.subject}`) ? "high" : "normal",
        confidence: 70,
        deadline: thread.receivedAt
      })
    );
  }

  for (const opp of book) {
    const stage = opp.lifecycleStage;
    const value = Number(opp.estimatedDealValue || opp.confirmedDealValue || 0);
    if (["negotiating", "interested"].includes(stage)) {
      sections.negotiationsOrDeadlines.push(
        item({
          kind: "negotiation",
          title: `${opp.brandName} — ${stage.replace(/_/g, " ")}`,
          whatHappened: opp.nextAction?.label || "Deal terms in motion",
          whyItMatters: "Negotiation quality protects rate and rights.",
          commercialImpact: value || null,
          recommendedAction: opp.nextAction?.label || "Review terms",
          urgency: "high",
          confidence: Number(opp.confidence || 60),
          opportunityId: opp.id
        })
      );
    }
    if (["won", "brief_received", "producing"].includes(stage)) {
      sections.wonAndValue.push(
        item({
          kind: "won",
          title: `${opp.brandName} — won`,
          whatHappened: `Opportunity is in ${stage.replace(/_/g, " ")}.`,
          whyItMatters: "Won deals need production follow-through to get paid.",
          commercialImpact: value || Number(opp.confirmedDealValue || 0) || null,
          recommendedAction: opp.nextAction?.label || "Advance production",
          urgency: "normal",
          confidence: 80,
          opportunityId: opp.id
        })
      );
    }
    if (["producing", "submitted", "revision_requested"].includes(stage) && opp.stall) {
      sections.deliverablesAtRisk.push(
        item({
          kind: "deliverable_risk",
          title: `${opp.brandName} deliverable at risk`,
          whatHappened: opp.stall.likelyReason,
          whyItMatters: "Late or stalled production jeopardizes payment and reputation.",
          commercialImpact: opp.stall.valueAtRisk || value || null,
          recommendedAction: opp.stall.nextAction?.label || "Unstick production",
          urgency: "high",
          confidence: 75,
          opportunityId: opp.id
        })
      );
    }
    if (["invoice_needed", "invoiced", "payment_due", "overdue"].includes(stage)) {
      sections.invoicesOrOverdue.push(
        item({
          kind: "payment",
          title: `${opp.brandName} — ${stage.replace(/_/g, " ")}`,
          whatHappened: opp.blockingReason || opp.nextAction?.label || "Payment workflow",
          whyItMatters: "Cash collection is the North Star.",
          commercialImpact: Number(opp.actualRevenue || opp.confirmedDealValue || value || 0) || null,
          recommendedAction: opp.nextAction?.label || "Follow up on payment",
          urgency: stage === "overdue" ? "critical" : "high",
          confidence: 80,
          opportunityId: opp.id
        })
      );
    }
    if (["discovered", "researching", "qualified", "contact_needed", "contact_found"].includes(stage) && value > 0) {
      sections.highestValueNew.push(
        item({
          kind: "new_opportunity",
          title: `${opp.brandName} · score ${opp.scoreTotal || 0}`,
          whatHappened: `Stage: ${stage.replace(/_/g, " ")}`,
          whyItMatters: "Highest-value early pipeline.",
          commercialImpact: value,
          recommendedAction: opp.nextAction?.label || "Advance opportunity",
          urgency: "normal",
          confidence: Number(opp.confidence || 55),
          opportunityId: opp.id
        })
      );
    }
  }

  for (const stall of stalled.slice(0, 8)) {
    if (sections.urgentDecisions.length >= 8) break;
    if (!stall.stall?.requiresUserInput) continue;
    sections.urgentDecisions.push(
      item({
        kind: "stalled",
        title: `${stall.brandName} stalled in ${stall.lifecycleStage.replace(/_/g, " ")}`,
        whatHappened: stall.stall.likelyReason,
        whyItMatters: "Stuck deals decay.",
        commercialImpact: stall.stall.valueAtRisk || null,
        recommendedAction: stall.stall.nextAction?.label || "Unblock",
        urgency: "high",
        confidence: 70,
        opportunityId: stall.id
      })
    );
  }

  for (const activity of (recentActivity || []).slice(0, 8)) {
    if (/approval|send|autonomy_cycle/i.test(`${activity.eventType} ${activity.title}`)) continue;
    sections.autonomousWork.push(
      item({
        kind: "autonomous",
        title: activity.title || "Mara work",
        whatHappened: activity.description || activity.eventType,
        whyItMatters: "Completed without interrupting you.",
        recommendedAction: "No action unless you want to correct it",
        urgency: "low",
        confidence: 60
      })
    );
  }

  // Cap background to avoid activity dumps.
  sections.background = sections.autonomousWork.splice(5).slice(0, 5);

  const ordered = [
    ...sections.urgentDecisions,
    ...sections.brandReplies,
    ...sections.draftsReady,
    ...sections.negotiationsOrDeadlines,
    ...sections.wonAndValue,
    ...sections.deliverablesAtRisk,
    ...sections.invoicesOrOverdue,
    ...sections.highestValueNew.slice(0, 5),
    ...sections.autonomousWork.slice(0, 5),
    ...sections.background
  ];

  return {
    generatedAt: new Date().toISOString(),
    sinceHours,
    headline:
      sections.draftsReady.length || sections.brandReplies.length || sections.urgentDecisions.length
        ? "Money moves need you"
        : sections.wonAndValue.length
          ? "Deals progressing"
          : "Quiet stretch — Mara kept the pipeline warm",
    northStar,
    funnel,
    sections,
    prioritized: ordered.slice(0, 24),
    counts: {
      urgent: sections.urgentDecisions.length + sections.draftsReady.length,
      replies: sections.brandReplies.length,
      pipelineValue: funnel.estimatedPipelineValue,
      stalled: stalled.length
    }
  };
}
