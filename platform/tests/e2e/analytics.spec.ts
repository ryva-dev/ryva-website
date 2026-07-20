import { expect, test, type Page } from "@playwright/test";

const password = "Synthetic!Passphrase2026";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("active@synthetic.ryva.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

async function expectNoMainOverflow(page: Page): Promise<void> {
  const width = await page.evaluate(`({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  })`) as {viewport:number;document:number};
  expect(width.document).toBeLessThanOrEqual(width.viewport + 1);
}

test("Home is an explainable command center with an accessible Analytics path", async ({ page }) => {
  await signIn(page);

  await expect(page.getByText("Rule-based · reasons visible · no scores")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Priority queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Material changes since last visit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Currency-separated actuals and obligations" })).toBeVisible();
  await expect(page.getByText(/Product Score/)).toHaveCount(0);
  await expectNoMainOverflow(page);
});

test("Analytics exposes definitions, honest external-data state, and no weighted pipeline", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Open Analytics" }).click();

  await expect(page.getByRole("heading", { name: "Analytics Command Center" })).toBeVisible();
  await expect(page.getByText("No Product Score or hidden probability.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not Connected" })).toBeVisible();
  await expect(page.getByText(/No verified external intelligence is connected/)).toBeVisible();
  await page.getByRole("button", { name: "Pipeline Analytics" }).click();
  await expect(page.getByText("Weighted pipeline disabled")).toBeVisible();
  await page.getByRole("button", { name: "Metric Definitions" }).click();
  await expect(page.getByRole("heading", { name: "Expected commission" })).toBeVisible();
  await expect(page.getByText("Grouped by ISO currency; currencies are never combined.").first()).toBeVisible();
  await expectNoMainOverflow(page);
});
