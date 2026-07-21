import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { loadConfig } from "../../packages/config/src/index.js";
import { createDatabase } from "../../packages/database/src/index.js";

const password = "Synthetic!Passphrase2026";

async function signIn(page: Page, email = "active@synthetic.ryva.test"): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)|Your Ryva Pro access/ })).toBeVisible();
}

async function seedContact(
  email: string,
  suffix: string,
  verified = true
): Promise<{ contactId: string; contactName: string; parentName: string; sourceReference: string }> {
  const database = createDatabase(loadConfig(process.env));
  const businessId = randomUUID();
  const sourceId = randomUUID();
  const contactId = randomUUID();
  const activityId = randomUUID();
  const contactName = `Synthetic Relationship Contact ${suffix}`;
  const parentName = `Synthetic Relationship Business ${suffix}`;
  const sourceReference = `Synthetic relationship source ${suffix}`;
  try {
    const identity = await database.query<{ userId: string; workspaceId: string }>(
      `SELECT u.id AS "userId",m.workspace_id AS "workspaceId"
         FROM users u JOIN workspace_memberships m ON m.user_id=u.id
        WHERE u.email=$1 AND m.status='active' LIMIT 1`,
      [email]
    );
    const owner = identity.rows[0];
    if (!owner) throw new Error(`Synthetic identity ${email} was not seeded.`);
    await database.query(
      `INSERT INTO businesses
        (id,workspace_id,name,business_type,category,status,owner_user_id)
       VALUES($1,$2,$3,'Independent gift shop','Gift','research',$4)`,
      [businessId, owner.workspaceId, parentName, owner.userId]
    );
    await database.query(
      `INSERT INTO sources
        (id,workspace_id,source_type,reference,owner_or_provider,
         rights_classification,confidentiality,status,created_by)
       VALUES($1,$2,'user_supplied',$3,'Ryva synthetic fixture','unknown','normal','active',$4)`,
      [sourceId, owner.workspaceId, sourceReference, owner.userId]
    );
    await database.query(
      `INSERT INTO contacts
        (id,workspace_id,business_id,name,role,email,verification_status,
         permission_status,source_id,last_verified_at,source_observed_at,
         verification_notes,owner_user_id)
       VALUES($1,$2,$3,$4,'Category Buyer',$5,$6,'professional_purpose',
              $7,$8,$9,$10,$11)`,
      [
        contactId,
        owner.workspaceId,
        businessId,
        contactName,
        `relationship-${suffix}@synthetic.ryva.test`,
        verified ? "verified" : "unverified",
        verified ? sourceId : null,
        verified ? new Date() : null,
        verified ? new Date(Date.now() - 86_400_000) : null,
        verified ? "Human-confirmed synthetic professional route for interface verification only." : "",
        owner.userId
      ]
    );
    await database.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status)
       VALUES($1,$2,'record_created',$3,'contact',$4,'Synthetic Contact relationship created','completed')`,
      [activityId, owner.workspaceId, owner.userId, contactId]
    );
    return { contactId, contactName, parentName, sourceReference };
  } finally {
    await database.end();
  }
}

test("Contact pilot preserves human verification, history, focus, and connected context", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const fixture = await seedContact("active@synthetic.ryva.test", suffix, false);
  await signIn(page);
  await page.goto(`/contacts/${fixture.contactId}`);

  await expect(page.getByRole("heading", { name: fixture.contactName, level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Relationship trail" })).toContainText(fixture.parentName);
  if (!testInfo.project.name.includes("mobile")) {
    await expect(page.getByText("A Contact record never establishes Brand, Product, territory, channel, or Buyer Outreach authority.")).toBeVisible();
  }

  const verifyButton = page.getByRole("button", { name: "Verify professional route" }).first();
  await verifyButton.click();
  await expect(page.getByRole("dialog", { name: "Verify professional route" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(verifyButton).toBeFocused();
  await verifyButton.click();
  const verificationDrawer = page.getByRole("dialog", { name: "Verify professional route" });
  await verificationDrawer.getByLabel("Verification Source").selectOption({ label: fixture.sourceReference });
  await verificationDrawer.getByLabel("Human verification notes").fill("Human confirmed the professional route against the synthetic Source; Buyer authority remains unverified.");
  await verificationDrawer.getByRole("button", { name: "Record human verification" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Professional route verification was recorded." })).toBeVisible();
  await expect(page.getByText("verified", { exact: true }).first()).toBeVisible();

  const overviewTab = page.getByRole("tab", { name: "Overview" });
  const activityTab = page.getByRole("tab", { name: /Activity/ });
  await overviewTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(activityTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("list", { name: new RegExp(`Synthetic Relationship Contact ${testInfo.project.name}.* activity timeline`) })).toBeVisible();

  await page.getByRole("button", { name: "Add note" }).first().click();
  const noteDrawer = page.getByRole("dialog", { name: "Add Contact note" });
  await noteDrawer.getByLabel("Contact note").fill("Synthetic relationship note retained in Contact history.");
  await noteDrawer.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Synthetic relationship note retained in Contact history.")).toBeVisible();

  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Review context" }).click();
    const contextDrawer = page.getByRole("dialog", { name: "Contact context" });
    await expect(contextDrawer.getByText("Representation authority")).toBeVisible();
    await contextDrawer.getByRole("button", { name: "Close" }).click();
  }
  expect(errors).toEqual([]);
});

test("Contact detail retains identity and recovery when connected data fails", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "The shared recovery state is exercised once in desktop Chromium.");
  await signIn(page);
  await page.route("**/api/records/contact/*", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({
        type: "synthetic_relationship_failure",
        title: "Contact unavailable",
        detail: "Synthetic Contact relationship failure for recovery-state verification."
      })
    });
  });
  await page.goto(`/contacts/${randomUUID()}`);
  await expect(page.getByRole("navigation", { name: "Relationship trail" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contact unavailable", level: 1 })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Synthetic Contact relationship failure");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("read-only Contact context exposes truth without mutation affordances", async ({ page }, testInfo) => {
  const fixture = await seedContact("grace@synthetic.ryva.test", `restricted-${testInfo.project.name}-${Date.now()}`);
  await signIn(page, "grace@synthetic.ryva.test");
  await page.goto(`/contacts/${fixture.contactId}`);
  await expect(page.getByRole("heading", { name: /Synthetic Relationship Contact/, level: 1 })).toBeVisible();
  await expect(page.getByText("Read-only relationship context")).toBeVisible();
  await expect(page.getByRole("button", { name: "Read-only access" }).first()).toBeDisabled();
  await expect(page.getByRole("button", { name: "Add note" })).toBeDisabled();
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Review context" }).click();
  }
  const authorityScope = testInfo.project.name.includes("mobile")
    ? page.getByRole("dialog", { name: "Contact context" })
    : page.locator(".ry-context-rail");
  await expect(authorityScope.getByText("A Contact record never establishes Brand, Product, territory, channel, or Buyer Outreach authority.")).toBeVisible();
});

test("Relationship Detail reflows at every approved viewport without clipped controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Exact CSS widths run once in desktop Chromium.");
  const fixture = await seedContact("active@synthetic.ryva.test", `geometry-${Date.now()}`);
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 375, height: 812 },
    { width: 320, height: 568 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/contacts/${fixture.contactId}`);
    await expect(page.getByRole("heading", { name: /Synthetic Relationship Contact/, level: 1 })).toBeVisible();
    const geometry = await page.evaluate(`(() => {
      const width = window.visualViewport?.width ?? window.innerWidth;
      let offenderCount = 0;
      for (const element of document.querySelectorAll("#main-content *, .ry-mobile-bottom-nav > *")) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && (rect.left < -0.5 || rect.right > width + 0.5)) offenderCount += 1;
      }
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        offenderCount
      };
    })()`) as { clientWidth: number; scrollWidth: number; offenderCount: number };
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    expect(geometry.offenderCount).toBe(0);
  }
  expect(errors).toEqual([]);
});
