export type ContactRow = Record<string, unknown> & {
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

export function dateTimeInput(value: string | Date = new Date()): string {
  const dateValue = value instanceof Date ? value : new Date(value);
  return new Date(dateValue.getTime() - dateValue.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function readable(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function contactName(record: Record<string, unknown>): string {
  return shown(record.name, "Contact unavailable");
}

export function contactVerification(record: Record<string, unknown>): string {
  return shown(record.verificationStatus ?? record.verification_status, "unverified");
}

export function contactPermission(record: Record<string, unknown>): string {
  return shown(record.permissionStatus ?? record.permission_status, "unknown");
}

export const verificationStatuses = [
  "",
  "unverified",
  "verified",
  "stale",
  "disputed"
] as const;

export type ContactCompatibility = {
  registerPath: string;
  detailPath: (id: string) => string;
  showCompatibilityNotice?: boolean;
};

export const canonicalContactPaths: ContactCompatibility = {
  registerPath: "/records/contact",
  detailPath: (id) => `/contacts/${id}`
};

export function contactParentLabel(
  record: ContactRow,
  businesses: Map<string, string>,
  brands: Map<string, string>
): string {
  const businessId = shown(record.businessId ?? record.business_id, "");
  const brandId = shown(record.brandId ?? record.brand_id, "");
  if (businessId && businesses.has(businessId)) return businesses.get(businessId)!;
  if (brandId && brands.has(brandId)) return brands.get(brandId)!;
  return "Parent unavailable";
}
