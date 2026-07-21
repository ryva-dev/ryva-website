import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  Input,
  LoadingState,
  PageHeader,
  SearchInput,
  Select,
  StatusLabel,
  Table
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

type Source = {
  id: string;
  sourceType: string;
  reference: string;
  url: string | null;
  ownerOrProvider: string;
  rightsClassification: string;
  confidentiality: string;
  capturedAt: string;
  status: string;
};

const initialFilters: RegisterFilterValue = { query: "", sourceType: "", rights: "", status: "" };
const columnOptions = [
  { id: "reference", label: "Reference", required: true },
  { id: "sourceType", label: "Source type" },
  { id: "owner", label: "Owner or provider" },
  { id: "rights", label: "Usage rights" },
  { id: "capturedAt", label: "Captured" },
  { id: "status", label: "Status" }
];

export function SourcesPage() {
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [sources, setSources] = useState<Source[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "capturedAt", direction: "desc" });
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [selected, setSelected] = useState<Source | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [owner, setOwner] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setSources((await api<{ sources: Source[] }>("/api/sources")).sources);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sources could not be loaded.");
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
      await api("/api/sources", {
        method: "POST",
        body: {
          sourceType: "user_supplied",
          reference,
          url: url || null,
          ownerOrProvider: owner,
          rightsClassification: "unknown",
          confidentiality: "normal"
        }
      });
      setReference("");
      setOwner("");
      setUrl("");
      setCreateOpen(false);
      await load();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Source could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const query = (filters.query ?? "").toLowerCase();
    return sortRecords(sources.filter((source) => (
      (!query || `${source.reference} ${source.ownerOrProvider} ${source.sourceType}`.toLowerCase().includes(query)) &&
      (!filters.sourceType || source.sourceType === filters.sourceType) &&
      (!filters.rights || source.rightsClassification === filters.rights) &&
      (!filters.status || source.status === filters.status)
    )), sort, (source, field) => {
      if (field === "owner") return source.ownerOrProvider;
      if (field === "rights") return source.rightsClassification;
      return String(source[field as keyof Source] ?? "");
    });
  }, [filters, sort, sources]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleItems = filtered.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);
  const activeFilters = Object.entries(filters).filter(([, value]) => value).map(([id, value]) => ({ id, label: `${id === "query" ? "Search" : id === "sourceType" ? "Type" : id === "rights" ? "Rights" : "Status"}: ${value}` }));

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
    setPage(1);
  }

  return (
    <div className="page ry-register-page">
      <PageHeader
        eyebrow="Evidence provenance"
        title="Sources"
        description="Control where evidence came from, who owns it, and how it may be used before Ryva draws a conclusion."
        action={<Button disabled={!canWrite} onClick={() => setCreateOpen(true)}>Register source</Button>}
      />
      <Alert className="ry-register-policy" title="Provenance before conclusion">
        A Source records origin and usage rights. Registering one does not verify the claim it may support.
      </Alert>
      {!canWrite ? <Alert tone="warning" className="ry-register-policy" title="Read-only access">You may inspect permitted provenance, but cannot register or change Sources in this session.</Alert> : null}
      <section className="ry-register-surface" aria-label="Evidence Source register">
        <div className="ry-register-commandbar">
          <RegisterSavedViews recordType="source" filters={filters} sort={sort} canWrite={Boolean(canWrite)} onApply={(nextFilters, nextSort) => { setFilters({ ...initialFilters, ...nextFilters }); setSort(nextSort); setPage(1); }} />
          <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
            <FilterBar>
              <Field label="Search Sources"><SearchInput label="Search Sources" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} /></Field>
              <Field label="Source type"><Select controlSize="compact" value={filters.sourceType} onChange={(event) => updateFilter("sourceType", event.target.value)}><option value="">All types</option>{[...new Set(sources.map((source) => source.sourceType))].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field>
              <Field label="Usage rights"><Select controlSize="compact" value={filters.rights} onChange={(event) => updateFilter("rights", event.target.value)}><option value="">All rights</option>{[...new Set(sources.map((source) => source.rightsClassification))].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field>
              <Field label="Status"><Select controlSize="compact" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option>{[...new Set(sources.map((source) => source.status))].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field>
            </FilterBar>
          </RegisterFilterSheet>
        </div>
        <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => { setFilters(initialFilters); setPage(1); }} />
        <div className="ry-register-resultbar">
          <span>{filtered.length} of {sources.length} Sources</span>
          <RegisterColumnSelector columns={columnOptions} visible={visibleColumns} onChange={(id, shown) => setVisibleColumns((current) => { const next = new Set(current); if (shown) next.add(id); else next.delete(id); return next; })} density={density} onDensityChange={setDensity} />
        </div>
        {loading ? <LoadingState label="Loading evidence Sources" /> : error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : filtered.length === 0 ? (
          <EmptyState title={activeFilters.length ? "No Sources match these filters" : "No evidence Sources yet"} description={activeFilters.length ? "Clear one or more filters to return to the complete provenance register." : "Register the first real source before attaching evidence to a claim."} action={activeFilters.length ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button> : canWrite ? <Button onClick={() => setCreateOpen(true)}>Register source</Button> : undefined} />
        ) : (
          <>
            <Table caption="Evidence Sources" compact={density === "compact"}>
              <thead><tr>
                {visibleColumns.has("reference") ? <SortableHeader field="reference" label="Reference" sort={sort} onSort={setSort} /> : null}
                {visibleColumns.has("sourceType") ? <SortableHeader field="sourceType" label="Type" sort={sort} onSort={setSort} /> : null}
                {visibleColumns.has("owner") ? <SortableHeader field="owner" label="Owner or provider" sort={sort} onSort={setSort} /> : null}
                {visibleColumns.has("rights") ? <SortableHeader field="rights" label="Usage rights" sort={sort} onSort={setSort} /> : null}
                {visibleColumns.has("capturedAt") ? <SortableHeader field="capturedAt" label="Captured" sort={sort} onSort={setSort} /> : null}
                {visibleColumns.has("status") ? <SortableHeader field="status" label="Status" sort={sort} onSort={setSort} /> : null}
              </tr></thead>
              <tbody>{visibleItems.map((source) => <DataRow key={source.id} selected={selected?.id === source.id}>
                {visibleColumns.has("reference") ? <td><button type="button" className="ry-register-table-button" onClick={() => setSelected(source)}>{source.reference}</button>{source.url ? <small className="ry-register-cell-meta">Linked reference</small> : null}</td> : null}
                {visibleColumns.has("sourceType") ? <td>{source.sourceType.replaceAll("_", " ")}</td> : null}
                {visibleColumns.has("owner") ? <td>{source.ownerOrProvider}</td> : null}
                {visibleColumns.has("rights") ? <td><StatusLabel value={source.rightsClassification} /></td> : null}
                {visibleColumns.has("capturedAt") ? <td><time dateTime={source.capturedAt}>{new Date(source.capturedAt).toLocaleDateString()}</time></td> : null}
                {visibleColumns.has("status") ? <td><StatusLabel value={source.status} /></td> : null}
              </DataRow>)}</tbody>
            </Table>
            <RegisterMobileList label="Evidence Sources">{visibleItems.map((source) => <RegisterMobileRow key={source.id} title={source.reference} meta={`${source.sourceType.replaceAll("_", " ")} · ${source.ownerOrProvider} · ${source.rightsClassification.replaceAll("_", " ")}`} status={<StatusLabel value={source.status} />} onOpen={() => setSelected(source)} openLabel={`Review Source ${source.reference}`} />)}</RegisterMobileList>
            <RegisterPagination page={Math.min(page, pageCount)} pageCount={pageCount} total={filtered.length} onPage={setPage} />
          </>
        )}
      </section>

      <Drawer open={createOpen} title="Register evidence Source" description="Record provenance and ownership before this Source is used in evidence." onClose={() => setCreateOpen(false)}>
        <form onSubmit={(event) => void create(event)}>
          <Alert title="Initial rights state">New Sources remain classified as Unknown until their usage rights are reviewed.</Alert>
          {formError ? <ErrorState message={formError} /> : null}
          <Field label="Reference" required><Input required value={reference} onChange={(event) => setReference(event.target.value)} /></Field>
          <Field label="Owner or provider" required><Input required value={owner} onChange={(event) => setOwner(event.target.value)} /></Field>
          <Field label="URL" hint="Optional direct reference. Only enter a URL you are permitted to retain."><Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} /></Field>
          <Button type="submit" loading={saving}>Register source</Button>
        </form>
      </Drawer>

      <Drawer open={Boolean(selected)} title={selected?.reference ?? "Source details"} description="Current provenance, rights, and freshness context." onClose={() => setSelected(null)}>
        {selected ? <div className="ry-register-preview">
          <div><StatusLabel value={selected.status} /> <StatusLabel value={selected.rightsClassification} /></div>
          <dl>
            <div><dt>Source type</dt><dd>{selected.sourceType.replaceAll("_", " ")}</dd></div>
            <div><dt>Owner or provider</dt><dd>{selected.ownerOrProvider}</dd></div>
            <div><dt>Usage rights</dt><dd>{selected.rightsClassification.replaceAll("_", " ")}</dd></div>
            <div><dt>Confidentiality</dt><dd>{selected.confidentiality}</dd></div>
            <div><dt>Captured</dt><dd><time dateTime={selected.capturedAt}>{new Date(selected.capturedAt).toLocaleString()}</time></dd></div>
          </dl>
          {selected.url ? <a href={selected.url} target="_blank" rel="noreferrer">Open original reference</a> : <Alert tone="warning" title="No linked URL">This Source has no direct reference URL. Its provenance must be evaluated from the stored description and owner.</Alert>}
        </div> : null}
      </Drawer>
    </div>
  );
}
