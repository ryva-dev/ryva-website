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

test("Outreach Center exposes authority-checked human workflows and safe empty states", async ({ page }) => {
  await login(page);
  await page.goto("/outreach");
  await expect(page.getByRole("heading", { name: "Human-approved communication" })).toBeVisible();
  await expect(page.getByText(/never sends or calls autonomously/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Communication and activity" })).toBeVisible();
  await expect(
    page.getByText(/No outreach activity yet/i)
      .or(page.locator(".record-list .task-row").first())
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prepare outreach" })).toBeVisible();
  await expect(page.getByLabel("Prepared Placement")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Log a call" })).toBeVisible();
});

test("representative can create a versioned email template without granting send approval", async ({
  page
}, testInfo) => {
  await login(page);
  await page.goto("/outreach/templates");
  await expect(page.getByRole("heading", { name: "Versioned templates" })).toBeVisible();
  await page.getByLabel("Name").fill(`Synthetic Buyer Intro ${testInfo.project.name}`);
  await page.getByLabel("Channel").selectOption("email");
  await page.getByLabel("Purpose").fill("Synthetic browser acceptance only");
  await page.getByLabel("Subject").fill("A careful introduction for {{buyer_name}}");
  await page.getByLabel("Body").fill(
    "Hello {{buyer_name}}. This template is a starting point only. Reply or opt out at any time."
  );
  await page.getByLabel("Required variables").fill("buyer_name");
  await page.getByRole("button", { name: "Create immutable v1" }).click();
  await expect(page.getByRole("heading", {
    name: `Synthetic Buyer Intro ${testInfo.project.name}`
  })).toBeVisible();
  await expect(page.getByText("Version 1").last()).toBeVisible();
});

test("Sequences clearly preserve human approval and stop-condition boundaries", async ({ page }) => {
  await login(page);
  await page.goto("/outreach/sequences");
  await expect(page.getByRole("heading", { name: "Human-controlled sequences" })).toBeVisible();
  await expect(page.getByText(/never auto-send/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create a two-step sequence" })).toBeVisible();
  await expect(page.getByLabel("First-step email template")).toBeVisible();
  await expect(page.getByLabel("Follow-up review delay (minutes)")).toBeVisible();
});
