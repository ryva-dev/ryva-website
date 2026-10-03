export type Row = Record<string, unknown> & { id: string; version?: number };

export function shown(value: unknown, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  return fallback;
}

export function date(value: unknown): string {
  if (typeof value !== "string" || !value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
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

/** Trailing seed/fixture slug such as "disp-chromium-desktop-1784734627049" or "acct-m-1784734662784". */
const FIXTURE_SLUG = /(?:\s+|[-_])[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d{6,}\s*$/i;
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

export function displayNameTitle(value: unknown): string | undefined {
  const raw = shown(value, "").replace(/\s+/g, " ").trim();
  if (!raw) return undefined;
  const clean = displayName(raw, "");
  return clean && clean !== raw ? raw : undefined;
}

import { displayBrandName } from "../brand/utils";

export function displayBrand(record: Record<string, unknown>, fallback = "—"): string {
  return displayBrandName(field(record, "brandName", "brand_name"), fallback);
}

export function displayBusiness(record: Record<string, unknown>, fallback = "—"): string {
  return displayName(field(record, "businessName", "business_name") ?? field(record, "name", "name"), fallback);
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

/** Visible placement path on Overview — commercial stages live under Commercial. */
export const overviewTimelineStages = [
  "identified",
  "qualified",
  "prepared",
  "contacted",
  "engaged",
  "buyer_review"
] as const;

export const commercialStages = [
  "opening_order",
  "active_account",
  "reorder_management"
] as const;

export const terminalStages = ["closed_lost", "disqualified"] as const;

/** Compact Kanban lanes — groups fine stages into three workable columns. */
export const kanbanLanes = [
  {
    id: "intake",
    label: "Intake",
    description: "Newly opened and prepared opportunities",
    stages: ["identified", "qualified", "prepared"] as const,
    dropStage: "identified"
  },
  {
    id: "active",
    label: "In progress",
    description: "Buyer conversations and commercial review",
    stages: [
      "contacted",
      "engaged",
      "information_sample_sent",
      "buyer_review",
      "terms_order_discussion",
      "opening_order",
      "active_account",
      "reorder_management"
    ] as const,
    dropStage: "contacted"
  },
  {
    id: "closed",
    label: "Closed",
    description: "Lost or disqualified outcomes",
    stages: ["closed_lost", "disqualified"] as const,
    dropStage: "closed_lost"
  }
] as const;

export type KanbanLaneId = (typeof kanbanLanes)[number]["id"];

/** Stages offered for keyboard / menu moves on the board. */
export const kanbanMoveStages = [...pipelineBoardStages, ...terminalStages] as const;

export function kanbanLaneForStage(stage: string): (typeof kanbanLanes)[number] {
  return kanbanLanes.find((lane) => (lane.stages as readonly string[]).includes(stage)) ?? kanbanLanes[0];
}

export function isTerminalStage(stage: string): boolean {
  return (terminalStages as readonly string[]).includes(stage);
}

/** Default forward target for Advance placement — respects selectable stage order. */
export function defaultNextStage(currentStage: string): typeof selectableStages[number] {
  const stage = currentStage.trim().toLowerCase();
  const selectable = selectableStages as readonly string[];
  const currentIndex = selectable.indexOf(stage);
  const lastForwardIndex = selectable.indexOf("terms_order_discussion");

  if (currentIndex >= 0) {
    if (currentIndex < lastForwardIndex) {
      return selectable[currentIndex + 1] as typeof selectableStages[number];
    }
    return selectable[currentIndex] as typeof selectableStages[number];
  }

  if (isTerminalStage(stage)) {
    return stage as typeof selectableStages[number];
  }

  const progressionIndex = (progressionStages as readonly string[]).indexOf(stage);
  if (progressionIndex >= 0) {
    for (let index = progressionIndex + 1; index < progressionStages.length; index += 1) {
      const candidate = progressionStages[index];
      if (candidate && selectable.includes(candidate)) {
        return candidate as typeof selectableStages[number];
      }
    }
    return "terms_order_discussion";
  }

  return "identified";
}

export function overviewTimelineIndex(stage: string): number {
  const direct = (overviewTimelineStages as readonly string[]).indexOf(stage);
  if (direct >= 0) return direct;
  if (stage === "information_sample_sent") {
    return (overviewTimelineStages as readonly string[]).indexOf("engaged");
  }
  if (stage === "terms_order_discussion") {
    return (overviewTimelineStages as readonly string[]).indexOf("buyer_review");
  }
  if ((commercialStages as readonly string[]).includes(stage)) {
    return overviewTimelineStages.length;
  }
  if (isTerminalStage(stage)) return -1;
  return 0;
}

export function placementStage(record: Record<string, unknown>): string {
  return shown(field(record, "stage", "stage"), "identified");
}

/** Semantic tone for StatusLabel; chart colors are applied in placement.css by stage class. */
export function placementStageTone(stage: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (isTerminalStage(stage)) return "danger";
  if ((commercialStages as readonly string[]).includes(stage)) return "success";
  if (stage === "buyer_review" || stage === "terms_order_discussion") return "success";
  if (
    stage === "contacted"
    || stage === "engaged"
    || stage === "information_sample_sent"
    || stage === "prepared"
  ) {
    return "info";
  }
  if (stage === "qualified") return "info";
  return "neutral";
}

export function conflictStatus(record: Record<string, unknown>): string {
  return shown(field(record, "conflictStatus", "conflict_status"), "clear");
}

export function authorityCheckLabel(record: Record<string, unknown>): string {
  const agreementStatus = shown(field(record, "agreementStatus", "agreement_status"), "");
  if (agreementStatus === "active") return "Authority clear";
  if (agreementStatus === "pending_approval" || agreementStatus === "reviewing") return "Authority pending";
  if (agreementStatus === "suspended" || agreementStatus === "ended" || agreementStatus === "expired") {
    return "Authority inactive";
  }
  return agreementStatus ? "Authority review" : "Authority missing";
}

export function conflictCheckLabel(record: Record<string, unknown>): string {
  const status = conflictStatus(record);
  if (status === "clear") return "No conflict";
  if (status === "review_required") return "Conflict review";
  if (status === "blocked") return "Conflict blocked";
  return readable(status);
}

export function statusChecksClear(record: Record<string, unknown>): boolean {
  return shown(field(record, "agreementStatus", "agreement_status"), "") === "active"
    && conflictStatus(record) === "clear";
}

const stageNextActionCopy: Record<string, string> = {
  identified: "Contact buyer",
  qualified: "Contact buyer",
  prepared: "Contact buyer",
  contacted: "Review placement terms",
  engaged: "Review placement terms",
  information_sample_sent: "Review placement terms",
  buyer_review: "Review placement terms",
  terms_order_discussion: "Confirm reorder window",
  opening_order: "Confirm reorder window",
  active_account: "Confirm reorder window",
  reorder_management: "Confirm reorder window"
};

function isGenericNextAction(value: string): boolean {
  return /prepare\s+authorized\s+placement|authorized\s+placement\s+next\s+action|^placement\s+next\s+action$|^next\s+action$/i.test(value);
}

/** Concise next-action copy for register cells. Empty → Add next action. */
export function nextActionLabel(record: Record<string, unknown>): string {
  const raw = shown(field(record, "nextAction", "next_action"), "").trim();
  if (!raw) return "Add next action";
  if (isGenericNextAction(raw) || raw.length > 40) {
    return stageNextActionCopy[placementStage(record)] ?? "Add next action";
  }
  return raw;
}

export function authorityTone(outcome: string): "success" | "warning" | "danger" | "info" {
  if (outcome === "authorized") return "success";
  if (outcome === "review_required") return "warning";
  if (outcome === "denied" || outcome === "blocked") return "danger";
  return "info";
}
