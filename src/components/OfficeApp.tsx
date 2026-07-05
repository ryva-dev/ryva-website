import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

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
import type { Worker } from "../types";

type OfficeAppProps = {
  hiredWorkers: Worker[];
  onNavigate: (hash: string) => void;
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
  { key: "desk", label: "Desk" },
  { key: "briefings", label: "Briefings" },
  { key: "tasks", label: "Tasks" },
  { key: "worklog", label: "Work Log" },
  { key: "knowledge", label: "Knowledge" },
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

function mergeOfficeWorkers(
  workers: OfficeWorker[],
  chats: OfficeOverlayChat[],
  tasks: OfficeOverlayTask[],
  worklog: OfficeOverlayWorklog[],
  settings: OfficeOverlaySettings[],
  knowledge: OfficeOverlayKnowledge[],
  files: OfficeOverlayFile[]
) {
  return workers.map((worker) => ({
    ...worker,
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

function Panel({
  title,
  children,
  aside
}: {
  aside?: string;
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="office-panel">
      <div className="office-panel-head">
        <h3>{title}</h3>
        {aside ? <span>{aside}</span> : null}
      </div>
      {children}
    </section>
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
          Save knowledge
        </button>
      </div>
    </form>
  );
}

function FilesPanel({
  files,
  onUpload
}: {
  files: WorkerFile[];
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
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={`${file.id ?? file.name}-${file.updatedAt}`}>
              <td>{file.downloadUrl ? <a href={file.downloadUrl}>{file.name}</a> : file.name}</td>
              <td>{file.type}</td>
              <td>{file.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
        <Panel title="Current focus">
          <SimpleList items={worker.currentFocus} />
        </Panel>
        <Panel title="Open tasks">
          <SimpleList items={worker.tasks.filter((task) => task.status !== "Completed").slice(0, 4).map((task) => task.title)} />
        </Panel>
        <Panel title="Quick actions">
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
        </Panel>
      </aside>
    </div>
  );
}

function GenericTableModule({ module }: { module: WorkerModule }) {
  return (
    <section className="office-panel">
      <div className="office-panel-head">
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
    <div className="office-content-grid">
      <div className="office-main-column">
        <WorkerHeader worker={worker} />
        <div className="snapshot-grid">
          {worker.snapshot.map((metric) => (
            <article className="snapshot-card" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>
        <Panel title="Current focus">
          <SimpleList items={worker.currentFocus} />
        </Panel>
        <Panel title="Today's work">
          <SimpleList items={worker.todayWork} />
        </Panel>
        <Panel title="Needs your review" aside={`${worker.reviewQueue.length} items`}>
          <ReviewQueue items={worker.reviewQueue} />
        </Panel>
        <Panel title="Recent work log">
          <WorkLog entries={worker.recentWorkLog} />
        </Panel>
      </div>

      <div className="office-side-column">
        <Panel title="Blocked by">
          <SimpleList items={worker.blockedBy} />
        </Panel>
        <Panel title="Next briefing">
          <p className="office-note">{worker.nextBriefing}</p>
        </Panel>
        <Panel title="Role-specific snapshot">
          <SimpleList items={worker.snapshot.map((metric) => `${metric.label}: ${metric.value}`)} />
        </Panel>
      </div>
    </div>
  );
}

function WorkerSettingsForm({
  onSave,
  worker
}: {
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
      </div>
    </form>
  );
}

function OfficeHome({ userName, workers }: { userName: string; workers: OfficeWorker[] }) {
  const overview = buildOfficeOverview(workers);

  return (
    <div className="office-page">
      <TopBar
        rightLabel={`${workers.length} hired workers · ${totalOpenTasks(workers)} open tasks`}
        subtitle="Good morning. Your office overview is organized by worker, review queue, and recent work."
        title={`Welcome back, ${userName}.`}
      />

      <div className="overview-stats">
        <article className="snapshot-card">
          <span>Hired workers</span>
          <strong>{workers.length}</strong>
        </article>
        <article className="snapshot-card">
          <span>Work needing review</span>
          <strong>{totalReviewItems(workers)}</strong>
        </article>
        <article className="snapshot-card">
          <span>Open tasks</span>
          <strong>{totalOpenTasks(workers)}</strong>
        </article>
      </div>

      <div className="office-overview-grid">
        <Panel title="Work needing review">
          <SimpleList items={overview.review} />
        </Panel>
        <Panel title="Today's briefings">
          <SimpleList items={overview.briefings} />
        </Panel>
        <Panel title="Upcoming tasks">
          <SimpleList items={overview.tasks} />
        </Panel>
        <Panel title="Recent activity across all workers">
          <SimpleList items={overview.activity} />
        </Panel>
      </div>
    </div>
  );
}

function OfficeMeetingsPage({ workers }: { workers: OfficeWorker[] }) {
  const briefings = allBriefings(workers);

  return (
    <div className="office-page">
      <TopBar subtitle="Briefings and review meetings across every hired worker." title="Meetings" />
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
    </div>
  );
}

function OfficeTasksPage({ workers }: { workers: OfficeWorker[] }) {
  return (
    <div className="office-page">
      <TopBar subtitle="Task queues across all hired workers and office work." title="Tasks" />
      <TaskBoard tasks={workers.flatMap((worker) => worker.tasks)} />
    </div>
  );
}

function OfficeFilesPage({ workers }: { workers: OfficeWorker[] }) {
  return (
    <div className="office-page">
      <TopBar subtitle="Documents and working files used across the office." title="Files" />
      <table className="office-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Worker</th>
            <th>Type</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {allFiles(workers).map((file) => (
            <tr key={`${file.workerName}-${file.name}`}>
              <td>{file.name}</td>
              <td>{file.workerName}</td>
              <td>{file.type}</td>
              <td>{file.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OfficeSettingsPage() {
  return (
    <div className="office-page">
      <TopBar subtitle="General office settings and operating preferences." title="Settings" />
      <div className="settings-grid">
        <section className="knowledge-card">
          <h4>Office preferences</h4>
          <SimpleList
            items={[
              "Morning briefing digest at 8:30 AM",
              "Review queue summaries grouped by worker",
              "Task reminders on due date only",
              "Connected tools placeholder for calendar, documents, and billing"
            ]}
          />
        </section>
        <section className="knowledge-card">
          <h4>Approval rules</h4>
          <SimpleList
            items={[
              "Escalate blocked work immediately",
              "Require approval for finance exceptions and pricing changes",
              "Send end-of-day activity digest across all workers"
            ]}
          />
        </section>
      </div>
    </div>
  );
}

export function OfficeApp({ hiredWorkers, onNavigate, userName }: OfficeAppProps) {
  const [overlayChats, setOverlayChats] = useState<OfficeOverlayChat[]>([]);
  const [overlayFiles, setOverlayFiles] = useState<OfficeOverlayFile[]>([]);
  const [overlayKnowledge, setOverlayKnowledge] = useState<OfficeOverlayKnowledge[]>([]);
  const [overlaySettings, setOverlaySettings] = useState<OfficeOverlaySettings[]>([]);
  const [overlayTasks, setOverlayTasks] = useState<OfficeOverlayTask[]>([]);
  const [overlayWorklog, setOverlayWorklog] = useState<OfficeOverlayWorklog[]>([]);
  const [officeError, setOfficeError] = useState("");

  const baseWorkers = useMemo(() => buildOfficeWorkersFromMarketplaceWorkers(hiredWorkers), [hiredWorkers]);
  const officeWorkers = useMemo(
    () => mergeOfficeWorkers(baseWorkers, overlayChats, overlayTasks, overlayWorklog, overlaySettings, overlayKnowledge, overlayFiles),
    [baseWorkers, overlayChats, overlayTasks, overlayWorklog, overlaySettings, overlayKnowledge, overlayFiles]
  );
  const currentHash = window.location.hash || "#app/office";
  const route = parseOfficePath(currentHash);
  const selectedWorker =
    "workerId" in route ? officeWorkers.find((worker) => worker.id === route.workerId) ?? null : null;

  useEffect(() => {
    async function loadOverlays() {
      if (hiredWorkers.length === 0) {
        setOverlayChats([]);
        setOverlayFiles([]);
        setOverlayKnowledge([]);
        setOverlaySettings([]);
        setOverlayTasks([]);
        setOverlayWorklog([]);
        return;
      }

      try {
        const response = await officeJson<{
          chats: OfficeOverlayChat[];
          files: OfficeOverlayFile[];
          knowledge: OfficeOverlayKnowledge[];
          settings: OfficeOverlaySettings[];
          tasks: OfficeOverlayTask[];
          worklog: OfficeOverlayWorklog[];
        }>("/api/office/overlays", { method: "GET" });
        setOverlayChats(response.chats);
        setOverlayFiles(response.files);
        setOverlayKnowledge(response.knowledge);
        setOverlaySettings(response.settings);
        setOverlayTasks(response.tasks);
        setOverlayWorklog(response.worklog);
        setOfficeError("");
      } catch (error) {
        setOfficeError(error instanceof Error ? error.message : "Unable to load office updates.");
      }
    }

    void loadOverlays();
  }, [hiredWorkers]);

  async function refreshOverlays() {
    const response = await officeJson<{
      chats: OfficeOverlayChat[];
      files: OfficeOverlayFile[];
      knowledge: OfficeOverlayKnowledge[];
      settings: OfficeOverlaySettings[];
      tasks: OfficeOverlayTask[];
      worklog: OfficeOverlayWorklog[];
    }>("/api/office/overlays", { method: "GET" });
    setOverlayChats(response.chats);
    setOverlayFiles(response.files);
    setOverlayKnowledge(response.knowledge);
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
  }

  async function handleCreateTask(worker: OfficeWorker, seed?: string) {
    await officeJson(`/api/office/workers/${worker.id}/tasks`, {
      method: "POST",
      body: JSON.stringify({
        dueDate: "Tomorrow",
        module: worker.modules[0]?.name ?? "Work Queue",
        owner: "Worker",
        priority: "High",
        title: seed ?? `Follow up on ${worker.name}'s current work`
      })
    });
    await refreshOverlays();
  }

  async function handleBriefingAction(workerSlug: string, action: "approve" | "followup" | "task", briefingId: string) {
    await officeJson(`/api/office/workers/${workerSlug}/briefings/${briefingId}/action`, {
      method: "POST",
      body: JSON.stringify({ action })
    });
    await refreshOverlays();
  }

  async function handleUpdateTaskStatus(workerSlug: string, taskId: string, status: OfficeTaskStatus) {
    await officeJson(`/api/office/workers/${workerSlug}/tasks/${taskId}/status`, {
      method: "POST",
      body: JSON.stringify({ status })
    });
    await refreshOverlays();
  }

  async function handleSaveKnowledge(workerSlug: string, knowledge: OfficeWorker["knowledge"]) {
    await officeJson(`/api/office/workers/${workerSlug}/knowledge`, {
      method: "POST",
      body: JSON.stringify({ knowledge })
    });
    await refreshOverlays();
  }

  async function handleSaveSettings(workerSlug: string, settings: OfficeWorker["settings"]) {
    await officeJson(`/api/office/workers/${workerSlug}/settings`, {
      method: "POST",
      body: JSON.stringify({ settings })
    });
    await refreshOverlays();
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
  }

  let content: ReactNode;

  if (route.kind === "office-home") {
    content = <OfficeHome userName={userName} workers={officeWorkers} />;
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
                  Open desk
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  } else if (route.kind === "office-meetings") {
    content = <OfficeMeetingsPage workers={officeWorkers} />;
  } else if (route.kind === "office-tasks") {
    content = <OfficeTasksPage workers={officeWorkers} />;
  } else if (route.kind === "office-files") {
    content = <OfficeFilesPage workers={officeWorkers} />;
  } else if (route.kind === "office-settings") {
    content = <OfficeSettingsPage />;
  } else if (selectedWorker) {
    let workerContent: ReactNode = <WorkerDesk worker={selectedWorker} />;

    if (route.kind === "worker-section") {
      if (route.section === "briefings") {
        workerContent = (
          <div className="office-page">
            <WorkerHeader worker={selectedWorker} />
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
            <Panel title="Work log">
              <WorkLog entries={selectedWorker.recentWorkLog} />
            </Panel>
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
            <Panel title="Files">
              <FilesPanel files={selectedWorker.files} onUpload={(file) => handleUploadFile(selectedWorker.id, file)} />
            </Panel>
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
            <WorkerSettingsForm onSave={(settings) => handleSaveSettings(selectedWorker.id, settings)} worker={selectedWorker} />
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
    content = <OfficeHome userName={userName} workers={officeWorkers} />;
  }

  return (
    <main className={selectedWorker ? "office-shell office-shell-worker" : "office-shell office-shell-home"}>
      <OfficeSidebar currentHash={currentHash} onNavigate={onNavigate} selectedWorker={selectedWorker} workers={officeWorkers} />
      {selectedWorker && (route.kind === "worker-desk" || route.kind === "worker-section" || route.kind === "worker-module") ? (
        <WorkerSidebar currentHash={currentHash} onNavigate={onNavigate} worker={selectedWorker} />
      ) : null}
      <section className="office-main">
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
