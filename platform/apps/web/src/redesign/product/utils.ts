import { displayBrandName } from "../brand/utils";

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

/** Trailing seed/fixture slug such as "detail-chromium-desktop-1784734627049". */
const FIXTURE_SLUG = /(?:\s+|[-_])(?:[a-z]{2,}(?:-[a-z0-9]+){2,}-\d{6,})\s*$/i;
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

function moneyAmount(value: unknown): number | null {
  const raw = shown(value, "").trim();
  if (!raw || raw === "—") return null;
  const numeric = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

export function formatMoney(value: unknown, currency = "USD"): string {
  const amount = moneyAmount(value);
  if (amount === null) return "";
  const code = currency.length === 3 ? currency : "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(amount);
  } catch {
    return `${code} ${amount}`;
  }
}

/** Brand · category line for catalog cards. */
export function catalogMeta(row: ProductRow): string {
  return [displayBrandName(row.brandName, ""), shown(row.category, "")].filter(Boolean).join(" · ");
}

/** "$18 wholesale · MOQ 12" when wholesale and/or MOQ are known. */
export function catalogMoq(row: ProductRow): string {
  const raw = shown(row.moq, "").trim();
  if (!raw) return "";
  if (/^moq\b/i.test(raw)) return raw;
  const amount = moneyAmount(raw);
  if (amount !== null) return `MOQ ${amount}`;
  return /^moq/i.test(raw) ? raw : `MOQ ${raw}`;
}

export function catalogWholesaleSignals(row: ProductRow): string {
  const currency = shown(row.currency, "USD");
  const wholesale = formatMoney(row.wholesalePrice, currency);
  const moq = catalogMoq(row);
  const parts: string[] = [];
  if (wholesale) parts.push(`${wholesale} wholesale`);
  else parts.push("Pricing not recorded");
  if (moq) parts.push(moq);
  return parts.join(" · ");
}

/** "$18 wholesale · $42 retail" when either price is known. */
export function catalogPricing(row: ProductRow): string {
  const currency = shown(row.currency, "USD");
  const wholesale = formatMoney(row.wholesalePrice, currency);
  const retail = formatMoney(row.consumerPrice, currency);
  const parts: string[] = [];
  if (wholesale) parts.push(`${wholesale} wholesale`);
  if (retail) parts.push(`${retail} retail`);
  return parts.join(" · ");
}

/** "57% margin" when both wholesale and retail are known. */
export function catalogMargin(row: ProductRow): string {
  const wholesale = moneyAmount(row.wholesalePrice);
  const retail = moneyAmount(row.consumerPrice);
  if (wholesale === null || retail === null || retail <= 0 || wholesale < 0) return "";
  const margin = ((retail - wholesale) / retail) * 100;
  if (!Number.isFinite(margin)) return "";
  return `${Math.round(margin)}% margin`;
}

/** Soft readiness / review cue for catalog cards. */
export function catalogReadiness(row: ProductRow): string {
  const readiness = shown(row.wholesaleReadiness, "not_reviewed");
  if (readiness === "ready") return "Wholesale ready";
  if (readiness === "conditional") return "Conditional readiness";
  if (readiness === "not_ready") return "Not wholesale ready";
  if (readiness === "not_reviewed" || readiness === "unknown") return "Needs review";
  const status = shown(row.status, "discovered");
  if (status === "under_review") return "Ready for review";
  if (status === "watchlist") return "On watchlist";
  if (status === "qualified") return "Qualified";
  if (status === "represented") return "Represented";
  if (status === "rejected") return "Rejected";
  return "Needs review";
}

/** Readiness for the quick-view modal — always decision-oriented. */
export function previewReadiness(row: ProductRow): string {
  return catalogReadiness(row) || "Needs review";
}

/** Risk cue — only when something needs attention. */
export function catalogRisk(row: ProductRow): string {
  const critical = Number(row.criticalRiskCount ?? 0);
  if (Number.isFinite(critical) && critical > 0) {
    return critical === 1 ? "1 critical risk" : `${critical} critical risks`;
  }
  return "";
}

/** Decision-oriented primary risk for the quick-view modal. */
export function previewPrimaryRisk(row: ProductRow): string {
  const critical = Number(row.criticalRiskCount ?? 0);
  if (Number.isFinite(critical) && critical > 0) {
    return critical === 1 ? "Critical risk flagged" : `${critical} critical risks flagged`;
  }
  const unknowns = Number(row.unknownCount ?? 0);
  if (Number.isFinite(unknowns) && unknowns > 0) {
    return unknowns === 1 ? "1 explicit unknown remains" : `${unknowns} explicit unknowns remain`;
  }
  if (!moneyAmount(row.consumerPrice) && !moneyAmount(row.wholesalePrice)) {
    return "Pricing not verified";
  }
  if (!moneyAmount(row.wholesalePrice)) {
    return "Wholesale price not verified";
  }
  if (!moneyAmount(row.consumerPrice)) {
    return "Retail price not verified";
  }
  return "";
}

export function previewMoq(row: ProductRow): string {
  const raw = shown(row.moq, "").trim();
  if (!raw) return "";
  if (/unit/i.test(raw)) return raw;
  const amount = moneyAmount(raw);
  if (amount !== null) return `${amount} units`;
  return raw;
}

export function previewLeadTime(row: ProductRow): string {
  const raw = shown(row.leadTime, "").trim();
  return raw;
}

export function previewWholesale(row: ProductRow): string {
  return formatMoney(row.wholesalePrice, shown(row.currency, "USD"));
}

export function previewRetail(row: ProductRow): string {
  return formatMoney(row.consumerPrice, shown(row.currency, "USD"));
}

export function previewMarginValue(row: ProductRow): string {
  const wholesale = moneyAmount(row.wholesalePrice);
  const retail = moneyAmount(row.consumerPrice);
  if (wholesale === null || retail === null || retail <= 0 || wholesale < 0) return "";
  const margin = ((retail - wholesale) / retail) * 100;
  if (!Number.isFinite(margin)) return "";
  return `${Math.round(margin)}%`;
}

export function marginPercent(row: ProductRow): number | null {
  const wholesale = moneyAmount(row.wholesalePrice);
  const retail = moneyAmount(row.consumerPrice);
  if (wholesale === null || retail === null || retail <= 0 || wholesale < 0) return null;
  const margin = ((retail - wholesale) / retail) * 100;
  return Number.isFinite(margin) ? margin : null;
}

const catalogTones = ["ink", "oxblood", "olive", "powder", "sand"] as const;

export type CatalogTone = (typeof catalogTones)[number];

export function productInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function catalogTone(row: ProductRow): CatalogTone {
  const seed = `${row.id}:${shown(row.category)}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash + seed.charCodeAt(index) * (index + 1)) % 997;
  return catalogTones[hash % catalogTones.length] ?? "ink";
}

function customField(fields: Record<string, unknown> | undefined, ...keys: string[]): unknown {
  if (!fields) return undefined;
  for (const key of keys) {
    const value = fields[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

function pickString(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

/** Normalize detail API snake_case product + evidence/risks into comparison ProductRow. */
export function normalizeComparisonProduct(payload: {
  product?: Record<string, unknown>;
  unknowns?: unknown[];
  evidence?: Array<Record<string, unknown>>;
  risks?: Array<Record<string, unknown>>;
}): ProductRow {
  const raw = payload.product ?? {};
  const fields = (raw.custom_fields ?? raw.customFields) as Record<string, unknown> | undefined;
  const evidenceUnknowns = (payload.evidence ?? []).filter((item) => {
    const klass = shown(item.evidenceClass ?? item.evidence_class, "");
    return klass === "unknown";
  });
  const unknownCount = Array.isArray(payload.unknowns)
    ? payload.unknowns.length
    : evidenceUnknowns.length;
  const criticalRiskCount = (payload.risks ?? []).filter((risk) => {
    const severity = shown(risk.severity, "").toLowerCase();
    return severity === "high" || severity === "critical";
  }).length;

  return {
    id: shown(raw.id, ""),
    name: shown(raw.name, "Untitled product"),
    version: Number(raw.version ?? 1) || 1,
    category: pickString(raw, "category"),
    status: pickString(raw, "status", "discovered"),
    brandName: shown(pickString(raw, "brandName", "brand_name"), ""),
    brandId: shown(pickString(raw, "brandId", "brand_id"), ""),
    consumerPrice: pickString(raw, "consumerPrice", "consumer_price"),
    currency: pickString(raw, "currency") ?? "USD",
    wholesaleReadiness: pickString(raw, "wholesaleReadiness", "wholesale_readiness") ?? "not_reviewed",
    packagingReadiness: pickString(raw, "packagingReadiness", "packaging_readiness") ?? "not_reviewed",
    wholesalePrice: customField(fields, "wholesalePrice", "wholesale_price") ?? pickString(raw, "wholesalePrice"),
    moq: customField(fields, "moq", "minimumOrderQuantity", "minimum_order_quantity") ?? pickString(raw, "moq"),
    leadTime: customField(fields, "leadTime", "lead_time") ?? pickString(raw, "leadTime"),
    casePack: customField(fields, "casePack", "case_pack") ?? pickString(raw, "casePack"),
    paymentTerms: customField(fields, "paymentTerms", "payment_terms") ?? pickString(raw, "paymentTerms"),
    summary: pickString(raw, "summary"),
    inventoryNotes: pickString(raw, "inventoryNotes", "inventory_notes"),
    fulfillmentNotes: pickString(raw, "fulfillmentNotes", "fulfillment_notes"),
    seasonality: customField(fields, "seasonality"),
    idealRetailerType: customField(fields, "idealRetailerType", "ideal_retailer_type"),
    placementRestrictions: customField(fields, "placementRestrictions", "placement_restrictions"),
    existingConflicts: customField(fields, "existingConflicts", "existing_conflicts", "territoryConflict", "territory_conflict"),
    imageUrl: pickString(raw, "imageUrl", "image_url") ?? customField(fields, "imageUrl", "image_url", "image"),
    unknownCount,
    criticalRiskCount,
    customFields: fields
  };
}

function readinessRank(value: unknown): number {
  const readiness = shown(value, "not_reviewed");
  if (readiness === "ready") return 3;
  if (readiness === "conditional") return 2;
  if (readiness === "not_ready") return 1;
  return 0;
}

function hasPricingGaps(row: ProductRow): boolean {
  return !moneyAmount(row.wholesalePrice) || !moneyAmount(row.consumerPrice) || !shown(row.moq, "").trim() || !shown(row.leadTime, "").trim();
}

export type CoreComparisonGap = "Wholesale price" | "Suggested retail" | "MOQ" | "Lead time";

/** Core commercial fields still missing on any product in the comparison set. */
export function coreComparisonGaps(products: ProductRow[]): CoreComparisonGap[] {
  const gaps: CoreComparisonGap[] = [];
  if (products.some((product) => moneyAmount(product.wholesalePrice) === null)) gaps.push("Wholesale price");
  if (products.some((product) => moneyAmount(product.consumerPrice) === null)) gaps.push("Suggested retail");
  if (products.some((product) => !shown(product.moq, "").trim())) gaps.push("MOQ");
  if (products.some((product) => !shown(product.leadTime, "").trim())) gaps.push("Lead time");
  return gaps;
}

/** Short recommendation copy from real readiness, margin, gaps, and risks — never invents scores. */
export function comparisonRecommendation(products: ProductRow[]): string {
  if (products.length < 2) return "";

  const labels = products.map((product) => displayName(product.name, "Product"));
  const sentences: string[] = [];

  const readinessScores = products.map((product) => readinessRank(product.wholesaleReadiness));
  const maxReady = Math.max(...readinessScores);
  const minReady = Math.min(...readinessScores);
  if (maxReady > minReady && maxReady >= 2) {
    const readyNames = products
      .filter((_, index) => readinessScores[index] === maxReady)
      .map((product) => displayName(product.name));
    if (readyNames.length === 1) {
      sentences.push(`${readyNames[0]} is more placement-ready.`);
    } else {
      sentences.push(`${readyNames.join(" and ")} look more placement-ready than the others.`);
    }
  }

  const margins = products.map((product) => marginPercent(product));
  const knownMargins = margins
    .map((value, index) => (value === null ? null : { value, label: labels[index]!, product: products[index]! }))
    .filter((item): item is { value: number; label: string; product: ProductRow } => item !== null);
  if (knownMargins.length >= 2) {
    const sorted = [...knownMargins].sort((a, b) => b.value - a.value);
    const best = sorted[0]!;
    const runner = sorted[1]!;
    if (best.value > runner.value) {
      const incomplete = hasPricingGaps(best.product);
      sentences.push(
        incomplete
          ? `${best.label} has stronger margin potential, but pricing and lead-time information are incomplete.`
          : `${best.label} has stronger margin potential based on recorded wholesale and retail prices.`
      );
    }
  } else if (knownMargins.length === 1) {
    const only = knownMargins[0]!;
    sentences.push(`${only.label} has recorded margin (${Math.round(only.value)}%); other products are missing pricing needed for comparison.`);
  }

  const riskHeavy = products.filter((product) => Number(product.criticalRiskCount ?? 0) > 0);
  if (riskHeavy.length === 1) {
    sentences.push(`${displayName(riskHeavy[0]!.name)} carries critical risk flags that need review.`);
  } else if (riskHeavy.length > 1 && riskHeavy.length < products.length) {
    sentences.push(`${riskHeavy.map((product) => displayName(product.name)).join(" and ")} carry critical risk flags.`);
  }

  const incomplete = products.filter(hasPricingGaps);
  if (!sentences.length && incomplete.length === products.length) {
    return "Not enough commercial data yet to recommend a clearer placement candidate.";
  }
  if (!sentences.length) {
    return "Not enough commercial data yet to recommend a clearer placement candidate.";
  }

  return sentences.slice(0, 2).join(" ");
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

/** Product lifecycle stage — one canonical meaning across detail, register, and review. */
export function productStageLabel(status: string): string {
  switch (status) {
    case "discovered":
      return "Discovered";
    case "under_review":
      return "Researching";
    case "watchlist":
      return "On hold";
    case "qualified":
      return "Ready for wholesale";
    case "represented":
      return "Active";
    case "rejected":
      return "Not a fit";
    case "archived":
      return "Archived";
    default:
      return readable(status);
  }
}

/** Latest human review outcome — separate from lifecycle stage. */
export function productReviewOutcomeLabel(
  decisions: Array<Record<string, unknown>>,
  fallback = "Not reviewed yet"
): string {
  const latest = decisions[0];
  if (!latest) return fallback;
  const outcome = shown(latest.outcome, "").trim();
  return outcome || fallback;
}

/** How complete the wholesale data is — separate from lifecycle stage and review outcome. */
export function productDataCompleteness(
  record: Record<string, unknown>,
  pricingComplete: boolean,
  wholesaleDisplay: string,
  retailDisplay: string,
  moqDisplay: string,
  leadTimeDisplay: string
): string {
  const wholesaleReadiness = shown(record.wholesaleReadiness ?? record.wholesale_readiness, "not_reviewed").toLowerCase();
  const packagingReadiness = shown(record.packagingReadiness ?? record.packaging_readiness, "not_reviewed").toLowerCase();

  if (wholesaleReadiness === "ready" && packagingReadiness === "ready") return "Complete";
  if (wholesaleReadiness === "not_ready") return "Gaps flagged";
  if (wholesaleReadiness === "conditional" || packagingReadiness === "conditional") return "Conditional";
  if (wholesaleReadiness === "ready" || packagingReadiness === "ready") return "Partial";

  const hasCommercialDetail = Boolean(wholesaleDisplay || retailDisplay || moqDisplay || leadTimeDisplay);
  if (hasCommercialDetail || pricingComplete) return "Partial";
  return "Needs information";
}

export function productViewLabel(view: string): string {
  switch (view) {
    case "discover":
      return "Discovered";
    case "watchlist":
      return "On hold";
    case "under_review":
      return "Researching";
    case "qualified":
      return "Ready for wholesale";
    case "rejected":
      return "Not a fit";
    case "represented":
      return "Active";
    case "recently_updated":
      return "Recently updated";
    default:
      return readable(view);
  }
}

export const productFields = [
  ["wholesaleReadiness", "Wholesale readiness", ["not_reviewed", "not_ready", "conditional", "ready", "unknown"]],
  ["packagingReadiness", "Packaging readiness", ["not_reviewed", "not_ready", "conditional", "ready", "unknown"]],
  ["trendDirection", "Trend direction", ["rising", "stable", "declining", "volatile", "unknown"]],
  ["differentiation", "Differentiation", []],
  ["fulfillmentNotes", "Fulfillment notes", []]
] as const;

export type ProductEvidenceDisplay = {
  headline: string;
  meta: string;
  detail: string;
};

function periodFromIsoRange(startIso: string, endIso: string): string {
  const start = new Date(`${startIso}T12:00:00`);
  const end = new Date(`${endIso}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameYear) {
    const startMonth = start.toLocaleDateString(undefined, { month: "long" });
    const endMonth = end.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    return `${startMonth}–${endMonth}`;
  }
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel}–${endLabel}`;
}

function formatCommercialDetailPart(part: string): string {
  const trimmed = part.trim();
  const wholesale = trimmed.match(/^Wholesale\s+\$?([\d,.]+)$/i);
  if (wholesale) return `$${wholesale[1]} wholesale`;
  const retail = trimmed.match(/^Retail\s+\$?([\d,.]+)$/i);
  if (retail) return `$${retail[1]} retail`;
  const moq = trimmed.match(/^MOQ\s+(.+)$/i);
  if (moq) return `MOQ ${moq[1]}`;
  const leadTime = trimmed.match(/^Lead time\s+(.+)$/i);
  if (leadTime) return `${leadTime[1]} lead time`;
  const inventory = trimmed.match(/^Inventory\s+(.+)$/i);
  if (inventory) return inventory[1]!;
  const casePack = trimmed.match(/^Case pack\s+(.+)$/i);
  if (casePack) return `Case pack ${casePack[1]}`;
  const currency = trimmed.match(/^Currency\s+([A-Z]{3})$/i);
  if (currency) return currency[1]!;
  const packaging = trimmed.match(/^Packaging\s+(.+)$/i);
  if (packaging) return `Packaging ${readable(packaging[1]!)}`;
  const description = trimmed.match(/^Description\s+(.+)$/i);
  if (description) return description[1]!;
  if (/^Product image\s+/i.test(trimmed)) return "Product image on file";
  const shipping = trimmed.match(/^Shipping\s+(.+)$/i);
  if (shipping) return shipping[1]!;
  return trimmed;
}

function formatCommercialClaim(claim: string): string | null {
  if (!claim.includes(";")) return null;
  const parts = claim.split(";").map(formatCommercialDetailPart).filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function evidenceDataCategory(claim: string, evidenceClass: string): string {
  if (/units?\s+sold/i.test(claim)) return "Verified sales data";
  if (evidenceClass === "unknown") return "Unverified detail";
  if (/wholesale|retail|moq|lead time|inventory|case pack|shipping|currency|packaging|description|product image|sales|trend|differentiation|monitoring/i.test(claim)) {
    return "Verified product data";
  }
  switch (evidenceClass) {
    case "verified_fact":
      return "Verified detail";
    case "direct_evidence":
      return "Confirmed detail";
    case "estimate":
      return "Estimated detail";
    case "assumption":
      return "Assumed detail";
    default:
      return "Product detail";
  }
}

function sourceDisplayLabel(sourceReference: string, supports: string, unknownReason: string): string {
  const combined = `${sourceReference} ${supports}`.toLowerCase();
  if (/first[-\s]?party/.test(combined)) return "First-party source";
  if (/third[-\s]?party/.test(combined)) return "Third-party source";
  if (unknownReason && unknownReason !== "No source linked") return "Source pending";

  const cleaned = displayName(sourceReference, "");
  if (!cleaned) return sourceReference ? "Source on file" : "Source not linked";
  if (cleaned.length > 48) return "Source on file";
  return readable(cleaned);
}

function displayEvidenceDetail(value: string): string {
  return displayName(value, "").trim();
}

/** Rep-friendly headline and meta for product detail evidence rows. */
export function formatProductEvidenceDisplay(item: Record<string, unknown>): ProductEvidenceDisplay {
  const claim = shown(item.exactClaim ?? item.exact_claim, "").trim();
  const evidenceClass = shown(item.evidenceClass ?? item.evidence_class, "unknown").toLowerCase();
  const sourceReference = shown(item.sourceReference ?? item.source_reference, "");
  const supports = shown(item.supports, "");
  const unknownReason = shown(item.unknownReason ?? item.unknown_reason, "");
  const limitations = displayEvidenceDetail(shown(item.limitations, ""));

  const unitsSold = claim.match(
    /^(?:Verified\s+)?([\d,]+)\s+units?\s+sold(?:\s+during\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2}))?\.?$/i
  );
  if (unitsSold) {
    const [, count, start, end] = unitsSold;
    const period = start && end ? periodFromIsoRange(start, end) : "";
    const headline = `${count!.replaceAll(",", "")} units sold${period ? ` in ${period}` : ""}`;
    const source = sourceDisplayLabel(sourceReference, supports, unknownReason);
    return {
      headline,
      meta: `Verified sales data · ${source}`,
      detail: limitations
    };
  }

  const commercial = formatCommercialClaim(claim);
  if (commercial) {
    const category = evidenceDataCategory(claim, evidenceClass);
    const source = sourceDisplayLabel(sourceReference, supports, unknownReason);
    return {
      headline: commercial,
      meta: `${category} · ${source}`,
      detail: limitations
    };
  }

  let headline = claim
    .replace(/^Verified\s+/i, "")
    .replace(/\s+during\s+\d{4}-\d{2}-\d{2}\s+to\s+\d{4}-\d{2}-\d{2}\.?$/i, "")
    .trim();
  if (!headline) headline = claim || "Product detail recorded";

  const category = evidenceDataCategory(claim, evidenceClass);
  const source = sourceDisplayLabel(sourceReference, supports, unknownReason);

  return {
    headline,
    meta: `${category} · ${source}`,
    detail: limitations
  };
}

export type ProductCompatibility = {
  registerPath: string;
  detailPath: (id: string) => string;
  showCompatibilityNotice?: boolean;
};

export const canonicalProductPaths: ProductCompatibility = {
  registerPath: "/products",
  detailPath: (id) => `/products/${id}`
};
