export type BrandRow = Record<string, unknown> & {
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

export function readable(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function brandName(record: Record<string, unknown>): string {
  return shown(record.name ?? record.public_name ?? record.publicName, "Brand unavailable");
}

export function brandStage(record: Record<string, unknown>): string {
  return shown(record.pipelineStage ?? record.pipeline_stage, "discovered");
}

export function brandIdentity(record: Record<string, unknown>): string {
  return shown(record.identityStatus ?? record.identity_status, "unverified");
}

export function brandField(record: Record<string, unknown>, camel: string, snake: string): unknown {
  return record[camel] ?? record[snake];
}

export const brandStages = [
  "",
  "discovered",
  "researching",
  "contact_ready",
  "rejected"
] as const;

export const brandFields = [
  ["wholesaleStatus", "Wholesale status", ["unknown", "not_offered", "inquiry_required", "available", "restricted"]],
  ["communicationCondition", "Communication condition", ["not_reviewed", "concerning", "conditional", "professional"]],
  ["contactPurpose", "Professional contact purpose", []],
  ["operationsSummary", "Operations summary", []],
  ["stopFlag", "Stop flag", ["false", "true"]]
] as const;

export type BrandCompatibility = {
  registerPath: string;
  detailPath: (id: string) => string;
  showCompatibilityNotice?: boolean;
};

export const canonicalBrandPaths: BrandCompatibility = {
  registerPath: "/brands",
  detailPath: (id) => `/brands/${id}`
};
