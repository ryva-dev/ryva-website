import { expect, test } from "@playwright/test";

test("a stranger can understand the product and find Mara", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hire AI workers into your business/i })).toBeVisible();
  await page.getByRole("button", { name: "Meet the workers" }).click();
  await expect(page).toHaveURL(/#workers$/);
  const maraCard = page.getByRole("article").filter({ hasText: "Mara Vale" });
  await expect(maraCard).toBeVisible();
  await expect(maraCard).toContainText("$79/mo");
});

test("legal and account entry points remain usable", async ({ page }) => {
  await page.goto("/#privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("the public navigation stays compact at tablet width", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto("/");
  const nav = page.locator(".navbar");
  await expect(nav).toBeVisible();
  expect((await nav.boundingBox())?.height).toBeLessThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(820);

  await page.goto("/#workers");
  expect((await nav.boundingBox())?.height).toBeLessThan(160);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(820);
});

test("a fresh customer can onboard, hire Mara, and reach the office", async ({ page }, testInfo) => {
  const device = testInfo.project.name.includes("mobile") ? "mobile" : "desktop";
  const email = `e2e-${device}-${testInfo.retry}@ryva.test`;
  const password = "Readiness-test-2026";
  let register = await page.request.post("/api/auth/register", {
    data: { name: "Readiness Creator", email, password }
  });
  if (register.status() === 409) {
    const login = await page.request.post("/api/auth/login", { data: { email, password } });
    expect(login.ok(), await login.text()).toBeTruthy();
    const cleanup = await page.request.post("/api/account/delete", { data: { password } });
    expect(cleanup.ok(), await cleanup.text()).toBeTruthy();
    register = await page.request.post("/api/auth/register", {
      data: { name: "Readiness Creator", email, password }
    });
  }
  expect(register.status()).toBe(201);

  const onboarding = await page.request.post("/api/onboarding/complete", {
    data: {
      name: "Readiness Creator",
      brandName: "Readiness Studio",
      whatYouDo: "I create conversion-focused skincare videos for growing brands."
    }
  });
  expect(onboarding.ok()).toBeTruthy();

  const checkout = await page.request.post("/api/payments/checkout", { data: { workerSlug: "mara-vale" } });
  expect(checkout.ok(), await checkout.text()).toBeTruthy();
  const checkoutPayload = await checkout.json();
  expect(checkoutPayload.adminBypass).toBe(true);

  const workerOnboarding = await page.request.post("/api/office/workers/mara-vale/onboarding/complete", {
    data: {
      answers: {
        niche_focus: "Evidence-led skincare videos for sensitive-skin customers.",
        dream_brands: "Science-backed skincare brands; exclude gambling and deceptive wellness.",
        current_workflow: "Brand email, spreadsheet tracker, filming calendar, then invoice.",
        workflow_breakdowns: "Follow-ups and usage-right deadlines are easiest to miss.",
        biggest_admin_drag: "Finding qualified brands and writing specific pitches.",
        email_volume: "Brand briefs, payment, and deadline changes are urgent.",
        reply_boundaries: "Draft and organize freely; never send without approval.",
        deadline_style: "Flag early and again the day before.",
        approval_rules: "Anything external, public, contractual, or involving money needs approval."
      },
      generatedSummary: ["Sensitive-skin skincare creator", "All external sends require approval"],
      knowledge: [{ title: "Creator positioning", items: ["Evidence-led sensitive-skin skincare creator"] }],
      tasks: [],
      briefing: {
        title: "Mara first day",
        dateLabel: "Today",
        summary: "Establish positioning, research boundaries, and the first qualified opportunities.",
        agenda: ["Positioning", "Research", "Outreach rules"],
        decisionsNeeded: ["Approve every external send"],
        recommendedActions: ["Connect Gmail after reviewing permissions"]
      },
      worklogEntry: { result: "Captured creator context and approval boundaries." }
    },
    timeout: 20_000
  });
  expect(workerOnboarding.ok(), await workerOnboarding.text()).toBeTruthy();

  // Completed onboarding must remain operable on short/mobile viewports: the
  // launch action lives inside the scrollable summary instead of being clipped.
  await page.goto("/#app/office/workers/mara-vale/onboarding");
  const startFirstDay = page.getByRole("button", { name: "Start first day" });
  await startFirstDay.scrollIntoViewIfNeeded();
  await expect(startFirstDay).toBeVisible();
  const startBox = await startFirstDay.boundingBox();
  expect(startBox && startBox.y + startBox.height).toBeLessThanOrEqual(page.viewportSize()!.height);

  await page.goto("/#app/office");
  await expect(page.getByText("Mara Vale", { exact: true }).first()).toBeVisible();
  await page.goto("/#app/office/workers/mara-vale/desk");
  await expect(page.getByText("Revenue journey", { exact: true })).toBeVisible();
  await expect(page.getByText(/Connect Gmail|Finish onboarding and connect Gmail/i).first()).toBeVisible();

  await page.goto("/#app/office/workers/mara-vale/intelligence");
  await expect(page.getByRole("heading", { name: "Your pipeline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Brand decisions" })).toBeVisible();
  await expect(page.getByText(/one current read per brand/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize()!.width);

  const cleanup = await page.request.post("/api/account/delete", { data: { password } });
  expect(cleanup.ok(), await cleanup.text()).toBeTruthy();
});
