import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { wrapSqliteHandle } from "./dataStore.mjs";
import { initMaraIntelligence, saveBrandProfile, saveCreatorBrandOpportunity } from "./maraIntelligence.mjs";
import { inferAndRecordCommercialOutcomes, inferOutcomeFromText } from "./maraOutcomeInference.mjs";

function makeStore() {
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
      contact_name TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      source_message_count INTEGER NOT NULL DEFAULT 1,
      thread_status TEXT NOT NULL DEFAULT 'needs_reply',
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
      contact_name TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL DEFAULT '',
      campaign_name TEXT NOT NULL,
      campaign_status TEXT NOT NULL,
      source_thread_id TEXT,
      deliverables_json TEXT NOT NULL DEFAULT '[]',
      brief_text TEXT NOT NULL DEFAULT '',
      draft_due_date TEXT,
      final_due_date TEXT,
      payment_amount TEXT NOT NULL DEFAULT '',
      payment_status TEXT NOT NULL DEFAULT 'unknown',
      usage_rights TEXT NOT NULL DEFAULT '',
      usage_rights_status TEXT NOT NULL DEFAULT 'unclear',
      revision_limit TEXT NOT NULL DEFAULT '',
      raw_footage_required INTEGER NOT NULL DEFAULT 0,
      missing_fields_json TEXT NOT NULL DEFAULT '[]',
      risk_flags_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      last_parsed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return wrapSqliteHandle(db);
}

test("inferOutcomeFromText detects hire, interest, concept, payment, and decline signals", () => {
  assert.equal(inferOutcomeFromText({ subject: "Thanks for applying" }), null);
  assert.equal(inferOutcomeFromText({ body: "Thanks for reaching out — what's your rate?" })?.responded, true);
  assert.equal(inferOutcomeFromText({ body: "Love this concept, green-lit for August." })?.conceptAccepted, true);
  assert.equal(inferOutcomeFromText({ body: "You're hired. Contract attached." })?.hired, true);
  assert.equal(inferOutcomeFromText({ body: "Payment sent for $1,250.00" })?.revenueAmount, 1250);
  assert.equal(inferOutcomeFromText({ body: "We'll pass this time." })?.declined, true);
});

test("Mara records outcomes from inbox evidence without a manager form", async () => {
  const store = makeStore();
  await initMaraIntelligence(store);
  const brand = await saveBrandProfile(store, {
    brandKey: "glow-theory",
    brandName: "Glow Theory",
    evidence: [{ basis: "observed", claim: "Public brand site", sourceUrl: "https://example.com" }]
  });
  const opportunity = await saveCreatorBrandOpportunity(store, {
    userId: "creator-1",
    workerId: "mara-vale",
    brandProfileId: brand.id,
    status: "qualified",
    scores: { creatorFit: 80, commercialPotential: 70, opportunityGap: 75, outreachLikelihood: 60 },
    opportunityThesis: "Fit",
    creativeGap: "Barrier education",
    evidence: [{ basis: "observed", claim: "Ads omit beginners." }]
  });

  const now = new Date().toISOString();
  await store.execute(
    `INSERT INTO office_email_threads
     (id, user_id, worker_slug, subject, snippet, body_text, received_at, brand_related, brand_name, thread_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'needs_reply', ?, ?)`,
    "thread-1",
    "creator-1",
    "mara-vale",
    "Re: August collab",
    "You're hired",
    "You're hired. Contract attached. Payment on the way for $900.",
    now,
    "Glow Theory",
    now,
    now
  );

  const summary = await inferAndRecordCommercialOutcomes(store, "creator-1", "mara-vale", { limit: 10 });
  assert.equal(summary.recorded.length, 1);
  assert.equal(summary.recorded[0].opportunityId, opportunity.id);
  assert.match(summary.recorded[0].claim, /hired|payment|contract/i);

  const ranked = await store.queryOne(
    `SELECT status, score_total AS "scoreTotal" FROM mara_creator_brand_opportunities WHERE id = ?`,
    opportunity.id
  );
  assert.equal(ranked.status, "won");
  assert.ok(ranked.scoreTotal >= 70);

  const again = await inferAndRecordCommercialOutcomes(store, "creator-1", "mara-vale", { limit: 10 });
  assert.equal(again.recorded.length, 0);
  assert.ok(again.skipped.some((entry) => entry.reason === "duplicate"));
});

test("paid campaign status counts as a completed commercial outcome", async () => {
  const store = makeStore();
  await initMaraIntelligence(store);
  const brand = await saveBrandProfile(store, {
    brandKey: "serum-co",
    brandName: "Serum Co",
    evidence: [{ basis: "observed", claim: "Site", sourceUrl: "https://example.com" }]
  });
  await saveCreatorBrandOpportunity(store, {
    userId: "creator-1",
    workerId: "mara-vale",
    brandProfileId: brand.id,
    scores: { creatorFit: 70, commercialPotential: 65, opportunityGap: 60, outreachLikelihood: 55 },
    opportunityThesis: "Fit",
    creativeGap: "Routine demo",
    evidence: [{ basis: "observed", claim: "Product page" }]
  });
  const now = new Date().toISOString();
  await store.execute(
    `INSERT INTO office_campaigns
     (id, user_id, worker_slug, brand_name, campaign_name, campaign_status, brief_text, payment_amount, payment_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    "camp-1",
    "creator-1",
    "mara-vale",
    "Serum Co",
    "June routine",
    "paid",
    "Delivered",
    "$450",
    "paid",
    now,
    now
  );

  const summary = await inferAndRecordCommercialOutcomes(store, "creator-1", "mara-vale");
  assert.equal(summary.recorded.length, 1);
  assert.equal(summary.recorded[0].brandName, "Serum Co");
});
