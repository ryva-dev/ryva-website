import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const password = "Synthetic!Passphrase2026";

async function captureIncrement7(page: Page, fileName: string, fullPage = false): Promise<void> {
  if (process.env.CAPTURE_INCREMENT_7_SCREENSHOTS !== "1") return;
  const path = fileURLToPath(new URL(`../../docs/ui-redesign-spec/screenshots/increment-7/${fileName}`, import.meta.url));
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage, animations: "disabled" });
}

async function signIn(page: Page, email = "active@synthetic.ryva.test"): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

async function expectNoMainOverflow(page: Page): Promise<void> {
  const width = await page.evaluate(`({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  })`) as { viewport: number; document: number };
  expect(width.document).toBeLessThanOrEqual(width.viewport + 1);
}

test("Home command center preserves explainable priorities, currency separation, and analytics path", async ({ page }) => {
  await signIn(page);
  await expect(page.getByText("Rule-based · reasons visible · no scores")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Priority queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Material changes since last visit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Currency-separated actuals and obligations" })).toBeVisible();
  await expect(page.getByText(/Product Score/)).toHaveCount(0);
  await page.getByRole("link", { name: "Open Analytics" }).click();
  await expect(page.getByRole("heading", { name: "Analytics Command Center" })).toBeVisible();
  await page.goto("/");
  await expectNoMainOverflow(page);
  await captureIncrement7(page, "home-populated-desktop-1440x900.png", true);
});

test("Home exposes expandable priority reasons and responsive attention ordering", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await signIn(page);

  const reasonToggle = page.getByText("Why this is prioritized").first();
  if (await reasonToggle.count()) {
    await reasonToggle.click();
    await expect(page.locator("details[open]")).toBeVisible();
  }

  if (testInfo.project.name.includes("mobile")) {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel("Current relationship action")).toBeVisible();
    await captureIncrement7(page, "home-populated-mobile-390x844.png", true);
  } else {
    await page.setViewportSize({ width: 1024, height: 768 });
    await expectNoMainOverflow(page);
  }

  expect(consoleErrors).toEqual([]);
});

test("empty workspace stays honest without manufactured activity", async ({ page }) => {
  await signIn(page, "canceled-paid@synthetic.ryva.test");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect(page.getByText(/No operating records yet|No urgent queue items/)).toBeVisible();
  await expect(page.getByText(/No verified commercial records/)).toBeVisible();
  await captureIncrement7(page, "home-empty-desktop-1440x900.png", true);
});

test("read-only sessions inspect Home truth without reprioritization affordances", async ({ page }) => {
  await signIn(page, "grace@synthetic.ryva.test");
  await expect(page.getByText("Read-only command center")).toBeVisible();
  await expect(page.getByText("Snooze 1 day")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Acknowledge viewed" })).toHaveCount(0);
  await captureIncrement7(page, "home-restricted-desktop-1440x900.png", true);
});

test("Home API failures preserve page identity and expose recovery", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Recovery state is exercised once in desktop Chromium.");
  await signIn(page);
  await page.route("**/api/home-command-center", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({
        type: "synthetic_home_failure",
        title: "Home unavailable",
        detail: "Synthetic Home failure for recovery-state verification."
      })
    });
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Synthetic Home failure");
  await page.unroute("**/api/home-command-center");
  await page.getByRole("button", { name: "Retry load" }).click();
  await expect(page.getByRole("heading", { name: "Priority queue" })).toBeVisible();
  await captureIncrement7(page, "home-error-desktop-1440x900.png", true);
});

test("AI degradation remains visible when briefing is unavailable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "AI degradation is captured once in desktop Chromium.");
  await signIn(page);
  await expect(page.getByText(/AI briefing is unavailable or disabled|Generate an explainable briefing/)).toBeVisible();
  await captureIncrement7(page, "home-ai-degraded-desktop-1440x900.png", true);
});
