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

export function businessName(record: Record<string, unknown>): string {
  return shown(record.name, "Business unavailable");
}

export function businessQualification(record: Record<string, unknown>): string {
  return shown(record.qualificationStatus ?? record.qualification_status, "not_reviewed");
}

export function businessType(record: Record<string, unknown>): string {
  return shown(record.businessType ?? record.business_type, "Not recorded");
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
