import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const password = "Synthetic!Passphrase2026";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("active@synthetic.ryva.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

test("representative can reach the server-backed Representation authority workspace", async ({ page }) => {
  await login(page);
  await page.goto("/representation");
  await expect(page.getByRole("heading", { name: "Representation", exact: true })).toBeVisible();
  await expect(page.getByText(/uploaded agreement as permission/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Representation Opportunities" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Representation Agreements" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open a Representation Opportunity" })).toBeVisible();
  await expect(page.getByLabel("Contact Ready Brand")).toBeVisible();
});

test("representative sees Placement authority and Relationship Triangle gates", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("/placements");
  await expect(page.getByRole("heading", { name: "Placement Opportunities" })).toBeVisible();
  await expect(page.getByText(/three-party value/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create a Placement Opportunity" })).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Create Placement" }).click();
    await expect(page.getByRole("dialog").getByLabel("Active Agreement")).toBeVisible();
    await expect(page.getByRole("dialog").getByLabel("Concrete Buyer value")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/Brand, Business Buyer, and Representative/i)).toBeVisible();
  } else {
    await expect(page.getByLabel("Active Agreement")).toBeVisible();
    await expect(page.getByLabel("Concrete Buyer value")).toBeVisible();
    await expect(page.getByText(/Brand, Business Buyer, and Representative/i)).toBeVisible();
  }
});
