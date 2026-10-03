import { platformCopy } from "../../design-system/shared";
import { displayBrandName, brandNameTitle } from "../brand/utils";

export { brandNameTitle, displayBrandName };

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
  if (typeof value === "string") return platformCopy(value, fallback) || fallback;
  if (typeof value === "number") return platformCopy(String(value), fallback) || fallback;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    const joined = value.map((item) => platformCopy(item)).filter(Boolean).join(", ");
    return joined || fallback;
  }
  return fallback;
}

/** Preserve machine-readable record values for comparisons; `shown` is presentation copy. */
export function recordCode(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number") return String(value).toLowerCase();
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
  return value
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Trailing seed/fixture slug such as "disp-chromium-desktop-1784734627049" or "res-1784734600931". */
const FIXTURE_SLUG = /(?:\s+|[-_])[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d{6,}\s*$/i;
/** Browser harness tails such as "chromium-mobile-1784734673869". */
const FIXTURE_BROWSER = /(?:\s+|[-_])chromium-(?:desktop|mobile)(?:-\d{6,})?\s*$/i;
/** Leading synthetic/fixture labels. */
const FIXTURE_PREFIX = /^(?:synthetic|fixture|seed|test)\s+/i;
/** Residual harness role tags after slug strip. */
const FIXTURE_ROLE = /\s+\b(?:brand|business)\b\s*$/i;

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

/** Brand title + optional business subline without repeating near-identical fixture labels. */
export function relationshipDisplay(account: Record<string, unknown>): { title: string; subtitle: string | null } {
  const titleRaw = displayBrandName(account.brandName ?? account.brand_name, "Brand");
  const businessRaw = displayName(account.businessName ?? account.business_name, "Business");
  const normalize = (value: string) => value
    .replace(/\b(?:brand|business)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const coreTitle = titleRaw.replace(FIXTURE_ROLE, "").trim() || titleRaw;
  if (!businessRaw || businessRaw === "—" || businessRaw === "Business") {
    return { title: coreTitle, subtitle: null };
  }
  if (normalize(titleRaw) && normalize(titleRaw) === normalize(businessRaw)) {
    return { title: coreTitle, subtitle: null };
  }
  const coreBusiness = businessRaw.replace(FIXTURE_ROLE, "").trim() || businessRaw;
  if (normalize(coreTitle) && normalize(coreTitle) === normalize(coreBusiness)) {
    return { title: coreTitle, subtitle: null };
  }
  return { title: coreTitle, subtitle: coreBusiness };
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

/** Rep-facing protection status — avoid ALL-CAPS “Unverified” chips. */
export function accountProtectionLabel(value: unknown): string {
  const status = shown(value, "unverified").toLowerCase();
  switch (status) {
    case "unverified":
    case "not_asserted":
    case "—":
    case "":
      return "Not confirmed";
    case "pending":
      return "Needs review";
    case "active":
      return "Active";
    case "expiring":
      return "Expiring";
    case "expired":
      return "Expired";
    case "disputed":
      return "Disputed";
    case "released":
      return "Released";
    case "ended":
      return "Ended";
    default:
      return readable(status);
  }
}
export function commissionRatePercent(value: unknown): string {
  const raw = shown(value, "").replace(/%/g, "").trim();
  if (!raw || raw === "—") return "—";
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return readable(raw);
  const percent = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  const rounded = Math.round(percent * 100) / 100;
  return `${Number.isInteger(rounded) ? String(rounded) : String(rounded)}%`;
}

export function commissionBasisLabel(value: unknown): string {
  const basis = shown(value, "").toLowerCase();
  switch (basis) {
    case "net":
    case "eligible_net":
    case "eligible":
      return "Net order value";
    case "gross":
    case "wholesale_gross":
      return "Gross order value";
    case "":
    case "—":
      return "Not recorded";
    default:
      return readable(shown(value));
  }
}

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
