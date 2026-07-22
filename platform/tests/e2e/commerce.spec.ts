import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { loadConfig } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";

const password = "Synthetic!Passphrase2026";

async function captureIncrement14(page: Page, fileName: string, fullPage = false): Promise<void> {
  if (process.env.CAPTURE_INCREMENT_14_SCREENSHOTS !== "1") return;
  const path = fileURLToPath(new URL(`../../docs/ui-redesign-spec/screenshots/increment-14/${fileName}`, import.meta.url));
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage, animations: "disabled" });
}

async function login(page: Page, email = "active@synthetic.ryva.test") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

async function expectNoViewportLoss(page: Page) {
  const overflow = await page.evaluate(() => {
    const currentDocument = (globalThis as unknown as {
      document: { documentElement: { scrollWidth: number; clientWidth: number } };
    }).document;
    return currentDocument.documentElement.scrollWidth >
      currentDocument.documentElement.clientWidth + 2;
  });
  expect(overflow).toBe(false);
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

async function seedAccount(suffix: string, options: {
  protectionStatus?: "pending" | "active" | "expired";
  unverifiedOrder?: boolean;
  reorderStatus?: "due" | "deferred" | "unknown";
} = {}): Promise<{
  accountId: string;
  orderId: string;
  unverifiedOrderId?: string;
  protectionId?: string;
  brandName: string;
  businessName: string;
  title: string;
}> {
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
  const orderId = randomUUID();
  const accountId = randomUUID();
  const protectionId = options.protectionStatus ? randomUUID() : undefined;
  const unverifiedOrderId = options.unverifiedOrder ? randomUUID() : undefined;
  const reorderId = options.reorderStatus ? randomUUID() : undefined;
  const brandName = `Increment14 Brand ${suffix}`;
  const businessName = `Increment14 Business ${suffix}`;
  try {
    await database.query(
      `INSERT INTO brands(id,workspace_id,public_name,identity_status,status,owner_user_id)
       VALUES($1,$2,$3,'verified','active',$4)`,
      [brandId, owner.workspaceId, brandName, owner.userId]
    );
    await database.query(
      `INSERT INTO products(id,workspace_id,brand_id,name,category,identity_status,status,owner_user_id)
       VALUES($1,$2,$3,$4,'Gift','verified','qualified',$5)`,
      [productId, owner.workspaceId, brandId, `Increment14 Product ${suffix}`, owner.userId]
    );
    await database.query(
      `INSERT INTO businesses(id,workspace_id,name,business_type,category,status,owner_user_id,qualification_status,geography)
       VALUES($1,$2,$3,'gift_shop','Gift','qualified',$4,'qualified','{"country":"US"}')`,
      [businessId, owner.workspaceId, businessName, owner.userId]
    );
    await database.query(
      `INSERT INTO documents
        (id,workspace_id,subject_type,subject_id,owner_user_id,name,document_type,media_type,
         byte_size,storage_key,sha256,scan_status,confidentiality,status)
       VALUES($1,$2,'representation_agreement',$3,$4,$5,'representation_agreement_original',
         'application/pdf',100,$6,$7,'clean','restricted','active')`,
      [documentId, owner.workspaceId, agreementId, owner.userId, `increment14-${suffix}.pdf`, `${owner.workspaceId}/${documentId}/original`, "c".repeat(64)]
    );
    await database.query(
      `INSERT INTO human_approvals
        (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,approver_user_id,status,scope,decided_at)
       VALUES($1,$2,'representation_agreement',$3,'activate_representation_agreement',$4,$5,'approved','Exact Agreement scope',now())`,
      [agreementApprovalId, owner.workspaceId, agreementId, `commerce-agreement-${suffix}`, owner.userId]
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
         '{"countries":["US"]}','Scoped commercial authority only.','Eligible net wholesale',0.12,
         'USD','After cleared payment','Opening Orders documented.','Reorders documented.',
         'One year only.','Written exclusions only.','Written notice.','Accepted Orders survive.',
         'none',$6,$7,$4,now())`,
      [agreementId, owner.workspaceId, brandId, owner.userId, documentId, agreementApprovalId, `commerce-agreement-${suffix}`]
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
       VALUES($1,$2,'business',$3,'Advance commercial continuity?','Synthetic fixture','Proceed',
         'Human documented opening Order for Account.','supported',$4,now(),'Review Account','issued')`,
      [decisionId, owner.workspaceId, businessId, owner.userId]
    );
    await database.query(
      `INSERT INTO placement_opportunities
        (id,workspace_id,agreement_id,brand_id,business_id,owner_user_id,stage,authority_channel,match_thesis,
         buyer_value_basis,evidence_confidence,decision_id,conflict_status)
       VALUES($1,$2,$3,$4,$5,$6,'opening_order','independent_retail','Documented Product fills a gift assortment need.',
         'Adds a shelf-ready gift option for the Buyer customer need.','supported',$7,'clear')`,
      [placementId, owner.workspaceId, agreementId, brandId, businessId, owner.userId, decisionId]
    );
    await database.query(
      `INSERT INTO placement_opportunity_products(placement_opportunity_id,workspace_id,product_id)
       VALUES($1,$2,$3)`,
      [placementId, owner.workspaceId, productId]
    );
    await database.query(
      `INSERT INTO orders
        (id,workspace_id,account_id,placement_opportunity_id,agreement_id,brand_id,business_id,
         representative_user_id,order_number,idempotency_key,order_type,order_date,currency,
         wholesale_gross,discounts,returns,cancellations,net_commissionable,status,payment_status,
         fulfillment_status,source_type,source_document_id,verification_status,verified_by,verified_at,
         verification_notes,current_revision,version)
       VALUES($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,'opening_order','2026-06-01','USD',
         100,0,0,0,100,'confirmed','unknown','unknown','document',$10,'verified',$7,now(),
         'Synthetic verified opening Order for Increment 14.',1,1)`,
      [orderId, owner.workspaceId, placementId, agreementId, brandId, businessId, owner.userId, `INC14-${suffix}`, `ui:inc14:${suffix}`, documentId]
    );
    await database.query(
      `INSERT INTO order_line_items
        (id,workspace_id,order_id,product_id,description,quantity,unit_wholesale_price,
         gross_amount,discount_amount,return_amount,cancellation_amount,net_commissionable,
         commission_eligible)
       VALUES($1,$2,$3,$4,'Synthetic Increment 14 line',1,100,100,0,0,0,100,true)`,
      [randomUUID(), owner.workspaceId, orderId, productId]
    );
    await database.query(
      `INSERT INTO accounts
        (id,workspace_id,brand_id,business_id,representative_user_id,owner_user_id,agreement_id,
         placement_opportunity_id,opening_order_id,status,health,health_rationale,opened_at,version)
       VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,'active','healthy','Human reviewed continuity for Increment 14.',now(),1)`,
      [accountId, owner.workspaceId, brandId, businessId, owner.userId, agreementId, placementId, orderId]
    );
    await database.query(`UPDATE orders SET account_id=$2 WHERE id=$1`, [orderId, accountId]);
    if (unverifiedOrderId) {
      await database.query(
        `INSERT INTO orders
          (id,workspace_id,account_id,placement_opportunity_id,agreement_id,brand_id,business_id,
           representative_user_id,order_number,idempotency_key,order_type,order_date,currency,
           wholesale_gross,discounts,returns,cancellations,net_commissionable,status,payment_status,
           fulfillment_status,source_type,source_document_id,verification_status,current_revision,version)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'opening_order','2026-06-15','USD',
           50,0,0,0,50,'submitted','unknown','unknown','document',$11,'unverified',1,1)`,
        [unverifiedOrderId, owner.workspaceId, accountId, placementId, agreementId, brandId, businessId,
          owner.userId, `INC14-UV-${suffix}`, `ui:inc14:uv:${suffix}`, documentId]
      );
      await database.query(
        `INSERT INTO order_line_items
          (id,workspace_id,order_id,product_id,description,quantity,unit_wholesale_price,
           gross_amount,discount_amount,return_amount,cancellation_amount,net_commissionable,
           commission_eligible)
         VALUES($1,$2,$3,$4,'Unverified synthetic line',1,50,50,0,0,0,50,true)`,
        [randomUUID(), owner.workspaceId, unverifiedOrderId, productId]
      );
    }
    if (protectionId && options.protectionStatus) {
      const protectionApprovalId = randomUUID();
      const status = options.protectionStatus;
      if (status === "active") {
        await database.query(
          `INSERT INTO human_approvals
            (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,approver_user_id,
             status,scope,conditions,decided_at)
           VALUES($1,$2,'protected_account',$3,'activate_protection',$4,$5,'approved',
             'Exact Increment 14 protection scope','Documented scope only.',now())`,
          [protectionApprovalId, owner.workspaceId, protectionId, `rights-inc14-${suffix}`, owner.userId]
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
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'2026-06-01',$10,$11,$12,
           'Exact Product, independent retail, US territory, and documented term only.',
           ARRAY[$13::uuid],ARRAY['independent_retail'],'{"countries":["US"]}',
           $14,$15,'Documented term only','Documented commission rights text.',
           'Documented reorder rights text.','Written exclusions only.',
           'Release requires documented human action.',$16,$17,'documented',$18)`,
        [protectionId, owner.workspaceId, accountId, brandId, businessId, owner.userId,
          agreementId, placementId, documentId,
          status === "active" ? "2026-06-15" : null,
          status === "active" ? owner.userId : null,
          status === "active" ? protectionApprovalId : null,
          productId,
          status === "expired" ? "2025-01-01" : "2026-06-01",
          status === "expired" ? "2025-12-31" : "2027-06-01",
          status, `rights-inc14-${suffix}`, status === "active"]
      );
    }
    if (reorderId && options.reorderStatus) {
      await database.query(
        `INSERT INTO reorders
          (id,workspace_id,account_id,prior_order_id,owner_user_id,last_order_date,currency,
           status,expected_window_starts_on,expected_window_ends_on,account_health,health_rationale,
           next_action,estimate_explanation,recommendation_origin,version)
         VALUES($1,$2,$3,$4,$5,'2026-06-01','USD',$6,'2026-07-01','2026-08-01',$7,$8,$9,
           'Human review; no guaranteed revenue.','user_entered',1)`,
        [reorderId, owner.workspaceId, accountId, orderId, owner.userId,
          options.reorderStatus === "unknown" ? "projected" : options.reorderStatus,
          options.reorderStatus === "deferred" ? "at_risk" : "healthy",
          options.reorderStatus === "deferred"
            ? "Human deferred continuity; eligibility is not inferred from elapsed time."
            : "Stored human review only; prior Order does not guarantee a Reorder.",
          options.reorderStatus === "deferred" ? "Defer and reassess with evidence." : "Review stored Reorder opportunity."]
      );
    }
    return {
      accountId,
      orderId,
      brandName,
      businessName,
      title: `${brandName} → ${businessName}`,
      ...(unverifiedOrderId ? { unverifiedOrderId } : {}),
      ...(protectionId ? { protectionId } : {})
    };
  } finally {
    await database.end();
  }
}

test("Accounts and protection expose documentary-rights and human-health workflows", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: "Protected Accounts and operational Accounts" })).toBeVisible();
  await expect(page.getByText(/do not create contractual rights/i)).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByRole("dialog").getByLabel("Account status")).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByLabel("Account status").first()).toBeVisible();
    await captureIncrement14(page, "accounts-register-populated-desktop-1440x900.png", true);
  }
  await page.getByRole("link", { name: "Protection", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Protected Accounts", exact: true })).toBeVisible();
  await expect(page.getByText(/does not create contractual protection/i)).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByRole("dialog").getByLabel("Protection status")).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByLabel("Protection status").first()).toBeVisible();
    await captureIncrement14(page, "protection-register-desktop-1440x900.png", true);
  }
  await expect(page.getByRole("heading", { name: "Register a documented account-rights basis" })).toBeVisible();
  await expectNoViewportLoss(page);
});

test("Orders expose source-backed multi-line entry and keep verification separate", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Record an opening Order" })).toBeVisible();
  await expect(page.getByLabel("Order-discussion Placement")).toBeVisible();
  await expect(page.getByLabel("Clean source document")).toBeVisible();
  await expect(page.getByRole("group", { name: "Line 1" })).toBeVisible();
  await page.getByRole("button", { name: "Add line" }).click();
  await expect(page.getByRole("group", { name: "Line 2" })).toBeVisible();
  await expect(page.getByText(/Drafts and projections are excluded/i)).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement14(page, "orders-register-desktop-1440x900.png", true);
  } else {
    await page.setViewportSize({ width: 390, height: 844 });
    await captureIncrement14(page, "orders-register-mobile-390x844.png", true);
  }
  await expectNoViewportLoss(page);
});

test("Reorders and Commissions clearly separate projections, approval, and currencies", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("/reorders");
  await expect(page.getByRole("heading", { name: "Reorders and account health" })).toBeVisible();
  await expect(page.getByText(/not guaranteed revenue/i)).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await captureIncrement14(page, "reorders-register-desktop-1440x900.png", true);
  }
  await page.getByRole("link", { name: "Commissions", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Commissions", exact: true })).toBeVisible();
  await expect(page.getByText(/Expected, verified, approved, payable, and paid values remain distinct/i)).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByRole("dialog").getByLabel("Commission status")).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByLabel("Commission status").first()).toBeVisible();
  }
  await expectNoViewportLoss(page);
});

test("Commission Disputes retain human ownership and evidence-first empty states", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("/commission-disputes");
  await expect(page.getByRole("heading", { name: "Commission Disputes" })).toBeVisible();
  await expect(page.getByText(/does not adjudicate contractual rights/i)).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByRole("dialog").getByLabel("Dispute status")).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByLabel("Dispute status").first()).toBeVisible();
  }
  const emptyGuidance = page.getByText(/Open one from a Commission variance/i);
  const caseTable = page.getByRole("table", { name: "Commission dispute cases" });
  const mobileList = page.getByRole("list", { name: "Commission dispute cases" });
  await expect(emptyGuidance.or(caseTable).or(mobileList).first()).toBeVisible();
  await expectNoViewportLoss(page);
});

test("Account detail preserves health, protection, and commercial boundaries", async ({ page }, testInfo) => {
  const fixture = await seedAccount(`acct-${testInfo.project.name}-${Date.now()}`, {
    protectionStatus: "pending",
    reorderStatus: "due"
  });
  const isMobile = testInfo.project.name.includes("mobile");
  await login(page);
  await page.goto(`/accounts/${fixture.accountId}`);
  await expect(page.getByRole("heading", { name: fixture.title })).toBeVisible();
  await expect(page.getByText(/Placement is not Account/i)).toBeVisible();
  await expect(page.getByText(/Order value is not commission owed/i).first()).toBeVisible();
  if (isMobile) {
    await page.setViewportSize({ width: 390, height: 844 });
    await captureIncrement14(page, "account-detail-mobile-390x844.png", true);
  } else {
    await captureIncrement14(page, "account-detail-desktop-1440x900.png", true);
  }
  await page.getByRole("tab", { name: /Protection/i }).click();
  await expect(page.getByText(/does not create protection|documented basis|pending/i).first()).toBeVisible();
  if (!isMobile) await captureIncrement14(page, "account-detail-protection-desktop-1440x900.png", true);
  await page.getByRole("tab", { name: /Orders|Reorders/i }).first().click();
  if (!isMobile) await captureIncrement14(page, "account-detail-orders-desktop-1440x900.png", true);
  await expectNoViewportLoss(page);
});

test("Order detail preserves exact lines, verification review, and commercial boundaries", async ({ page }, testInfo) => {
  const fixture = await seedAccount(`order-${testInfo.project.name}-${Date.now()}`, { unverifiedOrder: true });
  const isMobile = testInfo.project.name.includes("mobile");
  await login(page);
  await page.goto(`/orders/${fixture.orderId}`);
  await expect(page.getByRole("heading", { name: new RegExp(`INC14-`) })).toBeVisible();
  await expect(page.getByText(/Order is not protection/i)).toBeVisible();
  await page.getByRole("tab", { name: /Lines/i }).click();
  await expect(page.getByText(/Synthetic Increment 14 line/i)).toBeVisible();
  if (!isMobile) await captureIncrement14(page, "order-detail-lines-desktop-1440x900.png", true);
  else {
    await page.setViewportSize({ width: 390, height: 844 });
    await captureIncrement14(page, "order-detail-mobile-390x844.png", true);
  }
  if (fixture.unverifiedOrderId) {
    await page.goto(`/orders/${fixture.unverifiedOrderId}`);
    await page.getByRole("tab", { name: /Verification/i }).click();
    await expect(page.getByRole("button", { name: /Confirm documented Order/i })).toBeVisible();
    await captureIncrement14(
      page,
      isMobile ? "order-review-mobile-390x844.png" : "order-review-valid-desktop-1440x900.png",
      true
    );
  }
  await expectNoViewportLoss(page);
});

test("Protected Account review keeps exact scope and authority distinct", async ({ page }, testInfo) => {
  const pending = await seedAccount(`prot-p-${testInfo.project.name}-${Date.now()}`, { protectionStatus: "pending" });
  const active = await seedAccount(`prot-a-${testInfo.project.name}-${Date.now()}`, { protectionStatus: "active" });
  const expired = await seedAccount(`prot-e-${testInfo.project.name}-${Date.now()}`, { protectionStatus: "expired" });
  const isMobile = testInfo.project.name.includes("mobile");
  await login(page);
  await page.goto(`/protected-accounts/${pending.protectionId}`);
  await expect(page.getByText(/Consequential review/i).first()).toBeVisible();
  await expect(page.getByText(/Agreement authority/i).first()).toBeVisible();
  if (!isMobile) await captureIncrement14(page, "protection-review-pending-desktop-1440x900.png", true);
  await page.goto(`/protected-accounts/${active.protectionId}`);
  await expect(page.getByText(/Documentary protection activated|Human confirmation/i).first()).toBeVisible();
  if (!isMobile) await captureIncrement14(page, "protection-review-approved-desktop-1440x900.png", true);
  await page.goto(`/protected-accounts/${expired.protectionId}`);
  await expect(page.getByText(/Rights are not current|expired/i).first()).toBeVisible();
  if (!isMobile) await captureIncrement14(page, "protection-review-expired-desktop-1440x900.png", true);
  await expectNoViewportLoss(page);
});

test("Reorder register distinguishes due and deferred stored states without inventing eligibility", async ({ page }, testInfo) => {
  const due = await seedAccount(`reo-due-${testInfo.project.name}-${Date.now()}`, { reorderStatus: "due" });
  const deferred = await seedAccount(`reo-def-${testInfo.project.name}-${Date.now()}`, { reorderStatus: "deferred" });
  const isMobile = testInfo.project.name.includes("mobile");
  await login(page);
  await page.goto("/reorders");
  await expect(page.getByRole("heading", { name: "Reorders and account health" })).toBeVisible();
  await expect(page.getByText(/not guaranteed revenue/i)).toBeVisible();
  if (isMobile) {
    await expect(page.getByRole("button", { name: new RegExp(`Review ${due.businessName} Reorder`) })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`Review ${deferred.businessName} Reorder`) })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await captureIncrement14(page, "reorders-register-mobile-390x844.png", true);
  } else {
    const table = page.getByRole("table", { name: "Reorder reviews" });
    await expect(table.getByText(due.businessName)).toBeVisible();
    await expect(table.getByText(deferred.businessName)).toBeVisible();
    await expect(table.getByRole("row").filter({ hasText: due.businessName }).getByText(/Due for human review/i)).toBeVisible();
    await expect(table.getByRole("row").filter({ hasText: deferred.businessName }).getByText(/Deferred or closed by retained human outcome/i)).toBeVisible();
    await captureIncrement14(page, "reorders-register-states-desktop-1440x900.png", true);
  }
  await expectNoViewportLoss(page);
});

test("Accounts register mobile semantic rows preserve commercial identity", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile semantic-row capture only.");
  await seedAccount(`acct-m-${Date.now()}`);
  await login(page);
  await page.goto("/accounts");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Protected Accounts and operational Accounts" })).toBeVisible();
  await captureIncrement14(page, "accounts-register-mobile-390x844.png", true);
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.getByRole("dialog").getByLabel("Account status")).toBeVisible();
  await page.keyboard.press("Escape");
  await expectNoViewportLoss(page);
});

test("read-only Account sessions expose restricted messaging", async ({ page }) => {
  await login(page, "grace@synthetic.ryva.test");
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: "Protected Accounts and operational Accounts" })).toBeVisible();
  await expect(page.getByText(/Read-only/i).first()).toBeVisible();
  await captureIncrement14(page, "accounts-register-restricted-desktop-1440x900.png", true);
});

test("Placement Outreach Representation Buyer and Commission routes remain beside commerce", async ({ page }) => {
  await login(page);
  await page.goto("/placements");
  await expect(page.getByRole("heading", { name: "Placement Opportunities" })).toBeVisible();
  await page.goto("/outreach");
  await expect(page.getByRole("heading", { name: "Human-approved communication" })).toBeVisible();
  await page.goto("/representation");
  await expect(page.getByRole("heading", { name: "Representation", exact: true })).toBeVisible();
  await page.goto("/buyers");
  await expect(page.getByRole("heading", { name: "Buyer Intelligence" })).toBeVisible();
  await page.goto("/commissions");
  await expect(page.getByRole("heading", { name: "Commissions", exact: true })).toBeVisible();
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: "Protected Accounts and operational Accounts" })).toBeVisible();
});
