import { expect, test, type Page } from "@playwright/test";

const password = "Synthetic!Passphrase2026";

async function signIn(page: Page, email = "active@synthetic.ryva.test"): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)|Your Ryva Pro access/ })).toBeVisible();
}

test("Source and Territory pilots preserve mutation contracts inside accessible drawers", async ({ page }, testInfo) => {
  await signIn(page);
  const suffix = `${testInfo.project.name}-${Date.now()}`;

  await page.goto("/sources");
  const createSource = page.getByRole("button", { name: "Register source", exact: true }).first();
  await createSource.click();
  const sourceDrawer = page.getByRole("dialog", { name: "Register evidence Source" });
  await expect(sourceDrawer).toBeVisible();
  await sourceDrawer.getByRole("textbox", { name: /^Reference Required$/ }).fill(`Synthetic retailer brief ${suffix}`);
  await sourceDrawer.getByLabel("Owner or provider").fill("Ryva synthetic fixture");
  await sourceDrawer.getByLabel("URL").fill("https://example.invalid/synthetic-source");
  await sourceDrawer.getByRole("button", { name: "Register source" }).click();
  const sourceIdentity = page.getByRole("button", { name: `Synthetic retailer brief ${suffix}` });
  await expect(sourceIdentity).toBeVisible();
  await sourceIdentity.click();
  await expect(page.getByRole("dialog", { name: `Synthetic retailer brief ${suffix}` })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sourceIdentity).toBeFocused();

  await page.goto("/territories");
  await page.getByRole("button", { name: "Propose territory", exact: true }).first().click();
  const territoryDrawer = page.getByRole("dialog", { name: "Propose territory" });
  await territoryDrawer.getByLabel("Name").fill(`Synthetic Northeast ${suffix}`);
  await territoryDrawer.getByLabel("Scope type").selectOption("geography");
  await territoryDrawer.getByLabel("Scope description").fill("Synthetic proposal for New York and New Jersey specialty retail only.");
  await territoryDrawer.getByRole("button", { name: "Save proposal" }).click();
  await expect(page.getByRole("button", { name: `Synthetic Northeast ${suffix}` })).toBeVisible();
  await expect(page.getByText(testInfo.project.name.includes("mobile") ? "not authorized" : "Agreement required").filter({ visible: true }).first()).toBeVisible();
});

test("register filtering, saved views, structured mobile rows, and route states remain usable", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await signIn(page);
  await page.goto("/sources");

  const mobile = testInfo.project.name.includes("mobile");
  if (mobile) {
    await page.getByRole("button", { name: "Filters" }).click();
    const filterDrawer = page.getByRole("dialog", { name: "Filter results" });
    await expect(filterDrawer).toBeVisible();
    await filterDrawer.getByLabel("Search Sources").fill("no-source-can-match-this-query");
    await filterDrawer.getByRole("button", { name: "Close" }).click();
  } else {
    await page.getByLabel("Search Sources").fill("no-source-can-match-this-query");
  }
  await expect(page.getByText("No Sources match these filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();

  if (!mobile) {
    await page.getByLabel("Saved view name").fill(`Synthetic view ${testInfo.project.name}`);
    await page.getByRole("button", { name: "Save view" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Saved Synthetic view/ })).toBeVisible();
  }

  for (const [route, heading] of [["/territories", "Territories"], ["/documents", "Documents"], ["/tasks", "Tasks"], ["/notifications", "Notifications"]] as const) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    const overflow = await page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth");
    expect(overflow).toBe(false);
  }
  expect(consoleErrors).toEqual([]);
});

test("read-only sessions inspect register truth without mutation affordances", async ({ page }) => {
  await signIn(page, "grace@synthetic.ryva.test");
  await page.goto("/sources");
  await expect(page.getByRole("heading", { name: "Sources", level: 1 })).toBeVisible();
  await expect(page.getByText("You may inspect permitted provenance")).toBeVisible();
  await expect(page.getByRole("button", { name: "Register source", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save view" })).toHaveCount(0);
});

test("register API failures preserve page identity and provide a recovery action", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "The shared recovery state is exercised once in desktop Chromium.");
  await signIn(page);
  await page.route("**/api/sources", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({
        type: "synthetic_register_failure",
        title: "Source provider unavailable",
        detail: "Synthetic register failure for recovery-state verification."
      })
    });
  });

  await page.goto("/sources");
  await expect(page.getByRole("heading", { name: "Sources", level: 1 })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Synthetic register failure for recovery-state verification.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("migrated registers reflow at exact mobile widths without clipped controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Exact CSS widths run once in desktop Chromium.");
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);

  for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 812 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    for (const route of ["/sources", "/territories", "/documents", "/tasks", "/notifications"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const geometry = await page.evaluate(`(() => {
        const width = window.visualViewport?.width ?? window.innerWidth;
        let offenderCount = 0;
        for (const element of document.querySelectorAll("#main-content *, .ry-mobile-bottom-nav > *")) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && (rect.left < -0.5 || rect.right > width + 0.5)) offenderCount += 1;
        }
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          offenderCount
        };
      })()`) as { clientWidth: number; scrollWidth: number; offenderCount: number };
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
      expect(geometry.offenderCount).toBe(0);
    }
  }
  expect(errors).toEqual([]);
});
