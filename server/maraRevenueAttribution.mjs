/**
 * Revenue attribution rules — never claim Mara caused revenue merely by touching an opportunity.
 */

export const ATTRIBUTION_TYPES = Object.freeze({
  SOURCED_BY_MARA: "sourced_by_mara",
  ASSISTED_BY_MARA: "assisted_by_mara",
  MANAGED_BY_MARA: "managed_by_mara",
  USER_SOURCED: "independently_sourced_by_user",
  UNCERTAIN: "uncertain"
});

export function resolveAttribution({
  existing = null,
  discoveredByMara = false,
  maraDraftedPitch = false,
  maraManagedThread = false,
  userProvidedLead = false
} = {}) {
  if (existing && existing !== ATTRIBUTION_TYPES.UNCERTAIN) return existing;
  if (userProvidedLead && !discoveredByMara) return ATTRIBUTION_TYPES.USER_SOURCED;
  if (discoveredByMara && maraDraftedPitch) return ATTRIBUTION_TYPES.SOURCED_BY_MARA;
  if (maraManagedThread || maraDraftedPitch) return ATTRIBUTION_TYPES.ASSISTED_BY_MARA;
  if (discoveredByMara) return ATTRIBUTION_TYPES.SOURCED_BY_MARA;
  return ATTRIBUTION_TYPES.UNCERTAIN;
}

export function shouldCountAsRevenueInfluenced({
  hired = false,
  paid = false,
  revenueAmount = 0,
  giftedOnly = false,
  attribution = ATTRIBUTION_TYPES.UNCERTAIN
} = {}) {
  if (giftedOnly) return false;
  if (!(hired || paid)) return false;
  if (!(Number(revenueAmount) > 0)) return false;
  // Unanswered pitches never count. Uncertain attribution can count as influenced
  // only when hire/paid evidence exists — still labeled uncertain in analytics.
  return [
    ATTRIBUTION_TYPES.SOURCED_BY_MARA,
    ATTRIBUTION_TYPES.ASSISTED_BY_MARA,
    ATTRIBUTION_TYPES.MANAGED_BY_MARA,
    ATTRIBUTION_TYPES.UNCERTAIN
  ].includes(attribution);
}

export async function getCommercialFunnelMetrics(store, userId, workerId) {
  const opps = await store.query(
    `SELECT lifecycle_stage AS stage, status, attribution,
            estimated_deal_value AS "estimatedDealValue",
            confirmed_deal_value AS "confirmedDealValue",
            actual_revenue AS "actualRevenue"
     FROM mara_creator_brand_opportunities
     WHERE user_id = ? AND worker_id = ?`,
    userId,
    workerId
  );
  const outcomes = await store.query(
    `SELECT contacted, responded, concept_accepted AS "conceptAccepted", hired, revenue_amount AS "revenueAmount"
     FROM mara_commercial_outcomes WHERE user_id = ? AND worker_id = ?`,
    userId,
    workerId
  );
  let contacts = [];
  try {
    contacts = await store.query(
      `SELECT may_use_for_outreach AS "mayUse", verification_state AS "verificationState"
       FROM mara_brand_contacts WHERE user_id = ? AND worker_id = ?`,
      userId,
      workerId
    );
  } catch {
    contacts = [];
  }

  const byStage = {};
  let pipelineValue = 0;
  let confirmedValue = 0;
  let paidRevenue = 0;
  let sourced = 0;
  let assisted = 0;
  for (const row of opps) {
    const stage = row.stage || row.status || "unknown";
    byStage[stage] = (byStage[stage] || 0) + 1;
    pipelineValue += Number(row.estimatedDealValue || 0);
    confirmedValue += Number(row.confirmedDealValue || 0);
    paidRevenue += Number(row.actualRevenue || 0);
    if (row.attribution === ATTRIBUTION_TYPES.SOURCED_BY_MARA) sourced += 1;
    if (row.attribution === ATTRIBUTION_TYPES.ASSISTED_BY_MARA) assisted += 1;
  }

  const contacted = outcomes.filter((row) => Number(row.contacted) === 1).length;
  const responded = outcomes.filter((row) => Number(row.responded) === 1).length;
  const hired = outcomes.filter((row) => Number(row.hired) === 1).length;
  const outreachReady = (contacts || []).filter((row) => Number(row.mayUse) === 1).length;

  return {
    opportunitiesDiscovered: opps.length,
    byStage,
    validContactsFound: outreachReady,
    contactHitRate: opps.length ? outreachReady / opps.length : 0,
    messagesContacted: contacted,
    replyRate: contacted ? responded / contacted : 0,
    winRate: contacted ? hired / contacted : 0,
    estimatedPipelineValue: pipelineValue,
    confirmedDealValue: confirmedValue,
    revenuePaid: paidRevenue,
    sourcedByMara: sourced,
    assistedByMara: assisted,
    revenueInfluencedRules:
      "Counts hired/paid revenue with amount > 0, excluding gifted-only. Attribution labeled separately; unanswered pitches never count."
  };
}
