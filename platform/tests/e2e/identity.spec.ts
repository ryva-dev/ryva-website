import { expect, test } from "@playwright/test";

test("customer creates an identity-only account and can sign in", async ({ page }, testInfo) => {
  const email = `identity-${testInfo.project.name}-${Date.now()}@example.test`;
  const password = "A secure browser password 2026!";
  await page.goto("/create-account");
  await expect(page.getByRole("heading", { name: "Create your Ryva account." })).toBeVisible();
  await expect(page.getByText("It does not purchase or unlock a Ryva product.")).toBeVisible();
  await page.getByLabel("First name").fill("Browser");
  await page.getByLabel("Last name").fill("Customer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByLabel(/I agree to Ryva’s Terms of Service/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Account created" })).toBeVisible();
  await page.getByRole("link", { name: "Continue to sign in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole("heading", { name: /Step inside The Ryva Program/i })).toBeVisible();
});

test("forgot-password response does not disclose account existence", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("heading", { name: "Reset your password." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send reset instructions" })).toBeEnabled();
  await page.getByLabel("Email").fill(`not-present-${Date.now()}@example.test`);
  await page.getByRole("button", { name: "Send reset instructions" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText("If an eligible account exists, password-reset instructions are on their way.")).toBeVisible();
});
