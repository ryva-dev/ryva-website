import { createAnthropicMessage, isMaraLlmConfigured, parseJsonFromLlmText } from "./maraLlm.mjs";

const DEFAULT_MODEL =
  process.env.ANTHROPIC_MARA_INBOX_MODEL ||
  process.env.ANTHROPIC_MARA_TASK_MODEL ||
  process.env.ANTHROPIC_OFFICE_MODEL ||
  process.env.ANTHROPIC_MODEL ||
  "claude-sonnet-4-6";

const BODY_CHAR_LIMIT = 12000;

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeBase64Url(value) {
  const normalized = String(value ?? "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

export function extractGmailBodyText(payload) {
  if (!payload) {
    return "";
  }

  function readPart(part) {
    if (!part) {
      return "";
    }

    const mimeType = String(part.mimeType || "").toLowerCase();
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (mimeType === "text/plain") {
        return decoded.trim();
      }
      if (mimeType === "text/html") {
        return stripHtml(decoded);
      }
    }

    if (Array.isArray(part.parts)) {
      const plainPart = part.parts.find((entry) => entry.mimeType === "text/plain" && entry.body?.data);
      if (plainPart) {
        return decodeBase64Url(plainPart.body.data).trim();
      }
      return part.parts.map(readPart).filter(Boolean).join("\n\n").trim();
    }

    return "";
  }

  const body = readPart(payload);
  return body.slice(0, BODY_CHAR_LIMIT);
}

function normalizeIsoDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function extractDatesFromText(text) {
  const lower = String(text ?? "").toLowerCase();
  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return normalizeIsoDate(isoMatch[1]);
  }

  const slashMatch = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
  if (slashMatch) {
    return normalizeIsoDate(slashMatch[1]);
  }

  if (/tomorrow/.test(lower)) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
  }

  if (/friday|by eod|end of day/.test(lower)) {
    return null;
  }

  return null;
}

function extractDeliverablesHeuristic(text) {
  const deliverables = [];
  const patterns = [
    /\b(\d+)\s+(?:x\s+)?tiktok(?:s)?\b/gi,
    /\b(\d+)\s+(?:x\s+)?(?:instagram\s+)?reels?\b/gi,
    /\b(\d+)\s+(?:x\s+)?(?:instagram\s+)?stories?\b/gi,
    /\b(\d+)\s+(?:x\s+)?(?:short[- ]form\s+)?videos?\b/gi,
    /\b(\d+)\s+(?:x\s+)?ugc\s+(?:assets?|videos?)\b/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      deliverables.push(match[0].trim());
    }
  }

  if (deliverables.length === 0 && /deliverable|asset|content|video|reel|story/i.test(text)) {
    deliverables.push("Deliverables mentioned but not itemized clearly.");
  }

  return [...new Set(deliverables)];
}

function extractPaymentHeuristic(text) {
  const amountMatch = text.match(/\$\s?\d[\d,]*(?:\.\d{2})?/);
  return amountMatch ? amountMatch[0].replace(/\s+/g, "") : "";
}

function inferCategoryFromText(text) {
  const lower = String(text ?? "").toLowerCase();
  if (/revision|revise|updated hook|revised cta|changes requested/.test(lower)) {
    return "revision_request";
  }
  if (/brief|deliverable|talking points|usage rights|campaign/.test(lower)) {
    return "campaign_brief";
  }
  if (/invoice|payment|paid|compensation|rate|budget/.test(lower)) {
    return "payment_admin";
  }
  if (/creator|ugc|collab|partnership|interested/.test(lower)) {
    return "outreach";
  }
  return "general";
}

function inferCampaignStatus(category, threadStatus) {
  if (category === "revision_request") {
    return "revision_requested";
  }
  if (category === "campaign_brief") {
    return "brief_received";
  }
  if (String(threadStatus || "").toLowerCase() === "awaiting_reply") {
    return "awaiting_reply";
  }
  if (String(threadStatus || "").toLowerCase() === "outbound") {
    return "pitched";
  }
  return "active_thread";
}

export function inferMissingCampaignFields(parsed) {
  const missingFields = [];
  const riskFlags = Array.isArray(parsed.riskFlags) ? [...parsed.riskFlags] : [];

  if (!Array.isArray(parsed.deliverables) || parsed.deliverables.length === 0) {
    missingFields.push("deliverables_missing");
  }
  if (!parsed.draftDueDate && !parsed.finalDueDate) {
    missingFields.push("deadline_missing");
  }
  if (!String(parsed.paymentAmount || "").trim()) {
    missingFields.push("payment_amount_missing");
  }
  if (!String(parsed.usageRights || "").trim() || parsed.usageRightsStatus === "unclear" || parsed.usageRightsStatus === "needs_review") {
    missingFields.push("usage_rights_unclear");
    if (!riskFlags.includes("usage_rights_unclear")) {
      riskFlags.push("usage_rights_unclear");
    }
  }
  if (/revision|round/i.test(`${parsed.briefSummary || ""} ${parsed.revisionLimit || ""}`) && !String(parsed.revisionLimit || "").trim()) {
    missingFields.push("revision_limit_missing");
  }
  if (parsed.rawFootageRequired && !riskFlags.includes("raw_footage_requested")) {
    riskFlags.push("raw_footage_requested");
  }
  if (parsed.urgency === "high" && !riskFlags.includes("urgent_thread")) {
    riskFlags.push("urgent_thread");
  }

  return { missingFields, riskFlags };
}

export function parseBrandEmailHeuristic(thread) {
  const sourceText = [thread.subject, thread.bodyText, thread.snippet].filter(Boolean).join("\n\n");
  const lower = sourceText.toLowerCase();
  const category = inferCategoryFromText(sourceText);
  const deliverables = extractDeliverablesHeuristic(sourceText);
  const paymentAmount = extractPaymentHeuristic(sourceText);
  const draftDueDate = /draft|first cut|initial/i.test(sourceText) ? extractDatesFromText(sourceText) : null;
  const finalDueDate = /final|delivery|due|deadline/i.test(sourceText) ? extractDatesFromText(sourceText) : extractDatesFromText(sourceText);
  const usageRights = /usage rights|paid social|whitelisting|spark ads|ad usage|organic only/i.test(sourceText)
    ? sourceText.match(/(?:usage rights|paid social|whitelisting|spark ads|ad usage|organic only)[^.!\n]{0,120}/i)?.[0]?.trim() || ""
    : "";
  const usageRightsStatus = usageRights ? "needs_review" : "unclear";
  const rawFootageRequired = /raw footage|source files|project files/i.test(lower);
  const revisionLimit = /(\d+)\s+rounds? of revisions?/i.test(sourceText)
    ? sourceText.match(/(\d+)\s+rounds? of revisions?/i)?.[0] || ""
    : "";

  const parsed = {
    brandWebsite: "",
    briefSummary: sourceText.slice(0, 500),
    campaignName: thread.subject || `${thread.brandName || "Brand"} outreach`,
    campaignStatus: inferCampaignStatus(category, thread.threadStatus),
    category,
    deliverables,
    draftDueDate,
    finalDueDate,
    generatedBy: "heuristic",
    paymentAmount,
    paymentStatus: paymentAmount ? "quoted" : "unknown",
    productName: "",
    questionsToClarify: [],
    rawFootageRequired,
    revisionLimit,
    usageRights,
    usageRightsStatus
  };

  const gaps = inferMissingCampaignFields({ ...parsed, urgency: thread.urgency });
  return {
    ...parsed,
    missingFields: gaps.missingFields,
    riskFlags: gaps.riskFlags
  };
}

function buildParseSystemPrompt() {
  return [
    "You are Mara, a UGC production coordinator parsing brand email threads into structured campaign records.",
    "Extract only what is explicitly stated or strongly implied in the email. Do not invent rates, dates, or deliverables.",
    "If a field is unknown, use empty string, null for dates, false for booleans, or empty arrays.",
    "Use campaignStatus one of: brief_received, revision_requested, awaiting_reply, pitched, active_thread.",
    "Use category one of: campaign_brief, revision_request, outreach, payment_admin, general.",
    "Use paymentStatus one of: unknown, quoted, pending_terms, approved_pending_final, paid.",
    "Use usageRightsStatus one of: confirmed, needs_review, unclear.",
    "Return only valid JSON. No markdown."
  ].join("\n");
}

function buildParseUserPrompt(thread) {
  return [
    `Brand: ${thread.brandName || "Unknown"}`,
    `Contact: ${thread.contactName || ""} <${thread.contactEmail || ""}>`,
    `Subject: ${thread.subject || ""}`,
    `Thread status: ${thread.threadStatus || ""}`,
    `Urgency: ${thread.urgency || "low"}`,
    "Email body:",
    thread.bodyText || thread.snippet || "",
    'Return JSON: {"campaignName":"","campaignStatus":"","category":"","productName":"","briefSummary":"","deliverables":[],"draftDueDate":null,"finalDueDate":null,"paymentAmount":"","paymentStatus":"","usageRights":"","usageRightsStatus":"","revisionLimit":"","rawFootageRequired":false,"riskFlags":[],"questionsToClarify":[]}'
  ].join("\n");
}

function normalizeParsedBrief(payload, thread) {
  const category = String(payload.category || inferCategoryFromText(thread.bodyText || thread.snippet || "")).trim();
  const parsed = {
    brandWebsite: String(payload.brandWebsite || "").trim(),
    briefSummary: String(payload.briefSummary || thread.snippet || "").trim().slice(0, 1200),
    campaignName: String(payload.campaignName || thread.subject || `${thread.brandName || "Brand"} outreach`).trim(),
    campaignStatus: String(payload.campaignStatus || inferCampaignStatus(category, thread.threadStatus)).trim(),
    category,
    deliverables: Array.isArray(payload.deliverables)
      ? payload.deliverables.map((item) => String(item).trim()).filter(Boolean)
      : [],
    draftDueDate: normalizeIsoDate(payload.draftDueDate),
    finalDueDate: normalizeIsoDate(payload.finalDueDate),
    generatedBy: "llm",
    paymentAmount: String(payload.paymentAmount || "").trim(),
    paymentStatus: String(payload.paymentStatus || (payload.paymentAmount ? "quoted" : "unknown")).trim(),
    productName: String(payload.productName || "").trim(),
    questionsToClarify: Array.isArray(payload.questionsToClarify)
      ? payload.questionsToClarify.map((item) => String(item).trim()).filter(Boolean)
      : [],
    rawFootageRequired: Boolean(payload.rawFootageRequired),
    revisionLimit: String(payload.revisionLimit || "").trim(),
    usageRights: String(payload.usageRights || "").trim(),
    usageRightsStatus: String(payload.usageRightsStatus || (payload.usageRights ? "needs_review" : "unclear")).trim()
  };

  const gaps = inferMissingCampaignFields({ ...parsed, riskFlags: payload.riskFlags, urgency: thread.urgency });
  return {
    ...parsed,
    missingFields: gaps.missingFields,
    riskFlags: gaps.riskFlags
  };
}

export async function parseBrandEmailBrief(thread, { fetchImpl } = {}) {
  const hasSource = Boolean(String(thread.bodyText || thread.snippet || "").trim());
  if (!hasSource) {
    return null;
  }

  if (isMaraLlmConfigured()) {
    try {
      const text = await createAnthropicMessage({
        fetchImpl,
        maxTokens: 1200,
        model: DEFAULT_MODEL,
        system: buildParseSystemPrompt(),
        messages: [{ role: "user", content: [{ type: "text", text: buildParseUserPrompt(thread) }] }]
      });
      return normalizeParsedBrief(parseJsonFromLlmText(text), thread);
    } catch {
      return parseBrandEmailHeuristic(thread);
    }
  }

  return parseBrandEmailHeuristic(thread);
}

export function mapParsedCategoryToThreadStatus(category, currentStatus) {
  if (category === "campaign_brief") {
    return "brief_received";
  }
  if (category === "revision_request") {
    return "needs_follow_up";
  }
  return currentStatus || "awaiting_reply";
}
