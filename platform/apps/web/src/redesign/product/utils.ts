export type ProductRow = Record<string, unknown> & {
  id: string;
  name: string;
  version: number;
  brandId?: string;
  brandName?: string;
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

export const productViews = [
  "discover",
  "watchlist",
  "under_review",
  "qualified",
  "rejected",
  "represented",
  "recently_updated"
] as const;

export const productFields = [
  ["wholesaleReadiness", "Wholesale readiness", ["not_reviewed", "not_ready", "conditional", "ready", "unknown"]],
  ["packagingReadiness", "Packaging readiness", ["not_reviewed", "not_ready", "conditional", "ready", "unknown"]],
  ["trendDirection", "Trend direction", ["rising", "stable", "declining", "volatile", "unknown"]],
  ["differentiation", "Differentiation", []],
  ["fulfillmentNotes", "Fulfillment notes", []]
] as const;

export type ProductCompatibility = {
  registerPath: string;
  detailPath: (id: string) => string;
  showCompatibilityNotice?: boolean;
};

export const canonicalProductPaths: ProductCompatibility = {
  registerPath: "/products",
  detailPath: (id) => `/products/${id}`
};
