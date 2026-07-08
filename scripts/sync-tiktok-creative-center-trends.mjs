import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";
import { buildScopedTrendInsights } from "../server/maraTrendInsights.mjs";
import { getUserTrendInsightsFilePath } from "../server/maraTrendOps.mjs";

const DEFAULT_OUTPUT_PATH = "/Users/allieball/Documents/Ryva/data/private/mara-tiktok-creator-search-insights.json";
const DEFAULT_PROFILE_PATH = "/Users/allieball/Documents/Ryva/data/private/tiktok-creative-center-profile";
const DEBUG_OUTPUT_DIR = "/Users/allieball/Documents/Ryva/data/private/tiktok-sync-debug";
const DEFAULT_REGION = "US";
const DEFAULT_PERIOD = "7";
const DEFAULT_LIMIT = 15;

function parseArgs(argv) {
  const options = {
    headless: false,
    limit: DEFAULT_LIMIT,
    manualLogin: false,
    niche: "",
    output: DEFAULT_OUTPUT_PATH,
    period: DEFAULT_PERIOD,
    profile: DEFAULT_PROFILE_PATH,
    region: DEFAULT_REGION,
    storageRoot: path.resolve(process.cwd(), "data"),
    userId: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--headless") {
      options.headless = true;
      continue;
    }

    if (arg === "--headed") {
      options.headless = false;
      continue;
    }

    if (arg === "--region" && next) {
      options.region = String(next).trim().toUpperCase();
      index += 1;
      continue;
    }

    if (arg === "--period" && next) {
      options.period = String(next).trim();
      index += 1;
      continue;
    }

    if (arg === "--limit" && next) {
      options.limit = Number.parseInt(next, 10) || DEFAULT_LIMIT;
      index += 1;
      continue;
    }

    if (arg === "--manual-login") {
      options.manualLogin = true;
      continue;
    }

    if (arg === "--output" && next) {
      options.output = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg === "--profile" && next) {
      options.profile = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg === "--user-id" && next) {
      options.userId = String(next).trim();
      index += 1;
      continue;
    }

    if (arg === "--niche" && next) {
      options.niche = String(next).trim();
      index += 1;
      continue;
    }

    if (arg === "--storage-root" && next) {
      options.storageRoot = path.resolve(process.cwd(), next);
      index += 1;
    }
  }

  return options;
}

async function waitForManualLogin() {
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question("Sign in to TikTok Creative Center in the opened browser if needed, then press Enter here to continue. ");
  } finally {
    rl.close();
  }
}

async function waitForTrendRows(page) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const count = await page
      .locator("button:has-text('See analytics'), [role='button']:has-text('See analytics')")
      .count();
    if (count > 0) return count;
    await page.waitForTimeout(1000);
  }
  return 0;
}

async function captureDebugArtifacts(page, label) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `${label}-${timestamp}`;
  await mkdir(DEBUG_OUTPUT_DIR, { recursive: true });

  const screenshotPath = path.join(DEBUG_OUTPUT_DIR, `${baseName}.png`);
  const htmlPath = path.join(DEBUG_OUTPUT_DIR, `${baseName}.html`);

  await page.screenshot({ fullPage: true, path: screenshotPath }).catch(() => {});
  await writeFile(htmlPath, await page.content(), "utf8").catch(() => {});

  return { htmlPath, screenshotPath };
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildTrendUrl(region, period) {
  const search = new URLSearchParams({
    period: String(period),
    region: String(region)
  });
  return `https://ads.tiktok.com/creative/creativeCenter/trends/hashtag?${search.toString()}`;
}

async function expandList(page, targetCount) {
  let loginWallEncountered = false;

  while (true) {
    const currentCount = await page
      .locator("button:has-text('See analytics'), [role='button']:has-text('See analytics')")
      .count();
    if (currentCount >= targetCount) {
      return { loginWallEncountered, visibleCount: currentCount };
    }

    const viewMore = page.getByRole("button", { name: "View more" });
    if (!(await viewMore.isVisible().catch(() => false))) {
      return { loginWallEncountered, visibleCount: currentCount };
    }

    try {
      await viewMore.click({ timeout: 5000 });
      await page.waitForTimeout(1800);
    } catch {
      loginWallEncountered = true;
      return { loginWallEncountered, visibleCount: currentCount };
    }
  }
}

async function scrapeHashtagRows(page, limit) {
  return page.evaluate((maxItems) => {
    const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const actionNodes = Array.from(document.querySelectorAll("button, [role='button']"))
      .filter((button) => /see analytics/i.test(clean(button.textContent)))
      .map((button) => button.closest("div.grid"))
      .filter(Boolean);

    return actionNodes.slice(0, maxItems).map((rowNode) => {
      const children = Array.from(rowNode.children);
      const rankColumn = children[0];
      const detailColumn = children[1];
      const metricColumn = children[2];

      const rank = Number.parseInt(clean(rankColumn?.textContent ?? ""), 10) || null;
      const hashtag = clean(detailColumn?.querySelector("div.truncate")?.textContent ?? "");
      const metaContainer = detailColumn?.querySelector("div.truncate")?.nextElementSibling;
      const categories = metaContainer
        ? Array.from(metaContainer.children)
            .map((child) => clean(child.textContent))
            .filter(Boolean)
        : [];
      const metricGroups = metricColumn ? Array.from(metricColumn.querySelectorAll(":scope > div > div")) : [];
      const posts = clean(metricGroups[0]?.querySelector("span")?.textContent ?? "");
      const views = clean(metricGroups[1]?.querySelector("span")?.textContent ?? "");
      const rowText = clean(rowNode.textContent).replace(/See analytics$/i, "").trim();

      return {
        categories,
        hashtag,
        posts,
        rank,
        rowText,
        views
      };
    });
  }, limit);
}

function normalizeInsightSummary(item, region, period) {
  const categoryLabel = item.categories.length > 0 ? ` in ${item.categories.join(" and ")}` : "";
  return `${item.hashtag} is trending${categoryLabel} in ${region} over the last ${period} days with ${item.posts || "visible"} posts and ${item.views || "visible"} views.`;
}

function buildOutputPayload({ hashtags, loginWallEncountered, period, region, sourceUrl, visibleCount }) {
  const timestamp = new Date().toISOString();
  return {
    capturedAt: timestamp,
    contentGaps: [],
    hashtags,
    insights: hashtags.map((item) => ({
      summary: normalizeInsightSummary(item, region, period),
      title: item.hashtag
    })),
    loginWallEncountered,
    notes: loginWallEncountered
      ? ["TikTok blocked 'View more' behind a login wall, so this file only contains the visible public rows from the trends page."]
      : [],
    periodDays: Number.parseInt(String(period), 10) || period,
    region,
    source: "tiktok_creative_center",
    sourceUrl,
    updatedAt: timestamp,
    visibleCount
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceUrl = buildTrendUrl(options.region, options.period);
  await mkdir(options.profile, { recursive: true });
  const context = await chromium.launchPersistentContext(options.profile, {
    channel: "chrome",
    headless: options.headless,
    viewport: { width: 1440, height: 1600 }
  });

  try {
    const [existingPage] = context.pages();
    const page = existingPage ?? await context.newPage();

    await page.goto(sourceUrl, {
      timeout: 120000,
      waitUntil: "domcontentloaded"
    });

    await page.waitForTimeout(6000);
    if (options.manualLogin) {
      console.log("Manual login mode is enabled.");
      await waitForManualLogin();
      await page.goto(sourceUrl, {
        timeout: 120000,
        waitUntil: "domcontentloaded"
      });
      await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(5000);
    }
    await page.getByText("Browse what's trending now in").waitFor({ timeout: 20000 });
    await waitForTrendRows(page);
    const expansion = await expandList(page, options.limit);

    const hashtags = await scrapeHashtagRows(page, options.limit);
    if (hashtags.length === 0) {
      const debugPaths = await captureDebugArtifacts(page, "no-hashtag-rows");
      throw new Error(
        `No hashtag rows were captured from TikTok Creative Center. Debug files saved to ${debugPaths.screenshotPath} and ${debugPaths.htmlPath}.`
      );
    }

    const payload = buildOutputPayload({
      hashtags,
      loginWallEncountered: expansion.loginWallEncountered,
      period: options.period,
      region: options.region,
      sourceUrl,
      visibleCount: expansion.visibleCount
    });

    const outputPayload =
      options.userId && options.niche
        ? buildScopedTrendInsights(payload, options.niche)
        : payload;
    const outputPath =
      options.userId && options.niche
        ? getUserTrendInsightsFilePath(options.storageRoot, options.userId)
        : options.output;

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(outputPayload, null, 2)}\n`, "utf8");

    console.log(`Saved ${hashtags.length} TikTok hashtag trend rows to ${outputPath}`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
