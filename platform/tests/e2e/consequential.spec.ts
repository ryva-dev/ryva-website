import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { loadConfig } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";

const password = "Synthetic!Passphrase2026";

async function captureIncrement6(page: Page, fileName: string, fullPage = false): Promise<void> {
  if (process.env.CAPTURE_INCREMENT_6_SCREENSHOTS !== "1") return;
  const path = fileURLToPath(new URL(`../../docs/ui-redesign-spec/screenshots/increment-6/${fileName}`, import.meta.url));
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage, animations: "disabled" });
}

async function signIn(page: Page, email = "active@synthetic.ryva.test"): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)|Your Ryva Pro access/ })).toBeVisible();
}

async function identity(email: string): Promise<{ userId: string; workspaceId: string }> {
  const database = createDatabase(loadConfig(process.env));
  try {
    const result = await database.query<{ userId: string; workspaceId: string }>(
      `SELECT u.id AS "userId",m.workspace_id AS "workspaceId"
         FROM users u JOIN workspace_memberships m ON m.user_id=u.id
        WHERE u.email=$1 AND m.status='active' LIMIT 1`,
      [email]
    );
    if (!result.rows[0]) throw new Error(`Synthetic identity ${email} is unavailable.`);
    return result.rows[0];
  } finally {
    await database.end();
  }
}

async function seedSuggestion(
  email: string,
  suffix: string,
  status: "generated" | "accepted" = "generated"
): Promise<{ suggestionId: string; title: string }> {
  const database = createDatabase(loadConfig(process.env));
  const owner = await identity(email);
  const runId = randomUUID();
  const contextId = randomUUID();
  const suggestionId = randomUUID();
  const citedStatementId = randomUUID();
  const unknownStatementId = randomUUID();
  const title = `Synthetic consequential suggestion ${suffix}`;
  const digest = (value: string) => createHash("sha256").update(value).digest("hex");
  try {
    await database.query(
      `INSERT INTO ai_runs
        (id,workspace_id,requesting_user_id,use_case,target_type,target_id,user_instruction,
         prompt_template_key,prompt_template_version,policy_version,request_digest,context_digest,
         status,provider,model,model_version,provider_retention_mode,provider_training_allowed,
         input_tokens,output_tokens,cost_minor_units,cost_currency,latency_ms,started_at,completed_at)
       VALUES($1,$2,$3,'next_best_action','workspace',$2::uuid::text,'Review stored facts only.',
         'responsible-ai.next-action',1,'ryva-ai-policy-v1',$4,$5,'succeeded',
         'synthetic-evaluation-provider','synthetic-review-model','evaluation-v1',
         'not_applicable',false,80,45,0,'USD',15,now()-interval '5 minutes',now()-interval '5 minutes')`,
      [runId, owner.workspaceId, owner.userId, digest(`${suffix}-request`), digest(`${suffix}-context`)]
    );
    await database.query(
      `INSERT INTO ai_run_context_items
        (id,workspace_id,run_id,record_type,record_id,label,evidence_class,freshness_at,
         limitations,permitted_use,content_excerpt,content_digest,ordinal)
       VALUES($1,$2,$3,'workspace',$2::uuid::text,'Synthetic consequential evidence','direct_evidence',now(),
         'Synthetic interface fixture only.','Internal review only.',
         'A stored operational fact supports one bounded statement.',$4,1)`,
      [contextId, owner.workspaceId, runId, digest(`${suffix}-excerpt`)]
    );
    await database.query(
      `INSERT INTO ai_suggestions
        (id,workspace_id,run_id,requesting_user_id,suggestion_type,target_type,target_id,title,
         original_content,structured_payload,confidence,confidence_subject,limitations,
         missing_evidence,contrary_evidence,status,generated_at,current_content,version)
       VALUES($1,$2,$3,$4,'next_best_action','workspace',$2::uuid::text,$5,
         'Review the documented relationship before choosing a next action.',
         '{"fixture":true}'::jsonb,'limited','next human action',
         ARRAY['Synthetic fixture only; no commercial conclusion.'],
         ARRAY['Current authority decision'],ARRAY['No negative evidence is stored.'],$6,
         now()-interval '5 minutes','Review the documented relationship before choosing a next action.',1)`,
      [suggestionId, owner.workspaceId, runId, owner.userId, title, status]
    );
    await database.query(
      `INSERT INTO ai_suggestion_statements
        (id,workspace_id,suggestion_id,statement_text,classification,confidence,ordinal)
       VALUES
        ($1,$2,$3,'One stored fact is available for human review.','direct_evidence','supported',1),
        ($4,$2,$3,'The appropriate commercial outcome is unknown.','unknown','insufficient',2)`,
      [citedStatementId, owner.workspaceId, suggestionId, unknownStatementId]
    );
    await database.query(
      `INSERT INTO ai_statement_context_links(workspace_id,statement_id,context_item_id)
       VALUES($1,$2,$3)`,
      [owner.workspaceId, citedStatementId, contextId]
    );
    if (status === "accepted") {
      await database.query(
        `INSERT INTO ai_suggestion_actions
          (id,workspace_id,suggestion_id,actor_user_id,action,original_content,final_content,
           reason_category,note,selected_fields)
         VALUES($1,$2,$3,$4,'accepted','Review the documented relationship before choosing a next action.',
           'Review the documented relationship before choosing a next action.','review_only',
           'Accepted as reviewed content only; no target state changed.',ARRAY[]::text[])`,
        [randomUUID(), owner.workspaceId, suggestionId, owner.userId]
      );
    }
    return { suggestionId, title };
  } finally {
    await database.end();
  }
}

async function bumpSuggestionVersion(suggestionId: string): Promise<void> {
  const database = createDatabase(loadConfig(process.env));
  try {
    await database.query("UPDATE ai_suggestions SET version=version+1 WHERE id=$1", [suggestionId]);
  } finally {
    await database.end();
  }
}

async function seedProtection(
  suffix: string,
  status: "pending" | "active" = "pending"
): Promise<{ protectedAccountId: string; title: string }> {
  const database = createDatabase(loadConfig(process.env));
  const owner = await identity("active@synthetic.ryva.test");
  const brandId = randomUUID();
  const productId = randomUUID();
  const businessId = randomUUID();
  const agreementId = randomUUID();
  const agreementApprovalId = randomUUID();
  const documentId = randomUUID();
  const decisionId = randomUUID();
  const placementId = randomUUID();
  const accountId = randomUUID();
  const protectedAccountId = randomUUID();
  const protectionApprovalId = randomUUID();
  const brandName = `Synthetic Juniper Brand ${suffix}`;
  const businessName = `Synthetic Harbor Buyer ${suffix}`;
  const title = `${brandName} → ${businessName}`;
  try {
    await database.query(
      `INSERT INTO brands(id,workspace_id,public_name,identity_status,status,owner_user_id)
       VALUES($1,$2,$3,'verified','active',$4)`,
      [brandId, owner.workspaceId, brandName, owner.userId]
    );
    await database.query(
      `INSERT INTO products(id,workspace_id,brand_id,name,category,identity_status,status,owner_user_id)
       VALUES($1,$2,$3,$4,'Gift','verified','qualified',$5)`,
      [productId, owner.workspaceId, brandId, `Synthetic scoped Product ${suffix}`, owner.userId]
    );
    await database.query(
      `INSERT INTO businesses(id,workspace_id,name,business_type,category,status,owner_user_id,qualification_status)
       VALUES($1,$2,$3,'gift_shop','Gift','qualified',$4,'qualified')`,
      [businessId, owner.workspaceId, businessName, owner.userId]
    );
    await database.query(
      `INSERT INTO documents
        (id,workspace_id,subject_type,subject_id,owner_user_id,name,document_type,media_type,
         byte_size,storage_key,sha256,scan_status,confidentiality,status)
       VALUES($1,$2,'representation_agreement',$3,$4,$5,'representation_agreement_original',
         'application/pdf',100,$6,$7,'clean','restricted','active')`,
      [documentId, owner.workspaceId, agreementId, owner.userId, `synthetic-protection-${suffix}.pdf`, `${owner.workspaceId}/${documentId}/original`, "a".repeat(64)]
    );
    await database.query(
      `INSERT INTO human_approvals
        (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,approver_user_id,status,scope,decided_at)
       VALUES($1,$2,'representation_agreement',$3,'activate_authority',$4,$5,'approved','Synthetic exact Agreement scope',now())`,
      [agreementApprovalId, owner.workspaceId, agreementId, `agreement-${suffix}`, owner.userId]
    );
    await database.query(
      `INSERT INTO representation_agreements
        (id,workspace_id,brand_id,representative_user_id,status,source_document_id,effective_at,
         expires_at,channels,territory_scope,authority_summary,commission_basis,commission_rate,
         commission_currency,commission_timing,opening_order_rights,reorder_rights,
         protected_account_rules,house_account_rules,termination_terms,
         post_termination_commission_rights,legal_ambiguity_status,approval_id,authority_digest,
         approved_by,approved_at)
       VALUES($1,$2,$3,$4,'active',$5,'2026-01-01','2028-01-01',ARRAY['independent_retail'],
         '{"countries":["US"]}','Synthetic scoped authority only.','Eligible net wholesale',0.12,
         'USD','After cleared payment','Opening Orders documented.','Reorders documented.',
         'One year only.','Written exclusions only.','Written notice.','Accepted Orders survive.',
         'none',$6,$7,$4,now())`,
      [agreementId, owner.workspaceId, brandId, owner.userId, documentId, agreementApprovalId, `agreement-${suffix}`]
    );
    await database.query(
      `INSERT INTO representation_agreement_products(agreement_id,workspace_id,product_id,scope_notes)
       VALUES($1,$2,$3,'Synthetic exact scope')`,
      [agreementId, owner.workspaceId, productId]
    );
    await database.query(
      `INSERT INTO decision_records
        (id,workspace_id,subject_type,subject_id,question,scope,outcome,rationale,confidence,
         owner_user_id,decided_at,next_action,status)
       VALUES($1,$2,'business',$3,'Proceed to Order discussion?','Synthetic fixture','Proceed',
         'Human documented Buyer value.','supported',$4,now(),'Verify Order','issued')`,
      [decisionId, owner.workspaceId, businessId, owner.userId]
    );
    await database.query(
      `INSERT INTO placement_opportunities
        (id,workspace_id,agreement_id,brand_id,business_id,owner_user_id,stage,match_thesis,
         buyer_value_basis,evidence_confidence,decision_id,conflict_status,authority_channel)
       VALUES($1,$2,$3,$4,$5,$6,'active_account','Synthetic documented match.',
         'Synthetic Buyer value.','supported',$7,'clear','independent_retail')`,
      [placementId, owner.workspaceId, agreementId, brandId, businessId, owner.userId, decisionId]
    );
    await database.query(
      `INSERT INTO placement_opportunity_products(placement_opportunity_id,workspace_id,product_id)
       VALUES($1,$2,$3)`,
      [placementId, owner.workspaceId, productId]
    );
    await database.query(
      `INSERT INTO accounts
        (id,workspace_id,brand_id,business_id,representative_user_id,owner_user_id,agreement_id,
         placement_opportunity_id,status,health,health_rationale,opened_at)
       VALUES($1,$2,$3,$4,$5,$5,$6,$7,'active','healthy','Synthetic account fixture is current.',now())`,
      [accountId, owner.workspaceId, brandId, businessId, owner.userId, agreementId, placementId]
    );
    if (status === "active") {
      await database.query(
        `INSERT INTO human_approvals
          (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,approver_user_id,
           status,scope,conditions,decided_at)
         VALUES($1,$2,'protected_account',$3,'activate_protection',$4,$5,'approved',
           'Exact synthetic protection scope','Synthetic documented scope only.',now())`,
        [protectionApprovalId, owner.workspaceId, protectedAccountId, `rights-${suffix}`, owner.userId]
      );
    }
    await database.query(
      `INSERT INTO protected_accounts
        (id,workspace_id,account_id,brand_id,business_id,representative_user_id,agreement_id,
         placement_opportunity_id,basis_document_id,origin_date,approval_date,approved_by,
         approval_id,scope_summary,product_ids,channels,territory_scope,protection_starts_on,
         protection_ends_on,protection_term,commission_rights,reorder_rights,
         house_account_exclusions,release_terms,status,rights_digest,supporting_basis_status,
         human_confirmed)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'2026-07-15',$10,$11,$12,
         'The documented Business, Product, independent retail channel, US territory, and one-year term.',
         ARRAY[$13::uuid],ARRAY['independent_retail'],'{"countries":["US"]}',
         '2026-07-15','2027-07-15','One documented year','12% of eligible net wholesale.',
         'Reorders during the written term are commissionable.','Only written exclusions apply.',
         'Release requires documented human action.',$14,$15,'documented',$16)`,
      [protectedAccountId, owner.workspaceId, accountId, brandId, businessId, owner.userId,
        agreementId, placementId, documentId, status === "active" ? "2026-07-21" : null,
        status === "active" ? owner.userId : null, status === "active" ? protectionApprovalId : null,
        productId, status, `rights-${suffix}`, status === "active"]
    );
    await database.query(
      `INSERT INTO commercial_document_links(workspace_id,subject_type,subject_id,document_id,purpose,linked_by)
       VALUES($1,'protected_account',$2,$3,'rights_basis',$4)`,
      [owner.workspaceId, protectedAccountId, documentId, owner.userId]
    );
    await database.query(
      `INSERT INTO commercial_events
        (id,workspace_id,subject_type,subject_id,event_type,actor_user_id,origin,reason,request_id)
       VALUES($1,$2,'protected_account',$3,$4,$5,'user',$6,$7)`,
      [randomUUID(), owner.workspaceId, protectedAccountId, status === "active" ? "protection.approved" : "protection.review_created", owner.userId, status === "active" ? "Human approved exact synthetic scope." : "Synthetic protection proposal created for review.", `e2e-${suffix}`]
    );
    return { protectedAccountId, title };
  } finally {
    await database.end();
  }
}

test("AI suggestion exposes exact artifact and records one explicit human disposition", async ({ page }, testInfo) => {
  const fixture = await seedSuggestion("active@synthetic.ryva.test", `decision-${testInfo.project.name}-${Date.now()}`);
  let submissions = 0;
  page.on("request", (request) => { if (request.url().includes(`/api/ai/suggestions/${fixture.suggestionId}/actions`) && request.method() === "POST") submissions += 1; });
  await signIn(page);
  await page.goto(`/copilot/${fixture.suggestionId}`);
  await expect(page.getByRole("heading", { name: fixture.title, level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Stored suggestion artifact exact content" })).toContainText("Review the documented relationship");
  await expect(page.getByText("Recommendation and validation never create authority.")).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await page.setViewportSize({ width: 390, height: 844 });
    await captureIncrement6(page, "ai-suggestion-mobile-390x844.png", true);
  } else {
    await page.setViewportSize({ width: 1440, height: 900 });
    await captureIncrement6(page, "ai-suggestion-populated-desktop-1440x900.png");
    await page.getByRole("button", { name: "Inspect evidence record" }).click();
    await captureIncrement6(page, "ai-suggestion-validation-blocker-evidence-desktop-1440x900.png");
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.getByRole("radio", { name: "Accept stored artifact" }).check();
  await page.getByLabel("Decision rationale").fill("Human reviewed the exact stored artifact, evidence gaps, and no-target-change boundary.");
  const reviewButton = page.getByRole("button", { name: "Review final consequence" });
  await reviewButton.click();
  const dialog = page.getByRole("alertdialog", { name: "Confirm human disposition" });
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Confirm reviewed content" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(reviewButton).toBeFocused();
  await reviewButton.click();
  await expect(dialog).toContainText("Review the documented relationship before choosing a next action.");
  await dialog.getByRole("button", { name: "Confirm reviewed content" }).dblclick();
  await expect(page.getByRole("heading", { name: "Human disposition recorded" })).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) await captureIncrement6(page, "ai-suggestion-completed-audit-desktop-1440x900.png");
  expect(submissions).toBe(1);
});

test("AI suggestion retains loading identity and preserves input after recoverable validation failure", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Loading and recoverable validation states are exercised once in desktop Chromium.");
  const fixture = await seedSuggestion("active@synthetic.ryva.test", `validation-${Date.now()}`);
  await signIn(page);
  let releaseLoad: (() => Promise<void>) | undefined;
  await page.route(`**/api/ai/suggestions/${fixture.suggestionId}`, (route) => {
    releaseLoad = () => route.continue();
  });
  await page.goto(`/copilot/${fixture.suggestionId}`, { waitUntil: "commit" });
  await expect(page.getByRole("heading", { name: "Loading suggestion", level: 1 })).toBeVisible();
  await releaseLoad?.();
  await page.unroute(`**/api/ai/suggestions/${fixture.suggestionId}`);
  await expect(page.getByRole("heading", { name: fixture.title, level: 1 })).toBeVisible();

  const revision = "Human revision retained after a recoverable server validation failure.";
  const rationale = "The reviewer must be able to correct the issue without re-entering this rationale.";
  await page.getByLabel("Exact human revision").fill(revision);
  await page.getByRole("radio", { name: "Save human revision" }).check();
  await page.getByLabel("Decision rationale").fill(rationale);
  await page.route(`**/api/ai/suggestions/${fixture.suggestionId}/actions`, async (route) => { await route.fulfill({ status: 422, contentType: "application/problem+json", body: JSON.stringify({ title: "Review validation failed", detail: "Synthetic review validation requires correction." }) }); });
  await page.getByRole("button", { name: "Review final consequence" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm reviewed content" }).click();
  await expect(page.locator("[data-review-error]")).toBeFocused();
  await expect(page.getByLabel("Exact human revision")).toHaveValue(revision);
  await expect(page.getByLabel("Decision rationale")).toHaveValue(rationale);
});

test("AI suggestion preserves revision and rationale when the loaded version is stale", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Conflict behavior is exercised once in desktop Chromium.");
  const fixture = await seedSuggestion("active@synthetic.ryva.test", `conflict-${Date.now()}`);
  await signIn(page);
  await page.goto(`/copilot/${fixture.suggestionId}`);
  const revision = "Human revision retained after an optimistic concurrency conflict.";
  const rationale = "Preserve this rationale while the reviewer reconciles the new server version.";
  await page.getByLabel("Exact human revision").fill(revision);
  await page.getByRole("radio", { name: "Save human revision" }).check();
  await page.getByLabel("Decision rationale").fill(rationale);
  await bumpSuggestionVersion(fixture.suggestionId);
  await page.getByRole("button", { name: "Review final consequence" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm reviewed content" }).click();
  await expect(page.locator("[data-review-error]")).toBeFocused();
  await expect(page.getByLabel("Exact human revision")).toHaveValue(revision);
  await expect(page.getByLabel("Decision rationale")).toHaveValue(rationale);
});

test("AI suggestion retains identity in loading, error, completed, and restricted states", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "State matrix is exercised once in desktop Chromium.");
  const completed = await seedSuggestion("active@synthetic.ryva.test", `completed-${Date.now()}`, "accepted");
  const restricted = await seedSuggestion("grace@synthetic.ryva.test", `restricted-${Date.now()}`);
  await signIn(page);
  await page.goto(`/copilot/${completed.suggestionId}`);
  await expect(page.getByRole("heading", { name: "Human disposition recorded" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Accept stored artifact" })).toHaveCount(0);

  const failedId = randomUUID();
  await page.route(`**/api/ai/suggestions/${failedId}`, async (route) => route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ title: "Suggestion unavailable", detail: "Synthetic consequential review failure." }) }));
  await page.goto(`/copilot/${failedId}`);
  await expect(page.getByRole("heading", { name: "Suggestion unavailable", level: 1 })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Synthetic consequential review failure");
  await page.setViewportSize({ width: 1440, height: 900 });
  await captureIncrement6(page, "ai-suggestion-error-desktop-1440x900.png");

  await page.context().clearCookies();
  await signIn(page, "grace@synthetic.ryva.test");
  await page.goto(`/copilot/${restricted.suggestionId}`);
  await expect(page.getByText("Read-only consequential review")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Accept stored artifact" })).toBeDisabled();
});

test("Protected Account proposal becomes active only after exact-scope human confirmation", async ({ page }, testInfo) => {
  const fixture = await seedProtection(`proposal-${testInfo.project.name}-${Date.now()}`);
  await signIn(page);
  await page.goto(`/protected-accounts/${fixture.protectedAccountId}`);
  await expect(page.getByRole("heading", { name: fixture.title, level: 1 })).toBeVisible();
  await expect(page.getByText("Pending scope is a review record only and creates no rights.")).toBeVisible();
  await expect(page.getByText("The Agreement reference and relationship do not independently establish current authority on this page.")).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await page.setViewportSize({ width: 390, height: 844 });
    await captureIncrement6(page, "protected-account-proposed-mobile-390x844.png", true);
  } else {
    await page.setViewportSize({ width: 1440, height: 900 });
    await captureIncrement6(page, "protected-account-proposed-desktop-1440x900.png");
  }
  await page.getByRole("button", { name: "Request exact-scope approval" }).click();
  await expect(page.getByRole("heading", { name: "Record the human protection decision" })).toBeVisible();
  await page.getByRole("radio", { name: "Approve exact scope" }).check();
  await page.getByLabel("Decision rationale or conditions").fill("Human approves only the exact documentary scope and digest displayed in this review.");
  await page.getByRole("button", { name: "Review final consequence" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Confirm documentary protection decision" });
  await expect(dialog).toContainText("The server may activate only the exact displayed scope");
  await dialog.getByRole("button", { name: "Confirm exact-scope approval" }).click();
  await expect(page.getByRole("heading", { name: "Documentary protection activated" })).toBeVisible();
  await expect(page.getByText("Ryva created no independent contractual right.")).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) await captureIncrement6(page, "protected-account-completed-audit-desktop-1440x900.png");
});

test("completed Protected Account remains an auditable consequence, not inferred authority", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Completed state is exercised once in desktop Chromium.");
  const fixture = await seedProtection(`active-${Date.now()}`, "active");
  await signIn(page);
  await page.goto(`/protected-accounts/${fixture.protectedAccountId}`);
  await expect(page.getByRole("heading", { name: "Documentary protection activated" })).toBeVisible();
  await expect(page.getByText("The Agreement reference and relationship do not independently establish current authority on this page.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Request exact-scope approval" })).toHaveCount(0);
});

test("Consequential Review reflows at all approved widths without clipped decisions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Exact CSS widths run once in desktop Chromium.");
  const suggestion = await seedSuggestion("active@synthetic.ryva.test", `geometry-${Date.now()}`);
  const protection = await seedProtection(`geometry-${Date.now()}`);
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  for (const viewport of [
    { width: 1440, height: 900 }, { width: 1024, height: 768 },
    { width: 390, height: 844 }, { width: 375, height: 812 }, { width: 320, height: 568 }
  ]) {
    await page.setViewportSize(viewport);
    for (const path of [`/copilot/${suggestion.suggestionId}`, `/protected-accounts/${protection.protectedAccountId}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const geometry = await page.evaluate(`(() => {
        const width = window.visualViewport?.width ?? window.innerWidth;
        const offenders = [];
        for (const element of document.querySelectorAll("#main-content *, .ry-mobile-bottom-nav > *")) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && (rect.left < -0.5 || rect.right > width + 0.5)) offenders.push({ tag: element.tagName, className: String(element.className), text: String(element.textContent || "").trim().slice(0, 80), left: rect.left, right: rect.right });
        }
        return { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, offenders };
      })()`) as { clientWidth: number; scrollWidth: number; offenders: unknown[] };
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
      expect(geometry.offenders, `${path} at ${viewport.width}x${viewport.height}`).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
});
