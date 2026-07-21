import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Alert,
  Button,
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
  Tabs
} from "../design-system";
import {
  ActiveFilters,
  RegisterFilterSheet,
  RegisterMobileList,
  RegisterMobileRow,
  RegisterPagination,
  RegisterSavedViews,
  type RegisterFilterValue,
  type RegisterSort
} from "../redesign/register/Register";
import { sortRecords } from "../redesign/register/utils";

type Notification = {
  id: string;
  notificationType: string;
  title: string;
  reason: string;
  severity: string;
  status: string;
  blocking: boolean;
  subjectType: string;
  subjectId: string;
  occurrenceCount: number;
  firstOccurredAt: string;
  lastOccurredAt: string;
  expiresAt: string | null;
  dueAt: string | null;
  createdAt: string;
};

const initialFilters: RegisterFilterValue = { view: "action_required", query: "", severity: "", notificationType: "" };

function relatedPath(item: Notification): string {
  const routes: Record<string, string> = {
    placement_opportunity: "/placements",
    representation_opportunity: "/representation",
    order: "/orders",
    commission: "/commissions",
    commission_dispute: "/commission-disputes",
    protected_account: "/protected-accounts",
    task: "/tasks"
  };
  const root = routes[item.subjectType];
  return root ? `${root}/${item.subjectId}` : `/records/${item.subjectType}/${item.subjectId}`;
}

function priority(severity: string): number {
  return ({ critical: 1, action_required: 2, time_sensitive: 3, information: 4 } as Record<string, number>)[severity] ?? 5;
}

export function NotificationsPage() {
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [items, setItems] = useState<Notification[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "priority", direction: "asc" });
  const [selected, setSelected] = useState<Notification | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems((await api<{ notifications: Notification[] }>("/api/notifications")).notifications);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markRead(item: Notification) {
    if (!canWrite || item.status !== "unread") return;
    setUpdatingId(item.id);
    setError("");
    try {
      await api(`/api/notifications/${item.id}`, { method: "PATCH", body: { status: "read" } });
      if (selected?.id === item.id) setSelected({ ...item, status: "read" });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notification could not be updated.");
    } finally {
      setUpdatingId("");
    }
  }

  const filtered = useMemo(() => {
    const query = (filters.query ?? "").toLowerCase();
    return sortRecords(items.filter((item) => {
      const inView = filters.view === "read" ? item.status === "read" : filters.view === "all" ? true : item.status === "unread" && (item.blocking || ["critical", "action_required", "time_sensitive"].includes(item.severity));
      return inView &&
        (!query || `${item.title} ${item.reason} ${item.notificationType}`.toLowerCase().includes(query)) &&
        (!filters.severity || item.severity === filters.severity) &&
        (!filters.notificationType || item.notificationType === filters.notificationType);
    }), sort, (item, field) => {
      if (field === "priority") return priority(item.severity);
      return String(item[field as keyof Notification] ?? "");
    });
  }, [filters, items, sort]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const unreadVisible = visibleItems.filter((item) => item.status === "unread");
  const nextRequired = items.find((item) => item.status === "unread" && (item.blocking || ["critical", "action_required", "time_sensitive"].includes(item.severity)));
  const activeFilters = Object.entries(filters).filter(([id, value]) => id !== "view" && value).map(([id, value]) => ({ id, label: `${id === "query" ? "Search" : id === "severity" ? "Severity" : "Type"}: ${value}` }));

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
    setPage(1);
  }

  async function markVisibleRead() {
    if (!canWrite || unreadVisible.length === 0) return;
    setUpdatingId("visible");
    setError("");
    try {
      for (const item of unreadVisible) {
        await api(`/api/notifications/${item.id}`, { method: "PATCH", body: { status: "read" } });
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The visible notifications could not all be marked read.");
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div className="page ry-register-page">
      <PageHeader
        eyebrow="Attention, not noise"
        title="Notifications"
        description="Understand what changed, why it matters, and which record now requires attention without confusing information with owned work."
        action={nextRequired ? <Link className="primary-button" to={relatedPath(nextRequired)}>Open required record</Link> : <Link className="secondary-button" to="/tasks">Review Tasks</Link>}
      />
      {!canWrite ? <Alert tone="warning" className="ry-register-policy" title="Read-only access">You may inspect permitted Notifications, but cannot change their read state in this session.</Alert> : null}
      <Tabs label="Notification views">
        {[{ id: "action_required", label: "Action required" }, { id: "all", label: "All" }, { id: "read", label: "Read" }].map((view) => <button key={view.id} type="button" className={filters.view === view.id ? "active" : undefined} aria-current={filters.view === view.id ? "page" : undefined} onClick={() => updateFilter("view", view.id)}>{view.label}</button>)}
      </Tabs>
      <section className="ry-register-surface" aria-label="Notification register">
        <div className="ry-register-commandbar">
          <RegisterSavedViews recordType="notification" filters={filters} sort={sort} canWrite={Boolean(canWrite)} onApply={(nextFilters, nextSort) => { setFilters({ ...initialFilters, ...nextFilters }); setSort(nextSort); setPage(1); }} />
          <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
            <FilterBar>
              <Field label="Search Notifications"><SearchInput label="Search Notifications" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} /></Field>
              <Field label="Severity"><Select controlSize="compact" value={filters.severity} onChange={(event) => updateFilter("severity", event.target.value)}><option value="">All severities</option>{[...new Set(items.map((item) => item.severity))].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field>
              <Field label="Notification type"><Select controlSize="compact" value={filters.notificationType} onChange={(event) => updateFilter("notificationType", event.target.value)}><option value="">All types</option>{[...new Set(items.map((item) => item.notificationType))].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field>
            </FilterBar>
          </RegisterFilterSheet>
        </div>
        <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => setFilters((current) => ({ ...initialFilters, view: current.view ?? "action_required" }))} />
        <div className="ry-register-resultbar">
          <span>{filtered.length} Notifications in {(filters.view ?? "action_required").replaceAll("_", " ")}</span>
          {unreadVisible.length ? <Button variant="tertiary" size="compact" loading={updatingId === "visible"} disabled={!canWrite} onClick={() => void markVisibleRead()}>Mark visible read</Button> : null}
        </div>
        {loading ? <LoadingState label="Loading Notifications" /> : error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : filtered.length === 0 ? (
          <EmptyState title={items.length ? `No ${(filters.view ?? "action_required").replaceAll("_", " ")} Notifications` : "No Notifications need attention"} description={items.length ? "Choose another view or clear the current filters. Notifications report change; Tasks remain the owned work record." : "Material changes and required actions will appear here with their reason and related record."} action={items.length ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Return to Action required</Button> : undefined} />
        ) : <>
          <div className="ry-register-notification-list" role="list" aria-label={`${(filters.view ?? "action_required").replaceAll("_", " ")} Notifications`}>
            {visibleItems.map((item) => <article className={`ry-register-notification${item.status === "unread" ? " ry-register-notification-unread" : ""}`} role="listitem" key={item.id}>
              <button type="button" className="ry-register-notification-content" onClick={() => setSelected(item)} aria-label={`Review Notification ${item.title}`}>
                <span><StatusLabel value={item.severity} />{item.blocking ? <StatusLabel value="blocking" /> : null}</span>
                <strong>{item.title}</strong>
                <span>{item.reason}</span>
                <time dateTime={item.lastOccurredAt}>{new Date(item.lastOccurredAt).toLocaleString()}</time>
              </button>
              <div className="ry-register-notification-actions">
                <Link to={relatedPath(item)}>Open record</Link>
                {item.status === "unread" ? <Button variant="tertiary" size="compact" loading={updatingId === item.id} disabled={!canWrite} onClick={() => void markRead(item)}>Mark {item.title} read</Button> : <StatusLabel value={item.status} />}
              </div>
            </article>)}
          </div>
          <RegisterMobileList label={`${(filters.view ?? "action_required").replaceAll("_", " ")} Notifications`}>{visibleItems.map((item) => <RegisterMobileRow key={item.id} title={item.title} meta={`${item.reason} · ${new Date(item.lastOccurredAt).toLocaleString()}`} status={<><StatusLabel value={item.severity} />{item.blocking ? <StatusLabel value="blocking" /> : null}</>} actions={item.status === "unread" ? <Button variant="tertiary" loading={updatingId === item.id} disabled={!canWrite} onClick={() => void markRead(item)}>Mark read</Button> : <StatusLabel value={item.status} />} onOpen={() => setSelected(item)} openLabel={`Review Notification ${item.title}`} />)}</RegisterMobileList>
          <RegisterPagination page={currentPage} pageCount={pageCount} total={filtered.length} onPage={setPage} />
        </>}
      </section>

      <Drawer open={Boolean(selected)} title={selected?.title ?? "Notification details"} description="Trigger, current relevance, timing, and related-record context." onClose={() => setSelected(null)}>
        {selected ? <div className="ry-register-preview">
          <div><StatusLabel value={selected.severity} /> <StatusLabel value={selected.status} />{selected.blocking ? <StatusLabel value="blocking" /> : null}</div>
          <section className="ry-register-preview-section"><h3>Why this changed</h3><p>{selected.reason}</p></section>
          <dl>
            <div><dt>Notification type</dt><dd>{selected.notificationType.replaceAll("_", " ")}</dd></div>
            <div><dt>First occurred</dt><dd><time dateTime={selected.firstOccurredAt}>{new Date(selected.firstOccurredAt).toLocaleString()}</time></dd></div>
            <div><dt>Last occurred</dt><dd><time dateTime={selected.lastOccurredAt}>{new Date(selected.lastOccurredAt).toLocaleString()}</time></dd></div>
            <div><dt>Occurrences</dt><dd>{selected.occurrenceCount}</dd></div>
            <div><dt>Due</dt><dd>{selected.dueAt ? new Date(selected.dueAt).toLocaleString() : "No due time recorded"}</dd></div>
            <div><dt>Current relevance</dt><dd>{selected.status === "read" ? "Read; confirm the related record for current truth" : "Unread and still presented for attention"}</dd></div>
          </dl>
          <Link className="secondary-button" to={relatedPath(selected)}>Open related record</Link>
          {selected.status === "unread" ? <Button loading={updatingId === selected.id} disabled={!canWrite} onClick={() => void markRead(selected)}>Mark notification read</Button> : null}
        </div> : null}
      </Drawer>
    </div>
  );
}
