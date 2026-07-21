import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Alert,
  AuthorityIndicator,
  Button,
  DataRow,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Input,
  LoadingState,
  PageHeader,
  SearchInput,
  Select,
  StatusLabel,
  Table,
  TextArea
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

type Territory = {
  id: string;
  name: string;
  territoryType: string;
  scope: Record<string, unknown>;
  status: string;
  effectiveAt: string | null;
  expiresAt: string | null;
};

const initialFilters: RegisterFilterValue = { query: "", territoryType: "", status: "" };
const columnOptions = [
  { id: "name", label: "Territory", required: true },
  { id: "territoryType", label: "Scope type" },
  { id: "scope", label: "Proposed scope" },
  { id: "authority", label: "Authority" },
  { id: "status", label: "Status" }
];

function scopeDescription(item: Territory): string {
  return typeof item.scope.description === "string" && item.scope.description.trim() ? item.scope.description : "No scope description recorded";
}

export function TerritoriesPage() {
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [items, setItems] = useState<Territory[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "name", direction: "asc" });
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [selected, setSelected] = useState<Territory | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("geography");
  const [scope, setScope] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems((await api<{ territories: Territory[] }>("/api/territories")).territories);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Territories could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setFormError("");
    try {
      await api("/api/territories", {
        method: "POST",
        body: { name, territoryType: type, scope: { description: scope }, status: "proposed" }
      });
      setName("");
      setScope("");
      setCreateOpen(false);
      await load();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Territory could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const query = (filters.query ?? "").toLowerCase();
    return sortRecords(items.filter((item) => (
      (!query || `${item.name} ${scopeDescription(item)}`.toLowerCase().includes(query)) &&
      (!filters.territoryType || item.territoryType === filters.territoryType) &&
      (!filters.status || item.status === filters.status)
    )), sort, (item, field) => {
      if (field === "scope") return scopeDescription(item);
      if (field === "name") return item.name;
      if (field === "territoryType") return item.territoryType;
      if (field === "status") return item.status;
      return "";
    });
  }, [filters, items, sort]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeFilters = Object.entries(filters).filter(([, value]) => value).map(([id, value]) => ({ id, label: `${id === "query" ? "Search" : id === "territoryType" ? "Type" : "Status"}: ${value}` }));

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
    setPage(1);
  }

  return (
    <div className="page ry-register-page">
      <PageHeader
        eyebrow="Commercial boundaries"
        title="Territories"
        description="Define proposed geography, channel, account-list, or hybrid scope without confusing a proposal with written authority."
        action={<Button disabled={!canWrite} onClick={() => setCreateOpen(true)}>Propose territory</Button>}
      />
      <Alert tone="warning" className="ry-register-policy" title="Proposal does not create authority">
        Only a reviewed and human-approved Agreement can authorize Product, channel, Buyer, or geographic scope.
      </Alert>
      {!canWrite ? <Alert tone="warning" className="ry-register-policy" title="Read-only access">You may inspect permitted scope proposals, but cannot create or change them in this session.</Alert> : null}
      <section className="ry-register-surface" aria-label="Territory register">
        <div className="ry-register-commandbar">
          <RegisterSavedViews recordType="territory" filters={filters} sort={sort} canWrite={Boolean(canWrite)} onApply={(nextFilters, nextSort) => { setFilters({ ...initialFilters, ...nextFilters }); setSort(nextSort); setPage(1); }} />
          <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
            <FilterBar>
              <Field label="Search Territories"><SearchInput label="Search Territories" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} /></Field>
              <Field label="Scope type"><Select controlSize="compact" value={filters.territoryType} onChange={(event) => updateFilter("territoryType", event.target.value)}><option value="">All types</option><option value="geography">Geography</option><option value="channel">Channel</option><option value="account_list">Account list</option><option value="hybrid">Hybrid</option></Select></Field>
              <Field label="Status"><Select controlSize="compact" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option>{[...new Set(items.map((item) => item.status))].map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
            </FilterBar>
          </RegisterFilterSheet>
        </div>
        <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => { setFilters(initialFilters); setPage(1); }} />
        <div className="ry-register-resultbar">
          <span>{filtered.length} of {items.length} Territories</span>
          <RegisterColumnSelector columns={columnOptions} visible={visibleColumns} onChange={(id, shown) => setVisibleColumns((current) => { const next = new Set(current); if (shown) next.add(id); else next.delete(id); return next; })} density={density} onDensityChange={setDensity} />
        </div>
        {loading ? <LoadingState label="Loading Territories" /> : error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : filtered.length === 0 ? (
          <EmptyState title={items.length ? "No Territories match these filters" : "No proposed Territories yet"} description={items.length ? "Clear one or more filters to return to the complete scope register." : "Create a proposed boundary for later Agreement review. It will not grant authority."} action={items.length ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button> : canWrite ? <Button onClick={() => setCreateOpen(true)}>Propose territory</Button> : undefined} />
        ) : <>
          <Table caption="Territories and proposed scope" compact={density === "compact"}>
            <thead><tr>
              {visibleColumns.has("name") ? <SortableHeader field="name" label="Territory" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("territoryType") ? <SortableHeader field="territoryType" label="Scope type" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("scope") ? <SortableHeader field="scope" label="Proposed scope" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("authority") ? <th scope="col">Authority</th> : null}
              {visibleColumns.has("status") ? <SortableHeader field="status" label="Status" sort={sort} onSort={setSort} /> : null}
            </tr></thead>
            <tbody>{visibleItems.map((item) => <DataRow key={item.id} selected={selected?.id === item.id}>
              {visibleColumns.has("name") ? <td><button type="button" className="ry-register-table-button" onClick={() => setSelected(item)}>{item.name}</button></td> : null}
              {visibleColumns.has("territoryType") ? <td>{item.territoryType.replaceAll("_", " ")}</td> : null}
              {visibleColumns.has("scope") ? <td>{scopeDescription(item)}</td> : null}
              {visibleColumns.has("authority") ? <td><AuthorityIndicator value="not_authorized" rationale="Agreement required" /></td> : null}
              {visibleColumns.has("status") ? <td><StatusLabel value={item.status} /></td> : null}
            </DataRow>)}</tbody>
          </Table>
          <RegisterMobileList label="Territories">{visibleItems.map((item) => <RegisterMobileRow key={item.id} title={item.name} meta={`${item.territoryType.replaceAll("_", " ")} · ${scopeDescription(item)}`} status={<><StatusLabel value={item.status} /><AuthorityIndicator value="not_authorized" /></>} onOpen={() => setSelected(item)} openLabel={`Review Territory ${item.name}`} />)}</RegisterMobileList>
          <RegisterPagination page={currentPage} pageCount={pageCount} total={filtered.length} onPage={setPage} />
        </>}
      </section>

      <Drawer open={createOpen} title="Propose territory" description="Describe the commercial boundary that an Agreement may later review and authorize." onClose={() => setCreateOpen(false)}>
        <form onSubmit={(event) => void create(event)}>
          <Alert tone="warning" title="No authority is created">Saving this proposal does not permit Buyer outreach or change Brand/Product representation state.</Alert>
          {formError ? <ErrorState message={formError} /> : null}
          <Field label="Name" required><Input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Scope type" required><Select value={type} onChange={(event) => setType(event.target.value)}><option value="geography">Geography</option><option value="channel">Channel</option><option value="account_list">Account list</option><option value="hybrid">Hybrid</option></Select></Field>
          <Field label="Scope description" required hint="State the proposed boundary precisely enough for later Agreement review."><TextArea required value={scope} onChange={(event) => setScope(event.target.value)} /></Field>
          <Button type="submit" loading={saving}>Save proposal</Button>
        </form>
      </Drawer>

      <Drawer open={Boolean(selected)} title={selected?.name ?? "Territory details"} description="Proposed commercial scope and its current authority distinction." onClose={() => setSelected(null)}>
        {selected ? <div className="ry-register-preview">
          <Alert tone="warning" title="Not written authority">This record is a scope proposal. Review the governing Agreement before any external action.</Alert>
          <div><StatusLabel value={selected.status} /> <AuthorityIndicator value="not_authorized" rationale="No Agreement authority inferred" /></div>
          <dl>
            <div><dt>Scope type</dt><dd>{selected.territoryType.replaceAll("_", " ")}</dd></div>
            <div><dt>Proposed scope</dt><dd>{scopeDescription(selected)}</dd></div>
            <div><dt>Effective relevance</dt><dd>{selected.effectiveAt ? new Date(selected.effectiveAt).toLocaleDateString() : "Not specified"}</dd></div>
            <div><dt>Expires</dt><dd>{selected.expiresAt ? new Date(selected.expiresAt).toLocaleDateString() : "Not specified"}</dd></div>
          </dl>
        </div> : null}
      </Drawer>
    </div>
  );
}
