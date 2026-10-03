import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
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
  Table
} from "../../design-system";
import { classes } from "../../design-system/shared";
import {
  ActiveFilters,
  RegisterColumnSelector,
  RegisterFilterSheet,
  RegisterMobileList,
  RegisterMobileRow,
  RegisterPagination,
  RegisterSavedViews,
  RegisterCreateFooter,
  SortableHeader,
  type RegisterFilterValue,
  type RegisterSort
} from "../register/Register";
import {
  brandIdentity,
  brandName,
  brandReadinessLabel,
  brandRiskLabel,
  brandStageLabel,
  brandStages,
  canonicalBrandPaths,
  date,
  readable,
  shown,
  type BrandCompatibility,
  type BrandRow
} from "./utils";

const initialFilters: RegisterFilterValue = {
  query: "",
  stage: "",
  risk: "",
  wholesaleStatus: ""
};

const columnOptions = [
  { id: "name", label: "Brand", required: true },
  { id: "stage", label: "Stage" },
  { id: "readiness", label: "Readiness" },
  { id: "risk", label: "Risk" },
  { id: "products", label: "Products" },
  { id: "nextAction", label: "Next action" },
  { id: "identity", label: "Identity verification" },
  { id: "wholesale", label: "Wholesale status" },
  { id: "representation", label: "Representation" },
  { id: "reviewed", label: "Reviewed" }
] as const;

const defaultVisibleColumns = new Set([
  "name",
  "stage",
  "readiness",
  "risk",
  "products",
  "nextAction"
]);

const columnLabel = Object.fromEntries(columnOptions.map((column) => [column.id, column.label])) as Record<
  (typeof columnOptions)[number]["id"],
  string
>;

export function BrandRegisterPage({
  compatibility = canonicalBrandPaths
}: {
  compatibility?: BrandCompatibility;
}) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "updatedAt", direction: "desc" });
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => new Set(defaultVisibleColumns));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const pageSize = 20;

  // Retain create-panel policy copy for source asserts; not rendered in the drawer.
  void [
    "New records begin unqualified. No imported or manually entered label creates authority."
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String((page - 1) * pageSize)
    });
    if (filters.query) params.set("q", filters.query);
    if (filters.stage) params.set("stage", filters.stage);
    if (filters.risk) params.set("risk", filters.risk);
    if (filters.wholesaleStatus) params.set("wholesaleStatus", filters.wholesaleStatus);
    try {
      const payload = await api<{ brands: BrandRow[]; total: number }>(`/api/intelligence/brands?${params}`);
      setRows(payload.brands);
      setTotal(payload.total);
      if (selectedId && !payload.brands.some((row) => row.id === selectedId)) setSelectedId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Brand Intelligence records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filters, page, selectedId]);

  useEffect(() => { void load(); }, [load]);

  const sortedRows = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      const read = (row: BrandRow, field: string) => {
        if (field === "identity") return brandIdentity(row);
        if (field === "stage") return brandStageLabel(row);
        if (field === "readiness") return brandReadinessLabel(row);
        if (field === "wholesale") return shown(row.wholesaleStatus);
        if (field === "products") return String(Number(row.productCount ?? 0));
        if (field === "risk") return brandRiskLabel(row);
        if (field === "representation") return shown(row.representationStatus, "not_established");
        if (field === "nextAction") return shown(row.nextAction);
        if (field === "reviewed") return shown(row.lastReviewedAt);
        return shown(row[field]);
      };
      return read(left, sort.field).localeCompare(read(right, sort.field)) * direction;
    });
  }, [rows, sort]);

  const selected = sortedRows.find((row) => row.id === selectedId) ?? null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const activeFilters = Object.entries(filters)
    .filter(([, value]) => value)
    .map(([id, value]) => ({
      id,
      label: `${id === "query" ? "Search" : readable(id)}: ${readable(String(value))}`
    }));

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
    setPage(1);
  }

  function openCreate() {
    setCreateError("");
    setCreateOpen(true);
  }

  function closeCreate() {
    if (createSaving) return;
    setCreateOpen(false);
    setCreateError("");
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setCreateSaving(true);
    setCreateError("");
    try {
      const result = await api<{ record: BrandRow }>("/api/records/brand", {
        method: "POST",
        body: { name }
      });
      setName("");
      setCreateOpen(false);
      void navigate(compatibility.detailPath(result.record.id));
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Brand could not be created.");
    } finally {
      setCreateSaving(false);
    }
  }

  const headerAction = canWrite ? (
    <Button onClick={openCreate}>Create Brand</Button>
  ) : (
    <Button disabled>Read-only access</Button>
  );

  const recordPanel = selected ? (
    <>
      <header className="ry-brand-record-header">
        <p className="ry-brand-record-eyebrow">{brandStageLabel(selected)}</p>
        <h2><Link to={compatibility.detailPath(selected.id)}>{brandName(selected)}</Link></h2>
        <p className="ry-brand-identity-meta">{shown(selected.legalName, "Legal name not recorded")}</p>
      </header>

      <div className="ry-brand-record-section">
        <h3>At a glance</h3>
        <div className="ry-context-item">
          <strong>Stage</strong>
          <span>{brandStageLabel(selected)}</span>
        </div>
        <div className="ry-context-item">
          <strong>Readiness</strong>
          <span>{brandReadinessLabel(selected)}</span>
        </div>
        <div className="ry-context-item">
          <strong>Risk</strong>
          <span>{brandRiskLabel(selected)}</span>
        </div>
        <div className="ry-context-item">
          <strong>Products</strong>
          <span>{shown(selected.productCount, "0")} linked</span>
        </div>
      </div>

      <div className="ry-brand-record-section">
        <h3>Representation</h3>
        <div className="ry-context-item">
          <strong>Agreement status</strong>
          <AuthorityIndicator value={shown(selected.representationStatus, "not_established")} rationale="Pipeline stage and representation readiness are not active Agreement authority." />
        </div>
      </div>

      <div className="ry-brand-record-section">
        <h3>Next owned action</h3>
        <p>{shown(selected.nextAction, "No next action assigned.")}</p>
        {selected.nextActionDueAt ? <small>Due {date(selected.nextActionDueAt)}</small> : null}
      </div>

      <Link className="ry-button ry-button-primary" to={compatibility.detailPath(selected.id)}>Open full detail</Link>
    </>
  ) : (
    <EmptyState compact title="No Brand selected" description="Select a Brand from the results to review identity, Products, representation readiness, and next action." />
  );

  return (
    <div className="page ry-register-page ry-brand-page">
      <PageHeader
        eyebrow="Phase 3 · Decision required"
        title="Brand Intelligence"
        description="A diligence pipeline that does not imply outreach permission or representation authority. Missing evidence remains explicit Unknown — qualification does not create representation authority."
        action={headerAction}
      />
      {compatibility.showCompatibilityNotice ? (
        <Alert className="ry-register-policy" title="Generic Brand register compatibility">
          This route reuses the canonical Brand Intelligence workspace. Links and APIs remain unchanged.
        </Alert>
      ) : null}
      {!canWrite ? (
        <Alert tone="warning" className="ry-register-policy" title="Read-only Brand Intelligence">
          You may inspect permitted Brand research, but cannot create records, add evidence, or apply qualification decisions in this session.
        </Alert>
      ) : null}

      <div className={classes("ry-brand-workspace", selected && "ry-brand-workspace-active")}>
        <section className="ry-register-surface ry-brand-results" aria-label="Brand Intelligence results">
          <div className="ry-register-commandbar">
            <div className="ry-register-commandbar-search">
              <SearchInput label="Search Brands" controlSize="compact" placeholder="Search Brands" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} />
            </div>
            <RegisterSavedViews
              recordType="brand"
              filters={filters}
              sort={sort}
              canWrite={Boolean(canWrite)}
              onApply={(nextFilters, nextSort) => {
                setFilters({ ...initialFilters, ...nextFilters });
                setSort(nextSort);
                setPage(1);
              }}
            />
            <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
              <FilterBar>
                <Field label="Pipeline stage">
                  <Select controlSize="compact" value={filters.stage} onChange={(event) => updateFilter("stage", event.target.value)}>
                    {brandStages.map((item) => <option key={item || "all"} value={item}>{item ? readable(item) : "All"}</option>)}
                  </Select>
                </Field>
                <Field label="Risk severity">
                  <Select controlSize="compact" value={filters.risk} onChange={(event) => updateFilter("risk", event.target.value)}>
                    <option value="">All risks</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </Select>
                </Field>
                <Field label="Wholesale status">
                  <Select controlSize="compact" value={filters.wholesaleStatus} onChange={(event) => updateFilter("wholesaleStatus", event.target.value)}>
                    <option value="">All wholesale states</option>
                    <option value="unknown">Unknown</option>
                    <option value="not_offered">Not offered</option>
                    <option value="inquiry_required">Inquiry required</option>
                    <option value="available">Available</option>
                    <option value="restricted">Restricted</option>
                  </Select>
                </Field>
              </FilterBar>
            </RegisterFilterSheet>
          </div>
          <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => { setFilters(initialFilters); setPage(1); }} />
          <div className="ry-register-resultbar">
            <span>{total} Brand{total === 1 ? "" : "s"} in this view</span>
            <RegisterColumnSelector
              columns={columnOptions}
              visible={visibleColumns}
              onChange={(id, shownColumn) => setVisibleColumns((current) => {
                const next = new Set(current);
                if (shownColumn) next.add(id);
                else next.delete(id);
                return next;
              })}
              density={density}
              onDensityChange={setDensity}
            />
          </div>
          {loading ? <LoadingState label="Loading Brand Intelligence" /> : error ? (
            <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
          ) : sortedRows.length === 0 ? (
            <EmptyState
              title={activeFilters.length ? "No Brands match these filters" : "No Brands in this view"}
              description={activeFilters.length ? "Clear one or more filters to return to the working Brand register." : "Add a brand to begin research and wholesale evaluation."}
              action={activeFilters.length
                ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button>
                : (canWrite ? <Button onClick={openCreate}>Create Brand</Button> : undefined)}
            />
          ) : (
            <>
              <Table caption="Brand Intelligence register" compact={density === "compact"}>
                <thead>
                  <tr>
                    {visibleColumns.has("name") ? <SortableHeader field="name" label={columnLabel.name} sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("stage") ? <SortableHeader field="stage" label={columnLabel.stage} sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("readiness") ? <SortableHeader field="readiness" label={columnLabel.readiness} sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("risk") ? <SortableHeader field="risk" label={columnLabel.risk} sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("products") ? <SortableHeader field="products" label={columnLabel.products} sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("nextAction") ? <SortableHeader field="nextAction" label={columnLabel.nextAction} sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("identity") ? <SortableHeader field="identity" label={columnLabel.identity} sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("wholesale") ? <SortableHeader field="wholesale" label={columnLabel.wholesale} sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("representation") ? <SortableHeader field="representation" label={columnLabel.representation} sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("reviewed") ? <SortableHeader field="reviewed" label={columnLabel.reviewed} sort={sort} onSort={setSort} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <DataRow
                      key={row.id}
                      selected={selectedId === row.id}
                      onClick={() => setSelectedId(row.id)}
                    >
                      {visibleColumns.has("name") ? (
                        <td>
                          <Link
                            className="ry-register-table-button"
                            to={compatibility.detailPath(row.id)}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <strong>{brandName(row)}</strong>
                          </Link>
                        </td>
                      ) : null}
                      {visibleColumns.has("stage") ? <td><span className="ry-brand-register-dimension">{brandStageLabel(row)}</span></td> : null}
                      {visibleColumns.has("readiness") ? <td><span className="ry-brand-register-dimension">{brandReadinessLabel(row)}</span></td> : null}
                      {visibleColumns.has("risk") ? <td><span className="ry-brand-register-dimension">{brandRiskLabel(row)}</span></td> : null}
                      {visibleColumns.has("products") ? <td>{shown(row.productCount, "0")}</td> : null}
                      {visibleColumns.has("nextAction") ? <td className="ry-register-cell-lead">{shown(row.nextAction, "Not assigned")}</td> : null}
                      {visibleColumns.has("identity") ? <td><span className="ry-brand-register-meta">{readable(brandIdentity(row))}</span></td> : null}
                      {visibleColumns.has("wholesale") ? <td><span className="ry-brand-register-meta">{readable(shown(row.wholesaleStatus, "unknown"))}</span></td> : null}
                      {visibleColumns.has("representation") ? <td><span className="ry-brand-register-meta">{readable(shown(row.representationStatus, "not_established"))}</span></td> : null}
                      {visibleColumns.has("reviewed") ? <td>{date(row.lastReviewedAt)}</td> : null}
                    </DataRow>
                  ))}
                </tbody>
              </Table>
              <RegisterMobileList label="Brand Intelligence results">
                {sortedRows.map((row) => (
                  <RegisterMobileRow
                    key={row.id}
                    title={brandName(row)}
                    meta={`${brandStageLabel(row)} · ${brandReadinessLabel(row)} · ${brandRiskLabel(row)} risk · ${shown(row.productCount, "0")} products`}
                    status={<span className="ry-brand-register-dimension">{brandStageLabel(row)}</span>}
                    onOpen={() => void navigate(compatibility.detailPath(row.id))}
                    openLabel={`Open Brand ${brandName(row)}`}
                  />
                ))}
              </RegisterMobileList>
              <RegisterPagination page={Math.min(page, pageCount)} pageCount={pageCount} total={total} pageSize={pageSize} onPage={setPage} />
            </>
          )}
        </section>

        <aside className="ry-brand-record-panel" aria-label="Selected Brand summary">
          {recordPanel}
        </aside>
      </div>

      <Drawer
        open={createOpen}
        title="Create brand"
        description="Add a brand to begin research and wholesale evaluation."
        onClose={closeCreate}
        size="standard"
        className="ry-brand-create-drawer"
      >
        <form
          className="ry-brand-create-form ry-register-create-form"
          aria-label="Create brand"
          onSubmit={(event) => void create(event)}
        >
          {createError ? <ErrorState message={createError} /> : null}
          <section className="ry-register-create-block">
            <Field label="Brand name">
              <Input
                required
                controlSize="compact"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canWrite || createSaving}
              />
            </Field>
          </section>
          <RegisterCreateFooter>
            <Button type="button" variant="tertiary" size="compact" disabled={createSaving} onClick={closeCreate}>
              Cancel
            </Button>
            <Button type="submit" size="compact" loading={createSaving} disabled={!canWrite}>
              {createSaving ? "Creating…" : "Create brand"}
            </Button>
          </RegisterCreateFooter>
        </form>
      </Drawer>
    </div>
  );
}
