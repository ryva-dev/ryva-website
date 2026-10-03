import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  Dialog,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Input,
  LoadingState,
  PageHeader,
  SearchInput,
  Select
} from "../../design-system";
import {
  ActiveFilters,
  RegisterCreateBlockHeader,
  RegisterCreateFooter,
  RegisterFilterSheet,
  RegisterPagination,
  RegisterSavedViews,
  type RegisterFilterValue,
  type RegisterSort
} from "../register/Register";
import { displayBrandName } from "../brand/utils";
import {
  canonicalProductPaths,
  catalogMeta,
  catalogReadiness,
  catalogRisk,
  catalogWholesaleSignals,
  displayName,
  previewLeadTime,
  previewMarginValue,
  previewMoq,
  previewPrimaryRisk,
  previewReadiness,
  previewRetail,
  previewWholesale,
  productInitials,
  productViewLabel,
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

const catalogTones = ["ink", "oxblood", "olive", "powder", "sand"] as const;

function catalogTone(row: ProductRow): (typeof catalogTones)[number] {
  const seed = `${row.id}:${shown(row.category)}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash + seed.charCodeAt(index) * (index + 1)) % 997;
  return catalogTones[hash % catalogTones.length] ?? "ink";
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [brands, setBrands] = useState<ProductRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [preview, setPreview] = useState<ProductRow | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Product Intelligence records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

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
        if (field === "brand") return displayBrandName(row.brandName);
        if (field === "readiness") return shown(row.wholesaleReadiness);
        if (field === "evidence") return String(Number(row.unknownCount ?? 0));
        if (field === "risk") return String(Number(row.criticalRiskCount ?? 0));
        if (field === "price") return shown(row.consumerPrice);
        if (field === "reviewed") return shown(row.lastReviewedAt);
        return shown(row[field]);
      };
      const leftValue = read(left, sort.field);
      const rightValue = read(right, sort.field);
      return leftValue.localeCompare(rightValue, undefined, { numeric: true }) * direction;
    });
  }, [rows, sort]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const activeFilters = Object.entries(filters)
    .filter(([id, value]) => {
      if (!value) return false;
      if (id === "view") return value !== "discover";
      return true;
    })
    .map(([id, value]) => ({
      id,
      label: `${
        id === "query"
          ? "Search"
          : id === "confidence"
            ? "Data confidence"
            : id === "view"
              ? "Product status"
              : readable(id)
      }: ${id === "view" ? productViewLabel(String(value)) : readable(String(value))}`
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

  function addToCompare(productId: string) {
    setPreview(null);
    setCompareIds((current) => {
      if (current.includes(productId)) return current;
      if (current.length >= 4) return current;
      return [...current, productId];
    });
  }

  function toggleCompare(productId: string) {
    setCompareIds((current) => {
      if (current.includes(productId)) return current.filter((id) => id !== productId);
      if (current.length >= 4) return current;
      return [...current, productId];
    });
  }

  function clearCompare() {
    setCompareIds([]);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || createSaving) return;
    setCreateSaving(true);
    setCreateError("");
    try {
      const result = await api<{ record: ProductRow }>("/api/records/product", {
        method: "POST",
        body: { name, brandId, category, summary: "" }
      });
      setName("");
      setBrandId("");
      setCategory("");
      setCreateOpen(false);
      void navigate(compatibility.detailPath(result.record.id));
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Product could not be created.");
    } finally {
      setCreateSaving(false);
    }
  }

  const headerAction = canWrite ? (
    <Button onClick={openCreate}>Create product</Button>
  ) : (
    <Button disabled>Read-only access</Button>
  );

  const previewName = preview ? displayName(preview.name) : "";
  const previewMeta = preview ? catalogMeta(preview) : "";
  const comparing = compareIds.length > 0;
  const previewInCompare = Boolean(preview && compareIds.includes(preview.id));
  const compareFull = comparing && !previewInCompare && compareIds.length >= 4;

  return (
    <div className="page ry-register-page ry-product-page">
      <PageHeader
        title="Product Intelligence"
        description="Evidence-led Product discovery, diligence, comparison, and explicit qualification. No numerical ranking is calculated."
        action={headerAction}
      />
      {compatibility.showCompatibilityNotice ? (
        <Alert className="ry-register-policy" title="Generic Product register compatibility">
          This route reuses the canonical Product Intelligence workspace. Links and APIs remain unchanged.
        </Alert>
      ) : null}
      {!canWrite ? (
        <Alert tone="warning" className="ry-register-policy" title="Read-only Product Intelligence">
          You may inspect permitted Product research, but cannot create records, add evidence, or apply qualification decisions in this session.
        </Alert>
      ) : null}
      {comparing ? (
        <Alert
          className="ry-product-compare-banner"
          title={compareIds.length === 1 ? "Select another product" : `${compareIds.length} products selected`}
          action={(
            <div className="ry-product-compare-actions">
              <Button variant="secondary" size="compact" onClick={clearCompare}>Cancel</Button>
              {compareIds.length >= 2 ? (
                <Link className="ry-button ry-button-primary ry-control-compact" to={`/products/compare?ids=${compareIds.join(",")}`}>
                  Compare
                </Link>
              ) : null}
            </div>
          )}
        >
          {compareIds.length === 1
            ? "Choose a second product from the catalog to compare. You can select up to four."
            : "Add up to four products, then continue to comparison."}
        </Alert>
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
            <RegisterFilterSheet
              open={filterOpen}
              onOpen={() => setFilterOpen(true)}
              onClose={() => setFilterOpen(false)}
              triggerLabel="More filters"
              showInline={false}
            >
              <FilterBar className="ry-product-filters ry-product-filters-secondary">
                <Field label="Product status">
                  <Select controlSize="compact" value={filters.view} onChange={(event) => updateFilter("view", event.target.value)}>
                    {productViews.map((item) => <option key={item} value={item}>{productViewLabel(item)}</option>)}
                  </Select>
                </Field>
                <Field label="Data confidence">
                  <Select controlSize="compact" value={filters.confidence} onChange={(event) => updateFilter("confidence", event.target.value)}>
                    <option value="">All</option>
                    <option value="insufficient">Insufficient</option>
                    <option value="limited">Limited</option>
                    <option value="supported">Supported</option>
                    <option value="strong">Strong</option>
                  </Select>
                </Field>
              </FilterBar>
            </RegisterFilterSheet>
            <div className="ry-register-filter-inline">
              <FilterBar className="ry-product-filters ry-product-filters-primary">
                <Field label="Search" className="ry-product-search-field">
                  <SearchInput label="Search products" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} />
                </Field>
                <Field label="Readiness">
                  <Select controlSize="compact" value={filters.readiness} onChange={(event) => updateFilter("readiness", event.target.value)}>
                    <option value="">All</option>
                    <option value="not_reviewed">Not reviewed</option>
                    <option value="not_ready">Not ready</option>
                    <option value="conditional">Conditional</option>
                    <option value="ready">Ready</option>
                    <option value="unknown">Unknown</option>
                  </Select>
                </Field>
                <Field label="Risk">
                  <Select controlSize="compact" value={filters.risk} onChange={(event) => updateFilter("risk", event.target.value)}>
                    <option value="">All</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </Select>
                </Field>
                <Field label="Sort" className="ry-product-sort-field">
                  <Select
                    controlSize="compact"
                    aria-label="Sort"
                    value={`${sort.field}:${sort.direction}`}
                    onChange={(event) => {
                      const [field, direction] = event.target.value.split(":");
                      setSort({ field: field || "updatedAt", direction: direction === "asc" ? "asc" : "desc" });
                    }}
                  >
                    <option value="updatedAt:desc">Recently updated</option>
                    <option value="name:asc">Name A–Z</option>
                    <option value="brand:asc">Brand A–Z</option>
                    <option value="price:asc">Price · low to high</option>
                    <option value="price:desc">Price · high to low</option>
                    <option value="reviewed:desc">Recently reviewed</option>
                  </Select>
                </Field>
              </FilterBar>
            </div>
          </div>
          <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => { setFilters(initialFilters); setPage(1); }} />
          <div className="ry-register-resultbar ry-product-catalog-bar">
            <span>{total} Product{total === 1 ? "" : "s"} in this view</span>
          </div>
          {loading ? <LoadingState label="Loading Product Intelligence" /> : error ? (
            <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
          ) : sortedRows.length === 0 ? (
            <EmptyState
              title={activeFilters.length ? "No Products match these filters" : "No Products in this view"}
              description={activeFilters.length ? "Clear one or more filters to return to the working Product register." : "Create an unqualified Product after selecting its Brand. Qualification remains after evidence review."}
              action={activeFilters.length ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button> : undefined}
            />
          ) : (
            <>
              <div className="ry-product-catalog" role="list" aria-label="Product catalog">
                {sortedRows.map((row) => {
                  const label = displayName(row.name);
                  const meta = catalogMeta(row);
                  const signals = catalogWholesaleSignals(row);
                  const readiness = catalogReadiness(row);
                  const readinessAttention = ["Needs review", "Not wholesale ready", "Conditional readiness"].includes(readiness);
                  const risk = catalogRisk(row);
                  const imageUrl = shown(row.imageUrl, "").trim();
                  const previewing = preview?.id === row.id;
                  const inCompare = compareIds.includes(row.id);
                  const compareFull = comparing && !inCompare && compareIds.length >= 4;
                  return (
                    <article
                      key={row.id}
                      className={`ry-product-tile${previewing ? " is-selected" : ""}${inCompare ? " is-comparing" : ""}`}
                      role="listitem"
                    >
                      <button
                        type="button"
                        className="ry-product-tile-select"
                        aria-label={comparing ? `${inCompare ? "Remove" : "Add"} ${label} ${inCompare ? "from" : "to"} comparison` : `Preview ${label}`}
                        aria-haspopup={comparing ? undefined : "dialog"}
                        aria-expanded={comparing ? inCompare : previewing}
                        aria-pressed={comparing ? inCompare : undefined}
                        disabled={compareFull}
                        onClick={() => {
                          if (comparing) {
                            toggleCompare(row.id);
                            return;
                          }
                          setPreview(row);
                        }}
                      >
                        <div
                          className={`ry-product-tile-media${imageUrl ? " has-image" : ` ry-tone-${catalogTone(row)}`}`}
                          aria-hidden="true"
                        >
                          {imageUrl ? (
                            <img className="ry-product-tile-image" src={imageUrl} alt="" />
                          ) : (
                            <span className="ry-product-tile-mark">{productInitials(label)}</span>
                          )}
                        </div>
                        <span className="ry-product-tile-body">
                          <strong>{label}</strong>
                          {meta ? <span className="ry-product-tile-meta">{meta}</span> : null}
                          <span className={`ry-product-tile-pricing${signals.includes("Pricing not recorded") ? " is-empty" : ""}`}>
                            {signals}
                          </span>
                          <span className={`ry-product-tile-readiness${readinessAttention ? " is-attention" : ""}`}>{readiness}</span>
                          {risk ? <span className="ry-product-tile-risk">{risk}</span> : null}
                        </span>
                      </button>
                      <Link className="ry-product-tile-open" to={compatibility.detailPath(row.id)}>
                        Open
                      </Link>
                    </article>
                  );
                })}
              </div>
              <RegisterPagination page={Math.min(page, pageCount)} pageCount={pageCount} total={total} pageSize={pageSize} onPage={setPage} />
            </>
          )}
        </section>
      </div>

      <Dialog
        open={Boolean(preview)}
        title={previewName || "Product"}
        {...(previewMeta ? { description: previewMeta } : {})}
        onClose={() => setPreview(null)}
        size="narrow"
        className="ry-product-preview-dialog"
        {...(preview ? { footer: (
          <>
            <Button
              variant="secondary"
              size="compact"
              disabled={previewInCompare || compareFull}
              onClick={() => addToCompare(preview.id)}
            >
              {previewInCompare ? "In comparison" : compareFull ? "Comparison full" : "Add to comparison"}
            </Button>
            <Link className="ry-button ry-button-primary ry-control-compact" to={compatibility.detailPath(preview.id)} onClick={() => setPreview(null)}>
              Open product
            </Link>
          </>
        ) } : {})}
      >
        {preview ? (
          <dl className="ry-register-preview ry-product-preview-facts">
            <div><dt>Wholesale</dt><dd>{previewWholesale(preview) || "Not recorded"}</dd></div>
            <div><dt>Retail</dt><dd>{previewRetail(preview) || "Not recorded"}</dd></div>
            <div><dt>Margin</dt><dd>{previewMarginValue(preview) || "Not available"}</dd></div>
            <div><dt>MOQ</dt><dd>{previewMoq(preview) || "Not recorded"}</dd></div>
            <div><dt>Lead time</dt><dd>{previewLeadTime(preview) || "Not recorded"}</dd></div>
            <div><dt>Readiness</dt><dd>{previewReadiness(preview)}</dd></div>
            <div><dt>Primary risk</dt><dd>{previewPrimaryRisk(preview) || "None flagged"}</dd></div>
          </dl>
        ) : null}
      </Dialog>

      <Drawer
        open={createOpen}
        title="Create product"
        description="Add the basics to begin product research. New products start in review."
        onClose={closeCreate}
        size="standard"
        className="ry-product-create-drawer"
      >
        <form className="ry-product-create-form ry-register-create-form" aria-label="Create unqualified Product" onSubmit={(event) => void create(event)}>
          {createError ? <ErrorState message={createError} /> : null}
          <section className="ry-register-create-block">
            <RegisterCreateBlockHeader
              title="Product record"
              description="Add the basics to begin product research. New products start in review."
            />
            <div className="ry-product-create-grid ry-register-create-grid">
              <Field label="Name" className="ry-product-create-span ry-register-create-grid-span">
                <Input
                  required
                  controlSize="compact"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={!canWrite || createSaving}
                />
              </Field>
              <Field label="Brand">
                <Select
                  required
                  controlSize="compact"
                  value={brandId}
                  onChange={(event) => setBrandId(event.target.value)}
                  disabled={!canWrite || createSaving}
                >
                  <option value="">Select…</option>
                  {brands.map((item) => (
                    <option key={item.id} value={item.id}>
                      {displayBrandName(item.name)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Category">
                <Input
                  required
                  controlSize="compact"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  disabled={!canWrite || createSaving}
                />
              </Field>
            </div>
          </section>
          <RegisterCreateFooter>
            <Button type="button" variant="tertiary" size="compact" disabled={createSaving} onClick={closeCreate}>
              Cancel
            </Button>
            <Button type="submit" size="compact" loading={createSaving} disabled={!canWrite}>
              {createSaving ? "Creating…" : "Create product"}
            </Button>
          </RegisterCreateFooter>
        </form>
      </Drawer>
    </div>
  );
}
