import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { parseUnparsedInboxThreads, upsertCampaignFromParsedBrief } from "./maraInboxOps.mjs";

function makeDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE office_email_threads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_slug TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'gmail',
      subject TEXT NOT NULL,
      participants_json TEXT NOT NULL DEFAULT '[]',
      snippet TEXT NOT NULL,
      body_text TEXT NOT NULL DEFAULT '',
      received_at TEXT NOT NULL,
      brand_related INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'general',
      urgency TEXT NOT NULL DEFAULT 'low',
      confidence REAL NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT '',
      brand_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      source_message_count INTEGER NOT NULL DEFAULT 1,
      thread_status TEXT NOT NULL,
      gmail_thread_id TEXT,
      raw_json TEXT NOT NULL DEFAULT '{}',
      parsed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE office_campaigns (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_slug TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      brand_website TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      product_name TEXT NOT NULL DEFAULT '',
      campaign_name TEXT NOT NULL,
      campaign_status TEXT NOT NULL,
      source_thread_id TEXT,
      deliverables_json TEXT NOT NULL,
      brief_text TEXT NOT NULL,
      draft_due_date TEXT,
      final_due_date TEXT,
      payment_amount TEXT NOT NULL DEFAULT '',
      payment_status TEXT NOT NULL DEFAULT 'unknown',
      usage_rights TEXT NOT NULL DEFAULT '',
      usage_rights_status TEXT NOT NULL DEFAULT 'unclear',
      revision_limit TEXT NOT NULL DEFAULT '',
      raw_footage_required INTEGER NOT NULL DEFAULT 0,
      missing_fields_json TEXT NOT NULL,
      risk_flags_json TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      last_parsed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

test("upsertCampaignFromParsedBrief creates structured campaign rows", () => {
  const db = makeDb();
  const thread = {
    id: "thread-1",
    brandName: "Glow Theory",
    contactName: "Nina",
    contactEmail: "nina@glowtheory.co",
    subject: "August routine brief",
    snippet: "Need 2 TikTok videos"
  };
  const parsed = {
    briefSummary: "August routine launch brief with talking points.",
    campaignName: "August Routine Launch",
    campaignStatus: "brief_received",
    category: "campaign_brief",
    deliverables: ["2 TikTok videos", "1 Instagram Reel"],
    draftDueDate: "2026-08-10T00:00:00.000Z",
    finalDueDate: "2026-08-12T00:00:00.000Z",
    generatedBy: "heuristic",
    missingFields: ["payment_amount_missing"],
    paymentAmount: "",
    paymentStatus: "unknown",
    productName: "Barrier Repair Serum",
    rawFootageRequired: false,
    revisionLimit: "",
    riskFlags: ["usage_rights_unclear"],
    usageRights: "",
    usageRightsStatus: "unclear"
  };

  const result = upsertCampaignFromParsedBrief(db, "user-1", "mara-vale", thread, parsed);
  const campaign = db.prepare("SELECT campaign_name AS campaignName, deliverables_json AS deliverablesJson, missing_fields_json AS missingFieldsJson FROM office_campaigns WHERE id = ?").get(result.campaignId);

  assert.equal(result.updated, false);
  assert.equal(campaign.campaignName, "August Routine Launch");
  assert.deepEqual(JSON.parse(campaign.deliverablesJson), ["2 TikTok videos", "1 Instagram Reel"]);
  assert.deepEqual(JSON.parse(campaign.missingFieldsJson), ["payment_amount_missing"]);
});

test("parseUnparsedInboxThreads parses brand threads into campaigns", async () => {
  const db = makeDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO office_email_threads
      (id, user_id, worker_slug, subject, participants_json, snippet, body_text, received_at, brand_related, category, urgency, confidence, reason,
       brand_name, contact_name, contact_email, thread_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "thread-1",
    "user-1",
    "mara-vale",
    "Glow Theory UGC brief",
    "[]",
    "Need 2 TikTok videos",
    "Hi! Sharing the August routine brief. Need 2 TikTok videos and 1 Instagram Reel by 2026-08-12. Paid social usage still TBD.",
    now,
    1,
    "general",
    "high",
    0.9,
    "brand",
    "Glow Theory",
    "Nina",
    "nina@glowtheory.co",
    "awaiting_reply",
    now,
    now
  );

  const result = await parseUnparsedInboxThreads(db, "user-1", "mara-vale", { limit: 3 });
  const campaignCount = db.prepare("SELECT COUNT(*) AS count FROM office_campaigns").get().count;
  const parsedAt = db.prepare("SELECT parsed_at AS parsedAt FROM office_email_threads WHERE id = ?").get("thread-1").parsedAt;

  assert.equal(result.parsedCount, 1);
  assert.equal(campaignCount, 1);
  assert.ok(parsedAt);
});
