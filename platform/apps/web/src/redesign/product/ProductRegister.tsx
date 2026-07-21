import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  Checkbox,
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
import {
  ContextRail
} from "../relationship/RelationshipDetail";
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
  canonicalProductPaths,
  date,
  productViews,
  readable,
  shown,
  type ProductCompatibility,
  type ProductRow
} from "./utils";

const initialFilters: RegisterFilterValue = {
  query: "",
  view: "discover",
  risk: "",
  readiness: "",
  confidence: ""
};

const columnOptions = [
  { id: "name", label: "Product", required: true },
  { id: "brand", label: "Brand" },
  { id: "category", label: "Category" },
  { id: "status", label: "Qualification" },
  { id: "readiness", label: "Wholesale readiness" },
  { id: "evidence", label: "Evidence gaps" },
  { id: "risk", label: "Risk" },
  { id: "nextAction", label: "Next action" },
  { id: "reviewed", label: "Last reviewed" }
];

function confidenceLabel(level: unknown): string {
  const labels = ["Not assessed", "Insufficient evidence", "Limited evidence", "Supported evidence", "Strong evidence"];
  const index = Number(level);
  return Number.isFinite(index) && index >= 0 && index < labels.length ? (labels[index] ?? "Not assessed") : "Not assessed";
}

function compareEligible(row: ProductRow): boolean {
  const unknownCount = Number(row.unknownCount ?? 0);
  const status = shown(row.status, "discovered");
  return !["rejected", "archived"].includes(status) && unknownCount < 20;
}

export function ProductRegisterPage({
  compatibility = canonicalProductPaths
}: {
  compatibility?: ProductCompatibility;
}) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "updatedAt", direction: "desc" });
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [brands, setBrands] = useState<ProductRow[]>([]);
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState("");
  const [category, setCategory] = useState("");
  const [createError, setCreateError] = useState("");
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      view: filters.view || "discover",
      limit: String(pageSize),
      offset: String((page - 1) * pageSize)
    });
    if (filters.query) params.set("q", filters.query);
    if (filters.risk) params.set("risk", filters.risk);
    if (filters.readiness) params.set("readiness", filters.readiness);
    if (filters.confidence) params.set("confidence", filters.confidence);
    try {
      const payload = await api<{ products: ProductRow[]; total: number }>(`/api/intelligence/products?${params}`);
      setRows(payload.products);
      setTotal(payload.total);
      if (selectedId && !payload.products.some((row) => row.id === selectedId)) {
        setSelectedId(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Product Intelligence records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filters, page, selectedId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    void api<{ records: ProductRow[] }>("/api/records/brand")
      .then((result) => setBrands(result.records))
      .catch(() => setBrands([]));
  }, []);

  const sortedRows = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      const read = (row: ProductRow, field: string) => {
        if (field === "brand") return shown(row.brandName);
        if (field === "readiness") return shown(row.wholesaleReadiness);
        if (field === "evidence") return String(Number(row.unknownCount ?? 0));
        if (field === "risk") return String(Number(row.criticalRiskCount ?? 0));
        if (field === "nextAction") return shown(row.nextAction);
        if (field === "reviewed") return shown(row.lastReviewedAt);
        return shown(row[field]);
      };
      const leftValue = read(left, sort.field);
      const rightValue = read(right, sort.field);
      return leftValue.localeCompare(rightValue) * direction;
    });
  }, [rows, sort]);

  const selected = sortedRows.find((row) => row.id === selectedId) ?? null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const activeFilters = Object.entries(filters)
    .filter(([id, value]) => value && id !== "view")
    .map(([id, value]) => ({
      id,
      label: `${id === "query" ? "Search" : readable(id)}: ${readable(String(value))}`
    }));

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
    setPage(1);
  }

  function toggleCompare(id: string, checked: boolean) {
    setCompareIds((current) => {
      if (checked) {
        if (current.includes(id) || current.length >= 4) return current;
        return [...current, id];
      }
      return current.filter((item) => item !== id);
    });
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setCreateError("");
    try {
      const result = await api<{ record: ProductRow }>("/api/records/product", {
        method: "POST",
        body: { name, brandId, category, summary: "" }
      });
      setName("");
      setBrandId("");
      setCategory("");
      void navigate(compatibility.detailPath(result.record.id));
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Product could not be created.");
    }
  }

  const headerAction = compareIds.length >= 2
    ? <Link className="ry-button ry-button-primary" to={`/products/compare?ids=${compareIds.join(",")}`}>Compare {compareIds.length} products</Link>
    : canWrite
      ? undefined
      : <Button disabled>Read-only access</Button>;

  const contextRail = selected ? (
    <>
      <div className="ry-context-item">
        <strong>Evidence freshness</strong>
        <EvidenceLabel value={Number(selected.unknownCount ?? 0) > 0 ? "unknown" : "direct_evidence"} confidence={confidenceLabel(selected.confidenceLevel)} freshness={selected.lastReviewedAt ? `Last reviewed ${date(selected.lastReviewedAt)}` : "Not reviewed"} />
        <small>{shown(selected.unknownCount, "0")} explicit unknown field{Number(selected.unknownCount ?? 0) === 1 ? "" : "s"} recorded.</small>
      </div>
      <div className="ry-context-item">
        <strong>Open risk</strong>
        <RiskIndicator value={Number(selected.criticalRiskCount ?? 0) > 0 ? "high" : "low"} rationale={`${shown(selected.criticalRiskCount, "0")} high or critical risk flag${Number(selected.criticalRiskCount ?? 0) === 1 ? "" : "s"}.`} />
      </div>
      <div className="ry-context-item">
        <strong>Brand relation</strong>
        {selected.brandId ? <Link to={`/brands/${selected.brandId}`}>{shown(selected.brandName, "Brand reference unavailable")}</Link> : <span>Brand unavailable</span>}
        <small>Brand ownership does not establish Product qualification or outreach authority.</small>
      </div>
      <div className="ry-context-item">
        <strong>Next human-owned action</strong>
        <p>{shown(selected.nextAction, "No next action assigned.")}</p>
        {selected.nextActionDueAt ? <small>Due {date(selected.nextActionDueAt)}</small> : null}
      </div>
      <div className="ry-context-item">
        <strong>Comparison eligibility</strong>
        <StatusLabel value={compareEligible(selected) ? "eligible" : "blocked"} label={compareEligible(selected) ? "Eligible for comparison" : "Comparison prerequisites missing"} />
      </div>
    </>
  ) : (
    <p>Select a Product to inspect evidence freshness, risk, Brand relation, and next action without leaving the register.</p>
  );

  return (
    <div className="page ry-register-page ry-product-page">
      <PageHeader
        eyebrow="Phase 3 · Human decision required"
        title="Product Intelligence"
        description="Evidence-led Product discovery, diligence, comparison, and human-owned qualification. No numerical ranking is calculated."
        action={headerAction}
      />
      {compatibility.showCompatibilityNotice ? (
        <Alert className="ry-register-policy" title="Generic Product register compatibility">
          This route reuses the canonical Product Intelligence workspace. Links and APIs remain unchanged.
        </Alert>
      ) : null}
      <Alert className="ry-register-policy" title="Evidence before qualification">
        Missing evidence remains explicit Unknown. Sources record provenance; they do not establish truth by themselves.
      </Alert>
      {!canWrite ? (
        <Alert tone="warning" className="ry-register-policy" title="Read-only Product Intelligence">
          You may inspect permitted Product research, but cannot create records, add evidence, or apply qualification decisions in this session.
        </Alert>
      ) : null}
      {compareIds.length ? (
        <p className="ry-product-selection-count" role="status" aria-live="polite">
          {compareIds.length} product{compareIds.length === 1 ? "" : "s"} selected for comparison (2–4 required).
        </p>
      ) : null}

      <div className="ry-product-workspace">
        <section className="ry-register-surface ry-product-results" aria-label="Product Intelligence results">
          <div className="ry-register-commandbar">
            <RegisterSavedViews
              recordType="product"
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
                <Field label="Search Products">
                  <SearchInput label="Search Products" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} />
                </Field>
                <Field label="View">
                  <Select controlSize="compact" value={filters.view} onChange={(event) => updateFilter("view", event.target.value)}>
                    {productViews.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
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
                <Field label="Wholesale readiness">
                  <Select controlSize="compact" value={filters.readiness} onChange={(event) => updateFilter("readiness", event.target.value)}>
                    <option value="">All readiness states</option>
                    <option value="not_reviewed">Not reviewed</option>
                    <option value="not_ready">Not ready</option>
                    <option value="conditional">Conditional</option>
                    <option value="ready">Ready</option>
                    <option value="unknown">Unknown</option>
                  </Select>
                </Field>
                <Field label="Evidence confidence">
                  <Select controlSize="compact" value={filters.confidence} onChange={(event) => updateFilter("confidence", event.target.value)}>
                    <option value="">All confidence levels</option>
                    <option value="insufficient">Insufficient</option>
                    <option value="limited">Limited</option>
                    <option value="supported">Supported</option>
                    <option value="strong">Strong</option>
                  </Select>
                </Field>
              </FilterBar>
            </RegisterFilterSheet>
          </div>
          <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => { setFilters(initialFilters); setPage(1); }} />
          <div className="ry-register-resultbar">
            <span>{total} Product{total === 1 ? "" : "s"} in this view</span>
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
          {loading ? <LoadingState label="Loading Product Intelligence" /> : error ? (
            <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
          ) : sortedRows.length === 0 ? (
            <EmptyState
              title={activeFilters.length ? "No Products match these filters" : "No Products in this view"}
              description={activeFilters.length ? "Clear one or more filters to return to the working Product register." : "Create an unqualified Product after selecting its Brand. Qualification remains human-owned after evidence review."}
              action={activeFilters.length ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button> : undefined}
            />
          ) : (
            <>
              <Table caption="Product Intelligence register" compact={density === "compact"}>
                <thead>
                  <tr>
                    <th scope="col">Compare</th>
                    {visibleColumns.has("name") ? <SortableHeader field="name" label="Product" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("brand") ? <SortableHeader field="brand" label="Brand" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("category") ? <SortableHeader field="category" label="Category" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("status") ? <SortableHeader field="status" label="Qualification" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("readiness") ? <SortableHeader field="readiness" label="Wholesale readiness" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("evidence") ? <SortableHeader field="evidence" label="Unknowns" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("risk") ? <SortableHeader field="risk" label="Risk" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("nextAction") ? <SortableHeader field="nextAction" label="Next action" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("reviewed") ? <SortableHeader field="reviewed" label="Reviewed" sort={sort} onSort={setSort} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <DataRow key={row.id} selected={selectedId === row.id}>
                      <td>
                        <Checkbox
                          label={`Compare ${row.name}`}
                          checked={compareIds.includes(row.id)}
                          disabled={!compareIds.includes(row.id) && compareIds.length >= 4}
                          onChange={(event) => toggleCompare(row.id, event.target.checked)}
                        />
                      </td>
                      {visibleColumns.has("name") ? (
                        <td>
                          <button type="button" className="ry-register-table-button" onClick={() => setSelectedId(row.id)}>
                            <strong>{row.name}</strong>
                          </button>
                          <small className="ry-register-cell-meta">{confidenceLabel(row.confidenceLevel)}</small>
                        </td>
                      ) : null}
                      {visibleColumns.has("brand") ? <td>{shown(row.brandName)}</td> : null}
                      {visibleColumns.has("category") ? <td>{shown(row.category)}</td> : null}
                      {visibleColumns.has("status") ? <td><StatusLabel value={shown(row.status, "discovered")} /></td> : null}
                      {visibleColumns.has("readiness") ? <td><StatusLabel value={shown(row.wholesaleReadiness, "not_reviewed")} /></td> : null}
                      {visibleColumns.has("evidence") ? <td>{shown(row.unknownCount, "0")}</td> : null}
                      {visibleColumns.has("risk") ? <td>{shown(row.criticalRiskCount, "0")}</td> : null}
                      {visibleColumns.has("nextAction") ? <td>{shown(row.nextAction, "Not assigned")}</td> : null}
                      {visibleColumns.has("reviewed") ? <td>{date(row.lastReviewedAt)}</td> : null}
                    </DataRow>
                  ))}
                </tbody>
              </Table>
              <RegisterMobileList label="Product Intelligence results">
                {sortedRows.map((row) => (
                  <RegisterMobileRow
                    key={row.id}
                    title={row.name}
                    meta={`${shown(row.brandName)} · ${shown(row.category)} · ${readable(shown(row.status, "discovered"))} · ${shown(row.unknownCount, "0")} unknowns`}
                    status={<StatusLabel value={shown(row.status, "discovered")} />}
                    onOpen={() => void navigate(compatibility.detailPath(row.id))}
                    openLabel={`Open Product ${row.name}`}
                    actions={(
                      <Checkbox
                        label={`Compare ${row.name}`}
                        checked={compareIds.includes(row.id)}
                        disabled={!compareIds.includes(row.id) && compareIds.length >= 4}
                        onChange={(event) => toggleCompare(row.id, event.target.checked)}
                      />
                    )}
                  />
                ))}
              </RegisterMobileList>
              <RegisterPagination page={Math.min(page, pageCount)} pageCount={pageCount} total={total} onPage={setPage} />
            </>
          )}
        </section>

        <section className="ry-product-summary" aria-label="Selected Product summary">
          {selected ? (
            <>
              <IdentitySummary product={selected} detailPath={compatibility.detailPath(selected.id)} />
              <div className="ry-product-summary-actions">
                <Link className="ry-button ry-button-secondary" to={compatibility.detailPath(selected.id)}>Open full detail</Link>
                {compareEligible(selected) ? (
                  <Button variant="tertiary" disabled={compareIds.includes(selected.id)} onClick={() => toggleCompare(selected.id, true)}>
                    {compareIds.includes(selected.id) ? "Selected for comparison" : "Add to comparison"}
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <EmptyState compact title="No Product selected" description="Select a Product from the results to review identity, readiness, evidence gaps, and next action." />
          )}
        </section>

        <div className="ry-product-context-rail-desktop">
          <ContextRail title="Product context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>
            {contextRail}
          </ContextRail>
        </div>
      </div>

      <section className="ry-product-create panel" aria-label="Create unqualified Product">
        <h2>Create a research record</h2>
        <p>New records begin unqualified. No imported or manually entered label creates authority.</p>
        {createError ? <ErrorState message={createError} /> : null}
        <form className="ry-product-create-form" onSubmit={(event) => void create(event)}>
          <Field label="Name"><Input required value={name} onChange={(event) => setName(event.target.value)} disabled={!canWrite} /></Field>
          <Field label="Brand">
            <Select required value={brandId} onChange={(event) => setBrandId(event.target.value)} disabled={!canWrite}>
              <option value="">Select…</option>
              {brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Category"><Input required value={category} onChange={(event) => setCategory(event.target.value)} disabled={!canWrite} /></Field>
          <Button type="submit" disabled={!canWrite}>Create unqualified record</Button>
        </form>
      </section>
    </div>
  );
}

function IdentitySummary({ product, detailPath }: { product: ProductRow; detailPath: string }) {
  return (
    <div className="ry-product-identity-summary">
      <h2><Link to={detailPath}>{product.name}</Link></h2>
      <p className="ry-product-identity-meta">{shown(product.brandName)} · {shown(product.category)}</p>
      <dl className="ry-register-preview">
        <div><dt>Qualification</dt><dd><StatusLabel value={shown(product.status, "discovered")} /></dd></div>
        <div><dt>Wholesale readiness</dt><dd><StatusLabel value={shown(product.wholesaleReadiness, "not_reviewed")} /></dd></div>
        <div><dt>Packaging readiness</dt><dd><StatusLabel value={shown(product.packagingReadiness, "not_reviewed")} /></dd></div>
        <div><dt>Trend direction</dt><dd>{readable(shown(product.trendDirection, "unknown"))}</dd></div>
        <div><dt>Evidence confidence</dt><dd>{confidenceLabel(product.confidenceLevel)}</dd></div>
        <div><dt>Explicit unknowns</dt><dd>{shown(product.unknownCount, "0")}</dd></div>
        <div><dt>Next action</dt><dd>{shown(product.nextAction, "Not assigned")}</dd></div>
        <div><dt>Last reviewed</dt><dd>{date(product.lastReviewedAt)}</dd></div>
      </dl>
    </div>
  );
}
