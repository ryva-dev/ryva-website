export type BuyerRow = Record<string, unknown> & {
  id: string;
  name: string;
  version: number;
};

export function shown(value: unknown, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return fallback;
}

export function date(value: unknown): string {
  return typeof value === "string" && value ? new Date(value).toLocaleDateString() : "Not reviewed";
}

export function dateTime(value: unknown, fallback = "Time not recorded"): string {
  return typeof value === "string" && value ? new Date(value).toLocaleString() : fallback;
}

export function readable(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Trailing seed/fixture slug such as "detail-chromium-desktop-1784734627049". */
const FIXTURE_SLUG = /(?:\s+|[-_])[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*-\d{6,}\s*$/i;
/** Browser harness tails such as "chromium-mobile-1784734673869". */
const FIXTURE_BROWSER = /(?:\s+|[-_])chromium-(?:desktop|mobile)(?:-\d{6,})?\s*$/i;
/** Leading synthetic/fixture labels. */
const FIXTURE_PREFIX = /^(?:synthetic|fixture|seed|test)\s+/i;

export function displayName(value: unknown, fallback = "—"): string {
  let text = shown(value, "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  for (let i = 0; i < 4; i += 1) {
    const next = text
      .replace(FIXTURE_SLUG, "")
      .replace(FIXTURE_BROWSER, "")
      .replace(FIXTURE_PREFIX, "")
      .trim();
    if (next === text) break;
    text = next;
  }
  return text || shown(value, fallback);
}

export function businessName(record: Record<string, unknown>): string {
  return displayName(record.name, "Business unavailable");
}

export function businessQualification(record: Record<string, unknown>): string {
  return shown(record.qualificationStatus ?? record.qualification_status, "not_reviewed");
}

export function businessType(record: Record<string, unknown>): string {
  return shown(record.businessType ?? record.business_type, "Not recorded");
}

/** Rep-facing business type — never show snake_case codes like gift_shop. */
export function businessTypeLabel(record: Record<string, unknown>): string {
  const raw = businessType(record);
  if (!raw || raw === "Not recorded") return "Not recorded";
  const spaced = raw.replaceAll("_", " ").replace(/\s+/g, " ").trim();
  if (!spaced) return "Not recorded";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function businessQualificationLabel(record: Record<string, unknown>): string {
  switch (businessQualification(record).toLowerCase()) {
    case "not_reviewed":
      return "Not reviewed";
    case "researching":
      return "Researching";
    case "qualified":
      return "Qualified";
    case "conditional":
      return "Conditional";
    case "rejected":
      return "Not a fit";
    default:
      return readable(businessQualification(record));
  }
}

/** Compact contact / buyer coverage line for catalog tiles. */
export function businessCoverageLabel(record: Record<string, unknown>): string {
  const contacts = Number(record.contactCount ?? 0);
  const verified = Number(record.verifiedBuyerCount ?? 0);
  const contactPart = `${Number.isFinite(contacts) ? contacts : 0} contact${contacts === 1 ? "" : "s"}`;
  if (Number.isFinite(verified) && verified > 0) {
    return `${contactPart} · ${verified} verified buyer${verified === 1 ? "" : "s"}`;
  }
  if (businessQualification(record).toLowerCase() === "not_reviewed") {
    return `${contactPart} · Needs review`;
  }
  return `${contactPart} · 0 verified buyers`;
}

export function businessField(record: Record<string, unknown>, camel: string, snake: string): unknown {
  return record[camel] ?? record[snake];
}

export const qualificationStatuses = [
  "",
  "not_reviewed",
  "researching",
  "qualified",
  "conditional",
  "rejected"
] as const;

export const businessFields = [
  ["assortmentSummary", "Assortment summary", []],
  ["targetCustomerSummary", "Target customer", []],
  ["pricePositioning", "Price positioning", ["unknown", "value", "mid_market", "premium", "luxury", "mixed"]],
  ["fitRationale", "Fit rationale", []],
  ["currentVendorsSummary", "Current vendors", []]
] as const;

export const buyerRoleOptions = [
  ["unknown", "Not sure yet"],
  ["influencer", "Influences decisions"],
  ["evaluator", "Evaluates products"],
  ["decision_maker", "Makes buying decisions"],
  ["authorized_purchaser", "Authorized purchaser"]
] as const;

export function buyerRoleLabel(value: unknown): string {
  const role = shown(value, "unknown");
  return buyerRoleOptions.find(([key]) => key === role)?.[1] ?? readable(role);
}

export const businessResearchConfidenceOptions = [
  ["insufficient", "Not sure yet"],
  ["limited", "Low"],
  ["supported", "Medium"],
  ["strong", "High"]
] as const;

export function businessResearchEvidenceClass(confidence: string): string {
  switch (confidence) {
    case "strong":
      return "verified_fact";
    case "supported":
      return "direct_evidence";
    case "limited":
      return "weak_proxy";
    default:
      return "unknown";
  }
}

export type BuyerCompatibility = {
  registerPath: string;
  detailPath: (id: string) => string;
  showCompatibilityNotice?: boolean;
};

export const canonicalBuyerPaths: BuyerCompatibility = {
  registerPath: "/buyers",
  detailPath: (id) => `/buyers/${id}`
};

export const genericBusinessPaths: BuyerCompatibility = {
  registerPath: "/records/business",
  detailPath: (id) => `/records/business/${id}`,
  showCompatibilityNotice: true
};
