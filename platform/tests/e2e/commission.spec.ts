import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { loadConfig } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";

const password = "Synthetic!Passphrase2026";

async function captureIncrement15(page: Page, fileName: string, fullPage = false): Promise<void> {
  if (process.env.CAPTURE_INCREMENT_15_SCREENSHOTS !== "1") return;
  const path = fileURLToPath(new URL(`../../docs/ui-redesign-spec/screenshots/increment-15/${fileName}`, import.meta.url));
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

async function seedCommission(suffix: string, options: {
  status?: "estimated" | "approved" | "payable" | "paid" | "disputed";
  withDispute?: "opened" | "resolved";
} = {}): Promise<{
  commissionId: string;
  disputeId?: string;
  orderNumber: string;
  brandName: string;
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
  const commissionId = randomUUID();
  const calculationId = randomUUID();
  const disputeId = options.withDispute ? randomUUID() : undefined;
  const status = options.status ?? "estimated";
  const brandName = `Increment15 Brand ${suffix}`;
  const businessName = `Increment15 Business ${suffix}`;
  const orderNumber = `INC15-${suffix}`;
  try {
    await database.query(
      `INSERT INTO brands(id,workspace_id,public_name,identity_status,status,owner_user_id)
       VALUES($1,$2,$3,'verified','active',$4)`,
      [brandId, owner.workspaceId, brandName, owner.userId]
    );
    await database.query(
      `INSERT INTO products(id,workspace_id,brand_id,name,category,identity_status,status,owner_user_id)
       VALUES($1,$2,$3,$4,'Gift','verified','qualified',$5)`,
      [productId, owner.workspaceId, brandId, `Increment15 Product ${suffix}`, owner.userId]
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
      [documentId, owner.workspaceId, agreementId, owner.userId, `increment15-${suffix}.pdf`, `${owner.workspaceId}/${documentId}/original`, "c".repeat(64)]
    );
    await database.query(
      `INSERT INTO human_approvals
        (id,workspace_id,subject_type,subject_id,action_type,artifact_digest,approver_user_id,status,scope,decided_at)
       VALUES($1,$2,'representation_agreement',$3,'activate_representation_agreement',$4,$5,'approved','Exact Agreement scope',now())`,
      [agreementApprovalId, owner.workspaceId, agreementId, `commission-agreement-${suffix}`, owner.userId]
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
      [agreementId, owner.workspaceId, brandId, owner.userId, documentId, agreementApprovalId, `commission-agreement-${suffix}`]
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
         'Human documented opening Order for Commission.','supported',$4,now(),'Review Commission','issued')`,
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
         'Synthetic verified opening Order for Increment 15.',1,1)`,
      [orderId, owner.workspaceId, placementId, agreementId, brandId, businessId, owner.userId, orderNumber, `ui:inc15:${suffix}`, documentId]
    );
    await database.query(
      `INSERT INTO order_line_items
        (id,workspace_id,order_id,product_id,description,quantity,unit_wholesale_price,
         gross_amount,discount_amount,return_amount,cancellation_amount,net_commissionable,
         commission_eligible)
       VALUES($1,$2,$3,$4,'Synthetic Increment 15 line',1,100,100,0,0,0,100,true)`,
      [randomUUID(), owner.workspaceId, orderId, productId]
    );
    await database.query(
      `INSERT INTO accounts
        (id,workspace_id,brand_id,business_id,representative_user_id,owner_user_id,agreement_id,
         placement_opportunity_id,opening_order_id,status,health,health_rationale,opened_at,version)
       VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,'active','healthy','Human reviewed continuity for Increment 15.',now(),1)`,
      [accountId, owner.workspaceId, brandId, businessId, owner.userId, agreementId, placementId, orderId]
    );
    await database.query(`UPDATE orders SET account_id=$2 WHERE id=$1`, [orderId, accountId]);

    const expected = "12.00";
    const approved = ["approved", "payable", "paid", "disputed"].includes(status) ? expected : null;
    const paid = status === "paid" ? expected : null;
    const disputeStatus = options.withDispute === "opened" || status === "disputed" ? "open" : options.withDispute === "resolved" ? "resolved" : "none";
    await database.query(
      `INSERT INTO commissions
        (id,workspace_id,representative_user_id,brand_id,account_id,agreement_id,order_id,
         calculation_basis,commission_rate,basis_type,term_type,currency,expected_amount,
         verified_amount,approved_amount,paid_amount,payment_due_date,payment_date,status,
         dispute_status,clawback_status,source_document_id,current_order_revision,
         calculation_explanation,human_verified_by,human_verified_at,approved_by,approved_at,
         payment_confirmed_by,version)
       VALUES($1,$2,$3,$4,$5,$6,$7,'Eligible net wholesale',0.12,'net','opening_order','USD',$8,$9,$9,$10,
         $11,$12,$13,$14,'none',$15,1,'eligible net 100 × 0.12 = 12.00 USD',$16,$17,$18,$19,$20,1)`,
      [
        commissionId, owner.workspaceId, owner.userId, brandId, accountId, agreementId, orderId,
        expected, approved, paid,
        status === "payable" || status === "paid" ? "2026-07-15" : null,
        status === "paid" ? "2026-07-20" : null,
        status === "disputed" ? "disputed" : status,
        disputeStatus, documentId,
        approved ? owner.userId : null, approved ? new Date().toISOString() : null,
        approved ? owner.userId : null, approved ? new Date().toISOString() : null,
        paid ? owner.userId : null
      ]
    );
    await database.query(
      `INSERT INTO commission_calculations
        (id,workspace_id,commission_id,calculation_version,agreement_id,order_id,order_revision,
         currency,gross_amount,eligible_amount,discounts,returns,cancellations,commissionable_amount,
         basis_type,rate,result_amount,formula,rounding_rule,input_snapshot,snapshot_digest,reason,created_by)
       VALUES($1,$2,$3,1,$4,$5,1,'USD',100,100,0,0,0,100,'net',0.12,12.00,
         'eligible net 100 × 0.12 = 12.00 USD','half away from zero to ISO currency minor unit',
         '{"basisType":"net","rate":"0.12","result":"12.00"}',$6,'Synthetic Increment 15 calculation',$7)`,
      [calculationId, owner.workspaceId, commissionId, agreementId, orderId, `calc-${suffix}`, owner.userId]
    );
    await database.query(
      `UPDATE commissions SET current_calculation_id=$2 WHERE id=$1`,
      [commissionId, calculationId]
    );

    if (disputeId && options.withDispute) {
      const resolved = options.withDispute === "resolved";
      const resolveDecisionId = randomUUID();
      if (resolved) {
        await database.query(
          `INSERT INTO decision_records
            (id,workspace_id,subject_type,subject_id,question,scope,outcome,rationale,confidence,
             owner_user_id,decided_at,next_action,status)
           VALUES($1,$2,'commission_dispute',$3,'Resolve Commission dispute?','Synthetic fixture','Resolve',
             'Human recorded final dispute resolution for Increment 15.','supported',$4,now(),'Close case','issued')`,
          [resolveDecisionId, owner.workspaceId, disputeId, owner.userId]
        );
      }
      await database.query(
        `INSERT INTO commission_disputes
          (id,workspace_id,commission_id,order_id,agreement_id,opened_by,owner_user_id,
           reason_code,reason,disputed_amount,currency,status,next_action,
           resolution_amount,resolution,resolution_date,resolved_by,final_decision_id,version)
         VALUES($1,$2,$3,$4,$5,$6,$6,'amount_or_eligibility',
           'Synthetic allegation that the calculated amount requires human review. Allegation is not proven.',
           12.00,'USD',$7,$8,$9,$10,$11,$12,$13,1)`,
        [
          disputeId, owner.workspaceId, commissionId, orderId, agreementId, owner.userId,
          resolved ? "resolved" : "opened",
          resolved ? "Case closed after human decision." : "Prepare and approve a factual evidence request to the Brand.",
          resolved ? "12.00" : null,
          resolved ? "Human recorded final resolution; withdrawal does not imply Brand correctness." : null,
          resolved ? "2026-07-21" : null,
          resolved ? owner.userId : null,
          resolved ? resolveDecisionId : null
        ]
      );
      await database.query(
        `INSERT INTO commercial_document_links(workspace_id,subject_type,subject_id,document_id,purpose,linked_by)
         VALUES($1,'commission_dispute',$2,$3,'initial_dispute_evidence',$4)`,
        [owner.workspaceId, disputeId, documentId, owner.userId]
      );
      await database.query(
        `INSERT INTO commercial_events
          (id,workspace_id,subject_type,subject_id,event_type,actor_user_id,origin,reason,request_id)
         VALUES($1,$2,'commission_dispute',$3,$4,$5,'user',$6,$7)`,
        [
          randomUUID(), owner.workspaceId, disputeId,
          resolved ? "dispute.resolved" : "dispute.opened",
          owner.userId,
          resolved ? "Human recorded final dispute resolution." : "Synthetic dispute opened for Increment 15.",
          `e2e-inc15-${suffix}`
        ]
      );
    }

    return {
      commissionId,
      ...(disputeId ? { disputeId } : {}),
      orderNumber,
      brandName,
      title: `${brandName} · ${orderNumber}`
    };
  } finally {
    await database.end();
  }
}

test("Commission register preserves currency separation and restricted honesty", async ({ page }, testInfo) => {
  const fixture = await seedCommission(`reg-${testInfo.project.name}-${Date.now()}`, { status: "estimated" });
  const isMobile = testInfo.project.name.includes("mobile");
  await login(page);
  await page.goto("/commissions");
  await expect(page.getByRole("heading", { name: "Commissions", exact: true })).toBeVisible();
  await expect(page.getByText(/Expected, verified, approved, payable, and paid values remain distinct/i)).toBeVisible();
  if (isMobile) {
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByRole("dialog").getByLabel("Commission status")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: new RegExp(`Explain Commission for ${fixture.orderNumber}`) })).toBeVisible();
    await captureIncrement15(page, "commissions-register-mobile-390x844.png", true);
  } else {
    await expect(page.getByLabel("Commission status").first()).toBeVisible();
    await expect(page.getByRole("table", { name: "Commission ledger" }).getByText(fixture.orderNumber)).toBeVisible();
    await captureIncrement15(page, "commissions-register-populated-desktop-1440x900.png", true);
  }
  await expectNoViewportLoss(page);
});

test("read-only Commission sessions expose restricted messaging", async ({ page }) => {
  await login(page, "grace@synthetic.ryva.test");
  await page.goto("/commissions");
  await expect(page.getByRole("heading", { name: "Commissions", exact: true })).toBeVisible();
  await expect(page.getByText(/Read-only/i).first()).toBeVisible();
  await captureIncrement15(page, "commissions-register-restricted-desktop-1440x900.png", true);
});

test("Commission detail preserves calculation transparency and consequential review", async ({ page }, testInfo) => {
  const fixture = await seedCommission(`detail-${testInfo.project.name}-${Date.now()}`, { status: "estimated" });
  const isMobile = testInfo.project.name.includes("mobile");
  await login(page);
  await page.goto(`/commissions/${fixture.commissionId}`);
  await expect(page.getByRole("heading", { name: fixture.title })).toBeVisible();
  await expect(page.getByText(/Order value is not commission owed/i).first()).toBeVisible();
  await expect(page.getByText(/Calculated is not payable/i).first()).toBeVisible();
  if (isMobile) {
    await page.setViewportSize({ width: 390, height: 844 });
    await captureIncrement15(page, "commission-detail-mobile-390x844.png", true);
  } else {
    await captureIncrement15(page, "commission-detail-desktop-1440x900.png", true);
  }
  await page.getByRole("tab", { name: /Calculation/i }).click();
  await expect(page.getByText(/eligible net 100/i).first()).toBeVisible();
  if (!isMobile) await captureIncrement15(page, "commission-detail-calculation-desktop-1440x900.png", true);
  await page.getByRole("tab", { name: /Human review/i }).click();
  await expect(page.getByRole("button", { name: /Confirm consequential state/i })).toBeVisible();
  await captureIncrement15(
    page,
    isMobile ? "commission-review-mobile-390x844.png" : "commission-review-valid-desktop-1440x900.png",
    true
  );
  await expectNoViewportLoss(page);
});

test("Commission payable and paid states remain distinct from statements and receipts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop money-state capture only.");
  const payable = await seedCommission(`pay-${Date.now()}`, { status: "payable" });
  const paid = await seedCommission(`paid-${Date.now()}`, { status: "paid" });
  await login(page);
  await page.goto(`/commissions/${payable.commissionId}`);
  await expect(page.getByText(/Due date is not payment received|Payment due/i).first()).toBeVisible();
  await captureIncrement15(page, "commission-detail-payable-desktop-1440x900.png", true);
  await page.goto(`/commissions/${paid.commissionId}`);
  await expect(page.getByText(/Commission is Paid|Human-confirmed/i).first()).toBeVisible();
  await captureIncrement15(page, "commission-detail-paid-desktop-1440x900.png", true);
});

test("Dispute register and unresolved detail preserve allegation versus proof", async ({ page }, testInfo) => {
  const fixture = await seedCommission(`disp-${testInfo.project.name}-${Date.now()}`, {
    status: "disputed",
    withDispute: "opened"
  });
  const isMobile = testInfo.project.name.includes("mobile");
  await login(page);
  await page.goto("/commission-disputes");
  await expect(page.getByRole("heading", { name: "Commission Disputes" })).toBeVisible();
  await expect(page.getByText(/does not adjudicate contractual rights/i)).toBeVisible();
  if (isMobile) {
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByRole("dialog").getByLabel("Dispute status")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await captureIncrement15(page, "disputes-register-mobile-390x844.png", true);
  } else {
    await expect(page.getByLabel("Dispute status").first()).toBeVisible();
    await captureIncrement15(page, "disputes-register-populated-desktop-1440x900.png", true);
  }
  await page.goto(`/commission-disputes/${fixture.disputeId}`);
  await expect(page.getByText(/Allegation is not proven|allegation, not proven/i).first()).toBeVisible();
  await expect(page.getByText(/does not adjudicate|Withdrawal does not imply Brand correctness/i).first()).toBeVisible();
  await page.getByRole("tab", { name: /Evidence/i }).click();
  await expect(page.getByText(/Presence is not verification/i)).toBeVisible();
  if (!isMobile) await captureIncrement15(page, "dispute-detail-evidence-desktop-1440x900.png", true);
  await page.getByRole("tab", { name: /Resolution/i }).click();
  await expect(page.getByRole("button", { name: /Record final human decision/i })).toBeVisible();
  await captureIncrement15(
    page,
    isMobile ? "dispute-review-mobile-390x844.png" : "dispute-review-unresolved-desktop-1440x900.png",
    true
  );
  await expectNoViewportLoss(page);
});

test("Resolved dispute shows audited outcome without inventing Brand correctness", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop resolved-case capture only.");
  const fixture = await seedCommission(`res-${Date.now()}`, { status: "disputed", withDispute: "resolved" });
  await login(page);
  await page.goto(`/commission-disputes/${fixture.disputeId}`);
  await page.getByRole("tab", { name: /Resolution/i }).click();
  await expect(page.getByText(/Final human resolution recorded/i)).toBeVisible();
  await expect(page.getByText(/Withdrawal does not imply Brand correctness/i).first()).toBeVisible();
  await captureIncrement15(page, "dispute-detail-resolved-desktop-1440x900.png", true);
});

test("Accounts Orders Placement Outreach and Representation remain beside commissions", async ({ page }) => {
  await login(page);
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: "Protected Accounts and operational Accounts" })).toBeVisible();
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await page.goto("/placements");
  await expect(page.getByRole("heading", { name: "Placement Opportunities" })).toBeVisible();
  await page.goto("/outreach");
  await expect(page.getByRole("heading", { name: "Human-approved communication" })).toBeVisible();
  await page.goto("/representation");
  await expect(page.getByRole("heading", { name: "Representation", exact: true })).toBeVisible();
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Analytics Command Center" })).toBeVisible();
  await page.goto("/commissions");
  await expect(page.getByRole("heading", { name: "Commissions", exact: true })).toBeVisible();
});
