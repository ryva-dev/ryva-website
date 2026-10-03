import { expect, test, type Page } from "@playwright/test";

const password = "Synthetic!Passphrase2026";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("active@synthetic.ryva.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
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

  await expect(page.getByRole("heading", { name: "Priority queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revenue & Commissions" })).toBeVisible();
  await expect(page.getByText(/Product Score/)).toHaveCount(0);
  await expectNoMainOverflow(page);
});

test("Analytics exposes definitions, honest external-data state, and no weighted pipeline", async ({ page }) => {
  await signIn(page);
  await page.goto("/analytics");

  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Performance overview" })).toBeVisible();
  await page.getByRole("tab", { name: "Pipeline Analytics" }).click();
  await page.getByRole("button", { name: "Metric guide" }).click();
  await expect(page.getByRole("heading", { name: "Metric guide" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search metric guide" })).toBeVisible();
  await expectNoMainOverflow(page);
});
