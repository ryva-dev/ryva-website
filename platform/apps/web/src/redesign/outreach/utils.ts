export type Row = Record<string, unknown> & { id: string; version?: number };

export function shown(value: unknown, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  return fallback;
}

export function dateTime(value: unknown, fallback = "Time not recorded"): string {
  if (typeof value !== "string" || !value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

export function readable(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Trailing seed/fixture slug such as "approve-chromium-desktop-1784734630224". */
const FIXTURE_SLUG = /(?:\s+|[-_])(?:[a-z]{2,}(?:-[a-z0-9]+){2,}-\d{6,})\s*$/i;
/** Browser harness tails such as "chromium-desktop" or "chromium-mobile". */
const FIXTURE_BROWSER = /(?:\s+|[-_])chromium-(?:desktop|mobile)\s*$/i;
/** Leading synthetic/fixture labels such as "Synthetic Buyer Intro". */
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

export function displayNameTitle(value: unknown): string | undefined {
  const raw = shown(value, "").replace(/\s+/g, " ").trim();
  if (!raw) return undefined;
  const clean = displayName(raw, "");
  return clean && clean !== raw ? raw : undefined;
}

/** Soften fixture emails such as buyer-approve-chromium-desktop-…@synthetic.ryva.test. */
export function displayAddress(value: unknown, fallback = "—"): string {
  const raw = shown(value, "").trim();
  if (!raw) return fallback;
  const at = raw.lastIndexOf("@");
  if (at <= 0) return displayName(raw, fallback);
  const local = displayName(raw.slice(0, at), "");
  const domain = raw.slice(at + 1).trim();
  if (!local) return shown(value, fallback);
  if (!domain || /synthetic|fixture|seed\.|\.test$/i.test(domain)) return local;
  return `${local}@${domain}`;
}

export function displayAddressTitle(value: unknown): string | undefined {
  const raw = shown(value, "").trim();
  if (!raw) return undefined;
  const clean = displayAddress(raw, "");
  return clean && clean !== raw ? raw : undefined;
}

const INTERNAL_PARTY_LABELS: Record<string, string> = {
  buyer: "Buyer contact",
  rep: "Representative",
  representative: "Representative"
};

export function isInternalPartyAddress(value: unknown): boolean {
  const raw = shown(value, "").trim().toLowerCase();
  if (raw in INTERNAL_PARTY_LABELS) return true;
  return Boolean(raw && !raw.includes("@") && raw.length <= 16 && /^[a-z_]+$/.test(raw));
}

export function displayOutreachRecipient(
  address: unknown,
  contact: Record<string, unknown> | null,
  businessName: string,
  fallback = "Not recorded"
): { label: string; title?: string } {
  const raw = shown(address, "").trim();
  const name = displayName(contact?.name, "");
  const business = displayName(businessName, "");
  const email = displayAddress(contact?.email, "");

  if (raw && raw.includes("@") && !isInternalPartyAddress(raw)) {
    const title = displayAddressTitle(raw);
    return { label: displayAddress(raw, fallback), ...(title ? { title } : {}) };
  }
  if (name && business && business !== "Business" && business !== "—") {
    const title = raw || email;
    return { label: `${name} · ${business}`, ...(title ? { title } : {}) };
  }
  if (name) return { label: name, ...(raw ? { title: raw } : {}) };
  if (email) {
    const title = displayAddressTitle(contact?.email);
    return { label: email, ...(title ? { title } : {}) };
  }
  if (raw && INTERNAL_PARTY_LABELS[raw.toLowerCase()]) {
    return { label: INTERNAL_PARTY_LABELS[raw.toLowerCase()]!, title: raw };
  }
  const title = displayAddressTitle(raw);
  return { label: displayAddress(raw, fallback), ...(title ? { title } : {}) };
}

export function displayOutreachSender(address: unknown, fallback = "Not recorded"): string {
  const raw = shown(address, "").trim().toLowerCase();
  if (raw in INTERNAL_PARTY_LABELS) return INTERNAL_PARTY_LABELS[raw]!;
  return displayAddress(address, fallback);
}

export function outreachPermissionLabel(status: string, blocked: boolean): string {
  if (status === "professional_purpose") return "Confirmed";
  if (blocked) return readable(status);
  return "Not confirmed";
}

export function outreachVerificationLabel(ready: boolean, lastVerifiedAt: unknown): string {
  if (ready) return lastVerifiedAt ? `Verified · ${dateTime(lastVerifiedAt)}` : "Verified";
  return "Not verified";
}

export function field(record: Record<string, unknown>, camel: string, snake: string): unknown {
  return record[camel] ?? record[snake];
}

export function splitIds(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export const placementReadyStages = [
  "prepared",
  "contacted",
  "engaged",
  "information_sample_sent",
  "buyer_review",
  "terms_order_discussion"
] as const;

export const messageStatuses = [
  "draft",
  "approval_requested",
  "approved",
  "queued",
  "accepted",
  "delivered",
  "replied",
  "bounced",
  "failed",
  "suppressed",
  "canceled",
  "received"
] as const;

export const responseClassifications = [
  "interested",
  "not_now",
  "objection",
  "question",
  "opt_out",
  "wrong_contact",
  "not_fit"
] as const;

export function messageStatus(record: Record<string, unknown>): string {
  return shown(record.status, "draft");
}

/** Semantic tone for StatusLabel; chart colors are applied in outreach.css by status class. */
export function messageStatusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (["failed", "bounced", "suppressed", "canceled"].includes(status)) return "danger";
  if (["approved", "accepted", "delivered", "replied", "received"].includes(status)) return "success";
  if (["approval_requested", "queued", "draft"].includes(status)) return "info";
  return "neutral";
}

export function hasUnresolvedPlaceholders(subject: string, body: string): boolean {
  return /\{\{[^}]+\}\}/.test(`${subject}\n${body}`);
}
