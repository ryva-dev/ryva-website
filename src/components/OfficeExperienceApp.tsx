import { useCallback, useEffect, useMemo, useState } from "react";
import type { Worker } from "../types";
import { MaraDashboardView } from "./MaraDashboardView";
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

type Overlays = {
  chats: OverlayChat[];
  tasks: OverlayTask[];
  suggestedActions: OverlaySuggestedAction[];
  worklog: OverlayWorklog[];
  files: OverlayFile[];
  briefings: OverlayBriefing[];
  calendarEvents: OverlayCalendarEvent[];
  globalSettings: OverlayGlobalSettings;
};

const EMPTY_OVERLAYS: Overlays = {
  chats: [], tasks: [], suggestedActions: [], worklog: [], files: [], briefings: [], calendarEvents: [], globalSettings: null,
};

type Tab = "today" | "chat" | "approvals" | "calendar" | "team" | "files" | "settings";
const WORKER_DEPENDENT: Tab[] = ["today", "chat", "approvals", "team", "files"];
const MARA_SLUG = "mara-vale";

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

function ChatView({
  workers, overlays, selectedSlug, onNavigate, onReload,
}: {
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

  const send = async () => {
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    try {
      await officeJson(`/api/office/workers/${active.slug}/chat`, { method: "POST", body: JSON.stringify({ text: draft.trim() }) });
      setDraft("");
      await onReload();
    } catch {
      /* surfaced via disabled state; keep draft */
    } finally {
      setSending(false);
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
              <button className="r-btn r-btn-ghost" type="button" style={{ fontSize: 13, padding: "8px 16px", flex: 1, justifyContent: "center" }} onClick={() => onNavigate(`#app/office/chat/${w.slug}`)}>{w.slug === MARA_SLUG ? "Open dashboard" : "Message"}</button>
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

export function OfficeExperienceApp({ hiredWorkers, onNavigate, userName }: OfficeExperienceAppProps) {
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

  const emptyLabels: Record<string, string> = {
    today: "your day", chat: "your conversations", approvals: "work waiting on you", team: "your team", files: "shared files",
  };

  let main: JSX.Element;
  if (loading) {
    main = <div className="ro-main-scroll"><div className="ro-quiet-card ro-quiet-lg">Loading your office…</div></div>;
  } else if (WORKER_DEPENDENT.includes(tab) && !hasWorkers) {
    main = <EmptyOffice label={emptyLabels[tab] ?? "your office"} onNavigate={go} />;
  } else {
    switch (tab) {
      case "chat": {
        const selected = hiredWorkers.find((entry) => entry.slug === workerSlug) ?? hiredWorkers[0] ?? null;
        main =
          selected?.slug === MARA_SLUG ? (
            <MaraDashboardView onOfficeReload={reload} worker={selected} />
          ) : (
            <ChatView workers={hiredWorkers} overlays={overlays} selectedSlug={workerSlug} onNavigate={go} onReload={reload} />
          );
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
