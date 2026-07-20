import type { ReactNode } from "react";

export type AsyncState = "idle" | "loading" | "success" | "error";
export type SemanticTone = "neutral" | "success" | "warning" | "danger" | "info" | "ai";
export type ComponentSize = "compact" | "default" | "touch";

export function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toneForStatus(value: string): SemanticTone {
  const status = humanize(value).toLowerCase();
  if (/(blocked|revoked|dead|failed|rejected|critical|overdue|disputed|terminated)/.test(status)) {
    return "danger";
  }
  if (/(read only|expired|past due|warning|condition|stalled|at risk|pending|unknown)/.test(status)) {
    return "warning";
  }
  if (/(full|active|succeeded|completed|approved|verified|authorized|healthy|paid|won)/.test(status)) {
    return "success";
  }
  if (/(ai|inference|model)/.test(status)) return "ai";
  if (/(info|review|draft|proposed|open)/.test(status)) return "info";
  return "neutral";
}

export type WithChildren = { children?: ReactNode };
