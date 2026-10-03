export type BrandRow = Record<string, unknown> & {
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

/** Trailing seed/fixture slug such as "acct-chromium-desktop-1784734596469". */
const BRAND_FIXTURE_SUFFIX = /\s+(?:[a-z]{2,}(?:-[a-z0-9]+)+-\d{8,})\s*$/i;

/** Trailing seed/fixture slug such as "detail-chromium-desktop-1784734627049". */
const FIXTURE_SLUG = /(?:\s+|[-_])[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*-\d{6,}\s*$/i;
/** Browser harness tails such as "chromium-mobile-1784734673869". */
const FIXTURE_BROWSER = /(?:\s+|[-_])chromium-(?:desktop|mobile)(?:-\d{6,})?\s*$/i;
/** Leading synthetic/fixture labels. */
const FIXTURE_PREFIX = /^(?:synthetic|fixture|seed|test)\s+/i;

export function displayBrandName(value: unknown, fallback = "—"): string {
  const text = shown(value, "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  const cleaned = text.replace(BRAND_FIXTURE_SUFFIX, "").trim();
  return cleaned || text;
}

export function brandNameTitle(value: unknown): string | undefined {
  const raw = shown(value, "").replace(/\s+/g, " ").trim();
  if (!raw) return undefined;
  const clean = displayBrandName(raw, "");
  return clean && clean !== raw ? raw : undefined;
}

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

export function brandName(record: Record<string, unknown>): string {
  return displayBrandName(record.name ?? record.public_name ?? record.publicName, "Brand unavailable");
}

export function brandStage(record: Record<string, unknown>): string {
  return shown(record.pipelineStage ?? record.pipeline_stage, "discovered");
}

/** Rep-friendly lifecycle label for register and summary surfaces. */
export function brandStageLabel(record: Record<string, unknown>): string {
  switch (brandStage(record).toLowerCase()) {
    case "discovered":
      return "Discovered";
    case "researching":
      return "Researching";
    case "contact_ready":
      return "Contact ready";
    case "rejected":
      return "Not a fit";
    default:
      return readable(brandStage(record));
  }
}

export function brandIdentity(record: Record<string, unknown>): string {
  return shown(record.identityStatus ?? record.identity_status, "unverified");
}

/** Rep-friendly identity verification label for detail surfaces. */
export function brandIdentityLabel(record: Record<string, unknown>): string {
  switch (brandIdentity(record).toLowerCase()) {
    case "verified":
      return "Verified";
    case "reviewing":
      return "Review in progress";
    default:
      return "Unverified";
  }
}

/** Single readiness dimension — replaces overlapping wholesale/review/unknown cues in registers. */
export function brandReadinessLabel(record: Record<string, unknown>): string {
  const wholesale = shown(record.wholesaleStatus ?? record.wholesale_status, "unknown").toLowerCase();
  const reviewed = Boolean(shown(record.lastReviewedAt ?? record.last_reviewed_at, ""));

  if (wholesale === "available") return "Ready for wholesale";
  if (wholesale === "restricted") return "Restricted";
  if (wholesale === "not_offered") return "Not offered";
  if (wholesale === "inquiry_required") return "Needs inquiry";
  if (reviewed) return "Reviewed";
  return "Needs review";
}

/** Single risk dimension for register rows. */
export function brandRiskLabel(record: Record<string, unknown>): string {
  const count = Number(record.riskCount ?? record.risk_count ?? 0);
  if (!Number.isFinite(count) || count <= 0) return "Low";
  if (count >= 3) return "High";
  return "Medium";
}

export function brandField(record: Record<string, unknown>, camel: string, snake: string): unknown {
  return record[camel] ?? record[snake];
}

export const brandStages = [
  "",
  "discovered",
  "researching",
  "contact_ready",
  "rejected"
] as const;

export const brandFields = [
  ["wholesaleStatus", "Wholesale status", ["unknown", "not_offered", "inquiry_required", "available", "restricted"]],
  ["communicationCondition", "Communication condition", ["not_reviewed", "concerning", "conditional", "professional"]],
  ["contactPurpose", "Professional contact purpose", []],
  ["operationsSummary", "Operations summary", []],
  ["stopFlag", "Stop flag", ["false", "true"]]
] as const;

/** Rep-friendly value prompt for wholesale profile edits. */
export function brandFieldValueLabel(fieldKey: string): string {
  switch (fieldKey) {
    case "wholesaleStatus":
      return "Select status";
    case "communicationCondition":
      return "Select condition";
    case "stopFlag":
      return "Select option";
    case "contactPurpose":
      return "Contact purpose";
    case "operationsSummary":
      return "Operations summary";
    default:
      return "Enter value";
  }
}

export function brandFieldValuePlaceholder(fieldKey: string): string {
  switch (fieldKey) {
    case "contactPurpose":
      return "Enter purpose";
    case "operationsSummary":
      return "Enter summary";
    default:
      return brandFieldValueLabel(fieldKey);
  }
}

export const brandResearchConfidenceOptions = [
  ["insufficient", "Not sure yet"],
  ["limited", "Low"],
  ["supported", "Medium"],
  ["strong", "High"]
] as const;

export function brandResearchConfidenceLabel(confidence: string): string {
  return brandResearchConfidenceOptions.find(([value]) => value === confidence)?.[1] ?? readable(confidence);
}

export function brandResearchEvidenceClass(confidence: string): string {
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

export type BrandCompatibility = {
  registerPath: string;
  detailPath: (id: string) => string;
  showCompatibilityNotice?: boolean;
};

export const canonicalBrandPaths: BrandCompatibility = {
  registerPath: "/brands",
  detailPath: (id) => `/brands/${id}`
};
