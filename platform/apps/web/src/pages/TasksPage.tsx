import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  StatusLabel,
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
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  blocker: string | null;
  mandatoryGate: boolean;
  completionEvidence: string | null;
  version: number;
  createdAt: string;
};

const initialFilters: RegisterFilterValue = { view: "today", query: "", priority: "", origin: "" };
const columnOptions = [
  { id: "title", label: "Task", required: true },
  { id: "origin", label: "Origin" },
  { id: "priority", label: "Priority" },
  { id: "dueAt", label: "Due" },
  { id: "status", label: "Status" },
  { id: "action", label: "Action", required: true }
];

function originPath(task: Task): string {
  const routes: Record<string, string> = {
    placement_opportunity: "/placements",
    representation_opportunity: "/representation",
    order: "/orders",
    commission: "/commissions",
    protected_account: "/protected-accounts"
  };
  const root = routes[task.subjectType];
  return root ? `${root}/${task.subjectId}` : `/records/${task.subjectType}/${task.subjectId}`;
}

function dueText(task: Task): string {
  if (!task.dueAt) return "No due date";
  const due = new Date(task.dueAt);
  const overdue = due.getTime() < Date.now() && task.status !== "completed";
  return `${overdue ? "Overdue · " : "Due "}${due.toLocaleDateString()}`;
}

export function TasksPage() {
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "dueAt", direction: "asc" });
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [selected, setSelected] = useState<Task | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [page, setPage] = useState(1);

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
        (!query || `${task.title} ${task.subjectType} ${task.blocker ?? ""}`.toLowerCase().includes(query)) &&
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
  const activeFilters = Object.entries(filters).filter(([id, value]) => id !== "view" && value).map(([id, value]) => ({ id, label: `${id === "query" ? "Search" : id === "priority" ? "Priority" : "Origin"}: ${value}` }));

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
    setPage(1);
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
      <section className="ry-register-surface" aria-label="Owned Task register">
        <div className="ry-register-commandbar">
          <RegisterSavedViews recordType="task" filters={filters} sort={sort} canWrite={Boolean(canWrite)} onApply={(nextFilters, nextSort) => { setFilters({ ...initialFilters, ...nextFilters }); setSort(nextSort); setPage(1); }} />
          <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
            <FilterBar>
              <Field label="Search Tasks"><SearchInput label="Search Tasks" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} /></Field>
              <Field label="Priority"><Select controlSize="compact" value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value)}><option value="">All priorities</option>{[...new Set(tasks.map((task) => task.priority))].map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
              <Field label="Origin"><Select controlSize="compact" value={filters.origin} onChange={(event) => updateFilter("origin", event.target.value)}><option value="">All origins</option>{[...new Set(tasks.map((task) => task.subjectType))].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field>
            </FilterBar>
          </RegisterFilterSheet>
        </div>
        <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => setFilters((current) => ({ ...initialFilters, view: current.view ?? "today" }))} />
        <div className="ry-register-resultbar">
          <span>{filtered.length} Tasks in {filters.view}</span>
          <RegisterColumnSelector columns={columnOptions} visible={visibleColumns} onChange={(id, shown) => setVisibleColumns((current) => { const next = new Set(current); if (shown) next.add(id); else next.delete(id); return next; })} density={density} onDensityChange={setDensity} />
        </div>
        {loading ? <LoadingState label="Loading owned Tasks" /> : error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : filtered.length === 0 ? (
          <EmptyState title={tasks.length ? `No ${filters.view} Tasks` : "No Tasks are assigned to you"} description={tasks.length ? "Choose another view or clear the current filters. Home remains the place for cross-workspace priority ordering." : "Owned work will appear here with its originating record and completion requirements."} action={tasks.length ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Return to Today</Button> : undefined} />
        ) : <>
          <Table caption={`${filters.view} Tasks`} compact={density === "compact"}>
            <thead><tr>
              {visibleColumns.has("title") ? <SortableHeader field="title" label="Task" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("origin") ? <SortableHeader field="origin" label="Origin" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("priority") ? <SortableHeader field="priority" label="Priority" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("dueAt") ? <SortableHeader field="dueAt" label="Due" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("status") ? <SortableHeader field="status" label="Status" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("action") ? <th scope="col">Action</th> : null}
            </tr></thead>
            <tbody>{visibleItems.map((task) => <DataRow key={task.id} selected={selected?.id === task.id} blocked={task.status === "blocked"}>
              {visibleColumns.has("title") ? <td><button type="button" className="ry-register-table-button" onClick={() => setSelected(task)}>{task.title}</button>{task.mandatoryGate ? <small className="ry-register-cell-meta">Completion evidence required</small> : null}</td> : null}
              {visibleColumns.has("origin") ? <td><Link to={originPath(task)}>{task.subjectType.replaceAll("_", " ")}</Link></td> : null}
              {visibleColumns.has("priority") ? <td><StatusLabel value={task.priority} /></td> : null}
              {visibleColumns.has("dueAt") ? <td>{dueText(task)}</td> : null}
              {visibleColumns.has("status") ? <td><StatusLabel value={task.status} /></td> : null}
              {visibleColumns.has("action") ? <td className="ry-register-cell-actions">{task.status !== "completed" ? <Button variant="secondary" size="compact" loading={updatingId === task.id} disabled={!canWrite} onClick={() => void complete(task)}>Complete {task.title}</Button> : null}</td> : null}
            </DataRow>)}</tbody>
          </Table>
          <RegisterMobileList label={`${filters.view} Tasks`}>{visibleItems.map((task) => <RegisterMobileRow key={task.id} title={task.title} meta={`${dueText(task)} · ${task.priority} priority · ${task.subjectType.replaceAll("_", " ")}${task.mandatoryGate ? " · evidence required" : ""}`} status={<StatusLabel value={task.status} />} actions={task.status !== "completed" ? <Button variant="secondary" loading={updatingId === task.id} disabled={!canWrite} onClick={() => void complete(task)}>Complete</Button> : undefined} onOpen={() => setSelected(task)} openLabel={`Review Task ${task.title}`} />)}</RegisterMobileList>
          <RegisterPagination page={currentPage} pageCount={pageCount} total={filtered.length} onPage={setPage} />
        </>}
      </section>

      <Drawer open={Boolean(selected)} title={selected?.title ?? "Task details"} description="Ownership, originating record, due state, and completion requirements." onClose={() => setSelected(null)}>
        {selected ? <div className="ry-register-preview">
          <div><StatusLabel value={selected.status} /> <StatusLabel value={selected.priority} /></div>
          {selected.blocker ? <Alert tone="danger" title="Task is blocked">{selected.blocker}</Alert> : null}
          <dl>
            <div><dt>Origin</dt><dd><Link to={originPath(selected)}>{selected.subjectType.replaceAll("_", " ")}</Link></dd></div>
            <div><dt>Due state</dt><dd>{dueText(selected)}</dd></div>
            <div><dt>Mandatory gate</dt><dd>{selected.mandatoryGate ? "Completion evidence is required" : "No mandatory evidence gate"}</dd></div>
            <div><dt>Completion evidence</dt><dd>{selected.completionEvidence ?? "Not yet recorded"}</dd></div>
            <div><dt>Created</dt><dd><time dateTime={selected.createdAt}>{new Date(selected.createdAt).toLocaleString()}</time></dd></div>
          </dl>
          <Link className="secondary-button" to={originPath(selected)}>Open originating record</Link>
          {selected.status !== "completed" ? <Button loading={updatingId === selected.id} disabled={!canWrite} onClick={() => void complete(selected)}>Complete task</Button> : null}
        </div> : null}
      </Drawer>
    </div>
  );
}
