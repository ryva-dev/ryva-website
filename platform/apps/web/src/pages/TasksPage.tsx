import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Alert,
  Button,
  DataRow,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  LoadingState,
  PageHeader,
  SearchInput,
  Select,
  Table,
  Tabs
} from "../design-system";
import {
  ActiveFilters,
  RegisterColumnSelector,
  RegisterFilterSheet,
  RegisterMobileList,
  RegisterMobileRow,
  RegisterPagination,
  RegisterSavedViews,
  SortableHeader,
  type RegisterFilterValue,
  type RegisterSort
} from "../redesign/register/Register";
import { sortRecords } from "../redesign/register/utils";

type Task = {
  id: string;
  subjectType: string;
  subjectId: string;
  subjectName?: string | null;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  blocker: string | null;
  mandatoryGate: boolean;
  completionEvidence: string | null;
  version: number;
  createdAt: string;
  completedAt?: string | null;
  updatedAt?: string | null;
};

type TaskActivity = {
  id: string;
  activityType: string;
  summary: string;
  occurredAt: string;
};

type TaskHistoryEntry = {
  id: string;
  title: string;
  at: string;
};

const initialFilters: RegisterFilterValue = { view: "today", query: "", priority: "", origin: "" };
const taskViews = new Set(["today", "upcoming", "blocked", "completed"]);

function taskViewFromSearch(searchParams: URLSearchParams): string {
  const view = searchParams.get("view")?.trim() ?? "";
  return taskViews.has(view) ? view : "today";
}
const columnOptions = [
  { id: "title", label: "Task", required: true },
  { id: "dueAt", label: "Due" },
  { id: "priority", label: "Priority" },
  { id: "origin", label: "Origin" },
  { id: "action", label: "Action", required: true }
];

const originTypeLabels: Record<string, string> = {
  business: "Business",
  brand: "Brand",
  product: "Product",
  placement_opportunity: "Placement",
  representation_opportunity: "Representation",
  representation_agreement: "Agreement",
  account: "Account",
  protected_account: "Protected account",
  order: "Order",
  commission: "Commission",
  commission_dispute: "Dispute",
  outreach: "Outreach",
  outreach_message: "Outreach"
};

function originPath(task: Task): string {
  const routes: Record<string, string> = {
    placement_opportunity: "/placements",
    representation_opportunity: "/representation",
    representation_agreement: "/agreements",
    order: "/orders",
    commission: "/commissions",
    commission_dispute: "/commission-disputes",
    protected_account: "/protected-accounts",
    account: "/accounts",
    business: "/buyers",
    brand: "/brands",
    product: "/products"
  };
  const root = routes[task.subjectType];
  return root ? `${root}/${task.subjectId}` : `/records/${task.subjectType}/${task.subjectId}`;
}

function originTypeLabel(subjectType: string): string {
  return originTypeLabels[subjectType] ?? subjectType
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function originDisplayName(task: Task): string {
  const name = task.subjectName?.replace(/\s+/g, " ").trim();
  if (name) {
    return name.replace(/\s+(?:[a-z]{2,}(?:-[a-z0-9]+)+-\d{8,})\s*$/i, "").trim() || name;
  }
  return originTypeLabel(task.subjectType);
}

function showOriginTypeMeta(task: Task, typeVaries = true): boolean {
  const rawName = task.subjectName?.replace(/\s+/g, " ").trim();
  if (!rawName) return false;
  if (!typeVaries) return false;
  const type = originTypeLabel(task.subjectType).toLowerCase();
  const name = originDisplayName(task).toLowerCase();
  return !name.includes(type);
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dueText(task: Task): string {
  if (!task.dueAt) return "—";
  const due = new Date(task.dueAt);
  const dueDay = startOfLocalDay(due);
  const today = startOfLocalDay(new Date());
  const dayMs = 24 * 60 * 60 * 1000;
  if (task.status !== "completed" && dueDay < today) return "Overdue";
  if (dueDay === today) return "Today";
  if (dueDay === today + dayMs) return "Tomorrow";
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function createdText(iso: string): string {
  const created = new Date(iso);
  const date = created.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = created.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

function historyFromTask(task: Task, activities: TaskActivity[]): TaskHistoryEntry[] {
  if (activities.length) {
    return activities.map((activity) => ({
      id: activity.id,
      title: activity.summary || activity.activityType.replaceAll("_", " "),
      at: activity.occurredAt
    }));
  }
  if (task.completedAt) {
    return [{ id: `${task.id}-completed`, title: "Completed", at: task.completedAt }];
  }
  return [];
}

function dueClass(task: Task): string | undefined {
  if (!task.dueAt || task.status === "completed") return undefined;
  const dueDay = startOfLocalDay(new Date(task.dueAt));
  const today = startOfLocalDay(new Date());
  if (dueDay < today) return "ry-tasks-due-overdue";
  if (dueDay === today) return "ry-tasks-due-today";
  return undefined;
}

function priorityClass(priority: string): string {
  return `ry-task-priority ry-task-priority-${priority}`;
}

function PriorityLabel({ priority }: { priority: string }) {
  return (
    <span className={priorityClass(priority)}>
      <span className="ry-task-priority-dot" aria-hidden="true" />
      {priority}
    </span>
  );
}

function TaskStatusLabel({ status }: { status: string }) {
  return (
    <span className={`ry-task-status ry-task-status-${status}`}>
      <span className="ry-task-status-dot" aria-hidden="true" />
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function TasksPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filters, setFilters] = useState<RegisterFilterValue>(() => ({
    ...initialFilters,
    view: taskViewFromSearch(searchParams)
  }));
  const [sort, setSort] = useState<RegisterSort>({ field: "dueAt", direction: "asc" });
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("compact");
  const [selected, setSelected] = useState<Task | null>(null);
  const [taskActivities, setTaskActivities] = useState<TaskActivity[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const view = taskViewFromSearch(searchParams);
    setFilters((current) => (current.view === view ? current : { ...current, view }));
  }, [searchParams]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setTasks((await api<{ tasks: Task[] }>("/api/tasks")).tasks);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tasks could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!selected) {
      setTaskActivities([]);
      return;
    }
    let cancelled = false;
    void api<{ activities: TaskActivity[] }>(`/api/tasks/${selected.id}/activities`)
      .then((response) => {
        if (!cancelled) setTaskActivities(response.activities);
      })
      .catch(() => {
        if (!cancelled) setTaskActivities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function complete(task: Task) {
    if (!canWrite) return;
    setUpdatingId(task.id);
    setError("");
    try {
      await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: {
          version: task.version,
          status: "completed",
          completionEvidence: task.mandatoryGate ? "Verified manually by task owner." : null
        }
      });
      setSelected(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Task could not be updated.");
    } finally {
      setUpdatingId("");
    }
  }

  const filtered = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const query = (filters.query ?? "").toLowerCase();
    return sortRecords(tasks.filter((task) => {
      const due = task.dueAt ? new Date(task.dueAt).getTime() : null;
      const inView = filters.view === "completed" ? task.status === "completed" :
        filters.view === "blocked" ? task.status === "blocked" :
        filters.view === "upcoming" ? task.status !== "completed" && due !== null && due >= tomorrow :
        task.status !== "completed" && (due === null || due < tomorrow);
      return inView &&
        (!query || `${task.title} ${task.subjectType} ${task.subjectName ?? ""} ${task.blocker ?? ""}`.toLowerCase().includes(query)) &&
        (!filters.priority || task.priority === filters.priority) &&
        (!filters.origin || task.subjectType === filters.origin);
    }), sort, (task, field) => {
      if (field === "origin") return task.subjectType;
      if (field === "dueAt") return task.dueAt ? new Date(task.dueAt).getTime() : null;
      return String(task[field as keyof Task] ?? "");
    });
  }, [filters, sort, tasks]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const nextTask = filtered.find((task) => task.status !== "completed");
  const statusVaries = useMemo(() => {
    if (filtered.length < 2) return false;
    const first = filtered[0]?.status;
    return Boolean(first && filtered.some((task) => task.status !== first));
  }, [filtered]);
  const originTypeVaries = useMemo(() => {
    if (filtered.length < 2) return false;
    const first = filtered[0]?.subjectType;
    return Boolean(first && filtered.some((task) => task.subjectType !== first));
  }, [filtered]);
  const showStatus = statusVaries;
  const activeFilters = Object.entries(filters).filter(([id, value]) => id !== "view" && value).map(([id, value]) => ({ id, label: `${id === "query" ? "Search" : id === "priority" ? "Priority" : "Origin"}: ${value}` }));
  const taskHistory = selected ? historyFromTask(selected, taskActivities) : [];

  function syncViewParam(view: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (view && view !== "today") next.set("view", view);
      else next.delete("view");
      return next;
    }, { replace: true });
  }

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
    setPage(1);
    if (id === "view") syncViewParam(value || "today");
  }

  return (
    <div className="page ry-register-page">
      <PageHeader
        eyebrow="Owned work"
        title="Tasks"
        description="Review work assigned to you, its originating record, and any completion evidence or blocker required before it can move."
        action={nextTask ? <Link className="primary-button" to={originPath(nextTask)}>Open next task</Link> : <Link className="secondary-button" to="/">Review priorities</Link>}
      />
      {!canWrite ? <Alert tone="warning" className="ry-register-policy" title="Read-only access">You may inspect permitted Tasks and their requirements, but cannot complete them in this session.</Alert> : null}
      <Tabs label="Task views">
        {[{ id: "today", label: "Today" }, { id: "upcoming", label: "Upcoming" }, { id: "blocked", label: "Blocked" }, { id: "completed", label: "Completed" }].map((view) => <button key={view.id} type="button" className={filters.view === view.id ? "active" : undefined} aria-current={filters.view === view.id ? "page" : undefined} onClick={() => updateFilter("view", view.id)}>{view.label}</button>)}
      </Tabs>
      <section className={`ry-register-surface${!loading && !error && filtered.length === 0 ? " ry-register-surface-empty" : ""}`} aria-label="Owned Task register">
        <div className="ry-register-commandbar">
          <RegisterSavedViews recordType="task" filters={filters} sort={sort} canWrite={Boolean(canWrite)} onApply={(nextFilters, nextSort) => { const next = { ...initialFilters, ...nextFilters }; setFilters(next); setSort(nextSort); setPage(1); syncViewParam(next.view || "today"); }} />
          <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
            <FilterBar>
              <Field label="Search Tasks"><SearchInput label="Search Tasks" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} /></Field>
              <Field label="Priority"><Select controlSize="compact" value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value)}><option value="">All priorities</option>{[...new Set(tasks.map((task) => task.priority))].map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
              <Field label="Origin"><Select controlSize="compact" value={filters.origin} onChange={(event) => updateFilter("origin", event.target.value)}><option value="">All origins</option>{[...new Set(tasks.map((task) => task.subjectType))].map((value) => <option key={value} value={value}>{originTypeLabel(value)}</option>)}</Select></Field>
            </FilterBar>
          </RegisterFilterSheet>
        </div>
        <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => setFilters((current) => ({ ...initialFilters, view: current.view ?? "today" }))} />
        <div className="ry-register-resultbar">
          <span>{filtered.length} {filters.view} tasks</span>
          <RegisterColumnSelector columns={columnOptions} visible={visibleColumns} onChange={(id, shown) => setVisibleColumns((current) => { const next = new Set(current); if (shown) next.add(id); else next.delete(id); return next; })} density={density} onDensityChange={setDensity} />
        </div>
        {loading ? <LoadingState label="Loading owned Tasks" /> : error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : filtered.length === 0 ? (
          <EmptyState
            compact
            icon={(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            )}
            title={
              tasks.length
                ? ({
                    today: "No tasks due today",
                    upcoming: "No upcoming tasks",
                    blocked: "No blocked tasks",
                    completed: "No completed tasks"
                  }[filters.view ?? "today"] ?? `No tasks ${filters.view ?? "today"}`)
                : "No tasks assigned to you"
            }
            description={
              tasks.length
                ? ({
                    today: "Nothing due today. Check Upcoming for what’s next.",
                    upcoming: "Nothing scheduled yet. New tasks will appear here as work is planned.",
                    blocked: "No blocked tasks. Your current work can move forward.",
                    completed: "No completed tasks yet. Finished work will appear here."
                  }[filters.view ?? "today"] ?? "Check another view or review upcoming work.")
                : "Assigned work will appear here with its origin and due date."
            }
            action={
              tasks.length
                ? filters.view === "today"
                  ? <Button variant="secondary" size="compact" onClick={() => updateFilter("view", "upcoming")}>View upcoming tasks</Button>
                  : <Button variant="secondary" size="compact" onClick={() => { setFilters(initialFilters); syncViewParam("today"); }}>Return to Today</Button>
                : undefined
            }
          />
        ) : <>
          <Table caption={`${filters.view} Tasks`} compact={density === "compact"} className="ry-tasks-table">
            <thead><tr>
              {visibleColumns.has("title") ? <SortableHeader field="title" label="Task" sort={sort} onSort={setSort} className="ry-tasks-col-task" /> : null}
              {visibleColumns.has("dueAt") ? <SortableHeader field="dueAt" label="Due" sort={sort} onSort={setSort} className="ry-tasks-col-due" /> : null}
              {visibleColumns.has("priority") ? <SortableHeader field="priority" label="Priority" sort={sort} onSort={setSort} className="ry-tasks-col-priority" /> : null}
              {showStatus ? <SortableHeader field="status" label="Status" sort={sort} onSort={setSort} className="ry-tasks-col-status" /> : null}
              {visibleColumns.has("origin") ? <SortableHeader field="origin" label="Origin" sort={sort} onSort={setSort} className="ry-tasks-col-origin" /> : null}
              {visibleColumns.has("action") ? <th scope="col" className="ry-register-cell-actions ry-tasks-col-action">Action</th> : null}
            </tr></thead>
            <tbody>{visibleItems.map((task) => (
              <DataRow
                key={task.id}
                className="ry-tasks-row"
                selected={selected?.id === task.id}
                blocked={task.status === "blocked"}
                tabIndex={0}
                aria-label={`Review task ${task.title}`}
                onClick={() => setSelected(task)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(task);
                  }
                }}
              >
              {visibleColumns.has("title") ? <td className="ry-tasks-col-task"><span className="ry-register-table-button">{task.title}</span>{task.mandatoryGate ? <small className="ry-register-cell-meta">Completion evidence required</small> : null}</td> : null}
              {visibleColumns.has("dueAt") ? <td className={["ry-tasks-col-due", dueClass(task)].filter(Boolean).join(" ")}>{dueText(task)}</td> : null}
              {visibleColumns.has("priority") ? <td className="ry-tasks-col-priority"><PriorityLabel priority={task.priority} /></td> : null}
              {showStatus ? <td className="ry-tasks-col-status"><TaskStatusLabel status={task.status} /></td> : null}
              {visibleColumns.has("origin") ? (
                <td className="ry-tasks-col-origin">
                  <Link
                    className="ry-tasks-origin-link"
                    to={originPath(task)}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {originDisplayName(task)}
                  </Link>
                  {showOriginTypeMeta(task, originTypeVaries) ? <small className="ry-register-cell-meta">{originTypeLabel(task.subjectType)}</small> : null}
                </td>
              ) : null}
              {visibleColumns.has("action") ? (
                <td className="ry-register-cell-actions ry-tasks-col-action">
                  {task.status !== "completed" ? (
                    <Button
                      variant="secondary"
                      size="compact"
                      className="ry-register-complete"
                      loading={updatingId === task.id}
                      disabled={!canWrite}
                      aria-label={`Complete ${task.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void complete(task);
                      }}
                    >
                      Complete
                    </Button>
                  ) : null}
                </td>
              ) : null}
            </DataRow>
            ))}</tbody>
          </Table>
          <RegisterMobileList label={`${filters.view} Tasks`}>{visibleItems.map((task) => <RegisterMobileRow key={task.id} title={task.title} meta={`${dueText(task)} · ${task.priority} · ${originDisplayName(task)}${task.mandatoryGate ? " · evidence required" : ""}`} status={<TaskStatusLabel status={task.status} />} actions={task.status !== "completed" ? <Button variant="secondary" loading={updatingId === task.id} disabled={!canWrite} onClick={() => void complete(task)}>Complete</Button> : undefined} onOpen={() => setSelected(task)} openLabel={`Review Task ${task.title}`} />)}</RegisterMobileList>
          <RegisterPagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={pageSize} onPage={setPage} />
        </>}
      </section>

      <Drawer
        open={Boolean(selected)}
        size="narrow"
        className="ry-tasks-drawer"
        title={selected?.title ?? "Task details"}
        meta={selected ? (
          <div className="ry-tasks-drawer-meta">
            <TaskStatusLabel status={selected.status} />
            <PriorityLabel priority={selected.priority} />
          </div>
        ) : undefined}
        onClose={() => setSelected(null)}
      >
        {selected ? <div className="ry-register-preview">
          {selected.blocker ? <Alert tone="danger" title="Task is blocked">{selected.blocker}</Alert> : null}
          <dl>
            <div>
              <dt>Origin</dt>
              <dd className="ry-tasks-origin-value">
                <Link className="ry-tasks-origin-link" to={originPath(selected)}>{originDisplayName(selected)}</Link>
                {showOriginTypeMeta(selected, originTypeVaries) ? <small className="ry-register-cell-meta">{originTypeLabel(selected.subjectType)}</small> : null}
              </dd>
            </div>
            <div><dt>Due state</dt><dd>{dueText(selected)}</dd></div>
            <div><dt>Evidence requirement</dt><dd>{selected.mandatoryGate ? "Completion evidence is required" : "No evidence required"}</dd></div>
            <div><dt>Evidence status</dt><dd>{selected.completionEvidence ?? "Not recorded"}</dd></div>
            <div><dt>Created</dt><dd><time dateTime={selected.createdAt}>{createdText(selected.createdAt)}</time></dd></div>
          </dl>
          {taskHistory.length ? (
            <section className="ry-tasks-drawer-history" aria-label="Task history">
              <h3>History</h3>
              <ol>
                {taskHistory.map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.title}</span>
                    <time dateTime={entry.at}>{createdText(entry.at)}</time>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          <div className="ry-tasks-drawer-actions">
            {selected.status !== "completed" ? (
              <Button
                className="ry-tasks-drawer-complete"
                loading={updatingId === selected.id}
                disabled={!canWrite}
                onClick={() => void complete(selected)}
              >
                Complete task
              </Button>
            ) : null}
            <Link className="ry-tasks-drawer-origin-action" to={originPath(selected)}>
              Open originating record
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        </div> : null}
      </Drawer>
    </div>
  );
}
