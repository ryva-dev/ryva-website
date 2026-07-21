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

test("Product register preserves filters, comparison selection, and no Product Score language", async ({ page }) => {
  await signIn(page);
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  await expect(page.getByText(/No numerical ranking is calculated/)).toBeVisible();
  await expect(page.getByText(/Product Score/i)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Product Intelligence results" })).toBeVisible();
  await expect(page.getByLabel("Create unqualified Product")).toBeVisible();
  await captureIncrement8(page, "product-register-populated-desktop-1440x900.png", true);
  await expectNoMainOverflow(page);
});

test("Product register mobile rows navigate without document overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile layout coverage runs on the mobile project.");
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products");
  await expect(page.getByRole("region", { name: "Product Intelligence results" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Create unqualified Product" })).toBeVisible();
  await expectNoMainOverflow(page);
  await captureIncrement8(page, "product-register-populated-mobile-390x844.png", true);
});

test("Product detail preserves evidence and observation workflows", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  await signIn(page);
  await page.goto("/brands");
  await page.getByLabel("Name", { exact: true }).fill(`Increment8 Brand ${suffix}`);
  await page.getByRole("button", { name: "Create unqualified record" }).click();
  await page.goto("/products");
  const createForm = page.getByRole("region", { name: "Create unqualified Product" });
  await createForm.getByLabel("Name", { exact: true }).fill(`Increment8 Product ${suffix}`);
  await createForm.getByLabel("Brand").selectOption({ label: `Increment8 Brand ${suffix}` });
  await createForm.getByLabel("Category").fill("Gift");
  await createForm.getByRole("button", { name: "Create unqualified record" }).click();
  await expect(page.getByRole("heading", { name: `Increment8 Product ${suffix}` })).toBeVisible();
  await expect(page.getByText(/Product Score/i)).toHaveCount(0);
  await page.getByRole("tab", { name: "Evidence" }).click();
  const evidencePanel = page.getByRole("tabpanel", { name: /Evidence/ });
  await evidencePanel.getByLabel("Exact claim or unknown").fill("Reorder evidence is not yet available.");
  await evidencePanel.getByRole("button", { name: "Add evidence" }).click();
  await expect(page.getByText("Evidence was recorded.", { exact: true })).toBeVisible();
  await expect(evidencePanel.getByRole("listitem").filter({ hasText: "Reorder evidence is not yet available." })).toBeVisible();
  await expect(evidencePanel.getByLabel("Exact claim or unknown")).toHaveValue("");
  await page.getByRole("tab", { name: "Qualification" }).click();
  const qualificationPanel = page.getByRole("tabpanel", { name: /Qualification/ });
  await expect(qualificationPanel.getByLabel("Metric")).toBeVisible();
  await qualificationPanel.getByLabel("Metric").fill("repeat_purchase");
  await qualificationPanel.getByLabel("Value", { exact: true }).fill("unknown");
  await qualificationPanel.getByRole("button", { name: "Record observation" }).click();
  await expect(page.getByText("Observation was recorded.", { exact: true })).toBeVisible();
  await expect(qualificationPanel.getByText("repeat_purchase")).toBeVisible();
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
  await page.getByLabel("Name", { exact: true }).fill(`Compare Brand ${suffix}`);
  await page.getByRole("button", { name: "Create unqualified record" }).click();
  await page.goto("/products");
  const createForm = page.getByRole("region", { name: "Create unqualified Product" });
  for (const label of [`Compare A ${suffix}`, `Compare B ${suffix}`]) {
    await createForm.getByLabel("Name", { exact: true }).fill(label);
    await createForm.getByLabel("Brand").selectOption({ label: `Compare Brand ${suffix}` });
    await createForm.getByLabel("Category").fill("Gift");
    await createForm.getByRole("button", { name: "Create unqualified record" }).click();
    await page.goto("/products");
  }
  const checkboxes = page.getByRole("checkbox", { name: /Compare Compare/ });
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await page.getByRole("link", { name: /Compare 2 products/ }).click();
  await expect(page.getByRole("heading", { name: "Create comparison" })).toBeVisible();
  await captureIncrement8(page, "product-comparison-create-desktop-1440x900.png", true);
  await page.getByRole("button", { name: "Create aligned comparison" }).click();
  await expect(page.getByRole("heading", { name: "Product diligence comparison" })).toBeVisible();
  await expect(page.getByText(/No numerical score/i)).toBeVisible();
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
  await signIn(page, "grace@synthetic.ryva.test");
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
