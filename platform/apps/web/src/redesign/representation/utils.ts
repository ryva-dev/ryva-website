export type Row = Record<string, unknown> & { id: string; version?: number };

export function shown(value: unknown, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  return fallback;
}

export function date(value: unknown): string {
  return typeof value === "string" && value ? new Date(value).toLocaleDateString() : "Not set";
}

export function dateTime(value: unknown, fallback = "Time not recorded"): string {
  return typeof value === "string" && value ? new Date(value).toLocaleString() : fallback;
}

export function readable(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function field(record: Record<string, unknown>, camel: string, snake: string): unknown {
  return record[camel] ?? record[snake];
}

export const opportunityStages = [
  "contact_ready",
  "contacted",
  "conversation",
  "reviewing_terms",
  "agreement_draft",
  "paused",
  "rejected"
] as const;

export const agreementStatuses = [
  "draft",
  "reviewing",
  "pending_approval",
  "active",
  "suspended",
  "ended"
] as const;

export const materialFieldOptions = [
  "effectiveAt",
  "expiresAt",
  "channels",
  "territoryScope",
  "commissionBasis",
  "commissionTiming",
  "openingOrderRights",
  "reorderRights",
  "protectedAccountRules",
  "houseAccountRules",
  "terminationTerms",
  "postTerminationCommissionRights"
] as const;

export const materialTermFields = [
  ["effectiveAt", "Effective date/time", "datetime-local"],
  ["expiresAt", "Expiration date/time", "datetime-local"],
  ["channels", "Channels (comma separated)", "text"],
  ["territoryScope", "Territory scope", "text"],
  ["authoritySummary", "Authority summary", "text"],
  ["commissionBasis", "Commission basis", "text"],
  ["commissionRate", "Commission rate (%)", "number"],
  ["commissionCurrency", "Commission currency", "text"],
  ["commissionTiming", "Commission timing", "text"],
  ["openingOrderRights", "Opening-order rights", "text"],
  ["reorderRights", "Reorder rights", "text"],
  ["protectedAccountRules", "Protected-account rules", "text"],
  ["houseAccountRules", "House-account exclusions", "text"],
  ["terminationTerms", "Termination terms", "text"],
  ["postTerminationCommissionRights", "Post-termination commission rights", "text"],
  ["renewalReviewAt", "Renewal review date/time", "datetime-local"]
] as const;

export function opportunityStage(record: Record<string, unknown>): string {
  return shown(record.stage, "identified");
}

export function agreementStatus(record: Record<string, unknown>): string {
  return shown(record.status, "draft");
}

export function pendingApprovalStatus(status: string): boolean {
  return ["draft", "reviewing", "pending_approval"].includes(status);
}
