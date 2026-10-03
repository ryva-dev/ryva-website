import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const password = "Synthetic!Passphrase2026";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/|$)/);
}

test("Program learner follows the editorial dashboard into a published lesson", async ({ page }) => {
  await login(page, "grace@synthetic.ryva.test");
  await expect(page).toHaveURL(/\/app\/program$/);
  await expect(page.getByRole("heading", { name: "Step inside brand placement." })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: /Program Progress: \d+%/ })).toBeVisible();
  await expect(page.getByText("program only", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Product access" })).toHaveCount(0);
  await page.getByRole("link", { name: "Inside Brand Placement" }).click();
  await expect(page.getByRole("heading", { name: "Inside Brand Placement", exact: true })).toBeVisible();
  await expect(page.locator(".ry-program-item-list > li")).toHaveCount(8);
  await expect(page.getByRole("link", { name: "Knowledge Check 1.1" })).toHaveCount(0);
  await page.getByRole("link", { name: "Welcome to The Ryva Program" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to The Ryva Program" })).toBeVisible();
  await expect(page.getByText("A learning experience", { exact: true })).toBeVisible();
  await expect(page.getByText("The Ryva Program is an independent industry education and guided-practice experience in brand placement.", { exact: true })).toBeVisible();
  await expect(page.getByText(/professional certification|occupational licensure/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Complete Section" })).toBeVisible();
});

test("Program learner completes a Module 1 knowledge check inline and continues", async ({ page }) => {
  await login(page, "grace@synthetic.ryva.test");
  await page.goto("/app/program/inside-brand-placement/what-brand-placement-is");
  await expect(page.getByRole("heading", { name: "1.1 What Brand Placement Is" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pause and review" })).toBeVisible();
  await expect(page.locator(".ry-program-knowledge-check textarea")).toHaveCount(0);
  const persistedRetry = page.getByRole("button", { name: "Try again" });
  if (await persistedRetry.isVisible()) await persistedRetry.click();
  await page.getByLabel("Advertising a product directly to consumers").check();
  for (const option of [
    "Customer profile",
    "Existing assortment",
    "Price architecture",
    "Category needs",
    "Inventory strategy",
    "Commercial priorities"
  ]) await page.getByLabel(option, { exact: true }).check();
  await page.getByLabel("True", { exact: true }).check();
  await page.getByRole("button", { name: "Review responses" }).click();
  await expect(page.locator(".ry-program-question-feedback.is-correct")).toHaveCount(1);
  await expect(page.locator(".ry-program-question-feedback.is-incorrect")).toHaveCount(2);
  await expect(page.getByText("Correct", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Not quite", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Retail fit depends on the retailer's customer, assortment, price architecture, category needs, inventory strategy, and commercial priorities.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to 1.2 The People in the Relationship" })).toBeVisible();
  await expect(page.getByText("Things to Notice", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".ry-program-question-feedback")).toHaveCount(0);
  await expect(page.getByLabel("Advertising a product directly to consumers")).not.toBeChecked();
  await expect(page.getByLabel("Customer profile", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("True", { exact: true })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Review responses" })).toBeVisible();
  await page.getByLabel("Connecting products with appropriate retail environments and developing the commercial relationship").check();
  for (const option of [
    "Customer profile",
    "Existing assortment",
    "Price architecture",
    "Category needs",
    "Inventory strategy",
    "Commercial priorities"
  ]) await page.getByLabel(option, { exact: true }).check();
  await page.getByLabel("False", { exact: true }).check();
  await page.getByRole("button", { name: "Review responses" }).click();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.locator(".ry-program-question-feedback.is-correct")).toHaveCount(3);
  await expect(page.locator(".ry-program-question-feedback.is-incorrect")).toHaveCount(0);
});

test("guided exercise uses the shared editorial activity layout", async ({ page }) => {
  await login(page, "grace@synthetic.ryva.test");
  await page.goto("/app/program/inside-brand-placement/map-the-relationship");
  await expect(page.getByRole("heading", { name: "Module 1 Guided Exercise — Map the Relationship" })).toBeVisible();
  await expect(page.locator(".ry-program-option-grid")).toHaveCount(6);
  await expect(page.locator(".ry-program-option-grid label")).toHaveCount(18);
  await expect(page.locator(".ry-program-activity-step")).toHaveCSS("border-top-style", "none");
  const textareaBox = await page.locator(".ry-program-field textarea").boundingBox();
  expect(textareaBox?.height).toBeGreaterThanOrEqual(96);
  expect(textareaBox?.height).toBeLessThanOrEqual(120);
  const firstGridLabels = page.locator(".ry-program-option-grid").first().locator("label");
  const firstRow = await Promise.all([0, 1, 2].map(async (index) => Math.round((await firstGridLabels.nth(index).boundingBox())?.y ?? 0)));
  if ((page.viewportSize()?.width ?? 0) <= 768) expect(new Set(firstRow).size).toBe(3);
  else expect(new Set(firstRow).size).toBe(1);
});

test("completed learner with inactive Pro keeps the Program on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "canceled-ended@synthetic.ryva.test");
  await expect(page).toHaveURL(/\/app\/program$/);
  await expect(page.getByRole("heading", { name: "The Ryva Program: Completed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "The Ryva Program" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Final Simulation" })).toBeVisible();
});
