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

test("account and internal routes are noindex and omit canonicals", async ({ page, request }) => {
  await page.goto("/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow, noarchive");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);

  const missingApi = await request.get("/api/not-a-public-resource");
  expect(missingApi.status()).toBe(404);
  expect(missingApi.headers()["x-robots-tag"]).toBe("noindex, nofollow, noarchive");
});
