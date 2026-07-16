/**
 * Authoritative connector catalog.
 *
 * This describes truthful provider capabilities; it does not grant authority.
 * A connection, tenant-scoped worker grant, and action policy must all agree
 * before runtime code can use a capability.
 */

export const INTEGRATION_CAPABILITIES = Object.freeze({
  INBOX_READ: "inbox.read",
  OWN_PROFILE_READ: "social.own_profile.read",
  OWN_CONTENT_READ: "social.own_content.read",
  OWN_ANALYTICS_READ: "social.own_analytics.read",
  PUBLIC_CONTENT_DISCOVERY: "social.public_content.discover",
  TREND_SIGNALS_READ: "trends.read",
  FILE_READ: "files.read",
  FILE_WRITE: "files.write",
  CHANGE_EVENTS: "changes.subscribe",
  DESIGN_CREATE: "designs.create",
  DESIGN_EXPORT: "designs.export"
});

const catalog = [
  {
    id: "gmail",
    name: "Gmail",
    category: "communication",
    implementationStatus: "live",
    authorization: "oauth2",
    capabilities: [INTEGRATION_CAPABILITIES.INBOX_READ],
    purpose: ["detect brand conversations", "track replies and outcomes", "prepare reply copy inside Ryva"],
    limitations: ["Mara never creates Gmail drafts and never sends external communication"]
  },
  {
    id: "instagram",
    name: "Instagram",
    category: "social",
    implementationStatus: "planned",
    authorization: "oauth2",
    capabilities: [
      INTEGRATION_CAPABILITIES.OWN_PROFILE_READ,
      INTEGRATION_CAPABILITIES.OWN_CONTENT_READ,
      INTEGRATION_CAPABILITIES.OWN_ANALYTICS_READ,
      INTEGRATION_CAPABILITIES.CHANGE_EVENTS
    ],
    purpose: ["learn creator performance", "identify format and hook patterns", "measure whether recommendations work"],
    limitations: ["official analytics access is for eligible professional accounts", "does not provide a general public trends firehose"]
  },
  {
    id: "tiktok",
    name: "TikTok",
    category: "social",
    implementationStatus: "planned",
    authorization: "oauth2",
    capabilities: [INTEGRATION_CAPABILITIES.OWN_PROFILE_READ, INTEGRATION_CAPABILITIES.OWN_CONTENT_READ],
    purpose: ["learn the creator's published work", "ground recommendations in their actual content"],
    limitations: ["Display API is creator-authorized profile/video access, not broad commercial trend research", "posting is intentionally out of scope"]
  },
  {
    id: "youtube",
    name: "YouTube",
    category: "social",
    implementationStatus: "live",
    authorization: "api_key_and_oauth2",
    capabilities: [
      INTEGRATION_CAPABILITIES.OWN_PROFILE_READ,
      INTEGRATION_CAPABILITIES.OWN_CONTENT_READ,
      INTEGRATION_CAPABILITIES.OWN_ANALYTICS_READ,
      INTEGRATION_CAPABILITIES.PUBLIC_CONTENT_DISCOVERY,
      INTEGRATION_CAPABILITIES.TREND_SIGNALS_READ
    ],
    purpose: ["discover niche content patterns", "measure owned-channel performance", "compare formats without inventing evidence"],
    limitations: ["search is quota-intensive and must be cached", "public popularity is a signal, not proof that an idea fits a creator"]
  },
  {
    id: "pinterest",
    name: "Pinterest",
    category: "social",
    implementationStatus: "partner_access_required",
    authorization: "oauth2",
    capabilities: [INTEGRATION_CAPABILITIES.OWN_ANALYTICS_READ, INTEGRATION_CAPABILITIES.TREND_SIGNALS_READ],
    purpose: ["detect visual and seasonal demand", "add growth-rate evidence to content planning"],
    limitations: ["Trends API availability is limited", "coverage varies by region and allowed filters"]
  },
  {
    id: "notion",
    name: "Notion",
    category: "workspace",
    implementationStatus: "planned",
    authorization: "oauth2",
    capabilities: [INTEGRATION_CAPABILITIES.FILE_READ, INTEGRATION_CAPABILITIES.FILE_WRITE, INTEGRATION_CAPABILITIES.CHANGE_EVENTS],
    purpose: ["import creator context", "publish approved work to a user-selected location", "react to user edits and corrections"],
    limitations: ["Ryva should only access pages the user explicitly grants", "writes require an explicit destination and user-controlled permission"]
  },
  {
    id: "google_drive",
    name: "Google Drive",
    category: "workspace",
    implementationStatus: "planned",
    authorization: "oauth2",
    capabilities: [INTEGRATION_CAPABILITIES.FILE_READ, INTEGRATION_CAPABILITIES.FILE_WRITE, INTEGRATION_CAPABILITIES.CHANGE_EVENTS],
    purpose: ["organize portfolios and approved deliverables", "observe user revisions", "use selected files as business evidence"],
    limitations: ["Drive access must use a separate least-privilege consent from Gmail", "Ryva should default to user-selected files or an app folder"]
  },
  {
    id: "canva",
    name: "Canva",
    category: "creative",
    implementationStatus: "app_review_required",
    authorization: "oauth2",
    capabilities: [INTEGRATION_CAPABILITIES.DESIGN_CREATE, INTEGRATION_CAPABILITIES.DESIGN_EXPORT, INTEGRATION_CAPABILITIES.CHANGE_EVENTS],
    purpose: ["turn approved concepts into editable design starting points", "return exported assets to Ryva", "preserve creator control over final design"],
    limitations: ["public integrations require Canva review", "preview APIs are not production dependencies"]
  },
  {
    id: "obsidian",
    name: "Obsidian",
    category: "workspace",
    implementationStatus: "companion_required",
    authorization: "desktop_companion",
    capabilities: [INTEGRATION_CAPABILITIES.FILE_READ, INTEGRATION_CAPABILITIES.FILE_WRITE, INTEGRATION_CAPABILITIES.CHANGE_EVENTS],
    purpose: ["sync selected Markdown notes", "publish approved work into a chosen vault folder"],
    limitations: ["Obsidian does not expose a normal hosted multi-user OAuth API", "reliable two-way sync requires a local companion plugin or user-controlled synced folder"]
  }
];

function clone(entry) {
  return {
    ...entry,
    capabilities: [...entry.capabilities],
    purpose: [...entry.purpose],
    limitations: [...entry.limitations]
  };
}

export function listIntegrationCatalog() {
  return catalog.map(clone);
}

export function getIntegrationDefinition(provider) {
  const id = String(provider || "").trim().toLowerCase();
  const entry = catalog.find((item) => item.id === id);
  return entry ? clone(entry) : null;
}

export function assertIntegrationCatalogIntegrity(entries = catalog) {
  const ids = new Set();
  const allowedStatuses = new Set(["live", "planned", "partner_access_required", "app_review_required", "companion_required"]);
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id)) throw new Error(`Duplicate or missing integration id: ${entry.id || "<missing>"}`);
    ids.add(entry.id);
    if (!allowedStatuses.has(entry.implementationStatus)) throw new Error(`Invalid integration status for ${entry.id}`);
    if (!entry.authorization) throw new Error(`Missing authorization mode for ${entry.id}`);
    if (!Array.isArray(entry.capabilities) || entry.capabilities.length === 0) throw new Error(`Missing capabilities for ${entry.id}`);
    if (new Set(entry.capabilities).size !== entry.capabilities.length) throw new Error(`Duplicate capability for ${entry.id}`);
  }
  return true;
}

assertIntegrationCatalogIntegrity();
