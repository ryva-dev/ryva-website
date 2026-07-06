import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { WorkerOnboardingPage } from "./WorkerOnboardingPage";

import type {
  Briefing,
  OfficeTask,
  OfficeTaskStatus,
  OfficeWorker,
  ReviewItem,
  WorkLogEntry,
  WorkerFile,
  WorkerModule
} from "../officeData";
import { buildOfficeWorkersFromMarketplaceWorkers } from "../officeData";
import type { OnboardingSessionState } from "../onboardingSchemas";
import type { Worker } from "../types";

type OfficeAppProps = {
  hiredWorkers: Worker[];
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
  workerSlug: string;
};

type OfficeOverlayKnowledge = {
  knowledgeJson: string;
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

type OfficeGlobalSettings = {
  autoBriefingPrep: string;
  briefingDigestTime: string;
  brandContext: string;
  defaultTaskPriority: string;
  decisionStyle: string;
  digestDelivery: string;
  dislikes: string;
  likes: string;
  meetingBuffer: string;
  managerSummaryFrequency: string;
  nonNegotiables: string;
  notificationWindow: string;
  officeHours: string;
  quietHours: string;
  reviewCadence: string;
  reviewReminderLead: string;
  timezone: string;
};

type OfficeOverlayOnboarding = {
  answersJson: string;
  completedAt: string | null;
  generatedSummaryJson: string;
  status: "completed" | "in_progress";
  workerSlug: string;
};

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

const officePrimaryNav = [
  { label: "Office Home", href: "#app/office" },
  { label: "Workers", href: "#app/office/workers" },
  { label: "Meetings", href: "#app/office/meetings" },
  { label: "Tasks", href: "#app/office/tasks" },
  { label: "Files", href: "#app/office/files" },
  { label: "Settings", href: "#app/office/settings" }
];

const workerNav = [
  { key: "onboarding", label: "Onboarding" },
  { key: "desk", label: "Desk" },
  { key: "briefings", label: "Briefings" },
  { key: "tasks", label: "Tasks" },
  { key: "worklog", label: "Work Log" },
  { key: "knowledge", label: "Memory" },
  { key: "files", label: "Files" },
  { key: "chat", label: "Chat" },
  { key: "settings", label: "Settings" }
];

function taskColumns(tasks: OfficeTask[]) {
  const statuses: OfficeTaskStatus[] = ["To Do", "In Progress", "Needs Review", "Completed"];
  return statuses.map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status)
  }));
}

function totalOpenTasks(workers: OfficeWorker[]) {
  return workers.reduce((count, worker) => count + worker.tasks.filter((task) => task.status !== "Completed").length, 0);
}

function totalReviewItems(workers: OfficeWorker[]) {
  return workers.reduce((count, worker) => count + worker.reviewQueue.length, 0);
}

function allFiles(workers: OfficeWorker[]) {
  return workers.flatMap((worker) =>
    worker.files.map((file) => ({
      ...file,
      workerName: worker.name
    }))
  );
}

function allBriefings(workers: OfficeWorker[]) {
  return workers.flatMap((worker) =>
    worker.briefings.map((briefing) => ({
      ...briefing,
      workerName: worker.name
    }))
  );
}

function allActivity(workers: OfficeWorker[]) {
  return workers.flatMap((worker) =>
    worker.recentWorkLog.map((entry) => ({
      ...entry,
      workerName: worker.name
    }))
  );
}

function buildOfficeOverview(workers: OfficeWorker[]) {
  return {
    activity: allActivity(workers)
      .slice(0, 4)
      .map((entry) => `${entry.workerName} ${entry.action.charAt(0).toLowerCase()}${entry.action.slice(1)}`),
    briefings: allBriefings(workers)
      .slice(0, 4)
      .map((briefing) => `${briefing.dateLabel} · ${briefing.title} with ${briefing.workerName}`),
    review: workers.flatMap((worker) => worker.reviewQueue.map((item) => `${item.item} from ${worker.name}`)).slice(0, 4),
    tasks: workers
      .flatMap((worker) =>
        worker.tasks.filter((task) => task.status !== "Completed").map((task) => `${task.title} · ${worker.name}`)
      )
      .slice(0, 4)
  };
}

function settingsMap(settings: OfficeWorker["settings"]) {
  return new Map(settings.map((setting) => [setting.label, setting.value]));
}

function buildSettingsFormValues(worker: OfficeWorker) {
  const values = settingsMap(worker.settings);
  return {
    approvalRules: values.get("Approval rules") ?? "",
    briefingFrequency: values.get("Briefing frequency") ?? "Weekly",
    briefingTime: values.get("Briefing time") ?? "09:00",
    communicationStyle: values.get("Communication style") ?? "",
    connectedAccounts: values.get("Connected accounts placeholder") ?? "",
    goals: values.get("Goals") ?? "",
    notificationPreferences: values.get("Notification preferences") ?? "",
    preferredReviewDay: values.get("Preferred review day") ?? "Friday",
    role: values.get("Role") ?? worker.title,
    workerName: values.get("Worker name") ?? worker.name,
    workingWindow: values.get("Working window") ?? "9:00 AM - 5:00 PM"
  };
}

function buildDefaultOfficeSettings(): OfficeGlobalSettings {
  return {
    autoBriefingPrep: "Enabled",
    briefingDigestTime: "08:30",
    brandContext: "Document brand positioning, active priorities, and what excellent output looks like.",
    defaultTaskPriority: "Medium",
    decisionStyle: "Escalate brand-sensitive work before publishing. Move independently on routine execution.",
    digestDelivery: "Email and in-office",
    dislikes: "Fluffy copy, vague reporting, off-brand tone, unnecessary back-and-forth.",
    likes: "Clear recommendations, polished execution, concise reporting, strong judgment.",
    meetingBuffer: "15 minutes",
    managerSummaryFrequency: "Daily",
    nonNegotiables: "Protect brand quality, maintain client-ready work, surface blockers early.",
    notificationWindow: "9:00 AM - 6:00 PM",
    officeHours: "9:00 AM - 5:00 PM",
    quietHours: "7:00 PM - 8:00 AM",
    reviewCadence: "Weekly",
    reviewReminderLead: "2 hours before",
    timezone: "America/New_York"
  };
}

function mergeOfficeSettings(settings?: Partial<OfficeGlobalSettings> | null): OfficeGlobalSettings {
  return {
    ...buildDefaultOfficeSettings(),
    ...(settings ?? {})
  };
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
        .map((task) => ({ id: `${task.id}-review`, item: task.title, note: `${task.module} · requires review` }))
    ],
    settings:
      settings
        .filter((entry) => entry.workerSlug === worker.id)
        .map((entry) => JSON.parse(entry.settingsJson) as OfficeWorker["settings"])[0] ?? worker.settings,
    tasks: [...tasks.filter((task) => task.workerSlug === worker.id), ...worker.tasks]
  }));
}

function parseOfficePath(hash: string) {
  const clean = hash.replace(/^#/, "").replace(/^\/+/, "");
  const parts = clean.split("/").filter(Boolean);

  if (parts[0] !== "app" || parts[1] !== "office") {
    return { kind: "home" as const };
  }

  if (parts.length === 2) {
    return { kind: "office-home" as const };
  }

  if (parts[2] === "workers") {
    if (parts.length === 3) {
      return { kind: "office-workers" as const };
    }

    const workerId = parts[3];
    if (!workerId) {
      return { kind: "office-workers" as const };
    }

    if (parts.length === 4) {
      return { kind: "worker-desk" as const, workerId };
    }

    if (parts[4] === "modules" && parts[5]) {
      return { kind: "worker-module" as const, workerId, moduleId: parts[5] };
    }

    return { kind: "worker-section" as const, workerId, section: parts[4] };
  }

  if (parts[2] === "meetings") return { kind: "office-meetings" as const };
  if (parts[2] === "tasks") return { kind: "office-tasks" as const };
  if (parts[2] === "files") return { kind: "office-files" as const };
  if (parts[2] === "settings") return { kind: "office-settings" as const };

  return { kind: "office-home" as const };
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
    <aside className="office-sidebar">
      <div className="office-sidebar-brand">Ryva Office</div>

      <nav className="office-primary-nav" aria-label="Office navigation">
        {officePrimaryNav.map((item) => {
          const isActive =
            item.href === "#app/office"
              ? currentHash === "#app/office"
              : currentHash.startsWith(item.href.replace("#", "#"));

          return (
            <button
              className={isActive ? "office-nav-link office-nav-link-active" : "office-nav-link"}
              key={item.href}
              onClick={() => onNavigate(item.href)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <section className="office-worker-switcher">
        <div className="office-sidebar-label">Hired workers</div>
        <div className="office-worker-list">
          {workers.map((worker) => {
            const isActive = selectedWorker?.id === worker.id;

            return (
              <button
                className={isActive ? "office-worker-link office-worker-link-active" : "office-worker-link"}
                key={worker.id}
                onClick={() => onNavigate(`#app/office/workers/${worker.id}/desk`)}
                type="button"
              >
                <span>{worker.name}</span>
                <small>
                  {worker.title} · {worker.department}
                </small>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

function WorkerSidebar({
  onNavigate,
  worker,
  currentHash
}: {
  currentHash: string;
  onNavigate: (hash: string) => void;
  worker: OfficeWorker;
}) {
  return (
    <aside className="worker-sidebar">
      <div className="worker-sidebar-card">
        <div className="office-sidebar-label">Worker</div>
        <h2>{worker.name}</h2>
        <p>
          {worker.title} · {worker.department}
        </p>
      </div>

      <nav className="worker-subnav" aria-label="Worker sections">
        {workerNav.map((item) => {
          const href = `#app/office/workers/${worker.id}/${item.key}`;
          return (
            <button
              className={currentHash === href ? "worker-subnav-link worker-subnav-link-active" : "worker-subnav-link"}
              key={item.key}
              onClick={() => onNavigate(href)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <section className="worker-module-nav">
        <div className="office-sidebar-label">Role modules</div>
        {worker.modules.map((module) => {
          const href = `#app/office/workers/${worker.id}/modules/${module.id}`;
          return (
            <button
              className={currentHash === href ? "worker-subnav-link worker-subnav-link-active" : "worker-subnav-link"}
              key={module.id}
              onClick={() => onNavigate(href)}
              type="button"
            >
              {module.name}
            </button>
          );
        })}
      </section>
    </aside>
  );
}

function TopBar({
  title,
  subtitle,
  rightLabel
}: {
  rightLabel?: string;
  subtitle: string;
  title: string;
}) {
  return (
    <header className="office-topbar">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {rightLabel ? <div className="office-topbar-meta">{rightLabel}</div> : null}
    </header>
  );
}

function MetricStrip({
  items
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="office-metric-strip">
      {items.map((item) => (
        <article className="office-metric-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </article>
      ))}
    </div>
  );
}

function WorkspaceSection({
  title,
  children,
  aside,
  eyebrow
}: {
  aside?: string;
  children: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className="workspace-section">
      <div className="workspace-section-head">
        <div>
          {eyebrow ? <p className="workspace-eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
        </div>
        {aside ? <span>{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

function WorkerHeader({ worker }: { worker: OfficeWorker }) {
  return (
    <header className="worker-header">
      <div>
        <h2>{worker.name}</h2>
        <p>
          {worker.title} · {worker.department}
        </p>
      </div>
      <div className="worker-header-summary">{worker.roleSummary}</div>
    </header>
  );
}

function SimpleList({ items }: { items: string[] }) {
  return (
    <ul className="office-simple-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ReviewQueue({ items }: { items: ReviewItem[] }) {
  return (
    <div className="review-queue">
      {items.map((item) => (
        <article className="review-queue-item" key={item.id}>
          <strong>{item.item}</strong>
          <p>{item.note}</p>
        </article>
      ))}
    </div>
  );
}

function WorkLog({ entries }: { entries: WorkLogEntry[] }) {
  return (
    <div className="worklog-list">
      {entries.map((entry) => (
        <article className="worklog-item" key={entry.id}>
          <div className="worklog-time">{entry.timestamp}</div>
          <div>
            <strong>{entry.action}</strong>
            <p>
              {entry.module} · {entry.result}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function BriefingCard({
  briefing,
  onAction
}: {
  briefing: Briefing;
  onAction: (action: "approve" | "followup" | "task", briefingId: string) => Promise<void>;
}) {
  return (
    <article className="briefing-card">
      <div className="briefing-card-head">
        <div>
          <h4>{briefing.title}</h4>
          <p>{briefing.dateLabel}</p>
        </div>
      </div>
      <p className="briefing-summary">{briefing.summary}</p>

      <div className="briefing-grid">
        <div>
          <h5>Agenda</h5>
          <SimpleList items={briefing.agenda} />
        </div>
        <div>
          <h5>Decisions needed</h5>
          <SimpleList items={briefing.decisionsNeeded} />
        </div>
        <div>
          <h5>Recommended actions</h5>
          <SimpleList items={briefing.recommendedActions} />
        </div>
      </div>

      <div className="briefing-actions">
        <button className="button button-primary" onClick={() => void onAction("approve", briefing.id)} type="button">
          Approve
        </button>
        <button className="button button-secondary" onClick={() => void onAction("followup", briefing.id)} type="button">
          Ask follow-up
        </button>
        <button className="button button-secondary" onClick={() => void onAction("task", briefing.id)} type="button">
          Create task
        </button>
      </div>
    </article>
  );
}

function BriefingList({
  briefings,
  onAction
}: {
  briefings: Briefing[];
  onAction: (action: "approve" | "followup" | "task", briefingId: string) => Promise<void>;
}) {
  return (
    <div className="briefing-list">
      {briefings.map((briefing) => (
        <BriefingCard briefing={briefing} key={briefing.id} onAction={onAction} />
      ))}
    </div>
  );
}

function TaskBoard({
  editableTaskIds,
  tasks,
  onUpdateTaskStatus
}: {
  editableTaskIds?: Set<string>;
  onUpdateTaskStatus?: (taskId: string, status: OfficeTaskStatus) => Promise<void>;
  tasks: OfficeTask[];
}) {
  return (
    <div className="task-board">
      {taskColumns(tasks).map((column) => (
        <section className="task-column" key={column.status}>
          <header className="task-column-head">
            <h4>{column.status}</h4>
            <span>{column.tasks.length}</span>
          </header>
          <div className="task-column-list">
            {column.tasks.map((task) => (
              <article className="task-card" key={task.id}>
                <strong>{task.title}</strong>
                <p>
                  {task.owner} · {task.module}
                </p>
                <small>
                  {task.priority} priority · due {task.dueDate}
                </small>
                <label className="task-status-field">
                  <span>Status</span>
                  <select
                    defaultValue={task.status}
                    disabled={!onUpdateTaskStatus || !editableTaskIds?.has(task.id)}
                    onChange={(event) => {
                      if (onUpdateTaskStatus) {
                        void onUpdateTaskStatus(task.id, event.target.value as OfficeTaskStatus);
                      }
                    }}
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Needs Review">Needs Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </label>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function KnowledgeProfile({
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
    <form
      className="knowledge-grid"
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
        <section className="knowledge-card" key={section.title}>
          <h4>{section.title}</h4>
          <textarea
            onChange={(event) => {
              const next = [...draft];
              next[index] = {
                ...section,
                items: event.target.value
                  .split("\n")
                  .map((item) => item.trim())
              };
              setDraft(next);
            }}
            rows={6}
            value={section.items.join("\n")}
          />
        </section>
      ))}
      <div className="form-actions-row">
        <button className="button button-primary" type="submit">
          Save memory
        </button>
      </div>
    </form>
  );
}

function FilesPanel({
  files,
  onDelete,
  onUpload
}: {
  files: WorkerFile[];
  onDelete: (fileId: string) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <div className="files-panel">
      <form
        className="file-upload-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (selectedFile) {
            void onUpload(selectedFile);
            setSelectedFile(null);
          }
        }}
      >
        <input
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          type="file"
        />
        <button className="button button-secondary" disabled={!selectedFile} type="submit">
          Upload file
        </button>
      </form>
      <table className="office-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={`${file.id ?? file.name}-${file.updatedAt}`}>
              <td>{file.downloadUrl ? <a href={file.downloadUrl}>{file.name}</a> : file.name}</td>
              <td>{file.type}</td>
              <td>{file.updatedAt}</td>
              <td>{file.id ? <button className="table-link-button" onClick={() => void onDelete(file.id!)} type="button">Remove</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OfficeTaskComposer({
  workers,
  onCreate
}: {
  onCreate: (payload: {
    dueDate: string;
    priority: OfficeTask["priority"];
    title: string;
    workerSlug: string;
  }) => Promise<void>;
  workers: OfficeWorker[];
}) {
  const [form, setForm] = useState({
    dueDate: "Tomorrow",
    priority: "High" as OfficeTask["priority"],
    title: "",
    workerSlug: workers[0]?.id ?? ""
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      workerSlug: current.workerSlug || workers[0]?.id || ""
    }));
  }, [workers]);

  return (
    <form
      className="settings-form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        if (!form.workerSlug || !form.title.trim()) return;
        void onCreate({
          dueDate: form.dueDate,
          priority: form.priority,
          title: form.title.trim(),
          workerSlug: form.workerSlug
        });
        setForm((current) => ({ ...current, title: "" }));
      }}
    >
      <label>
        <span>Assign to</span>
        <select onChange={(event) => setForm({ ...form, workerSlug: event.target.value })} value={form.workerSlug}>
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.name} · {worker.department}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Priority</span>
        <select
          onChange={(event) => setForm({ ...form, priority: event.target.value as OfficeTask["priority"] })}
          value={form.priority}
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
      </label>
      <label className="settings-form-full">
        <span>Task title</span>
        <input
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="Review revised outbound sequence"
          value={form.title}
        />
      </label>
      <label>
        <span>Due date</span>
        <input onChange={(event) => setForm({ ...form, dueDate: event.target.value })} value={form.dueDate} />
      </label>
      <div className="form-actions-row">
        <button className="button button-primary" disabled={!form.workerSlug || !form.title.trim()} type="submit">
          Create task
        </button>
      </div>
    </form>
  );
}

function OfficeMeetingScheduler({
  workers,
  onCreate
}: {
  onCreate: (payload: {
    agenda: string[];
    dateLabel: string;
    decisionsNeeded: string[];
    recommendedActions: string[];
    summary: string;
    title: string;
    workerSlug: string;
  }) => Promise<void>;
  workers: OfficeWorker[];
}) {
  const [form, setForm] = useState({
    agenda: "Review active work\nConfirm next approvals",
    dateLabel: "Tomorrow · 11:00 AM",
    decisionsNeeded: "Approve next batch",
    recommendedActions: "Create follow-up task",
    summary: "Scheduled office review to align on output, blockers, and next approvals.",
    title: "Office Review",
    workerSlug: workers[0]?.id ?? ""
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      workerSlug: current.workerSlug || workers[0]?.id || ""
    }));
  }, [workers]);

  return (
    <form
      className="settings-form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        if (!form.workerSlug || !form.title.trim()) return;
        void onCreate({
          agenda: form.agenda.split("\n").map((item) => item.trim()).filter(Boolean),
          dateLabel: form.dateLabel,
          decisionsNeeded: form.decisionsNeeded.split("\n").map((item) => item.trim()).filter(Boolean),
          recommendedActions: form.recommendedActions.split("\n").map((item) => item.trim()).filter(Boolean),
          summary: form.summary,
          title: form.title.trim(),
          workerSlug: form.workerSlug
        });
      }}
    >
      <label>
        <span>Worker</span>
        <select onChange={(event) => setForm({ ...form, workerSlug: event.target.value })} value={form.workerSlug}>
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.name} · {worker.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Date and time</span>
        <input onChange={(event) => setForm({ ...form, dateLabel: event.target.value })} value={form.dateLabel} />
      </label>
      <label className="settings-form-full">
        <span>Meeting title</span>
        <input onChange={(event) => setForm({ ...form, title: event.target.value })} value={form.title} />
      </label>
      <label className="settings-form-full">
        <span>Summary</span>
        <textarea onChange={(event) => setForm({ ...form, summary: event.target.value })} rows={3} value={form.summary} />
      </label>
      <label className="settings-form-full">
        <span>Agenda</span>
        <textarea onChange={(event) => setForm({ ...form, agenda: event.target.value })} rows={4} value={form.agenda} />
      </label>
      <label className="settings-form-full">
        <span>Decisions needed</span>
        <textarea onChange={(event) => setForm({ ...form, decisionsNeeded: event.target.value })} rows={3} value={form.decisionsNeeded} />
      </label>
      <label className="settings-form-full">
        <span>Recommended actions</span>
        <textarea onChange={(event) => setForm({ ...form, recommendedActions: event.target.value })} rows={3} value={form.recommendedActions} />
      </label>
      <div className="form-actions-row settings-form-full">
        <button className="button button-primary" disabled={!form.workerSlug || !form.title.trim()} type="submit">
          Schedule meeting
        </button>
      </div>
    </form>
  );
}

function ChatPanel({
  onNavigate,
  worker,
  onCreateTask,
  onSendMessage
}: {
  onNavigate: (hash: string) => void;
  onCreateTask: (worker: OfficeWorker, seed?: string) => Promise<void>;
  onSendMessage: (workerSlug: string, text: string) => Promise<void>;
  worker: OfficeWorker;
}) {
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    await onSendMessage(worker.id, trimmed);
    setMessage("");
  }

  return (
    <div className="chat-layout">
      <div className="chat-thread">
        {worker.chat.map((message) => (
          <article className={message.author === "You" ? "chat-message chat-message-user" : "chat-message"} key={message.id}>
            <strong>{message.author === "You" ? "You" : worker.name}</strong>
            <p>{message.text}</p>
            <small>{message.timestamp}</small>
          </article>
        ))}
        <form className="chat-composer" onSubmit={handleSubmit}>
          <textarea
            onChange={(event) => setMessage(event.target.value)}
            placeholder={`Message ${worker.name} about current work, tasks, or briefing changes...`}
            rows={4}
            value={message}
          />
          <div className="chat-composer-actions">
            <button className="button button-primary" type="submit">
              Send message
            </button>
          </div>
        </form>
      </div>

      <aside className="chat-sidebar">
        <WorkspaceSection eyebrow="Active" title="Current focus">
          <SimpleList items={worker.currentFocus} />
        </WorkspaceSection>
        <WorkspaceSection eyebrow="Queue" title="Open tasks">
          <SimpleList items={worker.tasks.filter((task) => task.status !== "Completed").slice(0, 4).map((task) => task.title)} />
        </WorkspaceSection>
        <WorkspaceSection eyebrow="Actions" title="Quick actions">
          <div className="quick-actions">
            <button className="button button-secondary" onClick={() => void onCreateTask(worker, "Review latest work output")} type="button">
              Create task
            </button>
            <button className="button button-secondary" onClick={() => onNavigate(`#app/office/workers/${worker.id}/briefings`)} type="button">
              Schedule briefing
            </button>
            <button className="button button-secondary" onClick={() => onNavigate(`#app/office/workers/${worker.id}/tasks`)} type="button">
              Review work
            </button>
            <button className="button button-secondary" onClick={() => onNavigate(`#app/office/workers/${worker.id}/settings`)} type="button">
              Update preferences
            </button>
          </div>
        </WorkspaceSection>
      </aside>
    </div>
  );
}

function GenericTableModule({ module }: { module: WorkerModule }) {
  return (
    <section className="workspace-section">
      <div className="workspace-section-head">
        <h3>{module.name}</h3>
        <span>{module.summary}</span>
      </div>
      <table className="office-table">
        <thead>
          <tr>
            {module.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {module.rows.map((row, index) => (
            <tr key={`${module.id}-${index}`}>
              {row.map((cell) => (
                <td key={`${module.id}-${index}-${cell}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function WorkerDesk({ worker }: { worker: OfficeWorker }) {
  return (
    <div className="office-studio-layout">
      <div className="office-studio-main">
        <WorkerHeader worker={worker} />
        <MetricStrip items={worker.snapshot} />
        <div className="office-two-column-flow">
          <WorkspaceSection eyebrow="Current" title="Focus line">
            <SimpleList items={worker.currentFocus} />
          </WorkspaceSection>
          <WorkspaceSection eyebrow="Today" title="Work in motion">
            <SimpleList items={worker.todayWork} />
          </WorkspaceSection>
        </div>
        <WorkspaceSection eyebrow="Manager queue" title="Needs your review" aside={`${worker.reviewQueue.length} items`}>
          <ReviewQueue items={worker.reviewQueue} />
        </WorkspaceSection>
        <WorkspaceSection eyebrow="Movement" title="Recent work log">
          <WorkLog entries={worker.recentWorkLog} />
        </WorkspaceSection>
      </div>

      <div className="office-studio-rail">
        <WorkspaceSection eyebrow="Dependencies" title="Blocked by">
          <SimpleList items={worker.blockedBy} />
        </WorkspaceSection>
        <WorkspaceSection eyebrow="Calendar" title="Next briefing">
          <p className="office-note">{worker.nextBriefing}</p>
        </WorkspaceSection>
        <WorkspaceSection eyebrow="Readout" title="Role snapshot">
          <SimpleList items={worker.snapshot.map((metric) => `${metric.label}: ${metric.value}`)} />
        </WorkspaceSection>
      </div>
    </div>
  );
}

function WorkerSettingsForm({
  isEndingEngagement,
  onEndEngagement,
  onSave,
  worker
}: {
  isEndingEngagement: boolean;
  onEndEngagement: () => Promise<void>;
  onSave: (settings: OfficeWorker["settings"]) => Promise<void>;
  worker: OfficeWorker;
}) {
  const [form, setForm] = useState(() => buildSettingsFormValues(worker));

  useEffect(() => {
    setForm(buildSettingsFormValues(worker));
  }, [worker]);

  return (
    <form
      className="settings-form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave([
          { label: "Worker name", value: form.workerName },
          { label: "Role", value: form.role },
          { label: "Department", value: worker.department },
          { label: "Goals", value: form.goals },
          { label: "Communication style", value: form.communicationStyle },
          { label: "Briefing frequency", value: form.briefingFrequency },
          { label: "Briefing time", value: form.briefingTime },
          { label: "Preferred review day", value: form.preferredReviewDay },
          { label: "Working window", value: form.workingWindow },
          { label: "Approval rules", value: form.approvalRules },
          { label: "Notification preferences", value: form.notificationPreferences },
          { label: "Connected accounts placeholder", value: form.connectedAccounts }
        ]);
      }}
    >
      <label>
        <span>Worker name</span>
        <input onChange={(event) => setForm({ ...form, workerName: event.target.value })} value={form.workerName} />
      </label>
      <label>
        <span>Role</span>
        <input onChange={(event) => setForm({ ...form, role: event.target.value })} value={form.role} />
      </label>
      <label>
        <span>Briefing frequency</span>
        <select onChange={(event) => setForm({ ...form, briefingFrequency: event.target.value })} value={form.briefingFrequency}>
          <option>Daily</option>
          <option>Twice weekly</option>
          <option>Weekly</option>
          <option>Biweekly</option>
        </select>
      </label>
      <label>
        <span>Briefing time</span>
        <input onChange={(event) => setForm({ ...form, briefingTime: event.target.value })} type="time" value={form.briefingTime} />
      </label>
      <label>
        <span>Preferred review day</span>
        <select onChange={(event) => setForm({ ...form, preferredReviewDay: event.target.value })} value={form.preferredReviewDay}>
          <option>Monday</option>
          <option>Tuesday</option>
          <option>Wednesday</option>
          <option>Thursday</option>
          <option>Friday</option>
        </select>
      </label>
      <label>
        <span>Working window</span>
        <input onChange={(event) => setForm({ ...form, workingWindow: event.target.value })} value={form.workingWindow} />
      </label>
      <label className="settings-form-full">
        <span>Goals</span>
        <textarea onChange={(event) => setForm({ ...form, goals: event.target.value })} rows={4} value={form.goals} />
      </label>
      <label className="settings-form-full">
        <span>Communication style</span>
        <textarea onChange={(event) => setForm({ ...form, communicationStyle: event.target.value })} rows={3} value={form.communicationStyle} />
      </label>
      <label className="settings-form-full">
        <span>Approval rules</span>
        <textarea onChange={(event) => setForm({ ...form, approvalRules: event.target.value })} rows={3} value={form.approvalRules} />
      </label>
      <label className="settings-form-full">
        <span>Notification preferences</span>
        <textarea
          onChange={(event) => setForm({ ...form, notificationPreferences: event.target.value })}
          rows={3}
          value={form.notificationPreferences}
        />
      </label>
      <label className="settings-form-full">
        <span>Connected accounts</span>
        <input onChange={(event) => setForm({ ...form, connectedAccounts: event.target.value })} value={form.connectedAccounts} />
      </label>
      <div className="form-actions-row settings-form-full">
        <button className="button button-primary" type="submit">
          Save settings
        </button>
        <button className="button button-danger" disabled={isEndingEngagement} onClick={() => void onEndEngagement()} type="button">
          {isEndingEngagement ? "Ending engagement..." : "End engagement"}
        </button>
      </div>
    </form>
  );
}

function OfficeHome({
  onNavigate,
  userName,
  workers
}: {
  onNavigate: (hash: string) => void;
  userName: string;
  workers: OfficeWorker[];
}) {
  const overview = buildOfficeOverview(workers);

  return (
    <div className="office-page">
      <TopBar
        rightLabel={`${workers.length} hired workers · ${totalOpenTasks(workers)} open tasks`}
        subtitle="A live operating surface for your workers, active reviews, and the decisions still waiting on you."
        title={`Welcome back, ${userName}.`}
      />

      <MetricStrip
        items={[
          { label: "Hired workers", value: String(workers.length) },
          { label: "Needs review", value: String(totalReviewItems(workers)) },
          { label: "Open tasks", value: String(totalOpenTasks(workers)) }
        ]}
      />

      <div className="office-studio-layout">
        <div className="office-studio-main">
          <WorkspaceSection eyebrow="Review queue" title="Attention now">
            <SimpleList items={overview.review} />
          </WorkspaceSection>
          <WorkspaceSection eyebrow="Workload" title="Upcoming tasks">
            <SimpleList items={overview.tasks} />
          </WorkspaceSection>
          <WorkspaceSection eyebrow="Movement" title="Recent activity across the office">
            <SimpleList items={overview.activity} />
          </WorkspaceSection>
        </div>
        <div className="office-studio-rail">
          <WorkspaceSection eyebrow="Calendar" title="Today's briefings">
            <SimpleList items={overview.briefings} />
          </WorkspaceSection>
          <WorkspaceSection eyebrow="Roster" title="Active workers">
            <div className="office-roster-list">
              {workers.map((worker) => (
                <button className="office-roster-item" key={worker.id} onClick={() => onNavigate(`#app/office/workers/${worker.id}/desk`)} type="button">
                  <strong>{worker.name}</strong>
                  <span>{worker.title}</span>
                </button>
              ))}
            </div>
          </WorkspaceSection>
        </div>
      </div>
    </div>
  );
}

function OfficeMeetingsPage({
  onCreateMeeting,
  workers
}: {
  onCreateMeeting: (payload: {
    agenda: string[];
    dateLabel: string;
    decisionsNeeded: string[];
    recommendedActions: string[];
    summary: string;
    title: string;
    workerSlug: string;
  }) => Promise<void>;
  workers: OfficeWorker[];
}) {
  const briefings = allBriefings(workers);

  return (
    <div className="office-page">
      <TopBar subtitle="Prepare reviews, approvals, and standing briefs across the entire office." title="Meetings" />
      <div className="office-studio-layout">
        <div className="office-studio-main">
          <WorkspaceSection eyebrow="Planner" title="Schedule meeting">
            <OfficeMeetingScheduler onCreate={onCreateMeeting} workers={workers} />
          </WorkspaceSection>
          <WorkspaceSection eyebrow="Timeline" title="Briefing line">
            <div className="briefing-list">
              {briefings.map((briefing) => (
                <article className="briefing-card" key={`${briefing.workerName}-${briefing.id}`}>
                  <div className="office-panel-head">
                    <h3>{briefing.title}</h3>
                    <span>{briefing.workerName}</span>
                  </div>
                  <p className="briefing-summary">{briefing.dateLabel}</p>
                  <p className="office-note">{briefing.summary}</p>
                </article>
              ))}
            </div>
          </WorkspaceSection>
        </div>
        <div className="office-studio-rail">
          <WorkspaceSection eyebrow="Coverage" title="Workers in review cadence">
            <SimpleList items={workers.map((worker) => `${worker.name} · ${worker.nextBriefing}`)} />
          </WorkspaceSection>
        </div>
      </div>
    </div>
  );
}

function OfficeTasksPage({
  workers,
  onCreateTask
}: {
  onCreateTask: (payload: {
    dueDate: string;
    priority: OfficeTask["priority"];
    title: string;
    workerSlug: string;
  }) => Promise<void>;
  workers: OfficeWorker[];
}) {
  return (
    <div className="office-page">
      <TopBar subtitle="Task queues, review handoffs, and open work across every worker." title="Tasks" />
      <div className="office-studio-layout">
        <div className="office-studio-main">
          <WorkspaceSection eyebrow="Assignment" title="Create office task">
            <OfficeTaskComposer onCreate={onCreateTask} workers={workers} />
          </WorkspaceSection>
          <WorkspaceSection eyebrow="Queues" title="Task board">
            <TaskBoard tasks={workers.flatMap((worker) => worker.tasks)} />
          </WorkspaceSection>
        </div>
        <div className="office-studio-rail">
          <WorkspaceSection eyebrow="Load" title="Open work by worker">
            <SimpleList
              items={workers.map(
                (worker) => `${worker.name} · ${worker.tasks.filter((task) => task.status !== "Completed").length} open`
              )}
            />
          </WorkspaceSection>
        </div>
      </div>
    </div>
  );
}

function OfficeFilesPage({ workers }: { workers: OfficeWorker[] }) {
  return (
    <div className="office-page">
      <TopBar subtitle="Documents and working files available across the office." title="Files" />
      <WorkspaceSection eyebrow="Archive" title="Shared office files">
        <table className="office-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Worker</th>
              <th>Type</th>
              <th>Updated</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {allFiles(workers).map((file) => (
              <tr key={`${file.workerName}-${file.name}`}>
                <td>{file.downloadUrl ? <a href={file.downloadUrl}>{file.name}</a> : file.name}</td>
                <td>{file.workerName}</td>
                <td>{file.type}</td>
                <td>{file.updatedAt}</td>
                <td>{file.downloadUrl ? <a className="table-link-button" href={file.downloadUrl}>Download</a> : "Unavailable"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </WorkspaceSection>
    </div>
  );
}

function BriefingComposer({
  onCreate,
  worker
}: {
  onCreate: (payload: {
    agenda: string[];
    dateLabel: string;
    decisionsNeeded: string[];
    recommendedActions: string[];
    summary: string;
    title: string;
  }) => Promise<void>;
  worker: OfficeWorker;
}) {
  const [form, setForm] = useState({
    agenda: "Review current focus\nConfirm next priorities",
    dateLabel: "Tomorrow · 10:00 AM",
    decisionsNeeded: "Approve next work batch",
    recommendedActions: "Create follow-up task",
    summary: `${worker.name} needs direction on next priorities and review timing.`,
    title: "Scheduled Briefing"
  });

  useEffect(() => {
    setForm({
      agenda: "Review current focus\nConfirm next priorities",
      dateLabel: "Tomorrow · 10:00 AM",
      decisionsNeeded: "Approve next work batch",
      recommendedActions: "Create follow-up task",
      summary: `${worker.name} needs direction on next priorities and review timing.`,
      title: "Scheduled Briefing"
    });
  }, [worker]);

  return (
    <form
      className="settings-form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        void onCreate({
          agenda: form.agenda.split("\n").map((item) => item.trim()).filter(Boolean),
          dateLabel: form.dateLabel,
          decisionsNeeded: form.decisionsNeeded.split("\n").map((item) => item.trim()).filter(Boolean),
          recommendedActions: form.recommendedActions.split("\n").map((item) => item.trim()).filter(Boolean),
          summary: form.summary,
          title: form.title
        });
      }}
    >
      <label>
        <span>Briefing title</span>
        <input onChange={(event) => setForm({ ...form, title: event.target.value })} value={form.title} />
      </label>
      <label>
        <span>Date and time</span>
        <input onChange={(event) => setForm({ ...form, dateLabel: event.target.value })} value={form.dateLabel} />
      </label>
      <label className="settings-form-full">
        <span>Summary</span>
        <textarea onChange={(event) => setForm({ ...form, summary: event.target.value })} rows={3} value={form.summary} />
      </label>
      <label className="settings-form-full">
        <span>Agenda</span>
        <textarea onChange={(event) => setForm({ ...form, agenda: event.target.value })} rows={4} value={form.agenda} />
      </label>
      <label className="settings-form-full">
        <span>Decisions needed</span>
        <textarea onChange={(event) => setForm({ ...form, decisionsNeeded: event.target.value })} rows={3} value={form.decisionsNeeded} />
      </label>
      <label className="settings-form-full">
        <span>Recommended actions</span>
        <textarea onChange={(event) => setForm({ ...form, recommendedActions: event.target.value })} rows={3} value={form.recommendedActions} />
      </label>
      <div className="form-actions-row settings-form-full">
        <button className="button button-primary" type="submit">
          Schedule briefing
        </button>
      </div>
    </form>
  );
}

function OfficeSettingsPage({
  initialSettings,
  onSave
}: {
  initialSettings: OfficeGlobalSettings;
  onSave: (settings: OfficeGlobalSettings) => Promise<void>;
}) {
  const [form, setForm] = useState(initialSettings);

  useEffect(() => {
    setForm(initialSettings);
  }, [initialSettings]);

  return (
    <div className="office-page">
      <TopBar subtitle="Memory, operating rules, timing, and office controls that shape every worker." title="Settings" />
      <form
        className="settings-shell"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(form);
        }}
      >
        <section className="settings-section">
          <div className="settings-section-head">
            <div>
              <h3>Brand memory</h3>
              <p>Persistent context every worker should operate against.</p>
            </div>
          </div>
          <div className="settings-form-grid">
            <label className="settings-form-full">
              <span>Brand context</span>
              <textarea onChange={(event) => setForm({ ...form, brandContext: event.target.value })} rows={4} value={form.brandContext} />
            </label>
            <label className="settings-form-full">
              <span>What Ryva should lean into</span>
              <textarea onChange={(event) => setForm({ ...form, likes: event.target.value })} rows={3} value={form.likes} />
            </label>
            <label className="settings-form-full">
              <span>What to avoid</span>
              <textarea onChange={(event) => setForm({ ...form, dislikes: event.target.value })} rows={3} value={form.dislikes} />
            </label>
            <label className="settings-form-full">
              <span>Non-negotiables</span>
              <textarea onChange={(event) => setForm({ ...form, nonNegotiables: event.target.value })} rows={3} value={form.nonNegotiables} />
            </label>
            <label className="settings-form-full">
              <span>Decision style</span>
              <textarea onChange={(event) => setForm({ ...form, decisionStyle: event.target.value })} rows={3} value={form.decisionStyle} />
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <div>
              <h3>Operating cadence</h3>
              <p>How the office runs day to day.</p>
            </div>
          </div>
          <div className="settings-form-grid">
            <label>
              <span>Manager summary frequency</span>
              <select onChange={(event) => setForm({ ...form, managerSummaryFrequency: event.target.value })} value={form.managerSummaryFrequency}>
                <option>Daily</option>
                <option>Twice weekly</option>
                <option>Weekly</option>
              </select>
            </label>
            <label>
              <span>Briefing digest time</span>
              <input onChange={(event) => setForm({ ...form, briefingDigestTime: event.target.value })} type="time" value={form.briefingDigestTime} />
            </label>
            <label>
              <span>Review cadence</span>
              <select onChange={(event) => setForm({ ...form, reviewCadence: event.target.value })} value={form.reviewCadence}>
                <option>Daily</option>
                <option>Weekly</option>
                <option>Biweekly</option>
              </select>
            </label>
            <label>
              <span>Review reminder lead time</span>
              <select onChange={(event) => setForm({ ...form, reviewReminderLead: event.target.value })} value={form.reviewReminderLead}>
                <option>30 minutes before</option>
                <option>1 hour before</option>
                <option>2 hours before</option>
                <option>1 day before</option>
              </select>
            </label>
            <label>
              <span>Auto briefing prep</span>
              <select onChange={(event) => setForm({ ...form, autoBriefingPrep: event.target.value })} value={form.autoBriefingPrep}>
                <option>Enabled</option>
                <option>Disabled</option>
              </select>
            </label>
            <label>
              <span>Default task priority</span>
              <select onChange={(event) => setForm({ ...form, defaultTaskPriority: event.target.value })} value={form.defaultTaskPriority}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <div>
              <h3>Availability and notifications</h3>
              <p>Timing rules for digests, meetings, alerts, and quiet periods.</p>
            </div>
          </div>
          <div className="settings-form-grid">
            <label>
              <span>Digest delivery</span>
              <select onChange={(event) => setForm({ ...form, digestDelivery: event.target.value })} value={form.digestDelivery}>
                <option>Email and in-office</option>
                <option>Email only</option>
                <option>In-office only</option>
              </select>
            </label>
            <label>
              <span>Timezone</span>
              <select onChange={(event) => setForm({ ...form, timezone: event.target.value })} value={form.timezone}>
                <option>America/New_York</option>
                <option>America/Chicago</option>
                <option>America/Denver</option>
                <option>America/Los_Angeles</option>
                <option>UTC</option>
              </select>
            </label>
            <label>
              <span>Meeting buffer</span>
              <select onChange={(event) => setForm({ ...form, meetingBuffer: event.target.value })} value={form.meetingBuffer}>
                <option>0 minutes</option>
                <option>15 minutes</option>
                <option>30 minutes</option>
                <option>1 hour</option>
              </select>
            </label>
            <label className="settings-form-full">
              <span>Office hours</span>
              <input onChange={(event) => setForm({ ...form, officeHours: event.target.value })} value={form.officeHours} />
            </label>
            <label className="settings-form-full">
              <span>Notification window</span>
              <input onChange={(event) => setForm({ ...form, notificationWindow: event.target.value })} value={form.notificationWindow} />
            </label>
            <label className="settings-form-full">
              <span>Quiet hours</span>
              <input onChange={(event) => setForm({ ...form, quietHours: event.target.value })} value={form.quietHours} />
            </label>
          </div>
        </section>

        <div className="settings-savebar">
          <div>
            <strong>Office preferences</strong>
            <p>These settings persist to your account and reload inside the office.</p>
          </div>
          <button className="button button-primary" type="submit">
            Save office settings
          </button>
        </div>
      </form>
    </div>
  );
}

export function OfficeApp({ hiredWorkers, onNavigate, onRefreshWorkers, userName }: OfficeAppProps) {
  const [overlayBriefings, setOverlayBriefings] = useState<OfficeOverlayBriefing[]>([]);
  const [overlayChats, setOverlayChats] = useState<OfficeOverlayChat[]>([]);
  const [overlayFiles, setOverlayFiles] = useState<OfficeOverlayFile[]>([]);
  const [overlayGlobalSettings, setOverlayGlobalSettings] = useState<OfficeGlobalSettings>(buildDefaultOfficeSettings());
  const [overlayKnowledge, setOverlayKnowledge] = useState<OfficeOverlayKnowledge[]>([]);
  const [overlayOnboarding, setOverlayOnboarding] = useState<OfficeOverlayOnboarding[]>([]);
  const [officeNotice, setOfficeNotice] = useState("");
  const [overlaySettings, setOverlaySettings] = useState<OfficeOverlaySettings[]>([]);
  const [overlayTasks, setOverlayTasks] = useState<OfficeOverlayTask[]>([]);
  const [overlayWorklog, setOverlayWorklog] = useState<OfficeOverlayWorklog[]>([]);
  const [officeError, setOfficeError] = useState("");
  const [isEndingEngagement, setIsEndingEngagement] = useState(false);

  const baseWorkers = useMemo(() => buildOfficeWorkersFromMarketplaceWorkers(hiredWorkers), [hiredWorkers]);
  const officeWorkers = useMemo(
    () =>
      mergeOfficeWorkers(
        baseWorkers,
        overlayChats,
        overlayTasks,
        overlayWorklog,
        overlayBriefings,
        overlaySettings,
        overlayKnowledge,
        overlayFiles
      ),
    [baseWorkers, overlayBriefings, overlayChats, overlayTasks, overlayWorklog, overlaySettings, overlayKnowledge, overlayFiles]
  );
  const currentHash = window.location.hash || "#app/office";
  const route = parseOfficePath(currentHash);
  const selectedWorker =
    "workerId" in route ? officeWorkers.find((worker) => worker.id === route.workerId) ?? null : null;
  const selectedMarketplaceWorker =
    "workerId" in route ? hiredWorkers.find((worker) => worker.slug === route.workerId) ?? null : null;
  const selectedOnboarding = selectedWorker
    ? overlayOnboarding.find((entry) => entry.workerSlug === selectedWorker.id) ?? null
    : null;
  const selectedOnboardingSession: OnboardingSessionState | null = selectedOnboarding
    ? {
        answers: JSON.parse(selectedOnboarding.answersJson) as Record<string, string>,
        completedAt: selectedOnboarding.completedAt,
        generatedSummary: JSON.parse(selectedOnboarding.generatedSummaryJson) as string[],
        status: selectedOnboarding.status
      }
    : null;
  const selectedOnboardingCompleted = selectedOnboarding?.status === "completed";

  useEffect(() => {
    async function loadOverlays() {
      if (hiredWorkers.length === 0) {
        setOverlayBriefings([]);
        setOverlayChats([]);
        setOverlayFiles([]);
        setOverlayGlobalSettings(buildDefaultOfficeSettings());
        setOverlayKnowledge([]);
        setOverlayOnboarding([]);
        setOverlaySettings([]);
        setOverlayTasks([]);
        setOverlayWorklog([]);
        return;
      }

      try {
        const response = await officeJson<{
          briefings: OfficeOverlayBriefing[];
          chats: OfficeOverlayChat[];
          files: OfficeOverlayFile[];
          globalSettings: { settingsJson: string } | null;
          knowledge: OfficeOverlayKnowledge[];
          onboarding: OfficeOverlayOnboarding[];
          settings: OfficeOverlaySettings[];
          tasks: OfficeOverlayTask[];
          worklog: OfficeOverlayWorklog[];
        }>("/api/office/overlays", { method: "GET" });
        setOverlayBriefings(response.briefings);
        setOverlayChats(response.chats);
        setOverlayFiles(response.files);
        setOverlayGlobalSettings(
          response.globalSettings?.settingsJson
            ? mergeOfficeSettings(JSON.parse(response.globalSettings.settingsJson) as Partial<OfficeGlobalSettings>)
            : buildDefaultOfficeSettings()
        );
        setOverlayKnowledge(response.knowledge);
        setOverlayOnboarding(response.onboarding);
        setOverlaySettings(response.settings);
        setOverlayTasks(response.tasks);
        setOverlayWorklog(response.worklog);
        setOfficeError("");
        setOfficeNotice("");
      } catch (error) {
        setOfficeError(error instanceof Error ? error.message : "Unable to load office updates.");
      }
    }

    void loadOverlays();
  }, [hiredWorkers]);

  useEffect(() => {
    if (!officeNotice) return;
    const timeout = window.setTimeout(() => setOfficeNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [officeNotice]);

  async function refreshOverlays() {
    const response = await officeJson<{
      briefings: OfficeOverlayBriefing[];
      chats: OfficeOverlayChat[];
      files: OfficeOverlayFile[];
      globalSettings: { settingsJson: string } | null;
      knowledge: OfficeOverlayKnowledge[];
      onboarding: OfficeOverlayOnboarding[];
      settings: OfficeOverlaySettings[];
      tasks: OfficeOverlayTask[];
      worklog: OfficeOverlayWorklog[];
    }>("/api/office/overlays", { method: "GET" });
    setOverlayBriefings(response.briefings);
    setOverlayChats(response.chats);
    setOverlayFiles(response.files);
    setOverlayGlobalSettings(
      response.globalSettings?.settingsJson
        ? mergeOfficeSettings(JSON.parse(response.globalSettings.settingsJson) as Partial<OfficeGlobalSettings>)
        : buildDefaultOfficeSettings()
    );
    setOverlayKnowledge(response.knowledge);
    setOverlayOnboarding(response.onboarding);
    setOverlaySettings(response.settings);
    setOverlayTasks(response.tasks);
    setOverlayWorklog(response.worklog);
    setOfficeError("");
  }

  async function handleSendMessage(workerSlug: string, text: string) {
    await officeJson(`/api/office/workers/${workerSlug}/chat`, {
      method: "POST",
      body: JSON.stringify({ text })
    });
    await refreshOverlays();
    setOfficeNotice("Message sent.");
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
    setOfficeNotice("Task created.");
  }

  async function handleBriefingAction(workerSlug: string, action: "approve" | "followup" | "task", briefingId: string) {
    await officeJson(`/api/office/workers/${workerSlug}/briefings/${briefingId}/action`, {
      method: "POST",
      body: JSON.stringify({ action })
    });
    await refreshOverlays();
    setOfficeNotice(action === "approve" ? "Briefing approved." : action === "task" ? "Task created from briefing." : "Follow-up requested.");
  }

  async function handleUpdateTaskStatus(workerSlug: string, taskId: string, status: OfficeTaskStatus) {
    await officeJson(`/api/office/workers/${workerSlug}/tasks/${taskId}/status`, {
      method: "POST",
      body: JSON.stringify({ status })
    });
    await refreshOverlays();
    setOfficeNotice("Task status updated.");
  }

  async function handleSaveKnowledge(workerSlug: string, knowledge: OfficeWorker["knowledge"]) {
    await officeJson(`/api/office/workers/${workerSlug}/knowledge`, {
      method: "POST",
      body: JSON.stringify({ knowledge })
    });
    await refreshOverlays();
    setOfficeNotice("Knowledge saved.");
  }

  async function handleSaveSettings(workerSlug: string, settings: OfficeWorker["settings"]) {
    await officeJson(`/api/office/workers/${workerSlug}/settings`, {
      method: "POST",
      body: JSON.stringify({ settings })
    });
    await refreshOverlays();
    setOfficeNotice("Worker settings saved.");
  }

  async function handleEndEngagement(worker: OfficeWorker) {
    if (!window.confirm(`End ${worker.name}'s engagement and remove them from the active office roster?`)) {
      return;
    }

    setIsEndingEngagement(true);
    setOfficeError("");

    try {
      await officeJson(`/api/office/workers/${worker.id}/fire`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await onRefreshWorkers();
      onNavigate("#app/office/workers");
      setOfficeNotice(`${worker.name} was removed from the active office roster.`);
    } catch (error) {
      setOfficeError(error instanceof Error ? error.message : "Unable to end this engagement.");
    } finally {
      setIsEndingEngagement(false);
    }
  }

  async function handleUploadFile(workerSlug: string, file: File) {
    const contentBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Unable to read file."));
      reader.onload = () => {
        const result = String(reader.result ?? "");
        resolve(result.split(",")[1] ?? "");
      };
      reader.readAsDataURL(file);
    });

    await officeJson(`/api/office/workers/${workerSlug}/files`, {
      method: "POST",
      body: JSON.stringify({
        contentBase64,
        name: file.name,
        type: file.type || "File"
      })
    });
    await refreshOverlays();
    setOfficeNotice("File uploaded.");
  }

  async function handleDeleteFile(workerSlug: string, fileId: string) {
    await officeJson(`/api/office/workers/${workerSlug}/files/${fileId}/delete`, {
      method: "POST",
      body: JSON.stringify({})
    });
    await refreshOverlays();
    setOfficeNotice("File removed.");
  }

  async function handleCreateBriefing(
    workerSlug: string,
    payload: {
      agenda: string[];
      dateLabel: string;
      decisionsNeeded: string[];
      recommendedActions: string[];
      summary: string;
      title: string;
    }
  ) {
    await officeJson(`/api/office/workers/${workerSlug}/briefings`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await refreshOverlays();
    setOfficeNotice("Meeting scheduled.");
  }

  async function handleSaveOfficeSettings(settings: OfficeGlobalSettings) {
    await officeJson("/api/office/settings", {
      method: "POST",
      body: JSON.stringify({ settings })
    });
    await refreshOverlays();
    setOfficeNotice("Office settings saved.");
  }

  async function handleSaveOnboardingProgress(
    workerSlug: string,
    payload: { answers: Record<string, string>; generatedSummary: string[] }
  ) {
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
    setOfficeNotice("New hire onboarding completed.");
  }

  async function handleCreateOfficeTask(payload: {
    dueDate: string;
    priority: OfficeTask["priority"];
    title: string;
    workerSlug: string;
  }) {
    const worker = officeWorkers.find((entry) => entry.id === payload.workerSlug);
    if (!worker) return;
    await handleCreateTask(worker, undefined, payload);
  }

  async function handleCreateOfficeMeeting(payload: {
    agenda: string[];
    dateLabel: string;
    decisionsNeeded: string[];
    recommendedActions: string[];
    summary: string;
    title: string;
    workerSlug: string;
  }) {
    await handleCreateBriefing(payload.workerSlug, payload);
  }

  let content: ReactNode;

  if (route.kind === "office-home") {
    content = <OfficeHome onNavigate={onNavigate} userName={userName} workers={officeWorkers} />;
  } else if (route.kind === "office-workers" && !selectedWorker) {
    content = (
      <div className="office-page">
        <TopBar subtitle="Select a hired worker to open their private workspace." title="Workers" />
        {officeWorkers.length === 0 ? (
          <div className="empty-state">
            <h2>No hired workers yet</h2>
            <p>Complete checkout in the marketplace to add workers to Ryva Office.</p>
          </div>
        ) : (
          <div className="worker-directory">
            {officeWorkers.map((worker) => (
              <article className="worker-directory-card" key={worker.id}>
                <h3>{worker.name}</h3>
                <p>
                  {worker.title} · {worker.department}
                </p>
                <p className="office-note">{worker.roleSummary}</p>
                <button className="button button-secondary" onClick={() => onNavigate(`#app/office/workers/${worker.id}/desk`)} type="button">
                  {overlayOnboarding.find((entry) => entry.workerSlug === worker.id)?.status === "completed" ? "Open desk" : "Start onboarding"}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  } else if (route.kind === "office-meetings") {
    content = <OfficeMeetingsPage onCreateMeeting={handleCreateOfficeMeeting} workers={officeWorkers} />;
  } else if (route.kind === "office-tasks") {
    content = <OfficeTasksPage onCreateTask={handleCreateOfficeTask} workers={officeWorkers} />;
  } else if (route.kind === "office-files") {
    content = <OfficeFilesPage workers={officeWorkers} />;
  } else if (route.kind === "office-settings") {
    content = <OfficeSettingsPage initialSettings={overlayGlobalSettings} onSave={handleSaveOfficeSettings} />;
  } else if (selectedWorker) {
    let workerContent: ReactNode = <WorkerDesk worker={selectedWorker} />;

    if (!selectedOnboardingCompleted && route.kind !== "worker-section" && selectedMarketplaceWorker) {
      workerContent = (
        <WorkerOnboardingPage
          onComplete={(payload) => handleCompleteOnboarding(selectedWorker.id, payload)}
          onSaveProgress={(payload) => handleSaveOnboardingProgress(selectedWorker.id, payload)}
          onStartFirstDay={(notice) => {
            setOfficeNotice(notice);
            onNavigate(`#app/office/workers/${selectedWorker.id}/desk`);
          }}
          session={selectedOnboardingSession}
          worker={selectedMarketplaceWorker}
        />
      );
    }

    if (route.kind === "worker-section") {
      if (route.section === "onboarding") {
        if (selectedMarketplaceWorker) {
          workerContent = (
            <WorkerOnboardingPage
              onComplete={(payload) => handleCompleteOnboarding(selectedWorker.id, payload)}
              onSaveProgress={(payload) => handleSaveOnboardingProgress(selectedWorker.id, payload)}
              onStartFirstDay={(notice) => {
                setOfficeNotice(notice);
                onNavigate(`#app/office/workers/${selectedWorker.id}/desk`);
              }}
              session={selectedOnboardingSession}
              worker={selectedMarketplaceWorker}
            />
          );
        }
      } else if (!selectedOnboardingCompleted) {
        if (selectedMarketplaceWorker) {
          workerContent = (
            <WorkerOnboardingPage
              onComplete={(payload) => handleCompleteOnboarding(selectedWorker.id, payload)}
              onSaveProgress={(payload) => handleSaveOnboardingProgress(selectedWorker.id, payload)}
              onStartFirstDay={(notice) => {
                setOfficeNotice(notice);
                onNavigate(`#app/office/workers/${selectedWorker.id}/desk`);
              }}
              session={selectedOnboardingSession}
              worker={selectedMarketplaceWorker}
            />
          );
        }
      } else if (route.section === "briefings") {
        workerContent = (
          <div className="office-page">
            <WorkerHeader worker={selectedWorker} />
            <WorkspaceSection eyebrow="Planner" title="Schedule briefing">
              <BriefingComposer onCreate={(payload) => handleCreateBriefing(selectedWorker.id, payload)} worker={selectedWorker} />
            </WorkspaceSection>
            <BriefingList
              briefings={selectedWorker.briefings}
              onAction={(action, briefingId) => handleBriefingAction(selectedWorker.id, action, briefingId)}
            />
          </div>
        );
      } else if (route.section === "tasks") {
        workerContent = (
          <div className="office-page">
            <WorkerHeader worker={selectedWorker} />
            <TaskBoard
              editableTaskIds={new Set(overlayTasks.filter((task) => task.workerSlug === selectedWorker.id).map((task) => task.id))}
              onUpdateTaskStatus={(taskId, status) => handleUpdateTaskStatus(selectedWorker.id, taskId, status)}
              tasks={selectedWorker.tasks}
            />
          </div>
        );
      } else if (route.section === "worklog") {
        workerContent = (
          <div className="office-page">
            <WorkerHeader worker={selectedWorker} />
            <WorkspaceSection eyebrow="Movement" title="Work log">
              <WorkLog entries={selectedWorker.recentWorkLog} />
            </WorkspaceSection>
          </div>
        );
      } else if (route.section === "knowledge") {
        workerContent = (
          <div className="office-page">
            <WorkerHeader worker={selectedWorker} />
            <KnowledgeProfile onSave={(knowledge) => handleSaveKnowledge(selectedWorker.id, knowledge)} worker={selectedWorker} />
          </div>
        );
      } else if (route.section === "files") {
        workerContent = (
          <div className="office-page">
            <WorkerHeader worker={selectedWorker} />
            <WorkspaceSection eyebrow="Archive" title="Files">
              <FilesPanel
                files={selectedWorker.files}
                onDelete={(fileId) => handleDeleteFile(selectedWorker.id, fileId)}
                onUpload={(file) => handleUploadFile(selectedWorker.id, file)}
              />
            </WorkspaceSection>
          </div>
        );
      } else if (route.section === "chat") {
        workerContent = (
          <div className="office-page">
            <WorkerHeader worker={selectedWorker} />
            <ChatPanel
              onCreateTask={handleCreateTask}
              onNavigate={onNavigate}
              onSendMessage={handleSendMessage}
              worker={selectedWorker}
            />
          </div>
        );
      } else if (route.section === "settings") {
        workerContent = (
          <div className="office-page">
            <WorkerHeader worker={selectedWorker} />
            <WorkerSettingsForm
              isEndingEngagement={isEndingEngagement}
              onEndEngagement={() => handleEndEngagement(selectedWorker)}
              onSave={(settings) => handleSaveSettings(selectedWorker.id, settings)}
              worker={selectedWorker}
            />
          </div>
        );
      }
    }

    if (route.kind === "worker-module") {
      const activeModule = selectedWorker.modules.find((module) => module.id === route.moduleId) ?? selectedWorker.modules[0];
      workerContent = (
        <div className="office-page">
          <WorkerHeader worker={selectedWorker} />
          <GenericTableModule module={activeModule} />
        </div>
      );
    }

    content = workerContent;
  } else {
    content = <OfficeHome onNavigate={onNavigate} userName={userName} workers={officeWorkers} />;
  }

  return (
    <main className={selectedWorker ? "office-shell office-shell-worker" : "office-shell office-shell-home"}>
      <OfficeSidebar currentHash={currentHash} onNavigate={onNavigate} selectedWorker={selectedWorker} workers={officeWorkers} />
      {selectedWorker && (route.kind === "worker-desk" || route.kind === "worker-section" || route.kind === "worker-module") ? (
        <WorkerSidebar currentHash={currentHash} onNavigate={onNavigate} worker={selectedWorker} />
      ) : null}
      <section className="office-main">
        {officeNotice ? (
          <div className="notice-banner notice-banner-success">
            <span>{officeNotice}</span>
          </div>
        ) : null}
        {officeError ? (
          <div className="notice-banner">
            <span>{officeError}</span>
          </div>
        ) : null}
        {content}
      </section>
    </main>
  );
}
