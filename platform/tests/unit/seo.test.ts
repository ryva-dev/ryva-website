import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const web = new URL("../../apps/web/", import.meta.url);

void describe("public SEO foundation", () => {
  void it("publishes a canonical sitemap without private or account routes", () => {
    const sitemap = readFileSync(new URL("public/sitemap.xml", web), "utf8");
    assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    assert.match(sitemap, /https:\/\/www\.ryvaforge\.com\/<\/loc>/);
    assert.match(sitemap, /https:\/\/www\.ryvaforge\.com\/the-program<\/loc>/);
    assert.match(sitemap, /https:\/\/www\.ryvaforge\.com\/privacy<\/loc>/);
    assert.doesNotMatch(sitemap, /\/app|\/api|\/login|\/signup|\/checkout/);
    assert.doesNotMatch(sitemap, /lastmod|changefreq|priority/);
  });

  void it("allows public pages while keeping private and transactional routes out of crawl paths", () => {
    const robots = readFileSync(new URL("public/robots.txt", web), "utf8");
    assert.match(robots, /^User-agent: \*$/m);
    assert.match(robots, /^Allow: \/$/m);
    assert.match(robots, /^Disallow: \/app$/m);
    assert.match(robots, /^Disallow: \/api$/m);
    assert.match(robots, /^Disallow: \/checkout$/m);
    assert.match(robots, /^Sitemap: https:\/\/www\.ryvaforge\.com\/sitemap\.xml$/m);
  });

  void it("ships complete homepage metadata and factual structured data", () => {
    const html = readFileSync(new URL("index.html", web), "utf8");
    assert.match(html, /<title>Ryva \| Brand Placement &amp; Wholesale Industry Education<\/title>/);
    assert.match(html, /name="description"/);
    assert.match(html, /name="robots" content="index, follow"/);
    assert.match(html, /rel="canonical" href="https:\/\/www\.ryvaforge\.com\/"/);
    assert.match(html, /property="og:title"/);
    assert.match(html, /property="og:description"/);
    assert.match(html, /property="og:url" content="https:\/\/www\.ryvaforge\.com\/"/);
    assert.match(html, /property="og:type" content="website"/);
    assert.match(html, /name="twitter:card" content="summary"/);
    assert.match(html, /"@type": "Organization"/);
    assert.match(html, /"@type": "WebSite"/);
    assert.doesNotMatch(html, /rating|reviewCount|studentCount|award/i);
  });

  void it("uses route-aware canonicals and noindex behavior", () => {
    const seo = readFileSync(new URL("src/seo/SeoHead.tsx", web), "utf8");
    const api = readFileSync(new URL("../../apps/api/src/app.ts", import.meta.url), "utf8");
    assert.match(seo, /noindex, nofollow, noarchive/);
    assert.match(seo, /PUBLIC_SEO_ROUTES\[location\.pathname\]/);
    assert.match(api, /X-Robots-Tag/);
    assert.match(api, /indexablePublicPaths/);
  });

  void it("keeps a single descriptive homepage H1 and accessible decorative imagery", () => {
    const home = readFileSync(new URL("src/marketing/HomePage.tsx", web), "utf8");
    assert.equal((home.match(/<h1\b/g) ?? []).length, 1);
    assert.match(home, /Step inside the world of/);
    assert.match(home, /brand placement/);
    assert.match(home, /wholesale sales/);
    assert.match(home, /retail buyers/);
    assert.match(home, /alt=""/);
  });
});
