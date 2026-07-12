/**
 * Reply classification for brand inbox — structured, deterministic, evidence-backed.
 */

export const REPLY_CLASSES = Object.freeze([
  "positive_interest",
  "request_for_portfolio",
  "request_for_rates",
  "request_for_media_kit",
  "request_for_concepts",
  "request_for_availability",
  "request_for_call",
  "product_only_offer",
  "affiliate_only_offer",
  "gifted_collaboration",
  "paid_opportunity",
  "unclear_response",
  "objection",
  "not_now",
  "rejection",
  "out_of_office",
  "referral_to_another_contact",
  "suspected_scam",
  "negotiation",
  "contract_or_usage_rights",
  "deliverable_or_revision",
  "invoice_or_payment"
]);

const RULES = [
  { cls: "out_of_office", re: /\b(out of (the )?office|ooo|auto[- ]?reply|away from (my )?email)\b/i, confidence: 90 },
  { cls: "suspected_scam", re: /\b(wire transfer|gift card|crypto wallet|urgent payment to|western union|beneficiary bank)\b/i, confidence: 85 },
  { cls: "invoice_or_payment", re: /\b(invoice|payment (sent|received|due|overdue)|paid via|net\s?30|remittance)\b/i, confidence: 80 },
  { cls: "contract_or_usage_rights", re: /\b(usage rights?|whitelisting|perpetual|exclusivity|work[- ]?for[- ]?hire|contract|msa|sow)\b/i, confidence: 85 },
  { cls: "deliverable_or_revision", re: /\b(revision|revise|feedback on (the )?(draft|cut)|please change|another take|resubmit)\b/i, confidence: 80 },
  { cls: "rejection", re: /\b(not a fit|passing (for now|this time)|we'?ll pass|not moving forward|decided to go (with|another))\b/i, confidence: 88 },
  { cls: "not_now", re: /\b(not right now|maybe later|reach back|check (back )?in (q[1-4]|next (quarter|year|month)))\b/i, confidence: 75 },
  { cls: "gifted_collaboration", re: /\b(gifted|gift collaboration|free product|product only|seeded|in exchange for (a )?post)\b/i, confidence: 82 },
  { cls: "affiliate_only_offer", re: /\b(affiliate (only|program|link)|commission[- ]only|promo code only)\b/i, confidence: 80 },
  { cls: "product_only_offer", re: /\b(we can send (you )?product|product in exchange|no (cash|monetary) (budget|compensation))\b/i, confidence: 78 },
  { cls: "paid_opportunity", re: /\b(paid (collab|collaboration|campaign|partnership)|budget (is|of)|compensation of|\$\s?\d[\d,]*)\b/i, confidence: 75 },
  { cls: "request_for_rates", re: /\b(what('?s| is) your rate|send (your )?rates|rate card|pricing|how much (do you|would you) charge)\b/i, confidence: 88 },
  { cls: "request_for_portfolio", re: /\b(portfolio|examples of (your )?work|past work|media kit|deck)\b/i, confidence: 80 },
  { cls: "request_for_media_kit", re: /\b(media kit|mediakit)\b/i, confidence: 85 },
  { cls: "request_for_concepts", re: /\b(send (some )?concepts|concept options|creative directions?|angles?)\b/i, confidence: 80 },
  { cls: "request_for_availability", re: /\b(availability|when (can|could) you (film|shoot|deliver)|turnaround)\b/i, confidence: 78 },
  { cls: "request_for_call", re: /\b(hop on a call|book a (call|meeting)|calendly|zoom|let'?s chat)\b/i, confidence: 80 },
  { cls: "referral_to_another_contact", re: /\b(reach out to|cc'?(ing)?|better contact|forwarding (you )?to|email .+@)\b/i, confidence: 65 },
  { cls: "negotiation", re: /\b(can you do|counter|flexible on|budget is closer|instead of \d)\b/i, confidence: 70 },
  { cls: "objection", re: /\b(concerned about|too expensive|followers?|engagement|not sure about)\b/i, confidence: 65 },
  { cls: "positive_interest", re: /\b(interested|love this|thanks for reaching out|thank you for (your )?pitch|would love to|excited)\b/i, confidence: 72 }
];

export function classifyBrandReply({ subject = "", body = "", snippet = "" } = {}) {
  const text = [subject, snippet, body].filter(Boolean).join("\n");
  if (!String(text).trim()) {
    return {
      class: "unclear_response",
      confidence: 20,
      labels: ["unknown"],
      extracted: {},
      risks: [],
      giftedOnly: false,
      paidSignal: false
    };
  }

  const matches = [];
  for (const rule of RULES) {
    if (rule.re.test(text)) matches.push(rule);
  }
  const primary = matches.sort((a, b) => b.confidence - a.confidence)[0] || {
    cls: "unclear_response",
    confidence: 40
  };

  const rateMatch = text.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
  const deadlineMatch = text.match(/\b(by|before|due)\s+([A-Z][a-z]+ \d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  const perpetual = /\bperpetual|in perpetuity|forever usage\b/i.test(text);
  const exclusivity = /\bexclusiv(e|ity)\b/i.test(text);
  const giftedOnly =
    primary.cls === "gifted_collaboration" ||
    primary.cls === "product_only_offer" ||
    (/\bgifted\b/i.test(text) && !/\bpaid\b/i.test(text));

  const risks = [];
  if (perpetual) risks.push({ code: "perpetual_usage", label: "Perpetual usage rights requested — flag for manager, do not accept", severity: "high" });
  if (exclusivity) risks.push({ code: "exclusivity", label: "Exclusivity terms present — requires manager decision", severity: "high" });
  if (primary.cls === "suspected_scam") risks.push({ code: "scam_signal", label: "Suspected scam language", severity: "critical" });
  if (giftedOnly) risks.push({ code: "gifted_not_paid", label: "Offer appears gifted/product-only — not paid revenue", severity: "medium" });

  return {
    class: primary.cls,
    confidence: primary.confidence,
    labels: matches.map((item) => item.cls),
    extracted: {
      mentionedAmount: rateMatch ? Number(String(rateMatch[1]).replace(/,/g, "")) : null,
      deadlineHint: deadlineMatch ? deadlineMatch[0] : null,
      perpetualUsage: perpetual,
      exclusivity
    },
    risks,
    giftedOnly,
    paidSignal: primary.cls === "paid_opportunity" || Boolean(rateMatch && !giftedOnly),
    summary: `Classified as ${String(primary.cls).replace(/_/g, " ")} (${primary.confidence}% confidence).`
  };
}

export function recommendReplyNextAction(classification) {
  const cls = classification?.class || "unclear_response";
  const map = {
    request_for_rates: { action: "draft_rates_reply", autonomous: true, requiresApproval: true },
    request_for_portfolio: { action: "draft_portfolio_reply", autonomous: true, requiresApproval: true },
    request_for_concepts: { action: "draft_concepts_reply", autonomous: true, requiresApproval: true },
    request_for_call: { action: "draft_scheduling_reply", autonomous: true, requiresApproval: true },
    negotiation: { action: "draft_negotiation_guidance", autonomous: true, requiresApproval: true },
    contract_or_usage_rights: { action: "flag_usage_risks", autonomous: true, requiresApproval: true },
    rejection: { action: "close_as_lost", autonomous: false, requiresApproval: true },
    gifted_collaboration: { action: "clarify_paid_vs_gifted", autonomous: true, requiresApproval: true },
    invoice_or_payment: { action: "update_payment_stage", autonomous: true, requiresApproval: false },
    suspected_scam: { action: "block_and_alert", autonomous: false, requiresApproval: true },
    positive_interest: { action: "draft_interest_reply", autonomous: true, requiresApproval: true },
    unclear_response: { action: "ask_manager_for_read", autonomous: false, requiresApproval: true }
  };
  return map[cls] || { action: "review_reply", autonomous: false, requiresApproval: true };
}
