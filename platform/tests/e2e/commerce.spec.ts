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

async function expectNoViewportLoss(page: Page) {
  const overflow = await page.evaluate(() => {
    const currentDocument = (globalThis as unknown as {
      document: { documentElement: { scrollWidth: number; clientWidth: number } };
    }).document;
    return currentDocument.documentElement.scrollWidth >
      currentDocument.documentElement.clientWidth + 2;
  });
  expect(overflow).toBe(false);
}

test("Accounts and protection expose documentary-rights and human-health workflows", async ({ page }) => {
  await login(page);
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: "Protected Accounts and operational Accounts" })).toBeVisible();
  await expect(page.getByText(/do not create contractual rights/i)).toBeVisible();
  await expect(page.getByLabel("Account status")).toBeVisible();
  await page.getByRole("link", { name: "Protection", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Protected Accounts", exact: true })).toBeVisible();
  await expect(page.getByText(/does not create contractual protection/i)).toBeVisible();
  await expect(page.getByLabel("Protection status")).toBeVisible();
  await expectNoViewportLoss(page);
});

test("Orders expose source-backed multi-line entry and keep verification separate", async ({ page }) => {
  await login(page);
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Record an opening Order" })).toBeVisible();
  await expect(page.getByLabel("Order-discussion Placement")).toBeVisible();
  await expect(page.getByLabel("Clean source document")).toBeVisible();
  await expect(page.getByRole("group", { name: "Line 1" })).toBeVisible();
  await page.getByRole("button", { name: "Add line" }).click();
  await expect(page.getByRole("group", { name: "Line 2" })).toBeVisible();
  await expect(page.getByText(/Drafts and projections are excluded/i)).toBeVisible();
  await expectNoViewportLoss(page);
});

test("Reorders and Commissions clearly separate projections, approval, and currencies", async ({ page }) => {
  await login(page);
  await page.goto("/reorders");
  await expect(page.getByRole("heading", { name: "Reorders and account health" })).toBeVisible();
  await expect(page.getByText(/not guaranteed revenue/i)).toBeVisible();
  await page.getByRole("link", { name: "Commissions", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Commissions", exact: true })).toBeVisible();
  await expect(page.getByText(/Expected, verified, approved, payable, and paid values remain distinct/i)).toBeVisible();
  await expect(page.getByLabel("Commission status")).toBeVisible();
  await expectNoViewportLoss(page);
});

test("Commission Disputes retain human ownership and evidence-first empty states", async ({ page }) => {
  await login(page);
  await page.goto("/commission-disputes");
  await expect(page.getByRole("heading", { name: "Commission Disputes" })).toBeVisible();
  await expect(page.getByText(/does not adjudicate contractual rights/i)).toBeVisible();
  await expect(page.getByLabel("Dispute status")).toBeVisible();
  await expect(page.getByText(/Open one from a Commission variance/i)).toBeVisible();
  await expectNoViewportLoss(page);
});
