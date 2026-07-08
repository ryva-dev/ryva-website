import { randomUUID } from "node:crypto";
import { mapParsedCategoryToThreadStatus, parseBrandEmailBrief } from "./maraInboxParser.mjs";

const DEFAULT_PARSE_LIMIT = Number.parseInt(process.env.MARA_INBOX_PARSE_LIMIT_PER_SYNC ?? "5", 10);

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mergeCampaignField(existingValue, nextValue) {
  const existing = String(existingValue ?? "").trim();
  const next = String(nextValue ?? "").trim();
  return next || existing;
}

export function listThreadsNeedingBriefParse(db, userId, workerSlug, limit = DEFAULT_PARSE_LIMIT) {
  return db
    .prepare(
      `SELECT id, gmail_thread_id AS gmailThreadId, brand_name AS brandName, contact_name AS contactName,
              contact_email AS contactEmail, subject, snippet, body_text AS bodyText, received_at AS receivedAt,
              urgency, thread_status AS threadStatus, parsed_at AS parsedAt, updated_at AS updatedAt
       FROM office_email_threads
       WHERE user_id = ? AND worker_slug = ? AND brand_related = 1
         AND (coalesce(body_text, '') != '' OR coalesce(snippet, '') != '')
         AND (parsed_at IS NULL OR parsed_at < updated_at)
       ORDER BY received_at DESC
       LIMIT ?`
    )
    .all(userId, workerSlug, limit);
}

export function upsertCampaignFromParsedBrief(db, userId, workerSlug, thread, parsed, timestamp = new Date().toISOString()) {
  const existing = db
    .prepare(
      `SELECT id, payment_amount AS paymentAmount, usage_rights AS usageRights, revision_limit AS revisionLimit,
              deliverables_json AS deliverablesJson, draft_due_date AS draftDueDate, final_due_date AS finalDueDate
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ? AND brand_name = ? AND contact_email = ?
       LIMIT 1`
    )
    .get(userId, workerSlug, thread.brandName || "Unknown brand", thread.contactEmail || "");

  const deliverables = parsed.deliverables?.length ? parsed.deliverables : safeJsonParse(existing?.deliverablesJson, []);
  const paymentAmount = mergeCampaignField(existing?.paymentAmount, parsed.paymentAmount);
  const usageRights = mergeCampaignField(existing?.usageRights, parsed.usageRights);
  const revisionLimit = mergeCampaignField(existing?.revisionLimit, parsed.revisionLimit);
  const draftDueDate = parsed.draftDueDate || existing?.draftDueDate || null;
  const finalDueDate = parsed.finalDueDate || existing?.finalDueDate || null;
  const notes = `Parsed ${parsed.generatedBy} from Gmail on ${new Date(timestamp).toLocaleString("en-US", { timeZone: "UTC" })} UTC.`;

  if (existing) {
    db.prepare(
      `UPDATE office_campaigns
       SET campaign_name = ?, campaign_status = ?, source_thread_id = ?, product_name = ?, deliverables_json = ?,
           brief_text = ?, draft_due_date = ?, final_due_date = ?, payment_amount = ?, payment_status = ?,
           usage_rights = ?, usage_rights_status = ?, revision_limit = ?, raw_footage_required = ?,
           missing_fields_json = ?, risk_flags_json = ?, notes = ?, last_parsed_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      parsed.campaignName || thread.subject || `${thread.brandName || "Brand"} outreach`,
      parsed.campaignStatus,
      thread.id,
      parsed.productName || "",
      JSON.stringify(deliverables),
      parsed.briefSummary || thread.snippet || "",
      draftDueDate,
      finalDueDate,
      paymentAmount,
      parsed.paymentStatus || "unknown",
      usageRights,
      parsed.usageRightsStatus || "unclear",
      revisionLimit,
      parsed.rawFootageRequired ? 1 : 0,
      JSON.stringify(parsed.missingFields || []),
      JSON.stringify(parsed.riskFlags || []),
      notes,
      timestamp,
      timestamp,
      existing.id
    );
    return { campaignId: existing.id, updated: true };
  }

  const campaignId = randomUUID();
  db.prepare(
    `INSERT INTO office_campaigns
      (id, user_id, worker_slug, brand_name, brand_website, contact_name, contact_email, product_name, campaign_name,
       campaign_status, source_thread_id, deliverables_json, brief_text, draft_due_date, final_due_date, payment_amount,
       payment_status, usage_rights, usage_rights_status, revision_limit, raw_footage_required, missing_fields_json,
       risk_flags_json, notes, last_parsed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    campaignId,
    userId,
    workerSlug,
    thread.brandName || "Unknown brand",
    parsed.brandWebsite || "",
    thread.contactName || "",
    thread.contactEmail || "",
    parsed.productName || "",
    parsed.campaignName || thread.subject || `${thread.brandName || "Brand"} outreach`,
    parsed.campaignStatus,
    thread.id,
    JSON.stringify(deliverables),
    parsed.briefSummary || thread.snippet || "",
    draftDueDate,
    finalDueDate,
    paymentAmount,
    parsed.paymentStatus || "unknown",
    usageRights,
    parsed.usageRightsStatus || "unclear",
    revisionLimit,
    parsed.rawFootageRequired ? 1 : 0,
    JSON.stringify(parsed.missingFields || []),
    JSON.stringify(parsed.riskFlags || []),
    notes,
    timestamp,
    timestamp,
    timestamp
  );

  return { campaignId, updated: false };
}

export function markEmailThreadParsed(db, threadId, userId, workerSlug, category, threadStatus, timestamp = new Date().toISOString()) {
  db.prepare(
    `UPDATE office_email_threads
     SET parsed_at = ?, category = ?, thread_status = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND worker_slug = ?`
  ).run(timestamp, category, threadStatus, timestamp, threadId, userId, workerSlug);
}

export async function parseUnparsedInboxThreads(db, userId, workerSlug, { fetchImpl, limit = DEFAULT_PARSE_LIMIT } = {}) {
  const threads = listThreadsNeedingBriefParse(db, userId, workerSlug, limit);
  const parsedThreads = [];
  const campaigns = [];

  for (const thread of threads) {
    const parsed = await parseBrandEmailBrief(thread, { fetchImpl });
    if (!parsed) {
      continue;
    }

    const timestamp = new Date().toISOString();
    const campaign = upsertCampaignFromParsedBrief(db, userId, workerSlug, thread, parsed, timestamp);
    const nextThreadStatus = mapParsedCategoryToThreadStatus(parsed.category, thread.threadStatus);
    markEmailThreadParsed(db, thread.id, userId, workerSlug, parsed.category, nextThreadStatus, timestamp);
    parsedThreads.push({ threadId: thread.id, generatedBy: parsed.generatedBy, missingFields: parsed.missingFields });
    campaigns.push({ campaignId: campaign.campaignId, brandName: thread.brandName, missingFields: parsed.missingFields });
  }

  return {
    campaigns,
    parsedCount: parsedThreads.length,
    parsedThreads
  };
}

export function listCampaignsWithGaps(db, userId, workerSlug, limit = 10) {
  return db
    .prepare(
      `SELECT id, brand_name AS brandName, campaign_name AS campaignName, campaign_status AS campaignStatus,
              deliverables_json AS deliverablesJson, draft_due_date AS draftDueDate, final_due_date AS finalDueDate,
              missing_fields_json AS missingFieldsJson, risk_flags_json AS riskFlagsJson, brief_text AS briefText
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ?
       ORDER BY updated_at DESC
       LIMIT ?`
    )
    .all(userId, workerSlug, limit)
    .map((row) => ({
      ...row,
      deliverables: safeJsonParse(row.deliverablesJson, []),
      missingFields: safeJsonParse(row.missingFieldsJson, []),
      riskFlags: safeJsonParse(row.riskFlagsJson, [])
    }))
    .filter((row) => row.missingFields.length > 0 || row.riskFlags.length > 0);
}

export function buildInboxOpsSummary(db, userId, workerSlug) {
  const campaigns = listCampaignsWithGaps(db, userId, workerSlug, 12);
  const urgentThreads = db
    .prepare(
      `SELECT brand_name AS brandName, subject, snippet, thread_status AS threadStatus
       FROM office_email_threads
       WHERE user_id = ? AND worker_slug = ? AND urgency = 'high'
       ORDER BY received_at DESC
       LIMIT 5`
    )
    .all(userId, workerSlug);

  const upcomingDeadlines = db
    .prepare(
      `SELECT brand_name AS brandName, campaign_name AS campaignName, draft_due_date AS draftDueDate, final_due_date AS finalDueDate
       FROM office_campaigns
       WHERE user_id = ? AND worker_slug = ?
         AND (draft_due_date IS NOT NULL OR final_due_date IS NOT NULL)
       ORDER BY coalesce(final_due_date, draft_due_date) ASC
       LIMIT 5`
    )
    .all(userId, workerSlug);

  return {
    campaignsWithGaps: campaigns,
    upcomingDeadlines,
    urgentThreads
  };
}
