/**
 * Turn brand research pages into actionable discovery rules:
 * - no direct sponsorship inbox → do not pitch
 * - tag @Brand / #Brand for organic discovery → use in captions
 */

import { cleanDesiredBrandName } from "./maraOpportunityScoring.mjs";

export function extractBrandDiscoveryIntel({ text = "", brandName = "", url = "" } = {}) {
  const blob = `${String(text || "")}\n${String(url || "")}`;
  if (!blob.trim()) return null;

  const cleanedBrand = cleanDesiredBrandName(brandName) || String(brandName || "").trim();
  const brandToken = cleanedBrand.replace(/[^a-z0-9]/gi, "").toLowerCase();

  const noDirectOutreach =
    /\b(?:do(?:es)?\s+not|don['’]?t|no)\s+(?:provide\s+)?(?:a\s+)?direct\s+(?:email|application\s+form|sponsorship\s+(?:email|inbox|form))/i.test(blob) ||
    /\bno\s+(?:public\s+)?(?:application|sponsorship)\s+form\b/i.test(blob) ||
    /\b(?:sponsorship|partnership|athlete)\s+requests?\b.{0,80}\b(?:no|not|don['’]?t)\b.{0,40}\b(?:email|form|inbox)\b/i.test(blob) ||
    /\b(?:no|not|don['’]?t)\b.{0,40}\b(?:email|application\s+form)\b.{0,60}\b(?:sponsorship|partnership|athlete)\b/i.test(blob);

  const rawHandles = [...blob.matchAll(/(^|[^A-Za-z0-9_])@([A-Za-z][A-Za-z0-9._]{1,32})/g)].map((match) => `@${match[2]}`);
  const rawHashtags = [...blob.matchAll(/(^|[^A-Za-z0-9_])#([A-Za-z][A-Za-z0-9_]{1,40})/g)].map((match) => `#${match[2]}`);

  const brandHandles = [...new Set(
    rawHandles.filter((handle) => {
      if (!brandToken || brandToken.length < 3) return false;
      return handle.replace(/[^a-z0-9]/gi, "").toLowerCase().includes(brandToken.slice(0, Math.min(brandToken.length, 10)));
    })
  )].slice(0, 3);

  const brandHashtags = [...new Set(
    rawHashtags.filter((tag) => {
      if (!brandToken || brandToken.length < 3) return false;
      return tag.replace(/[^a-z0-9]/gi, "").toLowerCase().includes(brandToken.slice(0, Math.min(brandToken.length, 10)));
    })
  )].slice(0, 5);

  // If the page never names a brand handle/hashtag, synthesize the obvious ones
  // only when the copy clearly teaches organic tagging for this brand.
  const teachesOrganicDiscovery =
    /\b(?:tag|mention|hashtag)\b.{0,48}(?:@|#)/i.test(blob) ||
    /\binternally\s+look(?:s|ing)?\s+for\b/i.test(blob) ||
    /\bauthentic\s+(?:people|creators|content)\b.{0,60}\balign/i.test(blob) ||
    brandHandles.length > 0 ||
    brandHashtags.length > 0;

  if (!noDirectOutreach && !teachesOrganicDiscovery) {
    return null;
  }

  const handles = brandHandles.length
    ? brandHandles
    : cleanedBrand
      ? [`@${cleanedBrand.replace(/\s+/g, "")}`]
      : [];
  const hashtags = brandHashtags.length
    ? brandHashtags
    : cleanedBrand
      ? [`#${cleanedBrand.replace(/\s+/g, "")}`]
      : [];

  const mode = noDirectOutreach ? "tag_discovery" : "tag_discovery_hint";
  const summary = noDirectOutreach
    ? `${cleanedBrand || "This brand"} does not offer a direct sponsorship inbox/form. Discovery is via authentic tagged content (${[...handles, ...hashtags].join(" ")}). Do not pitch — tag them in niche posts instead.`
    : `${cleanedBrand || "This brand"} appears to scout creators through tagged/hashtagged content (${[...handles, ...hashtags].join(" ")}). Prefer organic tags over cold outreach unless a real contact appears.`;

  return {
    brandName: cleanedBrand || brandName || "Unknown brand",
    mode,
    allowOutreachPitch: !noDirectOutreach,
    handles,
    hashtags,
    sourceUrl: url || null,
    summary,
    confidence: noDirectOutreach && (handles.length || hashtags.length) ? 80 : 60
  };
}

export function shouldAllowOutreachPitch(intel) {
  if (!intel) return true;
  if (intel.allowOutreachPitch === false) return false;
  if (intel.mode === "tag_discovery") return false;
  return true;
}

export function mergeBrandDiscoveryRoute(existingRoutes = [], intel) {
  if (!intel?.brandName) return Array.isArray(existingRoutes) ? existingRoutes : [];
  const key = String(intel.brandName).trim().toLowerCase();
  if (!key) return Array.isArray(existingRoutes) ? existingRoutes : [];
  const next = Array.isArray(existingRoutes) ? [...existingRoutes] : [];
  const row = {
    ...intel,
    updatedAt: new Date().toISOString()
  };
  const index = next.findIndex((entry) => String(entry?.brandName || "").trim().toLowerCase() === key);
  if (index >= 0) {
    next[index] = {
      ...next[index],
      ...row,
      handles: [...new Set([...(next[index].handles || []), ...(row.handles || [])])].slice(0, 5),
      hashtags: [...new Set([...(next[index].hashtags || []), ...(row.hashtags || [])])].slice(0, 8)
    };
  } else {
    next.push(row);
  }
  return next.slice(0, 40);
}

/** Tags/handles to inject into caption advice — never as outreach targets. */
export function contentAdviceFromDiscoveryRoutes(routes = [], { limit = 8 } = {}) {
  const tags = [];
  for (const route of Array.isArray(routes) ? routes : []) {
    if (!route || (route.mode !== "tag_discovery" && route.mode !== "tag_discovery_hint")) continue;
    for (const handle of route.handles || []) {
      if (handle) tags.push(String(handle));
    }
    for (const tag of route.hashtags || []) {
      if (tag) tags.push(String(tag));
    }
  }
  return [...new Set(tags)].slice(0, limit);
}

export function formatDiscoveryRoutesForDeliverable(routes = []) {
  return (Array.isArray(routes) ? routes : [])
    .filter((route) => route?.mode === "tag_discovery" || route?.mode === "tag_discovery_hint")
    .map((route) => {
      const tags = [...(route.handles || []), ...(route.hashtags || [])].join(" ");
      const pitchRule = shouldAllowOutreachPitch(route) ? "outreach only if a real contact appears" : "do not pitch";
      return `${route.brandName}: ${pitchRule}. Use in captions: ${tags || "(tags pending)"}.${route.sourceUrl ? ` Source: ${route.sourceUrl}` : ""}`;
    });
}
