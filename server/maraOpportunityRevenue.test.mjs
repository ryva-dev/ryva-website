import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { wrapSqliteHandle } from "./dataStore.mjs";
import {
  isValidLifecycleTransition,
  mergeResearchLifecycle,
  normalizeLifecycleStage,
  buildNextAction,
  detectStall,
  legacyStatusFromLifecycle
} from "./maraOpportunityLifecycle.mjs";
import {
  ensureOpportunityLifecycleSchema,
  inferStageFromSignals,
  transitionOpportunityStage,
  listStalledOpportunities
} from "./maraOpportunityStateEngine.mjs";
import { classifyBrandReply } from "./maraReplyClassifier.mjs";
import { runPitchQualityChecks, detectUnsupportedBuyingClaim } from "./maraPitchQuality.mjs";
import { extractDealTermsFromText, evaluateDealTerms } from "./maraDealTerms.mjs";
import {
  resolveAttribution,
  shouldCountAsRevenueInfluenced,
  ATTRIBUTION_TYPES
} from "./maraRevenueAttribution.mjs";
import { applyOutcomeToLearning, getCreatorLearningState, resetCreatorLearningState } from "./maraLearningLoop.mjs";
import { buildContactDiscoveryFailurePlan } from "./maraContactDiscovery.mjs";
import { getMultimodalProvider, getTranscriptionProvider } from "./maraMediaPipeline.mjs";

function makeStore() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE mara_public_brands (
      id TEXT PRIMARY KEY,
      brand_name TEXT NOT NULL,
      website TEXT
    );
    CREATE TABLE mara_brand_profiles (
      id TEXT PRIMARY KEY,
      brand_name TEXT,
      website TEXT
    );
    CREATE TABLE mara_creator_brand_opportunities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      brand_profile_id TEXT NOT NULL,
      public_brand_id TEXT,
      status TEXT NOT NULL,
      score_total INTEGER NOT NULL DEFAULT 0,
      scores_json TEXT NOT NULL DEFAULT '{}',
      opportunity_package_json TEXT NOT NULL DEFAULT '{}',
      evidence_json TEXT NOT NULL DEFAULT '[]',
      confidence REAL NOT NULL DEFAULT 0,
      decision TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE office_leads (id TEXT PRIMARY KEY, user_id TEXT, worker_slug TEXT);
    CREATE TABLE office_campaigns (id TEXT PRIMARY KEY, user_id TEXT, worker_slug TEXT);
  `);
  return wrapSqliteHandle(db);
}

test("lifecycle maps legacy status and blocks invalid terminal regress", () => {
  assert.equal(normalizeLifecycleStage(null, { legacyStatus: "responded" }), "replied");
  assert.equal(legacyStatusFromLifecycle("paid"), "won");
  assert.equal(isValidLifecycleTransition("won", "discovered"), false);
  assert.equal(isValidLifecycleTransition("sent", "follow_up_due"), true);
  assert.equal(isValidLifecycleTransition("qualified", "lost"), true);
});

test("research refresh does not demote sent/won opportunities", () => {
  assert.equal(
    mergeResearchLifecycle({
      existingLifecycle: "sent",
      decision: "pursue",
      hasOutreachContact: true
    }),
    "sent"
  );
  assert.equal(
    mergeResearchLifecycle({
      existingLifecycle: "discovered",
      decision: "pursue",
      hasOutreachContact: false
    }),
    "contact_needed"
  );
});

test("inferStageFromSignals handles gifted vs paid and perpetual usage negotiation", () => {
  const gifted = inferStageFromSignals({
    currentStage: "replied",
    replyClass: "gifted_collaboration",
    giftedOnly: true
  });
  assert.equal(gifted.flags?.[0], "gifted_not_paid");

  const paid = inferStageFromSignals({ hired: true, giftedOnly: false });
  assert.equal(paid.stage, "won");
  assert.equal(paid.requiresConfirmation, true);

  const rejection = inferStageFromSignals({ replyClass: "rejection" });
  assert.equal(rejection.stage, "lost");
});

test("transitionOpportunityStage records history and requires confirmation for won", async () => {
  const store = makeStore();
  await ensureOpportunityLifecycleSchema(store);
  const now = new Date().toISOString();
  await store.execute(
    `INSERT INTO mara_creator_brand_opportunities
      (id, user_id, worker_id, brand_profile_id, status, score_total, scores_json, opportunity_package_json, evidence_json, created_at, updated_at, lifecycle_stage)
     VALUES ('opp-1', 'u1', 'mara-vale', 'b1', 'responded', 70, '{}', '{}', '[]', ?, ?, 'replied')`,
    now,
    now
  );

  const pending = await transitionOpportunityStage(store, {
    userId: "u1",
    workerId: "mara-vale",
    opportunityId: "opp-1",
    toStage: "won",
    confidence: 80,
    evidence: [{ claim: "hire language" }],
    source: "inbox_inference",
    reason: "Hire language"
  });
  assert.equal(pending.applied, false);
  assert.equal(pending.requiresConfirmation, true);

  const forced = await transitionOpportunityStage(store, {
    userId: "u1",
    workerId: "mara-vale",
    opportunityId: "opp-1",
    toStage: "won",
    confidence: 100,
    source: "user_correction",
    reason: "Manager confirmed win",
    force: true,
    confirmedDealValue: 1200
  });
  assert.equal(forced.applied, true);
  const row = await store.queryOne(`SELECT lifecycle_stage AS stage, status FROM mara_creator_brand_opportunities WHERE id = 'opp-1'`);
  assert.equal(row.stage, "won");
  assert.equal(row.status, "won");

  const events = await store.query(`SELECT to_stage AS "toStage", confirmed FROM mara_opportunity_stage_events WHERE opportunity_id = 'opp-1'`);
  assert.ok(events.length >= 2);
});

test("stalled approval_needed opportunities are detected", async () => {
  const store = makeStore();
  await ensureOpportunityLifecycleSchema(store);
  const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  await store.execute(
    `INSERT INTO mara_creator_brand_opportunities
      (id, user_id, worker_id, brand_profile_id, status, score_total, scores_json, opportunity_package_json, evidence_json, created_at, updated_at, lifecycle_stage, stage_changed_at, estimated_deal_value)
     VALUES ('opp-stall', 'u1', 'mara-vale', 'b1', 'active', 80, '{}', '{}', '[]', ?, ?, 'approval_needed', ?, 900)`,
    old,
    old,
    old
  );
  const stalled = await listStalledOpportunities(store, "u1", "mara-vale");
  assert.ok(stalled.some((item) => item.id === "opp-stall"));
  assert.equal(stalled[0].stall.requiresUserInput, true);
});

test("missing contacts remain Mara-owned and never become creator blockers", () => {
  const stalled = detectStall({
    lifecycleStage: "contact_needed",
    stageChangedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    hasOutreachContact: false
  });
  assert.equal(stalled.nextAction.action, "discover_contact");
  assert.equal(stalled.canActAutomatically, true);
  assert.equal(stalled.requiresUserInput, false);
  assert.match(stalled.nextAction.blockingReason, /I'm continuing contact research/i);
});

test("reply classifier separates gifted, rates, perpetual rights, and scam", () => {
  assert.equal(classifyBrandReply({ body: "We can only do a gifted collaboration" }).giftedOnly, true);
  assert.equal(classifyBrandReply({ body: "What's your rate for 3 videos?" }).class, "request_for_rates");
  const rights = classifyBrandReply({ body: "We need perpetual usage rights and exclusivity." });
  assert.equal(rights.class, "contract_or_usage_rights");
  assert.ok(rights.risks.some((risk) => risk.code === "perpetual_usage"));
  assert.equal(classifyBrandReply({ body: "Please send gift cards via western union" }).class, "suspected_scam");
});

test("pitch quality blocks wrong brand, missing contact, unsupported buying claims", () => {
  assert.equal(detectUnsupportedBuyingClaim("You're already buying UGC creators weekly"), true);
  const bad = runPitchQualityChecks({
    body: "As we discussed, you're buying UGC. Hope you're well!",
    brandName: "Glow",
    expectedBrandName: "Other",
    contactEmail: "",
    claimsBrandIsBuying: true,
    evidenceSupportsBuying: false
  });
  assert.equal(bad.canCreateDraft, false);
  assert.ok(bad.issues.some((item) => item.code === "wrong_brand"));
  assert.ok(bad.issues.some((item) => item.code === "missing_contact"));
});

test("deal terms flag perpetual usage and gifted-not-paid", () => {
  const terms = extractDealTermsFromText("Gifted product only, perpetual usage, exclusivity, $50");
  const evaled = evaluateDealTerms(terms, { creatorMinimums: { baseRate: 400 } });
  assert.ok(evaled.flags.some((flag) => flag.code === "perpetual_usage"));
  assert.ok(evaled.flags.some((flag) => flag.code === "under_minimum"));
  assert.equal(evaled.mayAutonomouslyAccept, false);
});

test("revenue attribution never counts gifted or unanswered pitches", () => {
  assert.equal(
    shouldCountAsRevenueInfluenced({
      hired: true,
      revenueAmount: 500,
      giftedOnly: true,
      attribution: ATTRIBUTION_TYPES.SOURCED_BY_MARA
    }),
    false
  );
  assert.equal(
    shouldCountAsRevenueInfluenced({
      hired: false,
      revenueAmount: 0,
      attribution: ATTRIBUTION_TYPES.SOURCED_BY_MARA
    }),
    false
  );
  assert.equal(
    resolveAttribution({ discoveredByMara: true, maraDraftedPitch: true }),
    ATTRIBUTION_TYPES.SOURCED_BY_MARA
  );
});

test("learning loop stays tenant-scoped and accepts corrections", async () => {
  const store = makeStore();
  await applyOutcomeToLearning(store, { userId: "u1", workerId: "mara-vale", hired: true });
  await applyOutcomeToLearning(store, {
    userId: "u1",
    workerId: "mara-vale",
    userCorrection: "This brand was misclassified as qualified"
  });
  const state = await getCreatorLearningState(store, "u1", "mara-vale");
  assert.ok(state.corrections.some((item) => /misclassified/.test(item.note)));
  const other = await getCreatorLearningState(store, "u2", "mara-vale");
  assert.equal((other.corrections || []).length, 0);
  await resetCreatorLearningState(store, "u1", "mara-vale");
  const reset = await getCreatorLearningState(store, "u1", "mara-vale");
  assert.equal((reset.corrections || []).length, 0);
});

test("contact discovery failure plan recommends routes instead of inventing email", () => {
  const plan = buildContactDiscoveryFailurePlan({ emails: [], outreachReady: false, pagesFetched: 2, hasForm: true });
  assert.equal(plan.status, "no_public_email");
  assert.ok(plan.nextRoutes.some((route) => route.route === "contact_form"));
  assert.ok(plan.nextRoutes.some((route) => route.route === "research_alternatives"));
  assert.equal(plan.nextRoutes.some((route) => route.route === "user_provided_contact"), false);
  assert.equal(plan.deprioritize, true);
});

test("media providers fail closed when non-mock provider is unset", async () => {
  const previous = process.env.MARA_MULTIMODAL_PROVIDER;
  process.env.MARA_MULTIMODAL_PROVIDER = "deepgram";
  try {
    const provider = getMultimodalProvider();
    await assert.rejects(() => provider.analyzeTimeline({ transcript: "hi" }), /not configured/);
  } finally {
    if (previous == null) delete process.env.MARA_MULTIMODAL_PROVIDER;
    else process.env.MARA_MULTIMODAL_PROVIDER = previous;
  }
  assert.equal(getTranscriptionProvider().name, "mock_transcription");
});

test("next action for approval_needed is not autonomous", () => {
  const next = buildNextAction({ lifecycleStage: "approval_needed" });
  assert.equal(next.autonomous, false);
  assert.equal(next.requiresApproval, true);
});

test("detectStall for sent after 3 days recommends follow-up", () => {
  const stall = detectStall({
    lifecycleStage: "sent",
    stageChangedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedValue: 800
  });
  assert.ok(stall);
  assert.ok(stall.daysStalled >= 3);
  assert.ok(["prepare_follow_up", "wait_or_follow_up"].includes(stall.nextAction.action));
  const next = buildNextAction({ lifecycleStage: "sent", daysInStage: 4 });
  assert.equal(next.action, "prepare_follow_up");
});
