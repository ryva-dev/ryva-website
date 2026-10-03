import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const password = "Synthetic!Passphrase2026";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("active@synthetic.ryva.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

test("representative can reach the server-backed Representation authority workspace", async ({ page }) => {
  await login(page);
  await page.goto("/representation");
  await expect(page.getByRole("heading", { name: "Representation", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Representation Opportunities" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Representation Agreements" })).toBeVisible();
  await page.getByRole("button", { name: "Open opportunity" }).first().click();
  const createDrawer = page.getByRole("dialog", { name: "Open a Representation Opportunity" });
  await expect(createDrawer).toBeVisible();
  await expect(createDrawer.getByRole("combobox").first()).toBeVisible();
});

test("representative sees Placement authority and Relationship Triangle gates", async ({ page }) => {
  await login(page);
  await page.goto("/placements");
  await expect(page.getByRole("heading", { name: "Placement Opportunities" })).toBeVisible();
  await page.getByRole("button", { name: "Create Placement" }).click();
  const createDialog = page.getByRole("dialog");
  await expect(createDialog.getByLabel("Active Agreement")).toBeVisible();
  await expect(createDialog.getByLabel("Concrete Buyer value")).toBeVisible();
  await expect(createDialog.getByText(/Brand, Business Buyer, and Representative/i)).toBeVisible();
});
