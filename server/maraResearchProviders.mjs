/**
 * Modular research providers for Mara.
 * Providers fail safely — never fabricate observations.
 */
import { randomUUID } from "node:crypto";
import { sanitizeUntrustedText, EVIDENCE_KINDS, createEvidenceItem } from "./maraEvidence.mjs";
import { classifyBrandEntity, extractCanonicalDomain, recordResearchProviderRun } from "./maraBrandCanonical.mjs";

export function createProviderResult({
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

async function fetchText(fetchImpl, url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function decodeDuckDuckGoResultUrl(href) {
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : href;
  } catch {
    return href;
  }
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAllowedBrandResearchUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (/(reddit|linkedin|instagram|tiktok|youtube|duckduckgo|google|facebook|meta)\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

/** DuckDuckGo HTML search + shallow page metadata. */
export async function duckDuckGoBrandSearchProvider({ query, limit = 5, fetchImpl = globalThis.fetch }) {
  const started = Date.now();
  try {
    const html = await fetchText(fetchImpl, `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    const matches = [...html.matchAll(/result__a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gims)];
    const observations = [];
    const seen = new Set();
    for (const match of matches) {
      if (observations.length >= limit) break;
      const url = decodeDuckDuckGoResultUrl(match[1]);
      const title = stripHtml(match[2]);
      const domain = extractCanonicalDomain(url);
      if (!domain || seen.has(domain) || !isAllowedBrandResearchUrl(url)) continue;
      seen.add(domain);
      let pageHtml = "";
      try {
        pageHtml = await fetchText(fetchImpl, url);
      } catch {
        pageHtml = "";
      }
      const pageTitle = stripHtml(pageHtml.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] || title);
      const metaDescription = sanitizeUntrustedText(
        pageHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || "",
        { maxLength: 600, label: "meta_description" }
      ).text;
      const brandName = pageTitle.split("|")[0].split("—")[0].split("-")[0].trim() || title;
      const classification = classifyBrandEntity({ brandName, website: url, pageTitle, metaDescription });
      if (classification.reject) continue;
      // Public contact emails on page (mailto only — never invent).
      const mailto = [...pageHtml.matchAll(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi)].map((m) => m[1].toLowerCase());
      const partnershipHints = mailto.filter((email) => /partner|collab|creator|influencer|ugc|press|hello|hello@/i.test(email) || email.startsWith("partners@") || email.startsWith("creators@"));
      observations.push({
        brandName,
        website: url,
        canonicalDomain: classification.canonicalDomain,
        pageTitle,
        metaDescription,
        mailtoEmails: [...new Set(mailto)].slice(0, 5),
        partnershipEmails: [...new Set(partnershipHints)].slice(0, 3),
        evidence: [
          createEvidenceItem({
            kind: EVIDENCE_KINDS.OBSERVED,
            claim: `Public page titled "${pageTitle.slice(0, 120)}" resolved for ${brandName}.`,
            sourceUrl: url,
            confidence: 82,
            rawExcerpt: metaDescription.slice(0, 280)
          })
        ]
      });
    }
    return createProviderResult({
      providerName: "duckduckgo_html",
      researchType: "brand_discovery",
      query,
      status: "ok",
      reliability: 0.55,
      freshnessHours: (Date.now() - started) / 3_600_000,
      observations
    });
  } catch (error) {
    return createProviderResult({
      providerName: "duckduckgo_html",
      researchType: "brand_discovery",
      query,
      status: "unavailable",
      reliability: 0,
      error: String(error?.message || error),
      observations: []
    });
  }
}

/** Official-ish page research: title/meta + mailto + creator-program link heuristics. */
export async function officialSiteResearchProvider({ url, fetchImpl = globalThis.fetch }) {
  try {
    const html = await fetchText(fetchImpl, url);
    const sanitized = sanitizeUntrustedText(html, { maxLength: 50_000, label: "brand_website" });
    const pageTitle = stripHtml(html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] || "");
    const metaDescription = sanitizeUntrustedText(
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || "",
      { maxLength: 600 }
    ).text;
    const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
    const creatorProgramUrl =
      links.find((href) => /creator|ambassador|influencer|ugc|affiliate/i.test(href)) || null;
    const contactPageUrl = links.find((href) => /contact|partnership/i.test(href)) || null;
    const mailto = [...html.matchAll(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi)].map((m) => m[1].toLowerCase());
    return createProviderResult({
      providerName: "official_site_html",
      researchType: "brand_official",
      query: url,
      retrievedUrl: url,
      status: "ok",
      reliability: 0.7,
      observations: [
        {
          pageTitle,
          metaDescription,
          creatorProgramUrl,
          contactPageUrl,
          mailtoEmails: [...new Set(mailto)].slice(0, 8),
          injectionDetected: sanitized.injectionDetected,
          evidence: [
            createEvidenceItem({
              kind: EVIDENCE_KINDS.OBSERVED,
              claim: metaDescription
                ? `Site meta description observed for ${extractCanonicalDomain(url) || url}.`
                : `Official page retrieved for ${extractCanonicalDomain(url) || url}.`,
              sourceUrl: url,
              confidence: metaDescription ? 85 : 70,
              rawExcerpt: metaDescription || pageTitle
            })
          ]
        }
      ]
    });
  } catch (error) {
    return createProviderResult({
      providerName: "official_site_html",
      researchType: "brand_official",
      query: url,
      retrievedUrl: url,
      status: "unavailable",
      error: String(error?.message || error),
      observations: []
    });
  }
}

/** Reddit public JSON — complaints / creator chatter as soft risk signals. */
export async function redditBrandMentionProvider({ brandName, communities = ["ugc", "UGCSideHustle"], fetchImpl = globalThis.fetch }) {
  const observations = [];
  for (const community of communities) {
    try {
      const text = await fetchText(fetchImpl, `https://www.reddit.com/r/${community}/search.json?q=${encodeURIComponent(brandName)}&restrict_sr=1&limit=5`, {
        accept: "application/json"
      });
      const parsed = JSON.parse(text);
      for (const child of parsed?.data?.children || []) {
        const data = child?.data || {};
        if (!data.title) continue;
        const body = sanitizeUntrustedText(`${data.title}\n${data.selftext || ""}`, { maxLength: 500, label: "reddit" });
        const complaint = /scam|never\s+paid|didn't\s+pay|ghosted|chargeback/i.test(body.text);
        observations.push({
          community,
          title: data.title,
          url: `https://www.reddit.com${data.permalink || ""}`,
          complaintHint: complaint,
          evidence: [
            createEvidenceItem({
              kind: complaint ? EVIDENCE_KINDS.OBSERVED : EVIDENCE_KINDS.INFERENCE,
              claim: complaint
                ? `Creator-reported allegation language observed on Reddit regarding payment/trust (requires verification).`
                : `Public Reddit mention of ${brandName} in r/${community}.`,
              sourceUrl: `https://www.reddit.com${data.permalink || ""}`,
              confidence: complaint ? 55 : 40,
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
    providerName: "reddit_public_json",
    researchType: "brand_risk_mentions",
    query: brandName,
    status: observations.length ? "ok" : "empty",
    reliability: 0.4,
    observations
  });
}

/** Stub providers for platforms not yet integrated — explicit unavailable. */
export function metaAdLibraryProviderUnavailable({ brandName }) {
  return createProviderResult({
    providerName: "meta_ad_library",
    researchType: "advertising_observations",
    query: brandName,
    status: "not_configured",
    reliability: 0,
    error: "Meta Ad Library provider is not configured. No advertising observations fabricated.",
    observations: []
  });
}

export function tiktokCreativeCenterLiveProviderUnavailable({ brandName }) {
  return createProviderResult({
    providerName: "tiktok_creative_center_live",
    researchType: "advertising_observations",
    query: brandName,
    status: "not_configured",
    reliability: 0,
    error: "Live TikTok Creative Center API is not configured. Use offline snapshot sync if available.",
    observations: []
  });
}

const PROVIDERS = {
  duckduckgo_html: duckDuckGoBrandSearchProvider,
  official_site_html: officialSiteResearchProvider,
  reddit_public_json: redditBrandMentionProvider,
  meta_ad_library: async (args) => metaAdLibraryProviderUnavailable(args),
  tiktok_creative_center_live: async (args) => tiktokCreativeCenterLiveProviderUnavailable(args)
};

export function listResearchProviders() {
  return Object.keys(PROVIDERS).map((name) => ({
    name,
    configured: !["meta_ad_library", "tiktok_creative_center_live"].includes(name),
    status: ["meta_ad_library", "tiktok_creative_center_live"].includes(name) ? "interface_only" : "implemented"
  }));
}

export async function runResearchProvider(name, args) {
  const fn = PROVIDERS[name];
  if (!fn) {
    return createProviderResult({
      providerName: name,
      researchType: args.researchType || "unknown",
      query: args.query || args.brandName || "",
      status: "unknown_provider",
      error: `Unknown provider: ${name}`,
      observations: []
    });
  }
  return fn(args);
}

export async function deepResearchBrand(store, { userId, workerId, brandName, website, niche, fetchImpl = globalThis.fetch }) {
  const runs = [];
  const discovery = website
    ? await officialSiteResearchProvider({ url: website, fetchImpl })
    : await duckDuckGoBrandSearchProvider({ query: `${brandName || niche} brand official site`, limit: 3, fetchImpl });
  runs.push(discovery);
  const primary = discovery.observations?.[0];
  const resolvedWebsite = website || primary?.website;
  let official = discovery;
  if (resolvedWebsite && discovery.providerName !== "official_site_html") {
    official = await officialSiteResearchProvider({ url: resolvedWebsite, fetchImpl });
    runs.push(official);
  }
  const reddit = await redditBrandMentionProvider({ brandName: brandName || primary?.brandName || niche, fetchImpl });
  runs.push(reddit);
  runs.push(metaAdLibraryProviderUnavailable({ brandName: brandName || primary?.brandName }));
  runs.push(tiktokCreativeCenterLiveProviderUnavailable({ brandName: brandName || primary?.brandName }));

  for (const run of runs) {
    await recordResearchProviderRun(store, {
      userId,
      workerId,
      providerName: run.providerName,
      researchType: run.researchType,
      query: run.query,
      retrievedUrl: run.retrievedUrl,
      status: run.status,
      reliability: run.reliability,
      freshnessHours: run.freshnessHours,
      observations: run.observations,
      error: run.error,
      rateLimited: run.rateLimited
    });
  }

  return {
    id: randomUUID(),
    brandName: brandName || primary?.brandName || null,
    website: resolvedWebsite || null,
    runs,
    unavailable: runs.filter((run) => run.status !== "ok" && run.status !== "empty").map((run) => ({
      provider: run.providerName,
      status: run.status,
      error: run.error
    }))
  };
}
