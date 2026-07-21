import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  AuthorityIndicator,
  Button,
  DataRow,
  EmptyState,
  ErrorState,
  EvidenceLabel,
  Field,
  FilterBar,
  Input,
  LoadingState,
  PageHeader,
  RiskIndicator,
  SearchInput,
  Select,
  StatusLabel,
  Table
} from "../../design-system";
import { ContextRail } from "../relationship/RelationshipDetail";
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
} from "../register/Register";
import {
  brandIdentity,
  brandName,
  brandStage,
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
  { id: "identity", label: "Identity" },
  { id: "stage", label: "Pipeline stage" },
  { id: "wholesale", label: "Wholesale status" },
  { id: "products", label: "Products" },
  { id: "risk", label: "Risk" },
  { id: "representation", label: "Representation" },
  { id: "nextAction", label: "Next action" },
  { id: "reviewed", label: "Last reviewed" }
];

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
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState("");
  const pageSize = 50;

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
        if (field === "stage") return brandStage(row);
        if (field === "wholesale") return shown(row.wholesaleStatus);
        if (field === "products") return String(Number(row.productCount ?? 0));
        if (field === "risk") return String(Number(row.riskCount ?? 0));
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

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setCreateError("");
    try {
      const result = await api<{ record: BrandRow }>("/api/records/brand", {
        method: "POST",
        body: { name }
      });
      setName("");
      void navigate(compatibility.detailPath(result.record.id));
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Brand could not be created.");
    }
  }

  const contextRail = selected ? (
    <>
      <div className="ry-context-item">
        <strong>Identity confidence</strong>
        <StatusLabel value={brandIdentity(selected)} />
        <small>Identity review does not create representation authority.</small>
      </div>
      <div className="ry-context-item">
        <strong>Evidence freshness</strong>
        <EvidenceLabel value="direct_evidence" freshness={selected.lastReviewedAt ? `Last reviewed ${date(selected.lastReviewedAt)}` : "Not reviewed"} />
        <small>{shown(selected.productCount, "0")} linked Product{Number(selected.productCount ?? 0) === 1 ? "" : "s"}.</small>
      </div>
      <div className="ry-context-item">
        <strong>Open risk</strong>
        <RiskIndicator value={Number(selected.riskCount ?? 0) > 0 ? "high" : "low"} rationale={`${shown(selected.riskCount, "0")} open risk flag${Number(selected.riskCount ?? 0) === 1 ? "" : "s"}.`} />
      </div>
      <div className="ry-context-item">
        <strong>Representation status</strong>
        <AuthorityIndicator value={shown(selected.representationStatus, "not_established")} rationale="Pipeline stage and representation readiness are not active Agreement authority." />
      </div>
      <div className="ry-context-item">
        <strong>Next human-owned action</strong>
        <p>{shown(selected.nextAction, "No next action assigned.")}</p>
        {selected.nextActionDueAt ? <small>Due {date(selected.nextActionDueAt)}</small> : null}
      </div>
    </>
  ) : (
    <p>Select a Brand to inspect identity confidence, evidence freshness, risk, representation status, and next action without leaving the register.</p>
  );

  return (
    <div className="page ry-register-page ry-brand-page">
      <PageHeader
        eyebrow="Phase 3 · Human decision required"
        title="Brand Intelligence"
        description="A diligence pipeline that does not imply outreach permission or representation authority."
        action={canWrite ? undefined : <Button disabled>Read-only access</Button>}
      />
      {compatibility.showCompatibilityNotice ? (
        <Alert className="ry-register-policy" title="Generic Brand register compatibility">
          This route reuses the canonical Brand Intelligence workspace. Links and APIs remain unchanged.
        </Alert>
      ) : null}
      <Alert className="ry-register-policy" title="Evidence before qualification">
        Missing evidence remains explicit Unknown. Brand qualification does not create representation authority.
      </Alert>
      {!canWrite ? (
        <Alert tone="warning" className="ry-register-policy" title="Read-only Brand Intelligence">
          You may inspect permitted Brand research, but cannot create records, add evidence, or apply qualification decisions in this session.
        </Alert>
      ) : null}

      <div className="ry-brand-workspace">
        <section className="ry-register-surface ry-brand-results" aria-label="Brand Intelligence results">
          <div className="ry-register-commandbar">
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
                <Field label="Search Brands">
                  <SearchInput label="Search Brands" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} />
                </Field>
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
              description={activeFilters.length ? "Clear one or more filters to return to the working Brand register." : "Create an unqualified Brand to begin identity and evidence diligence. Qualification remains human-owned."}
              action={activeFilters.length ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button> : undefined}
            />
          ) : (
            <>
              <Table caption="Brand Intelligence register" compact={density === "compact"}>
                <thead>
                  <tr>
                    {visibleColumns.has("name") ? <SortableHeader field="name" label="Brand" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("identity") ? <SortableHeader field="identity" label="Identity" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("stage") ? <SortableHeader field="stage" label="Pipeline stage" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("wholesale") ? <SortableHeader field="wholesale" label="Wholesale status" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("products") ? <SortableHeader field="products" label="Products" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("risk") ? <SortableHeader field="risk" label="Risk" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("representation") ? <SortableHeader field="representation" label="Representation" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("nextAction") ? <SortableHeader field="nextAction" label="Next action" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("reviewed") ? <SortableHeader field="reviewed" label="Reviewed" sort={sort} onSort={setSort} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <DataRow key={row.id} selected={selectedId === row.id}>
                      {visibleColumns.has("name") ? (
                        <td>
                          <button type="button" className="ry-register-table-button" onClick={() => setSelectedId(row.id)}>
                            <strong>{brandName(row)}</strong>
                          </button>
                          <small className="ry-register-cell-meta">{shown(row.legalName, "Legal name not recorded")}</small>
                        </td>
                      ) : null}
                      {visibleColumns.has("identity") ? <td><StatusLabel value={brandIdentity(row)} /></td> : null}
                      {visibleColumns.has("stage") ? <td><StatusLabel value={brandStage(row)} /></td> : null}
                      {visibleColumns.has("wholesale") ? <td><StatusLabel value={shown(row.wholesaleStatus, "unknown")} /></td> : null}
                      {visibleColumns.has("products") ? <td>{shown(row.productCount, "0")}</td> : null}
                      {visibleColumns.has("risk") ? <td>{shown(row.riskCount, "0")}</td> : null}
                      {visibleColumns.has("representation") ? <td><StatusLabel value={shown(row.representationStatus, "not_established")} /></td> : null}
                      {visibleColumns.has("nextAction") ? <td>{shown(row.nextAction, "Not assigned")}</td> : null}
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
                    meta={`${readable(brandStage(row))} · ${readable(brandIdentity(row))} · ${shown(row.productCount, "0")} products · ${shown(row.riskCount, "0")} risks`}
                    status={<StatusLabel value={brandStage(row)} />}
                    onOpen={() => void navigate(compatibility.detailPath(row.id))}
                    openLabel={`Open Brand ${brandName(row)}`}
                  />
                ))}
              </RegisterMobileList>
              <RegisterPagination page={Math.min(page, pageCount)} pageCount={pageCount} total={total} onPage={setPage} />
            </>
          )}
        </section>

        <section className="ry-brand-summary" aria-label="Selected Brand summary">
          {selected ? (
            <>
              <div className="ry-brand-identity-summary">
                <h2><Link to={compatibility.detailPath(selected.id)}>{brandName(selected)}</Link></h2>
                <p className="ry-brand-identity-meta">{shown(selected.legalName, "Legal name not recorded")} · {readable(brandStage(selected))}</p>
                <dl className="ry-register-preview">
                  <div><dt>Identity</dt><dd><StatusLabel value={brandIdentity(selected)} /></dd></div>
                  <div><dt>Pipeline stage</dt><dd><StatusLabel value={brandStage(selected)} /></dd></div>
                  <div><dt>Wholesale status</dt><dd><StatusLabel value={shown(selected.wholesaleStatus, "unknown")} /></dd></div>
                  <div><dt>Products</dt><dd>{shown(selected.productCount, "0")}</dd></div>
                  <div><dt>Representation</dt><dd><StatusLabel value={shown(selected.representationStatus, "not_established")} /></dd></div>
                  <div><dt>Next action</dt><dd>{shown(selected.nextAction, "Not assigned")}</dd></div>
                  <div><dt>Last reviewed</dt><dd>{date(selected.lastReviewedAt)}</dd></div>
                </dl>
              </div>
              <div className="ry-brand-summary-actions">
                <Link className="ry-button ry-button-secondary" to={compatibility.detailPath(selected.id)}>Open full detail</Link>
              </div>
            </>
          ) : (
            <EmptyState compact title="No Brand selected" description="Select a Brand from the results to review identity, Products, representation readiness, and next action." />
          )}
        </section>

        <div className="ry-brand-context-rail-desktop">
          <ContextRail title="Brand context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>
            {contextRail}
          </ContextRail>
        </div>
      </div>

      <section className="ry-brand-create panel" aria-label="Create unqualified Brand">
        <h2>Create a research record</h2>
        <p>New records begin unqualified. No imported or manually entered label creates authority.</p>
        {createError ? <ErrorState message={createError} /> : null}
        <form className="ry-brand-create-form" onSubmit={(event) => void create(event)}>
          <Field label="Name"><Input required value={name} onChange={(event) => setName(event.target.value)} disabled={!canWrite} /></Field>
          <Button type="submit" disabled={!canWrite}>Create unqualified record</Button>
        </form>
      </section>
    </div>
  );
}
