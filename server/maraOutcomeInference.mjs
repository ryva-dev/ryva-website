/**
 * Infer commercial outcomes from inbox/campaign evidence Mara already has.
 * This is safe internal work — no external side effects, no manager babysitting.
 */
import { listTopPitchTargets, recordCommercialOutcome } from "./maraIntelligence.mjs";

const HIRED_RE = /\b(you're hired|you are hired|we'd like to hire|we would like to hire|moving forward with you|selected you|confirmed for (the )?campaign|contract (is )?attached|please sign|onboarding you|welcome to the (roster|team))\b/i;
const RESPONDED_RE = /\b(thanks for reaching out|thank you for (your )?pitch|interested in learning more|can you send (rates|your rate|a rate)|what's your rate|what is your rate|share your portfolio|send over (a )?concept|we'd love to chat|let'?s hop on a call)\b/i;
const CONCEPT_RE = /\b(love (this|the) concept|concept (looks|sounds) great|approved (the )?concept|go ahead with (this|that) angle|green[- ]?lit|let'?s proceed with)\b/i;
const PAYMENT_RE = /\b(payment (sent|processed|on the way)|paid via|invoice (paid|received)|wired \$|venmo|paypal|\$\s?\d[\d,]*(?:\.\d{2})?)\b/i;
const DECLINE_RE = /\b(not a fit|passing (for now|this time)|we'?ll pass|not moving forward|decided to go (with|another)|unfortunately we (can'?t|cannot))\b/i;

function parseMoney(text) {
  const match = String(text ?? "").match(/\$\s?([\d,]+(?:\.\d{2})?)/);
  if (!match) return 0;
  const amount = Number(String(match[1]).replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

export function inferOutcomeFromText({ subject = "", body = "", snippet = "", paymentAmount = "" } = {}) {
  const text = [subject, snippet, body, paymentAmount].filter(Boolean).join("\n");
  if (!String(text).trim()) return null;

  const hiredLanguage = HIRED_RE.test(text);
  const conceptAccepted = CONCEPT_RE.test(text);
  const respondedInterest = RESPONDED_RE.test(text);
  // Bare venmo/paypal/$ alone is too weak — require hire language or explicit payment-sent phrasing.
  const paymentSent = /\b(payment (sent|processed|on the way)|paid via|invoice (paid|received)|wired \$)\b/i.test(text)
    || (PAYMENT_RE.test(text) && hiredLanguage);
  const declined = DECLINE_RE.test(text);
  const revenueAmount = Math.max(parseMoney(text), parseMoney(paymentAmount));
  const hired = hiredLanguage || (paymentSent && (hiredLanguage || conceptAccepted || Number(paymentAmount) > 0));

  if (!hired && !conceptAccepted && !respondedInterest && !paymentSent && !declined) {
    return null;
  }

  return {
    contacted: true,
    responded: respondedInterest || hired || conceptAccepted || paymentSent,
    conceptAccepted: conceptAccepted || hired,
    hired,
    rehired: false,
    revenueAmount: hired || paymentSent ? revenueAmount : 0,
    declined,
    basis: "observed",
    claim: hiredLanguage
      ? "Inbox language indicates the creator was hired or contracted."
      : paymentSent
        ? "Explicit payment-sent language indicates money moved."
        : conceptAccepted
          ? "Brand accepted or green-lit a concept."
          : declined
            ? "Brand declined or passed on the opportunity."
            : "Brand replied with interest signals."
  };
}

function normalizeBrand(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function findOpportunityForBrand(store, userId, workerId, brandName) {
  const needle = normalizeBrand(brandName);
  if (!needle) return null;
  const rows = await store.query(
    `SELECT o.id, o.status, o.score_total AS "scoreTotal",
            COALESCE(pb.brand_name, b.brand_name) AS "brandName"
     FROM mara_creator_brand_opportunities o
     LEFT JOIN mara_public_brands pb ON pb.id = COALESCE(o.public_brand_id, o.brand_profile_id)
     LEFT JOIN mara_brand_profiles b ON b.id = o.brand_profile_id
     WHERE o.user_id = ? AND o.worker_id = ?
     ORDER BY o.score_total DESC, o.updated_at DESC
     LIMIT 50`,
    userId,
    workerId
  );
  // Exact normalized match only — fuzzy includes() caused wrong-opportunity attribution.
  return rows.find((row) => normalizeBrand(row.brandName) === needle) || null;
}

async function alreadyRecordedSimilar(store, userId, workerId, opportunityId, inference) {
  if (!opportunityId) return false;
  const row = await store.queryOne(
    `SELECT id FROM mara_commercial_outcomes
     WHERE user_id = ? AND worker_id = ? AND opportunity_id = ?
       AND contacted = ? AND responded = ? AND concept_accepted = ? AND hired = ?
       AND ABS(revenue_amount - ?) < 0.01
       AND created_at >= ?
     LIMIT 1`,
    userId,
    workerId,
    opportunityId,
    inference.contacted ? 1 : 0,
    inference.responded ? 1 : 0,
    inference.conceptAccepted ? 1 : 0,
    inference.hired ? 1 : 0,
    Number(inference.revenueAmount || 0),
    new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  );
  return Boolean(row);
}

/**
 * Scan recent brand threads + campaigns and persist inferred outcomes.
 * Returns a summary Mara can log in activity without asking the manager.
 */
export async function inferAndRecordCommercialOutcomes(store, userId, workerId, { limit = 25 } = {}) {
  const threads = await store.query(
    `SELECT id, brand_name AS "brandName", subject, snippet, body_text AS "bodyText",
            received_at AS "receivedAt", category, thread_status AS "threadStatus"
     FROM office_email_threads
     WHERE user_id = ? AND worker_slug = ? AND brand_related = 1
     ORDER BY received_at DESC
     LIMIT ?`,
    userId,
    workerId,
    Math.max(1, Math.min(100, Number(limit) || 25))
  );
  const campaigns = await store.query(
    `SELECT id, brand_name AS "brandName", campaign_status AS "campaignStatus",
            payment_amount AS "paymentAmount", payment_status AS "paymentStatus",
            brief_text AS "briefText", updated_at AS "updatedAt"
     FROM office_campaigns
     WHERE user_id = ? AND worker_slug = ?
     ORDER BY updated_at DESC
     LIMIT ?`,
    userId,
    workerId,
    Math.max(1, Math.min(50, Number(limit) || 25))
  );

  const recorded = [];
  const skipped = [];

  for (const thread of threads) {
    const inference = inferOutcomeFromText({
      subject: thread.subject,
      snippet: thread.snippet,
      body: thread.bodyText
    });
    if (!inference) continue;
    if (inference.declined && !inference.hired) {
      // Declines still count as contacted+responded with no hire; outreach score softens via flywheel.
      inference.hired = false;
      inference.conceptAccepted = false;
    }
    const opportunity = await findOpportunityForBrand(store, userId, workerId, thread.brandName);
    if (!opportunity) {
      skipped.push({ brandName: thread.brandName, reason: "no_matching_opportunity", source: "thread", sourceId: thread.id });
      continue;
    }
    if (await alreadyRecordedSimilar(store, userId, workerId, opportunity.id, inference)) {
      skipped.push({ brandName: thread.brandName, reason: "duplicate", source: "thread", sourceId: thread.id });
      continue;
    }
    const result = await recordCommercialOutcome(store, {
      userId,
      workerId,
      opportunityId: opportunity.id,
      contacted: inference.contacted,
      responded: inference.responded,
      conceptAccepted: inference.conceptAccepted,
      hired: inference.hired,
      rehired: false,
      revenueAmount: inference.revenueAmount,
      details: {
        inferredBy: "mara_inbox_autonomy",
        basis: inference.basis,
        claim: inference.claim,
        sourceType: "office_email_thread",
        sourceId: thread.id,
        declined: Boolean(inference.declined)
      }
    });
    recorded.push({
      brandName: thread.brandName,
      opportunityId: opportunity.id,
      outcomeId: result.id,
      ranking: result.ranking,
      claim: inference.claim
    });
    if (inference.responded || inference.hired || inference.declined) {
      try {
        const { stopOutreachSequence, SEQUENCE_STOP_REASONS } = await import("./maraOutreachSequences.mjs");
        await stopOutreachSequence(store, {
          userId,
          workerId,
          opportunityId: opportunity.id,
          reason: SEQUENCE_STOP_REASONS.REPLY_RECEIVED
        });
      } catch {
        /* best-effort */
      }
    }
  }

  for (const campaign of campaigns) {
    const paid =
      String(campaign.paymentStatus || "").toLowerCase().includes("paid") ||
      String(campaign.campaignStatus || "").toLowerCase().includes("paid");
    const inference = inferOutcomeFromText({
      subject: campaign.campaignStatus,
      body: campaign.briefText,
      paymentAmount: campaign.paymentAmount
    }) || (paid
      ? {
          contacted: true,
          responded: true,
          conceptAccepted: true,
          hired: true,
          revenueAmount: parseMoney(campaign.paymentAmount),
          basis: "observed",
          claim: "Campaign payment status indicates a completed paid engagement."
        }
      : null);
    if (!inference) continue;
    const opportunity = await findOpportunityForBrand(store, userId, workerId, campaign.brandName);
    if (!opportunity) {
      skipped.push({ brandName: campaign.brandName, reason: "no_matching_opportunity", source: "campaign", sourceId: campaign.id });
      continue;
    }
    if (await alreadyRecordedSimilar(store, userId, workerId, opportunity.id, inference)) {
      skipped.push({ brandName: campaign.brandName, reason: "duplicate", source: "campaign", sourceId: campaign.id });
      continue;
    }
    const result = await recordCommercialOutcome(store, {
      userId,
      workerId,
      opportunityId: opportunity.id,
      contacted: true,
      responded: true,
      conceptAccepted: Boolean(inference.conceptAccepted || inference.hired),
      hired: Boolean(inference.hired || paid),
      rehired: false,
      revenueAmount: Number(inference.revenueAmount || 0),
      details: {
        inferredBy: "mara_campaign_autonomy",
        basis: "observed",
        claim: inference.claim,
        sourceType: "office_campaign",
        sourceId: campaign.id
      }
    });
    recorded.push({
      brandName: campaign.brandName,
      opportunityId: opportunity.id,
      outcomeId: result.id,
      ranking: result.ranking,
      claim: inference.claim
    });
  }

  const pitchTargets = await listTopPitchTargets(store, userId, workerId, 5);
  return { recorded, skipped, pitchTargets };
}
