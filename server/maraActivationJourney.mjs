/**
 * Evidence-backed activation journey for Mara. A milestone is complete only
 * when its canonical record exists; UI activity or generated copy is not proof.
 */

const MILESTONE_DEFINITIONS = [
  ["ready", "Ready to work", "Finish onboarding and connect Gmail"],
  ["opportunity", "Qualified opportunity", "Find an evidence-qualified brand opportunity"],
  ["contact", "Verified contact", "Find or confirm a sendable brand contact"],
  ["pitch", "Pitch prepared", "Prepare a personalized pitch"],
  ["sent", "Outreach sent", "Approve and send the first tracked outreach"],
  ["reply", "Brand replied", "Receive and classify a brand response"],
  ["won", "Deal won", "Confirm a paid collaboration"],
  ["paid", "Revenue recorded", "Record payment from a tracked opportunity"]
];

export function deriveMaraActivationJourney(evidence = {}) {
  const complete = {
    ready: Boolean(evidence.onboardingComplete && evidence.gmailConnected),
    opportunity: Number(evidence.opportunityCount || 0) > 0,
    contact: Number(evidence.verifiedContactCount || 0) > 0,
    pitch: Number(evidence.pitchCount || 0) > 0,
    sent: Number(evidence.sentCount || 0) > 0,
    reply: Number(evidence.replyCount || 0) > 0,
    won: Number(evidence.wonCount || 0) > 0,
    paid: Number(evidence.revenueRecorded || 0) > 0
  };
  const milestones = MILESTONE_DEFINITIONS.map(([id, label, nextAction]) => ({ id, label, nextAction, complete: complete[id] }));
  const completedCount = milestones.filter((milestone) => milestone.complete).length;
  const next = milestones.find((milestone) => !milestone.complete) || null;
  return {
    completedCount,
    totalCount: milestones.length,
    progress: completedCount / milestones.length,
    stage: next?.id || "retained_value",
    nextMilestone: next,
    milestones,
    evidence: {
      opportunityCount: Number(evidence.opportunityCount || 0),
      verifiedContactCount: Number(evidence.verifiedContactCount || 0),
      pitchCount: Number(evidence.pitchCount || 0),
      sentCount: Number(evidence.sentCount || 0),
      replyCount: Number(evidence.replyCount || 0),
      wonCount: Number(evidence.wonCount || 0),
      revenueRecorded: Number(evidence.revenueRecorded || 0)
    }
  };
}

async function one(store, sql, ...params) {
  try { return await store.queryOne(sql, ...params); } catch { return {}; }
}

export async function getMaraActivationJourney(store, userId, workerId) {
  const [onboarding, gmail, opportunities, contacts, pitches, sends, outcomes] = await Promise.all([
    one(store, `SELECT status FROM office_onboarding_sessions WHERE user_id = ? AND worker_slug = ?`, userId, workerId),
    one(store, `SELECT status FROM office_worker_integrations WHERE user_id = ? AND worker_slug = ? AND provider = 'gmail'`, userId, workerId),
    one(store, `SELECT COUNT(*) AS count FROM mara_creator_brand_opportunities WHERE user_id = ? AND worker_id = ? AND (decision = 'pursue' OR lifecycle_stage NOT IN ('discovered','researching','disqualified','lost'))`, userId, workerId),
    one(store, `SELECT COUNT(*) AS count FROM mara_brand_contacts WHERE user_id = ? AND worker_id = ? AND may_use_for_outreach = 1`, userId, workerId),
    one(store, `SELECT COUNT(*) AS count FROM worker_outputs WHERE user_id = ? AND worker_id = ? AND output_type IN ('pitch_draft','personalized_pitch')`, userId, workerId),
    one(store, `SELECT COUNT(*) AS count FROM external_action_executions WHERE user_id = ? AND worker_id = ? AND action_type = 'send_email' AND status = 'completed'`, userId, workerId),
    one(store, `SELECT SUM(CASE WHEN responded = 1 THEN 1 ELSE 0 END) AS replies, SUM(CASE WHEN hired = 1 THEN 1 ELSE 0 END) AS wins, SUM(CASE WHEN revenue_amount > 0 THEN revenue_amount ELSE 0 END) AS revenue FROM mara_commercial_outcomes WHERE user_id = ? AND worker_id = ?`, userId, workerId)
  ]);
  return deriveMaraActivationJourney({
    onboardingComplete: onboarding?.status === "completed",
    gmailConnected: gmail?.status === "connected",
    opportunityCount: opportunities?.count,
    verifiedContactCount: contacts?.count,
    pitchCount: pitches?.count,
    sentCount: sends?.count,
    replyCount: outcomes?.replies,
    wonCount: outcomes?.wins,
    revenueRecorded: outcomes?.revenue
  });
}
