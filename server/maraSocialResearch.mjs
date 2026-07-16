/**
 * Multi-platform social research for Mara.
 * Free/public sources run when available; keyed APIs activate only when configured.
 * Never fabricates ads, engagement, or handles.
 */
import { createHash } from "node:crypto";
import { createEvidenceItem, EVIDENCE_KINDS, sanitizeUntrustedText } from "./maraEvidence.mjs";

function createProviderResult({
  providerName,
  researchType,
  query,
  retrievedUrl = null,
  status = "ok",
  reliability = 0.5,
  freshnessHours = 0,
  observations = [],
  error = null,
  rateLimited = false
}) {
  return {
    providerName,
    researchType,
    query,
    retrievedUrl,
    retrievedAt: new Date().toISOString(),
    status,
    reliability,
    freshnessHours,
    observations,
    error,
    rateLimited,
    rawSourceRef: retrievedUrl
  };
}

const UGC_STRATEGY_COMMUNITIES = [
  "ugc",
  "UGCSideHustle",
  "UGCcreators",
  "UGCUNIVERSITY",
  "influencermarketing",
  "TikTokMarketing",
  "Tiktokhelp",
  "ContentCreators",
  "InstagramMarketing",
  "socialmedia"
];

const BRAND_MENTION_COMMUNITIES = [
  "ugc",
  "UGCSideHustle",
  "UGCcreators",
  "influencermarketing",
  "TikTokMarketing"
];

async function fetchText(fetchImpl, url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json,text/html,*/*", ...headers },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function compactMetric(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(number);
}

function youtubeCacheKey(niche, regionCode, relevanceLanguage) {
  return `youtube:${createHash("sha256").update(`${String(niche).trim().toLowerCase()}|${regionCode}|${relevanceLanguage}`).digest("hex")}`;
}

async function ensureResearchProviderCache(store) {
  if (!store) return;
  await store.execute(`CREATE TABLE IF NOT EXISTS research_provider_cache (
    cache_key TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    query_text TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`);
}

/** Public, server-side YouTube niche research with a durable shared cache. */
export async function youtubeNicheResearchProvider({
  niche = "UGC",
  fetchImpl = globalThis.fetch,
  cacheStore = null,
  regionCode = "US",
  relevanceLanguage = "en",
  cacheHours = 12,
  now = new Date()
} = {}) {
  const apiKey = String(process.env.YOUTUBE_API_KEY || "").trim();
  if (!apiKey) {
    return createProviderResult({ providerName: "youtube_public_discovery", researchType: "ugc_strategy", query: niche, status: "not_configured", reliability: 0, error: "YouTube Data API is not configured.", observations: [] });
  }

  const cacheKey = youtubeCacheKey(niche, regionCode, relevanceLanguage);
  if (cacheStore) {
    await ensureResearchProviderCache(cacheStore);
    const cached = await cacheStore.queryOne(
      `SELECT payload_json AS "payloadJson" FROM research_provider_cache WHERE cache_key = ? AND expires_at > ?`,
      cacheKey,
      now.toISOString()
    );
    if (cached?.payloadJson) {
      try { return { ...JSON.parse(cached.payloadJson), cached: true }; } catch { /* refresh corrupt cache */ }
    }
  }

  const publishedAfter = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const query = `${String(niche).trim()} creator content`;
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.search = new URLSearchParams({ part: "snippet", type: "video", q: query, order: "viewCount", maxResults: "10", publishedAfter, regionCode, relevanceLanguage, key: apiKey }).toString();
  try {
    const searchResponse = await fetchImpl(searchUrl, { headers: { accept: "application/json" } });
    if (!searchResponse.ok) throw new Error(`YouTube search returned HTTP ${searchResponse.status}`);
    const search = await searchResponse.json();
    const ids = (search.items || []).map((item) => item?.id?.videoId).filter(Boolean).slice(0, 10);
    if (!ids.length) return createProviderResult({ providerName: "youtube_public_discovery", researchType: "ugc_strategy", query, status: "empty", reliability: 0.7, observations: [] });

    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.search = new URLSearchParams({ part: "snippet,statistics,contentDetails", id: ids.join(","), key: apiKey }).toString();
    const detailsResponse = await fetchImpl(detailsUrl, { headers: { accept: "application/json" } });
    if (!detailsResponse.ok) throw new Error(`YouTube video details returned HTTP ${detailsResponse.status}`);
    const details = await detailsResponse.json();
    const observations = (details.items || []).map((video) => {
      const publishedAt = String(video?.snippet?.publishedAt || "");
      const ageDays = Math.max(1, (now.getTime() - new Date(publishedAt).getTime()) / 86_400_000);
      const views = Number(video?.statistics?.viewCount || 0);
      const title = sanitizeUntrustedText(video?.snippet?.title || "Untitled video", { maxLength: 180, label: "youtube_title" }).text;
      const channelTitle = sanitizeUntrustedText(video?.snippet?.channelTitle || "Unknown channel", { maxLength: 100, label: "youtube_channel" }).text;
      const sourceUrl = `https://www.youtube.com/watch?v=${video.id}`;
      return {
        platform: "youtube",
        kind: "recent_content_signal",
        title,
        channelTitle,
        publishedAt,
        views,
        viewsPerDay: Math.round(views / ageDays),
        likes: Number(video?.statistics?.likeCount || 0),
        comments: Number(video?.statistics?.commentCount || 0),
        duration: String(video?.contentDetails?.duration || ""),
        sourceUrl,
        evidence: [createEvidenceItem({
          kind: EVIDENCE_KINDS.OBSERVED,
          claim: `${title} by ${channelTitle} received ${views.toLocaleString("en-US")} public views after about ${Math.round(ageDays)} day${Math.round(ageDays) === 1 ? "" : "s"}.`,
          sourceUrl,
          confidence: 82,
          rawExcerpt: `${title} · ${channelTitle} · ${views} views · ${publishedAt}`
        })]
      };
    }).sort((a, b) => b.viewsPerDay - a.viewsPerDay);
    const result = createProviderResult({
      providerName: "youtube_public_discovery",
      researchType: "ugc_strategy",
      query,
      retrievedUrl: searchUrl.toString().replace(apiKey, "[redacted]"),
      status: observations.length ? "ok" : "empty",
      reliability: 0.82,
      observations
    });
    if (cacheStore) {
      const expiresAt = new Date(now.getTime() + Math.max(1, Number(cacheHours)) * 3_600_000).toISOString();
      await cacheStore.execute(
        `INSERT INTO research_provider_cache (cache_key, provider, query_text, payload_json, retrieved_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET payload_json = excluded.payload_json, retrieved_at = excluded.retrieved_at, expires_at = excluded.expires_at`,
        cacheKey, "youtube_public_discovery", query, JSON.stringify(result), now.toISOString(), expiresAt
      );
    }
    return result;
  } catch (error) {
    return createProviderResult({ providerName: "youtube_public_discovery", researchType: "ugc_strategy", query, status: "unavailable", reliability: 0, error: String(error?.message || error), observations: [] });
  }
}

/** Parse only public trend facts embedded in TikTok Creative Center HTML. */
export function extractTikTokCreativeCenterTrends(html, limit = 20) {
  const source = String(html || "");
  const found = [];
  const seen = new Set();
  const add = (candidate = {}) => {
    const rawName = candidate.hashtagName || candidate.hashtag_name || candidate.name || candidate.keyword || "";
    const name = String(rawName).replace(/^#/, "").trim();
    if (!/^[\p{L}\p{N}_-]{2,80}$/u.test(name) || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    found.push({
      hashtag: `#${name}`,
      posts: compactMetric(candidate.publishCnt ?? candidate.publish_cnt ?? candidate.videoCount ?? candidate.video_count),
      views: compactMetric(candidate.videoViews ?? candidate.video_views ?? candidate.viewCount ?? candidate.view_count)
    });
  };
  const walk = (value, depth = 0) => {
    if (!value || depth > 12) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    if (typeof value !== "object") return;
    if (value.hashtagName || value.hashtag_name) add(value);
    for (const nested of Object.values(value)) walk(nested, depth + 1);
  };
  try { walk(JSON.parse(source)); } catch { /* source may be HTML */ }
  for (const match of source.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(match[1])); } catch { /* ignore non-JSON script content */ }
  }
  if (!found.length) {
    for (const match of source.matchAll(/["']hashtag_(?:name|title)["']\s*:\s*["']([^"']+)["']/gi)) add({ hashtag_name: match[1] });
  }
  return found.slice(0, Math.max(1, Math.min(50, Number(limit) || 20)));
}

export async function tiktokBackendTrendFeedProvider({ niche = "UGC", fetchImpl = globalThis.fetch } = {}) {
  const url = String(process.env.TIKTOK_TRENDS_FEED_URL || "").trim();
  const token = String(process.env.TIKTOK_TRENDS_FEED_TOKEN || "").trim();
  if (!url) {
    return createProviderResult({
      providerName: "tiktok_backend_trend_feed",
      researchType: "ugc_strategy",
      query: niche,
      status: "not_configured",
      reliability: 0,
      error: "Operator-side TikTok trend feed is not configured. Creator input is not required.",
      observations: []
    });
  }
  try {
    const payload = await fetchText(fetchImpl, url, {
      "user-agent": "RyvaResearch/1.0",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    });
    const trends = extractTikTokCreativeCenterTrends(payload, 30);
    const keywords = String(niche).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !["creator", "content", "ugc", "with", "and", "for"].includes(word));
    const matched = trends.filter((trend) => keywords.some((word) => trend.hashtag.toLowerCase().includes(word)));
    const selected = (matched.length ? matched : trends).slice(0, 10);
    return createProviderResult({
      providerName: "tiktok_backend_trend_feed",
      researchType: "ugc_strategy",
      query: niche,
      retrievedUrl: url,
      status: selected.length ? "ok" : "empty",
      reliability: selected.length ? 0.65 : 0.2,
      observations: selected.map((trend) => ({
        platform: "tiktok",
        kind: "trending_hashtag",
        hashtag: trend.hashtag,
        views: trend.views,
        posts: trend.posts,
        matchedToNiche: matched.includes(trend),
        evidence: [createEvidenceItem({
          kind: EVIDENCE_KINDS.OBSERVED,
          claim: `TikTok Creative Center publicly listed ${trend.hashtag}${trend.views ? ` with ${trend.views} views` : ""}.`,
          sourceUrl: url,
          confidence: matched.includes(trend) ? 72 : 58,
          rawExcerpt: `${trend.hashtag} ${trend.posts || ""} ${trend.views || ""}`.trim()
        })]
      }))
    });
  } catch (error) {
    return createProviderResult({
      providerName: "tiktok_backend_trend_feed",
      researchType: "ugc_strategy",
      query: niche,
      retrievedUrl: url,
      status: "unavailable",
      reliability: 0,
      error: String(error?.message || error),
      observations: []
    });
  }
}

/** Pull public social profile URLs from brand site HTML. */
export function extractSocialProfilesFromHtml(html, baseUrl = "") {
  const text = String(html || "");
  const hrefs = [...text.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const absolute = hrefs
    .map((href) => {
      try {
        return new URL(href, baseUrl || "https://example.com").toString();
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const pick = (re) => absolute.find((url) => re.test(url)) || null;
  return {
    instagram: pick(/instagram\.com\/(?!p\/|reel\/|stories\/)[A-Za-z0-9._]+/i),
    tiktok: pick(/tiktok\.com\/@[\w.-]+/i),
    facebook: pick(/facebook\.com\/(?!sharer|dialog)[\w.-]+/i),
    x: pick(/(?:twitter\.com|x\.com)\/(?!intent|share)[A-Za-z0-9_]+/i),
    youtube: pick(/youtube\.com\/(?:@|channel\/|c\/)[\w.-]+/i),
    linkedin: pick(/linkedin\.com\/(?:company|in)\/[\w.-]+/i)
  };
}

function classifyUgcLesson(text) {
  const body = String(text || "");
  const anti =
    /\b(never|don't|dont|avoid|red flag|scam|unpaid|whitelisting|usage rights|raw footage|late pay|ghosted)\b/i.test(body);
  const works =
    /\b(hook|retention|ugc that works|what worked|converted|CTR|ROAS|before.?after|testimonial|routine)\b/i.test(body);
  return {
    kind: anti ? "anti_pattern" : works ? "what_works" : "signal",
    anti,
    works
  };
}

/** Reddit public JSON — UGC strategy lessons (what works / what doesn't). */
export async function redditUgcStrategyProvider({
  niche = "UGC",
  communities = UGC_STRATEGY_COMMUNITIES,
  fetchImpl = globalThis.fetch,
  limitPerCommunity = 3
} = {}) {
  const observations = [];
  const query = `${niche} UGC OR creator OR brand deal OR hook`;
  for (const community of communities.slice(0, 8)) {
    try {
      const text = await fetchText(
        fetchImpl,
        `https://www.reddit.com/r/${community}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&limit=${limitPerCommunity}`,
        { "user-agent": "ryva-mara-research/1.0" }
      );
      const parsed = JSON.parse(text);
      for (const child of parsed?.data?.children || []) {
        const data = child?.data || {};
        if (!data.title) continue;
        const raw = sanitizeUntrustedText(`${data.title}\n${data.selftext || ""}`, {
          maxLength: 700,
          label: "reddit_strategy"
        });
        const lesson = classifyUgcLesson(raw.text);
        observations.push({
          platform: "reddit",
          community,
          title: data.title,
          url: `https://www.reddit.com${data.permalink || ""}`,
          lessonKind: lesson.kind,
          evidence: [
            createEvidenceItem({
              kind: EVIDENCE_KINDS.OBSERVED,
              claim:
                lesson.kind === "anti_pattern"
                  ? `Creator community warning/anti-pattern observed in r/${community}.`
                  : lesson.kind === "what_works"
                    ? `Creator community tactic that reportedly works observed in r/${community}.`
                    : `UGC/creator market signal observed in r/${community}.`,
              sourceUrl: `https://www.reddit.com${data.permalink || ""}`,
              confidence: lesson.anti ? 60 : lesson.works ? 55 : 40,
              rawExcerpt: raw.text.slice(0, 280)
            })
          ]
        });
      }
    } catch {
      continue;
    }
  }
  return createProviderResult({
    providerName: "reddit_ugc_strategy",
    researchType: "ugc_strategy",
    query,
    status: observations.length ? "ok" : "empty",
    reliability: 0.55,
    observations
  });
}

/** Reddit brand mentions across a wider creator-set of communities. */
export async function redditBrandSocialProvider({
  brandName,
  communities = BRAND_MENTION_COMMUNITIES,
  fetchImpl = globalThis.fetch
} = {}) {
  const observations = [];
  for (const community of communities) {
    try {
      const text = await fetchText(
        fetchImpl,
        `https://www.reddit.com/r/${community}/search.json?q=${encodeURIComponent(brandName)}&restrict_sr=1&limit=5`,
        { "user-agent": "ryva-mara-research/1.0" }
      );
      const parsed = JSON.parse(text);
      for (const child of parsed?.data?.children || []) {
        const data = child?.data || {};
        if (!data.title) continue;
        const body = sanitizeUntrustedText(`${data.title}\n${data.selftext || ""}`, {
          maxLength: 500,
          label: "reddit_brand"
        });
        const complaint = /scam|never\s+paid|didn't\s+pay|ghosted|chargeback|unpaid/i.test(body.text);
        const hiring = /looking for (ugc|creators)|hiring creators|creator brief|paid collab/i.test(body.text);
        observations.push({
          platform: "reddit",
          community,
          title: data.title,
          url: `https://www.reddit.com${data.permalink || ""}`,
          complaintHint: complaint,
          hiringHint: hiring,
          evidence: [
            createEvidenceItem({
              kind: complaint || hiring ? EVIDENCE_KINDS.OBSERVED : EVIDENCE_KINDS.INFERENCE,
              claim: complaint
                ? `Creator-reported trust/payment concern mentioning ${brandName} in r/${community} (verify before outreach).`
                : hiring
                  ? `Creator-community hiring/collab language mentioning ${brandName} in r/${community}.`
                  : `Public Reddit mention of ${brandName} in r/${community}.`,
              sourceUrl: `https://www.reddit.com${data.permalink || ""}`,
              confidence: complaint ? 58 : hiring ? 62 : 42,
              rawExcerpt: body.text.slice(0, 240)
            })
          ]
        });
      }
    } catch {
      continue;
    }
  }
  return createProviderResult({
    providerName: "reddit_brand_social",
    researchType: "brand_social_mentions",
    query: brandName,
    status: observations.length ? "ok" : "empty",
    reliability: 0.45,
    observations
  });
}

/** X (Twitter) recent search — requires X_BEARER_TOKEN. */
export async function xBrandSearchProvider({ brandName, fetchImpl = globalThis.fetch } = {}) {
  const token = String(process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || "").trim();
  if (!token) {
    return createProviderResult({
      providerName: "x_recent_search",
      researchType: "brand_social_mentions",
      query: brandName,
      status: "not_configured",
      reliability: 0,
      error: "X_BEARER_TOKEN is not set. No X posts fabricated.",
      observations: []
    });
  }
  try {
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(`"${brandName}" (UGC OR creator OR collab OR influencer)`)}&max_results=10&tweet.fields=created_at,public_metrics,lang`;
    const text = await fetchText(fetchImpl, url, { Authorization: `Bearer ${token}` });
    const parsed = JSON.parse(text);
    const observations = (parsed.data || []).slice(0, 8).map((tweet) => ({
      platform: "x",
      id: tweet.id,
      text: tweet.text,
      metrics: tweet.public_metrics || {},
      evidence: [
        createEvidenceItem({
          kind: EVIDENCE_KINDS.OBSERVED,
          claim: `Recent X post mentioning ${brandName} in a creator/UGC context.`,
          sourceUrl: `https://x.com/i/web/status/${tweet.id}`,
          confidence: 70,
          rawExcerpt: String(tweet.text || "").slice(0, 240)
        })
      ]
    }));
    return createProviderResult({
      providerName: "x_recent_search",
      researchType: "brand_social_mentions",
      query: brandName,
      status: observations.length ? "ok" : "empty",
      reliability: 0.7,
      observations
    });
  } catch (error) {
    return createProviderResult({
      providerName: "x_recent_search",
      researchType: "brand_social_mentions",
      query: brandName,
      status: "unavailable",
      reliability: 0,
      error: String(error?.message || error),
      observations: []
    });
  }
}

/**
 * Meta Ad Library — uses META_ACCESS_TOKEN when present.
 * Without a token: not_configured (public HTML is login-walled; we do not fabricate).
 */
export async function metaAdLibraryProvider({ brandName, fetchImpl = globalThis.fetch } = {}) {
  const token = String(process.env.META_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN || "").trim();
  if (!token) {
    return createProviderResult({
      providerName: "meta_ad_library",
      researchType: "advertising_observations",
      query: brandName,
      status: "not_configured",
      reliability: 0,
      error: "META_ACCESS_TOKEN is not set. No Facebook/Instagram ads fabricated.",
      observations: []
    });
  }
  try {
    const url = `https://graph.facebook.com/v19.0/ads_archive?search_terms=${encodeURIComponent(brandName)}&ad_reached_countries=['US']&ad_active_status=ALL&ad_type=ALL&limit=15&access_token=${encodeURIComponent(token)}&fields=page_name,ad_creative_bodies,ad_creative_link_titles,ad_delivery_start_time,ad_snapshot_url,publisher_platforms`;
    const text = await fetchText(fetchImpl, url);
    const parsed = JSON.parse(text);
    if (parsed.error) throw new Error(parsed.error.message || "Meta API error");
    const observations = (parsed.data || []).slice(0, 10).map((ad) => {
      const body = Array.isArray(ad.ad_creative_bodies) ? ad.ad_creative_bodies[0] : "";
      const title = Array.isArray(ad.ad_creative_link_titles) ? ad.ad_creative_link_titles[0] : "";
      return {
        platform: "meta",
        pageName: ad.page_name,
        title,
        body,
        startedAt: ad.ad_delivery_start_time,
        publisherPlatforms: ad.publisher_platforms || [],
        snapshotUrl: ad.ad_snapshot_url || null,
        observation: {
          messagingAngle: title || null,
          hook: String(body || "").slice(0, 120) || null,
          visualFormat: Array.isArray(ad.publisher_platforms) && ad.publisher_platforms.includes("instagram")
            ? "instagram_or_facebook_ad"
            : "meta_ad",
          persona: null
        },
        evidence: [
          createEvidenceItem({
            kind: EVIDENCE_KINDS.OBSERVED,
            claim: `Meta Ad Library creative observed for ${ad.page_name || brandName}.`,
            sourceUrl: ad.ad_snapshot_url || `https://www.facebook.com/ads/library/?q=${encodeURIComponent(brandName)}`,
            confidence: 80,
            rawExcerpt: `${title} ${body}`.trim().slice(0, 280)
          })
        ]
      };
    });
    return createProviderResult({
      providerName: "meta_ad_library",
      researchType: "advertising_observations",
      query: brandName,
      status: observations.length ? "ok" : "empty",
      reliability: 0.8,
      observations
    });
  } catch (error) {
    return createProviderResult({
      providerName: "meta_ad_library",
      researchType: "advertising_observations",
      query: brandName,
      status: "unavailable",
      reliability: 0,
      error: String(error?.message || error),
      observations: []
    });
  }
}

/** Instagram Graph — requires META_ACCESS_TOKEN + IG_USER_ID (business login). */
export async function instagramGraphProvider({ brandName, fetchImpl = globalThis.fetch } = {}) {
  const token = String(process.env.META_ACCESS_TOKEN || "").trim();
  const igUserId = String(process.env.IG_USER_ID || "").trim();
  if (!token || !igUserId) {
    return createProviderResult({
      providerName: "instagram_graph",
      researchType: "brand_social_mentions",
      query: brandName,
      status: "not_configured",
      reliability: 0,
      error: "META_ACCESS_TOKEN and IG_USER_ID are required for Instagram Graph. No IG posts fabricated.",
      observations: []
    });
  }
  try {
    // Hashtag search requires the hashtag search permission; fail closed if unavailable.
    const hashtag = String(brandName || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 40);
    if (!hashtag) {
      return createProviderResult({
        providerName: "instagram_graph",
        researchType: "brand_social_mentions",
        query: brandName,
        status: "empty",
        observations: []
      });
    }
    const searchUrl = `https://graph.facebook.com/v19.0/ig_hashtag_search?user_id=${encodeURIComponent(igUserId)}&q=${encodeURIComponent(hashtag)}&access_token=${encodeURIComponent(token)}`;
    const searchText = await fetchText(fetchImpl, searchUrl);
    const searchParsed = JSON.parse(searchText);
    const hashtagId = searchParsed?.data?.[0]?.id;
    if (!hashtagId) {
      return createProviderResult({
        providerName: "instagram_graph",
        researchType: "brand_social_mentions",
        query: brandName,
        status: "empty",
        reliability: 0.5,
        observations: []
      });
    }
    const mediaUrl = `https://graph.facebook.com/v19.0/${hashtagId}/recent_media?user_id=${encodeURIComponent(igUserId)}&fields=caption,permalink,media_type,timestamp&limit=8&access_token=${encodeURIComponent(token)}`;
    const mediaText = await fetchText(fetchImpl, mediaUrl);
    const mediaParsed = JSON.parse(mediaText);
    const observations = (mediaParsed.data || []).slice(0, 8).map((media) => ({
      platform: "instagram",
      mediaType: media.media_type,
      permalink: media.permalink,
      evidence: [
        createEvidenceItem({
          kind: EVIDENCE_KINDS.OBSERVED,
          claim: `Instagram hashtag media observed related to ${brandName}.`,
          sourceUrl: media.permalink || null,
          confidence: 65,
          rawExcerpt: String(media.caption || "").slice(0, 240)
        })
      ]
    }));
    return createProviderResult({
      providerName: "instagram_graph",
      researchType: "brand_social_mentions",
      query: brandName,
      status: observations.length ? "ok" : "empty",
      reliability: 0.65,
      observations
    });
  } catch (error) {
    return createProviderResult({
      providerName: "instagram_graph",
      researchType: "brand_social_mentions",
      query: brandName,
      status: "unavailable",
      error: String(error?.message || error),
      observations: []
    });
  }
}

/**
 * TikTok strategy from offline Creative Center / trend insights (no live API required).
 * Live Marketing API remains a separate keyed provider.
 */
export async function tiktokOfflineInsightsProvider({ niche = "", brandName = "", insights = null } = {}) {
  if (!insights || typeof insights !== "object") {
    return createProviderResult({
      providerName: "tiktok_offline_insights",
      researchType: "ugc_strategy",
      query: brandName || niche,
      status: "empty",
      reliability: 0.3,
      error: "No verified TikTok trend snapshot is available from Ryva's backend providers yet.",
      observations: []
    });
  }
  const gaps = Array.isArray(insights.contentGaps)
    ? insights.contentGaps.map((item) => item?.label || item?.gap || item).filter(Boolean)
    : [];
  const hashtags = Array.isArray(insights.hashtags) ? insights.hashtags.slice(0, 10) : [];
  const observations = [];
  for (const gap of gaps.slice(0, 6)) {
    observations.push({
      platform: "tiktok",
      kind: "content_gap",
      gap: String(gap),
      evidence: [
        createEvidenceItem({
          kind: EVIDENCE_KINDS.OBSERVED,
          claim: `TikTok Creative Center / trend intake content gap: ${String(gap).slice(0, 160)}`,
          sourceUrl: insights.sourceUrl || null,
          confidence: 70,
          rawExcerpt: String(gap)
        })
      ]
    });
  }
  for (const tag of hashtags.slice(0, 6)) {
    const name = tag.hashtag || tag;
    observations.push({
      platform: "tiktok",
      kind: "trending_hashtag",
      hashtag: name,
      views: tag.views || null,
      evidence: [
        createEvidenceItem({
          kind: EVIDENCE_KINDS.OBSERVED,
          claim: `TikTok trending hashtag observed: ${name}${tag.views ? ` (${tag.views} views)` : ""}.`,
          sourceUrl: insights.sourceUrl || null,
          confidence: 75,
          rawExcerpt: `${name} ${tag.views || ""} ${tag.posts || ""}`.trim()
        })
      ]
    });
  }
  return createProviderResult({
    providerName: "tiktok_offline_insights",
    researchType: brandName ? "brand_social_mentions" : "ugc_strategy",
    query: brandName || niche,
    status: observations.length ? "ok" : "empty",
    reliability: 0.7,
    observations
  });
}

export async function tiktokLiveProvider({ brandName, fetchImpl = globalThis.fetch } = {}) {
  const token = String(process.env.TIKTOK_ACCESS_TOKEN || "").trim();
  const advertiserId = String(process.env.TIKTOK_ADVERTISER_ID || "").trim();
  if (!token) {
    return createProviderResult({
      providerName: "tiktok_creative_center_live",
      researchType: "advertising_observations",
      query: brandName,
      status: "not_configured",
      reliability: 0,
      error: "TikTok's operator-side API credentials are not configured. Creator input is not required.",
      observations: []
    });
  }

  // Marketing API keyword tool — works with access token; advertiser improves relevance.
  try {
    const body = {
      advertiser_id: advertiserId || undefined,
      keywords: [String(brandName || "").slice(0, 80)],
      category: "ALL"
    };
    const response = await fetchImpl("https://business-api.tiktok.com/open_api/v1.3/search/keyword/recommend/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Access-Token": token
      },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }
    if (!response.ok || Number(parsed.code) !== 0) {
      // Fall through to video insights search when keyword recommend is unavailable for this token type.
      const searchResponse = await fetchImpl(
        `https://business-api.tiktok.com/open_api/v1.3/tool/video/suggest/?advertiser_id=${encodeURIComponent(advertiserId || "")}`,
        {
          method: "GET",
          headers: { "Access-Token": token }
        }
      );
      if (!searchResponse.ok) {
        return createProviderResult({
          providerName: "tiktok_creative_center_live",
          researchType: "advertising_observations",
          query: brandName,
          status: "unavailable",
          reliability: 0,
          error: parsed.message || `TikTok API HTTP ${response.status}. Offline insights remain active.`,
          observations: []
        });
      }
    }

    const keywords = parsed?.data?.keywords || parsed?.data?.list || [];
    const observations = (Array.isArray(keywords) ? keywords : []).slice(0, 8).map((item, index) => {
      const word = typeof item === "string" ? item : item.keyword || item.keyword_recommend || item.name || "";
      return {
        platform: "tiktok",
        keyword: word,
        observation: {
          messagingAngle: word,
          hook: word,
          visualFormat: "short_form_video"
        },
        evidence: [
          createEvidenceItem({
            kind: EVIDENCE_KINDS.OBSERVED,
            claim: `TikTok Marketing API keyword signal related to ${brandName}: ${word}`,
            sourceUrl: "https://ads.tiktok.com/business/creativecenter",
            confidence: advertiserId ? 70 : 55,
            rawExcerpt: String(word).slice(0, 180)
          })
        ],
        id: `tt-kw-${index}`
      };
    });

    if (!observations.length) {
      return createProviderResult({
        providerName: "tiktok_creative_center_live",
        researchType: "advertising_observations",
        query: brandName,
        status: advertiserId ? "empty" : "unavailable",
        reliability: 0.4,
        error: advertiserId
          ? "TikTok API returned no keyword observations."
          : "Set TIKTOK_ADVERTISER_ID for fuller TikTok ad observations. Offline insights remain active.",
        observations: []
      });
    }

    return createProviderResult({
      providerName: "tiktok_creative_center_live",
      researchType: "advertising_observations",
      query: brandName,
      status: "ok",
      reliability: advertiserId ? 0.75 : 0.55,
      observations
    });
  } catch (error) {
    return createProviderResult({
      providerName: "tiktok_creative_center_live",
      researchType: "advertising_observations",
      query: brandName,
      status: "unavailable",
      reliability: 0,
      error: String(error?.message || error),
      observations: []
    });
  }
}

export function listSocialResearchProviders() {
  const xConfigured = Boolean(String(process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || "").trim());
  const metaConfigured = Boolean(String(process.env.META_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN || "").trim());
  const igConfigured = metaConfigured && Boolean(String(process.env.IG_USER_ID || "").trim());
  const tiktokLiveConfigured = Boolean(String(process.env.TIKTOK_ACCESS_TOKEN || "").trim());
  return [
    { name: "youtube_public_discovery", configured: Boolean(String(process.env.YOUTUBE_API_KEY || "").trim()), status: String(process.env.YOUTUBE_API_KEY || "").trim() ? "implemented" : "not_configured", researchType: "ugc_strategy" },
    { name: "reddit_ugc_strategy", configured: true, status: "implemented", researchType: "ugc_strategy" },
    { name: "reddit_brand_social", configured: true, status: "implemented", researchType: "brand_social_mentions" },
    { name: "tiktok_backend_trend_feed", configured: Boolean(String(process.env.TIKTOK_TRENDS_FEED_URL || "").trim()), status: String(process.env.TIKTOK_TRENDS_FEED_URL || "").trim() ? "implemented" : "not_configured", researchType: "ugc_strategy" },
    { name: "tiktok_offline_insights", configured: true, status: "implemented", researchType: "ugc_strategy" },
    {
      name: "tiktok_creative_center_live",
      configured: tiktokLiveConfigured,
      status: tiktokLiveConfigured ? "implemented" : "not_configured",
      researchType: "advertising_observations"
    },
    { name: "meta_ad_library", configured: metaConfigured, status: metaConfigured ? "implemented" : "not_configured", researchType: "advertising_observations" },
    { name: "instagram_graph", configured: igConfigured, status: igConfigured ? "implemented" : "not_configured", researchType: "brand_social_mentions" },
    { name: "x_recent_search", configured: xConfigured, status: xConfigured ? "implemented" : "not_configured", researchType: "brand_social_mentions" }
  ];
}

/**
 * Full UGC strategy pass across free sources + keyed platforms when available.
 */
export async function researchUgcStrategyAcrossPlatforms({
  niche = "UGC",
  insights = null,
  fetchImpl = globalThis.fetch,
  cacheStore = null
} = {}) {
  const runs = [];
  const youtube = await youtubeNicheResearchProvider({ niche, fetchImpl, cacheStore });
  if (youtube.status !== "not_configured") runs.push(youtube);
  runs.push(await redditUgcStrategyProvider({ niche, fetchImpl }));
  const backendTrends = await tiktokBackendTrendFeedProvider({ niche, fetchImpl });
  if (backendTrends.status !== "not_configured") runs.push(backendTrends);
  runs.push(await tiktokOfflineInsightsProvider({ niche, insights }));
  const tiktok = await tiktokLiveProvider({ brandName: niche, fetchImpl });
  if (tiktok.status !== "not_configured") runs.push(tiktok);
  // Keyed platforms can still contribute strategy signals when configured.
  const x = await xBrandSearchProvider({ brandName: niche, fetchImpl });
  if (x.status !== "not_configured") runs.push(x);
  const meta = await metaAdLibraryProvider({ brandName: niche, fetchImpl });
  if (meta.status !== "not_configured") runs.push(meta);

  const whatWorks = [];
  const antiPatterns = [];
  const unknowns = [];
  for (const run of runs) {
    if (run.status === "not_configured" || run.status === "unavailable") {
      unknowns.push(`${run.providerName}: ${run.error || run.status}`);
      continue;
    }
    for (const obs of run.observations || []) {
      for (const evidence of obs.evidence || []) {
        if (obs.lessonKind === "anti_pattern" || /warning|anti-pattern|trust|payment concern/i.test(evidence.claim)) {
          antiPatterns.push(evidence);
        } else if (obs.lessonKind === "what_works" || obs.kind === "content_gap" || obs.kind === "trending_hashtag") {
          whatWorks.push(evidence);
        } else {
          whatWorks.push(evidence);
        }
      }
    }
  }
  return {
    runs,
    whatWorks: whatWorks.slice(0, 20),
    antiPatterns: antiPatterns.slice(0, 20),
    unknowns,
    platformsCovered: [...new Set(runs.filter((run) => run.status === "ok").map((run) => run.providerName))]
  };
}

/**
 * Brand outreach research across social platforms + optional site social links.
 */
export async function researchBrandAcrossSocialPlatforms({
  brandName,
  website = null,
  siteHtml = null,
  insights = null,
  fetchImpl = globalThis.fetch
} = {}) {
  const socialProfiles = siteHtml ? extractSocialProfilesFromHtml(siteHtml, website || "") : {};
  const runs = [];
  runs.push(await redditBrandSocialProvider({ brandName, fetchImpl }));
  runs.push(await tiktokOfflineInsightsProvider({ brandName, niche: brandName, insights }));
  runs.push(await metaAdLibraryProvider({ brandName, fetchImpl }));
  runs.push(await instagramGraphProvider({ brandName, fetchImpl }));
  runs.push(await xBrandSearchProvider({ brandName, fetchImpl }));
  runs.push(await tiktokLiveProvider({ brandName, fetchImpl }));

  if (Object.values(socialProfiles).some(Boolean)) {
    runs.push(
      createProviderResult({
        providerName: "brand_site_social_links",
        researchType: "brand_social_profiles",
        query: brandName,
        retrievedUrl: website,
        status: "ok",
        reliability: 0.85,
        observations: [
          {
            platform: "official_site",
            socialProfiles,
            evidence: [
              createEvidenceItem({
                kind: EVIDENCE_KINDS.OBSERVED,
                claim: `Public social profile links observed on brand site for ${brandName}.`,
                sourceUrl: website,
                confidence: 90,
                rawExcerpt: Object.entries(socialProfiles)
                  .filter(([, value]) => value)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(" · ")
              })
            ]
          }
        ]
      })
    );
  }

  return {
    socialProfiles,
    runs,
    available: runs.filter((run) => run.status === "ok"),
    unavailable: runs.filter((run) => ["not_configured", "unavailable"].includes(run.status))
  };
}

export { UGC_STRATEGY_COMMUNITIES, BRAND_MENTION_COMMUNITIES };
