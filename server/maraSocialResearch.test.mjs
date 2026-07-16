import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "./dataStore.mjs";
import {
  extractSocialProfilesFromHtml,
  extractTikTokCreativeCenterTrends,
  listSocialResearchProviders,
  redditUgcStrategyProvider,
  metaAdLibraryProvider,
  xBrandSearchProvider,
  researchUgcStrategyAcrossPlatforms,
  tiktokBackendTrendFeedProvider,
  youtubeNicheResearchProvider
} from "./maraSocialResearch.mjs";

test("YouTube niche research uses observed public metrics and a durable cache", async () => {
  const previous = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = "test-key";
  const store = createStore({ databasePath: ":memory:" });
  await store.init();
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    if (String(url).includes("/search")) {
      return new Response(JSON.stringify({ items: [{ id: { videoId: "abc123" } }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ items: [{
      id: "abc123",
      snippet: { title: "Three fitness hooks", channelTitle: "Creator Lab", publishedAt: "2026-07-14T12:00:00.000Z" },
      statistics: { viewCount: "12000", likeCount: "900", commentCount: "40" },
      contentDetails: { duration: "PT32S" }
    }] }), { status: 200 });
  };
  try {
    const args = { niche: "fitness and wellness", fetchImpl, cacheStore: store, now: new Date("2026-07-16T12:00:00.000Z") };
    const first = await youtubeNicheResearchProvider(args);
    const second = await youtubeNicheResearchProvider(args);
    assert.equal(first.status, "ok");
    assert.equal(first.observations[0].viewsPerDay, 6000);
    assert.match(first.observations[0].evidence[0].claim, /12,000 public views/);
    assert.equal(second.cached, true);
    assert.equal(calls, 2);
  } finally {
    await store.close();
    if (previous == null) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = previous;
  }
});

test("TikTok backend-feed parser extracts embedded trend facts", () => {
  const html = `<script type="application/json">{"data":{"list":[{"hashtagName":"fitnesstips","publishCnt":12000,"videoViews":3400000}]}}</script>`;
  assert.deepEqual(extractTikTokCreativeCenterTrends(html), [{ hashtag: "#fitnesstips", posts: "12K", views: "3.4M" }]);
});

test("operator-side TikTok feed supplies trends without a creator connection", async () => {
  const previousUrl = process.env.TIKTOK_TRENDS_FEED_URL;
  process.env.TIKTOK_TRENDS_FEED_URL = "https://operator.example/tiktok-trends";
  try {
    const result = await tiktokBackendTrendFeedProvider({
      niche: "fitness",
      fetchImpl: async () => new Response(JSON.stringify({ list: [{ hashtag_name: "fitnesstips", video_views: 2500000 }] }), { status: 200 })
    });
    assert.equal(result.status, "ok");
    assert.match(result.observations[0].evidence[0].claim, /fitnesstips/i);
  } finally {
    if (previousUrl == null) delete process.env.TIKTOK_TRENDS_FEED_URL;
    else process.env.TIKTOK_TRENDS_FEED_URL = previousUrl;
  }
});

test("extractSocialProfilesFromHtml finds public social links", () => {
  const html = `
    <a href="https://www.instagram.com/glowtheory">IG</a>
    <a href="https://www.tiktok.com/@glowtheory">TT</a>
    <a href="https://x.com/glowtheory">X</a>
    <a href="https://www.facebook.com/glowtheory">FB</a>
  `;
  const profiles = extractSocialProfilesFromHtml(html, "https://glowtheory.example");
  assert.match(profiles.instagram, /instagram\.com\/glowtheory/i);
  assert.match(profiles.tiktok, /tiktok\.com\/@glowtheory/i);
  assert.match(profiles.x, /x\.com\/glowtheory/i);
  assert.match(profiles.facebook, /facebook\.com\/glowtheory/i);
});

test("keyed social providers stay not_configured without secrets", async () => {
  const previousX = process.env.X_BEARER_TOKEN;
  const previousMeta = process.env.META_ACCESS_TOKEN;
  delete process.env.X_BEARER_TOKEN;
  delete process.env.TWITTER_BEARER_TOKEN;
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.FACEBOOK_ACCESS_TOKEN;

  const x = await xBrandSearchProvider({ brandName: "Glow Theory" });
  const meta = await metaAdLibraryProvider({ brandName: "Glow Theory" });
  assert.equal(x.status, "not_configured");
  assert.equal(meta.status, "not_configured");
  assert.equal(x.observations.length, 0);
  assert.equal(meta.observations.length, 0);

  const listed = listSocialResearchProviders();
  assert.ok(listed.some((item) => item.name === "reddit_ugc_strategy" && item.configured));
  assert.ok(listed.some((item) => item.name === "meta_ad_library" && !item.configured));
  assert.ok(listed.some((item) => item.name === "x_recent_search" && !item.configured));

  if (previousX) process.env.X_BEARER_TOKEN = previousX;
  if (previousMeta) process.env.META_ACCESS_TOKEN = previousMeta;
});

test("reddit UGC strategy provider returns structured observations from mocked JSON", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        data: {
          children: [
            {
              data: {
                title: "UGC hooks that converted for skincare",
                selftext: "What worked: problem-first hook in first 2 seconds.",
                permalink: "/r/ugc/comments/abc/hooks/"
              }
            },
            {
              data: {
                title: "Never send raw footage unpaid",
                selftext: "Avoid unpaid raw footage asks — red flag.",
                permalink: "/r/ugc/comments/def/raw/"
              }
            }
          ]
        }
      }),
      { status: 200 }
    );

  const result = await redditUgcStrategyProvider({
    niche: "skincare",
    communities: ["ugc"],
    fetchImpl,
    limitPerCommunity: 2
  });
  assert.equal(result.status, "ok");
  assert.ok(result.observations.length >= 2);
  assert.ok(result.observations.some((item) => item.lessonKind === "what_works" || item.lessonKind === "anti_pattern"));
});

test("cross-platform strategy research never fabricates keyed ads", async () => {
  delete process.env.X_BEARER_TOKEN;
  delete process.env.META_ACCESS_TOKEN;
  const research = await researchUgcStrategyAcrossPlatforms({
    niche: "skincare",
    insights: {
      contentGaps: [{ label: "Barrier routine beginners" }],
      hashtags: [{ hashtag: "#barrierrepair", views: "1.2M" }],
      sourceUrl: "https://ads.tiktok.com/business/creativecenter"
    },
    fetchImpl: async () => {
      throw new Error("network blocked in unit test");
    }
  });
  assert.ok(research.whatWorks.some((item) => /Barrier routine|barrierrepair|#barrierrepair/i.test(item.claim)));
  // Without keys, Meta/X are skipped entirely — never invent observations for them.
  assert.equal(
    research.runs.some((run) => run.providerName === "meta_ad_library" && run.observations.length > 0),
    false
  );
  assert.equal(
    research.runs.some((run) => run.providerName === "x_recent_search" && run.observations.length > 0),
    false
  );
});
