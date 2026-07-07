import { useCallback, useEffect, useMemo, useState } from "react";
import type { OnboardingSessionState } from "../onboardingSchemas";
import type { Worker } from "../types";
import { WorkerOnboardingPage } from "./WorkerOnboardingPage";
import { WorkerMark } from "./WorkerMark";

/* ============================================================
   Ryva Office — manager's command center
   Tabs: Today · Chat · Approvals · Calendar · Team · Files · Settings
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
  runnableTasks: MaraWorkspaceTask[];
  waitingOnUser: MaraWorkspaceWaitingItem[];
  whatMaraKnows: MaraWorkspaceKnowledge[];
};

type Overlays = {
  chats: OverlayChat[];
  tasks: OverlayTask[];
  suggestedActions: OverlaySuggestedAction[];
  worklog: OverlayWorklog[];
  files: OverlayFile[];
  briefings: OverlayBriefing[];
  calendarEvents: OverlayCalendarEvent[];
  globalSettings: OverlayGlobalSettings;
  integrations: OverlayIntegration[];
  onboarding: OverlayOnboarding[];
};

const EMPTY_OVERLAYS: Overlays = {
  chats: [], tasks: [], suggestedActions: [], worklog: [], files: [], briefings: [], calendarEvents: [], globalSettings: null, integrations: [], onboarding: [],
};

type Tab = "today" | "chat" | "approvals" | "calendar" | "team" | "files" | "settings" | "worker-onboarding";
const WORKER_DEPENDENT: Tab[] = ["today", "chat", "approvals", "team", "files"];
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

function parseOfficeRoute(hash: string): { tab: Tab; workerSlug: string | null } {
  const parts = hash.replace(/^#/, "").replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts[0] !== "app" || parts[1] !== "office") return { tab: "today", workerSlug: null };
  if (parts[2] === "workers" && parts[3] && parts[4] === "onboarding") {
    return { tab: "worker-onboarding", workerSlug: parts[3] };
  }
  const raw = parts[2] as Tab | undefined;
  const tab: Tab = (["today", "chat", "approvals", "calendar", "team", "files", "settings"] as Tab[]).includes(raw as Tab) ? (raw as Tab) : "today";
  return { tab, workerSlug: parts[3] ?? null };
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
  { tab: "chat", label: "Chat", icon: <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" /> },
  { tab: "approvals", label: "Approvals", icon: <><path d="M9 12l2 2 4-5" /><circle cx="12" cy="12" r="9" /></> },
  { tab: "calendar", label: "Calendar", icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></> },
  { tab: "team", label: "Team", icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 15.2c2.6.2 4.6 1.8 5.3 4.3" /></> },
  { tab: "files", label: "Files", icon: <path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /> },
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
  userName, workers, overlays, onNavigate, onApprovalsClick,
}: {
  userName: string; workers: Worker[]; overlays: Overlays;
  onNavigate: (h: string) => void; onApprovalsClick: () => void;
}) {
  const pendingTasks = overlays.tasks.filter((t) => t.status === "Needs Review");
  const suggestedApprovals = overlays.suggestedActions.filter((action) => action.status === "suggested" && action.requiresApproval);
  const approvalsCount = pendingTasks.length + overlays.briefings.length + suggestedApprovals.length;
  const today = new Date();
  const todaysEvents = overlays.calendarEvents
    .filter((e) => new Date(e.startsAt).toDateString() === today.toDateString())
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  return (
    <div className="ro-main-scroll">
      <div className="ro-day-head">
        <h1>Good {today.getHours() < 12 ? "morning" : today.getHours() < 18 ? "afternoon" : "evening"}, <em>{userName.split(" ")[0]}.</em></h1>
        <div className="ro-clockline">
          <span className="ro-live-dot" />
          <span>{workers.length} {workers.length === 1 ? "worker" : "workers"} on the clock</span>
        </div>
      </div>

      <div className="ro-today-grid">
        <div>
          <button className="ro-panel-title ro-linkrow" type="button" onClick={onApprovalsClick}>
            Waiting on you <span className="n">{approvalsCount === 0 ? "all clear" : `${approvalsCount} ${approvalsCount === 1 ? "item" : "items"}`}</span>
          </button>
          {approvalsCount === 0 ? (
            <div className="ro-quiet-card">Nothing needs your sign-off right now.</div>
          ) : (
            <>
              {pendingTasks.slice(0, 3).map((t) => (
                <button key={t.id} className="ro-appr-mini" type="button" onClick={onApprovalsClick}>
                  <WorkerMark seed={t.workerSlug} size={22} />
                  <div><b>{t.title}</b><span>{t.module} · needs review</span></div>
                </button>
              ))}
              {overlays.briefings.slice(0, 2).map((b) => (
                <button key={b.id} className="ro-appr-mini" type="button" onClick={onApprovalsClick}>
                  <WorkerMark seed={b.workerSlug} size={22} />
                  <div><b>{b.title}</b><span>{b.dateLabel} · briefing</span></div>
                </button>
              ))}
            </>
          )}

          <div className="ro-panel-title" style={{ marginTop: 30 }}>Happening today</div>
          {overlays.worklog.length === 0 ? (
            <div className="ro-quiet-card">No activity logged yet. As your workers act, it shows up here.</div>
          ) : (
            <div className="ro-feed">
              {overlays.worklog.slice(0, 8).map((w) => (
                <div className="ro-event" key={w.id}>
                  <WorkerMark seed={w.workerSlug} size={26} />
                  <div className="ro-event-body">{w.action} {w.result && <span className="ro-event-obj">{w.result}</span>}</div>
                  <time>{timeAgo(w.timestamp)}</time>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="ro-sched-card">
          <div className="ro-panel-title">Today's calendar</div>
          {todaysEvents.length === 0 ? (
            <div className="ro-quiet-card">Nothing scheduled.
              <button className="ro-inline-link" type="button" onClick={() => onNavigate("#app/office/calendar")}>Open calendar</button>
            </div>
          ) : (
            <div className="ro-today-events">
              {todaysEvents.map((e) => (
                <button key={e.id} className="ro-today-event" type="button" onClick={() => onNavigate("#app/office/calendar")}>
                  <span className="t">{clock(e.startsAt)}</span>
                  <span className="ev">{e.workerSlug && <WorkerMark seed={e.workerSlug} size={14} />}{e.title}</span>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ---------- Chat ---------- */

function MaraWorkspacePanel({
  busyId,
  canUseEmail,
  onApprove,
  onCreateRecommendedTask,
  onCreateNext,
  onDismissTask,
  onDismissRecommendation,
  onReject,
  onRunTask,
  onSeedCorrection,
  onViewOutput,
  recommendationDismissed,
  workspace,
}: {
  busyId: string | null;
  canUseEmail: boolean;
  onApprove: (approvalId: string) => Promise<void>;
  onCreateRecommendedTask: (task: { title: string; description: string; priority: string }) => Promise<void>;
  onCreateNext: (prompt: string) => void;
  onDismissTask: (taskId: string) => Promise<void>;
  onDismissRecommendation: () => void;
  onReject: (approvalId: string) => Promise<void>;
  onRunTask: (taskId: string) => Promise<void>;
  onSeedCorrection: (prompt: string) => void;
  onViewOutput: (task: MaraWorkspaceOutput) => void;
  recommendationDismissed: boolean;
  workspace: MaraWorkspace | null;
}) {
  const readyLabel = canUseEmail
    ? "Inbox access is connected. Mara can work from office chat, memory, tasks, and inbox-aware follow-up."
    : "Inbox access is not connected. Mara can still work from office chat, memory, tasks, and structured outputs. Connect Gmail or Outlook later if you want inbox review.";

  const recommendedNext = recommendationDismissed ? null : workspace?.recommendedNext ?? null;
  const recommendedAction = recommendedNext?.label ?? "";
  const topOutput = workspace?.latestOutputs[0] ?? null;
  const focusLabel = workspace?.currentFocus && !workspace.currentFocus.startsWith("Mara is")
    ? `Mara is focused on ${workspace.currentFocus}.`
    : workspace?.currentFocus || "Mara is ready for her first assignment.";

  return (
    <section className="ro-mara-presence" aria-label="Mara's desk">
      <div className="ro-mara-focus">
        <div>
          <span className="ro-mara-eyebrow">Mara's desk</span>
          <strong>{focusLabel}</strong>
          <p>
            {workspace?.currentWork
              ? `On Mara's plate: ${workspace.currentWork.title}.`
              : workspace?.waitingOnUser[0]
                ? `Waiting on you: ${workspace.waitingOnUser[0].title}.`
                : "Mara is ready for her next assignment."}
          </p>
        </div>
        <div className="ro-mara-focus-actions">
          {workspace?.recommendedNextTaskToRun ? (
            <button
              className="r-btn r-btn-accent"
              type="button"
              onClick={() => void onRunTask(workspace.recommendedNextTaskToRun!.id)}
              disabled={busyId === workspace.recommendedNextTaskToRun.id}
            >
              {busyId === workspace.recommendedNextTaskToRun.id ? "Running..." : "Run next task"}
            </button>
          ) : null}
          {topOutput ? (
            <button className="r-btn r-btn-ghost" type="button" onClick={() => onViewOutput(topOutput)}>
              View latest output
            </button>
          ) : null}
        </div>
      </div>

      <div className="ro-mara-capability">
        <strong>{canUseEmail ? "Inbox access connected" : "Inbox access not connected"}</strong>
        <p>{readyLabel}</p>
      </div>

      <div className="ro-mara-grid">
        <section className="ro-mara-section">
          <div className="ro-mara-section-head">
            <h3>Waiting on you</h3>
            <span>{workspace?.waitingOnUser.length ? `${Math.min(workspace.waitingOnUser.length, 3)} items` : "All clear"}</span>
          </div>
          {workspace?.waitingOnUser.length ? (
            workspace.waitingOnUser.slice(0, 3).map((item) => {
              const approval = workspace.pendingApprovals.find((request) => request.id === item.id);
              return (
                <div className="ro-mara-item" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    {item.blockerReason ? <p className="ro-mara-subnote">{item.blockerReason}</p> : null}
                    {item.nextStep ? <p className="ro-mara-nextstep">Next: {item.nextStep}</p> : null}
                  </div>
                  {approval ? (
                    <div className="ro-mara-item-actions">
                      <button className="r-btn r-btn-ghost" type="button" onClick={() => void onReject(approval.id)} disabled={busyId === approval.id}>
                        Reject
                      </button>
                      <button className="r-btn r-btn-accent" type="button" onClick={() => void onApprove(approval.id)} disabled={busyId === approval.id}>
                        {busyId === approval.id ? "Saving..." : "Approve"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="ro-mara-empty">No approvals needed right now. Nothing is blocking Mara right now.</div>
          )}
        </section>

        <section className="ro-mara-section">
          <div className="ro-mara-section-head">
            <h3>Mara just finished</h3>
            <span>{workspace?.latestOutputs.length ? `${workspace.latestOutputs.length} outputs` : "Nothing yet"}</span>
          </div>
          {workspace?.latestOutputs.length ? (
            workspace.latestOutputs.slice(0, 3).map((task) => (
              <button className="ro-mara-output" type="button" key={task.id} onClick={() => onViewOutput(task)}>
                <strong>{task.title}</strong>
                <p>{task.outputPreview?.preview || "Output ready to review."}</p>
                <span>View output</span>
              </button>
            ))
          ) : (
            <div className="ro-mara-empty">Mara has not completed work yet. Start by running her first task.</div>
          )}
        </section>

        <section className="ro-mara-section">
          <div className="ro-mara-section-head">
            <h3>Mara learned</h3>
            <span>{workspace?.whatMaraKnows.length ? `${workspace.whatMaraKnows.length} memory items` : "Still learning"}</span>
          </div>
          {workspace?.whatMaraKnows.length ? (
            workspace.whatMaraKnows.slice(0, 5).map((section) => (
              <div className="ro-mara-memory" key={section.friendlyLabel}>
                <strong>{section.friendlyLabel}</strong>
                <p>{section.items[0] || "No saved detail yet."}</p>
                <button className="ro-inline-link" type="button" onClick={() => onSeedCorrection(`Correction for ${section.friendlyLabel.toLowerCase()}: `)}>
                  Correct in chat
                </button>
              </div>
            ))
          ) : (
            <div className="ro-mara-empty">Mara will learn your preferences as you work together.</div>
          )}
        </section>

        <section className="ro-mara-section">
          <div className="ro-mara-section-head">
            <h3>Recommended next</h3>
            <span>{recommendedAction ? "Ready" : "Waiting"}</span>
          </div>
          {recommendedAction ? (
            <div className="ro-mara-item">
              <div>
                <strong>{recommendedAction}</strong>
                <p>
                  {workspace?.recommendedNextTaskToRun
                    ? "This is a safe internal task Mara can run right now."
                    : "This is the clearest next move based on what Mara has learned so far."}
                </p>
              </div>
              <div className="ro-mara-item-actions">
                <button
                  className="r-btn r-btn-ghost"
                  type="button"
                  onClick={() => {
                    if (recommendedNext?.taskId) {
                      void onDismissTask(recommendedNext.taskId);
                      return;
                    }
                    onDismissRecommendation();
                  }}
                >
                  Dismiss
                </button>
                {recommendedNext?.approvalId ? (
                  <button
                    className="r-btn r-btn-accent"
                    type="button"
                    onClick={() => void onApprove(recommendedNext.approvalId!)}
                    disabled={busyId === recommendedNext.approvalId}
                  >
                    {busyId === recommendedNext.approvalId ? "Saving..." : "Approve"}
                  </button>
                ) : workspace?.recommendedNextTaskToRun ? (
                  <button
                    className="r-btn r-btn-accent"
                    type="button"
                    onClick={() => void onRunTask(workspace.recommendedNextTaskToRun!.id)}
                    disabled={busyId === workspace.recommendedNextTaskToRun.id}
                  >
                    {busyId === workspace.recommendedNextTaskToRun.id ? "Running..." : "Run task"}
                  </button>
                ) : recommendedNext?.createTask ? (
                  <button
                    className="r-btn r-btn-accent"
                    type="button"
                    onClick={() => void onCreateRecommendedTask(recommendedNext.createTask!)}
                  >
                    {recommendedNext.actionLabel || "Create next task"}
                  </button>
                ) : (
                  <button
                    className="r-btn r-btn-accent"
                    type="button"
                    onClick={() => onCreateNext(recommendedNext?.prompt || `Let's make this the next thing on Mara's plate: ${recommendedAction}.`)}
                  >
                    {recommendedNext?.actionLabel || "Create in chat"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="ro-mara-empty">Mara is ready for her next assignment.</div>
          )}
        </section>
      </div>

      <div className="ro-mara-grid ro-mara-grid-compact">
        <section className="ro-mara-section">
          <div className="ro-mara-section-head">
            <h3>Mara just did</h3>
            <span>{workspace?.recentActivity.length ? `${workspace.recentActivity.length} events` : "Quiet"}</span>
          </div>
          {workspace?.recentActivity.length ? (
            <div className="ro-mara-feed">
              {workspace.recentActivity.slice(0, 5).map((entry) => (
                <div className="ro-mara-feed-item" key={entry.id}>
                  <strong>{entry.title}</strong>
                  <p>{entry.description}</p>
                  <time>{timeAgo(entry.createdAt)}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="ro-mara-empty">No recent worker activity yet.</div>
          )}
        </section>

        <section className="ro-mara-section">
          <div className="ro-mara-section-head">
            <h3>On Mara's plate</h3>
            <span>{workspace?.runnableTasks.length ? `${workspace.runnableTasks.length} runnable` : "No open tasks"}</span>
          </div>
          {workspace?.runnableTasks.length ? (
            workspace.runnableTasks.slice(0, 3).map((task) => (
              <div className="ro-mara-item" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.description}</p>
                </div>
                <div className="ro-mara-item-actions">
                  <button className="r-btn r-btn-ghost" type="button" onClick={() => onSeedCorrection(`Let's work on ${task.title.toLowerCase()}. `)}>
                    Open in chat
                  </button>
                  <button className="r-btn r-btn-accent" type="button" onClick={() => void onRunTask(task.id)} disabled={busyId === task.id}>
                    {busyId === task.id ? "Running..." : "Run task"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="ro-mara-empty">Mara is ready for her first assignment.</div>
          )}
        </section>
      </div>
    </section>
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

function ChatView({
  workers, overlays, selectedSlug, onNavigate, onReload,
}: {
  workers: Worker[]; overlays: Overlays; selectedSlug: string | null;
  onNavigate: (h: string) => void; onReload: () => Promise<void>;
}) {
  const active = workers.find((w) => w.slug === selectedSlug) ?? workers[0] ?? null;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [workspace, setWorkspace] = useState<MaraWorkspace | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [busyWorkspaceAction, setBusyWorkspaceAction] = useState<string | null>(null);
  const [selectedOutput, setSelectedOutput] = useState<MaraWorkspaceOutput | null>(null);
  const [recommendationDismissed, setRecommendationDismissed] = useState(false);
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
    let cancelled = false;

    const loadWorkspace = async () => {
      if (active?.slug !== "mara-vale") {
        setWorkspace(null);
        setWorkspaceLoading(false);
        return;
      }

      setWorkspaceLoading(true);
      try {
        const payload = await officeJson<{ workspace: MaraWorkspace }>(`/api/office/workers/${active.slug}/workspace`);
        if (!cancelled) {
          setWorkspace(payload.workspace);
        }
      } catch {
        if (!cancelled) {
          setWorkspace(null);
        }
      } finally {
        if (!cancelled) {
          setWorkspaceLoading(false);
        }
      }
    };

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [active?.slug]);

  useEffect(() => {
    setRecommendationDismissed(false);
  }, [workspace?.recommendedNextActions?.[0], active?.slug]);

  const reloadOffice = useCallback(async () => {
    await onReload();
    if (active?.slug === "mara-vale") {
      const payload = await officeJson<{ workspace: MaraWorkspace }>(`/api/office/workers/${active.slug}/workspace`);
      setWorkspace(payload.workspace);
    }
  }, [active?.slug, onReload]);

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

  const runTask = async (taskId: string) => {
    if (!active) return;
    setBusyWorkspaceAction(taskId);
    try {
      await officeJson(`/api/office/workers/${active.slug}/tasks/${taskId}/run`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await reloadOffice();
    } finally {
      setBusyWorkspaceAction(null);
    }
  };

  const dismissTask = async (taskId: string) => {
    if (!active) return;
    setBusyWorkspaceAction(taskId);
    try {
      await officeJson(`/api/office/workers/${active.slug}/tasks/${taskId}/dismiss`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await reloadOffice();
      setRecommendationDismissed(true);
    } finally {
      setBusyWorkspaceAction(null);
    }
  };

  const createRecommendedTask = async (task: { title: string; description: string; priority: string }) => {
    if (!active) return;
    setBusyWorkspaceAction(task.title);
    try {
      await officeJson(`/api/office/workers/${active.slug}/recommended-next/create`, {
        method: "POST",
        body: JSON.stringify(task)
      });
      await reloadOffice();
    } finally {
      setBusyWorkspaceAction(null);
    }
  };

  const updateApproval = async (approvalId: string, status: "approved" | "rejected") => {
    if (!active) return;
    setBusyWorkspaceAction(approvalId);
    try {
      await officeJson(`/api/office/workers/${active.slug}/approval-requests/${approvalId}/status`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
      await reloadOffice();
    } finally {
      setBusyWorkspaceAction(null);
    }
  };

  return (
    <div className="ro-chat">
      <div className="ro-chat-list">
        <div className="ro-panel-title" style={{ padding: "0 4px 12px" }}>Threads</div>
        {workers.map((w) => (
          <button
            key={w.slug}
            className={`ro-thread${active?.slug === w.slug ? " on" : ""}`}
            type="button"
            onClick={() => onNavigate(`#app/office/chat/${w.slug}`)}
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
          </div>
          <div className="ro-chat-scroll">
            {active.slug === "mara-vale" ? (
              workspaceLoading ? (
                <div className="ro-capability-card">
                  <strong>Loading Mara's desk</strong>
                  <p>Pulling Mara's current work, memory, approvals, and latest outputs.</p>
                </div>
              ) : (
                <MaraWorkspacePanel
                  busyId={busyWorkspaceAction}
                  canUseEmail={canUseEmail}
                  onApprove={async (approvalId) => updateApproval(approvalId, "approved")}
                  onCreateRecommendedTask={createRecommendedTask}
                  onCreateNext={(prompt) => setDraft(prompt)}
                  onDismissTask={dismissTask}
                  onDismissRecommendation={() => setRecommendationDismissed(true)}
                  onReject={async (approvalId) => updateApproval(approvalId, "rejected")}
                  onRunTask={runTask}
                  onSeedCorrection={(prompt) => setDraft(prompt)}
                  onViewOutput={setSelectedOutput}
                  recommendationDismissed={recommendationDismissed}
                  workspace={workspace}
                />
              )
            ) : null}
            {thread.length === 0 ? (
              <div className="ro-chat-intro">
                <WorkerMark seed={active.slug} size={52} />
                <p>This is the start of your thread with {active.name.split(" ")[0]}. Give direction, ask for status, or set priorities.</p>
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
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
              placeholder={`Message ${active.name.split(" ")[0]}…`}
            />
            <button className="r-btn r-btn-accent" type="button" onClick={() => void send()} disabled={sending || !draft.trim()}>
              Send
            </button>
          </div>
          {selectedOutput ? <MaraOutputModal task={selectedOutput} onClose={() => setSelectedOutput(null)} /> : null}
        </div>
      ) : (
        <div className="ro-chat-main"><EmptyOffice label="your conversations" onNavigate={onNavigate} /></div>
      )}
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
  if (total === 0) {
    return (
      <div className="ro-main-scroll">
        <div className="ro-day-head"><h1>Approvals</h1></div>
        <div className="ro-quiet-card ro-quiet-lg">You're all caught up. Nothing is waiting on your sign-off.</div>
      </div>
    );
  }

  return (
    <div className="ro-main-scroll">
      <div className="ro-day-head"><h1>Approvals <em>({total})</em></h1></div>

      {suggestedApprovals.map((action) => (
        <div className="ro-approval" key={action.id}>
          <div className="ro-appr-head">
            <WorkerMark seed={action.workerSlug} size={22} />
            <b>{nameFor(action.workerSlug)}</b><span>{action.actionType.replace(/_/g, " ")}</span>
            <time>{timeAgo(action.createdAt)}</time>
          </div>
          <div className="ro-artifact">
            <span className="ro-alabel">{action.title}</span>
            {action.description}
            <div className="ro-decisions"><span>• {action.reason}</span></div>
          </div>
          <div className="ro-appr-actions">
            <button className="r-btn r-btn-accent" type="button" style={{ fontSize: 13, padding: "8px 18px" }} onClick={() => onNavigate(`#app/office/chat/${action.workerSlug}`)}>
              Open worker
            </button>
          </div>
        </div>
      ))}

      {pending.map((t) => (
        <div className="ro-approval" key={t.id}>
          <div className="ro-appr-head">
            <WorkerMark seed={t.workerSlug} size={22} />
            <b>{nameFor(t.workerSlug)}</b><span>needs review</span>
            <time>{t.dueDate}</time>
          </div>
          <div className="ro-artifact"><span className="ro-alabel">{t.module}</span>{t.title}</div>
          <div className="ro-appr-actions">
            <button className="r-btn r-btn-accent" type="button" disabled={busy === t.id} onClick={() => void approveTask(t)} style={{ fontSize: 13, padding: "8px 18px" }}>Approve</button>
            <button className="r-btn r-btn-ghost" type="button" onClick={() => onNavigate(`#app/office/chat/${t.workerSlug}`)} style={{ fontSize: 13, padding: "8px 18px" }}>Discuss</button>
          </div>
        </div>
      ))}

      {overlays.briefings.map((b) => {
        const decisions = safeList(b.decisionsJson);
        return (
          <div className="ro-approval" key={b.id}>
            <div className="ro-appr-head">
              <WorkerMark seed={b.workerSlug} size={22} />
              <b>{nameFor(b.workerSlug)}</b><span>briefing</span>
              <time>{b.dateLabel}</time>
            </div>
            <div className="ro-artifact">
              <span className="ro-alabel">{b.title}</span>
              {b.summary || "Ready for your review."}
              {decisions.length > 0 && <div className="ro-decisions">{decisions.map((d, i) => <span key={i}>• {d}</span>)}</div>}
            </div>
            <div className="ro-appr-actions">
              <button className="r-btn r-btn-accent" type="button" disabled={busy === b.id} onClick={() => void briefingAction(b, "approve")} style={{ fontSize: 13, padding: "8px 18px" }}>Approve</button>
              <button className="r-btn r-btn-ghost" type="button" disabled={busy === b.id} onClick={() => void briefingAction(b, "followup")} style={{ fontSize: 13, padding: "8px 18px" }}>Send back</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function safeList(json: string): string[] {
  try { const v = JSON.parse(json); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}

/* ---------- Calendar (real time now-line, real events, CRUD) ---------- */

const WIN_START = 7;
const WIN_END = 20;
const HOUR_PX = 54;

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
function hourOf(iso: string) { const d = new Date(iso); return d.getHours() + d.getMinutes() / 60; }

const EVENT_TYPES = ["Meeting", "Review", "Focus", "Deadline"];

function CalendarView({
  workers, overlays, onReload,
}: {
  workers: Worker[]; overlays: Overlays; onReload: () => Promise<void>;
}) {
  const [day, setDay] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [editing, setEditing] = useState<OverlayCalendarEvent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const dayEvents = overlays.calendarEvents
    .filter((e) => new Date(e.startsAt).toDateString() === day.toDateString())
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  const isToday = day.toDateString() === new Date().toDateString();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const showNow = isToday && nowHour >= WIN_START && nowHour <= WIN_END;

  const shiftDay = (delta: number) => { const d = new Date(day); d.setDate(d.getDate() + delta); setDay(d); };

  const hours: number[] = [];
  for (let h = WIN_START; h <= WIN_END; h += 1) hours.push(h);

  return (
    <div className="ro-main-scroll">
      <div className="ro-day-head">
        <h1>{day.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</h1>
        <div className="ro-cal-nav">
          <button type="button" onClick={() => shiftDay(-1)} aria-label="Previous day">‹</button>
          <button type="button" className="ro-cal-today" onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setDay(d); }}>Today</button>
          <button type="button" onClick={() => shiftDay(1)} aria-label="Next day">›</button>
          <button type="button" className="r-btn r-btn-accent" style={{ fontSize: 13, padding: "8px 16px" }} onClick={() => { setEditing(null); setShowForm(true); }}>+ Event</button>
        </div>
      </div>

      <div className="ro-cal">
        <div className="ro-cal-grid" style={{ height: (WIN_END - WIN_START) * HOUR_PX }}>
          {hours.map((h) => (
            <div className="ro-cal-row" key={h} style={{ height: HOUR_PX }}>
              <span className="ro-cal-hour">{h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}</span>
              <div className="ro-cal-lane" />
            </div>
          ))}

          {dayEvents.map((e) => {
            const top = (hourOf(e.startsAt) - WIN_START) * HOUR_PX;
            const height = Math.max(26, (hourOf(e.endsAt) - hourOf(e.startsAt)) * HOUR_PX - 4);
            return (
              <button
                key={e.id}
                className={`ro-evt type-${e.eventType.toLowerCase()}`}
                style={{ top, height }}
                type="button"
                onClick={() => { setEditing(e); setShowForm(true); }}
              >
                {e.workerSlug && <WorkerMark seed={e.workerSlug} size={14} />}
                <span className="ro-evt-title">{e.title}</span>
                <small>{clock(e.startsAt)}</small>
              </button>
            );
          })}

          {showNow && (
            <div className="ro-nowline" style={{ top: (nowHour - WIN_START) * HOUR_PX }} data-time={now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} />
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

function TeamView({ workers, overlays, onNavigate }: { workers: Worker[]; overlays: Overlays; onNavigate: (h: string) => void }) {
  return (
    <div className="ro-main-scroll">
      <div className="ro-day-head"><h1>Your <em>team</em></h1></div>
      <div className="ro-team-grid">
        {workers.map((w) => (
          <div className="ro-team-card" key={w.slug}>
            <div className="ro-team-top">
              <WorkerMark seed={w.slug} size={46} active />
              <div><b>{w.name}</b><span>{w.title}</span></div>
              <span className="ro-presence">● Active</span>
            </div>
            <div className="ro-team-activity">{lastActivityFor(w.slug, overlays.worklog)}</div>
            <div className="ro-team-actions">
              <button className="r-btn r-btn-ghost" type="button" style={{ fontSize: 13, padding: "8px 16px", flex: 1, justifyContent: "center" }} onClick={() => onNavigate(`#app/office/chat/${w.slug}`)}>Message</button>
              <span className="ro-team-salary">{w.salary}</span>
            </div>
          </div>
        ))}
        <button className="ro-team-hire" type="button" onClick={() => onNavigate("#workers")}>
          <span className="plus">+</span>
          Hire from the marketplace
        </button>
      </div>
    </div>
  );
}

/* ---------- Files ---------- */

function FilesView({ workers, overlays, onNavigate }: { workers: Worker[]; overlays: Overlays; onNavigate: (h: string) => void }) {
  const nameFor = (slug: string) => workers.find((w) => w.slug === slug)?.name ?? "Worker";
  return (
    <div className="ro-main-scroll">
      <div className="ro-day-head"><h1>Files</h1></div>
      {overlays.files.length === 0 ? (
        <div className="ro-quiet-card ro-quiet-lg">
          No files yet. Files you share with your workers — and deliverables they produce — will collect here.
          {workers.length === 0 && <button className="ro-inline-link" type="button" onClick={() => onNavigate("#workers")}>Hire a worker to get started</button>}
        </div>
      ) : (
        <div className="ro-files">
          {overlays.files.map((f) => (
            <a className="ro-file" key={f.id} href={`/api/office/files/${f.id}/download`}>
              <span className="ro-file-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v4h4" /></svg>
              </span>
              <div><b>{f.name}</b><span>{nameFor(f.workerSlug)} · {timeAgo(f.updatedAt)}</span></div>
            </a>
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
      <div className="ro-day-head"><h1>Office <em>settings</em></h1></div>
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

export function OfficeExperienceApp({ hiredWorkers, onNavigate, onNotice, userName }: OfficeExperienceAppProps) {
  const [route, setRoute] = useState(() => parseOfficeRoute(window.location.hash));
  const [overlays, setOverlays] = useState<Overlays>(EMPTY_OVERLAYS);
  const [loading, setLoading] = useState(true);

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

  const { tab, workerSlug } = route;
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
    today: "your day", chat: "your conversations", approvals: "work waiting on you", team: "your team", files: "shared files",
  };

  let main: JSX.Element;
  if (loading) {
    main = <div className="ro-main-scroll"><div className="ro-quiet-card ro-quiet-lg">Loading your office…</div></div>;
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
          go(`#app/office/chat/${worker.slug}`);
        }}
        onSaveProgress={async (payload) => {
          await officeJson(`/api/office/workers/${worker.slug}/onboarding/save`, {
            method: "POST",
            body: JSON.stringify(payload)
          });
        }}
        onStartFirstDay={(notice) => {
          onNotice(notice);
          go(`#app/office/chat/${worker.slug}`);
        }}
        session={session}
        worker={worker}
      />
    ) : (
      <div className="ro-main-scroll"><div className="ro-quiet-card ro-quiet-lg">This worker could not be found.</div></div>
    );
  } else {
    switch (tab) {
      case "chat": {
        main = <ChatView workers={hiredWorkers} overlays={overlays} selectedSlug={workerSlug} onNavigate={go} onReload={reload} />;
        break;
      }
      case "approvals": main = <ApprovalsView workers={hiredWorkers} overlays={overlays} onNavigate={go} onReload={reload} />; break;
      case "calendar": main = <CalendarView workers={hiredWorkers} overlays={overlays} onReload={reload} />; break;
      case "team": main = <TeamView workers={hiredWorkers} overlays={overlays} onNavigate={go} />; break;
      case "files": main = <FilesView workers={hiredWorkers} overlays={overlays} onNavigate={go} />; break;
      case "settings": main = <SettingsView overlays={overlays} onReload={reload} />; break;
      default: main = <TodayView userName={userName} workers={hiredWorkers} overlays={overlays} onNavigate={go} onApprovalsClick={() => go("#app/office/approvals")} />;
    }
  }

  const pendingCount =
    overlays.tasks.filter((t) => t.status === "Needs Review").length +
    overlays.briefings.length +
    overlays.suggestedActions.filter((action) => action.status === "suggested" && action.requiresApproval).length;

  return (
    <div className="ro-shell">
      <aside className="ro-nav">
        <button className="ro-brand" type="button" onClick={() => go("#app/office")}>Ryva<span>.</span></button>
        {NAV_ITEMS.map((item) => (
          <button key={item.tab} className={`ro-nav-item${tab === item.tab ? " on" : ""}`} type="button" onClick={() => go(`#app/office/${item.tab}`)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
            {item.label}
            {item.tab === "approvals" && pendingCount > 0 && <span className="ro-pill">{pendingCount}</span>}
          </button>
        ))}
        <div className="ro-nav-foot">
          <button className={`ro-nav-item${tab === "settings" ? " on" : ""}`} type="button" onClick={() => go("#app/office/settings")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></svg>
            Settings
          </button>
        </div>
      </aside>

      <aside className="ro-team-rail">
        <div className="ro-team-rail-head"><b>Your team</b><button type="button" onClick={() => go("#workers")} title="Hire">+</button></div>
        {hasWorkers ? (
          hiredWorkers.map((w) => (
            <button key={w.slug} className="ro-member" type="button" onClick={() => go(`#app/office/chat/${w.slug}`)}>
              <WorkerMark seed={w.slug} size={34} active />
              <div className="ro-member-info"><b>{w.name}</b><span>{lastActivityFor(w.slug, overlays.worklog)}</span></div>
              <span className="ro-state active" />
            </button>
          ))
        ) : (
          <div className="ro-team-rail-empty">No one hired yet.</div>
        )}
        <button className="ro-hire-more" type="button" onClick={() => go("#workers")}>+ Hire from the marketplace</button>
      </aside>

      <main className="ro-main">{main}</main>
    </div>
  );
}
