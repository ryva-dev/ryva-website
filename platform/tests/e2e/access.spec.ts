import { expect, test } from "@playwright/test";
import { navigateFromShell } from "./shell.js";

const password = "Synthetic!Passphrase2026";

test("eligible representative signs in and reaches the secure command surface", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("canceled-paid@synthetic.ryva.test");
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
});

test("account-only representative receives a clear access path", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("uncertified@synthetic.ryva.test");
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/access$/);
  await expect(page.getByRole("heading", { name: "Your Ryva access" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "account only", exact: true })).toBeVisible();
});

test("Program-enrolled representative lands in the reserved Program area", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("grace@synthetic.ryva.test");
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/program$/);
  await expect(page.getByRole("heading", { name: "Step inside brand placement." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Eight connected modules" })).toBeVisible();
});

test("representative creates and reviews a Brand Intelligence record", async ({ page }, testInfo) => {
  const recordName = `Synthetic Browser Brand ${testInfo.project.name}-${Date.now()}`;
  await page.goto("/login");
  await page.getByLabel("Email").fill("active@synthetic.ryva.test");
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await navigateFromShell(page, "Brands");
  await expect(page.getByRole("heading", { name: "Brand Intelligence", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create Brand" }).first().click();
  const brandCreate = page.getByRole("dialog").getByLabel("Create brand");
  await brandCreate.getByLabel("Brand name").fill(recordName);
  await brandCreate.getByRole("button", { name: "Create brand" }).click();
  await expect(page.getByRole("heading", { name: "Synthetic Browser Brand", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Brand research" }).click();
  const evidencePanel = page.getByRole("tabpanel", { name: /Brand research/ });
  await expect(evidencePanel.getByLabel("Finding / detail")).toBeVisible();
  await expect(evidencePanel.getByRole("button", { name: "Add finding" })).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await page.getByLabel("Search workspace").fill(recordName);
    await expect(page.getByRole("listbox", { name: "Search suggestions" })).toBeVisible();
    await expect(page.getByRole("option").filter({ hasText: "Browser Brand" })).toBeVisible();
  }
});

test("representative completes Product Intelligence research and comparison setup", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  await page.goto("/login");
  await page.getByLabel("Email").fill("active@synthetic.ryva.test");
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await navigateFromShell(page, "Brands");
  await page.getByRole("button", { name: "Create Brand" }).first().click();
  const brandCreate = page.getByRole("dialog").getByLabel("Create brand");
  await brandCreate.getByLabel("Brand name").fill(`Synthetic Product Parent ${suffix}`);
  await brandCreate.getByRole("button", { name: "Create brand" }).click();
  await expect(page.getByRole("heading", { name: "Synthetic Product Parent", exact: true })).toBeVisible();
  await navigateFromShell(page, "Products");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  await page.getByRole("button", { name: "Create product" }).click();
  const productCreate = page.getByRole("dialog").getByLabel("Create unqualified Product");
  await productCreate.getByLabel("Name", { exact: true }).fill(`Synthetic Product A ${suffix}`);
  await productCreate.getByLabel("Brand").selectOption({ label: "Synthetic Product Parent" });
  await productCreate.getByLabel("Category").fill("Gift");
  await productCreate.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByRole("heading", { name: "Product A" })).toBeVisible();
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
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Product Intelligence results" }).getByRole("button", { name: /Preview Product A/i }).first()).toBeVisible();
  await expect(page.getByText(/Product Score/i)).toHaveCount(0);
});

test("representative creates a Buyer Intelligence record with visible qualification ownership", async ({ page }, testInfo) => {
  const name = `Synthetic Buyer Workspace ${testInfo.project.name}-${Date.now()}`;
  await page.goto("/login");
  await page.getByLabel("Email").fill("active@synthetic.ryva.test");
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await navigateFromShell(page, "Businesses & Buyers");
  await expect(page.getByRole("heading", { name: "Buyer Intelligence" })).toBeVisible();
  await page.getByRole("button", { name: "Create business" }).click();
  const create = page.getByRole("dialog").getByLabel("Create unqualified Business");
  await create.getByLabel("Name", { exact: true }).fill(name);
  await create.getByLabel("Business type").fill("Independent gift shop");
  await create.getByRole("button", { name: "Create unqualified record" }).click();
  await expect(page.getByRole("heading", { name: "Buyer Workspace" })).toBeVisible();
  await page.getByRole("tab", { name: "Qualification" }).click();
  await expect(page.getByRole("heading", { name: "Qualification review" })).toBeVisible();
  await page.getByRole("tab", { name: "Research" }).click();
  const researchPanel = page.getByRole("tabpanel", { name: /Research/ });
  await researchPanel.getByLabel("Research note").fill("Decision-maker authority has not been verified.");
  await researchPanel.getByRole("button", { name: "Add research note" }).click();
  await expect(page.getByText("Research note added.", { exact: true })).toBeVisible();
  await expect(researchPanel.getByRole("listitem").filter({ hasText: "Decision-maker authority has not been verified." })).toBeVisible();
});
