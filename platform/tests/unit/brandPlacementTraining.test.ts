import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../packages/config/src/index.js";
import type { Database } from "../../packages/database/src/index.js";

void test("standalone training route serves indexable HTML without changing SPA fallback rules", async () => {
  const source = new URL("../../apps/web/public/", import.meta.url);
  const html = await readFile(new URL("brand-placement-training/index.html", source), "utf8");
  const sitemap = await readFile(new URL("sitemap.xml", source), "utf8");
  const robots = await readFile(new URL("robots.txt", source), "utf8");
  const originalDirectory = process.cwd();
  const directory = await mkdtemp(path.join(os.tmpdir(), "ryva-training-"));
  try {
    const webRoot = path.join(directory, "dist/web");
    await mkdir(path.join(webRoot, "brand-placement-training"), { recursive: true });
    await writeFile(path.join(webRoot, "brand-placement-training/index.html"), html);
    await writeFile(path.join(webRoot, "sitemap.xml"), sitemap);
    await writeFile(path.join(webRoot, "robots.txt"), robots);
    const existingApp = "<!doctype html><title>Existing application</title><div id='root'></div>";
    await writeFile(path.join(webRoot, "index.html"), existingApp);
    process.chdir(directory);
    // Exercise production routing with inert test dependencies; no database or external services.
    const configuration = { ...loadConfig({ NODE_ENV: "test", LOG_LEVEL: "error" }), NODE_ENV: "production" as const };
    const app = createApp({ configuration, database: {} as Database });
    for (const url of ["/brand-placement-training/", "/brand-placement-training", "/brand-placement-training/?source=test"]) {
      const response = await request(app).get(url).expect(200).expect("Content-Type", /text\/html/);
      assert.equal(response.text, html);
      assert.equal(response.headers["x-robots-tag"], undefined);
      assert.match(response.text, /<h1>Brand Placement Training: Learn How Products Get Into Retail Stores<\/h1>/);
      assert.match(response.text, /rel="canonical" href="https:\/\/www\.ryvaforge\.com\/brand-placement-training\/"/);
      assert.doesNotMatch(response.text, /noindex|<script(?! type="application\/ld\+json")\b/);
      const structuredData = JSON.parse(response.text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "null");
      assert.equal(structuredData["@type"], "WebPage");
      assert.equal(structuredData.url, "https://www.ryvaforge.com/brand-placement-training/");
      assert.equal(structuredData.publisher.name, "Ryva Forge, LLC");
    }
    for (const url of ["/", "/the-program", "/curriculum", "/faq"]) {
      const response = await request(app).get(url).expect(200);
      assert.equal(response.text, existingApp);
      assert.equal(response.headers["x-robots-tag"], undefined);
    }
    for (const url of ["/login", "/app", "/brand-placement-training/not-a-page"]) {
      const response = await request(app).get(url).expect(200);
      assert.equal(response.text, existingApp);
      assert.equal(response.headers["x-robots-tag"], "noindex, nofollow, noarchive");
    }
    const searchBot = await request(app).get("/brand-placement-training/").set("User-Agent", "OAI-SearchBot/1.4").expect(200);
    assert.equal(searchBot.text, html);
    await request(app).head("/brand-placement-training/").expect(200);
    const publishedSitemap = await request(app).get("/sitemap.xml").expect(200);
    assert.match(publishedSitemap.text, /<loc>https:\/\/www\.ryvaforge\.com\/brand-placement-training\/<\/loc>/);
    const publishedRobots = await request(app).get("/robots.txt").expect(200);
    assert.equal(publishedRobots.text, robots);
  } finally {
    process.chdir(originalDirectory);
    await rm(directory, { recursive: true, force: true });
  }
});
