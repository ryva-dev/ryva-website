import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { loadConfig } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";

const password = "Synthetic!Passphrase2026";

async function captureIncrement11(page: Page, fileName: string, fullPage = false): Promise<void> {
  if (process.env.CAPTURE_INCREMENT_11_SCREENSHOTS !== "1") return;
  const path = fileURLToPath(new URL(`../../docs/ui-redesign-spec/screenshots/increment-11/${fileName}`, import.meta.url));
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage, animations: "disabled" });
}

async function signIn(page: Page, email = "active@synthetic.ryva.test"): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

async function expectNoMainOverflow(page: Page): Promise<void> {
  const width = await page.evaluate(`({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  })`) as { viewport: number; document: number };
  expect(width.document).toBeLessThanOrEqual(width.viewport + 1);
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

async function seedAgreement(
  suffix: string,
  status: "draft" | "active" = "draft"
): Promise<{ agreementId: string; brandName: string; opportunityId: string }> {
  const database = createDatabase(loadConfig(process.env));
  const owner = await identity("active@synthetic.ryva.test");
  const brandId = randomUUID();
  const productId = randomUUID();
  const agreementId = randomUUID();
  const documentId = randomUUID();
  const opportunityId = randomUUID();
  const approvalId = randomUUID();
  const brandName = `Increment11 Brand ${suffix}`;
  try {
    await database.query(
      `INSERT INTO brands(id,workspace_id,public_name,identity_status,status,owner_user_id)
       VALUES($1,$2,$3,'verified','active',$4)`,
      [brandId, owner.workspaceId, brandName, owner.userId]
    );
    await database.query(
      `INSERT INTO products(id,workspace_id,brand_id,name,category,identity_status,status,owner_user_id)
       VALUES($1,$2,$3,$4,'Gift','verified','qualified',$5)`,
      [productId, owner.workspaceId, brandId, `Increment11 Product ${suffix}`, owner.userId]
    );
    await database.query(
      `INSERT INTO representation_opportunities
        (id,workspace_id,brand_id,owner_user_id,stage,proposed_channels,proposed_territory,brand_objectives,terms_summary)
       VALUES($1,$2,$3,$4,'reviewing_terms',ARRAY['independent_retail'],'{"description":"United States"}','Synthetic objectives.','')`,
      [opportunityId, owner.workspaceId, brandId, owner.userId]
    );
    await database.query(
      `INSERT INTO representation_opportunity_products(opportunity_id,workspace_id,product_id)
       VALUES($1,$2,$3)`,
      [opportunityId, owner.workspaceId, productId]
    );
    await database.query(
      `INSERT INTO documents
        (id,workspace_id,subject_type,subject_id,owner_user_id,name,document_type,media_type,
         byte_size,storage_key,sha256,scan_status,confidentiality,status)
       VALUES($1,$2,'representation_agreement',$3,$4,$5,'representation_agreement_original',
         'application/pdf',100,$6,$7,'clean','restricted','active')`,
      [documentId, owner.workspaceId, agreementId, owner.userId, `increment11-${suffix}.pdf`, `${owner.workspaceId}/${documentId}/original`, "b".repeat(64)]
    );
    if (status === "active") {
      await database.query(
        `INSERT INTO human_approvals
          (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,approver_user_id,status,scope,decided_at)
         VALUES($1,$2,'representation_agreement',$3,'activate_representation_agreement',$4,$5,'approved','Exact Agreement scope',now())`,
        [approvalId, owner.workspaceId, agreementId, `agreement-${suffix}`, owner.userId]
      );
    }
    await database.query(
      `INSERT INTO representation_agreements
        (id,workspace_id,brand_id,representative_user_id,status,source_document_id,effective_at,
         expires_at,channels,territory_scope,authority_summary,commission_basis,commission_rate,
         commission_currency,commission_timing,opening_order_rights,reorder_rights,
         protected_account_rules,house_account_rules,termination_terms,
         post_termination_commission_rights,legal_ambiguity_status,approval_id,authority_digest,
         approved_by,approved_at,representation_opportunity_id)
       VALUES($1,$2,$3,$4,$5,$6,'2026-01-01','2028-01-01',ARRAY['independent_retail'],
         '{"countries":["US"]}','Scoped authority only.','Eligible net wholesale',0.12,
         'USD','After cleared payment','Opening Orders documented.','Reorders documented.',
         'One year only.','Written exclusions only.','Written notice.','Accepted Orders survive.',
         'none',$7,$8,$9,$10,$11)`,
      [
        agreementId,
        owner.workspaceId,
        brandId,
        owner.userId,
        status,
        documentId,
        status === "active" ? approvalId : null,
        status === "active" ? `agreement-${suffix}` : null,
        status === "active" ? owner.userId : null,
        status === "active" ? new Date().toISOString() : null,
        opportunityId
      ]
    );
    await database.query(
      `INSERT INTO representation_agreement_products(agreement_id,workspace_id,product_id,scope_notes)
       VALUES($1,$2,$3,'Exact Product scope')`,
      [agreementId, owner.workspaceId, productId]
    );
    return { agreementId, brandName, opportunityId };
  } finally {
    await database.end();
  }
}

async function seedBlockedAgreement(suffix: string): Promise<{ agreementId: string; brandName: string }> {
  const fixture = await seedAgreement(`blocked-${suffix}`, "draft");
  const database = createDatabase(loadConfig(process.env));
  try {
    await database.query(
      `UPDATE representation_agreements SET effective_at=NULL, channels='{}' WHERE id=$1`,
      [fixture.agreementId]
    );
    await database.query(`DELETE FROM representation_agreement_products WHERE agreement_id=$1`, [fixture.agreementId]);
    return { agreementId: fixture.agreementId, brandName: fixture.brandName };
  } finally {
    await database.end();
  }
}

test("Representation register preserves opportunity and Agreement distinctions", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await signIn(page);
  await page.goto("/representation");
  await expect(page.getByRole("heading", { name: "Representation", exact: true })).toBeVisible();
  await expect(page.getByText(/uploaded agreement as permission/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Representation Opportunities" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Representation Agreements" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open a Representation Opportunity" })).toBeVisible();
  await expect(page.getByLabel("Contact Ready Brand")).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement11(page, "representation-register-populated-desktop-1440x900.png", true);
  }
  await expectNoMainOverflow(page);
  expect(consoleErrors).toEqual([]);
});

test("Representation register mobile rows remain usable without document overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile layout coverage runs on the mobile project.");
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/representation");
  await expect(page.getByRole("heading", { name: "Representation", exact: true })).toBeVisible();
  await expectNoMainOverflow(page);
  await captureIncrement11(page, "representation-register-populated-mobile-390x844.png", true);
});

test("read-only Representation sessions expose restricted messaging", async ({ page }) => {
  await signIn(page, "grace@synthetic.ryva.test");
  await page.goto("/representation");
  await expect(page.getByRole("heading", { name: "Representation", exact: true })).toBeVisible();
  await expect(page.getByText("Read-only Representation workspace")).toBeVisible();
  await captureIncrement11(page, "representation-register-restricted-desktop-1440x900.png", true);
});

test("empty Representation view stays honest without fabricated authority", async ({ page }) => {
  await signIn(page, "canceled-paid@synthetic.ryva.test");
  await page.goto("/representation");
  await expect(page.getByRole("heading", { name: "Representation", exact: true })).toBeVisible();
  await expect(page.getByText("No Representation Opportunities yet. A Brand must be Contact Ready first.")).toBeVisible();
  await expect(page.getByText("No Agreements have been created.")).toBeVisible();
  await captureIncrement11(page, "representation-register-empty-desktop-1440x900.png", true);
});

test("Product Brand Buyer Contact generic routes remain working alongside Representation", async ({ page }) => {
  await signIn(page);
  await page.goto("/records/product");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  await page.goto("/records/brand");
  await expect(page.getByRole("heading", { name: "Brand Intelligence" })).toBeVisible();
  await page.goto("/records/business");
  await expect(page.getByRole("heading", { name: "Buyer Intelligence" })).toBeVisible();
  await page.goto("/records/contact");
  await expect(page.getByRole("heading", { name: "Contact register", exact: true })).toBeVisible();
  await page.goto("/representation");
  await expect(page.getByRole("heading", { name: "Representation", exact: true })).toBeVisible();
});

test("Agreement consequential review preserves exact-artifact and authority boundaries", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const isMobile = testInfo.project.name.includes("mobile");
  const fixture = await seedAgreement(suffix, "draft");
  await signIn(page);
  await page.goto(`/agreements/${fixture.agreementId}`);
  await expect(page.getByRole("heading", { name: `${fixture.brandName} Agreement` })).toBeVisible();
  await expect(page.getByText(/Material terms are evidence-linked.*exact-artifact human approval/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Proposed material terms scope" })).toBeVisible();
  await expect(page.getByText(/does not independently establish|creates no authority|Draft\/Reviewing/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Request exact-scope approval" })).toBeVisible();
  if (isMobile) {
    await captureIncrement11(page, "agreement-review-draft-mobile-390x844.png", true);
  } else {
    await captureIncrement11(page, "agreement-review-exact-artifact-desktop-1440x900.png", true);
  }
  await expectNoMainOverflow(page);
});

test("active Agreement shows audited outcome without presenting draft as authority", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Active Agreement audit screenshot uses desktop.");
  const suffix = `active-${testInfo.project.name}-${Date.now()}`;
  const fixture = await seedAgreement(suffix, "active");
  await signIn(page);
  await page.goto(`/agreements/${fixture.agreementId}`);
  await expect(page.getByRole("heading", { name: "Representation authority activated" })).toBeVisible();
  await expect(page.getByText(/Only the exact scope identified by digest/i)).toBeVisible();
  await captureIncrement11(page, "agreement-review-completed-audit-desktop-1440x900.png", true);
});

test("blocked Agreement review surfaces validation failures without fabricating authority", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Blocked validation screenshot uses desktop.");
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const fixture = await seedBlockedAgreement(suffix);
  await signIn(page);
  await page.goto(`/agreements/${fixture.agreementId}`);
  await expect(page.getByText(/Effective date, at least one Product, and at least one channel are required/i)).toBeVisible();
  await expect(page.getByText(/Draft, reviewing, and pending states create no authority/i)).toBeVisible();
  await captureIncrement11(page, "agreement-review-blocker-validation-desktop-1440x900.png", true);
});

test("Representation detail preserves readiness and upload-not-authority boundaries", async ({ page }, testInfo) => {
  const suffix = `detail-${testInfo.project.name}-${Date.now()}`;
  const fixture = await seedAgreement(suffix, "draft");
  const isMobile = testInfo.project.name.includes("mobile");
  await signIn(page);
  await page.goto(`/representation/${fixture.opportunityId}`);
  await expect(page.getByText(/Written terms, original documents|Uploading does not create authority/i).first()).toBeVisible();
  if (isMobile) {
    await page.getByRole("button", { name: "Review context" }).click();
    await expect(page.getByRole("dialog").getByText(/uploaded original never establishes representation authority/i)).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByText(/uploaded original never establishes representation authority/i)).toBeVisible();
  }
  await captureIncrement11(page, isMobile
    ? "representation-detail-populated-mobile-390x844.png"
    : "representation-detail-populated-desktop-1440x900.png", true);
  await page.getByRole("tab", { name: /Scope/i }).click();
  await expect(page.getByRole("heading", { name: "Proposed scope" })).toBeVisible();
  await expect(page.getByText(/not a written Agreement scope/i)).toBeVisible();
  if (!isMobile) {
    await captureIncrement11(page, "representation-detail-scope-desktop-1440x900.png", true);
  }
  await page.getByRole("tab", { name: /Agreements & Documents/i }).click();
  await expect(page.getByText(/Uploading does not create authority/i)).toBeVisible();
  await expect(page.getByText(/never active representation authority by itself/i)).toBeVisible();
  if (!isMobile) {
    await captureIncrement11(page, "representation-detail-readiness-documents-desktop-1440x900.png", true);
  }
  await expectNoMainOverflow(page);
});
