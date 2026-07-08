import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";

const DEFAULT_OUTPUT_PATH = "/Users/allieball/Documents/Ryva/data/private/mara-tiktok-creator-search-insights.json";
const DEFAULT_REGION = "US";
const DEFAULT_PERIOD = "7";
const DEFAULT_LIMIT = 15;

function parseArgs(argv) {
  const options = {
    headless: false,
    limit: DEFAULT_LIMIT,
    manualLogin: false,
    output: DEFAULT_OUTPUT_PATH,
    period: DEFAULT_PERIOD,
    region: DEFAULT_REGION
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
    const currentCount = await page.locator("button:has-text('See analytics')").count();
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
    const rowNodes = Array.from(document.querySelectorAll("button"))
      .filter((button) => clean(button.textContent) === "See analytics")
      .map((button) => button.closest("div.grid"))
      .filter(Boolean);

    return rowNodes.slice(0, maxItems).map((rowNode) => {
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
  const browser = await chromium.launch({
    channel: "chrome",
    headless: options.headless
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1600 }
    });

    await page.goto(sourceUrl, {
      timeout: 120000,
      waitUntil: "domcontentloaded"
    });

    await page.waitForTimeout(6000);
    if (options.manualLogin) {
      console.log("Manual login mode is enabled.");
      await waitForManualLogin();
      await page.waitForTimeout(1500);
    }
    await page.getByText("Browse what's trending now in").waitFor({ timeout: 20000 });
    const expansion = await expandList(page, options.limit);

    const hashtags = await scrapeHashtagRows(page, options.limit);
    if (hashtags.length === 0) {
      throw new Error("No hashtag rows were captured from TikTok Creative Center.");
    }

    const payload = buildOutputPayload({
      hashtags,
      loginWallEncountered: expansion.loginWallEncountered,
      period: options.period,
      region: options.region,
      sourceUrl,
      visibleCount: expansion.visibleCount
    });

    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    console.log(`Saved ${hashtags.length} TikTok hashtag trend rows to ${options.output}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
