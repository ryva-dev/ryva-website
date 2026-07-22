export type Row = Record<string, unknown> & { id: string; version?: number };

export type OrderLine = {
  productId: string;
  description: string;
  quantity: string;
  unitWholesalePrice: string;
  grossAmount: string;
  discountAmount: string;
  returnAmount: string;
  cancellationAmount: string;
  commissionEligible: boolean;
};

export function shown(value: unknown, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  return fallback;
}

export function dateShown(value: unknown, fallback = "—"): string {
  if (!value) return fallback;
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? shown(value, fallback) : parsed.toLocaleDateString();
}

export function dateTime(value: unknown, fallback = "Time not recorded"): string {
  if (!value) return fallback;
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? shown(value, fallback) : parsed.toLocaleString();
}

export function readable(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function currency(value: unknown, code: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: shown(code, "USD")
    }).format(Number(value));
  } catch {
    return `${shown(value)} ${shown(code)}`;
  }
}

export function field(record: Record<string, unknown>, camel: string, snake: string): unknown {
  return record[camel] ?? record[snake];
}

export function splitIds(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function blankLine(): OrderLine {
  return {
    productId: "",
    description: "",
    quantity: "1",
    unitWholesalePrice: "0.00",
    grossAmount: "0.00",
    discountAmount: "0.00",
    returnAmount: "0.00",
    cancellationAmount: "0.00",
    commissionEligible: true
  };
}

export const accountStatuses = ["onboarding", "active", "at_risk", "paused", "ended"] as const;
export const accountHealthValues = ["unknown", "healthy", "watch", "at_risk", "inactive"] as const;
export const protectionStatuses = ["pending", "active", "expiring", "expired", "disputed", "released", "ended"] as const;
export const orderStatuses = ["draft", "submitted", "confirmed", "fulfilled", "partially_returned", "returned", "canceled"] as const;
export const reorderStatuses = ["projected", "due", "contacted", "ordered", "deferred", "not_expected", "closed"] as const;
export const orderPlacementStages = ["terms_order_discussion", "opening_order"] as const;
export const commissionStatuses = [
  "estimated",
  "pending_verification",
  "approved",
  "payable",
  "paid",
  "disputed",
  "canceled",
  "clawed_back"
] as const;
export const commissionTransitionStatuses = [
  "pending_verification",
  "approved",
  "payable",
  "paid",
  "canceled",
  "clawed_back"
] as const;
export const disputeStatuses = [
  "opened",
  "evidence_needed",
  "submitted",
  "under_review",
  "resolved",
  "rejected",
  "withdrawn"
] as const;
