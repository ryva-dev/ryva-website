/**
 * Contact enrichment providers — pluggable paid APIs + free probes.
 * Never invents sendable emails. Inferred patterns stay mayUseForOutreach=false.
 */
import { CONTACT_TYPES, upsertBrandContact, isPartnershipEmail } from "./maraContactDiscovery.mjs";

export const ENRICHMENT_PROVIDERS = Object.freeze({
  FREE_SITE_PROBES: "free_site_probes",
  HUNTER: "hunter",
  APOLLO: "apollo"
});

const STANDARD_CONTACT_PATHS = [
  "/contact",
  "/contact-us",
  "/contactus",
  "/pages/contact",
  "/pages/contact-us",
  "/pages/partnerships",
  "/pages/collaborations",
  "/pages/creators",
  "/pages/influencer",
  "/partnerships",
  "/collaborations",
  "/creators",
  "/influencer",
  "/ugc",
  "/press",
  "/media",
  "/about",
  "/about-us",
  "/team",
  "/pages/about"
];

function createResult(partial) {
  return {
    provider: ENRICHMENT_PROVIDERS.FREE_SITE_PROBES,
    status: "ok",
    emails: [],
    partnershipEmails: [],
    pagesFetched: 0,
    inferredPatterns: [],
    error: null,
    ...partial
  };
}

async function fetchText(fetchImpl, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { accept: "text/html,application/xml,application/json,*/*" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export function extractEmailsFromText(text) {
  const matches = [...String(text || "").matchAll(/\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/gi)].map((m) =>
    m[1].toLowerCase()
  );
  return [...new Set(matches)].filter(
    (email) => !/(example\.com|domain\.com|email\.com|sentry\.io|wixpress|cloudflare|schema\.org|placeholder)/i.test(email)
  );
}

export function extractEmailsFromJsonLd(html) {
  const blocks = [...String(html || "").matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const emails = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]);
      const stack = Array.isArray(parsed) ? parsed : [parsed];
      while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== "object") continue;
        if (typeof node.email === "string") emails.push(node.email.toLowerCase());
        for (const value of Object.values(node)) {
          if (value && typeof value === "object") stack.push(value);
        }
      }
    } catch {
      /* ignore bad JSON-LD */
    }
  }
  return [...new Set(emails)];
}

export function deriveUnverifiedEmailPatterns(domain) {
  const host = String(domain || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();
  if (!host || !host.includes(".")) return [];
  // Common creator-outreach locals — NEVER outreach-ready until validated/confirmed.
  return ["partners", "partnerships", "collab", "creators", "influencer", "hello", "press", "marketing"].map(
    (local) => ({
      email: `${local}@${host}`,
      inferred: true,
      confidence: 25,
      note: "Unverified pattern — requires confirmation before send"
    })
  );
}

export function resolveDomainFromWebsite(website) {
  try {
    return new URL(website).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

/** Probe common contact/creator paths + sitemap + JSON-LD. */
export async function freeSiteContactProbes({ website, fetchImpl = globalThis.fetch } = {}) {
  if (!website) return createResult({ status: "skipped", error: "No website" });
  let origin;
  try {
    origin = new URL(website).origin;
  } catch {
    return createResult({ status: "skipped", error: "Invalid website" });
  }

  const emails = new Set();
  const partnershipEmails = new Set();
  let pagesFetched = 0;
  const urls = STANDARD_CONTACT_PATHS.map((path) => `${origin}${path}`);

  try {
    const sitemap = await fetchText(fetchImpl, `${origin}/sitemap.xml`);
    pagesFetched += 1;
    const locs = [...sitemap.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
    for (const loc of locs) {
      if (/contact|partner|collab|creator|influencer|press|about|team/i.test(loc)) {
        urls.push(loc);
      }
    }
  } catch {
    /* sitemap optional */
  }

  const fetchedPages = await Promise.all(
    [...new Set(urls)].slice(0, 8).map(async (url) => {
      try {
        return await fetchText(fetchImpl, url);
      } catch {
        return null;
      }
    })
  );
  for (const html of fetchedPages.filter(Boolean)) {
    try {
      pagesFetched += 1;
      for (const email of extractEmailsFromText(html)) emails.add(email);
      for (const email of extractEmailsFromJsonLd(html)) emails.add(email);
      for (const email of emails) {
        if (isPartnershipEmail(email)) partnershipEmails.add(email);
      }
    } catch {
      continue;
    }
  }

  const domain = resolveDomainFromWebsite(website);
  const inferredPatterns = domain ? deriveUnverifiedEmailPatterns(domain) : [];

  return createResult({
    provider: ENRICHMENT_PROVIDERS.FREE_SITE_PROBES,
    status: emails.size || pagesFetched ? "ok" : "empty",
    emails: [...emails],
    partnershipEmails: [...partnershipEmails],
    pagesFetched,
    inferredPatterns
  });
}

/** Hunter.io domain search — optional paid enrichment. */
export async function hunterDomainSearch({ website, fetchImpl = globalThis.fetch } = {}) {
  const apiKey = String(process.env.HUNTER_API_KEY || "").trim();
  const domain = resolveDomainFromWebsite(website);
  if (!apiKey) {
    return createResult({
      provider: ENRICHMENT_PROVIDERS.HUNTER,
      status: "not_configured",
      error: "HUNTER_API_KEY not set"
    });
  }
  if (!domain) {
    return createResult({ provider: ENRICHMENT_PROVIDERS.HUNTER, status: "skipped", error: "No domain" });
  }
  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(apiKey)}&limit=10`;
    const text = await fetchText(fetchImpl, url);
    const parsed = JSON.parse(text);
    const emails = [];
    const partnershipEmails = [];
    for (const entry of parsed?.data?.emails || []) {
      const value = String(entry.value || "").toLowerCase();
      if (!value.includes("@")) continue;
      emails.push(value);
      const role = `${entry.position || ""} ${entry.department || ""} ${entry.type || ""}`;
      if (/partner|creator|influencer|marketing|pr|press|collab|growth/i.test(role) || isPartnershipEmail(value)) {
        partnershipEmails.push(value);
      }
    }
    return createResult({
      provider: ENRICHMENT_PROVIDERS.HUNTER,
      status: emails.length ? "ok" : "empty",
      emails: [...new Set(emails)],
      partnershipEmails: [...new Set(partnershipEmails)],
      pagesFetched: 1
    });
  } catch (error) {
    return createResult({
      provider: ENRICHMENT_PROVIDERS.HUNTER,
      status: "unavailable",
      error: String(error?.message || error)
    });
  }
}

/** Apollo organization people search — optional. */
export async function apolloOrgContacts({ website, fetchImpl = globalThis.fetch } = {}) {
  const apiKey = String(process.env.APOLLO_API_KEY || "").trim();
  const domain = resolveDomainFromWebsite(website);
  if (!apiKey) {
    return createResult({
      provider: ENRICHMENT_PROVIDERS.APOLLO,
      status: "not_configured",
      error: "APOLLO_API_KEY not set"
    });
  }
  if (!domain) {
    return createResult({ provider: ENRICHMENT_PROVIDERS.APOLLO, status: "skipped", error: "No domain" });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    let response;
    try {
      response = await fetchImpl("https://api.apollo.io/v1/mixed_people/search", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey
        },
        body: JSON.stringify({
          q_organization_domains: domain,
          person_titles: [
            "influencer marketing",
            "creator partnerships",
            "brand partnerships",
            "social media manager",
            "growth marketing",
            "pr manager"
          ],
          page: 1,
          per_page: 10
        })
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = await response.json();
    const emails = [];
    for (const person of parsed.people || []) {
      const value = String(person.email || "").toLowerCase();
      if (value.includes("@")) emails.push(value);
    }
    return createResult({
      provider: ENRICHMENT_PROVIDERS.APOLLO,
      status: emails.length ? "ok" : "empty",
      emails: [...new Set(emails)],
      partnershipEmails: [...new Set(emails)],
      pagesFetched: 1
    });
  } catch (error) {
    return createResult({
      provider: ENRICHMENT_PROVIDERS.APOLLO,
      status: "unavailable",
      error: String(error?.message || error)
    });
  }
}

/**
 * Run free probes + optional paid providers; persist contacts with correct usability.
 */
export async function enrichAndPersistBrandContacts(store, {
  userId,
  workerId,
  publicBrandId,
  website,
  fetchImpl = globalThis.fetch
}) {
  const [free, hunter, apollo] = await Promise.all([
    freeSiteContactProbes({ website, fetchImpl }),
    hunterDomainSearch({ website, fetchImpl }),
    apolloOrgContacts({ website, fetchImpl })
  ]);
  const providers = [free, hunter, apollo];

  const savedIds = [];
  for (const result of providers) {
    if (!result.emails?.length) continue;
    for (const email of result.emails) {
      const isPartnership =
        result.partnershipEmails?.includes(email) || isPartnershipEmail(email);
      const id = await upsertBrandContact(store, {
        userId,
        workerId,
        publicBrandId,
        contactType: isPartnership ? CONTACT_TYPES.PARTNERSHIP_EMAIL : CONTACT_TYPES.PUBLIC_EMPLOYEE_EMAIL,
        value: email,
        source: result.provider,
        sourceUrl: website,
        confidence: result.provider === ENRICHMENT_PROVIDERS.HUNTER || result.provider === ENRICHMENT_PROVIDERS.APOLLO ? 82 : 70,
        verificationState: "unverified",
        inferred: false
      });
      savedIds.push(id);
    }
  }

  // Persist inferred patterns as non-sendable candidates for manager confirmation.
  for (const pattern of free.inferredPatterns || []) {
    const id = await upsertBrandContact(store, {
      userId,
      workerId,
      publicBrandId,
      contactType: CONTACT_TYPES.INFERRED_PATTERN,
      value: pattern.email,
      source: "inferred_pattern",
      sourceUrl: website,
      confidence: pattern.confidence,
      verificationState: "unverified",
      inferred: true
    });
    savedIds.push(id);
  }

  return {
    providers: providers.map((item) => ({
      provider: item.provider,
      status: item.status,
      emailCount: item.emails?.length || 0,
      error: item.error
    })),
    savedIds: [...new Set(savedIds.filter(Boolean))],
    emailsFound: [...new Set(providers.flatMap((item) => item.emails || []))]
  };
}

export function listContactEnrichmentProviders() {
  return [
    {
      name: ENRICHMENT_PROVIDERS.FREE_SITE_PROBES,
      configured: true,
      status: "implemented",
      note: "Sitemap + standard contact/creator paths + JSON-LD"
    },
    {
      name: ENRICHMENT_PROVIDERS.HUNTER,
      configured: Boolean(String(process.env.HUNTER_API_KEY || "").trim()),
      status: String(process.env.HUNTER_API_KEY || "").trim() ? "implemented" : "not_configured",
      note: "Optional domain email search"
    },
    {
      name: ENRICHMENT_PROVIDERS.APOLLO,
      configured: Boolean(String(process.env.APOLLO_API_KEY || "").trim()),
      status: String(process.env.APOLLO_API_KEY || "").trim() ? "implemented" : "not_configured",
      note: "Optional people search by partnership titles"
    }
  ];
}
