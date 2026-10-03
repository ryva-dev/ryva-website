export type Row = Record<string, unknown> & { id: string; version?: number };

export function shown(value: unknown, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  return fallback;
}

export function date(value: unknown): string {
  if (typeof value !== "string" || !value) return "Not set";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function dateTime(value: unknown, fallback = "Time not recorded"): string {
  return typeof value === "string" && value ? new Date(value).toLocaleString() : fallback;
}

export function readable(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const FIXTURE_TAIL = /(?:\s+|[-_])(?:[a-z]{2,}(?:-[a-z0-9]+)+-\d{8,})\s*$/i;

export { brandNameTitle, displayBrandName } from "../brand/utils";

export function displayProductName(value: unknown, fallback = "—"): string {
  const text = shown(value, "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  const cleaned = text.replace(FIXTURE_TAIL, "").trim();
  return cleaned || text;
}

export function productNameTitle(value: unknown): string | undefined {
  const raw = shown(value, "").replace(/\s+/g, " ").trim();
  if (!raw) return undefined;
  const clean = displayProductName(raw, "");
  return clean && clean !== raw ? raw : undefined;
}

export function territoryLabel(value: unknown, fallback = "Not set"): string {
  if (value == null) return fallback;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return fallback;
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        return territoryLabel(JSON.parse(text) as unknown, fallback);
      } catch {
        return text;
      }
    }
    return text;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return shown(record.description ?? record.name ?? record.label, fallback);
  }
  return fallback;
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

export const materialFieldLabels: Record<string, string> = {
  effectiveAt: "Effective date",
  expiresAt: "Expiration date",
  channels: "Sales channels",
  territoryScope: "Territory",
  commissionBasis: "Commission basis",
  commissionTiming: "Commission timing",
  openingOrderRights: "Opening-order rights",
  reorderRights: "Reorder rights",
  protectedAccountRules: "Protected-account rules",
  houseAccountRules: "House-account exclusions",
  terminationTerms: "Termination terms",
  postTerminationCommissionRights: "Post-termination commission"
};

export const agreementChannelOptions = [
  { value: "independent_retail", label: "Independent retail" },
  { value: "specialty_retail", label: "Specialty retail" },
  { value: "regional_chains", label: "Regional chains" },
  { value: "national_retail", label: "National retail" },
  { value: "hospitality", label: "Hospitality" },
  { value: "ecommerce", label: "Ecommerce" }
] as const;

export const agreementTerritoryOptions = [
  "United States",
  "Canada",
  "United Kingdom",
  "European Union",
  "Mexico",
  "Australia"
] as const;

export const agreementCurrencyOptions = ["USD", "CAD", "GBP", "EUR", "AUD", "MXN"] as const;

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

export function stageDisplayLabel(stage: string): string {
  const text = stage.replaceAll("_", " ").trim();
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function materialFieldLabel(fieldName: unknown): string {
  const key = typeof fieldName === "string" || typeof fieldName === "number" ? String(fieldName) : "";
  return materialFieldLabels[key] ?? stageDisplayLabel(key);
}

export function toDateInputValue(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const stamp = new Date(value);
  if (!Number.isFinite(stamp.getTime())) return "";
  return stamp.toISOString().slice(0, 10);
}

export function fromDateInputValue(value: string): string {
  if (!value) return "";
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function channelsLabel(value: unknown, fallback = "—"): string {
  const parts = Array.isArray(value)
    ? value.map((item) => String(item))
    : typeof value === "string"
      ? value.split(",")
      : [];
  const labels = parts
    .map((part) => stageDisplayLabel(part.trim()))
    .filter(Boolean);
  return labels.length ? labels.join(", ") : fallback;
}

/** Trailing seed/fixture slug such as "acct-chromium-desktop-1784734596469". */
const FIXTURE_SUFFIX = /\s+(?:[a-z]{2,}(?:-[a-z0-9]+)+-\d{8,})\s*$/i;

export function displayDocumentName(value: unknown, fallback = "Agreement draft"): string {
  const text = shown(value, "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  const cleaned = text
    .replace(/[-_]chromium(?:-[a-z0-9]+)*-\d{8,}(?=\.[^.]+$)/i, "")
    .replace(FIXTURE_SUFFIX, "")
    .replace(/[-_]{2,}/g, "-")
    .trim();
  return cleaned || text || fallback;
}

/** Always prefer a human label in lists; keep the raw filename for tooltips only. */
export function agreementDocumentTitle(): string {
  return "Representation agreement";
}

export function agreementDocumentMeta(updatedAt: unknown): string {
  if (typeof updatedAt === "string" && updatedAt) {
    const stamp = new Date(updatedAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
    return `PDF · Updated ${stamp}`;
  }
  return "PDF";
}

export function documentNameTitle(value: unknown): string | undefined {
  const raw = shown(value, "").replace(/\s+/g, " ").trim();
  return raw || undefined;
}

export function opportunityStage(record: Record<string, unknown>): string {
  return shown(record.stage, "identified");
}

export function agreementStatus(record: Record<string, unknown>): string {
  return shown(record.status, "draft");
}

export type AgreementStatusTone = "draft" | "active" | "expiring" | "ended" | "needs_review";

const EXPIRING_SOON_MS = 60 * 24 * 60 * 60 * 1000;

export function agreementStatusDisplay(item: Record<string, unknown>): { tone: AgreementStatusTone; label: string } {
  const status = shown(item.status, "draft");
  if (status === "ended") return { tone: "ended", label: "Ended" };
  if (status === "draft") return { tone: "draft", label: "Draft" };
  if (status === "reviewing" || status === "pending_approval" || status === "suspended") {
    return { tone: "needs_review", label: "Needs review" };
  }
  if (status === "active") {
    if (typeof item.expiresAt === "string" && item.expiresAt) {
      const expires = new Date(item.expiresAt).getTime();
      if (Number.isFinite(expires) && expires <= Date.now() + EXPIRING_SOON_MS) {
        return { tone: "expiring", label: "Expiring soon" };
      }
    }
    return { tone: "active", label: "Active" };
  }
  return { tone: "draft", label: stageDisplayLabel(status) };
}

export function pendingApprovalStatus(status: string): boolean {
  return ["draft", "reviewing", "pending_approval"].includes(status);
}

export type AuthorityReasonMessage = {
  code: string;
  summary: string;
  guidance: string;
  showAgreementLink?: boolean;
};

const AUTHORITY_REASON_MESSAGES: Record<string, Omit<AuthorityReasonMessage, "code">> = {
  no_current_active_agreement: {
    summary: "There is no active representation agreement for this brand.",
    guidance: "Activate or link an agreement before advancing this placement."
  },
  agreement_original_not_clean: {
    summary: "The signed agreement document has not passed document review.",
    guidance: "Resolve document review before continuing."
  },
  human_authority_approval_missing: {
    summary: "This agreement has not received the required human authority approval.",
    guidance: "Complete agreement approval before continuing."
  },
  legal_ambiguity_unresolved: {
    summary: "Legal ambiguity on this agreement still needs specialist review.",
    guidance: "Resolve legal review before continuing."
  },
  product_out_of_scope: {
    summary: "This product isn't covered by the current representation agreement.",
    guidance: "Review the agreement or select an eligible product before continuing."
  },
  channel_out_of_scope: {
    summary: "This channel is not authorized under the current representation agreement.",
    guidance: "Review agreement channel scope or adjust the placement channel before continuing."
  },
  business_not_found: {
    summary: "The buyer linked to this placement could not be found.",
    guidance: "Confirm the buyer record before continuing."
  },
  territory_scope_unverifiable: {
    summary: "Buyer territory could not be verified against the agreement.",
    guidance: "Confirm buyer geography or update agreement territory scope before continuing."
  },
  territory_out_of_scope: {
    summary: "This buyer is outside the agreement's authorized territory.",
    guidance: "Review territory scope on the agreement before continuing."
  },
  written_account_exclusion: {
    summary: "This buyer is explicitly excluded in the representation agreement.",
    guidance: "Review account restrictions on the agreement before continuing."
  },
  possible_account_name_conflict: {
    summary: "A possible account-name conflict was found on the agreement.",
    guidance: "Review account restrictions before continuing."
  },
  possible_protected_account_conflict: {
    summary: "This buyer may conflict with a protected account.",
    guidance: "Review protected accounts before continuing."
  },
  protected_account_conflict: {
    summary: "This buyer conflicts with an active protected account.",
    guidance: "Resolve the protected account conflict before continuing."
  }
};

export function authorityReasonMessages(reasonCodes: string[]): AuthorityReasonMessage[] {
  const seen = new Set<string>();
  const messages: AuthorityReasonMessage[] = [];
  for (const code of reasonCodes) {
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const mapped = AUTHORITY_REASON_MESSAGES[code];
    messages.push(mapped ? { code, ...mapped } : {
      code,
      summary: `${readable(code)}.`,
      guidance: "Resolve the authority issue before continuing."
    });
  }
  return messages;
}

export function authorityBlockedAlertContent(reasonCodes: string[]): {
  messages: AuthorityReasonMessage[];
  showAgreementLink: boolean;
} {
  const messages = authorityReasonMessages(reasonCodes);
  return {
    messages,
    showAgreementLink: messages.some((item) => item.showAgreementLink !== false)
  };
}

export function authorityBlockedActionReason(reasonCodes: string[]): string {
  const messages = authorityReasonMessages(reasonCodes);
  if (!messages.length) return "Representation authority is not confirmed for this placement.";
  const first = messages[0]!;
  return `${first.summary} ${first.guidance}`;
}

export function authorityRecoveryLabel(reasonCodes: string[]): string {
  const code = reasonCodes[0];
  switch (code) {
    case "no_current_active_agreement":
      return "Activate agreement";
    case "written_account_exclusion":
    case "possible_account_name_conflict":
      return "Review account restrictions";
    case "protected_account_conflict":
    case "possible_protected_account_conflict":
      return "Review protected accounts";
    default:
      return "Resolve agreement coverage";
  }
}
