export type Row = Record<string, unknown> & { id: string; version?: number };

export function shown(value: unknown, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  return fallback;
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

export function hasUnresolvedPlaceholders(subject: string, body: string): boolean {
  return /\{\{[^}]+\}\}/.test(`${subject}\n${body}`);
}
