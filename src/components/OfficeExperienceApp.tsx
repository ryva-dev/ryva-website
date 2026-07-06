import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { getInterviewGuide, type InterviewMessage } from "../interviewPrompts";
import type {
  Briefing,
  OfficeTask,
  OfficeTaskStatus,
  OfficeWorker,
  ReviewItem,
  WorkLogEntry,
  WorkerFile,
  WorkerModule,
  WorkerSetting
} from "../officeData";
import { buildOfficeWorkersFromMarketplaceWorkers } from "../officeData";
import type { OnboardingSessionState } from "../onboardingSchemas";
import type { Worker } from "../types";
import { WorkerOnboardingPage } from "./WorkerOnboardingPage";

type OfficeExperienceAppProps = {
  allWorkers: Worker[];
  hiredWorkers: Worker[];
  onCheckoutWorker: (workerSlug: string) => Promise<void>;
  onNavigate: (hash: string) => void;
  onRefreshWorkers: () => Promise<void>;
  userName: string;
};

type OfficeOverlayChat = {
  author: "Worker" | "You";
  id: string;
  text: string;
  timestamp: string;
  workerSlug: string;
};

type OfficeOverlayTask = OfficeTask & {
  workerSlug: string;
};

type OfficeOverlayWorklog = WorkLogEntry & {
  workerSlug: string;
};

type OfficeOverlaySettings = {
  settingsJson: string;
  updatedAt?: string;
  workerSlug: string;
};

type OfficeOverlayKnowledge = {
  knowledgeJson: string;
  updatedAt?: string;
  workerSlug: string;
};

type OfficeOverlayFile = WorkerFile & {
  workerSlug: string;
};

type OfficeOverlayBriefing = {
  actionsJson: string;
  agendaJson: string;
  dateLabel: string;
  decisionsJson: string;
  id: string;
  summary: string;
  title: string;
  workerSlug: string;
};

type OfficeOverlayOnboarding = {
  answersJson: string;
  completedAt: string | null;
  generatedSummaryJson: string;
  status: "completed" | "in_progress";
  workerSlug: string;
};

type OfficeCalendarEvent = {
  endsAt: string;
  eventType: string;
  id: string;
  notes: string;
  startsAt: string;
  title: string;
  updatedAt?: string;
  workerSlug?: string | null;
};

type InterviewNotebook = {
  summary: string;
  unsure: string[];
  workingStyle: string[];
};

type OfficeGlobalSettings = {
  antiVoice: string;
  autoBriefingPrep: string;
  brandContext: string;
  briefingDigestTime: string;
  companyCustomer: string;
  companyIdentity: string;
  companyName: string;
  companyNever: string;
  companyOffer: string;
  companyOfferOutcome: string;
  companyVoice: string;
  decisionStyle: string;
  defaultTaskPriority: string;
  digestDelivery: string;
  dislikes: string;
  likes: string;
  managerSummaryFrequency: string;
  meetingBuffer: string;
  nonNegotiables: string;
  notificationWindow: string;
  officeHours: string;
  projectName: string;
  projectObjective: string;
  projectOpenQuestions: string;
  projectStrategy: string;
  quietHours: string;
  reviewCadence: string;
  reviewReminderLead: string;
  rightNowGoal: string;
  timezone: string;
};

type ParsedRoute =
  | { kind: "floor" }
  | { kind: "reception" }
  | { kind: "hiring" }
  | { kind: "calendar" }
  | { kind: "review" }
  | { kind: "conference" }
  | { kind: "memory" }
  | { kind: "projects" }
  | { kind: "interview"; workerId: string }
  | { kind: "workers" }
  | { kind: "worker"; section: "desk" | "role" | "onboarding" | "memory" | "chat"; workerId: string }
  | { kind: "workstream"; moduleId: string; workerId: string };

type DisplayEvent = {
  editable: boolean;
  end: Date;
  eventType: string;
  id: string;
  notes: string;
  source: "briefing" | "custom" | "task";
  start: Date;
  title: string;
  workerSlug?: string | null;
};

const officeNav = [
  { href: "#app/office", label: "Office Floor", kind: "floor" },
  { href: "#app/office/reception", label: "Reception", kind: "reception" },
  { href: "#app/office/hiring", label: "Hiring Hall", kind: "hiring" },
  { href: "#app/office/calendar", label: "Calendar", kind: "calendar" },
  { href: "#app/office/review", label: "Review Room", kind: "review" },
  { href: "#app/office/conference", label: "Conference Room", kind: "conference" },
  { href: "#app/office/memory", label: "Memory Vault", kind: "memory" },
  { href: "#app/office/projects", label: "Project Space", kind: "projects" }
] as const;

const workerSections = [
  { key: "desk", label: "Desk" },
  { key: "role", label: "Role Agreement" },
  { key: "onboarding", label: "Onboarding Room" },
  { key: "memory", label: "Worker Memory" },
  { key: "chat", label: "Direct Thread" }
] as const;

async function officeJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Office request failed.";
    throw new Error(message);
  }

  return payload as T;
}

function parseOfficeRoute(hash: string): ParsedRoute {
  const clean = hash.replace(/^#/, "").replace(/^\/+/, "");
  const parts = clean.split("/").filter(Boolean);
  if (parts[0] !== "app" || parts[1] !== "office") return { kind: "floor" };

  const section = parts[2];
  if (!section) return { kind: "floor" };
  if (section === "reception") return { kind: "reception" };
  if (section === "hiring") return { kind: "hiring" };
  if (section === "calendar") return { kind: "calendar" };
  if (section === "review") return { kind: "review" };
  if (section === "conference") return { kind: "conference" };
  if (section === "memory") return { kind: "memory" };
  if (section === "projects") return { kind: "projects" };
  if (section === "interview" && parts[3]) return { kind: "interview", workerId: parts[3] };
  if (section === "workers" && !parts[3]) return { kind: "workers" };
  if (section === "workers" && parts[3]) {
    return {
      kind: "worker",
      section: (parts[4] as "desk" | "role" | "onboarding" | "memory" | "chat") || "desk",
      workerId: parts[3]
    };
  }
  if (section === "workstreams" && parts[3] && parts[4]) {
    return { kind: "workstream", moduleId: parts[4], workerId: parts[3] };
  }

  return { kind: "floor" };
}

function buildDefaultSettings(): OfficeGlobalSettings {
  return {
    antiVoice: "cheesy, inflated, startup-generic",
    autoBriefingPrep: "Enabled",
    brandContext: "A serious company that prefers clarity, restraint, and strong judgment over volume and noise.",
    briefingDigestTime: "08:30",
    companyCustomer: "women getting started in the gym who want confidence and clarity",
    companyIdentity: "a disciplined consumer brand with a sharp editorial eye",
    companyName: "Ryva",
    companyNever: "make unsupported claims or speak in fake urgency",
    companyOffer: "premium gymwear",
    companyOfferOutcome: "feel confident training consistently",
    companyVoice: "direct, calm, assured",
    decisionStyle: "Escalate brand-sensitive work. Move independently on routine execution.",
    defaultTaskPriority: "Medium",
    digestDelivery: "Email and in-office",
    dislikes: "generic empowerment language, vague reporting, over-designed copy",
    likes: "clear structure, specific recommendations, tasteful confidence",
    managerSummaryFrequency: "Daily",
    meetingBuffer: "15 minutes",
    nonNegotiables: "Protect brand quality. Surface blockers early. Keep decisions traceable.",
    notificationWindow: "9:00 AM - 6:00 PM",
    officeHours: "9:00 AM - 5:00 PM",
    projectName: "July Launch",
    projectObjective: "Prepare launch-ready creative, research, and review flows for the next brand push.",
    projectOpenQuestions: "Pricing confirmation\nShipping windows\nBest-selling hero product",
    projectStrategy: "Lead with emotionally resonant entry points, then sharpen with product proof and clearer review cycles.",
    quietHours: "7:00 PM - 8:00 AM",
    reviewCadence: "Weekly",
    reviewReminderLead: "2 hours before",
    rightNowGoal: "ship more polished work with fewer rewrites",
    timezone: "America/New_York"
  };
}

function mergeSettings(settings?: Partial<OfficeGlobalSettings> | null): OfficeGlobalSettings {
  return {
    ...buildDefaultSettings(),
    ...(settings ?? {})
  };
}

function settingsMap(settings: WorkerSetting[]) {
  return new Map(settings.map((entry) => [entry.label, entry.value]));
}

function mergeOfficeWorkers(
  workers: OfficeWorker[],
  chats: OfficeOverlayChat[],
  tasks: OfficeOverlayTask[],
  worklog: OfficeOverlayWorklog[],
  briefings: OfficeOverlayBriefing[],
  settings: OfficeOverlaySettings[],
  knowledge: OfficeOverlayKnowledge[],
  files: OfficeOverlayFile[]
) {
  return workers.map((worker) => ({
    ...worker,
    briefings: [
      ...briefings
        .filter((entry) => entry.workerSlug === worker.id)
        .map((entry) => ({
          agenda: JSON.parse(entry.agendaJson) as string[],
          dateLabel: entry.dateLabel,
          decisionsNeeded: JSON.parse(entry.decisionsJson) as string[],
          id: entry.id,
          recommendedActions: JSON.parse(entry.actionsJson) as string[],
          summary: entry.summary,
          title: entry.title
        })),
      ...worker.briefings
    ],
    chat: [...worker.chat, ...chats.filter((entry) => entry.workerSlug === worker.id)],
    files: [
      ...files
        .filter((entry) => entry.workerSlug === worker.id)
        .map((entry) => ({
          downloadUrl: entry.id ? `/api/office/files/${entry.id}/download` : undefined,
          id: entry.id,
          name: entry.name,
          type: entry.type,
          updatedAt: entry.updatedAt
        })),
      ...worker.files
    ],
    knowledge:
      knowledge
        .filter((entry) => entry.workerSlug === worker.id)
        .map((entry) => JSON.parse(entry.knowledgeJson) as OfficeWorker["knowledge"])[0] ?? worker.knowledge,
    recentWorkLog: [...worklog.filter((entry) => entry.workerSlug === worker.id), ...worker.recentWorkLog],
    reviewQueue: [
      ...worker.reviewQueue,
      ...tasks
        .filter((task) => task.workerSlug === worker.id && task.status === "Needs Review")
        .map((task) => ({ id: `${task.id}-review`, item: task.title, note: `${task.module} · waiting for manager review` }))
    ],
    settings:
      settings
        .filter((entry) => entry.workerSlug === worker.id)
        .map((entry) => JSON.parse(entry.settingsJson) as OfficeWorker["settings"])[0] ?? worker.settings,
    tasks: [...tasks.filter((entry) => entry.workerSlug === worker.id), ...worker.tasks]
  }));
}

function dueLabelToDate(label: string) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(9, 0, 0, 0);
  const normalized = label.trim().toLowerCase();
  if (normalized === "yesterday") target.setDate(target.getDate() - 1);
  else if (normalized === "tomorrow") target.setDate(target.getDate() + 1);
  else if (normalized !== "today") {
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const index = weekdays.findIndex((day) => normalized.includes(day));
    if (index >= 0) {
      const diff = (index - target.getDay() + 7) % 7 || 7;
      target.setDate(target.getDate() + diff);
    }
  }
  return target;
}

function parseTimeToDate(base: Date, timeLabel: string) {
  const next = new Date(base);
  const match = timeLabel.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) {
    next.setHours(10, 0, 0, 0);
    return next;
  }
  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function briefingLabelToDates(label: string) {
  const [dayLabel, timeLabel] = label.split("·").map((part) => part.trim());
  const day = dueLabelToDate(dayLabel || "Today");
  const start = parseTimeToDate(day, timeLabel || "10:00 AM");
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 45);
  return { end, start };
}

function isoToLocalInput(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string) {
  return new Date(value).toISOString();
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function humanDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", weekday: "long" });
}

function formatClock(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function deriveCalendarEvents(workers: OfficeWorker[], events: OfficeCalendarEvent[]) {
  const custom: DisplayEvent[] = events.map((event) => ({
    editable: true,
    end: new Date(event.endsAt),
    eventType: event.eventType,
    id: event.id,
    notes: event.notes,
    source: "custom",
    start: new Date(event.startsAt),
    title: event.title,
    workerSlug: event.workerSlug ?? null
  }));

  const tasks: DisplayEvent[] = workers.flatMap((worker) =>
    worker.tasks
      .filter((task) => task.status !== "Completed")
      .map((task) => {
        const start = dueLabelToDate(task.dueDate);
        const end = new Date(start);
        end.setHours(start.getHours() + 1);
        return {
          editable: false,
          end,
          eventType: task.status,
          id: `task-${task.id}`,
          notes: `${worker.name} · ${task.module}`,
          source: "task" as const,
          start,
          title: task.title,
          workerSlug: worker.id
        };
      })
  );

  const briefings: DisplayEvent[] = workers.flatMap((worker) =>
    worker.briefings.map((briefing) => {
      const { end, start } = briefingLabelToDates(briefing.dateLabel);
      return {
        editable: false,
        end,
        eventType: "Briefing",
        id: `briefing-${briefing.id}`,
        notes: briefing.summary,
        source: "briefing" as const,
        start,
        title: `${briefing.title} · ${worker.name}`,
        workerSlug: worker.id
      };
    })
  );

  return [...custom, ...tasks, ...briefings].sort((left, right) => left.start.getTime() - right.start.getTime());
}

function groupWorkersByDepartment(workers: Worker[]) {
  const groups = new Map<string, Worker[]>();
  workers.forEach((worker) => {
    groups.set(worker.department, [...(groups.get(worker.department) ?? []), worker]);
  });
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function buildInterviewNotebook(worker: Worker, messages: InterviewMessage[], fitNotes: string): InterviewNotebook {
  const guide = getInterviewGuide(worker);
  return {
    summary:
      fitNotes.trim() ||
      guide.fitNotes[0] ||
      `${worker.name.split(" ")[0]} looks strongest when given sharp context, clear approval rules, and examples of the standard you want.`,
    unsure: guide.needsFromYou.slice(0, 3),
    workingStyle: [
      `Conversation depth: ${messages.length > 4 ? "Established" : "Early"}`,
      `Needs from you: ${guide.needsFromYou[0] ?? "Context"}`,
      `Best fit: ${guide.canHelpWith[0] ?? worker.department}`
    ]
  };
}

function threadStateText(worker: OfficeWorker) {
  const urgentTask = worker.tasks.find((task) => task.status === "Needs Review") ?? worker.tasks[0];
  return urgentTask
    ? `${worker.name.split(" ")[0]} is waiting on ${urgentTask.title.toLowerCase()} and is holding ${worker.reviewQueue.length} items for review.`
    : `${worker.name.split(" ")[0]} is moving through current assignments without open approvals.`;
}

function sectionLines(items: string[]) {
  return items.filter(Boolean).slice(0, 6);
}

function OfficeSidebar({
  currentHash,
  onNavigate,
  selectedWorker,
  workers
}: {
  currentHash: string;
  onNavigate: (hash: string) => void;
  selectedWorker: OfficeWorker | null;
  workers: OfficeWorker[];
}) {
  return (
    <aside className="office-v2-sidebar">
      <button className="office-v2-brand" onClick={() => onNavigate("#app/office")} type="button">
        Ryva
      </button>

      <nav className="office-v2-nav" aria-label="Office navigation">
        {officeNav.map((item) => {
          const active = item.href === "#app/office" ? currentHash === "#app/office" : currentHash.startsWith(item.href);
          return (
            <button
              className={active ? "office-v2-nav-link office-v2-nav-link-active" : "office-v2-nav-link"}
              key={item.href}
              onClick={() => onNavigate(item.href)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="office-v2-divider" />

      <section className="office-v2-roster">
        <p className="office-v2-kicker">Active workers</p>
        {workers.length === 0 ? (
          <p className="office-v2-faint-copy">No workers hired yet. Use Hiring Hall to start building the office.</p>
        ) : (
          workers.map((worker) => (
            <button
              className={
                selectedWorker?.id === worker.id ? "office-v2-roster-link office-v2-roster-link-active" : "office-v2-roster-link"
              }
              key={worker.id}
              onClick={() => onNavigate(`#app/office/workers/${worker.id}/desk`)}
              type="button"
            >
              <strong>{worker.name}</strong>
              <span>{worker.title}</span>
            </button>
          ))
        )}
      </section>
    </aside>
  );
}

function WorkerRail({
  currentHash,
  onNavigate,
  worker
}: {
  currentHash: string;
  onNavigate: (hash: string) => void;
  worker: OfficeWorker;
}) {
  return (
    <aside className="office-v2-worker-rail">
      <div className="office-v2-worker-heading">
        <p className="office-v2-kicker">Worker</p>
        <h2>{worker.name}</h2>
        <p>{worker.title}</p>
      </div>

      <nav className="office-v2-worker-nav" aria-label="Worker navigation">
        {workerSections.map((item) => {
          const href = `#app/office/workers/${worker.id}/${item.key}`;
          return (
            <button
              className={currentHash === href ? "office-v2-nav-link office-v2-nav-link-active" : "office-v2-nav-link"}
              key={item.key}
              onClick={() => onNavigate(href)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="office-v2-divider" />
      <p className="office-v2-kicker">Workstreams</p>
      <div className="office-v2-worker-nav">
        {worker.modules.map((module) => (
          <button
            className={
              currentHash === `#app/office/workstreams/${worker.id}/${module.id}`
                ? "office-v2-nav-link office-v2-nav-link-active"
                : "office-v2-nav-link"
            }
            key={module.id}
            onClick={() => onNavigate(`#app/office/workstreams/${worker.id}/${module.id}`)}
            type="button"
          >
            {module.name}
          </button>
        ))}
      </div>
    </aside>
  );
}

function OfficeHeader({
  eyebrow,
  subtitle,
  title,
  aside
}: {
  aside?: ReactNode;
  eyebrow?: string;
  subtitle: string;
  title: string;
}) {
  return (
    <header className="office-v2-header">
      <div>
        {eyebrow ? <p className="office-v2-kicker">{eyebrow}</p> : null}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {aside ? <div className="office-v2-header-aside">{aside}</div> : null}
    </header>
  );
}

function ThreadList({
  items,
  onSelect
}: {
  items: Array<{ detail: string; title: string }>;
  onSelect?: (index: number) => void;
}) {
  return (
    <div className="office-v2-thread-list">
      {items.map((item, index) => (
        <button
          className="office-v2-thread-row"
          key={`${item.title}-${index}`}
          onClick={() => onSelect?.(index)}
          type="button"
        >
          <span className="office-v2-thread-dot" />
          <div>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function SentenceField({
  after,
  before,
  onChange,
  placeholder,
  value
}: {
  after?: string;
  before: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="office-v2-sentence">
      <span>{before}</span>
      <input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
      {after ? <span>{after}</span> : null}
    </label>
  );
}

function OfficeFloorPage({
  onNavigate,
  settings,
  workers
}: {
  onNavigate: (hash: string) => void;
  settings: OfficeGlobalSettings;
  workers: OfficeWorker[];
}) {
  const nowLines = workers.flatMap((worker) =>
    worker.todayWork.slice(0, 2).map((item) => ({
      detail: worker.title,
      title: `${worker.name.split(" ")[0]} is ${item.charAt(0).toLowerCase()}${item.slice(1)}`
    }))
  );
  const approvalLines = workers.flatMap((worker) =>
    worker.reviewQueue.slice(0, 2).map((item) => ({
      detail: worker.name,
      title: `${item.item} is waiting for your approval`
    }))
  );
  const memoryLines = [
    { detail: "Voice rule", title: settings.companyVoice },
    { detail: "Avoid", title: settings.antiVoice },
    { detail: "Current goal", title: settings.rightNowGoal }
  ];
  const projectLines = workers.flatMap((worker) =>
    worker.tasks.slice(0, 1).map((task) => ({
      detail: `${worker.name} · ${task.dueDate}`,
      title: task.title
    }))
  );

  return (
    <div className="office-v2-page office-v2-floor-page">
      <OfficeHeader
        eyebrow="Office Floor"
        subtitle="A quiet operating surface where work, approvals, context, and hiring stay visible at once."
        title={`Welcome back, ${settings.companyName || "Ryva"}.`}
      />

      <div className="office-v2-floor-canvas">
        <section className="office-v2-zone office-v2-zone-wide">
          <div className="office-v2-zone-head">
            <p className="office-v2-kicker">Now</p>
            <button className="office-v2-inline-link" onClick={() => onNavigate("#app/office/review")} type="button">
              Go to review
            </button>
          </div>
          <ThreadList items={nowLines} />
        </section>

        <section className="office-v2-zone">
          <div className="office-v2-zone-head">
            <p className="office-v2-kicker">Approvals</p>
            <button className="office-v2-inline-link" onClick={() => onNavigate("#app/office/review")} type="button">
              Review room
            </button>
          </div>
          <ThreadList items={approvalLines} />
        </section>

        <section className="office-v2-zone">
          <div className="office-v2-zone-head">
            <p className="office-v2-kicker">Workers</p>
            <button className="office-v2-inline-link" onClick={() => onNavigate("#app/office/hiring")} type="button">
              Hiring hall
            </button>
          </div>
          <ThreadList
            items={workers.map((worker) => ({ detail: worker.department, title: `${worker.name} · ${worker.currentFocus[0]}` }))}
            onSelect={(index) => onNavigate(`#app/office/workers/${workers[index].id}/desk`)}
          />
        </section>

        <section className="office-v2-zone">
          <div className="office-v2-zone-head">
            <p className="office-v2-kicker">Memory</p>
            <button className="office-v2-inline-link" onClick={() => onNavigate("#app/office/memory")} type="button">
              Open vault
            </button>
          </div>
          <ThreadList items={memoryLines} />
        </section>

        <section className="office-v2-zone office-v2-zone-wide">
          <div className="office-v2-zone-head">
            <p className="office-v2-kicker">Projects</p>
            <button className="office-v2-inline-link" onClick={() => onNavigate("#app/office/projects")} type="button">
              Project space
            </button>
          </div>
          <ThreadList items={projectLines} />
        </section>
      </div>
    </div>
  );
}

function ReceptionPage({
  form,
  onChange,
  onSave
}: {
  form: OfficeGlobalSettings;
  onChange: (next: OfficeGlobalSettings) => void;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="office-v2-page">
      <OfficeHeader
        eyebrow="Reception"
        subtitle="Define what the company is, what it sells, who it serves, and how workers should think before they begin."
        title="Company context"
      />

      <form
        className="office-v2-reception"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave();
        }}
      >
        <div className="office-v2-flow">
          <SentenceField
            before="Our company is"
            onChange={(value) => onChange({ ...form, companyIdentity: value })}
            placeholder="a disciplined consumer brand with a sharp editorial eye"
            value={form.companyIdentity}
          />
          <SentenceField
            before="We sell"
            onChange={(value) => onChange({ ...form, companyOffer: value })}
            placeholder="premium gymwear"
            value={form.companyOffer}
          />
          <SentenceField
            before="to"
            onChange={(value) => onChange({ ...form, companyCustomer: value })}
            placeholder="women getting started in the gym"
            value={form.companyCustomer}
          />
          <SentenceField
            before="so they can"
            onChange={(value) => onChange({ ...form, companyOfferOutcome: value })}
            placeholder="feel confident training consistently"
            value={form.companyOfferOutcome}
          />
          <SentenceField
            before="Ryva should sound"
            onChange={(value) => onChange({ ...form, companyVoice: value })}
            placeholder="direct, calm, assured"
            value={form.companyVoice}
          />
          <SentenceField
            before="not"
            onChange={(value) => onChange({ ...form, antiVoice: value })}
            placeholder="cheesy, inflated, startup-generic"
            value={form.antiVoice}
          />
          <SentenceField
            before="Workers should never"
            onChange={(value) => onChange({ ...form, companyNever: value })}
            placeholder="make unsupported claims or speak in fake urgency"
            value={form.companyNever}
          />
          <SentenceField
            before="Right now the company needs to"
            onChange={(value) => onChange({ ...form, rightNowGoal: value })}
            placeholder="ship more polished work with fewer rewrites"
            value={form.rightNowGoal}
          />
        </div>

        <section className="office-v2-memo">
          <p className="office-v2-kicker">Company brief</p>
          <h2>{form.companyName}</h2>
          <p>
            {form.companyName} is {form.companyIdentity}. It sells {form.companyOffer} to {form.companyCustomer} so they can{" "}
            {form.companyOfferOutcome}.
          </p>
          <p>
            When representing the brand, workers should sound {form.companyVoice}, not {form.antiVoice}.
          </p>
          <p>Brand rule: workers should never {form.companyNever}.</p>
          <p>Current operating goal: {form.rightNowGoal}.</p>
          <button className="button button-primary" type="submit">
            Save company brief
          </button>
        </section>
      </form>
    </div>
  );
}

function HiringHallPage({
  allWorkers,
  hiredWorkerSlugs,
  onNavigate,
  onHire,
  userName
}: {
  allWorkers: Worker[];
  hiredWorkerSlugs: Set<string>;
  onHire: (workerSlug: string) => Promise<void>;
  onNavigate: (hash: string) => void;
  userName: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const groups = useMemo(() => groupWorkersByDepartment(allWorkers), [allWorkers]);

  return (
    <div className="office-v2-page">
      <OfficeHeader
        eyebrow="Hiring Hall"
        subtitle={`A calm talent hallway for ${userName}. Browse roles by department, expand one inline, and interview before you decide.`}
        title="Browse workers by role"
      />

      <div className="office-v2-hiring-groups">
        {groups.map(([department, workers]) => (
          <section className="office-v2-hiring-department" key={department}>
            <h2>{department}</h2>
            <div className="office-v2-role-list">
              {workers.map((worker) => {
                const isExpanded = expanded === worker.slug;
                const alreadyHired = hiredWorkerSlugs.has(worker.slug);
                return (
                  <div className="office-v2-role-row" key={worker.slug}>
                    <button
                      className="office-v2-role-line"
                      onClick={() => setExpanded(isExpanded ? null : worker.slug)}
                      type="button"
                    >
                      <span>{worker.title}</span>
                      <small>{worker.name}</small>
                    </button>

                    {isExpanded ? (
                      <div className="office-v2-role-detail">
                        <p>{worker.description}</p>
                        <p className="office-v2-faint-copy">
                          Best when trained on brand voice, audience, offer, and examples. Strongest at {worker.skills.slice(0, 4).join(", ")}.
                        </p>
                        <div className="office-v2-inline-actions">
                          <button
                            className="button button-secondary"
                            onClick={() => onNavigate(`#app/office/interview/${worker.slug}`)}
                            type="button"
                          >
                            Interview this worker
                          </button>
                          {alreadyHired ? (
                            <button
                              className="button button-primary"
                              onClick={() => onNavigate(`#app/office/workers/${worker.slug}/desk`)}
                              type="button"
                            >
                              Open worker desk
                            </button>
                          ) : (
                            <button className="button button-primary" onClick={() => void onHire(worker.slug)} type="button">
                              Hire and onboard
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function InterviewRoomPage({
  onBack,
  onHire,
  worker
}: {
  onBack: () => void;
  onHire: (workerSlug: string) => Promise<void>;
  worker: Worker;
}) {
  const guide = useMemo(() => getInterviewGuide(worker), [worker]);
  const [messages, setMessages] = useState<InterviewMessage[]>([
    {
      id: `${worker.slug}-intro`,
      speaker: "worker",
      text: `I’m built for ${worker.title.toLowerCase()} work. I’m strongest when I can turn brand voice, audience understanding, and clear approval rules into outputs that feel specific instead of generic. I’ll ask for examples before finalizing tone because guessing style produces weak work.`
    }
  ]);
  const [fitNotes, setFitNotes] = useState("");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [threadError, setThreadError] = useState("");
  const notebook = buildInterviewNotebook(worker, messages, fitNotes);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isSending) return;

    const managerMessage: InterviewMessage = {
      id: `${Date.now()}-manager`,
      speaker: "manager",
      text: trimmed
    };
    const nextMessages = [...messages, managerMessage];
    setMessages(nextMessages);
    setInput("");
    setThreadError("");
    setIsSending(true);

    try {
      const response = await fetch(`/api/workers/${worker.slug}/interview`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; reply?: string } | null;
      if (!response.ok || !payload?.reply) {
        throw new Error(payload?.error ?? "Interview reply failed.");
      }
      setMessages((current) => [...current, { id: `${Date.now()}-worker`, speaker: "worker", text: payload.reply! }]);
    } catch (error) {
      setThreadError(error instanceof Error ? error.message : "Unable to continue the interview.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="office-v2-page">
      <OfficeHeader
        eyebrow="Interview Room"
        subtitle="A focused conversation before hiring. Ask for approach, limitations, needed context, and a first-week plan."
        title={`Interview ${worker.name}`}
        aside={
          <button className="button button-secondary" onClick={onBack} type="button">
            Back to hiring hall
          </button>
        }
      />

      <div className="office-v2-interview">
        <aside className="office-v2-presence">
          <p className="office-v2-kicker">Worker presence</p>
          <h2>{worker.name}</h2>
          <p>{worker.title}</p>
          <p className="office-v2-faint-copy">{worker.description}</p>
        </aside>

        <section className="office-v2-conversation">
          <div className="office-v2-thread">
            {messages.map((message) => (
              <article className={message.speaker === "worker" ? "office-v2-message" : "office-v2-message office-v2-message-user"} key={message.id}>
                <strong>{message.speaker === "worker" ? worker.name.split(" ")[0] : "You"}</strong>
                <p>{message.text}</p>
              </article>
            ))}
            {isSending ? <article className="office-v2-message"><strong>{worker.name.split(" ")[0]}</strong><p>Thinking through it.</p></article> : null}
          </div>

          <div className="office-v2-prompt-row">
            {guide.suggestedQuestions.slice(0, 4).map((question) => (
              <button className="office-v2-whisper-link" key={question} onClick={() => void ask(question)} type="button">
                {question}
              </button>
            ))}
          </div>

          <form
            className="office-v2-interview-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
          >
            <textarea
              onChange={(event) => setInput(event.target.value)}
              placeholder={`Ask ${worker.name.split(" ")[0]} how they would approach your current goal, what context they need, or what they should never own.`}
              rows={4}
              value={input}
            />
            {threadError ? <p className="office-v2-error">{threadError}</p> : null}
            <div className="office-v2-inline-actions">
              <button className="button button-primary" disabled={!input.trim() || isSending} type="submit">
                {isSending ? "Working..." : "Continue interview"}
              </button>
              <button className="button button-secondary" onClick={() => void onHire(worker.slug)} type="button">
                Hire and onboard
              </button>
            </div>
          </form>
        </section>

        <aside className="office-v2-notebook">
          <p className="office-v2-kicker">Hiring memo</p>
          <textarea onChange={(event) => setFitNotes(event.target.value)} placeholder="Write a short hiring memo as you evaluate the fit." rows={6} value={fitNotes} />
          <div className="office-v2-note-block">
            <strong>Current summary</strong>
            <p>{notebook.summary}</p>
          </div>
          <div className="office-v2-note-block">
            <strong>Needs from you</strong>
            <ul>
              {notebook.unsure.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="office-v2-note-block">
            <strong>Working style</strong>
            <ul>
              {notebook.workingStyle.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CalendarPage({
  events,
  onDelete,
  onNavigate,
  onSave,
  workers
}: {
  events: DisplayEvent[];
  onDelete: (eventId: string) => Promise<void>;
  onNavigate: (hash: string) => void;
  onSave: (payload: {
    endsAt: string;
    eventId?: string;
    eventType: string;
    notes: string;
    startsAt: string;
    title: string;
    workerSlug?: string;
  }) => Promise<void>;
  workers: OfficeWorker[];
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [editing, setEditing] = useState<DisplayEvent | null>(null);
  const [draft, setDraft] = useState({
    endsAt: isoToLocalInput(new Date(new Date().setHours(new Date().getHours() + 1)).toISOString()),
    eventType: "Office",
    notes: "",
    startsAt: isoToLocalInput(new Date().toISOString()),
    title: "",
    workerSlug: ""
  });

  const monthStart = startOfMonth(month);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const selectedDayEvents = events.filter((event) => sameDay(event.start, selectedDate));
  const readOnlyEvent = Boolean(editing && !editing.editable);

  function openNewEvent(date: Date) {
    const start = new Date(date);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(11, 0, 0, 0);
    setEditing(null);
    setDraft({
      endsAt: isoToLocalInput(end.toISOString()),
      eventType: "Office",
      notes: "",
      startsAt: isoToLocalInput(start.toISOString()),
      title: "",
      workerSlug: ""
    });
    setSelectedDate(date);
  }

  function openEvent(event: DisplayEvent) {
    setSelectedDate(event.start);
    setEditing(event);
    setDraft({
      endsAt: isoToLocalInput(event.end.toISOString()),
      eventType: event.eventType,
      notes: event.notes,
      startsAt: isoToLocalInput(event.start.toISOString()),
      title: event.title,
      workerSlug: event.workerSlug ?? ""
    });
  }

  return (
    <div className="office-v2-page">
      <OfficeHeader
        eyebrow="Calendar"
        subtitle="A real office calendar for deadlines, briefs, reviews, and anything else that needs a place in time."
        title="Calendar"
        aside={
          <div className="office-v2-inline-actions">
            <button className="button button-secondary" onClick={() => setMonth(startOfMonth(addDays(monthStart, -1)))} type="button">
              Prev
            </button>
            <button
              className="button button-secondary"
              onClick={() => {
                setMonth(startOfMonth(new Date()));
                setSelectedDate(new Date());
              }}
              type="button"
            >
              Today
            </button>
            <button
              className="button button-secondary"
              onClick={() => setMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}
              type="button"
            >
              Next
            </button>
          </div>
        }
      />

      <div className="office-v2-calendar-shell">
        <section className="office-v2-calendar-panel">
          <div className="office-v2-calendar-month">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
          <div className="office-v2-calendar-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="office-v2-calendar-grid">
            {days.map((day) => {
              const dayEvents = events.filter((event) => sameDay(event.start, day));
              const inMonth = day.getMonth() === month.getMonth();
              return (
                <button
                  className={
                    sameDay(day, selectedDate)
                      ? "office-v2-calendar-day office-v2-calendar-day-selected"
                      : inMonth
                        ? "office-v2-calendar-day"
                        : "office-v2-calendar-day office-v2-calendar-day-muted"
                  }
                  key={day.toISOString()}
                  onClick={() => {
                    setSelectedDate(day);
                    setEditing(null);
                  }}
                  onDoubleClick={() => openNewEvent(day)}
                  type="button"
                >
                  <div className="office-v2-calendar-date">{day.getDate()}</div>
                  <div className="office-v2-calendar-stacks">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        className={`office-v2-calendar-chip office-v2-calendar-chip-${event.source}`}
                        key={event.id}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          openEvent(event);
                        }}
                      >
                        {event.title}
                      </span>
                    ))}
                    {dayEvents.length > 3 ? <small>+{dayEvents.length - 3} more</small> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="office-v2-calendar-agenda">
          <div className="office-v2-zone-head">
            <div>
              <p className="office-v2-kicker">Selected day</p>
              <h2>{humanDate(selectedDate)}</h2>
            </div>
            <button className="button button-primary" onClick={() => openNewEvent(selectedDate)} type="button">
              New event
            </button>
          </div>

          <div className="office-v2-agenda-list">
            {selectedDayEvents.length === 0 ? (
              <p className="office-v2-faint-copy">No events yet for this day.</p>
            ) : (
              selectedDayEvents.map((event) => (
                <button
                  className="office-v2-agenda-row"
                  key={event.id}
                  onClick={() => openEvent(event)}
                  type="button"
                >
                  <strong>{event.title}</strong>
                  <span>
                    {formatClock(event.start)} - {formatClock(event.end)} · {event.eventType}
                  </span>
                  <p>{event.notes}</p>
                </button>
              ))
            )}
          </div>

          <form
            className="office-v2-calendar-editor"
            onSubmit={(event) => {
              event.preventDefault();
              if (readOnlyEvent) return;
              void onSave({
                endsAt: localInputToIso(draft.endsAt),
                eventId: editing?.editable ? editing.id : undefined,
                eventType: draft.eventType,
                notes: draft.notes,
                startsAt: localInputToIso(draft.startsAt),
                title: draft.title,
                workerSlug: draft.workerSlug || undefined
              }).then(() => setEditing(null));
            }}
          >
            <p className="office-v2-kicker">{editing ? (readOnlyEvent ? "Event details" : "Edit event") : "Create event"}</p>
            <label>
              <span>Title</span>
              <input disabled={readOnlyEvent} onChange={(event) => setDraft({ ...draft, title: event.target.value })} value={draft.title} />
            </label>
            <label>
              <span>Starts</span>
              <input
                disabled={readOnlyEvent}
                onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
                type="datetime-local"
                value={draft.startsAt}
              />
            </label>
            <label>
              <span>Ends</span>
              <input
                disabled={readOnlyEvent}
                onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}
                type="datetime-local"
                value={draft.endsAt}
              />
            </label>
            <label>
              <span>Type</span>
              <select disabled={readOnlyEvent} onChange={(event) => setDraft({ ...draft, eventType: event.target.value })} value={draft.eventType}>
                <option>Office</option>
                <option>Deadline</option>
                <option>Review</option>
                <option>Project</option>
                <option>Reminder</option>
              </select>
            </label>
            <label>
              <span>Worker</span>
              <select disabled={readOnlyEvent} onChange={(event) => setDraft({ ...draft, workerSlug: event.target.value })} value={draft.workerSlug}>
                <option value="">None</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Notes</span>
              <textarea disabled={readOnlyEvent} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={4} value={draft.notes} />
            </label>
            <div className="office-v2-inline-actions">
              {readOnlyEvent ? (
                <>
                  <button className="button button-primary" onClick={() => openNewEvent(selectedDate)} type="button">
                    Create editable event
                  </button>
                  {editing?.workerSlug ? (
                    <button
                      className="button button-secondary"
                      onClick={() => onNavigate(`#app/office/workers/${editing.workerSlug}/desk`)}
                      type="button"
                    >
                      Open worker desk
                    </button>
                  ) : null}
                </>
              ) : (
                <button className="button button-primary" disabled={!draft.title.trim()} type="submit">
                  Save event
                </button>
              )}
              {editing?.editable ? (
                <button className="button button-danger" onClick={() => void onDelete(editing.id).then(() => setEditing(null))} type="button">
                  Delete
                </button>
              ) : null}
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}

function ReviewRoomPage({
  onApprove,
  onRequestRevision,
  workers
}: {
  onApprove: (worker: OfficeWorker, item: ReviewItem, note: string) => Promise<void>;
  onRequestRevision: (worker: OfficeWorker, item: ReviewItem, mode: "reject" | "revise", note: string) => Promise<void>;
  workers: OfficeWorker[];
}) {
  const reviewItems = workers.flatMap((worker) => worker.reviewQueue.map((item) => ({ item, worker })));
  const [activeId, setActiveId] = useState(reviewItems[0]?.item.id ?? "");
  const [note, setNote] = useState("");
  const active = reviewItems.find((entry) => entry.item.id === activeId) ?? reviewItems[0];

  useEffect(() => {
    setActiveId(reviewItems[0]?.item.id ?? "");
  }, [workers]);

  if (!active) {
    return (
      <div className="office-v2-page">
        <OfficeHeader eyebrow="Review Room" subtitle="Nothing is waiting for review right now." title="Review Room" />
      </div>
    );
  }

  const sourceContext = active.worker.knowledge.slice(0, 3).flatMap((section) => section.items.slice(0, 1));

  return (
    <div className="office-v2-page">
      <OfficeHeader
        eyebrow="Review Room"
        subtitle="Review one deliverable at a time, respond clearly, and let the worker learn from the result."
        title={active.item.item}
      />

      <div className="office-v2-review-shell">
        <aside className="office-v2-review-queue">
          <p className="office-v2-kicker">Queue</p>
          {reviewItems.map(({ item, worker }) => (
            <button
              className={item.id === active.item.id ? "office-v2-review-link office-v2-review-link-active" : "office-v2-review-link"}
              key={item.id}
              onClick={() => setActiveId(item.id)}
              type="button"
            >
              <strong>{item.item}</strong>
              <span>{worker.name}</span>
            </button>
          ))}
        </aside>

        <section className="office-v2-review-main">
          <div className="office-v2-review-document">
            <p className="office-v2-kicker">Created by {active.worker.name}</p>
            <h2>{active.item.item}</h2>
            <p>{active.item.note}</p>
            <div className="office-v2-review-body">
              {active.worker.modules[0]?.rows.slice(0, 4).map((row, index) => (
                <div className="office-v2-document-line" key={`${active.worker.id}-${index}`}>
                  <strong>{row[0]}</strong>
                  <span>{row.slice(1).join(" · ")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="office-v2-review-actions">
            <textarea
              onChange={(event) => setNote(event.target.value)}
              placeholder="Too generic. More confident. Less salesy. Save this style. Explain exactly what changed."
              rows={4}
              value={note}
            />
            <div className="office-v2-inline-actions">
              <button className="button button-primary" onClick={() => void onApprove(active.worker, active.item, note)} type="button">
                Approve
              </button>
              <button className="button button-secondary" onClick={() => void onRequestRevision(active.worker, active.item, "revise", note)} type="button">
                Request revision
              </button>
              <button className="button button-danger" onClick={() => void onRequestRevision(active.worker, active.item, "reject", note)} type="button">
                Reject
              </button>
            </div>
          </div>
        </section>

        <aside className="office-v2-review-context">
          <div className="office-v2-note-block">
            <strong>Why this was made</strong>
            <p>{active.worker.currentFocus[0]}</p>
          </div>
          <div className="office-v2-note-block">
            <strong>Based on</strong>
            <ul>
              {sourceContext.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ConferenceRoomPage({
  onCreateTask,
  workers
}: {
  onCreateTask: (worker: OfficeWorker, seed?: string) => Promise<void>;
  workers: OfficeWorker[];
}) {
  const [decisionPrompt, setDecisionPrompt] = useState("What content should we create this week?");
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>(workers.slice(0, 3).map((worker) => worker.id));
  const selected = workers.filter((worker) => selectedWorkers.includes(worker.id));

  const lanes = selected.map((worker) => ({
    label: `${worker.department} view`,
    notes: [worker.currentFocus[0], worker.knowledge[0]?.items[0] ?? worker.roleSummary, worker.blockedBy[0] ?? "No immediate blockers"]
  }));

  const conclusion =
    selected[0]?.currentFocus[0] && selected[1]?.currentFocus[0]
      ? `Lead with ${selected[0].department.toLowerCase()} execution supported by ${selected[1].department.toLowerCase()} context, then turn the outcome into concrete assignments.`
      : "Select at least two workers to generate a more useful strategy session.";

  return (
    <div className="office-v2-page">
      <OfficeHeader
        eyebrow="Conference Room"
        subtitle="A structured strategy session that turns perspective into decisions, reasons, and assignments."
        title="Decision session"
      />

      <div className="office-v2-conference">
        <section className="office-v2-conference-setup">
          <label>
            <span>What decision are we making?</span>
            <textarea onChange={(event) => setDecisionPrompt(event.target.value)} rows={3} value={decisionPrompt} />
          </label>
          <div className="office-v2-select-list">
            {workers.map((worker) => {
              const selectedState = selectedWorkers.includes(worker.id);
              return (
                <button
                  className={selectedState ? "office-v2-select-row office-v2-select-row-active" : "office-v2-select-row"}
                  key={worker.id}
                  onClick={() =>
                    setSelectedWorkers((current) =>
                      current.includes(worker.id) ? current.filter((entry) => entry !== worker.id) : [...current, worker.id]
                    )
                  }
                  type="button"
                >
                  <strong>{worker.name}</strong>
                  <span>{worker.title}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="office-v2-conference-lanes">
          <p className="office-v2-kicker">Discussion transcript</p>
          <h2>{decisionPrompt}</h2>
          {lanes.map((lane) => (
            <div className="office-v2-lane" key={lane.label}>
              <strong>{lane.label}</strong>
              <ul>
                {lane.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <aside className="office-v2-conference-summary">
          <div className="office-v2-note-block">
            <strong>Decision</strong>
            <p>{conclusion}</p>
          </div>
          <div className="office-v2-note-block">
            <strong>Tasks created</strong>
            <div className="office-v2-thread-list">
              {selected.map((worker) => (
                <button className="office-v2-thread-row" key={worker.id} onClick={() => void onCreateTask(worker, `${decisionPrompt} · next action`)} type="button">
                  <span className="office-v2-thread-dot" />
                  <div>
                    <strong>{worker.name}</strong>
                    <p>Create an assignment from this session</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MemoryVaultPage({
  knowledgeUpdatedAt,
  settings,
  settingsUpdatedAt,
  workers
}: {
  knowledgeUpdatedAt: Map<string, string>;
  settings: OfficeGlobalSettings;
  settingsUpdatedAt?: string;
  workers: OfficeWorker[];
}) {
  const companySections = [
    { label: "Company truth", lines: [settings.companyIdentity, settings.companyOffer, settings.companyCustomer] },
    { label: "Voice rules", lines: [settings.companyVoice, `Avoid ${settings.antiVoice}`, settings.companyNever] },
    { label: "Current decisions", lines: [settings.rightNowGoal, settings.projectStrategy, settings.decisionStyle] }
  ];

  return (
    <div className="office-v2-page">
      <OfficeHeader
        eyebrow="Memory Vault"
        subtitle="Visible memory across company truth, voice rules, customer understanding, and worker-specific learning."
        title="Memory Vault"
      />

      <div className="office-v2-ledger">
        {companySections.map((section) => (
          <section className="office-v2-ledger-section" key={section.label}>
            <div className="office-v2-zone-head">
              <p className="office-v2-kicker">{section.label}</p>
              <span className="office-v2-meta-note">{settingsUpdatedAt ? `Updated ${settingsUpdatedAt}` : "Saved in office memory"}</span>
            </div>
            {section.lines.filter(Boolean).map((line) => (
              <div className="office-v2-ledger-row" key={line}>
                <strong>{line}</strong>
                <span>Confirmed by you · company memory</span>
              </div>
            ))}
          </section>
        ))}

        {workers.map((worker) => (
          <section className="office-v2-ledger-section" key={worker.id}>
            <div className="office-v2-zone-head">
              <p className="office-v2-kicker">{worker.name}</p>
              <span className="office-v2-meta-note">{knowledgeUpdatedAt.get(worker.id) ? `Updated ${knowledgeUpdatedAt.get(worker.id)}` : "Worker memory"}</span>
            </div>
            {worker.knowledge.flatMap((section) => section.items.slice(0, 2)).map((item) => (
              <div className="office-v2-ledger-row" key={`${worker.id}-${item}`}>
                <strong>{item}</strong>
                <span>Learned during onboarding · used inside worker desk</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function ProjectSpacePage({
  form,
  onChange,
  onNavigate,
  onSave,
  workers
}: {
  form: OfficeGlobalSettings;
  onChange: (next: OfficeGlobalSettings) => void;
  onNavigate: (hash: string) => void;
  onSave: () => Promise<void>;
  workers: OfficeWorker[];
}) {
  return (
    <div className="office-v2-page">
      <OfficeHeader
        eyebrow="Project Space"
        subtitle="A living project brief where objective, strategy, active workstreams, and open questions stay in the same room."
        title={form.projectName}
      />

      <form
        className="office-v2-project"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave();
        }}
      >
        <section className="office-v2-project-main">
          <label>
            <span>Objective</span>
            <textarea onChange={(event) => onChange({ ...form, projectObjective: event.target.value })} rows={3} value={form.projectObjective} />
          </label>
          <label>
            <span>Strategy</span>
            <textarea onChange={(event) => onChange({ ...form, projectStrategy: event.target.value })} rows={4} value={form.projectStrategy} />
          </label>
          <label>
            <span>Open questions</span>
            <textarea onChange={(event) => onChange({ ...form, projectOpenQuestions: event.target.value })} rows={4} value={form.projectOpenQuestions} />
          </label>
          <button className="button button-primary" type="submit">
            Update project brief
          </button>
        </section>

        <aside className="office-v2-project-side">
          <div className="office-v2-note-block">
            <strong>Workers involved</strong>
            <div className="office-v2-thread-list">
              {workers.map((worker) => (
                <button className="office-v2-thread-row" key={worker.id} onClick={() => onNavigate(`#app/office/workers/${worker.id}/desk`)} type="button">
                  <span className="office-v2-thread-dot" />
                  <div>
                    <strong>{worker.name}</strong>
                    <p>{worker.title}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="office-v2-note-block">
            <strong>Active workstreams</strong>
            <div className="office-v2-thread-list">
              {workers.flatMap((worker) =>
                worker.modules.slice(0, 1).map((module) => (
                  <button className="office-v2-thread-row" key={`${worker.id}-${module.id}`} onClick={() => onNavigate(`#app/office/workstreams/${worker.id}/${module.id}`)} type="button">
                    <span className="office-v2-thread-dot" />
                    <div>
                      <strong>{module.name}</strong>
                      <p>{worker.name}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}

function RoleAgreementPage({
  isEndingEngagement,
  onEndEngagement,
  onSave,
  worker
}: {
  isEndingEngagement: boolean;
  onEndEngagement: () => Promise<void>;
  onSave: (settings: WorkerSetting[]) => Promise<void>;
  worker: OfficeWorker;
}) {
  const values = settingsMap(worker.settings);
  const [form, setForm] = useState({
    approval: values.get("Requires approval before") ?? "Final scripts, public-facing copy, creator briefs, claims, publishing actions.",
    notResponsible: values.get("Not responsible for") ?? "Publishing, unsupported claims, direct outreach without approval, changing positioning alone.",
    reportsTo: values.get("Reports to") ?? "You",
    responsible: values.get("Responsible for") ?? worker.currentFocus.join("\n"),
    success: values.get("Success means") ?? "High approval rate, strong brand fit, useful volume, fewer rewrites over time."
  });

  useEffect(() => {
    const nextValues = settingsMap(worker.settings);
    setForm({
      approval: nextValues.get("Requires approval before") ?? "Final scripts, public-facing copy, creator briefs, claims, publishing actions.",
      notResponsible: nextValues.get("Not responsible for") ?? "Publishing, unsupported claims, direct outreach without approval, changing positioning alone.",
      reportsTo: nextValues.get("Reports to") ?? "You",
      responsible: nextValues.get("Responsible for") ?? worker.currentFocus.join("\n"),
      success: nextValues.get("Success means") ?? "High approval rate, strong brand fit, useful volume, fewer rewrites over time."
    });
  }, [worker]);

  return (
    <div className="office-v2-page">
      <OfficeHeader
        eyebrow="Role Agreement"
        subtitle="A clean role definition for responsibilities, limits, approvals, and what success means."
        title={worker.name}
      />

      <form
        className="office-v2-document"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave([
            ...worker.settings.filter(
              (entry) =>
                !["Responsible for", "Not responsible for", "Requires approval before", "Success means", "Reports to"].includes(entry.label)
            ),
            { label: "Reports to", value: form.reportsTo },
            { label: "Responsible for", value: form.responsible },
            { label: "Not responsible for", value: form.notResponsible },
            { label: "Requires approval before", value: form.approval },
            { label: "Success means", value: form.success }
          ]);
        }}
      >
        <div className="office-v2-document-row"><span>Worker</span><strong>{worker.name}, {worker.title}</strong></div>
        <label>
          <span>Reports to</span>
          <input onChange={(event) => setForm({ ...form, reportsTo: event.target.value })} value={form.reportsTo} />
        </label>
        <label>
          <span>Responsible for</span>
          <textarea onChange={(event) => setForm({ ...form, responsible: event.target.value })} rows={5} value={form.responsible} />
        </label>
        <label>
          <span>Not responsible for</span>
          <textarea onChange={(event) => setForm({ ...form, notResponsible: event.target.value })} rows={4} value={form.notResponsible} />
        </label>
        <label>
          <span>Requires approval before</span>
          <textarea onChange={(event) => setForm({ ...form, approval: event.target.value })} rows={4} value={form.approval} />
        </label>
        <label>
          <span>Success means</span>
          <textarea onChange={(event) => setForm({ ...form, success: event.target.value })} rows={3} value={form.success} />
        </label>
        <div className="office-v2-inline-actions">
          <button className="button button-primary" type="submit">
            Save role agreement
          </button>
          <button className="button button-danger" disabled={isEndingEngagement} onClick={() => void onEndEngagement()} type="button">
            {isEndingEngagement ? "Ending engagement..." : "Fire worker"}
          </button>
        </div>
      </form>
    </div>
  );
}

function WorkerMemoryPage({
  onSave,
  worker
}: {
  onSave: (knowledge: OfficeWorker["knowledge"]) => Promise<void>;
  worker: OfficeWorker;
}) {
  const [draft, setDraft] = useState(() => worker.knowledge.map((section) => ({ ...section, items: [...section.items] })));

  useEffect(() => {
    setDraft(worker.knowledge.map((section) => ({ ...section, items: [...section.items] })));
  }, [worker]);

  return (
    <div className="office-v2-page">
      <OfficeHeader
        eyebrow="Worker Memory"
        subtitle="Visible working memory for voice, audience, open questions, preferences, and decisions tied to this worker."
        title={`${worker.name} memory`}
      />

      <form
        className="office-v2-memory-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(
            draft.map((section) => ({
              ...section,
              items: section.items.filter(Boolean)
            }))
          );
        }}
      >
        {draft.map((section, index) => (
          <label className="office-v2-memory-block" key={section.title}>
            <span>{section.title}</span>
            <textarea
              onChange={(event) => {
                const next = [...draft];
                next[index] = {
                  ...section,
                  items: event.target.value.split("\n").map((item) => item.trim())
                };
                setDraft(next);
              }}
              rows={6}
              value={section.items.join("\n")}
            />
          </label>
        ))}
        <button className="button button-primary" type="submit">
          Save worker memory
        </button>
      </form>
    </div>
  );
}

function DirectThreadPage({
  onCreateTask,
  onSendMessage,
  worker
}: {
  onCreateTask: (worker: OfficeWorker, seed?: string) => Promise<void>;
  onSendMessage: (workerSlug: string, text: string) => Promise<void>;
  worker: OfficeWorker;
}) {
  const [message, setMessage] = useState("");

  return (
    <div className="office-v2-page">
      <OfficeHeader
        eyebrow="Direct Thread"
        subtitle="Talk to the worker the way you would in Slack or Teams, then turn the conversation into direction."
        title={worker.name}
      />

      <div className="office-v2-thread-room">
        <div className="office-v2-thread">
          {worker.chat.map((entry) => (
            <article className={entry.author === "You" ? "office-v2-message office-v2-message-user" : "office-v2-message"} key={entry.id}>
              <strong>{entry.author === "You" ? "You" : worker.name.split(" ")[0]}</strong>
              <p>{entry.text}</p>
              <small>{entry.timestamp}</small>
            </article>
          ))}
        </div>
        <form
          className="office-v2-interview-composer"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = message.trim();
            if (!trimmed) return;
            void onSendMessage(worker.id, trimmed);
            setMessage("");
          }}
        >
          <textarea
            onChange={(event) => setMessage(event.target.value)}
            placeholder={`Message ${worker.name.split(" ")[0]} about current work, context, approvals, or blockers.`}
            rows={4}
            value={message}
          />
          <div className="office-v2-inline-actions">
            <button className="button button-primary" disabled={!message.trim()} type="submit">
              Send
            </button>
            <button className="button button-secondary" onClick={() => void onCreateTask(worker, `Follow up on latest thread with ${worker.name}`)} type="button">
              Turn into assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WorkerDeskPage({
  onNavigate,
  worker
}: {
  onNavigate: (hash: string) => void;
  worker: OfficeWorker;
}) {
  return (
    <div className="office-v2-page">
      <OfficeHeader
        eyebrow="Worker Desk"
        subtitle={threadStateText(worker)}
        title={worker.name}
        aside={<span className="office-v2-header-tag">{worker.title}</span>}
      />

      <div className="office-v2-worker-desk">
        <section className="office-v2-worker-main">
          <div className="office-v2-desk-section">
            <p className="office-v2-kicker">What {worker.name.split(" ")[0]} is working on</p>
            {worker.modules.map((module) => (
              <button className="office-v2-workstream-line" key={module.id} onClick={() => onNavigate(`#app/office/workstreams/${worker.id}/${module.id}`)} type="button">
                <div>
                  <strong>{module.name}</strong>
                  <p>{module.summary}</p>
                </div>
                <span>Open workstream</span>
              </button>
            ))}
          </div>

          <div className="office-v2-desk-section">
            <p className="office-v2-kicker">Current state</p>
            <p className="office-v2-body-copy">{threadStateText(worker)}</p>
          </div>

          <div className="office-v2-desk-section">
            <p className="office-v2-kicker">Recent work</p>
            {worker.files.map((file) => (
              <div className="office-v2-document-line" key={file.name}>
                <strong>{file.name}</strong>
                <span>
                  {file.type} · {file.updatedAt}
                </span>
              </div>
            ))}
          </div>
        </section>

        <aside className="office-v2-worker-side">
          <div className="office-v2-note-block">
            <strong>What {worker.name.split(" ")[0]} knows</strong>
            <ul>
              {worker.knowledge.flatMap((section) => section.items.slice(0, 1)).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="office-v2-note-block">
            <strong>What {worker.name.split(" ")[0]} is unsure about</strong>
            <ul>
              {worker.blockedBy.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WorkstreamPage({
  module,
  worker
}: {
  module: WorkerModule;
  worker: OfficeWorker;
}) {
  const stages = [
    { label: "Intake", lines: [worker.roleSummary, worker.currentFocus[0]] },
    { label: "Research", lines: [worker.knowledge[0]?.items[0] ?? "Context gathering", worker.knowledge[1]?.items[0] ?? "Preferences noted"] },
    { label: "Draft", lines: module.rows.slice(0, 2).map((row) => row.join(" · ")) },
    { label: "Review", lines: worker.reviewQueue.slice(0, 2).map((item) => `${item.item} · ${item.note}`) },
    { label: "Revision", lines: [worker.blockedBy[0] ?? "No active revision notes"] },
    { label: "Approved", lines: [worker.files[0]?.name ?? "No approved asset yet"] },
    { label: "Exported", lines: [worker.files[1]?.name ?? "Awaiting export"] }
  ];

  return (
    <div className="office-v2-page">
      <OfficeHeader
        eyebrow="Workstream"
        subtitle="A single line of work moving from intake through review and final handoff."
        title={module.name}
      />

      <div className="office-v2-workstream">
        {stages.map((stage) => (
          <section className="office-v2-workstream-stage" key={stage.label}>
            <div className="office-v2-workstream-marker">
              <span />
              <strong>{stage.label}</strong>
            </div>
            <div className="office-v2-workstream-lines">
              {stage.lines.filter(Boolean).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="office-v2-document">
        <div className="office-v2-document-row">
          <span>Worker</span>
          <strong>{worker.name}</strong>
        </div>
        <div className="office-v2-document-row">
          <span>Source module</span>
          <strong>{module.summary}</strong>
        </div>
      </div>
    </div>
  );
}

export function OfficeExperienceApp({
  allWorkers,
  hiredWorkers,
  onCheckoutWorker,
  onNavigate,
  onRefreshWorkers,
  userName
}: OfficeExperienceAppProps) {
  const [overlayBriefings, setOverlayBriefings] = useState<OfficeOverlayBriefing[]>([]);
  const [overlayCalendarEvents, setOverlayCalendarEvents] = useState<OfficeCalendarEvent[]>([]);
  const [overlayChats, setOverlayChats] = useState<OfficeOverlayChat[]>([]);
  const [overlayFiles, setOverlayFiles] = useState<OfficeOverlayFile[]>([]);
  const [overlayKnowledge, setOverlayKnowledge] = useState<OfficeOverlayKnowledge[]>([]);
  const [overlayOnboarding, setOverlayOnboarding] = useState<OfficeOverlayOnboarding[]>([]);
  const [overlaySettings, setOverlaySettings] = useState<OfficeOverlaySettings[]>([]);
  const [overlayTasks, setOverlayTasks] = useState<OfficeOverlayTask[]>([]);
  const [overlayWorklog, setOverlayWorklog] = useState<OfficeOverlayWorklog[]>([]);
  const [officeError, setOfficeError] = useState("");
  const [officeNotice, setOfficeNotice] = useState("");
  const [isEndingEngagement, setIsEndingEngagement] = useState(false);
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState<string | undefined>(undefined);
  const [globalSettings, setGlobalSettings] = useState<OfficeGlobalSettings>(buildDefaultSettings());

  const currentHash = window.location.hash || "#app/office";
  const route = parseOfficeRoute(currentHash);
  const hiredOfficeWorkersBase = useMemo(() => buildOfficeWorkersFromMarketplaceWorkers(hiredWorkers), [hiredWorkers]);
  const officeWorkers = useMemo(
    () =>
      mergeOfficeWorkers(
        hiredOfficeWorkersBase,
        overlayChats,
        overlayTasks,
        overlayWorklog,
        overlayBriefings,
        overlaySettings,
        overlayKnowledge,
        overlayFiles
      ),
    [hiredOfficeWorkersBase, overlayChats, overlayTasks, overlayWorklog, overlayBriefings, overlaySettings, overlayKnowledge, overlayFiles]
  );
  const selectedWorker =
    "workerId" in route ? officeWorkers.find((worker) => worker.id === route.workerId) ?? null : null;
  const interviewWorker = route.kind === "interview" ? allWorkers.find((worker) => worker.slug === route.workerId) ?? null : null;
  const selectedMarketplaceWorker = selectedWorker ? hiredWorkers.find((worker) => worker.slug === selectedWorker.id) ?? null : null;
  const onboardingOverlay = selectedWorker ? overlayOnboarding.find((entry) => entry.workerSlug === selectedWorker.id) ?? null : null;
  const onboardingSession: OnboardingSessionState | null = onboardingOverlay
    ? {
        answers: JSON.parse(onboardingOverlay.answersJson) as Record<string, string>,
        completedAt: onboardingOverlay.completedAt,
        generatedSummary: JSON.parse(onboardingOverlay.generatedSummaryJson) as string[],
        status: onboardingOverlay.status
      }
    : null;
  const knowledgeUpdatedAt = useMemo(
    () => new Map(overlayKnowledge.map((entry) => [entry.workerSlug, entry.updatedAt ?? ""])),
    [overlayKnowledge]
  );
  const calendarEvents = useMemo(() => deriveCalendarEvents(officeWorkers, overlayCalendarEvents), [officeWorkers, overlayCalendarEvents]);
  const hiredWorkerSlugs = useMemo(() => new Set(hiredWorkers.map((worker) => worker.slug)), [hiredWorkers]);

  useEffect(() => {
    async function loadOverlays() {
      try {
        const response = await officeJson<{
          briefings: OfficeOverlayBriefing[];
          calendarEvents: OfficeCalendarEvent[];
          chats: OfficeOverlayChat[];
          files: OfficeOverlayFile[];
          globalSettings: { settingsJson: string; updatedAt?: string } | null;
          knowledge: OfficeOverlayKnowledge[];
          onboarding: OfficeOverlayOnboarding[];
          settings: OfficeOverlaySettings[];
          tasks: OfficeOverlayTask[];
          worklog: OfficeOverlayWorklog[];
        }>("/api/office/overlays", { method: "GET" });
        setOverlayBriefings(response.briefings);
        setOverlayCalendarEvents(response.calendarEvents);
        setOverlayChats(response.chats);
        setOverlayFiles(response.files);
        setOverlayKnowledge(response.knowledge);
        setOverlayOnboarding(response.onboarding);
        setOverlaySettings(response.settings);
        setOverlayTasks(response.tasks);
        setOverlayWorklog(response.worklog);
        setGlobalSettings(
          response.globalSettings?.settingsJson
            ? mergeSettings(JSON.parse(response.globalSettings.settingsJson) as Partial<OfficeGlobalSettings>)
            : buildDefaultSettings()
        );
        setSettingsUpdatedAt(response.globalSettings?.updatedAt);
        setOfficeError("");
      } catch (error) {
        setOfficeError(error instanceof Error ? error.message : "Unable to load the office.");
      }
    }

    void loadOverlays();
  }, [hiredWorkers]);

  useEffect(() => {
    if (!officeNotice) return;
    const timeout = window.setTimeout(() => setOfficeNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [officeNotice]);

  async function refreshOverlays() {
    const response = await officeJson<{
      briefings: OfficeOverlayBriefing[];
      calendarEvents: OfficeCalendarEvent[];
      chats: OfficeOverlayChat[];
      files: OfficeOverlayFile[];
      globalSettings: { settingsJson: string; updatedAt?: string } | null;
      knowledge: OfficeOverlayKnowledge[];
      onboarding: OfficeOverlayOnboarding[];
      settings: OfficeOverlaySettings[];
      tasks: OfficeOverlayTask[];
      worklog: OfficeOverlayWorklog[];
    }>("/api/office/overlays", { method: "GET" });
    setOverlayBriefings(response.briefings);
    setOverlayCalendarEvents(response.calendarEvents);
    setOverlayChats(response.chats);
    setOverlayFiles(response.files);
    setOverlayKnowledge(response.knowledge);
    setOverlayOnboarding(response.onboarding);
    setOverlaySettings(response.settings);
    setOverlayTasks(response.tasks);
    setOverlayWorklog(response.worklog);
    setGlobalSettings(
      response.globalSettings?.settingsJson
        ? mergeSettings(JSON.parse(response.globalSettings.settingsJson) as Partial<OfficeGlobalSettings>)
        : buildDefaultSettings()
    );
    setSettingsUpdatedAt(response.globalSettings?.updatedAt);
    setOfficeError("");
  }

  async function handleSendMessage(workerSlug: string, text: string) {
    await officeJson(`/api/office/workers/${workerSlug}/chat`, {
      method: "POST",
      body: JSON.stringify({ text })
    });
    await refreshOverlays();
    setOfficeNotice("Thread updated.");
  }

  async function handleCreateTask(worker: OfficeWorker, seed?: string, overrides?: Partial<Pick<OfficeTask, "dueDate" | "priority" | "title">>) {
    await officeJson(`/api/office/workers/${worker.id}/tasks`, {
      method: "POST",
      body: JSON.stringify({
        dueDate: overrides?.dueDate ?? "Tomorrow",
        module: worker.modules[0]?.name ?? "Work Queue",
        owner: "Worker",
        priority: overrides?.priority ?? "High",
        title: overrides?.title ?? seed ?? `Follow up on ${worker.name}'s current work`
      })
    });
    await refreshOverlays();
    setOfficeNotice("Assignment created.");
  }

  async function handleSaveWorkerKnowledge(workerSlug: string, knowledge: OfficeWorker["knowledge"]) {
    await officeJson(`/api/office/workers/${workerSlug}/knowledge`, {
      method: "POST",
      body: JSON.stringify({ knowledge })
    });
    await refreshOverlays();
    setOfficeNotice("Worker memory saved.");
  }

  async function handleSaveWorkerSettings(workerSlug: string, settings: WorkerSetting[]) {
    await officeJson(`/api/office/workers/${workerSlug}/settings`, {
      method: "POST",
      body: JSON.stringify({ settings })
    });
    await refreshOverlays();
    setOfficeNotice("Role agreement saved.");
  }

  async function handleSaveOfficeSettings() {
    await officeJson("/api/office/settings", {
      method: "POST",
      body: JSON.stringify({ settings: globalSettings })
    });
    await refreshOverlays();
    setOfficeNotice("Office context saved.");
  }

  async function handleSaveCalendarEvent(payload: {
    endsAt: string;
    eventId?: string;
    eventType: string;
    notes: string;
    startsAt: string;
    title: string;
    workerSlug?: string;
  }) {
    await officeJson(payload.eventId ? `/api/office/calendar/events/${payload.eventId}` : "/api/office/calendar/events", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await refreshOverlays();
    setOfficeNotice("Calendar updated.");
  }

  async function handleDeleteCalendarEvent(eventId: string) {
    await officeJson(`/api/office/calendar/events/${eventId}/delete`, {
      method: "POST",
      body: JSON.stringify({})
    });
    await refreshOverlays();
    setOfficeNotice("Event removed.");
  }

  async function handleSaveOnboardingProgress(workerSlug: string, payload: { answers: Record<string, string>; generatedSummary: string[] }) {
    await officeJson(`/api/office/workers/${workerSlug}/onboarding/save`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await refreshOverlays();
    setOfficeNotice("Onboarding progress saved.");
  }

  async function handleCompleteOnboarding(
    workerSlug: string,
    payload: {
      answers: Record<string, string>;
      briefing: {
        agenda: string[];
        dateLabel: string;
        decisionsNeeded: string[];
        recommendedActions: string[];
        summary: string;
        title: string;
      };
      generatedSummary: string[];
      knowledge: Array<{ items: string[]; title: string }>;
      tasks: Array<{
        dueDate: string;
        module: string;
        owner: "Worker" | "You";
        priority: "High" | "Low" | "Medium";
        status: "Completed" | "In Progress" | "Needs Review" | "To Do";
        title: string;
      }>;
      worklogEntry: { module: string; result: string };
    }
  ) {
    await officeJson(`/api/office/workers/${workerSlug}/onboarding/complete`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await refreshOverlays();
    setOfficeNotice("Worker onboarding completed.");
  }

  async function handleEndEngagement(worker: OfficeWorker) {
    if (!window.confirm(`Fire ${worker.name} and remove them from the active office roster?`)) return;
    setIsEndingEngagement(true);
    try {
      await officeJson(`/api/office/workers/${worker.id}/fire`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await onRefreshWorkers();
      onNavigate("#app/office");
      setOfficeNotice(`${worker.name} was removed from the office.`);
    } catch (error) {
      setOfficeError(error instanceof Error ? error.message : "Unable to end this engagement.");
    } finally {
      setIsEndingEngagement(false);
    }
  }

  async function handleApproveReview(worker: OfficeWorker, item: ReviewItem, note: string) {
    await handleSendMessage(worker.id, `Approved: ${item.item}.${note.trim() ? ` ${note.trim()}` : ""}`);
    setOfficeNotice("Review approved.");
  }

  async function handleRequestRevision(worker: OfficeWorker, item: ReviewItem, mode: "reject" | "revise", note: string) {
    const prefix = mode === "reject" ? "Rejected" : "Revision requested";
    await handleSendMessage(worker.id, `${prefix}: ${item.item}.${note.trim() ? ` ${note.trim()}` : ""}`);
    await handleCreateTask(worker, `${mode === "reject" ? "Restart" : "Revise"} ${item.item}`, {
      dueDate: "Today",
      priority: "High",
      title: `${mode === "reject" ? "Restart" : "Revise"} ${item.item}`
    });
    if (note.trim()) {
      const updatedKnowledge = worker.knowledge.map((section, index) =>
        index === 1 ? { ...section, items: [...section.items, `Review note: ${note.trim()}`] } : section
      );
      await handleSaveWorkerKnowledge(worker.id, updatedKnowledge);
    }
    setOfficeNotice(mode === "reject" ? "Deliverable rejected." : "Revision requested.");
  }

  let content: ReactNode = <OfficeFloorPage onNavigate={onNavigate} settings={globalSettings} workers={officeWorkers} />;

  if (route.kind === "reception") {
    content = <ReceptionPage form={globalSettings} onChange={setGlobalSettings} onSave={handleSaveOfficeSettings} />;
  } else if (route.kind === "hiring") {
    content = (
      <HiringHallPage
        allWorkers={allWorkers}
        hiredWorkerSlugs={hiredWorkerSlugs}
        onHire={onCheckoutWorker}
        onNavigate={onNavigate}
        userName={userName}
      />
    );
  } else if (route.kind === "interview" && interviewWorker) {
    content = (
      <InterviewRoomPage
        onBack={() => onNavigate("#app/office/hiring")}
        onHire={onCheckoutWorker}
        worker={interviewWorker}
      />
    );
  } else if (route.kind === "calendar") {
    content = (
      <CalendarPage
        events={calendarEvents}
        onDelete={handleDeleteCalendarEvent}
        onNavigate={onNavigate}
        onSave={handleSaveCalendarEvent}
        workers={officeWorkers}
      />
    );
  } else if (route.kind === "review") {
    content = <ReviewRoomPage onApprove={handleApproveReview} onRequestRevision={handleRequestRevision} workers={officeWorkers} />;
  } else if (route.kind === "conference") {
    content = <ConferenceRoomPage onCreateTask={handleCreateTask} workers={officeWorkers} />;
  } else if (route.kind === "memory") {
    content = (
      <MemoryVaultPage
        knowledgeUpdatedAt={knowledgeUpdatedAt}
        settings={globalSettings}
        settingsUpdatedAt={settingsUpdatedAt}
        workers={officeWorkers}
      />
    );
  } else if (route.kind === "projects") {
    content = (
      <ProjectSpacePage
        form={globalSettings}
        onChange={setGlobalSettings}
        onNavigate={onNavigate}
        onSave={handleSaveOfficeSettings}
        workers={officeWorkers}
      />
    );
  } else if (route.kind === "workers" && officeWorkers.length > 0) {
    content = <OfficeFloorPage onNavigate={onNavigate} settings={globalSettings} workers={officeWorkers} />;
  } else if (route.kind === "worker" && selectedWorker) {
    if (route.section === "onboarding" && selectedMarketplaceWorker) {
      content = (
        <WorkerOnboardingPage
          onComplete={(payload) => handleCompleteOnboarding(selectedWorker.id, payload)}
          onSaveProgress={(payload) => handleSaveOnboardingProgress(selectedWorker.id, payload)}
          onStartFirstDay={(notice) => {
            setOfficeNotice(notice);
            onNavigate(`#app/office/workers/${selectedWorker.id}/desk`);
          }}
          session={onboardingSession}
          worker={selectedMarketplaceWorker}
        />
      );
    } else if (route.section === "role") {
      content = (
        <RoleAgreementPage
          isEndingEngagement={isEndingEngagement}
          onEndEngagement={() => handleEndEngagement(selectedWorker)}
          onSave={(settings) => handleSaveWorkerSettings(selectedWorker.id, settings)}
          worker={selectedWorker}
        />
      );
    } else if (route.section === "memory") {
      content = <WorkerMemoryPage onSave={(knowledge) => handleSaveWorkerKnowledge(selectedWorker.id, knowledge)} worker={selectedWorker} />;
    } else if (route.section === "chat") {
      content = <DirectThreadPage onCreateTask={handleCreateTask} onSendMessage={handleSendMessage} worker={selectedWorker} />;
    } else {
      content = <WorkerDeskPage onNavigate={onNavigate} worker={selectedWorker} />;
    }
  } else if (route.kind === "workstream" && selectedWorker) {
    const module = selectedWorker.modules.find((entry) => entry.id === route.moduleId) ?? selectedWorker.modules[0];
    content = <WorkstreamPage module={module} worker={selectedWorker} />;
  }

  return (
    <main className={selectedWorker ? "office-v2-shell office-v2-shell-worker" : "office-v2-shell"}>
      <OfficeSidebar currentHash={currentHash} onNavigate={onNavigate} selectedWorker={selectedWorker} workers={officeWorkers} />
      {selectedWorker ? <WorkerRail currentHash={currentHash} onNavigate={onNavigate} worker={selectedWorker} /> : null}
      <section className="office-v2-main">
        {officeNotice ? <div className="notice-banner notice-banner-success">{officeNotice}</div> : null}
        {officeError ? <div className="notice-banner notice-banner-error">{officeError}</div> : null}
        {content}
      </section>
    </main>
  );
}
