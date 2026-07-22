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

/** Manual stage selector stages — Order/Account stages advance only through later workflows. */
export const selectableStages = [
  "identified",
  "qualified",
  "prepared",
  "contacted",
  "engaged",
  "information_sample_sent",
  "buyer_review",
  "terms_order_discussion",
  "closed_lost",
  "disqualified"
] as const;

export const pipelineBoardStages = [
  "identified",
  "qualified",
  "prepared",
  "contacted",
  "engaged",
  "information_sample_sent",
  "buyer_review",
  "terms_order_discussion"
] as const;

export const progressionStages = [
  "identified",
  "qualified",
  "prepared",
  "contacted",
  "engaged",
  "information_sample_sent",
  "buyer_review",
  "terms_order_discussion",
  "opening_order",
  "active_account",
  "reorder_management"
] as const;

export const terminalStages = ["closed_lost", "disqualified"] as const;

export function isTerminalStage(stage: string): boolean {
  return (terminalStages as readonly string[]).includes(stage);
}

export function placementStage(record: Record<string, unknown>): string {
  return shown(field(record, "stage", "stage"), "identified");
}

export function conflictStatus(record: Record<string, unknown>): string {
  return shown(field(record, "conflictStatus", "conflict_status"), "clear");
}

export function authorityTone(outcome: string): "success" | "warning" | "danger" | "info" {
  if (outcome === "authorized") return "success";
  if (outcome === "review_required") return "warning";
  if (outcome === "denied" || outcome === "blocked") return "danger";
  return "info";
}
