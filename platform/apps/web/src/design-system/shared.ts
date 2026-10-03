import type { ReactNode } from "react";

export type AsyncState = "idle" | "loading" | "success" | "error";
export type SemanticTone = "neutral" | "success" | "warning" | "danger" | "info" | "ai";
export type ComponentSize = "compact" | "default" | "touch";

export function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/** Strip internal/fixture phrasing from user-visible copy. */
export function platformCopy(value: unknown, fallback = ""): string {
  let text = typeof value === "string"
    ? value
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : "";
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  text = text
    .replace(/\bhuman[- ](?:owned|controlled|confirmed|approved|placed|assisted|edited|reviewer)\b/gi, "")
    .replace(/\bhuman\b/gi, "")
    .replace(/\b(?:synthetic|fixture|seed)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!])/g, "$1")
    .trim();
  if (!text) return fallback;
  return text.replace(/^[a-z]/, (letter) => letter.toUpperCase());
}

export function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sentence-case status copy for softer UI (Paid, None — not PAID / NONE). */
export function statusLabelText(value: string): string {
  const spaced = humanize(value).toLowerCase();
  if (!spaced) return spaced;
  return spaced.replace(/^\p{L}/u, (letter) => letter.toUpperCase());
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
