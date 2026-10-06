import { expect, test } from "@playwright/test";

test("public SEO files and homepage metadata are crawlable and canonical", async ({ page, request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  await expect(robots.text()).resolves.toContain("Sitemap: https://www.ryvaforge.com/sitemap.xml");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const sitemapBody = await sitemap.text();
  expect(sitemapBody).toContain("https://www.ryvaforge.com/");
  expect(sitemapBody).not.toContain("/app");

  await page.goto("/");
  await expect(page).toHaveTitle("Ryva | Brand Placement & Wholesale Industry Education");
  await expect(page.getByRole("heading", { level: 1, name: /Step inside the world of brand placement/i })).toBeVisible();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /wholesale sales/i);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.ryvaforge.com/");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://www.ryvaforge.com/");
});

test("Google Analytics stays disabled when no measurement ID is configured", async ({ page }) => {
  test.skip(Boolean(process.env.VITE_GA_MEASUREMENT_ID), "This assertion covers an unconfigured build.");
  await page.goto("/");

  await expect(page.locator("#ryva-ga4-script")).toHaveCount(0);
  expect(
    await page.evaluate(
      "typeof window.gtag === 'undefined' && typeof window.__ryvaGa4MeasurementId === 'undefined'"
    )
  ).toBe(true);
});

test("Microsoft Clarity stays disabled when no project ID is configured", async ({ page }) => {
  test.skip(Boolean(process.env.VITE_CLARITY_PROJECT_ID), "This assertion covers an unconfigured build.");
  await page.goto("/");

  await expect(page.locator("#ryva-clarity-script")).toHaveCount(0);
  expect(
    await page.evaluate(
      "typeof window.clarity === 'undefined' && typeof window.__ryvaClarityProjectId === 'undefined'"
    )
  ).toBe(true);
});

test("Google Analytics sends one safe pageview per public SPA route", async ({ page }) => {
  test.skip(!process.env.VITE_GA_MEASUREMENT_ID, "This assertion covers a configured build.");
  await page.route("https://www.googletagmanager.com/gtag/js**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });

  await page.goto("/");
  await expect(page.locator("#ryva-ga4-script")).toHaveCount(1);
  await page.getByRole("link", { name: "The Program" }).first().click();
  await expect(page).toHaveURL(/\/the-program$/);

  const pageviews = (await page.evaluate(
    "window.dataLayer.filter((entry) => entry[0] === 'event' && entry[1] === 'page_view')"
  )) as unknown[][];
  expect(pageviews).toHaveLength(2);
  expect(pageviews[0]?.[2]).toEqual({
    send_to: process.env.VITE_GA_MEASUREMENT_ID,
    page_title: "Ryva | Brand Placement & Wholesale Industry Education",
    page_location: "https://www.ryvaforge.com/",
    page_path: "/"
  });
  expect(pageviews[1]?.[2]).toEqual({
    send_to: process.env.VITE_GA_MEASUREMENT_ID,
    page_title: "The Ryva Program | Brand Placement Education",
    page_location: "https://www.ryvaforge.com/the-program",
    page_path: "/the-program"
  });
  expect(JSON.stringify(pageviews)).not.toMatch(/@|email|user[_-]?id|password|token|stripe|answer/i);
});

test("Microsoft Clarity initializes once for public navigation and masks private surfaces", async ({ page, context }) => {
  test.skip(!process.env.VITE_CLARITY_PROJECT_ID, "This assertion covers a configured build.");
  await page.route("https://www.clarity.ms/tag/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });

  await page.goto("/");
  await expect(page.locator("#ryva-clarity-script")).toHaveCount(1);
  await page.getByRole("link", { name: "The Program" }).first().click();
  await expect(page).toHaveURL(/\/the-program$/);
  await expect(page.locator("#ryva-clarity-script")).toHaveCount(1);
  await page.getByRole("link", { name: "Sign In" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("main[data-clarity-mask='true']")).toHaveCount(1);

  const privatePage = await context.newPage();
  await privatePage.goto("/login");
  await expect(privatePage.locator("#ryva-clarity-script")).toHaveCount(0);
  await expect(privatePage.locator("main[data-clarity-mask='true']")).toHaveCount(1);
  await privatePage.close();
});

test("account and internal routes are noindex and omit canonicals", async ({ page, request }) => {
  await page.goto("/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow, noarchive");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);

  const missingApi = await request.get("/api/not-a-public-resource");
  expect(missingApi.status()).toBe(404);
  expect(missingApi.headers()["x-robots-tag"]).toBe("noindex, nofollow, noarchive");
});
