import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { loadConfig } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";

const password = "Synthetic!Passphrase2026";

async function captureIncrement12(page: Page, fileName: string, fullPage = false): Promise<void> {
  if (process.env.CAPTURE_INCREMENT_12_SCREENSHOTS !== "1") return;
  const path = fileURLToPath(new URL(`../../docs/ui-redesign-spec/screenshots/increment-12/${fileName}`, import.meta.url));
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

async function seedPlacement(
  suffix: string,
  stage: "identified" | "qualified" | "prepared" = "identified"
): Promise<{ placementId: string; brandName: string; businessName: string; title: string }> {
  const database = createDatabase(loadConfig(process.env));
  const owner = await identity("active@synthetic.ryva.test");
  const brandId = randomUUID();
  const productId = randomUUID();
  const businessId = randomUUID();
  const agreementId = randomUUID();
  const agreementApprovalId = randomUUID();
  const documentId = randomUUID();
  const decisionId = randomUUID();
  const taskId = randomUUID();
  const placementId = randomUUID();
  const brandName = `Increment12 Brand ${suffix}`;
  const businessName = `Increment12 Business ${suffix}`;
  try {
    await database.query(
      `INSERT INTO brands(id,workspace_id,public_name,identity_status,status,owner_user_id)
       VALUES($1,$2,$3,'verified','active',$4)`,
      [brandId, owner.workspaceId, brandName, owner.userId]
    );
    await database.query(
      `INSERT INTO products(id,workspace_id,brand_id,name,category,identity_status,status,owner_user_id)
       VALUES($1,$2,$3,$4,'Gift','verified','qualified',$5)`,
      [productId, owner.workspaceId, brandId, `Increment12 Product ${suffix}`, owner.userId]
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
      [documentId, owner.workspaceId, agreementId, owner.userId, `increment12-${suffix}.pdf`, `${owner.workspaceId}/${documentId}/original`, "c".repeat(64)]
    );
    await database.query(
      `INSERT INTO human_approvals
        (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,approver_user_id,status,scope,decided_at)
       VALUES($1,$2,'representation_agreement',$3,'activate_representation_agreement',$4,$5,'approved','Exact Agreement scope',now())`,
      [agreementApprovalId, owner.workspaceId, agreementId, `placement-agreement-${suffix}`, owner.userId]
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
         '{"countries":["US"]}','Scoped placement authority only.','Eligible net wholesale',0.12,
         'USD','After cleared payment','Opening Orders documented.','Reorders documented.',
         'One year only.','Written exclusions only.','Written notice.','Accepted Orders survive.',
         'none',$6,$7,$4,now())`,
      [agreementId, owner.workspaceId, brandId, owner.userId, documentId, agreementApprovalId, `placement-agreement-${suffix}`]
    );
    await database.query(
      `INSERT INTO representation_agreement_products(agreement_id,workspace_id,product_id,scope_notes)
       VALUES($1,$2,$3,'Exact Product scope')`,
      [agreementId, owner.workspaceId, productId]
    );
    await database.query(
      `INSERT INTO decision_records
        (id,workspace_id,subject_type,subject_id,question,scope,outcome,rationale,confidence,
         owner_user_id,decided_at,next_action,status)
       VALUES($1,$2,'business',$3,'Advance Placement?','Synthetic fixture','Proceed',
         'Human documented Buyer value for Placement.','supported',$4,now(),'Prepare outreach','issued')`,
      [decisionId, owner.workspaceId, businessId, owner.userId]
    );
    await database.query(
      `INSERT INTO tasks
        (id,workspace_id,subject_type,subject_id,title,status,owner_user_id,due_at,priority,created_reason)
       VALUES($1,$2,'business',$3,'Prepare authorized Placement next action','open',$4,now()+interval '3 days','medium','Increment 12 Placement fixture')`,
      [taskId, owner.workspaceId, businessId, owner.userId]
    );
    await database.query(
      `INSERT INTO placement_opportunities
        (id,workspace_id,agreement_id,brand_id,business_id,owner_user_id,stage,match_thesis,
         buyer_value_basis,evidence_confidence,decision_id,next_action_task_id,conflict_status)
       VALUES($1,$2,$3,$4,$5,$6,$7,'Documented Product fills a gift assortment need.',
         'Adds a shelf-ready gift option for the Buyer customer need.','supported',$8,$9,'clear')`,
      [placementId, owner.workspaceId, agreementId, brandId, businessId, owner.userId, stage, decisionId, taskId]
    );
    await database.query(
      `INSERT INTO placement_opportunity_products(placement_opportunity_id,workspace_id,product_id)
       VALUES($1,$2,$3)`,
      [placementId, owner.workspaceId, productId]
    );
    await database.query(
      `INSERT INTO relationship_triangle_reviews
        (id,workspace_id,placement_opportunity_id,status,brand_value,brand_obligations,brand_risks,
         brand_warning_signs,buyer_value,buyer_obligations,buyer_risks,buyer_warning_signs,
         representative_value,representative_obligations,representative_risks,representative_warning_signs,
         all_parties_receive_legitimate_value,reviewed_by)
       VALUES($1,$2,$3,'current','Qualified distribution','Fulfill and support','Returns','',
         'Relevant assortment and supported margin','Review terms','Sell-through','',
         'Professional placement opportunity','Accurate claims','Relationship trust','',
         true,$4)`,
      [randomUUID(), owner.workspaceId, placementId, owner.userId]
    );
    await database.query(
      `INSERT INTO placement_stage_events
        (id,workspace_id,placement_opportunity_id,from_stage,to_stage,reason,decision_id,evidence_ids,occurred_at,actor_user_id)
       VALUES($1,$2,$3,NULL,'identified','Placement created for Increment 12 fixture.',$4,ARRAY[]::uuid[],now(),$5)`,
      [randomUUID(), owner.workspaceId, placementId, decisionId, owner.userId]
    );
    return { placementId, brandName, businessName, title: `${brandName} → ${businessName}` };
  } finally {
    await database.end();
  }
}

test("Placement register preserves Table Kanban create and authority copy", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await seedPlacement(`reg-${testInfo.project.name}-${Date.now()}`, "identified");
  await signIn(page);
  await page.goto("/placements");
  await expect(page.getByRole("heading", { name: "Placement Opportunities" })).toBeVisible();
  await expect(page.getByText(/three-party value/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create a Placement Opportunity" })).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Create Placement" }).click();
    await expect(page.getByRole("dialog").getByLabel("Active Agreement")).toBeVisible();
    await expect(page.getByRole("dialog").getByLabel("Concrete Buyer value")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/Brand, Business Buyer, and Representative/i)).toBeVisible();
  } else {
    await expect(page.getByLabel("Active Agreement").first()).toBeVisible();
    await expect(page.getByLabel("Concrete Buyer value").first()).toBeVisible();
    await expect(page.getByText(/Brand, Business Buyer, and Representative/i).first()).toBeVisible();
  }
  if (!testInfo.project.name.includes("mobile")) {
    await expect(page.getByRole("button", { name: "Table" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kanban" })).toBeVisible();
    await captureIncrement12(page, "placement-register-table-desktop-1440x900.png", true);
    await page.getByRole("button", { name: "Kanban" }).click();
    await expect(page.getByText(/Dragging a card opens human stage review/i)).toBeVisible();
    await captureIncrement12(page, "placement-register-kanban-desktop-1440x900.png", true);
    await page.getByRole("button", { name: "Table" }).click();
  }
  await expectNoMainOverflow(page);
  expect(consoleErrors).toEqual([]);
});

test("Placement register mobile uses stage-grouped rows without document overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile stage-grouped coverage runs on the mobile project.");
  await seedPlacement(`mobile-${testInfo.project.name}-${Date.now()}`, "qualified");
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/placements");
  await expect(page.getByRole("heading", { name: "Placement Opportunities" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Qualified|Identified/i }).first()).toBeVisible();
  await captureIncrement12(page, "placement-register-mobile-stage-grouped-390x844.png", true);
  await expectNoMainOverflow(page);
});

test("read-only Placement sessions expose restricted messaging", async ({ page }) => {
  await signIn(page, "grace@synthetic.ryva.test");
  await page.goto("/placements");
  await expect(page.getByRole("heading", { name: "Placement Opportunities" })).toBeVisible();
  await expect(page.getByText("Read-only Placement workspace")).toBeVisible();
  await captureIncrement12(page, "placement-register-restricted-desktop-1440x900.png", true);
});

test("empty Placement view stays honest without fabricated opportunities", async ({ page }) => {
  await signIn(page, "canceled-paid@synthetic.ryva.test");
  await page.goto("/placements");
  await expect(page.getByRole("heading", { name: "Placement Opportunities" })).toBeVisible();
  await expect(page.getByText("No Placement Opportunities. Create one only when authority and Buyer value are supportable.")).toBeVisible();
  await captureIncrement12(page, "placement-register-empty-desktop-1440x900.png", true);
});

test("Representation Product Brand Buyer Contact Outreach and commercial routes remain unchanged beside Placement", async ({ page }) => {
  await signIn(page);
  await page.goto("/representation");
  await expect(page.getByRole("heading", { name: "Representation", exact: true })).toBeVisible();
  await page.goto("/records/product");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  await page.goto("/records/brand");
  await expect(page.getByRole("heading", { name: "Brand Intelligence" })).toBeVisible();
  await page.goto("/records/business");
  await expect(page.getByRole("heading", { name: "Buyer Intelligence" })).toBeVisible();
  await page.goto("/records/contact");
  await expect(page.getByRole("heading", { name: "Contact register", exact: true })).toBeVisible();
  await page.goto("/outreach");
  await expect(page.getByRole("heading", { name: /Outreach/i })).toBeVisible();
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await page.goto("/placements");
  await expect(page.getByRole("heading", { name: "Placement Opportunities" })).toBeVisible();
});

test("Placement detail preserves authority triangle and consequential stage review", async ({ page }, testInfo) => {
  const suffix = `detail-${testInfo.project.name}-${Date.now()}`;
  const fixture = await seedPlacement(suffix, "identified");
  const isMobile = testInfo.project.name.includes("mobile");
  await signIn(page);
  await page.goto(`/placements/${fixture.placementId}`);
  await expect(page.getByRole("heading", { name: fixture.title })).toBeVisible();
  await expect(page.getByText(/Every advancement rechecks authority/i)).toBeVisible();
  if (isMobile) {
    await page.getByRole("button", { name: "Review context" }).click();
    await expect(page.getByRole("dialog").getByText(/Placement stage does not create Representation authority/i)).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByText(/Placement stage does not create Representation authority/i)).toBeVisible();
  }
  await captureIncrement12(page, isMobile
    ? "placement-detail-populated-mobile-390x844.png"
    : "placement-detail-populated-desktop-1440x900.png", true);
  await page.getByRole("tab", { name: /Authority/i }).click();
  await expect(page.getByRole("heading", { name: "Representation and Agreement authority" })).toBeVisible();
  if (!isMobile) await captureIncrement12(page, "placement-detail-authority-desktop-1440x900.png", true);
  await page.getByRole("tab", { name: /Fit & evidence/i }).click();
  await expect(page.getByRole("heading", { name: "Relationship Triangle" })).toBeVisible();
  await page.getByRole("tab", { name: /Stage review/i }).click();
  await expect(page.getByText(/Exact Placement stage change|Consequential|Decision readiness/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare confirmation" })).toBeVisible();
  if (!isMobile) await captureIncrement12(page, "placement-transition-review-desktop-1440x900.png", true);
  else await captureIncrement12(page, "placement-transition-review-mobile-390x844.png", true);
  await page.getByRole("tab", { name: /Activity/i }).click();
  await expect(page.getByText(/Placement created for Increment 12 fixture|Identified/i).first()).toBeVisible();
  if (!isMobile) await captureIncrement12(page, "placement-detail-activity-desktop-1440x900.png", true);
  await expectNoMainOverflow(page);
});

test("valid Placement stage transition records audited outcome", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Valid transition audit coverage uses desktop.");
  const suffix = `valid-${testInfo.project.name}-${Date.now()}`;
  const fixture = await seedPlacement(suffix, "identified");
  await signIn(page);
  await page.goto(`/placements/${fixture.placementId}?toStage=qualified#stage-review`);
  await expect(page.getByRole("heading", { name: fixture.title })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Stage review/i })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Fresh human decision")).not.toHaveValue("");
  await expect(page.getByLabel("Next action")).not.toHaveValue("");
  await page.getByLabel("Reason").fill("Human confirmed current fit and authority for qualification.");
  await page.getByRole("button", { name: "Prepare confirmation" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Record human-confirmed stage" }).click();
  await expect(page.getByRole("heading", { name: "Stage transition recorded" })).toBeVisible();
  await captureIncrement12(page, "placement-transition-completed-audit-desktop-1440x900.png", true);
});

test("invalid Placement stage transition preserves input and prior stage", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Invalid transition coverage uses desktop.");
  const suffix = `invalid-${testInfo.project.name}-${Date.now()}`;
  const fixture = await seedPlacement(suffix, "prepared");
  await signIn(page);
  await page.goto(`/placements/${fixture.placementId}?toStage=contacted#stage-review`);
  await expect(page.getByRole("heading", { name: fixture.title })).toBeVisible();
  await expect(page.getByLabel("Fresh human decision")).not.toHaveValue("");
  await page.getByLabel("Reason").fill("Attempt premature contact without verified outreach activity.");
  await page.getByRole("button", { name: "Prepare confirmation" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Record human-confirmed stage" }).click();
  await expect(page.getByText(/verified outreach|Contacted requires/i).first()).toBeVisible();
  await expect(page.getByLabel("Reason")).toHaveValue("Attempt premature contact without verified outreach activity.");
  await expect(page.getByText(/Prepared/i).first()).toBeVisible();
  await captureIncrement12(page, "placement-transition-blocker-desktop-1440x900.png", true);
});
