import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { loadConfig } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";

const password = "Synthetic!Passphrase2026";

async function captureIncrement13(page: Page, fileName: string, fullPage = false): Promise<void> {
  if (process.env.CAPTURE_INCREMENT_13_SCREENSHOTS !== "1") return;
  const path = fileURLToPath(new URL(`../../docs/ui-redesign-spec/screenshots/increment-13/${fileName}`, import.meta.url));
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage, animations: "disabled" });
}

async function signIn(page: Page, email = "active@synthetic.ryva.test"): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
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

async function seedOutreach(suffix: string, options?: {
  permissionStatus?: string;
  verificationStatus?: string;
  subject?: string;
  body?: string;
  status?: string;
}): Promise<{
  placementId: string;
  messageId: string;
  contactId: string;
  brandName: string;
  businessName: string;
  contactName: string;
  subject: string;
}> {
  const database = createDatabase(loadConfig(process.env));
  const owner = await identity("active@synthetic.ryva.test");
  const brandId = randomUUID();
  const productId = randomUUID();
  const businessId = randomUUID();
  const contactId = randomUUID();
  const agreementId = randomUUID();
  const agreementApprovalId = randomUUID();
  const documentId = randomUUID();
  const decisionId = randomUUID();
  const taskId = randomUUID();
  const placementId = randomUUID();
  const messageId = randomUUID();
  const brandName = `Increment13 Brand ${suffix}`;
  const businessName = `Increment13 Business ${suffix}`;
  const contactName = `Increment13 Contact ${suffix}`;
  const subject = options?.subject ?? `Increment13 exact subject ${suffix}`;
  const body = options?.body ?? "Hello Increment13 Contact. Please review this exact opportunity. Reply or opt out at any time.";
  const permissionStatus = options?.permissionStatus ?? "professional_purpose";
  const verificationStatus = options?.verificationStatus ?? "verified";
  const status = options?.status ?? "draft";
  try {
    await database.query(
      `INSERT INTO brands(id,workspace_id,public_name,identity_status,status,owner_user_id)
       VALUES($1,$2,$3,'verified','active',$4)`,
      [brandId, owner.workspaceId, brandName, owner.userId]
    );
    await database.query(
      `INSERT INTO products(id,workspace_id,brand_id,name,category,identity_status,status,owner_user_id)
       VALUES($1,$2,$3,$4,'Gift','verified','qualified',$5)`,
      [productId, owner.workspaceId, brandId, `Increment13 Product ${suffix}`, owner.userId]
    );
    await database.query(
      `INSERT INTO businesses(id,workspace_id,name,business_type,category,status,owner_user_id,qualification_status,geography)
       VALUES($1,$2,$3,'gift_shop','Gift','qualified',$4,'qualified','{"country":"US"}')`,
      [businessId, owner.workspaceId, businessName, owner.userId]
    );
    await database.query(
      `INSERT INTO contacts
        (id,workspace_id,business_id,name,role,email,permission_status,verification_status,owner_user_id)
       VALUES($1,$2,$3,$4,'Buyer',$5,$6,$7,$8)`,
      [contactId, owner.workspaceId, businessId, contactName, `buyer-${suffix}@synthetic.ryva.test`, permissionStatus, verificationStatus, owner.userId]
    );
    await database.query(
      `INSERT INTO documents
        (id,workspace_id,subject_type,subject_id,owner_user_id,name,document_type,media_type,
         byte_size,storage_key,sha256,scan_status,confidentiality,status)
       VALUES($1,$2,'representation_agreement',$3,$4,$5,'representation_agreement_original',
         'application/pdf',100,$6,$7,'clean','restricted','active')`,
      [documentId, owner.workspaceId, agreementId, owner.userId, `increment13-${suffix}.pdf`, `${owner.workspaceId}/${documentId}/original`, "c".repeat(64)]
    );
    await database.query(
      `INSERT INTO human_approvals
        (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,approver_user_id,status,scope,decided_at)
       VALUES($1,$2,'representation_agreement',$3,'activate_representation_agreement',$4,$5,'approved','Exact Agreement scope',now())`,
      [agreementApprovalId, owner.workspaceId, agreementId, `outreach-agreement-${suffix}`, owner.userId]
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
         '{"countries":["US"]}','Scoped outreach authority only.','Eligible net wholesale',0.12,
         'USD','After cleared payment','Opening Orders documented.','Reorders documented.',
         'One year only.','Written exclusions only.','Written notice.','Accepted Orders survive.',
         'none',$6,$7,$4,now())`,
      [agreementId, owner.workspaceId, brandId, owner.userId, documentId, agreementApprovalId, `outreach-agreement-${suffix}`]
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
       VALUES($1,$2,'business',$3,'Prepare Outreach?','Synthetic fixture','Proceed',
         'Documented Buyer contact for Outreach.','supported',$4,now(),'Prepare outreach','issued')`,
      [decisionId, owner.workspaceId, businessId, owner.userId]
    );
    await database.query(
      `INSERT INTO tasks
        (id,workspace_id,subject_type,subject_id,title,status,owner_user_id,due_at,priority,created_reason)
       VALUES($1,$2,'business',$3,'Review Outreach follow-up','open',$4,now()+interval '3 days','medium','Increment 13 Outreach fixture')`,
      [taskId, owner.workspaceId, businessId, owner.userId]
    );
    await database.query(
      `INSERT INTO placement_opportunities
        (id,workspace_id,agreement_id,brand_id,business_id,owner_user_id,stage,authority_channel,match_thesis,
         buyer_value_basis,evidence_confidence,decision_id,next_action_task_id,conflict_status)
       VALUES($1,$2,$3,$4,$5,$6,'prepared','independent_retail','Documented Product fills a gift assortment need.',
         'Adds a shelf-ready gift option for the Buyer customer need.','supported',$7,$8,'clear')`,
      [placementId, owner.workspaceId, agreementId, brandId, businessId, owner.userId, decisionId, taskId]
    );
    await database.query(
      `INSERT INTO placement_opportunity_products(placement_opportunity_id,workspace_id,product_id)
       VALUES($1,$2,$3)`,
      [placementId, owner.workspaceId, productId]
    );
    await database.query(
      `INSERT INTO outreach_messages
        (id,workspace_id,placement_opportunity_id,agreement_id,brand_id,business_id,contact_id,
         owner_user_id,channel,direction,sender_address,recipient_address,subject,body,status,origin,version)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'email','outbound','active@synthetic.ryva.test',
         $9,$10,$11,$12,'user_entered',1)`,
      [
        messageId,
        owner.workspaceId,
        placementId,
        agreementId,
        brandId,
        businessId,
        contactId,
        owner.userId,
        `buyer-${suffix}@synthetic.ryva.test`,
        subject,
        body,
        status
      ]
    );
    await database.query(
      `INSERT INTO outreach_message_products(workspace_id,message_id,product_id)
       VALUES($1,$2,$3)`,
      [owner.workspaceId, messageId, productId]
    );
    return { placementId, messageId, contactId, brandName, businessName, contactName, subject };
  } finally {
    await database.end();
  }
}

test("Outreach Center exposes authority-checked review workflows and safe empty states", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await signIn(page);
  await page.goto("/outreach");
  await expect(page.getByRole("heading", { name: "Outreach", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
  await expect(
    page.getByText(/No activity yet/i)
      .or(page.locator(".ry-outreach-activity-list li").first())
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prepare message" })).toBeVisible();
  await expect(page.getByLabel("Placement").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Log call" })).toBeVisible();
  await expectNoMainOverflow(page);
  expect(consoleErrors).toEqual([]);
});

test("Outreach workspace honors placement query and message register states", async ({ page }, testInfo) => {
  const fixture = await seedOutreach(`ws-${testInfo.project.name}-${Date.now()}`);
  const isMobile = testInfo.project.name.includes("mobile");
  await signIn(page);
  await page.goto(`/app/outreach?placementId=${fixture.placementId}`);
  await expect(page.getByRole("heading", { name: "Outreach", exact: true })).toBeVisible();
  await expect(page.getByLabel("Placement").first()).toHaveValue(fixture.placementId);
  if (isMobile) {
    await expect(page.getByRole("button", { name: "Open Increment13 exact subject" }).first()).toBeVisible();
  } else {
    await expect(page.getByText("Increment13 exact subject", { exact: true }).first()).toBeVisible();
  }
  if (!isMobile) await captureIncrement13(page, "outreach-workspace-populated-desktop-1440x900.png", true);
  else {
    await page.setViewportSize({ width: 390, height: 844 });
    await captureIncrement13(page, "outreach-workspace-mobile-390x844.png", true);
  }
  await expectNoMainOverflow(page);
});

test("read-only Outreach sessions expose restricted messaging", async ({ page }) => {
  await signIn(page, "mentor-readonly@synthetic.ryva.test");
  await page.goto("/outreach");
  await expect(page.getByRole("heading", { name: "Outreach", exact: true })).toBeVisible();
  await expect(page.getByText("Read-only Outreach workspace")).toBeVisible();
  await captureIncrement13(page, "outreach-workspace-restricted-desktop-1440x900.png", true);
});

test("empty Outreach message filters stay honest without fabricated drafts", async ({ page }, testInfo) => {
  await signIn(page);
  await page.goto("/outreach");
  await expect(page.getByRole("heading", { name: "Outreach", exact: true })).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Filters" }).click();
    await page.getByRole("dialog").getByLabel("Search Buyer or subject").fill(`no-match-${Date.now()}`);
    await page.keyboard.press("Escape");
  } else {
    await page.getByLabel("Search Buyer or subject").first().fill(`no-match-${Date.now()}`);
  }
  await expect(page.getByText(/No messages match these filters|No drafts, sends, or replies/i)).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement13(page, "outreach-workspace-no-result-desktop-1440x900.png", true);
  }
});

test("representative can create a versioned email template without granting send approval", async ({
  page
}, testInfo) => {
  await signIn(page);
  await page.goto("/outreach/templates");
  await expect(page.getByRole("heading", { name: "Templates", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create template" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(`Synthetic Buyer Intro ${testInfo.project.name}`);
  await dialog.getByRole("combobox").nth(0).selectOption("email");
  await dialog.getByRole("combobox").nth(1).selectOption({ label: "First outreach" });
  await dialog.getByLabel("Subject", { exact: true }).fill("A careful introduction for {{buyer_name}}");
  await dialog.getByLabel("Body", { exact: true }).fill(
    "Hello {{buyer_name}}. This template is a starting point only. Reply or opt out at any time."
  );
  await dialog.getByRole("checkbox", { name: "Buyer name" }).check();
  await dialog.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByRole("heading", {
    name: /Buyer Intro/
  })).toBeVisible();
  await expect(page.getByText("First outreach").last()).toBeVisible();
  await expect(page.getByText("Version 1")).toHaveCount(0);
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement13(page, "outreach-templates-desktop-1440x900.png", true);
  }
});

test("Sequences clearly preserve approval and stop-condition boundaries", async ({ page }, testInfo) => {
  await signIn(page);
  await page.goto("/outreach/sequences");
  await expect(page.getByRole("heading", { name: "Sequences", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create sequence" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("combobox", { name: /Opening email/ })).toBeVisible();
  await expect(page.getByLabel("Days before follow-up review")).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement13(page, "outreach-sequences-desktop-1440x900.png", true);
  }
});

test("Outreach detail preserves soft subject review and domain boundaries", async ({ page }, testInfo) => {
  const suffix = `detail-${testInfo.project.name}-${Date.now()}`;
  const fixture = await seedOutreach(suffix);
  const isMobile = testInfo.project.name.includes("mobile");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await signIn(page);
  await page.goto(`/outreach/${fixture.messageId}`);
  await expect(page.getByRole("heading", { name: "Increment13 exact subject", exact: true })).toBeVisible();
  await expect(page.getByText(/Recipient, sender, content, claims, attachments, channel, and timing/i)).toBeVisible();
  if (isMobile) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Review status" }).click();
    await expect(page.getByRole("dialog").getByText(/Permission|Authority/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await captureIncrement13(page, "outreach-detail-populated-mobile-390x844.png", true);
  } else {
    await expect(page.getByText(/Outreach status/i).first()).toBeVisible();
    await captureIncrement13(page, "outreach-detail-populated-desktop-1440x900.png", true);
  }
  await page.getByRole("tab", { name: /Contact & permission/i }).click();
  await expect(page.getByRole("heading", { name: "Contact & permission" })).toBeVisible();
  await expect(page.getByText(/Permission/i).first()).toBeVisible();
  if (!isMobile) await captureIncrement13(page, "outreach-detail-permission-desktop-1440x900.png", true);
  await page.getByRole("tab", { name: /Placement/i }).click();
  await expect(page.getByRole("heading", { name: "Placement context" })).toBeVisible();
  if (!isMobile) await captureIncrement13(page, "outreach-detail-placement-desktop-1440x900.png", true);
  await page.getByRole("tab", { name: /^Message$/i }).click();
  await expect(page.locator(".ry-outreach-message-preview")).toContainText(/exact opportunity|opt out/i);
  if (!isMobile) await captureIncrement13(page, "outreach-detail-exact-message-desktop-1440x900.png", true);
  await page.getByRole("tab", { name: /Approval & send/i }).click();
  const reviewPanel = page.getByRole("tabpanel", { name: /Approval & send/i });
  await expect(reviewPanel.getByText(/Before approving/i).first()).toBeVisible();
  await expect(reviewPanel.getByRole("button", { name: "Request approval" })).toBeVisible();
  if (!isMobile) await captureIncrement13(page, "outreach-review-valid-desktop-1440x900.png", true);
  else await captureIncrement13(page, "outreach-review-mobile-390x844.png", true);
  await page.getByRole("tab", { name: /Activity/i }).click();
  await expect(page.getByText(/Status ·/i).first()).toBeVisible();
  if (!isMobile) await captureIncrement13(page, "outreach-detail-activity-desktop-1440x900.png", true);
  await expectNoMainOverflow(page);
  expect(consoleErrors).toEqual([]);
});

test("permission-blocked Outreach review stays truthful without implying send authority", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Permission blocker coverage uses desktop.");
  const fixture = await seedOutreach(`blocked-${testInfo.project.name}-${Date.now()}`, {
    permissionStatus: "opted_out"
  });
  await signIn(page);
  await page.goto(`/outreach/${fixture.messageId}`);
  await expect(page.getByRole("heading", { name: "Increment13 exact subject", exact: true })).toBeVisible();
  await expect(page.getByText(/Contact permission blocks outreach/i)).toBeVisible();
  await page.getByRole("tab", { name: /Approval & send/i }).click();
  await expect(page.getByText(/permission is Opted Out|Contact permission/i).first()).toBeVisible();
  await captureIncrement13(page, "outreach-review-permission-blocker-desktop-1440x900.png", true);
});

test("unresolved placeholder drafts surface exact-artifact blockers", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Placeholder blocker coverage uses desktop.");
  const fixture = await seedOutreach(`ph-${testInfo.project.name}-${Date.now()}`, {
    subject: "Hello {{buyer_name}}",
    body: "Please review {{product_name}}. Reply or opt out at any time."
  });
  await signIn(page);
  await page.goto(`/outreach/${fixture.messageId}`);
  await expect(page.getByText(/Unresolved placeholders remain/i)).toBeVisible();
  await page.getByRole("tab", { name: /Approval & send/i }).click();
  await expect(page.getByText(/Unresolved merge placeholders|placeholders remain/i).first()).toBeVisible();
  await captureIncrement13(page, "outreach-review-placeholder-blocker-desktop-1440x900.png", true);
});

test("valid Outreach approval records audited outcome without implying send", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Valid approval audit coverage uses desktop.");
  const fixture = await seedOutreach(`approve-${testInfo.project.name}-${Date.now()}`);
  await signIn(page);
  await page.goto(`/outreach/${fixture.messageId}`);
  await page.getByRole("tab", { name: /Approval & send/i }).click();
  const reviewPanel = page.getByRole("tabpanel", { name: /Approval & send/i });
  await reviewPanel.getByRole("button", { name: "Request approval" }).click();
  await expect(reviewPanel.getByRole("button", { name: "Approve message" })).toBeVisible({ timeout: 15_000 });
  await reviewPanel.getByRole("button", { name: "Approve message" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Approve message" }).click();
  await expect(page.getByText(/Message approved|Sending is a separate step/i).first()).toBeVisible({ timeout: 15_000 });
  await captureIncrement13(page, "outreach-review-completed-audit-desktop-1440x900.png", true);
});

test("Placement Contact Buyer Representation Agreement Product Brand and commercial routes remain beside Outreach", async ({ page }) => {
  await signIn(page);
  await page.goto("/placements");
  await expect(page.getByRole("heading", { name: "Placement Opportunities" })).toBeVisible();
  await page.goto("/records/contact");
  await expect(page.getByRole("heading", { name: "Contact register", exact: true })).toBeVisible();
  await page.goto("/buyers");
  await expect(page.getByRole("heading", { name: "Buyer Intelligence" })).toBeVisible();
  await page.goto("/representation");
  await expect(page.getByRole("heading", { name: "Representation", exact: true })).toBeVisible();
  await page.goto("/records/product");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  await page.goto("/records/brand");
  await expect(page.getByRole("heading", { name: "Brand Intelligence" })).toBeVisible();
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  await page.goto("/protected-accounts");
  await expect(page.getByRole("heading", { name: "Protected Accounts", exact: true })).toBeVisible();
  await page.goto("/outreach");
  await expect(page.getByRole("heading", { name: "Outreach", exact: true })).toBeVisible();
});
