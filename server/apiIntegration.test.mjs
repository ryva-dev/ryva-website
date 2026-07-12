import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function waitForServer(baseUrl, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Test server exited with ${child.exitCode}.`);
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for test server.");
}

test("authenticated upload is tenant-scoped and account deletion erases the object", { timeout: 20_000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ryva-api-"));
  const port = 19000 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: path.resolve("."),
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(port),
      HOST: "127.0.0.1",
      APP_URL: baseUrl,
      DATABASE_PATH: path.join(root, "app.db"),
      STORAGE_ROOT: root,
      OBJECT_STORAGE_DRIVER: "local",
      MARA_AUTONOMY_INTERVAL_MINUTES: "0",
      MAIL_DELIVERY_MODE: "log",
      STRIPE_SECRET_KEY: "sk_test_ryva_integration",
      STRIPE_WEBHOOK_SECRET: "whsec_ryva_integration"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let serverErrors = "";
  child.stderr.on("data", (chunk) => { serverErrors += chunk.toString(); });

  try {
    await waitForServer(baseUrl, child);
    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ name: "API Test", email: "api-test@example.com", password: "correct-horse-123" })
    });
    assert.equal(register.status, 201);
    let cookie = register.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie?.startsWith("ryva_session="));

    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.email, "api-test@example.com");

    const onboarding = await fetch(`${baseUrl}/api/onboarding/complete`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ name: "API Test", brandName: "Private Brand", whatYouDo: "Creator operations testing" })
    });
    assert.equal(onboarding.status, 200);
    assert.equal((await onboarding.json()).user.onboarded, true);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ email: "api-test@example.com", password: "correct-horse-123" })
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie?.startsWith("ryva_session="));

    const Database = (await import("better-sqlite3")).default;
    const db = new Database(path.join(root, "app.db"));
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get("api-test@example.com");
    db.prepare(
      `INSERT INTO checkout_sessions (id, user_id, worker_slug, amount_cents, status, created_at, completed_at)
       VALUES ('checkout-1', ?, 'mara-vale', 4000, 'completed', ?, ?)`
    ).run(user.id, new Date().toISOString(), new Date().toISOString());
    db.prepare(
      `INSERT INTO hired_workers (id, user_id, worker_slug, checkout_session_id, status, hired_at, paused, billing_status, stripe_subscription_id)
       VALUES ('hire-1', ?, 'mara-vale', 'checkout-1', 'active', ?, 0, 'active', 'sub_ryva_test')`
    ).run(user.id, new Date().toISOString());
    db.prepare(
      `INSERT INTO office_worker_integrations
       (id, user_id, worker_slug, provider, status, account_label, metadata_json, connected_at, updated_at)
       VALUES ('integration-1', ?, 'mara-vale', 'gmail', 'connected', 'Gmail inbox', '{"simulated":true}', ?, ?)`
    ).run(user.id, new Date().toISOString(), new Date().toISOString());
    db.prepare(
      `INSERT INTO office_suggested_actions
       (id, user_id, worker_slug, action_type, title, description, reason, payload_json, status, requires_approval, created_at, updated_at)
       VALUES ('suggestion-1', ?, 'mara-vale', 'create_calendar_event', 'Protect launch time', 'Reserve focused work.',
               'Manager approval required', '{"event":{"title":"Launch focus"}}', 'suggested', 1, ?, ?)`
    ).run(user.id, new Date().toISOString(), new Date().toISOString());
    db.close();

    const hiredWorkers = await fetch(`${baseUrl}/api/office/workers`, { headers: { cookie } });
    assert.equal(hiredWorkers.status, 200);
    assert.equal((await hiredWorkers.json()).workers.some((worker) => worker.slug === "mara-vale"), true);

    const pauseWorker = await fetch(`${baseUrl}/api/office/workers/mara-vale/pause`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ paused: true })
    });
    assert.equal(pauseWorker.status, 200);
    assert.equal((await pauseWorker.json()).paused, true);
    const pausedDb = new Database(path.join(root, "app.db"));
    assert.equal(pausedDb.prepare("SELECT paused FROM hired_workers WHERE id = 'hire-1'").get().paused, 1);
    assert.equal(pausedDb.prepare("SELECT COUNT(*) AS count FROM office_activity_logs WHERE user_id = ? AND worker_slug = 'mara-vale'").get(user.id).count, 1);
    pausedDb.prepare("UPDATE hired_workers SET paused = 0 WHERE id = 'hire-1'").run();
    pausedDb.close();

    const approveSuggestion = await fetch(`${baseUrl}/api/office/workers/mara-vale/suggested-actions/suggestion-1`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ decision: "approve" })
    });
    assert.equal(approveSuggestion.status, 200);
    const replaySuggestion = await fetch(`${baseUrl}/api/office/workers/mara-vale/suggested-actions/suggestion-1`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ decision: "approve" })
    });
    assert.equal(replaySuggestion.status, 409);
    const suggestionDb = new Database(path.join(root, "app.db"));
    assert.equal(suggestionDb.prepare("SELECT COUNT(*) AS count FROM office_calendar_events WHERE user_id = ? AND title = 'Launch focus'").get(user.id).count, 1);
    assert.equal(suggestionDb.prepare("SELECT COUNT(*) AS count FROM action_audit_events WHERE user_id = ? AND idempotency_key = 'suggested-action:suggestion-1:approve'").get(user.id).count, 1);
    suggestionDb.close();

    const chat = await fetch(`${baseUrl}/api/office/workers/mara-vale/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ text: "Hello Mara, keep my work organized." })
    });
    assert.equal(chat.status, 201);
    const chatDb = new Database(path.join(root, "app.db"));
    assert.equal(chatDb.prepare("SELECT COUNT(*) AS count FROM office_chat_messages WHERE user_id = ? AND worker_slug = 'mara-vale'").get(user.id).count >= 2, true);
    chatDb.close();

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe("sk_test_ryva_integration");
    const eventPayload = JSON.stringify({
      id: "evt_ryva_payment_failed",
      object: "event",
      type: "invoice.payment_failed",
      data: { object: { id: "in_ryva_test", subscription: "sub_ryva_test" } }
    });
    const signature = stripe.webhooks.generateTestHeaderString({ payload: eventPayload, secret: "whsec_ryva_integration" });
    const webhook = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      body: eventPayload
    });
    assert.equal(webhook.status, 200);
    const duplicateWebhook = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      body: eventPayload
    });
    assert.equal((await duplicateWebhook.json()).duplicate, true);
    const billingDb = new Database(path.join(root, "app.db"));
    assert.equal(billingDb.prepare("SELECT billing_status AS status FROM hired_workers WHERE id = 'hire-1'").get().status, "past_due");
    assert.equal(billingDb.prepare("SELECT COUNT(*) AS count FROM stripe_webhook_events WHERE event_id = ?").get("evt_ryva_payment_failed").count, 1);
    billingDb.prepare("UPDATE hired_workers SET stripe_subscription_id = NULL WHERE id = 'hire-1'").run();
    billingDb.close();

    const calendarCreate = await fetch(`${baseUrl}/api/office/calendar/events`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ title: "Private launch", startsAt: "2026-08-01T10:00:00Z", endsAt: "2026-08-01T11:00:00Z" })
    });
    assert.equal(calendarCreate.status, 201);
    const privateEventId = (await calendarCreate.json()).id;

    const secondRegistration = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ name: "Other Tenant", email: "other-tenant@example.com", password: "correct-horse-456" })
    });
    assert.equal(secondRegistration.status, 201);
    const secondCookie = secondRegistration.headers.get("set-cookie")?.split(";")[0];
    const crossTenantUpdate = await fetch(`${baseUrl}/api/office/calendar/events/${privateEventId}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie: secondCookie },
      body: JSON.stringify({ title: "Stolen event", startsAt: "2026-08-01T10:00:00Z", endsAt: "2026-08-01T11:00:00Z" })
    });
    assert.equal(crossTenantUpdate.status, 404);

    const rejectedUpload = await fetch(`${baseUrl}/api/office/workers/mara-vale/files`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ name: "payload.sh", type: "text/plain", contentBase64: Buffer.from("#!/bin/sh").toString("base64") })
    });
    assert.equal(rejectedUpload.status, 400);

    const officeSettings = await fetch(`${baseUrl}/api/office/settings`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ settings: { timezone: "America/New_York", quietHours: "22:00-07:00" } })
    });
    assert.equal(officeSettings.status, 200);

    const workerSettings = await fetch(`${baseUrl}/api/office/workers/mara-vale/settings`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ settings: [{ label: "Approval boundary", value: "Ask before sending" }] })
    });
    assert.equal(workerSettings.status, 200);

    const workerKnowledge = await fetch(`${baseUrl}/api/office/workers/mara-vale/knowledge`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ knowledge: [{ title: "Voice", items: ["Direct and warm"] }] })
    });
    assert.equal(workerKnowledge.status, 200);

    const customTask = await fetch(`${baseUrl}/api/office/workers/mara-vale/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ title: "Protect existing behavior", module: "Operations", priority: "High" })
    });
    assert.equal(customTask.status, 201);

    const creativeAnalysis = await fetch(`${baseUrl}/api/office/workers/mara-vale/intelligence/creative-analyses`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({
        assetType: "rough_cut",
        assetRef: "private-video-1",
        analysis: {
          assetSummary: "Private creator rough cut",
          videoStructure: { productAppearsAt: "00:00" },
          creativeStrategy: { persona: "Beginner" },
          performanceMechanics: { curiosityGap: true },
          execution: { naturalness: "Strong" },
          timestampedFeedback: [{ at: "00:02", observation: "Opening repeats the title.", consequence: "Two seconds add no new information.", revision: "Open with the viewer objection." }],
          unknowns: ["No retention data supplied."]
        },
        evidence: [{ basis: "observed", claim: "Opening speech duplicates the title." }]
      })
    });
    assert.equal(creativeAnalysis.status, 201);

    const commercialOutcome = await fetch(`${baseUrl}/api/office/workers/mara-vale/intelligence/outcomes`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ contacted: true, responded: true, hired: true, revenueAmount: 500, currency: "USD" })
    });
    assert.equal(commercialOutcome.status, 201);
    assert.equal((await commercialOutcome.json()).metrics.revenueInfluenced, 500);

    const intelligence = await fetch(`${baseUrl}/api/office/workers/mara-vale/intelligence`, { headers: { cookie } });
    assert.equal(intelligence.status, 200);
    const intelligencePayload = await intelligence.json();
    assert.equal(intelligencePayload.intelligence.metrics.revenueInfluenced, 500);
    assert.equal(intelligencePayload.intelligence.creativeAnalyses[0].assetRef, "private-video-1");
    const crossTenantIntelligence = await fetch(`${baseUrl}/api/office/workers/mara-vale/intelligence`, { headers: { cookie: secondCookie } });
    assert.equal(crossTenantIntelligence.status, 404);

    const workerOnboardingSave = await fetch(`${baseUrl}/api/office/workers/mara-vale/onboarding/save`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ answers: { approvalBoundary: "Ask before sending" }, generatedSummary: [] })
    });
    assert.equal(workerOnboardingSave.status, 200);

    const onboardingDb = new Database(path.join(root, "app.db"));
    const onboardingUser = onboardingDb.prepare("SELECT id FROM users WHERE email = ?").get("api-test@example.com");
    const outputTimestamp = new Date().toISOString();
    onboardingDb.prepare(
      `INSERT INTO worker_outputs
       (id, user_id, worker_id, task_id, output_type, title, content, structured_content_json, source, created_at, updated_at)
       VALUES ('existing-output', ?, 'mara-vale', NULL, 'ops_brief', 'Existing output', 'Ready', '{}', 'integration_test', ?, ?)`
    ).run(onboardingUser.id, outputTimestamp, outputTimestamp);
    onboardingDb.prepare(
      `INSERT INTO worker_research_items
       (id, user_id, worker_id, scope, topic, query, source_type, status, summary, insights_json, evidence_json, normalized_topic, created_at, updated_at)
       VALUES ('research-brand-x', ?, 'mara-vale', 'brand_identity', 'Brand X', 'Research Brand X', 'web_brand', 'completed',
               'Barrier-support skincare brand.', '["Suggested angle: beginner barrier education"]',
               '[{"title":"Brand X","url":"https://example.com/brand-x"}]', 'brand x', ?, ?)`
    ).run(onboardingUser.id, outputTimestamp, outputTimestamp);
    onboardingDb.prepare(
      `INSERT INTO worker_brands
       (id, user_id, worker_id, brand_name, website, identity_summary, vibe_notes, suggested_angle, contact_email, contact_name,
        research_item_id, normalized_name, created_at, updated_at)
       VALUES ('worker-brand-x', ?, 'mara-vale', 'Brand X', 'https://example.com/brand-x', 'Barrier-support skincare brand.',
               'Strong fit for educational delivery.', 'Beginner barrier education', 'partnerships@example.com', 'Partnerships',
               'research-brand-x', 'brand x', ?, ?)`
    ).run(onboardingUser.id, outputTimestamp, outputTimestamp);
    onboardingDb.prepare("UPDATE office_onboarding_sessions SET status = 'completed', completed_at = ? WHERE user_id = ? AND worker_slug = 'mara-vale'")
      .run(outputTimestamp, onboardingUser.id);
    onboardingDb.close();

    const workerOnboardingComplete = await fetch(`${baseUrl}/api/office/workers/mara-vale/onboarding/complete`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({
        answers: { approvalBoundary: "Ask before sending" },
        generatedSummary: [],
        knowledge: [{ title: "Goals", items: ["Protect creator revenue"] }],
        tasks: [],
        briefing: { title: "First briefing", dateLabel: "Tomorrow", agenda: [] },
        worklogEntry: { result: "Onboarding complete" }
      })
    });
    assert.equal(workerOnboardingComplete.status, 200);
    const syncedIntelligence = await fetch(`${baseUrl}/api/office/workers/mara-vale/intelligence`, { headers: { cookie } });
    assert.equal(syncedIntelligence.status, 200);
    const syncedPayload = await syncedIntelligence.json();
    assert.equal(syncedPayload.intelligence.opportunities[0].brandName, "Brand X");
    assert.equal(syncedPayload.intelligence.opportunities[0].opportunityPackage.evidence.some((entry) => entry.basis === "hypothesis"), true);

    const disconnect = await fetch(`${baseUrl}/api/office/workers/mara-vale/disconnect-email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ provider: "gmail" })
    });
    assert.equal(disconnect.status, 200);
    const disconnectedDb = new Database(path.join(root, "app.db"));
    assert.equal(disconnectedDb.prepare("SELECT COUNT(*) AS count FROM office_worker_integrations WHERE id = 'integration-1'").get().count, 0);
    disconnectedDb.close();

    const briefing = await fetch(`${baseUrl}/api/office/workers/mara-vale/briefings`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ title: "Private weekly briefing", dateLabel: "Friday", summary: "Tenant-specific" })
    });
    assert.equal(briefing.status, 201);
    const briefingDb = new Database(path.join(root, "app.db"));
    const createdBriefing = briefingDb.prepare("SELECT id FROM office_custom_briefings WHERE user_id = ? AND worker_slug = 'mara-vale' AND title = 'Private weekly briefing'").get(user.id);
    briefingDb.close();
    const approveBriefing = await fetch(`${baseUrl}/api/office/workers/mara-vale/briefings/${createdBriefing.id}/action`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ action: "approve" })
    });
    assert.equal(approveBriefing.status, 200);
    const approvedBriefingDb = new Database(path.join(root, "app.db"));
    assert.equal(approvedBriefingDb.prepare("SELECT COUNT(*) AS count FROM office_custom_briefings WHERE id = ?").get(createdBriefing.id).count, 0);
    approvedBriefingDb.close();

    const upload = await fetch(`${baseUrl}/api/office/workers/mara-vale/files`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ name: "private.txt", type: "text/plain", contentBase64: Buffer.from("private customer data").toString("base64") })
    });
    assert.equal(upload.status, 201);

    const exportResponse = await fetch(`${baseUrl}/api/account/export`, { headers: { cookie } });
    assert.equal(exportResponse.status, 200);
    const exported = await exportResponse.json();
    assert.equal(exported.account.email, "api-test@example.com");
    assert.equal(exported.user_onboarding[0].brand_name, "Private Brand");
    assert.equal(exported.mara_commercial_outcomes[0].revenue_amount, 500);
    assert.equal(exported.mara_creative_analyses[0].asset_ref, "private-video-1");
    assert.equal("sessions" in exported, false);
    assert.equal("password_reset_tokens" in exported, false);

    const files = await import("node:fs/promises");
    const userDir = path.join(root, "office-uploads", user.id);
    const [storedName] = await files.readdir(userDir);
    assert.ok(storedName.endsWith("private.txt"));

    const deletion = await fetch(`${baseUrl}/api/account/delete`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie },
      body: JSON.stringify({ password: "correct-horse-123" })
    });
    assert.equal(deletion.status, 200, `${await deletion.text()}\n${serverErrors}`);
    await assert.rejects(access(path.join(userDir, storedName)));
    const erasedDb = new Database(path.join(root, "app.db"));
    assert.equal(erasedDb.prepare("SELECT COUNT(*) AS count FROM mara_commercial_outcomes WHERE user_id = ?").get(user.id).count, 0);
    assert.equal(erasedDb.prepare("SELECT COUNT(*) AS count FROM mara_creative_analyses WHERE user_id = ?").get(user.id).count, 0);
    assert.equal(erasedDb.prepare("SELECT COUNT(*) AS count FROM external_action_executions WHERE user_id = ?").get(user.id).count, 0);
    erasedDb.close();
  } finally {
    child.kill("SIGINT");
    await new Promise((resolve) => child.once("exit", resolve));
    await rm(root, { recursive: true, force: true });
  }
});
