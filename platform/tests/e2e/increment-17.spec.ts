import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { navigateFromShell } from "./shell.js";

const password = "Synthetic!Passphrase2026";

async function captureIncrement17(page: Page, fileName: string, fullPage = false): Promise<void> {
  if (process.env.CAPTURE_INCREMENT_17_SCREENSHOTS !== "1") return;
  const path = fileURLToPath(new URL(`../../docs/ui-redesign-spec/screenshots/increment-17/${fileName}`, import.meta.url));
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage, animations: "disabled" });
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const currentDocument = (globalThis as unknown as {
      document: { documentElement: { scrollWidth: number; clientWidth: number } };
    }).document;
    return currentDocument.documentElement.scrollWidth >
      currentDocument.documentElement.clientWidth + 2;
  });
  expect(overflow).toBe(false);
}

async function login(page: Page, email = "active@synthetic.ryva.test") {
  await page.goto("/login");
  await expect(page).toHaveTitle(/Sign in · Ryva Pro/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

const canonicalRoutes: Array<{ path: string; title: RegExp; heading?: RegExp | string }> = [
  { path: "/", title: /Home · Ryva Pro/, heading: /Good (morning|afternoon|evening)/ },
  { path: "/products", title: /Products · Ryva Pro/, heading: "Product Intelligence" },
  { path: "/brands", title: /Brands · Ryva Pro/, heading: "Brand Intelligence" },
  { path: "/buyers", title: /Businesses & Buyers · Ryva Pro/, heading: /Business|Buyer/ },
  { path: "/representation", title: /Representation · Ryva Pro/ },
  { path: "/placements", title: /Placements · Ryva Pro/ },
  { path: "/outreach", title: /Outreach · Ryva Pro/ },
  { path: "/accounts", title: /Accounts · Ryva Pro/ },
  { path: "/orders", title: /Orders · Ryva Pro/ },
  { path: "/reorders", title: /Reorders · Ryva Pro/ },
  { path: "/protected-accounts", title: /Protected accounts · Ryva Pro/ },
  { path: "/commissions", title: /Commissions · Ryva Pro/ },
  { path: "/commission-disputes", title: /Commission disputes · Ryva Pro/ },
  { path: "/analytics", title: /Analytics · Ryva Pro/, heading: "Analytics Command Center" },
  { path: "/analytics?view=reports", title: /Reports · Ryva Pro/ },
  { path: "/imports", title: /Data import · Ryva Pro/, heading: "Import and review" },
  { path: "/exports", title: /Data export · Ryva Pro/, heading: "Secure exports" },
  { path: "/settings", title: /Settings · Ryva Pro/, heading: "Settings" },
  { path: "/admin", title: /Operations · Ryva Pro/ },
  { path: "/search", title: /Search · Ryva Pro/ },
  { path: "/tasks", title: /Tasks · Ryva Pro/ },
  { path: "/documents", title: /Documents · Ryva Pro/ },
  { path: "/sources", title: /Sources · Ryva Pro/ },
  { path: "/territories", title: /Territories · Ryva Pro/ },
  { path: "/notifications", title: /Notifications · Ryva Pro/ },
  { path: "/profile", title: /Profile · Ryva Pro/, heading: "Profile" }
];

test("canonical routes render redesigned shells with document titles and landmarks", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Full route inventory uses desktop for title coverage.");
  await login(page);
  await expect(page.getByRole("complementary", { name: "Ryva application" })).toBeVisible();
  await expect(page.locator("#main-content")).toBeVisible();
  await captureIncrement17(page, "home-desktop-1440x900.png", true);
  await expectNoDocumentOverflow(page);

  for (const route of canonicalRoutes) {
    await page.goto(route.path);
    await expect(page).toHaveTitle(route.title);
    if (route.heading) {
      await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
    }
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoDocumentOverflow(page);
    const shotName = route.path
      .replace(/^\//, "")
      .replace(/[?/&=]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "home";
    if ([
      "products",
      "brands",
      "buyers",
      "representation",
      "placements",
      "outreach",
      "accounts",
      "orders",
      "reorders",
      "commissions",
      "commission-disputes",
      "analytics",
      "analytics-view-reports",
      "imports",
      "exports",
      "search",
      "settings",
      "admin"
    ].includes(shotName) || shotName === "protected-accounts") {
      await captureIncrement17(page, `register-${shotName}-desktop-1440x900.png`, true);
    }
  }
});

test("shell navigation remains coherent on tablet and mobile viewports", async ({ page }, testInfo) => {
  await login(page);
  if (testInfo.project.name.includes("mobile")) {
    await expect(page.getByRole("navigation", { name: "Mobile primary" })).toBeVisible();
    await captureIncrement17(page, "shell-mobile-390x844.png", true);
    await navigateFromShell(page, "Search");
    await expect(page).toHaveTitle(/Search · Ryva Pro/);
    await expectNoDocumentOverflow(page);
    await captureIncrement17(page, "search-mobile-390x844.png", true);
  } else {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/placements");
    await expect(page).toHaveTitle(/Placements · Ryva Pro/);
    await expectNoDocumentOverflow(page);
    await captureIncrement17(page, "placements-tablet-1024x768.png", true);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Analytics Command Center" })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await captureIncrement17(page, "analytics-narrow-320x568.png", true);
  }
});

test("generic records compatibility and protected-account detail stay on canonical modules", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Compatibility wiring checked on desktop.");
  await login(page);
  await page.goto("/records/brand");
  await expect(page.getByRole("heading", { name: "Brand Intelligence" })).toBeVisible();
  await expect(page).toHaveTitle(/Brands · Ryva Pro|Brand Intelligence|Ryva Pro/);
  await page.goto("/records/product");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  await page.goto("/protected-accounts");
  await expect(page.getByRole("heading", { name: "Protected Accounts" })).toBeVisible();
  await captureIncrement17(page, "protected-accounts-register-desktop-1440x900.png", true);
  const reviewLink = page.getByRole("link", { name: /Review rights/i }).first();
  if (await reviewLink.count()) {
    await reviewLink.click();
    await expect(page.getByText(/Consequential review · documentary protection|documentary protection/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Proposed documentary protection scope|Documentary protection activated/i }).first()).toBeVisible();
    await captureIncrement17(page, "protected-account-detail-desktop-1440x900.png", true);
  }
});

test("cross-route continuity preserves domain boundaries", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Continuity chain uses desktop density.");
  await login(page);
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Product Intelligence" })).toBeVisible();
  await page.goto("/brands");
  await expect(page.getByRole("heading", { name: "Brand Intelligence" })).toBeVisible();
  await page.goto("/representation");
  await expect(page.getByRole("heading", { name: "Representation", exact: true })).toBeVisible();
  await page.goto("/placements");
  await expect(page).toHaveTitle(/Placements · Ryva Pro/);
  await page.goto("/outreach");
  await expect(page).toHaveTitle(/Outreach · Ryva Pro/);
  await page.goto("/accounts");
  await expect(page).toHaveTitle(/Accounts · Ryva Pro/);
  await page.goto("/orders");
  await expect(page).toHaveTitle(/Orders · Ryva Pro/);
  await page.goto("/commissions");
  await expect(page.getByText(/Expected, verified, approved, payable, and paid values remain distinct|Order value is not commission owed/i).first()).toBeVisible();
  await page.goto("/commission-disputes");
  await expect(page).toHaveTitle(/Commission disputes · Ryva Pro/);
  await page.goto("/analytics");
  await expect(page.getByText("No Product Score or hidden probability.")).toBeVisible();
  await page.goto("/exports");
  await expect(page.getByRole("heading", { name: "Secure exports" })).toBeVisible();
  await page.goto("/imports");
  await expect(page.getByRole("heading", { name: "Import and review" })).toBeVisible();
  await captureIncrement17(page, "continuity-exports-desktop-1440x900.png", true);
});

test("restricted sessions remain honest across consolidated surfaces", async ({ page }) => {
  await login(page, "grace@synthetic.ryva.test");
  await page.goto("/settings");
  await expect(page.getByText("Read-only settings", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Read-only access" })).toBeDisabled();
  await captureIncrement17(page, "settings-restricted-desktop-1440x900.png", true);
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Analytics Command Center" })).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test("truthfulness distinctions remain intact after consolidation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Truthfulness copy checked on desktop.");
  await login(page);
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Not Connected" })).toBeVisible();
  await page.getByRole("button", { name: "Pipeline Analytics" }).click();
  await expect(page.getByText("Weighted pipeline disabled")).toBeVisible();
  await page.goto("/imports");
  await expect(page.getByRole("heading", { name: "Import and review" })).toBeVisible();
  await expect(page.getByText("Import committed.")).toHaveCount(0);
  await page.goto("/exports");
  await expect(page.getByRole("link", { name: "Download export" })).toHaveCount(0);
  await page.goto("/commissions");
  await expect(page.getByText(/Expected, verified, approved, payable, and paid values remain distinct/i).first()).toBeVisible();
});

test("keyboard reachability for shell skip link and primary landmark", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Skip-link keyboard path uses desktop.");
  await login(page);
  await page.goto("/products");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeVisible();
  await expectNoDocumentOverflow(page);
  await captureIncrement17(page, "products-register-desktop-1440x900.png", true);
});
