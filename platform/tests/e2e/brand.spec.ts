import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const password = "Synthetic!Passphrase2026";

async function captureIncrement9(page: Page, fileName: string, fullPage = false): Promise<void> {
  if (process.env.CAPTURE_INCREMENT_9_SCREENSHOTS !== "1") return;
  const path = fileURLToPath(new URL(`../../docs/ui-redesign-spec/screenshots/increment-9/${fileName}`, import.meta.url));
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

test("Brand register preserves filters, create labels, and authority boundary language", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await signIn(page);
  await page.goto("/brands");
  await expect(page.getByRole("heading", { name: "Brand Intelligence" })).toBeVisible();
  await expect(page.getByText(/does not imply outreach permission or representation authority/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Brand Intelligence results" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Create unqualified Brand" })).toBeVisible();
  await captureIncrement9(page, "brand-register-populated-desktop-1440x900.png", true);
  await expectNoMainOverflow(page);
  expect(consoleErrors).toEqual([]);
});

test("Brand register mobile rows navigate without document overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile layout coverage runs on the mobile project.");
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/brands");
  await expect(page.getByRole("region", { name: "Brand Intelligence results" })).toBeVisible();
  await expectNoMainOverflow(page);
  await captureIncrement9(page, "brand-register-populated-mobile-390x844.png", true);
});

test("Brand detail preserves evidence, products, and representation readiness boundaries", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  await signIn(page);
  await page.goto("/brands");
  const brandCreate = page.getByRole("region", { name: "Create unqualified Brand" });
  await brandCreate.getByLabel("Name", { exact: true }).fill(`Increment9 Brand ${suffix}`);
  await brandCreate.getByRole("button", { name: "Create unqualified record" }).click();
  await expect(page.getByRole("heading", { name: `Increment9 Brand ${suffix}` })).toBeVisible();
  const isMobile = testInfo.project.name.includes("mobile");
  if (isMobile) {
    await page.getByRole("button", { name: "Review context" }).click();
    await expect(page.getByRole("dialog").getByText(/Representation readiness is not active Agreement authority/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await captureIncrement9(page, "brand-detail-populated-mobile-390x844.png", true);
  } else {
    await expect(page.getByText(/Representation readiness is not active Agreement authority/)).toBeVisible();
    await captureIncrement9(page, "brand-detail-populated-desktop-1440x900.png", true);
  }
  await page.getByRole("tab", { name: "Evidence" }).click();
  const evidencePanel = page.getByRole("tabpanel", { name: /Evidence/ });
  await evidencePanel.getByLabel("Exact claim or unknown").fill("Wholesale terms have not yet been supplied.");
  await evidencePanel.getByRole("button", { name: "Add evidence" }).click();
  await expect(page.getByText("Evidence was recorded.", { exact: true })).toBeVisible();
  await expect(evidencePanel.getByRole("listitem").filter({ hasText: "Wholesale terms have not yet been supplied." })).toBeVisible();
  await captureIncrement9(page, isMobile ? "brand-detail-evidence-mobile-390x844.png" : "brand-detail-evidence-desktop-1440x900.png", true);
  await page.getByRole("tab", { name: "Products" }).click();
  await expect(page.getByText(/do not create Brand authority/)).toBeVisible();
  if (!isMobile) {
    await captureIncrement9(page, "brand-detail-products-desktop-1440x900.png", true);
  }
  await page.getByRole("tab", { name: "Representation" }).click();
  await expect(page.getByRole("heading", { name: "Representation readiness versus authority" })).toBeVisible();
  await expect(page.getByText(/Authority not established here/)).toBeVisible();
  await captureIncrement9(page, isMobile ? "brand-detail-representation-mobile-390x844.png" : "brand-detail-representation-desktop-1440x900.png", true);
});

test("generic Brand routes reuse canonical Brand Intelligence patterns", async ({ page }) => {
  await signIn(page);
  await page.goto("/records/brand");
  await expect(page.getByRole("heading", { name: "Brand Intelligence" })).toBeVisible();
  await expect(page.getByText("Generic Brand register compatibility")).toBeVisible();
  await page.goto("/records/product");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  await expect(page.getByText("Generic Product register compatibility")).toBeVisible();
});

test("read-only Brand sessions expose restricted messaging", async ({ page }) => {
  await signIn(page, "grace@synthetic.ryva.test");
  await page.goto("/brands");
  await expect(page.getByText("Read-only Brand Intelligence")).toBeVisible();
  await captureIncrement9(page, "brand-register-restricted-desktop-1440x900.png", true);
});

test("empty Brand view stays honest without fabricated records", async ({ page }) => {
  await signIn(page, "canceled-paid@synthetic.ryva.test");
  await page.goto("/brands");
  await expect(page.getByRole("heading", { name: "Brand Intelligence" })).toBeVisible();
  await expect(page.getByText(/No Brands in this view|No Brands match these filters/)).toBeVisible();
  await captureIncrement9(page, "brand-register-empty-desktop-1440x900.png", true);
});
