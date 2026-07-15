import { createHash, randomUUID } from "node:crypto";
import { ensureMaraRuntimeTables } from "./maraRuntimeStorage.mjs";

const candidate = (type, objective, options = {}) => ({
  id: randomUUID(), candidateType: type, possibleCommercialObjective: objective,
  urgency: options.urgency || "normal", dependencies: options.dependencies || [], suggestedOwner: options.owner || "mara",
  requiredCapabilities: options.capabilities || [], userActionMayBeRequired: Boolean(options.userAction),
  riskClass: options.riskClass || "normal", evidence: options.evidence || [], triggerEventIds: options.triggerEventIds || [],
  expiresAt: options.expiresAt || null
});

/** Observable possibilities only. Selection, ordering, and strategy are deliberately absent. */
export function generateCandidateWork(state, events = []) {
  const out = [];
  const eventIds = (type) => events.filter((e) => e.eventType === type).map((e) => e.id);
  const evidence = (path, value) => [{ path, value }];
  if (!state.niche || state.readiness?.blockers?.includes("no_niche")) out.push(candidate("clarify_positioning", "Become commercially legible to suitable buyers", { urgency: "high", capabilities: ["research", "strategic_judgment"], userAction: true, evidence: evidence("niche", state.niche || null) }));
  if (["missing", "broken", "weak"].includes(state.portfolio?.condition)) out.push(candidate("address_portfolio_gap", "Provide credible proof for qualified opportunities", { capabilities: ["creative_strategy"], userAction: true, evidence: evidence("portfolio.condition", state.portfolio.condition) }));
  if ((state.unsentOutreachBacklog || []).length >= 15) out.push(candidate("reduce_unsent_backlog", "Convert prepared opportunities into creator decisions and sends", { urgency: "high", owner: "shared", userAction: true, evidence: evidence("unsentOutreachBacklog.length", state.unsentOutreachBacklog.length) }));
  if ((state.unsentOutreachBacklog || []).length < 5 && !(state.activeOpportunities || []).length) out.push(candidate("strengthen_pipeline", "Create qualified routes to future paid work", { capabilities: ["research"], evidence: evidence("pipelineDepth", (state.unsentOutreachBacklog || []).length) }));
  if ((state.repliesAndFollowUps || []).some((x) => x.due)) out.push(candidate("prepare_due_follow_up", "Advance an existing commercial conversation", { urgency: "high", userAction: true, triggerEventIds: eventIds("follow_up_due") }));
  if ((state.upcomingDeadlines || []).length) out.push(candidate("protect_active_deadline", "Deliver committed work on time and protect current revenue", { urgency: "critical", owner: "shared", userAction: true, triggerEventIds: eventIds("opportunity_deadline_approaching"), evidence: state.upcomingDeadlines }));
  if ((state.revenue?.invoicesOverdue || []).length) out.push(candidate("resolve_overdue_payment", "Collect earned creator revenue", { urgency: "critical", owner: "shared", userAction: true, triggerEventIds: eventIds("invoice_overdue"), evidence: state.revenue.invoicesOverdue }));
  if ((state.risks || []).some((r) => ["suspicious_outreach", "fraud", "domain_mismatch"].includes(r.type))) out.push(candidate("investigate_suspicious_outreach", "Protect the creator from financial and reputation harm", { urgency: "critical", riskClass: "safety", capabilities: ["risk_investigation"], userAction: true, triggerEventIds: eventIds("business_message_received"), evidence: state.risks }));
  if ((state.risks || []).some((r) => r.type === "contact_quality") || Number(state.performance?.bounceRate || 0) > .08) out.push(candidate("improve_contact_quality", "Stop wasting creator effort on unreachable contacts", { urgency: "high", capabilities: ["contact_validation"], evidence: state.risks }));
  if (Number(state.performance?.pitchesSent || 0) >= 15 && Number(state.performance?.responseRate || 0) < .05) out.push(candidate("diagnose_low_response", "Improve qualified reply rate before scaling outreach", { urgency: "high", capabilities: ["commercial_diagnosis"], evidence: [state.performance] }));
  if ((state.performance?.contentSignals || []).length) out.push(candidate("interpret_content_performance", "Apply credible content evidence to future paid work", { capabilities: ["analytics"], triggerEventIds: eventIds("content_analytics_ready") }));
  if (state.historicalOutreach) out.push(candidate("learn_from_historical_outreach", "Avoid duplicates and improve targeting from real outcomes", { capabilities: ["data_synthesis"], triggerEventIds: eventIds("historical_outreach_imported") }));
  if (state.preferenceConflict) out.push(candidate("resolve_preference_conflict", "Pursue eligible work without violating creator boundaries", { owner: "shared", userAction: true, riskClass: "boundary", evidence: [state.preferenceConflict] }));
  if (state.inactive || Number(state.workload?.ignoredCount || 0) >= 5) out.push(candidate("throttle_and_reenter", "Preserve urgent obligations while making re-entry achievable", { urgency: "high", owner: "shared", userAction: true, evidence: [state.inactivity || state.workload] }));
  if (state.giftedOpportunity) out.push(candidate("assess_gifted_opportunity", "Choose non-cash work only when its strategic value exceeds its cost", { owner: "shared", userAction: true, evidence: [state.giftedOpportunity] }));
  if (state.internationalOpportunity) out.push(candidate("assess_international_fit", "Pursue commercially and logistically eligible work", { capabilities: ["international_fit", "multilingual"], userAction: true, evidence: [state.internationalOpportunity] }));
  return out.map((item) => ({ ...item, dedupeKey: createHash("sha256").update(JSON.stringify([item.candidateType, item.evidence])).digest("hex") }));
}

export async function persistCandidateWork(store, { userId, workerId, candidates }) {
  await ensureMaraRuntimeTables(store);
  for (const c of candidates || []) await store.execute(
    `INSERT INTO agent_work_candidates (id,user_id,worker_id,candidate_type,trigger_event_ids_json,possible_commercial_objective,urgency,dependencies_json,suggested_owner,required_capabilities_json,user_action_may_be_required,risk_class,evidence_json,dedupe_key,expires_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,worker_id,dedupe_key) DO NOTHING`,
    c.id, userId, workerId, c.candidateType, JSON.stringify(c.triggerEventIds), c.possibleCommercialObjective,
    c.urgency, JSON.stringify(c.dependencies), c.suggestedOwner, JSON.stringify(c.requiredCapabilities),
    c.userActionMayBeRequired ? 1 : 0, c.riskClass, JSON.stringify(c.evidence), c.dedupeKey, c.expiresAt, "open", new Date().toISOString()
  );
  return candidates;
}
