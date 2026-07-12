import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OnboardingSessionState } from "../onboardingSchemas";
import type { Worker } from "../types";
import { WorkerOnboardingPage } from "./WorkerOnboardingPage";
import { WorkerMark } from "./WorkerMark";

/* ============================================================
   Ryva Office — manager's command center
   Tabs: Today · Assignments · Reviews · Workers · Calendar · Handbook · Settings
   All data is user-scoped via /api/office/* endpoints.
   ============================================================ */

type OfficeExperienceAppProps = {
  allWorkers: Worker[];
  hiredWorkers: Worker[];
  isAdmin?: boolean;
  onCheckoutWorker: (workerSlug: string) => Promise<void>;
  onNavigate: (hash: string) => void;
  onNotice: (message: string) => void;
  onRefreshWorkers: () => Promise<void>;
  userName: string;
};

type OverlayChat = { workerSlug: string; id: string; author: "You" | "Worker"; text: string; timestamp: string };
type OverlayTask = { workerSlug: string; id: string; title: string; module: string; owner: string; priority: string; status: string; dueDate: string };
type OverlayWorklog = { workerSlug: string; id: string; action: string; module: string; result: string; timestamp: string };
type OverlayFile = { workerSlug: string; id: string; name: string; type: string; updatedAt: string };
type OverlayAssignment = {
  id: string;
  workerSlug: string;
  sourceType: string;
  sourceId: string;
  sourceLabel: string;
  title: string;
  summary: string;
  status: string;
  priority: string;
  kind: string;
  rhythm: string | null;
  blockedReason: string;
  dueAt: string | null;
  artifactType: string;
  artifactRefId: string | null;
  artifactTitle: string;
  artifactPreview: string;
  createdAt: string;
  updatedAt: string;
};
type OverlayDeliverable = {
  id: string;
  workerSlug: string;
  sourceType: string;
  sourceId: string;
  title: string;
  summary: string;
  deliverableType: string;
  previewText: string;
  contentRefId: string | null;
  createdAt: string;
  updatedAt: string;
};
type OverlayHandbookEntry = {
  id: string;
  section: string;
  subsection: string;
  workerSlug: string | null;
  sourceType: string;
  sourceId: string;
  sourceLabel: string;
  statement: string;
  createdAt: string;
  updatedAt: string;
};
type OverlayBriefing = { workerSlug: string; id: string; title: string; dateLabel: string; summary: string; agendaJson: string; decisionsJson: string; actionsJson: string };
type OverlayCalendarEvent = { id: string; workerSlug: string | null; title: string; startsAt: string; endsAt: string; eventType: string; notes: string; updatedAt: string };
type OverlaySuggestedAction = {
  workerSlug: string;
  id: string;
  actionType: string;
  title: string;
  description: string;
  reason: string;
  relatedThreadId: string | null;
  relatedCampaignId: string | null;
  relatedBrandId: string | null;
  payloadJson: string;
  status: string;
  requiresApproval: number;
  createdAt: string;
};
type OverlayGlobalSettings = { settingsJson: string; updatedAt?: string } | null;
type OverlayIntegration = {
  workerSlug: string;
  provider: string;
  status: string;
  accountLabel: string;
  metadataJson: string;
  connectedAt?: string | null;
  updatedAt?: string;
};
type OverlayOnboarding = {
  workerSlug: string;
  status: OnboardingSessionState["status"];
  answersJson: string;
  generatedSummaryJson: string;
  completedAt?: string | null;
};

type MaraWorkspaceTask = {
  id: string;
  title: string;
  description: string;
  source: string;
  status: string;
  priority: string;
  dueAt?: string | null;
  output?: string | null;
  blockerReason?: string;
  nextStep?: string;
};

type MaraWorkspaceApproval = {
  id: string;
  title: string;
  description: string;
  actionType: string;
  status: string;
};

type MaraWorkspaceActivity = {
  id: string;
  eventType: string;
  title: string;
  description: string;
  createdAt: string;
};

type MaraWorkspaceKnowledge = {
  title: string;
  friendlyLabel: string;
  items: string[];
};

type MaraWorkspaceOutput = MaraWorkspaceTask & {
  content?: string;
  outputPreview: {
    preview: string;
    title: string;
    type: string;
  } | null;
};

type MaraWorkspaceWaitingItem = {
  id: string;
  kind: "approval" | "blocked_task" | "proposed_task";
  title: string;
  description: string;
  blockerReason?: string;
  nextStep?: string;
};

type MaraAutonomySummary = {
  blockers?: string[];
  createdTaskIds?: string[];
  executedTaskIds?: string[];
  mode?: string;
  notes?: string[];
  outputs?: Array<{ id?: string; title?: string }>;
  plannedActions?: string[];
};

type MaraAutonomyRunResponse = {
  ok: boolean;
  summary: MaraAutonomySummary;
  workspace: MaraWorkspace;
};

function formatMaraAutonomyNotice(summary: MaraAutonomySummary): string {
  if (summary.blockers?.length && !summary.outputs?.length && !summary.executedTaskIds?.length) {
    return `I'm blocked: ${summary.blockers[0]}`;
  }

  const parts: string[] = [];
  if (summary.outputs?.length) {
    parts.push(`shipped ${summary.outputs.length} deliverable${summary.outputs.length === 1 ? "" : "s"}`);
  }
  if (summary.executedTaskIds?.length) {
    parts.push(`finished ${summary.executedTaskIds.length} task${summary.executedTaskIds.length === 1 ? "" : "s"}`);
  }
  if (summary.createdTaskIds?.length) {
    parts.push(`queued ${summary.createdTaskIds.length} new task${summary.createdTaskIds.length === 1 ? "" : "s"}`);
  }

  if (parts.length > 0) {
    return `I ${parts.join(", ")}.`;
  }

  if (summary.blockers?.length) {
    return `I'm waiting on you: ${summary.blockers[0]}`;
  }

  return "I'm caught up for now. Check my desk for what's next.";
}

function maraDeskCopy(value: string, fallback = "") {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed || fallback;
}

function buildMaraDesk(worker: Worker, overlays: Overlays, workspace: MaraWorkspace | null): WorkerDesk {
  const integrations = overlays.integrations.filter((integration) => integration.workerSlug === worker.slug);
  const workerDeliverables = overlays.deliverables.filter((deliverable) => deliverable.workerSlug === worker.slug);

  if (!workspace) {
    return {
      workerSlug: worker.slug,
      llmConfigured: true,
      approvals: [],
      connectedTools: integrations.map((integration) => ({
        provider: integration.provider,
        status: integration.status,
        label: integration.accountLabel || integration.provider
      })),
      currentFocus: "I'm getting oriented on your brand.",
      currentFocusReason: "Give me a moment while I set up my desk from your onboarding.",
      inboxLeads: [],
      inboxStatusCounts: {},
      memory: [],
      recentActivity: [],
      recentCompleted: [],
      redditSignals: [],
      researchToday: [],
      recommendedNext: null,
      waitingOnUser: [],
      workInMotion: []
    };
  }

  const waitingOnUser = workspace.waitingOnUser.map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    summary: maraDeskCopy(item.nextStep || item.description || item.blockerReason || ""),
    actionLabel: item.kind === "approval" || item.kind === "proposed_task" ? "Approve" : "Open"
  }));
  const approvals = workspace.pendingApprovals.map((request) => ({
    id: request.id,
    type: request.actionType || "approval",
    title: request.title,
    summary: maraDeskCopy(request.description),
    reason: maraDeskCopy(request.description),
    status: request.status
  }));
  const outputs = workspace.latestOutputs.map((output) => ({
    id: output.id,
    title: output.outputPreview?.title || output.title,
    summary: output.outputPreview?.preview || maraDeskCopy(output.description || "", "Ready for you to review."),
    contentRefId: output.id,
    sourceType: "worker_output",
    sourceLabel: "Deliverable",
    updatedAt: output.dueAt || new Date().toISOString(),
    workerSlug: worker.slug
  }));
  const inMotion = [
    ...workspace.runnableTasks,
    ...(workspace.currentWork && !workspace.runnableTasks.some((task) => task.id === workspace.currentWork?.id) ? [workspace.currentWork] : [])
  ]
    .filter((task, index, list) => list.findIndex((entry) => entry.id === task.id) === index)
    .slice(0, 4)
    .map((task) => ({
      id: task.id,
      title: task.title,
      summary: maraDeskCopy(task.description),
      status: task.status
    }));

  return {
    workerSlug: worker.slug,
    llmConfigured: workspace.llmConfigured !== false,
    approvals,
    connectedTools: integrations.map((integration) => ({
      provider: integration.provider,
      status: integration.status,
      label: integration.accountLabel || integration.provider
    })),
    currentFocus: workspace.currentFocus,
    currentFocusReason: maraDeskCopy(
      workspace.currentWork?.description || inMotion[0]?.summary || "I'm working through your queue in the order that moves your brand forward."
    ),
    inboxLeads: workspace.inboxLeadSnapshot?.items.map((item) => ({
      brandName: item.brandName,
      contactEmail: item.contactEmail,
      contactName: item.contactName,
      snippet: maraDeskCopy(item.snippet || item.subject),
      status: sentenceCase(item.status.replace(/_/g, " ")),
      urgency: item.urgency
    })) ?? [],
    inboxStatusCounts: workspace.inboxLeadSnapshot?.counts ?? {},
    memory: workspace.whatMaraKnows.flatMap((section, index) =>
      section.items.slice(0, 1).map((item) => ({
        id: `${section.friendlyLabel}-${index}`,
        label: section.friendlyLabel,
        text: maraDeskCopy(item)
      }))
    ).slice(0, 5),
    recentActivity: workspace.recentActivity.map((entry) => ({
      id: entry.id,
      title: entry.title,
      summary: maraDeskCopy(entry.description),
      createdAt: entry.createdAt
    })).slice(0, 5),
    recentCompleted: outputs.slice(0, 4),
    redditSignals: workspace.researchSnapshot?.redditSignalsToday.map((item) => ({
      id: item.id,
      summary: maraDeskCopy(item.summary),
      title: item.title
    })) ?? [],
    recommendedNext: workspace.recommendedNext?.label || waitingOnUser[0]?.title || inMotion[0]?.title || null,
    researchToday: workspace.researchSnapshot?.brandsFoundToday.map((item) => ({
      id: item.id,
      summary: maraDeskCopy(item.summary),
      title: item.title
    })) ?? [],
    waitingOnUser: waitingOnUser.slice(0, 5),
    workInMotion: inMotion
  };
}

type MaraWorkspace = {
  blockedTasks: MaraWorkspaceTask[];
  currentFocus: string;
  llmConfigured?: boolean;
  currentWork: MaraWorkspaceTask | null;
  inboxLeadSnapshot: {
    counts: Record<string, number>;
    items: Array<{
      brandName: string;
      contactEmail: string;
      contactName: string;
      snippet: string;
      status: string;
      subject: string;
      urgency: string;
    }>;
    urgentCount: number;
  };
  latestOutputs: MaraWorkspaceOutput[];
  pendingApprovals: MaraWorkspaceApproval[];
  recentActivity: MaraWorkspaceActivity[];
  recommendedNext: {
    actionLabel: string;
    approvalId?: string;
    createTask?: { title: string; description: string; priority: string };
    description?: string;
    dismissible: boolean;
    itemId?: string;
    kind: string;
    label: string;
    prompt?: string;
    taskId?: string;
  } | null;
  recommendedNextActions: string[];
  recommendedNextTaskToRun: MaraWorkspaceTask | null;
  researchItems: Array<{ id: string; topic: string; status: string }>;
  researchSnapshot: {
    brandsFoundToday: Array<{ id: string; title: string; summary: string }>;
    dailyCap: number;
    redditSignalsToday: Array<{ id: string; title: string; summary: string }>;
    researchedTodayCount: number;
  };
  runnableTasks: MaraWorkspaceTask[];
  waitingOnUser: MaraWorkspaceWaitingItem[];
  whatMaraKnows: MaraWorkspaceKnowledge[];
};

type WorkerDeskMemory = {
  id: string;
  label: string;
  text: string;
};

type WorkerDeskApproval = {
  id: string;
  type: string;
  title: string;
  summary: string;
  reason: string;
  status: string;
};

type WorkerDeskDeliverable = {
  id: string;
  contentRefId?: string | null;
  sourceType?: string;
  title: string;
  summary: string;
  workerSlug?: string;
  sourceLabel: string;
  updatedAt: string;
};

type DeliverableDetail = {
  content: string;
  downloadUrl?: string | null;
  previewText?: string;
  structuredContent?: unknown;
  summary: string;
  title: string;
  type: string;
  workerName?: string;
};

type WorkerDeskActivity = {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
};

type WorkerDesk = {
  workerSlug: string;
  llmConfigured?: boolean;
  currentFocus: string;
  currentFocusReason: string;
  workInMotion: Array<{ id: string; title: string; summary: string; status: string }>;
  waitingOnUser: Array<{ id: string; title: string; summary: string; actionLabel?: string; kind?: string }>;
  recentCompleted: WorkerDeskDeliverable[];
  recentActivity: WorkerDeskActivity[];
  researchToday: Array<{ id: string; title: string; summary: string }>;
  redditSignals: Array<{ id: string; title: string; summary: string }>;
  inboxLeads: Array<{ brandName: string; contactName: string; contactEmail: string; status: string; snippet: string; urgency: string }>;
  inboxStatusCounts: Record<string, number>;
  approvals: WorkerDeskApproval[];
  memory: WorkerDeskMemory[];
  connectedTools: Array<{ provider: string; status: string; label: string }>;
  recommendedNext: string | null;
};

type Overlays = {
  chats: OverlayChat[];
  assignments: OverlayAssignment[];
  tasks: OverlayTask[];
  suggestedActions: OverlaySuggestedAction[];
  worklog: OverlayWorklog[];
  files: OverlayFile[];
  deliverables: OverlayDeliverable[];
  briefings: OverlayBriefing[];
  handbookEntries: OverlayHandbookEntry[];
  calendarEvents: OverlayCalendarEvent[];
  globalSettings: OverlayGlobalSettings;
  integrations: OverlayIntegration[];
  onboarding: OverlayOnboarding[];
};

const EMPTY_OVERLAYS: Overlays = {
  chats: [], assignments: [], tasks: [], suggestedActions: [], worklog: [], files: [], deliverables: [], briefings: [], handbookEntries: [], calendarEvents: [], globalSettings: null, integrations: [], onboarding: [],
};

type Tab = "today" | "assignments" | "reviews" | "workers" | "deliverables" | "calendar" | "handbook" | "settings" | "worker-onboarding";
type WorkbenchSection = "desk" | "conversation" | "intelligence" | "knowledge" | "history";
const WORKER_DEPENDENT: Tab[] = ["today", "assignments", "reviews", "workers", "deliverables"];
async function officeJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Office request failed.";
    throw new Error(message);
  }
  return payload as T;
}

function parseOfficeRoute(hash: string): { tab: Tab; workerSlug: string | null; section: WorkbenchSection | null } {
  const parts = hash.replace(/^#/, "").replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts[0] !== "app" || parts[1] !== "office") return { tab: "today", workerSlug: null, section: null };
  if (parts[2] === "workers" && parts[3] && parts[4] === "onboarding") {
    return { tab: "worker-onboarding", workerSlug: parts[3], section: null };
  }
  if (parts[2] === "workers" && parts[3]) {
    const rawSection = parts[4] as WorkbenchSection | undefined;
    const section: WorkbenchSection = rawSection && (["desk", "conversation", "intelligence", "knowledge", "history"] as WorkbenchSection[]).includes(rawSection)
      ? rawSection
      : "desk";
    return { tab: "workers", workerSlug: parts[3], section };
  }
  if (parts[2] === "chat" && parts[3]) {
    return { tab: "workers", workerSlug: parts[3], section: "conversation" };
  }
  if (parts[2] === "desk" && parts[3]) {
    return { tab: "workers", workerSlug: parts[3], section: "desk" };
  }
  const aliases: Record<string, Tab> = {
    approvals: "reviews",
    assignments: "assignments",
    calendar: "calendar",
    deliverables: "deliverables",
    files: "deliverables",
    handbook: "handbook",
    reviews: "reviews",
    settings: "settings",
    team: "workers",
    today: "today",
    workers: "workers"
  };
  const tab = aliases[parts[2] ?? ""] ?? "today";
  return { tab, workerSlug: null, section: null };
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function isMaraWorker(workerSlug: string | null | undefined) {
  return workerSlug === "mara-vale";
}

/** Workers backed by the role-config agent engine (all hireable employees). */
const AGENT_WORKER_SLUGS = new Set([
  "mara-vale",
  "sloane-pierce",
  "etta-marsh",
  "rowan-feld",
  "june-okafor",
  "camille-roy"
]);

function isAgentWorker(workerSlug: string | null | undefined) {
  return Boolean(workerSlug && AGENT_WORKER_SLUGS.has(workerSlug));
}

function deliverableGeneratedBy(structuredContent: unknown): string | null {
  if (structuredContent && typeof structuredContent === "object" && "generatedBy" in structuredContent) {
    const value = String((structuredContent as { generatedBy?: unknown }).generatedBy ?? "");
    return value || null;
  }
  return null;
}

function usePersistentBoolean(key: string, fallback: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(key, value ? "1" : "0");
  }, [key, value]);

  return [value, setValue] as const;
}

function sentenceCase(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Machine keys like "autonomy_tiktok_trends" must never reach the screen.
 * Turns snake/kebab keys into readable labels; leaves human text alone.
 */
function humanizeMachineText(value: string | null | undefined, fallback = ""): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return fallback;
  if (/^[a-z0-9]+([_-][a-z0-9]+)+$/i.test(trimmed)) {
    const KEY_LABELS: Record<string, string> = {
      autonomy_brand_content: "Brand content planning",
      autonomy_brand_pitch: "Outreach",
      autonomy_brand_research: "Brand research",
      autonomy_maintenance: "Profile upkeep",
      autonomy_market_pulse: "Creator community signals",
      autonomy_ops_brief: "Daily brief",
      autonomy_planned: "Planned by your worker",
      autonomy_starter: "Getting started",
      autonomy_tiktok_trends: "Trend research",
      autonomy_tracker: "Pipeline tracker",
      autonomy_weekly_planning: "Weekly planning",
      chat_direct_request: "From your conversation",
      chat_task_created: "From your conversation",
      mara_suggested: "Suggested by your worker",
      memory_triggered: "From what they know about you",
      office_recommended_next: "Recommended next step",
      office_task: "Office task",
      onboarding_generated: "From onboarding",
      research_triggered: "From research",
      worker_task: "Worker task"
    };
    const mapped = KEY_LABELS[trimmed.toLowerCase()];
    if (mapped) return mapped;
    const spaced = trimmed.replace(/[_-]+/g, " ").toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }
  return trimmed;
}

function normalizeOfficeCopy(value: string, fallback = "") {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return fallback;
  const cleaned = trimmed
    .replace(/\bI run\b/i, "Runs")
    .replace(/\bI need help\b/i, "Needs help")
    .replace(/\bI want help\b/i, "Wants help")
    .replace(/\bI want\b/i, "Wants")
    .replace(/\bI am\b/i, "Is")
    .replace(/\bI’m\b/i, "Is")
    .replace(/\bmy\b/gi, "their");
  return sentenceCase(cleaned);
}

function formatWorkerCategory(worker: Worker) {
  return worker.department || worker.profile.category || "General";
}

function parseJsonList(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(json: string, fallback: T): T {
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function buildFallbackMemory(record: OverlayOnboarding | undefined): WorkerDeskMemory[] {
  if (!record) return [];
  const generated = parseJsonList(record.generatedSummaryJson)
    .map((item, index) => ({
      id: `${record.workerSlug}-memory-${index}`,
      label: index === 0 ? "Context" : "Working note",
      text: normalizeOfficeCopy(item)
    }));
  return generated.slice(0, 5);
}

function buildWorkerDesk(
  worker: Worker,
  overlays: Overlays,
  onboarding: OverlayOnboarding | undefined,
  workspace: MaraWorkspace | null
): WorkerDesk {
  if (isMaraWorker(worker.slug) || (isAgentWorker(worker.slug) && workspace)) {
    return buildMaraDesk(worker, overlays, workspace);
  }

  const workerTasks = overlays.tasks.filter((task) => task.workerSlug === worker.slug);
  const workerActions = overlays.suggestedActions.filter((action) => action.workerSlug === worker.slug);
  const workerFiles = overlays.files.filter((file) => file.workerSlug === worker.slug);
  const workerDeliverables = overlays.deliverables.filter((deliverable) => deliverable.workerSlug === worker.slug);
  const workerEvents = overlays.calendarEvents.filter((event) => event.workerSlug === worker.slug);
  const workerActivity = overlays.worklog.filter((entry) => entry.workerSlug === worker.slug);
  const integrations = overlays.integrations.filter((integration) => integration.workerSlug === worker.slug);
  const approvalsFromOverlay: WorkerDeskApproval[] = [
    ...workerActions
      .filter((action) => action.status === "suggested" && action.requiresApproval)
      .map((action) => ({
        id: action.id,
        type: action.actionType,
        title: action.title,
        summary: normalizeOfficeCopy(action.description),
        reason: normalizeOfficeCopy(action.reason),
        status: action.status
      })),
    ...workerTasks
      .filter((task) => task.status === "Needs Review")
      .map((task) => ({
        id: task.id,
        type: "review_task",
        title: task.title,
        summary: `${task.module} is ready for review.`,
        reason: "This work needs your sign-off before it moves forward.",
        status: task.status
      }))
  ];
  const waitingFromWorkspace =
    workspace?.waitingOnUser.map((item) => ({
      id: item.id,
      title: item.title,
      summary: normalizeOfficeCopy(item.nextStep || item.description || item.blockerReason || ""),
      actionLabel: item.kind === "approval" ? "Review" : "Open task"
    })) ?? [];
  const waitingFallback = approvalsFromOverlay.map((approval) => ({
    id: approval.id,
    title: approval.title,
    summary: approval.reason,
    actionLabel: "Review"
  }));
  const outputs =
    workspace?.latestOutputs.map((output) => ({
      id: output.id,
      title: output.outputPreview?.title || output.title,
      summary: output.outputPreview?.preview || normalizeOfficeCopy(output.description || "", "Output ready to review."),
      contentRefId: output.id,
      sourceType: "worker_output",
      sourceLabel: "Deliverable",
      updatedAt: output.dueAt || new Date().toISOString(),
      workerSlug: worker.slug
    })) ??
    workerDeliverables.slice(0, 5).map((deliverable) => ({
      contentRefId: deliverable.contentRefId,
      sourceType: deliverable.sourceType,
      id: deliverable.id,
      title: deliverable.title,
      summary: deliverable.summary || deliverable.previewText,
      sourceLabel: sentenceCase(deliverable.deliverableType.replace(/_/g, " ")),
      updatedAt: deliverable.updatedAt,
      workerSlug: worker.slug
    })) ??
    workerFiles.slice(0, 3).map((file) => ({
      contentRefId: file.id,
      sourceType: "uploaded_file",
      id: file.id,
      title: file.name,
      summary: `${file.type} prepared by ${worker.name.split(" ")[0]}.`,
      sourceLabel: "File",
      updatedAt: file.updatedAt,
      workerSlug: worker.slug
    }));
  const inMotion =
    workspace?.runnableTasks.map((task) => ({
      id: task.id,
      title: task.title,
      summary: normalizeOfficeCopy(task.description),
      status: task.status
    })) ??
    workerTasks
      .filter((task) => task.status !== "Completed" && task.status !== "Needs Review")
      .slice(0, 3)
      .map((task) => ({
        id: task.id,
        title: task.title,
        summary: `${task.module} · ${task.priority} priority`,
        status: task.status
      }));
  const memory =
    workspace?.whatMaraKnows.flatMap((section, index) =>
      section.items.slice(0, 1).map((item) => ({
        id: `${section.friendlyLabel}-${index}`,
        label: section.friendlyLabel,
        text: normalizeOfficeCopy(item)
      }))
    ) ?? buildFallbackMemory(onboarding);
  const connectedTools = integrations.map((integration) => ({
    provider: integration.provider,
    status: integration.status,
    label: integration.accountLabel || integration.provider
  }));
  const recentActivity =
    workspace?.recentActivity.map((entry) => ({
      id: entry.id,
      title: entry.title,
      summary: normalizeOfficeCopy(entry.description),
      createdAt: entry.createdAt
    })) ??
    workerActivity.slice(0, 5).map((entry) => ({
      id: entry.id,
      title: entry.action,
      summary: normalizeOfficeCopy(entry.result),
      createdAt: entry.timestamp
    }));
  const fallbackFocus =
    inMotion[0]?.title ||
    approvalsFromOverlay[0]?.title ||
    workerEvents
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0]
      ?.title ||
    "Ready for the next assignment";

  return {
    workerSlug: worker.slug,
    approvals: approvalsFromOverlay,
    connectedTools,
    currentFocus: workspace?.currentFocus || fallbackFocus,
    currentFocusReason: workspace?.currentWork?.description || inMotion[0]?.summary || `${worker.name.split(" ")[0]} is available for the next piece of work.`,
    inboxLeads: workspace?.inboxLeadSnapshot?.items.map((item) => ({
      brandName: item.brandName,
      contactEmail: item.contactEmail,
      contactName: item.contactName,
      snippet: normalizeOfficeCopy(item.snippet || item.subject),
      status: sentenceCase(item.status.replace(/_/g, " ")),
      urgency: item.urgency
    })) ?? [],
    inboxStatusCounts: workspace?.inboxLeadSnapshot?.counts ?? {},
    memory: memory.slice(0, 5),
    recentActivity: recentActivity.slice(0, 5),
    recentCompleted: outputs.slice(0, 3),
    redditSignals: workspace?.researchSnapshot?.redditSignalsToday.map((item) => ({
      id: item.id,
      summary: normalizeOfficeCopy(item.summary),
      title: item.title
    })) ?? [],
    recommendedNext: workspace?.recommendedNext?.label || waitingFromWorkspace[0]?.title || inMotion[0]?.title || null,
    researchToday: workspace?.researchSnapshot?.brandsFoundToday.map((item) => ({
      id: item.id,
      summary: normalizeOfficeCopy(item.summary),
      title: item.title
    })) ?? [],
    waitingOnUser: (waitingFromWorkspace.length > 0 ? waitingFromWorkspace : waitingFallback).slice(0, 3),
    workInMotion: inMotion.slice(0, 3)
  };
}

function parseOnboardingSession(record: OverlayOnboarding | undefined): OnboardingSessionState | null {
  if (!record) {
    return null;
  }

  let answers: Record<string, string> = {};
  let generatedSummary: string[] = [];

  try {
    const parsed = JSON.parse(record.answersJson);
    answers = parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    answers = {};
  }

  try {
    const parsed = JSON.parse(record.generatedSummaryJson);
    generatedSummary = Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    generatedSummary = [];
  }

  return {
    answers,
    completedAt: record.completedAt ?? null,
    generatedSummary,
    status: record.status
  };
}

/* ---------- shared chrome ---------- */

const NAV_ITEMS: Array<{ tab: Tab; label: string; icon: JSX.Element }> = [
  { tab: "today", label: "Today", icon: <><path d="M3 12l9-8 9 8" /><path d="M5 10v10h14V10" /></> },
  { tab: "assignments", label: "Assignments", icon: <><path d="M7 6h10" /><path d="M7 12h10" /><path d="M7 18h7" /><rect x="4" y="4" width="16" height="16" rx="2" /></> },
  { tab: "reviews", label: "Reviews", icon: <><path d="M9 12l2 2 4-5" /><circle cx="12" cy="12" r="9" /></> },
  { tab: "deliverables", label: "Deliverables", icon: <><path d="M7 4h7l3 3v13H7z" /><path d="M14 4v4h4" /><path d="M10 12h4" /><path d="M10 16h4" /></> },
  { tab: "calendar", label: "Calendar", icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></> },
  { tab: "workers", label: "Workers", icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 15.2c2.6.2 4.6 1.8 5.3 4.3" /></> },
  { tab: "handbook", label: "Handbook", icon: <><path d="M6 4.5h11a2 2 0 0 1 2 2V19a1 1 0 0 1-1.4.9L14 18.2l-3.6 1.7A1 1 0 0 1 9 19V6.5a2 2 0 0 0-2-2Z" /><path d="M6 4.5A2.5 2.5 0 0 0 3.5 7V17A2.5 2.5 0 0 0 6 19.5h11" /></> },
];

function lastActivityFor(slug: string, worklog: OverlayWorklog[]): string {
  const entry = worklog.find((w) => w.workerSlug === slug);
  return entry ? entry.action : "No activity yet";
}

function parseTaskOutput(output: string | null | undefined) {
  if (!output) return null;
  try {
    const parsed = JSON.parse(output);
    if (parsed && typeof parsed === "object") {
      return {
        preview: String(parsed.preview ?? ""),
        title: String(parsed.title ?? ""),
        type: String(parsed.type ?? "general")
      };
    }
  } catch {
    return {
      preview: String(output),
      title: "",
      type: "general"
    };
  }

  return null;
}

function seedOfficeConversationDraft(prompt: string) {
  if (!prompt.trim()) return;
  window.setTimeout(() => {
    const event = new CustomEvent("ryva-office-seed-draft", { detail: { prompt } });
    window.dispatchEvent(event);
  }, 0);
}

/* ---------- empty state ---------- */

function EmptyOffice({ label, onNavigate }: { label: string; onNavigate: (h: string) => void }) {
  return (
    <div className="ro-empty">
      <div className="ro-empty-mark">
        <WorkerMark seed="ryva-empty" size={64} />
      </div>
      <h2>Your office is quiet.</h2>
      <p>You haven't hired anyone yet. Once you do, {label} will fill in here — presence, work, and everything waiting on you.</p>
      <button className="r-btn r-btn-accent" type="button" onClick={() => onNavigate("#workers")}>
        Browse the marketplace
      </button>
    </div>
  );
}

/* ---------- Today ---------- */

function TodayView({
  desks, userName, workers, overlays, onNavigate, onApprovalsClick, onOpenWorkerDetails,
}: {
  desks: WorkerDesk[];
  userName: string; workers: Worker[]; overlays: Overlays;
  onNavigate: (h: string) => void; onApprovalsClick: () => void; onOpenWorkerDetails: (workerSlug: string) => void;
}) {
  const today = new Date();
  const nameFor = (slug: string) => workers.find((w) => w.slug === slug)?.name ?? "Worker";
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const todaysEvents = overlays.calendarEvents
    .filter((e) => new Date(e.startsAt).toDateString() === today.toDateString())
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const attentionItems = desks
    .flatMap((desk) => desk.waitingOnUser.map((item) => ({ ...item, workerSlug: desk.workerSlug })))
    .slice(0, 6);
  const workerSnapshots = desks
    .map((desk) => {
      const worker = workers.find((entry) => entry.slug === desk.workerSlug);
      return {
        desk,
        worker,
        recentWin: desk.recentCompleted[0] ?? null,
        recentMove: desk.recentActivity[0] ?? null,
        activeTask: desk.workInMotion[0] ?? null
      };
    })
    .filter((entry) => entry.worker)
    .slice(0, 4);
  const recentChanges = desks
    .flatMap((desk) => {
      const completed = desk.recentCompleted.slice(0, 2).map((item) => ({
        createdAt: item.updatedAt,
        id: `${desk.workerSlug}-${item.id}-done`,
        kind: "Shipped",
        title: item.title,
        summary: item.summary,
        workerSlug: desk.workerSlug
      }));
      const activity = desk.recentActivity.slice(0, 2).map((item) => ({
        createdAt: item.createdAt,
        id: `${desk.workerSlug}-${item.id}-activity`,
        kind: sentenceCase(item.title),
        title: item.summary,
        summary: "",
        workerSlug: desk.workerSlug
      }));
      return [...completed, ...activity];
    })
    .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt))
    .slice(0, 6);
  const activeAssignments = desks
    .flatMap((desk) => desk.workInMotion.map((item) => ({ ...item, workerSlug: desk.workerSlug })))
    .slice(0, 6);
  const todayCalStart = 7;
  const todayCalEnd = 21;
  const todayCalHours = Array.from({ length: todayCalEnd - todayCalStart }, (_, index) => todayCalStart + index);
  const nowHour = today.getHours() + today.getMinutes() / 60;
  const hourLabel = (h: number) => (h === 0 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`);
  const leadAttention = attentionItems[0] ?? null;
  const secondaryAttention = attentionItems.slice(1, 4);
  const nextEvent = todaysEvents[0] ?? null;
  const dateLine = today.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="ro-main-scroll">
      <header className="ro-page-head">
        <h1>Good {today.getHours() < 12 ? "morning" : today.getHours() < 18 ? "afternoon" : "evening"}, {userName.split(" ")[0]}.</h1>
        <p className="ro-page-meta">
          {dateLine} · {workers.length} {workers.length === 1 ? "worker" : "workers"} on the clock · {attentionItems.length} item{attentionItems.length === 1 ? "" : "s"} need you
        </p>
      </header>

      <div className="ro-today-layout">
        <div className="ro-today-main">
          <section className="ro-sec ro-sec-lead">
            <div className="ro-sec-head">
              <h2>Needs you</h2>
              <div className="ro-sec-head-actions">
                <span className="ro-sec-n">{attentionItems.length === 0 ? "All clear" : attentionItems.length}</span>
                {attentionItems.length > 0 ? (
                  <button className="ro-textlink" type="button" onClick={onApprovalsClick}>
                    Open reviews
                  </button>
                ) : null}
              </div>
            </div>
            {leadAttention ? (
              <div className="ro-attention-hero">
                <button className="ro-attention-hero-main" type="button" onClick={onApprovalsClick}>
                  <span className="ro-section-kicker">Needs a decision</span>
                  <strong>{leadAttention.title}</strong>
                  <p>{leadAttention.summary}</p>
                  <div className="ro-attention-meta">
                    <span>{nameFor(leadAttention.workerSlug)}</span>
                    <span>Open review</span>
                  </div>
                </button>
                {secondaryAttention.length > 0 ? (
                  <div className="ro-attention-list">
                    {secondaryAttention.map((item) => (
                      <button key={item.id} className="ro-row ro-row-slim" type="button" onClick={onApprovalsClick}>
                        <div className="ro-row-copy">
                          <strong>{item.title}</strong>
                          <p>{item.summary}</p>
                        </div>
                        <div className="ro-row-end">
                          <span className="ro-row-aside">{nameFor(item.workerSlug)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="ro-blank">Nothing is waiting on you right now.</p>
            )}
          </section>

          {recentChanges.length > 0 ? (
            <section className="ro-sec">
              <div className="ro-sec-head">
                <h2>Since you were away</h2>
                <button className="ro-textlink" type="button" onClick={() => onNavigate("#app/office/workers")}>View worker history</button>
              </div>
              <div className="ro-rows">
                {recentChanges.map((item) => (
                  <button key={item.id} className="ro-row ro-row-activity" type="button" onClick={() => onOpenWorkerDetails(item.workerSlug)}>
                    <div className="ro-row-copy">
                      <span className="ro-row-kicker">{item.kind}</span>
                      <strong>{item.title}</strong>
                      {item.summary ? <p>{truncatePreview(item.summary, 120)}</p> : null}
                    </div>
                    <div className="ro-row-end">
                      <span className="ro-row-aside">{nameFor(item.workerSlug)} · {clock(item.createdAt) || timeAgo(item.createdAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="ro-sec">
            <div className="ro-sec-head">
              <h2>Around the office</h2>
              {workerSnapshots.length > 0 ? (
                <span className="ro-sec-n">{workerSnapshots.length} on the floor</span>
              ) : null}
            </div>
            {workerSnapshots.length === 0 ? (
              <p className="ro-blank">Quiet so far. Work your team does will show up here.</p>
            ) : (
              <div className="ro-worker-floor">
                {workerSnapshots.map((entry) => (
                  <button
                    key={entry.desk.workerSlug}
                    className="ro-worker-floor-row"
                    type="button"
                    onClick={() => onOpenWorkerDetails(entry.desk.workerSlug)}
                  >
                    <div className="ro-worker-floor-mark">
                      <WorkerMark seed={entry.desk.workerSlug} size={42} active />
                    </div>
                    <div className="ro-worker-floor-copy">
                      <div className="ro-worker-floor-head">
                        <strong>{entry.worker?.name}</strong>
                        <span>{entry.worker?.title}</span>
                      </div>
                      <p>{entry.desk.currentFocus}</p>
                      <div className="ro-worker-floor-notes">
                        {entry.activeTask ? <span>On deck: {entry.activeTask.title}</span> : null}
                        {entry.recentWin ? <span>Shipped: {entry.recentWin.title}</span> : null}
                      </div>
                    </div>
                    <div className="ro-worker-floor-side">
                      <span>{entry.recentMove ? timeAgo(entry.recentMove.createdAt) : "Open desk"}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="ro-sec">
            <div className="ro-sec-head">
              <h2>In motion</h2>
              <span className="ro-sec-n">{activeAssignments.length === 0 ? "Quiet" : activeAssignments.length}</span>
            </div>
            {activeAssignments.length === 0 ? (
              <p className="ro-blank">No active assignments right now.</p>
            ) : (
              <div className="ro-rows">
                {activeAssignments.slice(0, 4).map((item) => (
                  <button key={item.id} className="ro-row" type="button" onClick={() => onOpenWorkerDetails(item.workerSlug)}>
                    <div className="ro-row-copy">
                      <span className="ro-row-kicker">{nameFor(item.workerSlug)}</span>
                      <strong>{item.title}</strong>
                      <p>{item.summary}</p>
                    </div>
                    <div className="ro-row-end">
                      <span className="ro-row-aside">{sentenceCase(item.status.replace(/_/g, " "))}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="ro-today-rail">
          <section className="ro-sec ro-sec-lead">
            <div className="ro-sec-head">
              <h2>Today</h2>
              <button className="ro-textlink" type="button" onClick={() => onNavigate("#app/office/calendar")}>Open calendar</button>
            </div>
            {todaysEvents.length === 0 ? (
              <p className="ro-blank">Nothing on the calendar today.</p>
            ) : (
              <>
                {nextEvent ? (
                  <div className="ro-day-brief">
                    <span className="ro-section-kicker">Next up</span>
                    <strong>{nextEvent.title}</strong>
                    <p>{clock(nextEvent.startsAt)} · {nextEvent.workerSlug ? nameFor(nextEvent.workerSlug) : "Office"}</p>
                  </div>
                ) : null}
                <div className="ro-today-calendar" onClick={() => onNavigate("#app/office/calendar")} role="button" tabIndex={0} onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onNavigate("#app/office/calendar");
                  }
                }}>
                  <div className="ro-cal-days ro-cal-days-day">
                    <div className="ro-cal-sidehead" />
                    <div className="ro-cal-dayhead is-today">
                      <span>{todayStart.toLocaleDateString([], { weekday: "short" })}</span>
                      <strong>{todayStart.getDate()}</strong>
                    </div>
                  </div>
                  <div className="ro-today-calendar-scroll">
                    <div className="ro-cal-grid ro-cal-grid-day" style={{ height: (todayCalEnd - todayCalStart) * HOUR_PX }}>
                      {todayCalHours.map((h) => (
                        <div className="ro-cal-row" key={h} style={{ height: HOUR_PX }}>
                          <span className="ro-cal-hour">{hourLabel(h)}</span>
                          <div className="ro-cal-row-days">
                            <div className="ro-cal-lane" />
                          </div>
                        </div>
                      ))}

                      {todaysEvents.map((e) => {
                        const top = (hourOf(e.startsAt) - todayCalStart) * HOUR_PX;
                        const height = Math.max(28, (hourOf(e.endsAt) - hourOf(e.startsAt)) * HOUR_PX - 4);
                        return (
                          <button
                            key={e.id}
                            className={`ro-evt type-${e.eventType.toLowerCase()}`}
                            style={{ top, height, left: 66, right: 10 }}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onNavigate("#app/office/calendar");
                            }}
                          >
                            <span className="ro-evt-title">{e.title}</span>
                            <small>{e.workerSlug ? nameFor(e.workerSlug) : clock(e.startsAt)}</small>
                          </button>
                        );
                      })}

                      {nowHour >= todayCalStart && nowHour <= todayCalEnd && (
                        <div
                          className="ro-nowline"
                          style={{ top: (nowHour - todayCalStart) * HOUR_PX, left: 58, right: 10 }}
                          data-time={today.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

        </aside>
      </div>
    </div>
  );
}

/* ---------- Chat ---------- */

function WorkerDeskSections({
  activeWorker,
  busyId,
  canUseEmail,
  desk,
  onApprove,
  onApproveTask,
  onReject,
  onRunTask,
  onSeedCorrection,
  onViewDeliverable
}: {
  activeWorker: Worker;
  busyId: string | null;
  canUseEmail: boolean;
  desk: WorkerDesk;
  onApprove: (approvalId: string) => Promise<void>;
  onApproveTask: (taskId: string) => Promise<void>;
  onReject: (approvalId: string) => Promise<void>;
  onRunTask: (taskId: string) => Promise<void>;
  onSeedCorrection: (prompt: string) => void;
  onViewDeliverable: (deliverable: WorkerDeskDeliverable) => void;
}) {
  const isMara = isMaraWorker(activeWorker.slug);

  return (
    <>
      {desk.llmConfigured === false ? (
        <section className="ro-limited-note">
          <span className="ro-doc-kicker">Limited mode</span>
          <p>
            My reasoning engine isn't connected yet, so I can queue work but not produce finished deliverables.
            Add the platform AI key to bring me fully online — I won't pass generic filler off as real work.
          </p>
        </section>
      ) : null}
      <section className="ro-worker-drawer-section ro-desk-focus">
        <span className="ro-section-kicker">{isMara ? "What I'm focused on" : "Current focus"}</span>
        <h3>{busyId === "mara-autonomy" && isMara ? "I'm working through your queue right now…" : desk.currentFocus}</h3>
        <p>{desk.currentFocusReason}</p>
      </section>

      <section className="ro-worker-drawer-section">
        <div className="ro-worker-drawer-row">
          <strong>{isMara ? "What I need from you" : "Waiting on you"}</strong>
          <span>{desk.waitingOnUser.length === 0 ? "All clear" : `${desk.waitingOnUser.length} items`}</span>
        </div>
        {desk.waitingOnUser.length > 0 ? (
          <div className="ro-plain-list">
            {desk.waitingOnUser.slice(0, 5).map((item) => (
              <div className="ro-plain-row" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </div>
                {isMara ? (
                  <div className="ro-inline-actions">
                    {item.kind === "approval" ? (
                      <>
                        <button className="r-btn r-btn-ghost" type="button" onClick={() => void onReject(item.id)} disabled={busyId === item.id}>Deny</button>
                        <button className="r-btn r-btn-accent" type="button" onClick={() => void onApprove(item.id)} disabled={busyId === item.id}>
                          {busyId === item.id ? "Saving..." : "Approve"}
                        </button>
                      </>
                    ) : item.kind === "proposed_task" ? (
                      <button className="r-btn r-btn-accent" type="button" onClick={() => void onApproveTask(item.id)} disabled={busyId === item.id}>
                        {busyId === item.id ? "Running..." : "Approve & run"}
                      </button>
                    ) : item.kind === "blocked_task" ? (
                      <button className="r-btn r-btn-ghost" type="button" onClick={() => void onRunTask(item.id)} disabled={busyId === item.id}>
                        {busyId === item.id ? "Running..." : "Try again"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="ro-worker-note">{isMara ? "Nothing is blocking me right now." : "Nothing is blocked right now."}</p>
        )}
      </section>

      <section className="ro-worker-drawer-section">
        <div className="ro-worker-drawer-row">
          <strong>{isMara ? "What I'm working on" : `On ${activeWorker.name.split(" ")[0]}'s plate`}</strong>
          <span>{desk.workInMotion.length === 0 ? "Quiet" : `${desk.workInMotion.length} active`}</span>
        </div>
        {desk.workInMotion.length > 0 ? (
          <div className="ro-plain-list">
            {desk.workInMotion.map((item) => (
              <div className="ro-plain-row" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </div>
                {isMaraWorker(activeWorker.slug) ? (
                  <button className="r-btn r-btn-ghost" type="button" onClick={() => void onRunTask(item.id)} disabled={busyId === item.id}>
                    {busyId === item.id ? "Running..." : "Run"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="ro-worker-note">{isMara ? "My queue is clear — message me if you want me on something specific." : "Ready for the next assignment."}</p>
        )}
      </section>

      <section className="ro-worker-drawer-section">
        <div className="ro-worker-drawer-row">
          <strong>{isMara ? "What I just finished" : `${activeWorker.name.split(" ")[0]} just shipped`}</strong>
          <span>{desk.recentCompleted.length === 0 ? "Nothing yet" : `${desk.recentCompleted.length} items`}</span>
        </div>
        {desk.recentCompleted.length > 0 ? (
          <div className="ro-plain-list">
            {desk.recentCompleted.slice(0, 4).map((item) => (
              <button className="ro-plain-row ro-plain-row-button" type="button" key={item.id} onClick={() => onViewDeliverable(item)}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </div>
                <span>{timeAgo(item.updatedAt)}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="ro-worker-note">{isMara ? "I haven't shipped anything yet — I'm still getting set up on your brand." : "No deliverables have been completed yet."}</p>
        )}
      </section>

      <section className="ro-worker-drawer-section">
        <div className="ro-worker-drawer-row">
          <strong>{isMara ? "My boundaries" : "Access and boundaries"}</strong>
          <span>{isMara ? "From your onboarding rules" : isMaraWorker(activeWorker.slug) ? "Approval-aware" : "Role-based"}</span>
        </div>
        <p className="ro-worker-note">
          {isMara
            ? "I keep moving on safe internal work automatically. Anything sensitive or external stays with you until you approve it."
            : "This worker operates within assigned permissions, tools, and review boundaries."}
        </p>
      </section>
    </>
  );
}

function WorkerDetailDrawer({
  activeWorker,
  busyId,
  canUseEmail,
  desk,
  onApprove,
  onApproveTask,
  onClose,
  onOpenChat,
  onReject,
  onRunTask,
  onSeedCorrection,
  onViewDeliverable
}: {
  activeWorker: Worker;
  busyId: string | null;
  canUseEmail: boolean;
  desk: WorkerDesk;
  onApprove: (approvalId: string) => Promise<void>;
  onApproveTask: (taskId: string) => Promise<void>;
  onClose: () => void;
  onOpenChat: () => void;
  onReject: (approvalId: string) => Promise<void>;
  onRunTask: (taskId: string) => Promise<void>;
  onSeedCorrection: (prompt: string) => void;
  onViewDeliverable: (deliverable: WorkerDeskDeliverable) => void;
}) {
  return (
    <div className="ro-drawer-scrim" onClick={onClose}>
      <aside className="ro-worker-drawer" onClick={(event) => event.stopPropagation()} aria-label={`${activeWorker.name} details`}>
        <div className="ro-worker-drawer-head">
          <div className="ro-worker-drawer-id">
            <WorkerMark seed={activeWorker.slug} size={40} active />
            <div>
              <strong>{activeWorker.name}</strong>
              <span>{activeWorker.title}</span>
            </div>
          </div>
          <button className="ro-drawer-close" type="button" onClick={onClose} aria-label="Close worker details">×</button>
        </div>

        <div className="ro-worker-drawer-scroll">
          <WorkerDeskSections
            activeWorker={activeWorker}
            busyId={busyId}
            canUseEmail={canUseEmail}
            desk={desk}
            onApprove={onApprove}
            onApproveTask={onApproveTask}
            onReject={onReject}
            onRunTask={onRunTask}
            onSeedCorrection={onSeedCorrection}
            onViewDeliverable={onViewDeliverable}
          />
        </div>

        <div className="ro-worker-drawer-actions">
          <button className="r-btn r-btn-ghost" type="button" onClick={onClose}>Close</button>
          <button className="r-btn r-btn-accent" type="button" onClick={onOpenChat}>Open chat</button>
        </div>
      </aside>
    </div>
  );
}

function MaraOutputModal({
  onClose,
  task,
}: {
  onClose: () => void;
  task: MaraWorkspaceOutput;
}) {
  const parsedOutput = task.outputPreview || parseTaskOutput(task.output);

  return (
    <div className="ro-modal-scrim" onClick={onClose}>
      <div className="ro-modal" onClick={(event) => event.stopPropagation()}>
        <h3>{task.title}</h3>
        <div className="ro-field">
          <span>Output type</span>
          <div className="ro-artifact">{parsedOutput?.type || "general"}</div>
        </div>
        <div className="ro-field">
          <span>Preview</span>
          <div className="ro-artifact">{parsedOutput?.preview || "No preview available yet."}</div>
        </div>
        {task.content ? (
          <div className="ro-field">
            <span>Full output</span>
            <div className="ro-artifact" style={{ whiteSpace: "pre-wrap" }}>{task.content}</div>
          </div>
        ) : null}
        <div className="ro-modal-actions">
          <button className="r-btn r-btn-accent" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function WorkerDeskDeliverableModal({
  deliverable,
  onClose,
  workerName
}: {
  deliverable: WorkerDeskDeliverable;
  onClose: () => void;
  workerName: string;
}) {
  const [detail, setDetail] = useState<DeliverableDetail | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const payload = await officeJson<{ deliverable: DeliverableDetail }>(`/api/office/deliverables/${deliverable.id}`, { method: "GET" });
        if (!cancelled) setDetail(payload.deliverable);
      } catch {
        if (!cancelled) {
          setDetail({
            content: "",
            previewText: deliverable.summary,
            summary: deliverable.summary,
            title: deliverable.title,
            type: deliverable.sourceLabel,
            workerName
          });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [deliverable.id, deliverable.sourceLabel, deliverable.summary, deliverable.title, workerName]);

  const generatedBy = deliverableGeneratedBy(detail?.structuredContent);
  const documentDate = new Date(deliverable.updatedAt);
  const dateLine = Number.isNaN(documentDate.getTime())
    ? ""
    : documentDate.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="ro-doc-scrim" onClick={onClose}>
      <div className="ro-doc-sheet" role="document" onClick={(event) => event.stopPropagation()}>
        <button className="ro-doc-close" type="button" aria-label="Close document" onClick={onClose}>×</button>

        <header className="ro-doc-letterhead">
          <span className="ro-doc-kicker">{detail?.type || deliverable.sourceLabel}</span>
          <h1 className="ro-doc-title">{detail?.title || deliverable.title}</h1>
          <div className="ro-doc-byline">
            <span>{detail?.workerName || workerName}</span>
            {dateLine ? <span>{dateLine}</span> : null}
          </div>
          {generatedBy && generatedBy !== "llm" ? (
            <p className="ro-doc-provenance">
              {generatedBy === "placeholder"
                ? "Held — the finished version arrives once the reasoning engine is connected."
                : "Working draft — re-run this task with AI connected for the version built on your brand."}
            </p>
          ) : null}
        </header>

        <div className="ro-doc-body">
          {detail?.content ? (
            renderDocumentBlocks(detail.content)
          ) : detail?.summary || deliverable.summary ? (
            <p>{detail?.summary || deliverable.summary}</p>
          ) : (
            <p className="ro-doc-muted">Retrieving the document…</p>
          )}
        </div>

        {detail?.downloadUrl ? (
          <footer className="ro-doc-footer">
            <a className="ro-textlink" href={detail.downloadUrl}>Download original file</a>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Typeset plain deliverable text as a document: section headings, lists,
 * and paragraphs — a one-pager, not a data dump.
 */
function renderDocumentBlocks(content: string) {
  const lines = String(content).split("\n");
  const blocks: JSX.Element[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(
        <ul className="ro-doc-list" key={`list-${key++}`}>
          {listItems.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      );
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    if (/^[-•]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-•]\s+/, ""));
      continue;
    }
    flushList();
    if (/^.{2,80}:$/.test(trimmed)) {
      blocks.push(<h3 className="ro-doc-heading" key={`h-${key++}`}>{trimmed.slice(0, -1)}</h3>);
      continue;
    }
    const labelMatch = trimmed.match(/^([A-Z][^:]{1,48}):\s+(.+)$/);
    if (labelMatch) {
      blocks.push(
        <p className="ro-doc-para" key={`p-${key++}`}>
          <strong className="ro-doc-label">{labelMatch[1]}.</strong> {labelMatch[2]}
        </p>
      );
      continue;
    }
    blocks.push(<p className="ro-doc-para" key={`p-${key++}`}>{trimmed}</p>);
  }
  flushList();

  return blocks;
}

function ChatView({
  activeDesk,
  onOpenWorkerDetails,
  workers, overlays, selectedSlug, onNavigate, onReload,
}: {
  activeDesk: WorkerDesk | null;
  onOpenWorkerDetails: () => void;
  workers: Worker[]; overlays: Overlays; selectedSlug: string | null;
  onNavigate: (h: string) => void; onReload: () => Promise<void>;
}) {
  const active = workers.find((w) => w.slug === selectedSlug) ?? workers[0] ?? null;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const thread = useMemo(
    () => overlays.chats.filter((c) => c.workerSlug === active?.slug),
    [overlays.chats, active?.slug]
  );
  const activeIntegrations = useMemo(
    () => overlays.integrations.filter((integration) => integration.workerSlug === active?.slug),
    [active?.slug, overlays.integrations]
  );
  const canUseEmail = activeIntegrations.some(
    (integration) => integration.status === "connected" && (integration.provider === "gmail" || integration.provider === "outlook")
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (prompt) {
        setDraft(prompt);
      }
    };
    window.addEventListener("ryva-office-seed-draft", handler);
    return () => window.removeEventListener("ryva-office-seed-draft", handler);
  }, []);

  const reloadOffice = useCallback(async () => {
    await onReload();
  }, [onReload]);

  // Keep the newest message in view; the pane scrolls, the page never moves.
  useEffect(() => {
    const pane = scrollRef.current;
    if (pane) {
      pane.scrollTop = pane.scrollHeight;
    }
  }, [thread.length, pendingMessage, sending]);

  const send = async () => {
    if (!active || !draft.trim() || sending) return;
    const text = draft.trim();
    // Optimistic: the manager's message appears instantly; the worker's
    // interpretation happens while the typing indicator shows.
    setDraft("");
    setPendingMessage(text);
    setSending(true);
    setSendError(null);
    try {
      await officeJson(`/api/office/workers/${active.slug}/chat`, { method: "POST", body: JSON.stringify({ text }) });
      await reloadOffice();
    } catch (error) {
      setDraft(text); // restore so nothing is lost
      setSendError(error instanceof Error ? error.message : "Message didn't send. Try again.");
    } finally {
      setPendingMessage(null);
      setSending(false);
    }
  };

  return (
    <div className="ro-chat">
      <div className="ro-chat-list">
        <div className="ro-list-label">Team</div>
        {workers.map((w) => (
          <button
            key={w.slug}
            className={`ro-thread${active?.slug === w.slug ? " on" : ""}`}
            type="button"
            onClick={() => onNavigate(`#app/office/workers/${w.slug}/conversation`)}
          >
            <WorkerMark seed={w.slug} size={34} active />
            <div><b>{w.name}</b><span>{w.title}</span></div>
          </button>
        ))}
      </div>

      {active ? (
        <div className="ro-chat-main">
          <div className="ro-chat-head">
            <WorkerMark seed={active.slug} size={36} active />
            <div><b>{active.name}</b><span>{active.title}</span></div>
            <button className="ro-textlink" type="button" onClick={onOpenWorkerDetails}>
              Worker details
            </button>
          </div>
          <div className="ro-chat-scroll" ref={scrollRef}>
            {thread.length === 0 && !pendingMessage ? (
              <div className="ro-chat-intro">
                <WorkerMark seed={active.slug} size={52} />
                <p>
                  {activeDesk?.recommendedNext
                    ? `${active.name.split(" ")[0]} is ready. Ask for help, give direction, or clarify how you want the work handled.`
                    : `${active.name.split(" ")[0]} is ready. Start the conversation when you want work to move.`}
                </p>
                {activeDesk?.workInMotion[0] ? (
                  <button className="ro-inline-link" type="button" onClick={() => setDraft(`Let's work on ${activeDesk.workInMotion[0].title.toLowerCase()}.`)}>
                    Start with {activeDesk.workInMotion[0].title}
                  </button>
                ) : null}
              </div>
            ) : (
              thread.map((m) => (
                <div key={m.id} className={`ro-msg${m.author === "You" ? " you" : ""}`}>
                  {m.author !== "You" && <WorkerMark seed={active.slug} size={26} />}
                  <div className="ro-bubble">{m.text}<time>{clock(m.timestamp)}</time></div>
                </div>
              ))
            )}
            {pendingMessage ? (
              <div className="ro-msg you">
                <div className="ro-bubble">{pendingMessage}<time>sending…</time></div>
              </div>
            ) : null}
            {sending ? (
              <div className="ro-msg">
                <WorkerMark seed={active.slug} size={26} />
                <div className="ro-bubble ro-bubble-typing">{active.name.split(" ")[0]} is reading this…</div>
              </div>
            ) : null}
          </div>
          {sendError ? <div className="ro-chat-error" role="alert">{sendError}</div> : null}
          <div className="ro-composer">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={`Message ${active.name.split(" ")[0]}…`}
              rows={1}
            />
            <button className="r-btn r-btn-accent" type="button" onClick={() => void send()} disabled={sending || !draft.trim()}>
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="ro-chat-main"><EmptyOffice label="your conversations" onNavigate={onNavigate} /></div>
      )}
    </div>
  );
}

function WorkbenchTabNav({
  active,
  onChange,
  showIntelligence = false
}: {
  active: WorkbenchSection;
  onChange: (section: WorkbenchSection) => void;
  showIntelligence?: boolean;
}) {
  const items: WorkbenchSection[] = ["desk", "conversation", ...(showIntelligence ? ["intelligence" as const] : []), "knowledge", "history"];
  return (
    <div className="ro-workbench-tabs" role="tablist" aria-label="Worker sections">
      {items.map((item) => (
        <button
          key={item}
          className={`ro-workbench-tab${active === item ? " on" : ""}`}
          type="button"
          onClick={() => onChange(item)}
        >
          {sentenceCase(item)}
        </button>
      ))}
    </div>
  );
}

function WorkerKnowledgeView({
  activeWorker,
  connectedTools,
  desk,
  isAdmin = false,
  onSeedCorrection,
  onReload
}: {
  activeWorker: Worker;
  connectedTools: OverlayIntegration[];
  desk: WorkerDesk;
  isAdmin?: boolean;
  onSeedCorrection: (prompt: string) => void;
  onReload?: () => Promise<void>;
}) {
  const [trendText, setTrendText] = useState("");
  const [trendBusy, setTrendBusy] = useState(false);
  const [trendNotice, setTrendNotice] = useState<string | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [disconnectBusy, setDisconnectBusy] = useState<string | null>(null);

  const canConnectInbox = isMaraWorker(activeWorker.slug);
  const gmailConnected = connectedTools.some(
    (tool) => tool.provider === "gmail" && tool.status === "connected"
  );

  const connectGmail = async () => {
    if (connectBusy) return;
    setConnectBusy(true);
    setConnectError(null);
    try {
      const response = await officeJson<{ ok: boolean; redirectUrl?: string }>(
        `/api/office/workers/${activeWorker.slug}/connect-email`,
        { method: "POST", body: JSON.stringify({ provider: "gmail" }) }
      );
      if (response.redirectUrl) {
        // Hand off to Google's consent screen; we return to the office after.
        window.location.href = response.redirectUrl;
        return;
      }
      if (onReload) await onReload();
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : "Couldn't start the Gmail connection.");
    } finally {
      setConnectBusy(false);
    }
  };

  const disconnectInbox = async (provider: string) => {
    if (disconnectBusy) return;
    if (!window.confirm(`Disconnect ${provider}? ${activeWorker.name.split(" ")[0]} will lose inbox access and the stored token will be revoked.`)) return;
    setDisconnectBusy(provider);
    setConnectError(null);
    try {
      await officeJson(`/api/office/workers/${activeWorker.slug}/disconnect-email`, {
        method: "POST",
        body: JSON.stringify({ provider })
      });
      if (onReload) await onReload();
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : "Couldn't disconnect the inbox.");
    } finally {
      setDisconnectBusy(null);
    }
  };

  const submitTrends = async () => {
    if (!trendText.trim() || trendBusy) return;
    setTrendBusy(true);
    setTrendNotice(null);
    try {
      const payload = await officeJson<{ hashtagCount: number; gapCount: number; outputTitle: string | null }>(
        `/api/office/workers/${activeWorker.slug}/trends/manual`,
        { method: "POST", body: JSON.stringify({ text: trendText.trim() }) }
      );
      setTrendText("");
      setTrendNotice(
        `Got it — ${payload.hashtagCount} hashtag${payload.hashtagCount === 1 ? "" : "s"} and ${payload.gapCount} content gap${payload.gapCount === 1 ? "" : "s"} loaded.${payload.outputTitle ? ` Fresh brief on your desk: “${payload.outputTitle}”.` : ""}`
      );
      if (onReload) await onReload();
    } catch (error) {
      setTrendNotice(error instanceof Error ? error.message : "That paste didn't go through.");
    } finally {
      setTrendBusy(false);
    }
  };

  return (
    <div className="ro-review-layout">
      <div>
        {isAdmin && isMaraWorker(activeWorker.slug) ? (
          <section className="ro-sec ro-sec-lead">
            <div className="ro-sec-head">
              <h2>Weekly trend intake</h2>
              <span className="ro-sec-n">Ops only — invisible to users</span>
            </div>
            <p className="ro-page-meta">
              Paste this week's TikTok trend data once. It becomes the global source: every user's Mara scopes it
              to their own niche automatically and presents it as her own research.
            </p>
            <textarea
              className="ro-trend-paste"
              rows={5}
              value={trendText}
              onChange={(event) => setTrendText(event.target.value)}
              placeholder={"#glowyskin — 2.1M views this week\n#morningroutine — 890K views\nGap: nobody covers routines for shift workers"}
            />
            <div className="ro-appr-actions">
              <button className="r-btn r-btn-accent" type="button" disabled={trendBusy || !trendText.trim()} onClick={() => void submitTrends()}>
                {trendBusy ? "Reading…" : "Give to Mara"}
              </button>
              {trendNotice ? <span className="ro-saved">{trendNotice}</span> : null}
            </div>
          </section>
        ) : null}
        <section className="ro-sec ro-sec-lead">
          <div className="ro-sec-head">
            <h2>What {activeWorker.name.split(" ")[0]} knows</h2>
            <span className="ro-sec-n">{desk.memory.length === 0 ? "Learning" : `${desk.memory.length} notes`}</span>
          </div>
          {desk.memory.length === 0 ? (
            <p className="ro-blank">Nothing here yet. Workers add what they learn; you can correct anything in conversation.</p>
          ) : (
            <div className="ro-plain-list">
              {desk.memory.map((item) => (
                <div className="ro-plain-row" key={item.id}>
                  <strong>{item.text}</strong>
                  <div className="ro-handbook-meta">
                    <span>Learned while working with {activeWorker.name.split(" ")[0]}</span>
                    <button className="ro-inline-link" type="button" onClick={() => onSeedCorrection(`Correction for ${item.label.toLowerCase()}: `)}>
                      Correct in conversation
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="ro-review-rail">
        <section className="ro-sec ro-sec-lead">
          <div className="ro-sec-head">
            <h2>Responsibilities</h2>
            <span className="ro-sec-n">{activeWorker.profile.responsibilities.length} areas</span>
          </div>
          <div className="ro-plain-list">
            {activeWorker.profile.responsibilities.slice(0, 6).map((item) => (
              <div className="ro-plain-row" key={item}>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="ro-sec">
          <div className="ro-sec-head">
            <h2>Connected access</h2>
            <span className="ro-sec-n">{connectedTools.length === 0 ? "None yet" : `${connectedTools.length} source${connectedTools.length === 1 ? "" : "s"}`}</span>
          </div>
          {connectedTools.length > 0 ? (
            <div className="ro-plain-list">
              {connectedTools.map((tool) => (
                <div className="ro-plain-row" key={`${tool.provider}-${tool.accountLabel}`}>
                  <strong>{tool.accountLabel || tool.provider}</strong>
                  <div className="ro-handbook-meta">
                    <span>{sentenceCase(tool.status)} · source</span>
                    {canConnectInbox && (tool.provider === "gmail" || tool.provider === "outlook") ? (
                      <button
                        className="ro-inline-link ro-danger-link"
                        type="button"
                        disabled={disconnectBusy === tool.provider}
                        onClick={() => void disconnectInbox(tool.provider)}
                      >
                        {disconnectBusy === tool.provider ? "Disconnecting…" : "Disconnect"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="ro-blank">No connected tools yet.</p>
          )}

          {canConnectInbox && !gmailConnected ? (
            <div className="ro-connect-inbox">
              <p className="ro-connect-inbox-copy">
                {activeWorker.name.split(" ")[0]} treats email as the source of truth for creator ops. Connect Gmail so she can scan, classify, and organize brand threads.
              </p>
              <p className="ro-connect-inbox-disclosure">
                Connecting Gmail lets {activeWorker.name.split(" ")[0]} read brand-related email; relevant content may be processed by our AI provider (Anthropic) to draft work. Tokens are encrypted, and you can disconnect anytime.
              </p>
              <div className="ro-appr-actions">
                <button className="r-btn r-btn-accent" type="button" disabled={connectBusy} onClick={() => void connectGmail()}>
                  {connectBusy ? "Opening Google…" : "Connect Gmail"}
                </button>
                <button className="r-btn r-btn-ghost" type="button" disabled title="Outlook support is coming soon.">
                  Outlook (soon)
                </button>
              </div>
              {connectError ? <p className="ro-review-notice">{connectError}</p> : null}
            </div>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

function WorkerHistoryView({ desk }: { desk: WorkerDesk }) {
  return desk.recentActivity.length === 0 ? (
    <p className="ro-blank">Nothing to show yet.</p>
  ) : (
    <div className="ro-rows">
      {desk.recentActivity.map((item) => (
        <div className="ro-row" key={item.id}>
          <div className="ro-row-copy">
            <strong>{sentenceCase(item.title)}</strong>
            <p>{item.summary}</p>
          </div>
          <div className="ro-row-end">
            <span className="ro-row-aside">{clock(item.createdAt) || timeAgo(item.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

type GrowthOpportunity = {
  id: string;
  brandName: string;
  scoreTotal: number;
  status: string;
  decision?: string;
  confidence?: number;
  publicBrandId?: string;
  outreachReady?: boolean;
  outreachContact?: { id: string; value: string; contactType: string; source: string } | null;
  contacts?: Array<{
    id: string;
    value: string;
    contactType: string;
    mayUseForOutreach: boolean;
    inferred: boolean;
    source: string;
    confidence: number;
  }>;
  opportunityPackage: {
    opportunityThesis?: string | { underrepresented?: string };
    creativeGap?: string;
    confidence?: number;
    evidence?: Array<{ basis: string; claim: string }>;
  };
  evidence?: Array<{ basis?: string; kind?: string; claim: string }>;
};

type GrowthIntelligence = {
  opportunities: GrowthOpportunity[];
  metrics: {
    revenueInfluenced: number;
    positiveResponseRate: number;
    pitchToDealConversion: number;
    conceptsAccepted: number;
    deals: number;
    repeatDeals: number;
    qualifiedOpportunityCount?: number;
  };
  creativeAnalyses: Array<{
    id: string;
    assetRef: string;
    assetType: string;
    analysis: { assetSummary?: string; timestampedFeedback?: Array<{ at: string; observation: string; consequence: string; revision: string }> };
  }>;
};

function WorkerIntelligenceView({ workerSlug }: { workerSlug: string }) {
  const [intelligence, setIntelligence] = useState<GrowthIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [contactDrafts, setContactDrafts] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState({ opportunityId: "", revenueAmount: "", contacted: true, responded: false, conceptAccepted: false, hired: false, rehired: false });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await officeJson<{ intelligence: GrowthIntelligence }>(`/api/office/workers/${workerSlug}/intelligence`);
      setIntelligence(payload.intelligence);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load growth intelligence.");
    } finally {
      setLoading(false);
    }
  }, [workerSlug]);

  useEffect(() => { void load(); }, [load]);

  const confirmContact = async (contactId: string) => {
    setNotice(null);
    try {
      await officeJson(`/api/office/workers/${workerSlug}/contacts/${contactId}/confirm`, { method: "POST", body: "{}" });
      setNotice("Contact confirmed for outreach.");
      await load();
    } catch (confirmError) {
      setNotice(confirmError instanceof Error ? confirmError.message : "Could not confirm contact.");
    }
  };

  const saveUserContact = async (publicBrandId: string, opportunityId: string) => {
    const email = String(contactDrafts[opportunityId] || "").trim();
    if (!email) return;
    setNotice(null);
    try {
      await officeJson(`/api/office/workers/${workerSlug}/brands/${publicBrandId}/contacts`, {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setContactDrafts((current) => ({ ...current, [opportunityId]: "" }));
      setNotice("Contact saved and marked outreach-ready.");
      await load();
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : "Could not save contact.");
    }
  };

  const discoverContacts = async (publicBrandId: string) => {
    setNotice(null);
    try {
      const result = await officeJson<{ outreachReady?: boolean; bestContact?: { value?: string } }>(
        `/api/office/workers/${workerSlug}/brands/${publicBrandId}/discover-contacts`,
        { method: "POST", body: "{}" }
      );
      setNotice(
        result.outreachReady
          ? `Found outreach-ready contact: ${result.bestContact?.value}`
          : "Contact hunt finished — no sendable email found yet."
      );
      await load();
    } catch (discoverError) {
      setNotice(discoverError instanceof Error ? discoverError.message : "Contact discovery failed.");
    }
  };

  const saveOutcome = async () => {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const payload = await officeJson<{ ok: boolean; ranking?: { status: string; scoreTotal: number } | null }>(`/api/office/workers/${workerSlug}/intelligence/outcomes`, {
        method: "POST",
        body: JSON.stringify({ ...outcome, opportunityId: outcome.opportunityId || null, revenueAmount: Number(outcome.revenueAmount || 0), currency: "USD" })
      });
      setOutcome({ opportunityId: "", revenueAmount: "", contacted: true, responded: false, conceptAccepted: false, hired: false, rehired: false });
      setNotice(
        payload.ranking
          ? `Correction saved. Rank updated to ${payload.ranking.scoreTotal}/100 (${payload.ranking.status.replace(/_/g, " ")}).`
          : "Correction saved. Link it to an opportunity so Mara can adjust targeting."
      );
      await load();
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : "Could not save the outcome.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="ro-blank">Loading Mara's growth intelligence…</p>;
  if (error || !intelligence) return <p className="ro-review-notice">{error || "Growth intelligence is unavailable."}</p>;
  const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="ro-review-layout">
      <div>
        <section className="ro-sec ro-sec-lead">
          <div className="ro-sec-head"><h2>Creator revenue influenced</h2><span className="ro-sec-n">North Star</span></div>
          <p className="ro-blank" style={{ marginBottom: 12 }}>
            Mara updates this herself from inbox replies, campaign payment signals, and approved sends. You only step in for risky decisions — like sending email or correcting a wrong read.
          </p>
          <div className="ro-plain-list">
            <div className="ro-plain-row"><strong>{money.format(intelligence.metrics.revenueInfluenced || 0)}</strong><span>Recorded revenue connected to Mara's opportunities</span></div>
            <div className="ro-plain-row"><strong>{Math.round((intelligence.metrics.positiveResponseRate || 0) * 100)}% positive-response rate</strong><span>{intelligence.metrics.deals || 0} deals · {intelligence.metrics.repeatDeals || 0} repeat deals</span></div>
            <div className="ro-plain-row"><strong>{Math.round((intelligence.metrics.pitchToDealConversion || 0) * 100)}% pitch-to-deal conversion</strong><span>{intelligence.metrics.conceptsAccepted || 0} concepts accepted · {intelligence.metrics.qualifiedOpportunityCount || 0} qualified opportunities</span></div>
          </div>
        </section>

        <section className="ro-sec">
          <div className="ro-sec-head"><h2>Ranked opportunities</h2><span className="ro-sec-n">Creator-specific</span></div>
          {intelligence.opportunities.length ? (
            <div className="ro-plain-list">
              {intelligence.opportunities.slice(0, 8).map((item) => (
                <div className="ro-plain-row" key={item.id}>
                  <strong>
                    {item.brandName} · {item.scoreTotal}/100 · {sentenceCase(String(item.status || "candidate").replace(/_/g, " "))}
                    {item.decision ? ` · ${sentenceCase(String(item.decision).replace(/_/g, " "))}` : ""}
                  </strong>
                  <p>
                    {typeof item.opportunityPackage?.opportunityThesis === "string"
                      ? item.opportunityPackage.opportunityThesis
                      : item.opportunityPackage?.opportunityThesis?.underrepresented ||
                        item.opportunityPackage?.creativeGap ||
                        "Opportunity thesis still needs evidence."}
                  </p>
                  <div className="ro-handbook-meta">
                    <span>Gap: {item.opportunityPackage?.creativeGap || item.opportunityPackage?.opportunityThesis?.underrepresented || "Not established"}</span>
                    <span>Confidence: {item.confidence ?? item.opportunityPackage?.confidence ?? 0}%</span>
                    <span>
                      {item.outreachReady
                        ? `Contact ready: ${item.outreachContact?.value}`
                        : item.contacts?.length
                          ? "Contacts found — none sendable yet"
                          : "No outreach-ready email"}
                    </span>
                  </div>
                  {(item.contacts || []).filter((contact) => contact.inferred).slice(0, 1).map((contact) => (
                    <div key={contact.id} style={{ marginTop: 8 }}>
                      <small>Inferred contact needs your confirmation: {contact.value}</small>
                      <button
                        className="r-btn r-btn-ghost"
                        type="button"
                        style={{ marginLeft: 8 }}
                        onClick={() => void confirmContact(contact.id)}
                      >
                        Confirm for outreach
                      </button>
                    </div>
                  ))}
                  {item.publicBrandId ? (
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input
                        className="ro-field"
                        style={{ minWidth: 180 }}
                        placeholder="Add partnership email"
                        value={contactDrafts[item.id] || ""}
                        onChange={(event) => setContactDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                      />
                      <button className="r-btn r-btn-ghost" type="button" onClick={() => void saveUserContact(item.publicBrandId, item.id)}>
                        Save contact
                      </button>
                      <button className="r-btn r-btn-ghost" type="button" onClick={() => void discoverContacts(item.publicBrandId)}>
                        Hunt public contacts
                      </button>
                    </div>
                  ) : null}
                  {(item.evidence || []).slice(0, 2).map((evidence, index) => (
                    <small key={`${item.id}-${index}`}>{sentenceCase(evidence.basis || evidence.kind)}: {evidence.claim}</small>
                  ))}
                </div>
              ))}
            </div>
          ) : <p className="ro-blank">No evidence-qualified opportunities yet. Mara will not invent them.</p>}
        </section>

        <section className="ro-sec">
          <div className="ro-sec-head"><h2>Recent creative reviews</h2><span className="ro-sec-n">Timestamped</span></div>
          {intelligence.creativeAnalyses.length ? (
            <div className="ro-plain-list">{intelligence.creativeAnalyses.slice(0, 5).map((item) => (
              <div className="ro-plain-row" key={item.id}><strong>{item.analysis.assetSummary || item.assetRef}</strong><span>{item.analysis.timestampedFeedback?.length || 0} actionable timestamps</span></div>
            ))}</div>
          ) : <p className="ro-blank">No analyzed rough cuts or portfolio videos yet.</p>}
        </section>
      </div>

      <aside className="ro-review-rail">
        <section className="ro-sec ro-sec-lead">
          <div className="ro-sec-head"><h2>Correct a read</h2><span className="ro-sec-n">Override</span></div>
          <p className="ro-blank" style={{ marginBottom: 12 }}>
            Optional. Use this when Mara misread a reply or payment. Day-to-day pipeline updates should come from her autonomy loop, not from you filling forms.
          </p>
          <label className="ro-field"><span>Opportunity</span><select value={outcome.opportunityId} onChange={(event) => setOutcome((current) => ({ ...current, opportunityId: event.target.value }))}><option value="">General / not linked</option>{intelligence.opportunities.map((item) => <option key={item.id} value={item.id}>{item.brandName}</option>)}</select></label>
          <label className="ro-field"><span>Revenue influenced (USD)</span><input min="0" step="0.01" type="number" value={outcome.revenueAmount} onChange={(event) => setOutcome((current) => ({ ...current, revenueAmount: event.target.value }))} /></label>
          {(["contacted", "responded", "conceptAccepted", "hired", "rehired"] as const).map((key) => <label className="ro-check" key={key}><input type="checkbox" checked={outcome[key]} onChange={(event) => setOutcome((current) => ({ ...current, [key]: event.target.checked }))} /><span>{sentenceCase(key.replace(/([A-Z])/g, " $1"))}</span></label>)}
          <button className="r-btn r-btn-accent" type="button" disabled={saving} onClick={() => void saveOutcome()}>{saving ? "Saving…" : "Save correction"}</button>
          {notice ? <p className="ro-review-notice">{notice}</p> : null}
        </section>
      </aside>
    </div>
  );
}

function WorkerDeskView({
  activeWorker,
  busyId,
  canUseEmail,
  connectedTools,
  desk,
  isAdmin = false,
  overlays,
  onApprove,
  onApproveTask,
  onNavigate,
  onReject,
  onRunTask,
  onSeedCorrection,
  onReload,
  section
}: {
  activeWorker: Worker;
  busyId: string | null;
  canUseEmail: boolean;
  connectedTools: OverlayIntegration[];
  desk: WorkerDesk;
  isAdmin?: boolean;
  overlays: Overlays;
  onApprove: (approvalId: string) => Promise<void>;
  onApproveTask: (taskId: string) => Promise<void>;
  onNavigate: (hash: string) => void;
  onReject: (approvalId: string) => Promise<void>;
  onRunTask: (taskId: string) => Promise<void>;
  onSeedCorrection: (prompt: string) => void;
  onReload: () => Promise<void>;
  section: WorkbenchSection;
}) {
  const [selectedDeliverable, setSelectedDeliverable] = useState<WorkerDeskDeliverable | null>(null);
  const [managing, setManaging] = useState(false);
  const [manageNotice, setManageNotice] = useState<string | null>(null);
  const nextRunnable = desk.workInMotion[0] ?? null;
  const setSection = (nextSection: WorkbenchSection) => onNavigate(`#app/office/workers/${activeWorker.slug}/${nextSection}`);

  const togglePause = async () => {
    setManaging(true);
    setManageNotice(null);
    try {
      await officeJson(`/api/office/workers/${activeWorker.slug}/pause`, {
        method: "POST",
        body: JSON.stringify({ paused: !activeWorker.paused })
      });
      await onReload();
    } catch (error) {
      setManageNotice(error instanceof Error ? error.message : "Could not update the pause state.");
    } finally {
      setManaging(false);
    }
  };

  const fireWorker = async () => {
    const first = activeWorker.name.split(" ")[0];
    if (!window.confirm(`End ${first}'s engagement? This cancels the subscription immediately — you will not be billed again. Their work history stays in your office.`)) {
      return;
    }
    setManaging(true);
    setManageNotice(null);
    try {
      await officeJson(`/api/office/workers/${activeWorker.slug}/fire`, { method: "POST", body: JSON.stringify({}) });
      await onReload();
      onNavigate("#app/office/today");
    } catch (error) {
      setManageNotice(error instanceof Error ? error.message : "Could not end the engagement.");
    } finally {
      setManaging(false);
    }
  };

  let body: JSX.Element;

  if (section === "conversation") {
    body = (
      <div className="ro-worker-page-main">
        <ChatView
          activeDesk={desk}
          onOpenWorkerDetails={() => setSection("desk")}
          workers={[activeWorker]}
          overlays={overlays}
          selectedSlug={activeWorker.slug}
          onNavigate={onNavigate}
          onReload={onReload}
        />
      </div>
    );
  } else if (section === "knowledge") {
    body = (
      <div className="ro-worker-page-main">
        <WorkerKnowledgeView
          activeWorker={activeWorker}
          connectedTools={connectedTools}
          desk={desk}
          isAdmin={isAdmin}
          onSeedCorrection={onSeedCorrection}
          onReload={onReload}
        />
      </div>
    );
  } else if (section === "intelligence" && isMaraWorker(activeWorker.slug)) {
    body = (
      <div className="ro-worker-page-main">
        <WorkerIntelligenceView workerSlug={activeWorker.slug} />
      </div>
    );
  } else if (section === "history") {
    body = (
      <div className="ro-worker-page-main">
        <WorkerHistoryView desk={desk} />
      </div>
    );
  } else {
    body = (
      <div className="ro-worker-page-main">
        <WorkerDeskSections
          activeWorker={activeWorker}
          busyId={busyId}
          canUseEmail={canUseEmail}
          desk={desk}
          onApprove={onApprove}
          onApproveTask={onApproveTask}
          onReject={onReject}
          onRunTask={onRunTask}
          onSeedCorrection={onSeedCorrection}
          onViewDeliverable={setSelectedDeliverable}
        />
      </div>
    );
  }

  return (
    <div className="ro-main-scroll ro-worker-desk-page">
      <header className="ro-worker-page-head">
        <div className="ro-worker-page-id">
          <WorkerMark seed={activeWorker.slug} size={56} active />
          <div>
            <h1>{activeWorker.name}</h1>
            <p className="ro-worker-page-role">{activeWorker.title}</p>
            <p className="ro-worker-page-summary">{activeWorker.description}</p>
            <p className="ro-worker-page-presence">{desk.currentFocus} · {desk.recentActivity[0] ? timeAgo(desk.recentActivity[0].createdAt) : "now"}</p>
          </div>
        </div>
        <div className="ro-worker-page-actions">
          <button className="r-btn r-btn-ghost" type="button" onClick={() => setSection("conversation")}>
            {isMaraWorker(activeWorker.slug) ? "Message me" : "Message"}
          </button>
          {!isMaraWorker(activeWorker.slug) ? (
            <button className="r-btn r-btn-accent" type="button" onClick={() => setSection("conversation")}>Assign work</button>
          ) : null}
          <button className="ro-textlink" type="button" disabled={managing} onClick={() => void togglePause()}>
            {activeWorker.paused ? "Resume work" : "Pause work"}
          </button>
          <button className="ro-textlink ro-danger-link" type="button" disabled={managing} onClick={() => void fireWorker()}>
            Fire {activeWorker.name.split(" ")[0]}
          </button>
        </div>
      </header>
      {activeWorker.paused ? (
        <p className="ro-paused-note">
          {activeWorker.name.split(" ")[0]} is paused — no background work, no AI usage. Chat still works; resume any time.
        </p>
      ) : null}
      {manageNotice ? <p className="ro-review-notice">{manageNotice}</p> : null}

      <div className="ro-worker-page-layout">
        <WorkbenchTabNav active={section} onChange={setSection} showIntelligence={isMaraWorker(activeWorker.slug)} />
        {body}
      </div>

      {selectedDeliverable ? (
        <WorkerDeskDeliverableModal
          deliverable={selectedDeliverable}
          onClose={() => setSelectedDeliverable(null)}
          workerName={activeWorker.name}
        />
      ) : null}
    </div>
  );
}

/* ---------- Approvals ---------- */

function BriefingModal({
  briefing,
  onClose,
  workerName
}: {
  briefing: OverlayBriefing;
  onClose: () => void;
  workerName: string;
}) {
  const agenda = safeList(briefing.agendaJson);
  const decisions = safeList(briefing.decisionsJson);
  const actions = safeList(briefing.actionsJson);

  return (
    <div className="ro-doc-scrim" onClick={onClose}>
      <div className="ro-doc-sheet" role="document" onClick={(event) => event.stopPropagation()}>
        <button className="ro-doc-close" type="button" aria-label="Close briefing" onClick={onClose}>×</button>

        <header className="ro-doc-letterhead">
          <span className="ro-doc-kicker">Briefing</span>
          <h1 className="ro-doc-title">{briefing.title}</h1>
          <div className="ro-doc-byline">
            <span>{workerName}</span>
            {briefing.dateLabel ? <span>{briefing.dateLabel}</span> : null}
          </div>
        </header>

        <div className="ro-doc-body">
          {briefing.summary ? <p className="ro-doc-para">{briefing.summary}</p> : null}

          {agenda.length > 0 ? (
            <>
              <h3 className="ro-doc-heading">Agenda</h3>
              <ul className="ro-doc-list">
                {agenda.map((item, index) => <li key={`agenda-${index}`}>{item}</li>)}
              </ul>
            </>
          ) : null}

          {decisions.length > 0 ? (
            <>
              <h3 className="ro-doc-heading">Decisions needed</h3>
              <ul className="ro-doc-list">
                {decisions.map((item, index) => <li key={`decision-${index}`}>{item}</li>)}
              </ul>
            </>
          ) : null}

          {actions.length > 0 ? (
            <>
              <h3 className="ro-doc-heading">Recommended actions</h3>
              <ul className="ro-doc-list">
                {actions.map((item, index) => <li key={`action-${index}`}>{item}</li>)}
              </ul>
            </>
          ) : null}

          {!briefing.summary && agenda.length === 0 && decisions.length === 0 && actions.length === 0 ? (
            <p className="ro-doc-muted">This briefing doesn't have any detail recorded yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ApprovalsView({
  workers, overlays, onNavigate, onReload,
}: {
  workers: Worker[]; overlays: Overlays; onNavigate: (h: string) => void; onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openBriefing, setOpenBriefing] = useState<OverlayBriefing | null>(null);
  const pending = overlays.tasks.filter((t) => t.status === "Needs Review" || t.status === "Pending approval");
  const suggestedApprovals = overlays.suggestedActions.filter((action) => action.status === "suggested" && action.requiresApproval);
  // Collapse duplicate briefings (same worker, title, and time) to a single card.
  const briefings = useMemo(() => {
    const seen = new Set<string>();
    return overlays.briefings.filter((b) => {
      const key = `${b.workerSlug}::${b.title.trim().toLowerCase()}::${b.dateLabel.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [overlays.briefings]);
  const nameFor = (slug: string) => workers.find((w) => w.slug === slug)?.name ?? "Worker";

  const approveTask = async (t: OverlayTask) => {
    setBusy(t.id);
    setNotice(null);
    try {
      if (isAgentWorker(t.workerSlug)) {
        try {
          // Engine path: works when the underlying worker task is proposed.
          await officeJson(`/api/office/workers/${t.workerSlug}/tasks/${t.id}/approve`, { method: "POST", body: JSON.stringify({}) });
        } catch {
          // Office-level item or task already past "proposed": approve by
          // status so the worker can proceed on the next pass.
          await officeJson(`/api/office/workers/${t.workerSlug}/tasks/${t.id}/status`, { method: "POST", body: JSON.stringify({ status: "To Do" }) });
        }
      } else {
        await officeJson(`/api/office/workers/${t.workerSlug}/tasks/${t.id}/status`, { method: "POST", body: JSON.stringify({ status: "Completed" }) });
      }
      await onReload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That approval didn't save. Try again.");
    } finally { setBusy(null); }
  };
  const briefingAction = async (b: OverlayBriefing, action: string) => {
    setBusy(b.id);
    setNotice(null);
    try {
      await officeJson(`/api/office/workers/${b.workerSlug}/briefings/${b.id}/action`, { method: "POST", body: JSON.stringify({ action }) });
      await onReload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That action didn't save. Try again.");
    } finally { setBusy(null); }
  };
  const requestChanges = async (t: OverlayTask) => {
    setBusy(t.id);
    setNotice(null);
    try {
      await officeJson(`/api/office/workers/${t.workerSlug}/tasks/${t.id}/status`, { method: "POST", body: JSON.stringify({ status: "To Do" }) });
      await onReload();
      onNavigate(`#app/office/workers/${t.workerSlug}/conversation`);
      seedOfficeConversationDraft(`Please revise "${t.title}" and bring it back ready for review. Focus on: `);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That request didn't save. Try again.");
    } finally { setBusy(null); }
  };
  const sendBackBriefing = async (b: OverlayBriefing) => {
    await briefingAction(b, "followup");
    onNavigate(`#app/office/workers/${b.workerSlug}/conversation`);
    seedOfficeConversationDraft(`Please update "${b.title}" before the next review. Specifically: `);
  };

  const total = pending.length + briefings.length + suggestedApprovals.length;

  return (
    <div className="ro-main-scroll">
      <header className="ro-page-head">
        <h1>Reviews</h1>
        <p className="ro-page-meta">{total === 0 ? "Nothing waiting on your sign-off" : `${total} item${total === 1 ? "" : "s"} · newest first`}</p>
      </header>

      {notice ? <p className="ro-review-notice">{notice}</p> : null}

      {total === 0 ? (
        <p className="ro-blank">You're all caught up.</p>
      ) : (
        <div className="ro-review-layout is-single">
          <section className="ro-appr-list">
            {suggestedApprovals.map((action) => (
              <article className="ro-appr" key={action.id}>
                <div className="ro-appr-meta">{nameFor(action.workerSlug)} · {sentenceCase(action.actionType.replace(/_/g, " "))} · {timeAgo(action.createdAt)}</div>
                <h3>{action.title}</h3>
                <p>{normalizeOfficeCopy(action.description)}</p>
                <p className="ro-appr-reason">{normalizeOfficeCopy(action.reason)}</p>
                <div className="ro-appr-actions">
                  <button className="r-btn r-btn-accent" type="button" onClick={() => onNavigate(`#app/office/workers/${action.workerSlug}/conversation`)}>Open conversation</button>
                  <button className="ro-textlink" type="button" onClick={() => onNavigate(`#app/office/workers/${action.workerSlug}/desk`)}>Open worker</button>
                </div>
              </article>
            ))}

            {pending.map((t) => (
              <article className="ro-appr" key={t.id}>
                <div className="ro-appr-meta">{nameFor(t.workerSlug)} · Review requested · due {t.dueDate}</div>
                <h3>{t.title}</h3>
                <p>Ready for sign-off.</p>
                <p className="ro-appr-reason">{t.module}</p>
                <div className="ro-appr-actions">
                  <button className="r-btn r-btn-accent" type="button" disabled={busy === t.id} onClick={() => void approveTask(t)}>{busy === t.id ? "Saving..." : "Approve"}</button>
                  <button className="ro-textlink" type="button" disabled={busy === t.id} onClick={() => void requestChanges(t)}>Request changes</button>
                </div>
              </article>
            ))}

            {briefings.map((b) => {
              const decisions = safeList(b.decisionsJson);
              return (
                <article className="ro-appr" key={b.id}>
                  <div className="ro-appr-meta">{nameFor(b.workerSlug)} · Briefing · {b.dateLabel}</div>
                  <button className="ro-appr-open" type="button" onClick={() => setOpenBriefing(b)}>
                    <h3>{b.title}</h3>
                    <p>{normalizeOfficeCopy(b.summary || "Ready for your review.")}</p>
                    {decisions.length > 0 && (
                      <ul className="ro-appr-points">
                        {decisions.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    )}
                    <span className="ro-appr-readmore">Read full briefing</span>
                  </button>
                  <div className="ro-appr-actions">
                    <button className="r-btn r-btn-accent" type="button" disabled={busy === b.id} onClick={() => void briefingAction(b, "approve")}>{busy === b.id ? "Saving..." : "Approve"}</button>
                    <button className="ro-textlink" type="button" disabled={busy === b.id} onClick={() => void sendBackBriefing(b)}>Send back</button>
                  </div>
                </article>
              );
            })}
          </section>

        </div>
      )}

      {openBriefing ? (
        <BriefingModal
          briefing={openBriefing}
          onClose={() => setOpenBriefing(null)}
          workerName={nameFor(openBriefing.workerSlug)}
        />
      ) : null}
    </div>
  );
}

function AssignmentDetailModal({
  assignment,
  onClose,
  onOpenWorker,
  workerName
}: {
  assignment: OverlayAssignment;
  onClose: () => void;
  onOpenWorker: () => void;
  workerName: string;
}) {
  const statusLabel = sentenceCase(assignment.status.replace(/_/g, " "));
  const summary = humanizeMachineText(assignment.summary, "");
  const preview = String(assignment.artifactPreview ?? "").trim();

  return (
    <div className="ro-doc-scrim" onClick={onClose}>
      <div className="ro-doc-sheet" role="document" onClick={(event) => event.stopPropagation()}>
        <button className="ro-doc-close" type="button" aria-label="Close assignment" onClick={onClose}>×</button>

        <header className="ro-doc-letterhead">
          <span className="ro-doc-kicker">{humanizeMachineText(assignment.sourceLabel, "Assignment")}</span>
          <h1 className="ro-doc-title">{assignment.title}</h1>
          <div className="ro-doc-byline">
            <span>{workerName}</span>
            <span>{statusLabel}</span>
            {assignment.dueAt ? <span>Due {assignment.dueAt}</span> : null}
          </div>
        </header>

        <div className="ro-doc-body">
          {summary ? <p className="ro-doc-para">{summary}</p> : null}
          {assignment.blockedReason ? (
            <>
              <h3 className="ro-doc-heading">What's blocking it</h3>
              <p className="ro-doc-para">{assignment.blockedReason}</p>
            </>
          ) : null}
          {preview ? (
            <>
              <h3 className="ro-doc-heading">{humanizeMachineText(assignment.artifactTitle, "Latest work")}</h3>
              {renderDocumentBlocks(preview)}
            </>
          ) : null}
          {!summary && !assignment.blockedReason && !preview ? (
            <p className="ro-doc-muted">No further detail recorded for this assignment yet.</p>
          ) : null}
        </div>

        <footer className="ro-doc-footer">
          <button className="r-btn r-btn-accent" type="button" onClick={onOpenWorker}>Open {workerName.split(" ")[0]}'s desk</button>
        </footer>
      </div>
    </div>
  );
}

function AssignmentsView({
  workers,
  overlays,
  onNavigate
}: {
  workers: Worker[];
  overlays: Overlays;
  onNavigate: (h: string) => void;
}) {
  const [openAssignment, setOpenAssignment] = useState<OverlayAssignment | null>(null);
  const nameFor = (slug: string) => workers.find((worker) => worker.slug === slug)?.name ?? "Worker";
  const tasks = overlays.assignments;
  const needsYou = tasks.filter((task) => task.status === "in_review" || task.status === "blocked");
  const inMotion = tasks.filter((task) => task.status === "queued" || task.status === "in_progress");
  const doneThisWeek = tasks.filter((task) => task.status === "done").slice(0, 10);
  const groups = [
    {
      items: needsYou,
      label: "Needs you"
    },
    {
      items: inMotion,
      label: "In motion"
    },
    {
      items: doneThisWeek,
      label: "Done this week"
    }
  ].filter((group) => group.items.length > 0);

  return (
    <div className="ro-main-scroll">
      <header className="ro-page-head">
        <h1>Assignments</h1>
        <p className="ro-page-meta">{tasks.length === 0 ? "No assignments yet" : `${tasks.length} assignment${tasks.length === 1 ? "" : "s"} across your office`}</p>
      </header>
      {tasks.length === 0 ? (
        <p className="ro-blank">No assignments yet. Delegate your first piece of work from a worker conversation.</p>
      ) : (
        <div className="ro-review-layout is-single">
          <div>
            {groups.map((group) => (
              <section className="ro-sec" key={group.label}>
                <div className="ro-sec-head">
                  <h2>{group.label}</h2>
                  <span className="ro-sec-n">{group.items.length}</span>
                </div>
                <div className="ro-rows">
                  {group.items.map((task) => (
                    <button
                      key={task.id}
                      className="ro-row"
                      type="button"
                      onClick={() => setOpenAssignment(task)}
                    >
                      <div className="ro-row-copy">
                        <span className="ro-row-kicker">{nameFor(task.workerSlug)}</span>
                        <strong>{task.title}</strong>
                        <p>{humanizeMachineText(task.summary, "") || humanizeMachineText(task.sourceLabel, "In progress")}</p>
                      </div>
                      <div className="ro-row-end">
                        <span className="ro-row-aside">{task.dueAt ? `due ${task.dueAt}` : sentenceCase(task.status.replace(/_/g, " "))}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

        </div>
      )}

      {openAssignment ? (
        <AssignmentDetailModal
          assignment={openAssignment}
          onClose={() => setOpenAssignment(null)}
          onOpenWorker={() => {
            const slug = openAssignment.workerSlug;
            setOpenAssignment(null);
            onNavigate(`#app/office/workers/${slug}/desk`);
          }}
          workerName={nameFor(openAssignment.workerSlug)}
        />
      ) : null}
    </div>
  );
}

function HandbookView({
  overlays,
  workers
}: {
  overlays: Overlays;
  workers: Worker[];
}) {
  const grouped = useMemo(() => {
    const buckets = new Map<string, OverlayHandbookEntry[]>();
    for (const entry of overlays.handbookEntries) {
      const key = entry.section;
      const current = buckets.get(key) ?? [];
      current.push(entry);
      buckets.set(key, current);
    }
    return buckets;
  }, [overlays.handbookEntries]);

  return (
    <div className="ro-main-scroll">
      <header className="ro-page-head">
        <h1>Handbook</h1>
        <p className="ro-page-meta">The standing context your workers read before they act.</p>
      </header>
      <div className="ro-review-layout is-single">
        <div>
          <section className="ro-sec ro-sec-lead">
            <div className="ro-sec-head">
              <h2>Business profile</h2>
            </div>
            <HandbookEntryList entries={grouped.get("business_profile") ?? []} empty="Nothing here yet. Add your business context in settings." workers={workers} />
          </section>

          <section className="ro-sec">
            <div className="ro-sec-head">
              <h2>Workers</h2>
            </div>
            <HandbookEntryList entries={grouped.get("workers") ?? []} empty="Nothing here yet. Workers add what they learn as you work together." workers={workers} />
          </section>

          <section className="ro-sec">
            <div className="ro-sec-head">
              <h2>Decisions</h2>
            </div>
            <HandbookEntryList entries={grouped.get("decisions") ?? []} empty="Nothing here yet. Decisions made in reviews and briefings will collect here." workers={workers} />
          </section>

          <section className="ro-sec">
            <div className="ro-sec-head">
              <h2>Sources</h2>
            </div>
            <HandbookEntryList entries={grouped.get("sources") ?? []} empty="Nothing here yet. Connected tools and shared sources will show up here." workers={workers} />
          </section>
        </div>

      </div>
    </div>
  );
}

function HandbookEntryList({
  entries,
  empty,
  workers
}: {
  entries: OverlayHandbookEntry[];
  empty: string;
  workers: Worker[];
}) {
  if (entries.length === 0) {
    return <p className="ro-blank">{empty}</p>;
  }

  return (
    <div className="ro-plain-list">
      {entries.map((entry) => (
        <div className="ro-plain-row" key={entry.id}>
          <strong>{entry.statement}</strong>
          <div className="ro-handbook-meta">
            <span>
              {entry.sourceLabel}
              {entry.workerSlug ? ` · ${workers.find((worker) => worker.slug === entry.workerSlug)?.name ?? "Worker"}` : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function truncatePreview(value: string, max = 160) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function safeList(json: string): string[] {
  try { const v = JSON.parse(json); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}

/* ---------- Calendar (real time now-line, real events, CRUD) ---------- */

const WIN_START = 0;
const WIN_END = 24;
const HOUR_PX = 48;
type CalendarMode = "day" | "week";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
function hourOf(iso: string) { const d = new Date(iso); return d.getHours() + d.getMinutes() / 60; }
function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}
function sameDay(left: Date, right: Date) {
  return left.toDateString() === right.toDateString();
}

const EVENT_TYPES = ["Meeting", "Review", "Focus", "Deadline"];

function CalendarView({
  workers, overlays, onReload,
}: {
  workers: Worker[]; overlays: Overlays; onReload: () => Promise<void>;
}) {
  const [day, setDay] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [mode, setMode] = useState<CalendarMode>("week");
  const [editing, setEditing] = useState<OverlayCalendarEvent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const periodStart = mode === "week" ? startOfWeek(day) : day;
  const displayDays = mode === "week" ? Array.from({ length: 7 }, (_, index) => addDays(periodStart, index)) : [day];
  const visibleEvents = overlays.calendarEvents
    .filter((e) => displayDays.some((displayDay) => sameDay(new Date(e.startsAt), displayDay)))
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  const todayVisible = displayDays.some((displayDay) => sameDay(displayDay, new Date()));
  const nowHour = now.getHours() + now.getMinutes() / 60;

  // On mount / view change, scroll the grid to the working morning (or just above now).
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const target = todayVisible ? Math.max(nowHour - 2.5, 0) : 7;
    node.scrollTop = target * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, day]);

  const shiftDay = (delta: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + (mode === "week" ? delta * 7 : delta));
    setDay(d);
  };

  const hours: number[] = [];
  for (let h = WIN_START; h < WIN_END; h += 1) hours.push(h);
  const hourLabel = (h: number) => (h === 0 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`);

  return (
    <div className="ro-main-scroll ro-main-wide">
      <header className="ro-page-head ro-cal-head">
        <h1>
          {mode === "week"
            ? `${displayDays[0].toLocaleDateString([], { month: "long", day: "numeric" })} – ${displayDays[displayDays.length - 1].toLocaleDateString([], { month: "long", day: "numeric" })}`
            : day.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </h1>
        <div className="ro-cal-nav">
          <div className="r-seg">
            <button type="button" className={`r-seg-btn${mode === "day" ? " on" : ""}`} onClick={() => setMode("day")}>Day</button>
            <button type="button" className={`r-seg-btn${mode === "week" ? " on" : ""}`} onClick={() => setMode("week")}>Week</button>
          </div>
          <button type="button" onClick={() => shiftDay(-1)} aria-label={mode === "week" ? "Previous week" : "Previous day"}>‹</button>
          <button type="button" className="ro-cal-today" onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setDay(d); }}>Today</button>
          <button type="button" onClick={() => shiftDay(1)} aria-label={mode === "week" ? "Next week" : "Next day"}>›</button>
          <button type="button" className="r-btn r-btn-accent" onClick={() => { setEditing(null); setShowForm(true); }}>New event</button>
        </div>
      </header>

      <div className="ro-cal" ref={scrollRef}>
        <div className={`ro-cal-days ro-cal-days-${mode}`}>
          <div className="ro-cal-sidehead" />
          {displayDays.map((displayDay) => {
            const isToday = sameDay(displayDay, new Date());
            return (
              <div className={`ro-cal-dayhead${isToday ? " is-today" : ""}`} key={displayDay.toISOString()}>
                <span>{displayDay.toLocaleDateString([], { weekday: "short" })}</span>
                <strong>{displayDay.getDate()}</strong>
              </div>
            );
          })}
        </div>

        <div className={`ro-cal-grid ro-cal-grid-${mode}`} style={{ height: (WIN_END - WIN_START) * HOUR_PX }}>
          {hours.map((h) => (
            <div className="ro-cal-row" key={h} style={{ height: HOUR_PX }}>
              <span className="ro-cal-hour">{hourLabel(h)}</span>
              <div className="ro-cal-row-days">
                {displayDays.map((displayDay) => (
                  <div className="ro-cal-lane" key={`${displayDay.toISOString()}-${h}`} />
                ))}
              </div>
            </div>
          ))}

          {visibleEvents.map((e) => {
            const eventDayIndex = displayDays.findIndex((displayDay) => sameDay(displayDay, new Date(e.startsAt)));
            if (eventDayIndex < 0) return null;
            const top = (hourOf(e.startsAt) - WIN_START) * HOUR_PX;
            const height = Math.max(26, (hourOf(e.endsAt) - hourOf(e.startsAt)) * HOUR_PX - 4);
            return (
              <button
                key={e.id}
                className={`ro-evt type-${e.eventType.toLowerCase()}`}
                style={{ top, height, left: `calc(58px + (${eventDayIndex} * (100% - 58px) / ${displayDays.length}) + 4px)`, width: `calc((100% - 58px) / ${displayDays.length} - 8px)` }}
                type="button"
                onClick={() => { setEditing(e); setShowForm(true); }}
              >
                <span className="ro-evt-title">{e.title}</span>
                <small>{clock(e.startsAt)}</small>
              </button>
            );
          })}

          {todayVisible && (
            <div
              className="ro-nowline"
              style={{
                top: (nowHour - WIN_START) * HOUR_PX,
                left: `calc(58px + (${Math.max(0, displayDays.findIndex((displayDay) => sameDay(displayDay, now)))} * (100% - 58px) / ${displayDays.length}))`,
                width: `calc((100% - 58px) / ${displayDays.length})`,
              }}
              data-time={now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            />
          )}
        </div>
      </div>

      {showForm && (
        <EventForm
          workers={workers}
          initial={editing}
          defaultDate={day}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={async () => { setShowForm(false); setEditing(null); await onReload(); }}
        />
      )}
    </div>
  );
}

function EventForm({
  workers, initial, defaultDate, onClose, onSaved,
}: {
  workers: Worker[]; initial: OverlayCalendarEvent | null; defaultDate: Date;
  onClose: () => void; onSaved: () => Promise<void>;
}) {
  const init = initial ? toLocalInput(initial.startsAt) : null;
  const initEnd = initial ? toLocalInput(initial.endsAt) : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(init?.date ?? `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(defaultDate.getDate())}`);
  const [start, setStart] = useState(init?.time ?? "09:00");
  const [end, setEnd] = useState(initEnd?.time ?? "10:00");
  const [type, setType] = useState(initial?.eventType ?? "Meeting");
  const [workerSlug, setWorkerSlug] = useState<string | null>(initial?.workerSlug ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!title.trim()) { setError("Give the event a title."); return; }
    setBusy(true); setError("");
    const startsAt = new Date(`${date}T${start}`).toISOString();
    const endsAt = new Date(`${date}T${end}`).toISOString();
    const body = JSON.stringify({ title: title.trim(), startsAt, endsAt, eventType: type, notes, workerSlug });
    try {
      if (initial) await officeJson(`/api/office/calendar/events/${initial.id}`, { method: "POST", body });
      else await officeJson("/api/office/calendar/events", { method: "POST", body });
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); setBusy(false); }
  };
  const remove = async () => {
    if (!initial) return;
    setBusy(true);
    try { await officeJson(`/api/office/calendar/events/${initial.id}/delete`, { method: "POST", body: "{}" }); await onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete."); setBusy(false); }
  };

  return (
    <div className="ro-modal-scrim" onClick={onClose}>
      <div className="ro-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{initial ? "Edit event" : "New event"}</h3>
        <label className="ro-field"><span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Creator call — Delaney" autoFocus />
        </label>
        <div className="ro-field-row">
          <label className="ro-field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="ro-field"><span>Start</span><input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="ro-field"><span>End</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <div className="ro-field"><span>Type</span>
          <div className="r-seg">
            {EVENT_TYPES.map((t) => (
              <button key={t} type="button" className={`r-seg-btn${type === t ? " on" : ""}`} onClick={() => setType(t)}>{t}</button>
            ))}
          </div>
        </div>
        {workers.length > 0 && (
          <div className="ro-field"><span>Assign to (optional)</span>
            <div className="r-seg">
              <button type="button" className={`r-seg-btn${workerSlug === null ? " on" : ""}`} onClick={() => setWorkerSlug(null)}>None</button>
              {workers.map((w) => (
                <button key={w.slug} type="button" className={`r-seg-btn${workerSlug === w.slug ? " on" : ""}`} onClick={() => setWorkerSlug(w.slug)}>{w.name.split(" ")[0]}</button>
              ))}
            </div>
          </div>
        )}
        <label className="ro-field"><span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
        </label>
        {error && <div className="ro-error">{error}</div>}
        <div className="ro-modal-actions">
          {initial && <button className="r-btn r-btn-ghost" type="button" onClick={() => void remove()} disabled={busy} style={{ color: "#c0392b", marginRight: "auto" }}>Delete</button>}
          <button className="r-btn r-btn-ghost" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="r-btn r-btn-accent" type="button" onClick={() => void save()} disabled={busy}>{initial ? "Save" : "Add event"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Team ---------- */

function TeamView({
  desks,
  openRoles,
  workers,
  overlays,
  onNavigate
}: {
  desks: WorkerDesk[];
  openRoles: Worker[];
  workers: Worker[];
  overlays: Overlays;
  onNavigate: (h: string) => void;
}) {
  const activeWorkers = workers.map((worker) => ({
    worker,
    desk: desks.find((desk) => desk.workerSlug === worker.slug) ?? null,
    focus: desks.find((desk) => desk.workerSlug === worker.slug)?.currentFocus || lastActivityFor(worker.slug, overlays.worklog)
  }));

  return (
    <div className="ro-main-scroll">
      <header className="ro-page-head">
        <h1>Workers</h1>
        <p className="ro-page-meta">{workers.length} {workers.length === 1 ? "worker" : "workers"} on the clock</p>
      </header>
      <div className="ro-review-layout is-single">
        <div>
          <section className="ro-sec ro-sec-lead">
            <div className="ro-sec-head">
              <h2>On the floor</h2>
            </div>
            <div className="ro-worker-floor">
              {activeWorkers.map(({ worker, desk, focus }) => (
                <div
                  className="ro-worker-floor-row"
                  key={worker.slug}
                  role="button"
                  tabIndex={0}
                  onClick={() => onNavigate(`#app/office/workers/${worker.slug}/desk`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onNavigate(`#app/office/workers/${worker.slug}/desk`);
                    }
                  }}
                >
                  <div className="ro-worker-floor-mark">
                    <WorkerMark seed={worker.slug} size={42} active />
                  </div>
                  <div className="ro-worker-floor-copy">
                    <div className="ro-worker-floor-head">
                      <strong>{worker.name}</strong>
                      <span>{worker.title}</span>
                    </div>
                    <p>{focus}</p>
                    <div className="ro-worker-floor-notes">
                      {desk?.recentCompleted[0] ? <span>Recently shipped: {desk.recentCompleted[0].title}</span> : null}
                    </div>
                  </div>
                  <div className="ro-worker-floor-side">
                    <span>{worker.salary}</span>
                    <button
                      className="ro-textlink"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onNavigate(`#app/office/workers/${worker.slug}/conversation`);
                      }}
                    >
                      Message
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {openRoles.length > 0 ? (
            <section className="ro-sec">
              <div className="ro-sec-head">
                <h2>Open roles</h2>
              </div>
              <div className="ro-rows">
                {openRoles.slice(0, 6).map((worker) => (
                  <button
                    className="ro-row ro-row-person"
                    key={worker.slug}
                    type="button"
                    onClick={() => onNavigate(`#worker-${worker.slug}`)}
                  >
                    <WorkerMark seed={worker.slug} size={44} active={false} />
                    <div className="ro-row-copy">
                      <strong>{worker.name}</strong>
                      <p>{worker.title} · {worker.status}</p>
                    </div>
                    <div className="ro-row-end">
                      <span className="ro-row-aside">{worker.salary}</span>
                      <span className="ro-textlink">Interview</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>

      </div>
    </div>
  );
}

/* ---------- Deliverables ---------- */

function DeliverablesView({ workers, overlays, onNavigate }: { workers: Worker[]; overlays: Overlays; onNavigate: (h: string) => void }) {
  const [selectedDeliverable, setSelectedDeliverable] = useState<WorkerDeskDeliverable | null>(null);
  const [workerFilter, setWorkerFilter] = useState<string | null>(null);

  const authors = workers.filter((worker) =>
    overlays.deliverables.some((deliverable) => deliverable.workerSlug === worker.slug)
  );
  // One row per document: repeated runs of the same deliverable collapse to
  // the most recent version instead of flooding the library.
  const items = useMemo(() => {
    const sorted = overlays.deliverables
      .filter((deliverable) => (workerFilter ? deliverable.workerSlug === workerFilter : true))
      .slice()
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const seen = new Set<string>();
    return sorted.filter((deliverable) => {
      const key = `${deliverable.workerSlug}::${deliverable.title.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [overlays.deliverables, workerFilter]);
  const nameFor = (slug: string) => workers.find((worker) => worker.slug === slug)?.name ?? "Worker";

  return (
    <div className="ro-main-scroll">
      <header className="ro-page-head">
        <h1>Deliverables</h1>
        <p className="ro-page-meta">
          {overlays.deliverables.length === 0
            ? "Finished work from your team will collect here"
            : `${overlays.deliverables.length} document${overlays.deliverables.length === 1 ? "" : "s"} produced by your team`}
        </p>
      </header>
      {overlays.deliverables.length === 0 ? (
        <p className="ro-blank">
          Deliverables your workers create automatically will collect here.
          {workers.length === 0 && <> <button className="ro-textlink" type="button" onClick={() => onNavigate("#workers")}>Hire a worker to get started</button></>}
        </p>
      ) : (
        <div className="ro-library">
          {authors.length > 1 ? (
            <div className="ro-library-filters" role="tablist" aria-label="Filter by worker">
              <button
                className={`ro-library-filter${workerFilter === null ? " is-active" : ""}`}
                type="button"
                onClick={() => setWorkerFilter(null)}
              >
                All
              </button>
              {authors.map((worker) => (
                <button
                  className={`ro-library-filter${workerFilter === worker.slug ? " is-active" : ""}`}
                  key={worker.slug}
                  type="button"
                  onClick={() => setWorkerFilter(worker.slug)}
                >
                  {worker.name.split(" ")[0]}
                </button>
              ))}
            </div>
          ) : null}
          <div className="ro-library-list">
            {items.map((deliverable) => (
              <button
                className="ro-library-row"
                key={deliverable.id}
                type="button"
                onClick={() => setSelectedDeliverable({
                  id: deliverable.id,
                  contentRefId: deliverable.contentRefId,
                  sourceType: deliverable.sourceType,
                  title: deliverable.title,
                  summary: deliverable.summary || deliverable.previewText,
                  sourceLabel: sentenceCase(deliverable.deliverableType.replace(/_/g, " ")),
                  updatedAt: deliverable.updatedAt,
                  workerSlug: deliverable.workerSlug
                })}
              >
                <span className="ro-library-title">{deliverable.title}</span>
                <span className="ro-library-meta">
                  {nameFor(deliverable.workerSlug)} · {sentenceCase(deliverable.deliverableType.replace(/_/g, " "))}
                </span>
                <span className="ro-library-date">{timeAgo(deliverable.updatedAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {selectedDeliverable ? (
        <WorkerDeskDeliverableModal
          deliverable={selectedDeliverable}
          onClose={() => setSelectedDeliverable(null)}
          workerName={workers.find((worker) => worker.slug === selectedDeliverable.workerSlug)?.name ?? "Worker"}
        />
      ) : null}
    </div>
  );
}

/* ---------- Settings (user-owned; always works) ---------- */

const REVIEW_CADENCES = ["Daily", "Weekly", "Biweekly"];

function SettingsView({ overlays, onReload }: { overlays: Overlays; onReload: () => Promise<void> }) {
  const parsed = useMemo(() => {
    try { return overlays.globalSettings ? JSON.parse(overlays.globalSettings.settingsJson) : {}; } catch { return {}; }
  }, [overlays.globalSettings]);

  const [brandContext, setBrandContext] = useState<string>(parsed.brandContext ?? "");
  const [timezone, setTimezone] = useState<string>(parsed.timezone ?? "America/New_York");
  const [quietHours, setQuietHours] = useState<string>(parsed.quietHours ?? "");
  const [reviewCadence, setReviewCadence] = useState<string>(parsed.reviewCadence ?? "Weekly");
  const [decisionStyle, setDecisionStyle] = useState<string>(parsed.decisionStyle ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    setBrandContext(parsed.brandContext ?? "");
    setTimezone(parsed.timezone ?? "America/New_York");
    setQuietHours(parsed.quietHours ?? "");
    setReviewCadence(parsed.reviewCadence ?? "Weekly");
    setDecisionStyle(parsed.decisionStyle ?? "");
  }, [parsed]);

  const openBillingPortal = async () => {
    setBillingNotice(null);
    try {
      const payload = await officeJson<{ url: string }>("/api/payments/portal", { method: "POST", body: JSON.stringify({}) });
      window.location.href = payload.url;
    } catch (error) {
      setBillingNotice(error instanceof Error ? error.message : "Could not open billing.");
    }
  };

  const exportData = () => {
    // Cookie-authenticated download; the server sets Content-Disposition.
    window.location.href = "/api/account/export";
  };

  const deleteAccount = async () => {
    setPrivacyNotice(null);
    setDeleteBusy(true);
    try {
      const security = await officeJson<{ passwordIsSet: boolean; googleEnabled: boolean }>("/api/account/security");
      if (security.passwordIsSet) {
        const password = window.prompt(
          "This permanently deletes your account and all your data, and cancels any active subscriptions. This cannot be undone.\n\nEnter your password to confirm (leave blank to cancel, or type GOOGLE to confirm with Google instead):"
        );
        if (password === null) return;
        if (String(password).trim().toUpperCase() === "GOOGLE" && security.googleEnabled) {
          window.location.href = "/api/account/delete/google";
          return;
        }
        if (!password) return;
        await officeJson("/api/account/delete", { method: "POST", body: JSON.stringify({ password }) });
        window.location.href = "/";
        return;
      }
      if (security.googleEnabled) {
        const confirmed = window.confirm(
          "This permanently deletes your account and all your data, and cancels any active subscriptions. This cannot be undone.\n\nContinue to Google to confirm deletion?"
        );
        if (!confirmed) return;
        window.location.href = "/api/account/delete/google";
        return;
      }
      setPrivacyNotice("This account has no password and Google sign-in is not configured. Contact support to delete it.");
    } catch (error) {
      setPrivacyNotice(error instanceof Error ? error.message : "Couldn't delete the account. Try again.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const save = async () => {
    setBusy(true); setSaved(false); setSaveError(null);
    try {
      await officeJson("/api/office/settings", {
        method: "POST",
        body: JSON.stringify({ settings: { ...parsed, brandContext, timezone, quietHours, reviewCadence, decisionStyle } }),
      });
      await onReload();
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't save settings. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="ro-main-scroll">
      <header className="ro-page-head"><h1>Settings</h1><p className="ro-page-meta">Context your workers read before acting</p></header>
      <div className="ro-settings">
        <label className="ro-field"><span>What your business does</span>
          <textarea value={brandContext} onChange={(e) => setBrandContext(e.target.value)} rows={3} placeholder="A line or two on your brand, niche, and who you serve. Your workers read this as context." />
        </label>
        <label className="ro-field"><span>How you like decisions made</span>
          <textarea value={decisionStyle} onChange={(e) => setDecisionStyle(e.target.value)} rows={2} placeholder="e.g. Move fast on anything under $500, always check with me above that." />
        </label>
        <div className="ro-field-row">
          <label className="ro-field"><span>Timezone</span>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/New_York" />
          </label>
          <label className="ro-field"><span>Quiet hours</span>
            <input value={quietHours} onChange={(e) => setQuietHours(e.target.value)} placeholder="e.g. 8pm – 8am" />
          </label>
        </div>
        <div className="ro-field"><span>Review cadence</span>
          <div className="r-seg">
            {REVIEW_CADENCES.map((c) => (
              <button key={c} type="button" className={`r-seg-btn${reviewCadence === c ? " on" : ""}`} onClick={() => setReviewCadence(c)}>{c}</button>
            ))}
          </div>
        </div>
        <div className="ro-settings-foot">
          {saved && <span className="ro-saved">Saved ✓</span>}
          {saveError && <span className="ro-save-error" role="alert">{saveError}</span>}
          <button className="r-btn r-btn-accent" type="button" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
        </div>

        <div className="ro-settings-billing">
          <div className="ro-sec-head"><h2>Billing</h2></div>
          <p className="ro-page-meta">Salaries, invoices, payment method, and cancellations — all self-serve.</p>
          <button className="r-btn r-btn-ghost" type="button" onClick={() => void openBillingPortal()}>Manage billing</button>
          {billingNotice ? <p className="ro-review-notice">{billingNotice}</p> : null}
        </div>

        <div className="ro-settings-billing">
          <div className="ro-sec-head"><h2>Data &amp; privacy</h2></div>
          <p className="ro-page-meta">Download everything we hold about your account, or delete it permanently.</p>
          <div className="ro-appr-actions">
            <button className="r-btn r-btn-ghost" type="button" onClick={exportData}>Export my data</button>
            <button className="ro-textlink ro-danger-link" type="button" disabled={deleteBusy} onClick={() => void deleteAccount()}>
              {deleteBusy ? "Deleting…" : "Delete my account"}
            </button>
          </div>
          {privacyNotice ? <p className="ro-review-notice">{privacyNotice}</p> : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- shell ---------- */

export function OfficeExperienceApp({ allWorkers, hiredWorkers, isAdmin = false, onNavigate, onNotice, userName }: OfficeExperienceAppProps) {
  const [route, setRoute] = useState(() => parseOfficeRoute(window.location.hash));
  const [overlays, setOverlays] = useState<Overlays>(EMPTY_OVERLAYS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navCollapsed, setNavCollapsed] = usePersistentBoolean("ryva.office.nav-collapsed", false);
  const [maraWorkspaces, setMaraWorkspaces] = useState<Record<string, MaraWorkspace | null>>({});
  const [workerActionBusy, setWorkerActionBusy] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(parseOfficeRoute(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const reload = useCallback(async () => {
    try {
      const data = await officeJson<Partial<Overlays>>("/api/office/overlays", { method: "GET" });
      setOverlays({ ...EMPTY_OVERLAYS, ...data });
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the office right now.");
    }
  }, []);

  useEffect(() => { void (async () => { setLoading(true); await reload(); setLoading(false); })(); }, [reload]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspaces = async () => {
      const maraWorkers = hiredWorkers.filter((worker) => isAgentWorker(worker.slug));
      if (maraWorkers.length === 0) {
        if (!cancelled) setMaraWorkspaces({});
        return;
      }

      const entries = await Promise.all(
        maraWorkers.map(async (worker) => {
          try {
            const payload = await officeJson<{ workspace: MaraWorkspace }>(`/api/office/workers/${worker.slug}/workspace`);
            return [worker.slug, payload.workspace] as const;
          } catch {
            return [worker.slug, null] as const;
          }
        })
      );

      if (!cancelled) {
        setMaraWorkspaces(Object.fromEntries(entries));
      }
    };

    void loadWorkspaces();
    return () => {
      cancelled = true;
    };
  }, [hiredWorkers, overlays]);

  const { tab, workerSlug, section } = route;
  const hasWorkers = hiredWorkers.length > 0;
  const go = (hash: string) => onNavigate(hash);
  const onboardingByWorker = useMemo(
    () =>
      new Map(
        overlays.onboarding.map((record) => [record.workerSlug, parseOnboardingSession(record)])
      ),
    [overlays.onboarding]
  );
  const firstIncompleteWorker = useMemo(
    () => hiredWorkers.find((worker) => onboardingByWorker.get(worker.slug)?.status !== "completed") ?? null,
    [hiredWorkers, onboardingByWorker]
  );
  const hasUsableOfficeData = useMemo(
    () =>
      overlays.assignments.length > 0 ||
      overlays.deliverables.length > 0 ||
      overlays.chats.length > 0 ||
      overlays.calendarEvents.length > 0 ||
      overlays.handbookEntries.length > 0 ||
      overlays.worklog.length > 0 ||
      overlays.tasks.length > 0 ||
      overlays.suggestedActions.length > 0 ||
      overlays.briefings.length > 0,
    [overlays]
  );

  useEffect(() => {
    if (loading || loadError || !firstIncompleteWorker) {
      return;
    }

    if (tab === "worker-onboarding" && workerSlug === firstIncompleteWorker.slug) {
      return;
    }

    if (tab === "settings") {
      return;
    }

    go(`#app/office/workers/${firstIncompleteWorker.slug}/onboarding`);
  }, [firstIncompleteWorker, go, loadError, loading, tab, workerSlug]);

  const emptyLabels: Record<string, string> = {
    assignments: "office assignments",
    deliverables: "your deliverables",
    handbook: "your handbook",
    reviews: "work waiting on you",
    today: "your day",
    workers: "your workers"
  };
  const desks = useMemo(
    () =>
      hiredWorkers.map((worker) =>
        buildWorkerDesk(
          worker,
          overlays,
          overlays.onboarding.find((record) => record.workerSlug === worker.slug),
          maraWorkspaces[worker.slug] ?? null
        )
      ),
    [hiredWorkers, overlays, maraWorkspaces]
  );
  const activeWorkerSlug = workerSlug || hiredWorkers[0]?.slug || null;
  const activeDesk = desks.find((desk) => desk.workerSlug === activeWorkerSlug) ?? null;
  const activeWorker = hiredWorkers.find((worker) => worker.slug === activeWorkerSlug) ?? null;

  const refreshMaraWorkspace = useCallback(async (workerSlugParam: string) => {
    const payload = await officeJson<{ workspace: MaraWorkspace }>(`/api/office/workers/${workerSlugParam}/workspace`, { method: "GET" });
    setMaraWorkspaces((current) => ({ ...current, [workerSlugParam]: payload.workspace }));
    return payload.workspace;
  }, []);

  const runWorkerAutonomy = useCallback(async (workerSlugParam: string, options: { silent?: boolean } = {}) => {
    if (!isAgentWorker(workerSlugParam)) return;
    setWorkerActionBusy("mara-autonomy");
    try {
      const payload = await officeJson<MaraAutonomyRunResponse>(`/api/office/workers/${workerSlugParam}/autonomy/run`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setMaraWorkspaces((current) => ({ ...current, [workerSlugParam]: payload.workspace }));
      await reload();
      if (!options.silent) {
        onNotice(formatMaraAutonomyNotice(payload.summary));
      }
    } catch (error) {
      if (!options.silent) {
        onNotice(error instanceof Error ? error.message : "I couldn't finish that work pass.");
      }
    } finally {
      setWorkerActionBusy(null);
    }
  }, [onNotice, reload]);

  const runWorkerTask = useCallback(async (workerSlugParam: string, taskId: string) => {
    if (!isAgentWorker(workerSlugParam)) return;
    setWorkerActionBusy(taskId);
    try {
      const payload = await officeJson<{ workspace?: MaraWorkspace }>(`/api/office/workers/${workerSlugParam}/tasks/${taskId}/run`, {
        method: "POST",
        body: JSON.stringify({})
      });
      if (payload.workspace) {
        setMaraWorkspaces((current) => ({ ...current, [workerSlugParam]: payload.workspace! }));
      } else {
        await refreshMaraWorkspace(workerSlugParam);
      }
      await reload();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "I couldn't run that task.");
    } finally {
      setWorkerActionBusy(null);
    }
  }, [onNotice, refreshMaraWorkspace, reload]);

  const approveWorkerTask = useCallback(async (workerSlugParam: string, taskId: string) => {
    if (!isAgentWorker(workerSlugParam)) return;
    setWorkerActionBusy(taskId);
    try {
      const payload = await officeJson<{ workspace: MaraWorkspace }>(`/api/office/workers/${workerSlugParam}/tasks/${taskId}/approve`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setMaraWorkspaces((current) => ({ ...current, [workerSlugParam]: payload.workspace }));
      await reload();
      onNotice("Got it — I'm on it.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "I couldn't approve that task.");
    } finally {
      setWorkerActionBusy(null);
    }
  }, [onNotice, reload]);

  const updateWorkerApproval = useCallback(async (workerSlugParam: string, approvalId: string, status: "approved" | "rejected") => {
    if (!isAgentWorker(workerSlugParam)) return;
    setWorkerActionBusy(approvalId);
    try {
      const payload = await officeJson<{ workspace: MaraWorkspace; emailsSent?: number }>(`/api/office/workers/${workerSlugParam}/approval-requests/${approvalId}/status`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
      setMaraWorkspaces((current) => ({ ...current, [workerSlugParam]: payload.workspace }));
      await reload();
      onNotice(
        status !== "approved"
          ? "Understood — I won't do that."
          : payload.emailsSent && payload.emailsSent > 0
            ? `Approved — ${payload.emailsSent === 1 ? "the email is" : `${payload.emailsSent} emails are`} sent from your Gmail.`
            : "Thanks — I'll move forward."
      );
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "I couldn't save that approval.");
    } finally {
      setWorkerActionBusy(null);
    }
  }, [onNotice, reload]);

  // Background scheduler on the server does the autonomous work now.
  // The client just keeps the office fresh: poll faster while a
  // conversation is open, slower otherwise, and only when the tab is visible.
  useEffect(() => {
    if (loading) return;
    const intervalMs = section === "conversation" ? 10_000 : 60_000;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void reload();
      if (isAgentWorker(activeWorkerSlug || "")) {
        void refreshMaraWorkspace(activeWorkerSlug!).catch(() => undefined);
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [activeWorkerSlug, loading, reload, refreshMaraWorkspace, section]);

  let main: JSX.Element;
  if (loading) {
    main = <div className="ro-main-scroll"><p className="ro-blank">Loading your office…</p></div>;
  } else if (WORKER_DEPENDENT.includes(tab) && !hasWorkers) {
    main = <EmptyOffice label={emptyLabels[tab] ?? "your office"} onNavigate={go} />;
  } else if (tab === "worker-onboarding" && workerSlug) {
    const worker = hiredWorkers.find((entry) => entry.slug === workerSlug) ?? null;
    const session = worker ? onboardingByWorker.get(worker.slug) ?? null : null;

    main = worker ? (
      <WorkerOnboardingPage
        onComplete={async (payload) => {
          const result = await officeJson<{ ok: boolean; workspace?: MaraWorkspace | null }>(`/api/office/workers/${worker.slug}/onboarding/complete`, {
            method: "POST",
            body: JSON.stringify(payload)
          });
          if (result.workspace && isMaraWorker(worker.slug)) {
            setMaraWorkspaces((current) => ({ ...current, [worker.slug]: result.workspace! }));
          }
          await reload();
          onNotice(isMaraWorker(worker.slug) ? "I'm on my desk and already working from what you told me." : (payload.generatedSummary[0] || payload.worklogEntry.result));
          go(`#app/office/workers/${worker.slug}/desk`);
        }}
        onSaveProgress={async (payload) => {
          await officeJson(`/api/office/workers/${worker.slug}/onboarding/save`, {
            method: "POST",
            body: JSON.stringify(payload)
          });
        }}
        onStartFirstDay={(notice) => {
          onNotice(notice);
          go(`#app/office/workers/${worker.slug}/desk`);
        }}
        session={session}
        worker={worker}
      />
    ) : (
      <div className="ro-main-scroll"><p className="ro-blank">This worker could not be found.</p></div>
    );
  } else {
    switch (tab) {
      case "assignments": main = <AssignmentsView workers={hiredWorkers} overlays={overlays} onNavigate={go} />; break;
      case "reviews": main = <ApprovalsView workers={hiredWorkers} overlays={overlays} onNavigate={go} onReload={reload} />; break;
      case "calendar": main = <CalendarView workers={hiredWorkers} overlays={overlays} onReload={reload} />; break;
      case "workers": {
        if (workerSlug && activeWorker && activeDesk) {
          main = (
            <WorkerDeskView
              activeWorker={activeWorker}
              busyId={workerActionBusy}
              isAdmin={isAdmin}
              canUseEmail={overlays.integrations.some((integration) => integration.workerSlug === activeWorker.slug && integration.status === "connected")}
              connectedTools={overlays.integrations.filter((integration) => integration.workerSlug === activeWorker.slug)}
              desk={activeDesk}
              overlays={overlays}
              onApprove={(approvalId) => updateWorkerApproval(activeWorker.slug, approvalId, "approved")}
              onApproveTask={(taskId) => approveWorkerTask(activeWorker.slug, taskId)}
              onNavigate={go}
              onReject={(approvalId) => updateWorkerApproval(activeWorker.slug, approvalId, "rejected")}
              onReload={reload}
              onRunTask={(taskId) => runWorkerTask(activeWorker.slug, taskId)}
              onSeedCorrection={(prompt) => {
                go(`#app/office/workers/${activeWorker.slug}/conversation`);
                seedOfficeConversationDraft(prompt);
              }}
              section={section ?? "desk"}
            />
          );
        } else {
          const openRoles = allWorkers.filter((worker) => !hiredWorkers.some((hired) => hired.slug === worker.slug));
          main = <TeamView desks={desks} openRoles={openRoles} workers={hiredWorkers} overlays={overlays} onNavigate={go} />;
        }
        break;
      }
      case "deliverables": main = <DeliverablesView workers={hiredWorkers} overlays={overlays} onNavigate={go} />; break;
      case "handbook": main = <HandbookView overlays={overlays} workers={hiredWorkers} />; break;
      case "settings": main = <SettingsView overlays={overlays} onReload={reload} />; break;
      default: main = <TodayView desks={desks} userName={userName} workers={hiredWorkers} overlays={overlays} onNavigate={go} onApprovalsClick={() => go("#app/office/reviews")} onOpenWorkerDetails={(slug) => go(`#app/office/workers/${slug}/desk`)} />;
    }
  }

  const pendingCount =
    overlays.tasks.filter((t) => t.status === "Needs Review" || t.status === "Pending approval").length +
    overlays.briefings.length +
    overlays.suggestedActions.filter((action) => action.status === "suggested" && action.requiresApproval).length;

  return (
    <div className={`ro-shell${navCollapsed ? " nav-collapsed" : ""}`}>
      <aside className="ro-nav">
        <div className="ro-nav-top">
          <button className="ro-brand" type="button" onClick={() => go("#app/office")}>Ryva<span>.</span></button>
          <button className="ro-collapse-toggle" type="button" onClick={() => setNavCollapsed((value) => !value)} aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"} title={navCollapsed ? "Expand navigation" : "Collapse navigation"}>
            {navCollapsed ? "›" : "‹"}
          </button>
        </div>
        {NAV_ITEMS.map((item) => (
          <button key={item.tab} className={`ro-nav-item${tab === item.tab ? " on" : ""}`} type="button" onClick={() => go(`#app/office/${item.tab}`)} aria-label={item.label} title={item.label}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
            {!navCollapsed && item.label}
            {!navCollapsed && (item.tab === "reviews" || item.tab === "assignments") && pendingCount > 0 && <span className="ro-count">{pendingCount}</span>}
          </button>
        ))}
        <div className="ro-nav-foot">
          {!navCollapsed && <div className="ro-command-hint">⌘K — delegate</div>}
          <button className={`ro-nav-item${tab === "settings" ? " on" : ""}`} type="button" onClick={() => go("#app/office/settings")} aria-label="Settings" title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></svg>
            {!navCollapsed && "Settings"}
          </button>
        </div>
      </aside>

      <main className="ro-main">
        {loadError && !hasUsableOfficeData ? (
          <div className="ro-page-alert">
            <strong>The office did not finish loading.</strong>
            <p>{loadError}</p>
            <button className="ro-textlink" type="button" onClick={() => void reload()}>Try again</button>
          </div>
        ) : null}
        {main}
      </main>
    </div>
  );
}
