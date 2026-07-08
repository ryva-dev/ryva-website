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
  kind: "approval" | "blocked_task";
  title: string;
  description: string;
  blockerReason?: string;
  nextStep?: string;
};

type MaraWorkspace = {
  blockedTasks: MaraWorkspaceTask[];
  currentFocus: string;
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
  title: string;
  summary: string;
  sourceLabel: string;
  updatedAt: string;
};

type WorkerDeskActivity = {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
};

type WorkerDesk = {
  workerSlug: string;
  currentFocus: string;
  currentFocusReason: string;
  workInMotion: Array<{ id: string; title: string; summary: string; status: string }>;
  waitingOnUser: Array<{ id: string; title: string; summary: string; actionLabel?: string }>;
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
type WorkbenchSection = "desk" | "conversation" | "knowledge" | "history";
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
    const section: WorkbenchSection = rawSection && (["desk", "conversation", "knowledge", "history"] as WorkbenchSection[]).includes(rawSection)
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
      sourceLabel: "Deliverable",
      updatedAt: output.dueAt || new Date().toISOString()
    })) ??
    workerDeliverables.slice(0, 5).map((deliverable) => ({
      id: deliverable.id,
      title: deliverable.title,
      summary: deliverable.summary || deliverable.previewText,
      sourceLabel: sentenceCase(deliverable.deliverableType.replace(/_/g, " ")),
      updatedAt: deliverable.updatedAt
    })) ??
    workerFiles.slice(0, 3).map((file) => ({
      id: file.id,
      title: file.name,
      summary: `${file.type} prepared by ${worker.name.split(" ")[0]}.`,
      sourceLabel: "File",
      updatedAt: file.updatedAt
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
        label: `Shipped — ${item.title}`,
        summary: item.summary,
        workerSlug: desk.workerSlug
      }));
      const activity = desk.recentActivity.slice(0, 2).map((item) => ({
        createdAt: item.createdAt,
        id: `${desk.workerSlug}-${item.id}-activity`,
        label: `${sentenceCase(item.title)} — ${item.summary}`,
        summary: item.summary,
        workerSlug: desk.workerSlug
      }));
      return [...completed, ...activity];
    })
    .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt))
    .slice(0, 6);
  const activeAssignments = desks
    .flatMap((desk) => desk.workInMotion.map((item) => ({ ...item, workerSlug: desk.workerSlug })))
    .slice(0, 6);
  const idleWorkers = desks.filter((desk) => desk.workInMotion.length === 0 && desk.waitingOnUser.length === 0);
  const todayCalStart = 7;
  const todayCalEnd = 21;
  const todayCalHours = Array.from({ length: todayCalEnd - todayCalStart }, (_, index) => todayCalStart + index);
  const nowHour = today.getHours() + today.getMinutes() / 60;
  const hourLabel = (h: number) => (h === 0 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`);

  const dateLine = today.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="ro-main-scroll">
      <header className="ro-page-head">
        <h1>Good {today.getHours() < 12 ? "morning" : today.getHours() < 18 ? "afternoon" : "evening"}, {userName.split(" ")[0]}.</h1>
        <p className="ro-page-meta">
          {dateLine} · {workers.length} {workers.length === 1 ? "worker" : "workers"} on the clock · {attentionItems.length} item{attentionItems.length === 1 ? "" : "s"} need you
        </p>
      </header>

      <section className="ro-sec ro-sec-lead">
        <div className="ro-sec-head">
          <h2>Needs you</h2>
          <div className="ro-sec-head-actions">
            <span className="ro-sec-n">{attentionItems.length === 0 ? "All clear" : attentionItems.length}</span>
            {attentionItems.length > 0 ? (
              <button className="ro-textlink" type="button" onClick={onApprovalsClick}>Open reviews</button>
            ) : null}
          </div>
        </div>
        {attentionItems.length === 0 ? (
          <p className="ro-blank">Nothing is waiting on you right now.</p>
        ) : (
          <div className="ro-rows">
            {attentionItems.map((item) => (
              <button key={item.id} className="ro-row ro-row-lead" type="button" onClick={onApprovalsClick}>
                <div className="ro-row-copy">
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </div>
                <div className="ro-row-end">
                  <span className="ro-row-aside">{nameFor(item.workerSlug)} · review</span>
                </div>
              </button>
            ))}
          </div>
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
              <button key={item.id} className="ro-row" type="button" onClick={() => onOpenWorkerDetails(item.workerSlug)}>
                <div className="ro-row-copy">
                  <strong>{item.label}</strong>
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
          <h2>Today</h2>
          <button className="ro-textlink" type="button" onClick={() => onNavigate("#app/office/calendar")}>Open calendar</button>
        </div>
        {todaysEvents.length === 0 ? (
          <p className="ro-blank">Nothing on the calendar today.</p>
        ) : (
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
        )}
      </section>

      <section className="ro-sec">
        <div className="ro-sec-head">
          <h2>Around the office</h2>
        </div>
        {workerSnapshots.length === 0 ? (
          <p className="ro-blank">Quiet so far. Work your team does will show up here.</p>
        ) : (
          <div className="ro-rows">
            {workerSnapshots.map((entry) => (
              <button
                key={entry.desk.workerSlug}
                className="ro-row ro-row-worker"
                type="button"
                onClick={() => onOpenWorkerDetails(entry.desk.workerSlug)}
              >
                <div className="ro-worker-snapshot-mark">
                  <WorkerMark seed={entry.desk.workerSlug} size={40} active />
                </div>
                <div className="ro-row-copy">
                  <strong>{entry.worker?.name}</strong>
                  <p>{entry.desk.currentFocus}</p>
                  {entry.activeTask ? <p className="ro-worker-snapshot-sub">In progress: {entry.activeTask.title}</p> : null}
                  {entry.recentWin ? <p className="ro-worker-snapshot-sub">While you were gone: {entry.recentWin.title}</p> : null}
                </div>
                <div className="ro-row-end">
                  <span className="ro-row-aside">{entry.recentMove ? timeAgo(entry.recentMove.createdAt) : "Open desk"}</span>
                  <span className="ro-row-cta">Open desk</span>
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
            {activeAssignments.map((item) => (
              <button key={item.id} className="ro-row" type="button" onClick={() => onOpenWorkerDetails(item.workerSlug)}>
                <div className="ro-row-copy">
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </div>
                <div className="ro-row-end">
                  <span className="ro-row-aside">{nameFor(item.workerSlug)} · {sentenceCase(item.status.replace(/_/g, " "))}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {idleWorkers.length > 0 ? (
        <section className="ro-sec">
          <div className="ro-sec-head">
            <h2>Ready to delegate</h2>
          </div>
          <p className="ro-blank">
            {workers.find((worker) => worker.slug === idleWorkers[0]?.workerSlug)?.name.split(" ")[0] || "A worker"} has capacity. Use the worker desk to assign the next piece of work.
          </p>
        </section>
      ) : null}
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
  onReject: (approvalId: string) => Promise<void>;
  onRunTask: (taskId: string) => Promise<void>;
  onSeedCorrection: (prompt: string) => void;
  onViewDeliverable: (deliverable: WorkerDeskDeliverable) => void;
}) {
  const connectedLabel = canUseEmail
    ? "Connected tools are available."
    : "No connected tools yet.";

  return (
    <>
      <section className="ro-worker-drawer-section">
        <span className="ro-section-kicker">Current focus</span>
        <h3>{desk.currentFocus}</h3>
        <p>{desk.currentFocusReason}</p>
      </section>

      <section className="ro-worker-drawer-section">
        <div className="ro-worker-drawer-row">
          <strong>Responsibilities</strong>
          <span>{activeWorker.profile.responsibilities.length} areas</span>
        </div>
        <div className="ro-plain-list">
          {activeWorker.profile.responsibilities.slice(0, 4).map((item) => (
            <div className="ro-plain-row" key={item}>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="ro-worker-drawer-section">
        <div className="ro-worker-drawer-row">
          <strong>Connected access</strong>
          <span>{connectedLabel}</span>
        </div>
        {desk.connectedTools.length > 0 ? (
          <div className="ro-plain-list">
            {desk.connectedTools.map((tool) => (
              <div className="ro-plain-row" key={`${tool.provider}-${tool.label}`}>
                <strong>{tool.label}</strong>
                <p>{sentenceCase(tool.status)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="ro-worker-note">This worker can still plan, draft, and organize work without connected tools.</p>
        )}
      </section>

      <section className="ro-worker-drawer-section">
        <div className="ro-worker-drawer-row">
          <strong>Waiting on you</strong>
          <span>{desk.waitingOnUser.length === 0 ? "All clear" : `${desk.waitingOnUser.length} item${desk.waitingOnUser.length === 1 ? "" : "s"}`}</span>
        </div>
        {desk.waitingOnUser.length > 0 ? (
          <div className="ro-plain-list">
            {desk.waitingOnUser.map((item) => {
              const approval = desk.approvals.find((entry) => entry.id === item.id);
              return (
                <div className="ro-plain-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                  </div>
                  {approval && isMaraWorker(activeWorker.slug) ? (
                    <div className="ro-inline-actions">
                      <button className="r-btn r-btn-ghost" type="button" onClick={() => void onReject(approval.id)} disabled={busyId === approval.id}>Deny</button>
                      <button className="r-btn r-btn-accent" type="button" onClick={() => void onApprove(approval.id)} disabled={busyId === approval.id}>
                        {busyId === approval.id ? "Saving..." : "Approve"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="ro-worker-note">Nothing is blocked right now.</p>
        )}
      </section>

      <section className="ro-worker-drawer-section">
        <div className="ro-worker-drawer-row">
          <strong>Current work</strong>
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
          <p className="ro-worker-note">Ready for the next assignment.</p>
        )}
      </section>

      <section className="ro-worker-drawer-section">
        <div className="ro-worker-drawer-row">
          <strong>Research completed today</strong>
          <span>{desk.researchToday.length === 0 ? "Nothing yet" : `${desk.researchToday.length} found`}</span>
        </div>
        {desk.researchToday.length > 0 ? (
          <div className="ro-plain-list">
            {desk.researchToday.map((item) => (
              <div className="ro-plain-row" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="ro-worker-note">No fresh research findings have been saved yet today.</p>
        )}
      </section>

      <section className="ro-worker-drawer-section">
        <div className="ro-worker-drawer-row">
          <strong>Lead status</strong>
          <span>{desk.inboxLeads.length === 0 ? "No inbox map yet" : `${desk.inboxLeads.length} tracked`}</span>
        </div>
        {desk.inboxLeads.length > 0 ? (
          <div className="ro-plain-list">
            {desk.inboxLeads.map((item) => (
              <div className="ro-plain-row" key={`${item.brandName}-${item.contactEmail || item.contactName}`}>
                <div>
                  <strong>{item.brandName}</strong>
                  <p>{item.status}{item.contactName ? ` · ${item.contactName}` : ""}</p>
                  <p>{item.snippet}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="ro-worker-note">Connect Gmail and let Mara sync inbox work to organize lead status here.</p>
        )}
      </section>

      <section className="ro-worker-drawer-section">
        <div className="ro-worker-drawer-row">
          <strong>Recent output</strong>
          <span>{desk.recentCompleted.length === 0 ? "Nothing yet" : `${desk.recentCompleted.length} item${desk.recentCompleted.length === 1 ? "" : "s"}`}</span>
        </div>
        {desk.recentCompleted.length > 0 ? (
          <div className="ro-plain-list">
            {desk.recentCompleted.map((item) => (
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
          <p className="ro-worker-note">No deliverables have been completed yet.</p>
        )}
      </section>

      <section className="ro-worker-drawer-section">
        <div className="ro-worker-drawer-row">
          <strong>What {activeWorker.name.split(" ")[0]} knows</strong>
          <span>{desk.memory.length === 0 ? "Learning" : `${desk.memory.length} notes`}</span>
        </div>
        {desk.memory.length > 0 ? (
          <div className="ro-plain-list">
            {desk.memory.map((item) => (
              <div className="ro-plain-row" key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.text}</p>
                </div>
                <button className="ro-inline-link" type="button" onClick={() => onSeedCorrection(`Correction for ${item.label.toLowerCase()}: `)}>
                  Correct in chat
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="ro-worker-note">This worker will learn more as you work together.</p>
        )}
      </section>

      <section className="ro-worker-drawer-section">
        <div className="ro-worker-drawer-row">
          <strong>Access and boundaries</strong>
          <span>{isMaraWorker(activeWorker.slug) ? "Approval-aware" : "Role-based"}</span>
        </div>
        <p className="ro-worker-note">
          {isMaraWorker(activeWorker.slug)
            ? "External or sensitive actions stay behind approval. Safe internal work can move forward without extra prompting."
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
  return (
    <div className="ro-modal-scrim" onClick={onClose}>
      <div className="ro-modal" onClick={(event) => event.stopPropagation()}>
        <h3>{deliverable.title}</h3>
        <div className="ro-field">
          <span>Worker</span>
          <div className="ro-artifact">{workerName}</div>
        </div>
        <div className="ro-field">
          <span>Type</span>
          <div className="ro-artifact">{deliverable.sourceLabel}</div>
        </div>
        <div className="ro-field">
          <span>Summary</span>
          <div className="ro-artifact">{deliverable.summary}</div>
        </div>
        <div className="ro-modal-actions">
          <button className="r-btn r-btn-accent" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
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

  const send = async () => {
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    try {
      await officeJson(`/api/office/workers/${active.slug}/chat`, { method: "POST", body: JSON.stringify({ text: draft.trim() }) });
      setDraft("");
      await reloadOffice();
    } catch {
      /* surfaced via disabled state; keep draft */
    } finally {
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
          <div className="ro-chat-scroll">
            {thread.length === 0 ? (
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
                  {m.author === "Worker" && <WorkerMark seed={active.slug} size={26} />}
                  <div className="ro-bubble">{m.text}<time>{clock(m.timestamp)}</time></div>
                </div>
              ))
            )}
          </div>
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
  onChange
}: {
  active: WorkbenchSection;
  onChange: (section: WorkbenchSection) => void;
}) {
  const items: WorkbenchSection[] = ["desk", "conversation", "knowledge", "history"];
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
  onSeedCorrection
}: {
  activeWorker: Worker;
  connectedTools: OverlayIntegration[];
  desk: WorkerDesk;
  onSeedCorrection: (prompt: string) => void;
}) {
  return (
    <div className="ro-plain-list">
      {desk.memory.length === 0 ? (
        <p className="ro-blank">Nothing here yet. Workers add what they learn; you can correct anything in conversation.</p>
      ) : (
        desk.memory.map((item) => (
          <div className="ro-plain-row" key={item.id}>
            <strong>{item.text}</strong>
            <div className="ro-handbook-meta">
              <span>Learned while working with {activeWorker.name.split(" ")[0]}</span>
              <button className="ro-inline-link" type="button" onClick={() => onSeedCorrection(`Correction for ${item.label.toLowerCase()}: `)}>
                Correct in conversation
              </button>
            </div>
          </div>
        ))
      )}

      {connectedTools.length > 0 ? (
        <>
          <div className="ro-sec-gap" />
          {connectedTools.map((tool) => (
            <div className="ro-plain-row" key={`${tool.provider}-${tool.accountLabel}`}>
              <strong>{tool.accountLabel || tool.provider}</strong>
              <div className="ro-handbook-meta">
                <span>{sentenceCase(tool.status)} · source</span>
              </div>
            </div>
          ))}
        </>
      ) : null}
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

function WorkerDeskView({
  activeWorker,
  busyId,
  canUseEmail,
  connectedTools,
  desk,
  overlays,
  onApprove,
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
  overlays: Overlays;
  onApprove: (approvalId: string) => Promise<void>;
  onNavigate: (hash: string) => void;
  onReject: (approvalId: string) => Promise<void>;
  onRunTask: (taskId: string) => Promise<void>;
  onSeedCorrection: (prompt: string) => void;
  onReload: () => Promise<void>;
  section: WorkbenchSection;
}) {
  const [selectedDeliverable, setSelectedDeliverable] = useState<WorkerDeskDeliverable | null>(null);
  const nextRunnable = desk.workInMotion[0] ?? null;
  const setSection = (nextSection: WorkbenchSection) => onNavigate(`#app/office/workers/${activeWorker.slug}/${nextSection}`);
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
          onSeedCorrection={onSeedCorrection}
        />
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
          <button className="r-btn r-btn-ghost" type="button" onClick={() => setSection("conversation")}>Message</button>
          {isMaraWorker(activeWorker.slug) && nextRunnable ? (
            <button className="r-btn r-btn-accent" type="button" onClick={() => void onRunTask(nextRunnable.id)} disabled={busyId === nextRunnable.id}>
              {busyId === nextRunnable.id ? "Running..." : "Run next task"}
            </button>
          ) : (
            <button className="r-btn r-btn-accent" type="button" onClick={() => setSection("conversation")}>Assign work</button>
          )}
        </div>
      </header>

      <div className="ro-worker-page-layout">
        <WorkbenchTabNav active={section} onChange={setSection} />
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

function ApprovalsView({
  workers, overlays, onNavigate, onReload,
}: {
  workers: Worker[]; overlays: Overlays; onNavigate: (h: string) => void; onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const pending = overlays.tasks.filter((t) => t.status === "Needs Review");
  const suggestedApprovals = overlays.suggestedActions.filter((action) => action.status === "suggested" && action.requiresApproval);
  const nameFor = (slug: string) => workers.find((w) => w.slug === slug)?.name ?? "Worker";

  const approveTask = async (t: OverlayTask) => {
    setBusy(t.id);
    try {
      await officeJson(`/api/office/workers/${t.workerSlug}/tasks/${t.id}/status`, { method: "POST", body: JSON.stringify({ status: "Completed" }) });
      await onReload();
    } finally { setBusy(null); }
  };
  const briefingAction = async (b: OverlayBriefing, action: string) => {
    setBusy(b.id);
    try {
      await officeJson(`/api/office/workers/${b.workerSlug}/briefings/${b.id}/action`, { method: "POST", body: JSON.stringify({ action }) });
      await onReload();
    } finally { setBusy(null); }
  };

  const total = pending.length + overlays.briefings.length + suggestedApprovals.length;

  return (
    <div className="ro-main-scroll">
      <header className="ro-page-head">
        <h1>Reviews</h1>
        <p className="ro-page-meta">{total === 0 ? "Nothing waiting on your sign-off" : `${total} item${total === 1 ? "" : "s"} · newest first`}</p>
      </header>

      {total === 0 ? (
        <p className="ro-blank">You're all caught up.</p>
      ) : (
        <div className="ro-appr-list">
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
              <p className="ro-appr-reason">{t.module}</p>
              <div className="ro-appr-actions">
                <button className="r-btn r-btn-accent" type="button" disabled={busy === t.id} onClick={() => void approveTask(t)}>{busy === t.id ? "Saving..." : "Approve"}</button>
                <button className="ro-textlink" type="button" onClick={() => onNavigate(`#app/office/workers/${t.workerSlug}/conversation`)}>Request changes</button>
              </div>
            </article>
          ))}

          {overlays.briefings.map((b) => {
            const decisions = safeList(b.decisionsJson);
            return (
              <article className="ro-appr" key={b.id}>
                <div className="ro-appr-meta">{nameFor(b.workerSlug)} · Briefing · {b.dateLabel}</div>
                <h3>{b.title}</h3>
                <p>{normalizeOfficeCopy(b.summary || "Ready for your review.")}</p>
                {decisions.length > 0 && (
                  <ul className="ro-appr-points">
                    {decisions.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                )}
                <div className="ro-appr-actions">
                  <button className="r-btn r-btn-accent" type="button" disabled={busy === b.id} onClick={() => void briefingAction(b, "approve")}>{busy === b.id ? "Saving..." : "Approve"}</button>
                  <button className="ro-textlink" type="button" disabled={busy === b.id} onClick={() => void briefingAction(b, "followup")}>Send back</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
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
  const nameFor = (slug: string) => workers.find((worker) => worker.slug === slug)?.name ?? "Worker";
  const tasks = overlays.assignments;
  const groups = [
    {
      items: tasks.filter((task) => task.status === "in_review" || task.status === "blocked"),
      label: "Needs you"
    },
    {
      items: tasks.filter((task) => task.status === "queued" || task.status === "in_progress"),
      label: "In motion"
    },
    {
      items: tasks.filter((task) => task.status === "done").slice(0, 10),
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
        groups.map((group) => (
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
                  onClick={() => onNavigate(`#app/office/workers/${task.workerSlug}/desk`)}
                >
                  <div className="ro-row-copy">
                    <strong>{task.title}</strong>
                    <p>{task.summary || sentenceCase(task.sourceLabel.replace(/_/g, " "))}</p>
                  </div>
                  <div className="ro-row-end">
                    <span className="ro-row-aside">{nameFor(task.workerSlug)}{task.dueAt ? ` · due ${task.dueAt}` : ""}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
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

      <section className="ro-sec">
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
  return (
    <div className="ro-main-scroll">
      <header className="ro-page-head">
        <h1>Workers</h1>
        <p className="ro-page-meta">{workers.length} {workers.length === 1 ? "worker" : "workers"} on the clock</p>
      </header>

      <div className="ro-rows">
        {workers.map((w) => {
          const focus = desks.find((desk) => desk.workerSlug === w.slug)?.currentFocus || lastActivityFor(w.slug, overlays.worklog);
          return (
            <div
              className="ro-row ro-row-person"
              key={w.slug}
              role="button"
              tabIndex={0}
              onClick={() => onNavigate(`#app/office/workers/${w.slug}/desk`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onNavigate(`#app/office/workers/${w.slug}/desk`);
                }
              }}
            >
              <WorkerMark seed={w.slug} size={44} active />
              <div className="ro-row-copy">
                <strong>{w.name}</strong>
                <p>{w.title} · {focus}</p>
              </div>
              <div className="ro-row-end">
                <span className="ro-row-aside">{w.salary}</span>
                  <button
                    className="ro-textlink"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onNavigate(`#app/office/workers/${w.slug}/conversation`);
                    }}
                  >
                    Message
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button className="ro-textlink ro-hire-link" type="button" onClick={() => onNavigate("#workers")}>
        Hire from the marketplace →
      </button>

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
  );
}

/* ---------- Deliverables ---------- */

function DeliverablesView({ workers, overlays, onNavigate }: { workers: Worker[]; overlays: Overlays; onNavigate: (h: string) => void }) {
  const nameFor = (slug: string) => workers.find((w) => w.slug === slug)?.name ?? "Worker";
  return (
    <div className="ro-main-scroll">
      <header className="ro-page-head">
        <h1>Deliverables</h1>
        <p className="ro-page-meta">
          {overlays.deliverables.length === 0 ? "No finished work yet" : `${overlays.deliverables.length} deliverable${overlays.deliverables.length === 1 ? "" : "s"} saved by your workers`}
        </p>
      </header>
      {overlays.deliverables.length === 0 ? (
        <p className="ro-blank">
          Deliverables your workers create automatically will collect here.
          {workers.length === 0 && <> <button className="ro-textlink" type="button" onClick={() => onNavigate("#workers")}>Hire a worker to get started</button></>}
        </p>
      ) : (
        <div className="ro-rows">
          {overlays.deliverables.map((deliverable) => (
            <button
              className="ro-row ro-row-slim"
              key={deliverable.id}
              type="button"
              onClick={() => onNavigate(`#app/office/workers/${deliverable.workerSlug}/desk`)}
            >
              <div className="ro-row-copy">
                <strong>{deliverable.title}</strong>
                <p>{deliverable.summary || deliverable.previewText}</p>
              </div>
              <span className="ro-row-aside">{nameFor(deliverable.workerSlug)} · {timeAgo(deliverable.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}
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

  useEffect(() => {
    setBrandContext(parsed.brandContext ?? "");
    setTimezone(parsed.timezone ?? "America/New_York");
    setQuietHours(parsed.quietHours ?? "");
    setReviewCadence(parsed.reviewCadence ?? "Weekly");
    setDecisionStyle(parsed.decisionStyle ?? "");
  }, [parsed]);

  const save = async () => {
    setBusy(true); setSaved(false);
    try {
      await officeJson("/api/office/settings", {
        method: "POST",
        body: JSON.stringify({ settings: { ...parsed, brandContext, timezone, quietHours, reviewCadence, decisionStyle } }),
      });
      await onReload();
      setSaved(true);
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
          <button className="r-btn r-btn-accent" type="button" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- shell ---------- */

export function OfficeExperienceApp({ allWorkers, hiredWorkers, onNavigate, onNotice, userName }: OfficeExperienceAppProps) {
  const [route, setRoute] = useState(() => parseOfficeRoute(window.location.hash));
  const [overlays, setOverlays] = useState<Overlays>(EMPTY_OVERLAYS);
  const [loading, setLoading] = useState(true);
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
    } catch {
      setOverlays(EMPTY_OVERLAYS);
    }
  }, []);

  useEffect(() => { void (async () => { setLoading(true); await reload(); setLoading(false); })(); }, [reload]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspaces = async () => {
      const maraWorkers = hiredWorkers.filter((worker) => isMaraWorker(worker.slug));
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

  useEffect(() => {
    if (loading || !firstIncompleteWorker) {
      return;
    }

    if (tab === "worker-onboarding" && workerSlug === firstIncompleteWorker.slug) {
      return;
    }

    if (tab === "settings") {
      return;
    }

    go(`#app/office/workers/${firstIncompleteWorker.slug}/onboarding`);
  }, [firstIncompleteWorker, go, loading, tab, workerSlug]);

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

  const runWorkerTask = useCallback(async (workerSlugParam: string, taskId: string) => {
    if (!isMaraWorker(workerSlugParam)) return;
    setWorkerActionBusy(taskId);
    try {
      await officeJson(`/api/office/workers/${workerSlugParam}/tasks/${taskId}/run`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await reload();
    } finally {
      setWorkerActionBusy(null);
    }
  }, [reload]);

  const updateWorkerApproval = useCallback(async (workerSlugParam: string, approvalId: string, status: "approved" | "rejected") => {
    if (!isMaraWorker(workerSlugParam)) return;
    setWorkerActionBusy(approvalId);
    try {
      await officeJson(`/api/office/workers/${workerSlugParam}/approval-requests/${approvalId}/status`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
      await reload();
    } finally {
      setWorkerActionBusy(null);
    }
  }, [reload]);

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
          await officeJson(`/api/office/workers/${worker.slug}/onboarding/complete`, {
            method: "POST",
            body: JSON.stringify(payload)
          });
          await reload();
          onNotice(payload.generatedSummary.length > 0 ? payload.generatedSummary[0] : payload.worklogEntry.result);
          go(`#app/office/workers/${worker.slug}/conversation`);
        }}
        onSaveProgress={async (payload) => {
          await officeJson(`/api/office/workers/${worker.slug}/onboarding/save`, {
            method: "POST",
            body: JSON.stringify(payload)
          });
        }}
        onStartFirstDay={(notice) => {
          onNotice(notice);
          go(`#app/office/workers/${worker.slug}/conversation`);
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
              canUseEmail={overlays.integrations.some((integration) => integration.workerSlug === activeWorker.slug && integration.status === "connected")}
              connectedTools={overlays.integrations.filter((integration) => integration.workerSlug === activeWorker.slug)}
              desk={activeDesk}
              overlays={overlays}
              onApprove={(approvalId) => updateWorkerApproval(activeWorker.slug, approvalId, "approved")}
              onNavigate={go}
              onReject={(approvalId) => updateWorkerApproval(activeWorker.slug, approvalId, "rejected")}
              onReload={reload}
              onRunTask={(taskId) => runWorkerTask(activeWorker.slug, taskId)}
              onSeedCorrection={(prompt) => {
                go(`#app/office/workers/${activeWorker.slug}/conversation`);
                window.setTimeout(() => {
                  const event = new CustomEvent("ryva-office-seed-draft", { detail: { prompt } });
                  window.dispatchEvent(event);
                }, 0);
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
    overlays.tasks.filter((t) => t.status === "Needs Review").length +
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

      <main className="ro-main">{main}</main>
    </div>
  );
}
