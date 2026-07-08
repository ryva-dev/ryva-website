const NICHE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "content",
  "creator",
  "for",
  "focused",
  "the",
  "ugc",
  "with"
]);

const CATEGORY_KEYWORD_MAP = {
  beauty: ["beauty", "skincare", "makeup", "cosmetic", "skin"],
  fitness: ["fitness", "gym", "workout", "health"],
  food: ["food", "recipe", "cooking", "kitchen"],
  lifestyle: ["lifestyle", "routine", "daily", "home"],
  travel: ["travel", "trip", "hotel"],
  wellness: ["wellness", "health", "supplement", "selfcare", "self-care"]
};

export function extractNicheKeywords(niche) {
  const raw = String(niche ?? "").toLowerCase();
  const tokens = raw
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !NICHE_STOP_WORDS.has(token));

  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const [category, aliases] of Object.entries(CATEGORY_KEYWORD_MAP)) {
      if (aliases.some((alias) => token.includes(alias) || alias.includes(token))) {
        expanded.add(category);
        aliases.forEach((alias) => expanded.add(alias));
      }
    }
  }

  return [...expanded];
}

export function scoreHashtagForNiche(hashtag, nicheKeywords) {
  if (!hashtag || nicheKeywords.length === 0) {
    return 0;
  }

  const tagText = String(hashtag.hashtag || "").toLowerCase();
  const categories = Array.isArray(hashtag.categories) ? hashtag.categories.map((item) => String(item).toLowerCase()) : [];
  const rowText = String(hashtag.rowText || "").toLowerCase();
  let score = 0;

  for (const keyword of nicheKeywords) {
    if (tagText.includes(keyword)) score += 4;
    if (rowText.includes(keyword)) score += 2;
    if (categories.some((category) => category.includes(keyword))) score += 3;
  }

  return score;
}

function buildContentGapLabel(hashtag, niche) {
  const tag = String(hashtag?.hashtag || "").trim();
  const categories = Array.isArray(hashtag?.categories) ? hashtag.categories.join(" / ") : "";
  return categories ? `${tag} trending in ${categories} for ${niche}` : `${tag} trending for ${niche}`;
}

export function buildScopedTrendInsights(globalPayload, niche, { fallbackCount = 5 } = {}) {
  const nicheKeywords = extractNicheKeywords(niche);
  const hashtags = Array.isArray(globalPayload?.hashtags) ? globalPayload.hashtags : [];
  const ranked = hashtags
    .map((hashtag) => ({
      hashtag,
      score: scoreHashtagForNiche(hashtag, nicheKeywords)
    }))
    .sort((left, right) => right.score - left.score);

  const matched = ranked.filter((entry) => entry.score > 0).map((entry) => entry.hashtag);
  const selected = matched.length > 0 ? matched.slice(0, 15) : ranked.slice(0, fallbackCount).map((entry) => entry.hashtag);
  const scopedInsights = selected.map((hashtag) => ({
    summary: `${hashtag.hashtag} is trending${hashtag.categories?.length ? ` in ${hashtag.categories.join(" and ")}` : ""} with ${hashtag.posts || "visible"} posts and ${hashtag.views || "visible"} views.`,
    title: hashtag.hashtag
  }));
  const contentGaps = selected.map((hashtag) => ({
    gap: buildContentGapLabel(hashtag, niche),
    label: String(hashtag.hashtag || "").replace(/^#/, "")
  }));

  return {
    capturedAt: globalPayload?.capturedAt || globalPayload?.updatedAt || new Date().toISOString(),
    contentGaps,
    hashtags: selected,
    insights: scopedInsights,
    loginWallEncountered: Boolean(globalPayload?.loginWallEncountered),
    matchedToNiche: matched.length > 0,
    niche,
    nicheKeywords,
    notes: matched.length > 0
      ? [`Scoped ${selected.length} TikTok hashtag trend(s) to ${niche}.`]
      : [`No direct niche hashtag matches for ${niche}; saved top regional trends for awareness.`],
    periodDays: Number(globalPayload?.periodDays || 7),
    platform: "tiktok",
    region: String(globalPayload?.region || "US"),
    source: "tiktok_creative_center",
    sourceUrl: String(globalPayload?.sourceUrl || ""),
    updatedAt: new Date().toISOString(),
    visibleCount: selected.length
  };
}

export function inferTrendNiche({ accountContext, maraAnswers = {}, workerKnowledge = [] }) {
  const preferences = Array.isArray(workerKnowledge)
    ? (workerKnowledge.find((entry) => String(entry?.title ?? "").trim() === "Preferences")?.items ?? [])
    : [];
  const preferenceNiche = preferences.find((item) => /skincare|wellness|beauty|ugc|creator|fitness|food/i.test(String(item)));
  const onboardingNiche = String(maraAnswers.current_workflow || maraAnswers.email_volume || "").trim();
  return String(accountContext?.whatYouDo || onboardingNiche || preferenceNiche || "UGC creator brands").trim();
}

export function normalizeTrendInsightsPayload(payload) {
  if (!payload) {
    return null;
  }

  const contentGaps = Array.isArray(payload.contentGaps)
    ? payload.contentGaps
    : Array.isArray(payload.insights)
      ? payload.insights.map((item) => ({
          gap: String(item.summary || item.title || item).trim(),
          label: String(item.title || item.summary || item).trim()
        }))
      : [];

  return {
    capturedAt: payload.capturedAt || payload.updatedAt || null,
    contentGaps,
    hashtags: Array.isArray(payload.hashtags) ? payload.hashtags : [],
    insights: Array.isArray(payload.insights) ? payload.insights : [],
    loginWallEncountered: Boolean(payload.loginWallEncountered),
    matchedToNiche: Boolean(payload.matchedToNiche),
    niche: String(payload.niche || "").trim(),
    nicheKeywords: Array.isArray(payload.nicheKeywords) ? payload.nicheKeywords : [],
    notes: Array.isArray(payload.notes) ? payload.notes : [],
    periodDays: Number(payload.periodDays || 7),
    platform: String(payload.platform || payload.source || "tiktok"),
    region: String(payload.region || "US"),
    source: String(payload.source || "tiktok_creative_center"),
    sourceUrl: String(payload.sourceUrl || ""),
    updatedAt: payload.updatedAt || payload.capturedAt || null,
    visibleCount: Number(payload.visibleCount || payload.hashtags?.length || 0)
  };
}
