import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const password = "Synthetic!Passphrase2026";

async function captureIncrement8(page: Page, fileName: string, fullPage = false): Promise<void> {
  if (process.env.CAPTURE_INCREMENT_8_SCREENSHOTS !== "1") return;
  const path = fileURLToPath(new URL(`../../docs/ui-redesign-spec/screenshots/increment-8/${fileName}`, import.meta.url));
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

test("Product register preserves filters, catalog browsing, and no Product Score language", async ({ page }) => {
  await signIn(page);
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  await expect(page.getByText(/Product Score/i)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Product Intelligence results" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create product" })).toBeVisible();
  await captureIncrement8(page, "product-register-populated-desktop-1440x900.png", true);
  await expectNoMainOverflow(page);
});

test("Product register mobile rows navigate without document overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile layout coverage runs on the mobile project.");
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products");
  await expect(page.getByRole("region", { name: "Product Intelligence results" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create product" })).toBeVisible();
  await expectNoMainOverflow(page);
  await captureIncrement8(page, "product-register-populated-mobile-390x844.png", true);
});

test("Product detail preserves product detail and review workflows", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  await signIn(page);
  await page.goto("/brands");
  await page.getByRole("button", { name: "Create Brand" }).click();
  const brandCreate = page.getByRole("dialog").getByLabel("Create brand");
  await brandCreate.getByLabel("Brand name").fill(`Increment8 Brand ${suffix}`);
  await brandCreate.getByRole("button", { name: "Create brand" }).click();
  await page.goto("/products");
  await page.getByRole("button", { name: "Create product" }).click();
  const createForm = page.getByRole("dialog").getByLabel("Create unqualified Product");
  await createForm.getByLabel("Name", { exact: true }).fill(`Increment8 Product ${suffix}`);
  await createForm.getByLabel("Brand").selectOption({ label: "Increment8 Brand" });
  await createForm.getByLabel("Category").fill("Gift");
  await createForm.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByRole("heading", { name: "Increment8 Product" })).toBeVisible();
  await expect(page.getByText(/Product Score/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to products" })).toBeVisible();
  await page.getByRole("tab", { name: "Product details" }).click();
  const detailsPanel = page.getByRole("tabpanel", { name: /Product details/ });
  await detailsPanel.getByLabel("Suggested retail").fill("24");
  await detailsPanel.getByRole("button", { name: "Save commercial" }).click();
  await expect(page.getByText("Commercial details saved.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Review" }).click();
  const reviewPanel = page.getByRole("tabpanel", { name: /Review/ });
  await expect(reviewPanel.getByLabel("Update type")).toBeVisible();
  await reviewPanel.getByLabel("Update type").selectOption({ label: "Sales signal" });
  await reviewPanel.getByLabel("Value", { exact: true }).fill("unknown");
  await reviewPanel.getByRole("button", { name: "Save update" }).click();
  await expect(page.getByText("Update saved.", { exact: true })).toBeVisible();
  await expect(reviewPanel.getByText("Sales Signal", { exact: true })).toBeVisible();
  await captureIncrement8(page, "product-detail-evidence-desktop-1440x900.png", true);
  if (testInfo.project.name.includes("mobile")) {
    await page.setViewportSize({ width: 390, height: 844 });
    await captureIncrement8(page, "product-detail-evidence-mobile-390x844.png", true);
  }
});

test("comparison creation and detail preserve no-score limits", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  await signIn(page);
  await page.goto("/brands");
  await page.getByRole("button", { name: "Create Brand" }).click();
  const brandCreate = page.getByRole("dialog").getByLabel("Create brand");
  await brandCreate.getByLabel("Brand name").fill(`Compare Brand ${suffix}`);
  await brandCreate.getByRole("button", { name: "Create brand" }).click();
  await page.goto("/products");
  const productIds: string[] = [];
  for (const label of [`Compare A ${suffix}`, `Compare B ${suffix}`]) {
    await page.getByRole("button", { name: "Create product" }).click();
    const createForm = page.getByRole("dialog").getByLabel("Create unqualified Product");
    await createForm.getByLabel("Name", { exact: true }).fill(label);
    await createForm.getByLabel("Brand").selectOption({ label: "Compare Brand" });
    await createForm.getByLabel("Category").fill("Gift");
    await createForm.getByRole("button", { name: "Create product" }).click();
    await expect(page.getByRole("heading", { name: label.replace(/\s+chromium-(?:desktop|mobile)-\d+$/i, "").trim() })).toBeVisible();
    const productId = page.url().match(/\/products\/([^/?#]+)/)?.[1];
    expect(productId).toBeTruthy();
    productIds.push(String(productId));
    await page.goto("/products");
  }
  await page.goto(`/app/products/compare?ids=${productIds.join(",")}`);
  await expect(page.getByRole("heading", { name: "Compare products" })).toBeVisible();
  await captureIncrement8(page, "product-comparison-create-desktop-1440x900.png", true);
  await page.getByRole("button", { name: "Save comparison", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Comparison details" })).toBeVisible();
  await page.getByRole("dialog", { name: "Comparison details" }).getByRole("button", { name: "Save comparison" }).click();
  await expect(page.getByRole("heading", { name: "Product diligence comparison" })).toBeVisible();
  await expect(page.getByText(/No numerical Product Score or ranking is calculated/i)).toBeVisible();
  await expect(page.getByText(/Interpretation limits/)).toBeVisible();
  await captureIncrement8(page, "product-comparison-populated-desktop-1440x900.png", true);
  if (testInfo.project.name.includes("mobile")) {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel("Focus Product")).toBeVisible();
    await expectNoMainOverflow(page);
    await captureIncrement8(page, "product-comparison-populated-mobile-390x844.png", true);
  }
});

test("generic Product routes reuse canonical Product Intelligence patterns", async ({ page }) => {
  await signIn(page);
  await page.goto("/records/product");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  await expect(page.getByText("Generic Product register compatibility")).toBeVisible();
});

test("read-only Product sessions expose restricted messaging", async ({ page }) => {
  await signIn(page, "mentor-readonly@synthetic.ryva.test");
  await page.goto("/products");
  await expect(page.getByText("Read-only Product Intelligence")).toBeVisible();
  await captureIncrement8(page, "product-register-restricted-desktop-1440x900.png", true);
});

test("empty Product view stays honest without fabricated records", async ({ page }) => {
  await signIn(page, "canceled-paid@synthetic.ryva.test");
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  await expect(page.getByText(/No Products in this view|No Products match these filters/)).toBeVisible();
  await captureIncrement8(page, "product-register-empty-desktop-1440x900.png", true);
});
