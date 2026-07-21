import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const password = "Synthetic!Passphrase2026";

async function captureIncrement10(page: Page, fileName: string, fullPage = false): Promise<void> {
  if (process.env.CAPTURE_INCREMENT_10_SCREENSHOTS !== "1") return;
  const path = fileURLToPath(new URL(`../../docs/ui-redesign-spec/screenshots/increment-10/${fileName}`, import.meta.url));
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

test("Buyer register preserves Business/Buyer/Contact distinctions and create labels", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await signIn(page);
  await page.goto("/buyers");
  await expect(page.getByRole("heading", { name: "Buyer Intelligence" })).toBeVisible();
  await expect(page.getByText(/Business, Buyer, and Contact are distinct/i)).toBeVisible();
  await expect(page.getByRole("region", { name: "Buyer Intelligence results" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Create unqualified Business" })).toBeVisible();
  await captureIncrement10(page, "buyer-register-populated-desktop-1440x900.png", true);
  await expectNoMainOverflow(page);
  expect(consoleErrors).toEqual([]);
});

test("Buyer register mobile rows navigate without document overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile layout coverage runs on the mobile project.");
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buyers");
  await expect(page.getByRole("region", { name: "Buyer Intelligence results" })).toBeVisible();
  await expectNoMainOverflow(page);
  await captureIncrement10(page, "buyer-register-populated-mobile-390x844.png", true);
});

test("Buyer detail preserves Contacts, Buyers, fit, and authority boundaries", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const isMobile = testInfo.project.name.includes("mobile");
  await signIn(page);
  await page.goto("/buyers");
  const create = page.getByRole("region", { name: "Create unqualified Business" });
  await create.getByLabel("Name", { exact: true }).fill(`Increment10 Business ${suffix}`);
  await create.getByLabel("Business type").fill("Independent retailer");
  await create.getByRole("button", { name: "Create unqualified record" }).click();
  await expect(page.getByRole("heading", { name: `Increment10 Business ${suffix}` })).toBeVisible();
  await expect(page.getByText(/qualification and authority are human-owned/i).first()).toBeVisible();
  if (isMobile) {
    await page.getByRole("button", { name: "Review context" }).click();
    await expect(page.getByRole("dialog").getByText("Representation authority is not established by a Business record.")).toBeVisible();
    await page.keyboard.press("Escape");
    await captureIncrement10(page, "buyer-detail-populated-mobile-390x844.png", true);
  } else {
    await captureIncrement10(page, "buyer-detail-populated-desktop-1440x900.png", true);
  }
  await expect(page.getByRole("heading", { name: "Call preparation" })).toBeVisible();
  await page.getByRole("tab", { name: "Evidence" }).click();
  const evidencePanel = page.getByRole("tabpanel", { name: /Evidence/ });
  await evidencePanel.getByLabel("Exact claim or unknown").fill("Buyer purchasing authority has not been verified.");
  await evidencePanel.getByRole("button", { name: "Add evidence" }).click();
  await expect(page.getByText("Evidence was recorded.", { exact: true })).toBeVisible();
  await expect(evidencePanel.getByRole("listitem").filter({ hasText: "Buyer purchasing authority has not been verified." })).toBeVisible();
  await captureIncrement10(page, isMobile ? "buyer-detail-evidence-mobile-390x844.png" : "buyer-detail-evidence-desktop-1440x900.png", true);
  await page.getByRole("tab", { name: /Contacts/ }).click();
  await expect(page.getByRole("heading", { name: "Professional contacts" })).toBeVisible();
  await page.getByRole("tab", { name: /Buyers/ }).click();
  await expect(page.getByRole("heading", { name: "Buyer profiles and authority" })).toBeVisible();
  if (!isMobile) {
    await captureIncrement10(page, "buyer-detail-buyers-desktop-1440x900.png", true);
  }
  await page.getByRole("tab", { name: "Qualification" }).click();
  await expect(page.getByRole("heading", { name: "Human decision gate" })).toBeVisible();
});

test("generic Business and Contact routes reuse canonical workspaces", async ({ page }) => {
  await signIn(page);
  await page.goto("/records/business");
  await expect(page.getByRole("heading", { name: "Buyer Intelligence" })).toBeVisible();
  await expect(page.getByText("Generic Business register compatibility")).toBeVisible();
  await page.goto("/records/contact");
  await expect(page.getByRole("heading", { name: "Contact register", exact: true })).toBeVisible();
  await expect(page.getByText("Generic Contact register compatibility")).toBeVisible();
  await page.goto("/records/brand");
  await expect(page.getByRole("heading", { name: "Brand Intelligence" })).toBeVisible();
  await page.goto("/records/product");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
});

test("read-only Buyer sessions expose restricted messaging", async ({ page }) => {
  await signIn(page, "grace@synthetic.ryva.test");
  await page.goto("/buyers");
  await expect(page.getByText("Read-only Buyer Intelligence")).toBeVisible();
  await captureIncrement10(page, "buyer-register-restricted-desktop-1440x900.png", true);
});

test("empty Buyer view stays honest without fabricated records", async ({ page }) => {
  await signIn(page, "canceled-paid@synthetic.ryva.test");
  await page.goto("/buyers");
  await expect(page.getByRole("heading", { name: "Buyer Intelligence" })).toBeVisible();
  await expect(page.getByText(/No Businesses in this view|No Businesses match these filters|No Buyers/i)).toBeVisible();
  await captureIncrement10(page, "buyer-register-empty-desktop-1440x900.png", true);
});

test("Contact detail preserves call preparation and Increment 5 verification boundaries", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const isMobile = testInfo.project.name.includes("mobile");
  await signIn(page);
  await page.goto("/buyers");
  const create = page.getByRole("region", { name: "Create unqualified Business" });
  await create.getByLabel("Name", { exact: true }).fill(`Call Prep Business ${suffix}`);
  await create.getByLabel("Business type").fill("Specialty retailer");
  await create.getByRole("button", { name: "Create unqualified record" }).click();
  await expect(page.getByRole("heading", { name: `Call Prep Business ${suffix}` })).toBeVisible();
  await page.getByRole("tab", { name: /Contacts/ }).click();
  const contactsPanel = page.getByRole("tabpanel", { name: /Contacts/ });
  await contactsPanel.getByLabel("Name", { exact: true }).fill(`Call Prep Contact ${suffix}`);
  await contactsPanel.getByLabel("Role").fill("Category Buyer");
  await contactsPanel.getByLabel("Professional email").fill(`callprep-${suffix}@synthetic.ryva.test`);
  await contactsPanel.getByRole("button", { name: /Add unverified contact/i }).click();
  await expect(page.getByText(/Unverified professional contact was recorded|Contact was recorded/i)).toBeVisible();
  await contactsPanel.getByRole("link", { name: `Call Prep Contact ${suffix}` }).click();
  await expect(page.getByRole("heading", { name: `Call Prep Contact ${suffix}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Call preparation" })).toBeVisible();
  if (isMobile) {
    await page.getByRole("button", { name: "Review context" }).click();
    await expect(page.getByRole("dialog").getByText(/A Contact record never establishes Brand, Product, territory, channel, or Buyer Outreach authority/)).toBeVisible();
    await captureIncrement10(page, "contact-detail-call-prep-mobile-390x844.png", true);
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByText(/A Contact record never establishes Brand, Product, territory, channel, or Buyer Outreach authority/)).toBeVisible();
    await captureIncrement10(page, "contact-detail-call-prep-desktop-1440x900.png", true);
  }
});
