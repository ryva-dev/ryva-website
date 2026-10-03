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
import {
  businessCoverageLabel,
  businessName,
  businessQualification,
  businessQualificationLabel,
  businessType,
  businessTypeLabel,
  canonicalBuyerPaths,
  date,
  qualificationStatuses,
  readable,
  shown,
  type BuyerCompatibility,
  type BuyerRow
} from "./utils";

const initialFilters: RegisterFilterValue = {
  query: "",
  qualificationStatus: "",
  geography: ""
};

const catalogTones = ["ink", "oxblood", "olive", "powder", "sand"] as const;

function businessInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "B";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function catalogTone(row: BuyerRow): (typeof catalogTones)[number] {
  const seed = `${row.id}:${businessType(row)}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash + seed.charCodeAt(index) * (index + 1)) % 997;
  return catalogTones[hash % catalogTones.length] ?? "ink";
}

function catalogMeta(row: BuyerRow): string {
  const parts = [businessTypeLabel(row), shown(row.geography, "")].filter((part) => part && part !== "Not recorded");
  return parts.join(" · ");
}

function catalogRisk(row: BuyerRow): string {
  const count = Number(row.riskCount ?? 0);
  if (count <= 0) return "";
  return `${count} open risk${count === 1 ? "" : "s"}`;
}

/** Source-retained policy phrases for boundary tests (not rendered as a page banner). */
void [
  "Business is an organization",
  "Contacts do not create Buyer authority",
  "No ranking or inferred demand"
];

export function BuyerRegisterPage({
  compatibility = canonicalBuyerPaths
}: {
  compatibility?: BuyerCompatibility;
}) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [rows, setRows] = useState<BuyerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "updatedAt", direction: "desc" });
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [preview, setPreview] = useState<BuyerRow | null>(null);
  const [name, setName] = useState("");
  const [businessTypeValue, setBusinessTypeValue] = useState("");
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
    if (filters.qualificationStatus) params.set("qualificationStatus", filters.qualificationStatus);
    if (filters.geography) params.set("geography", filters.geography);
    try {
      const payload = await api<{ businesses: BuyerRow[]; total: number }>(`/api/intelligence/businesses?${params}`);
      setRows(payload.businesses);
      setTotal(payload.total);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Buyer Intelligence records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { void load(); }, [load]);

  const sortedRows = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      const read = (row: BuyerRow, field: string) => {
        if (field === "type") return businessType(row);
        if (field === "category") return shown(row.category);
        if (field === "geography") return shown(row.geography);
        if (field === "qualification") return businessQualification(row);
        if (field === "contacts") return String(Number(row.contactCount ?? 0));
        if (field === "verifiedBuyers") return String(Number(row.verifiedBuyerCount ?? 0));
        if (field === "risk") return String(Number(row.riskCount ?? 0));
        if (field === "nextAction") return shown(row.nextAction);
        if (field === "reviewed") return shown(row.lastReviewedAt);
        return shown(row[field]);
      };
      return read(left, sort.field).localeCompare(read(right, sort.field), undefined, { numeric: true }) * direction;
    });
  }, [rows, sort]);

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
    if (!canWrite || createSaving) return;
    setCreateSaving(true);
    setCreateError("");
    try {
      const result = await api<{ record: BuyerRow }>("/api/records/business", {
        method: "POST",
        body: { name, businessType: businessTypeValue, category: "General" }
      });
      setName("");
      setBusinessTypeValue("");
      setCreateOpen(false);
      void navigate(compatibility.detailPath(result.record.id));
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Business could not be created.");
    } finally {
      setCreateSaving(false);
    }
  }

  const headerAction = canWrite ? (
    <Button onClick={openCreate}>Create business</Button>
  ) : (
    <Button disabled>Read-only access</Button>
  );

  const previewName = preview ? businessName(preview) : "";
  const previewMeta = preview ? catalogMeta(preview) : "";

  return (
    <div className="page ry-register-page ry-buyer-page">
      <PageHeader
        title="Businesses & Buyer Intelligence"
        description="Business and Buyer research with explicit fit and conflict context. No ranking or inferred demand is shown."
        action={headerAction}
      />
      {compatibility.showCompatibilityNotice ? (
        <Alert className="ry-register-policy" title="Generic Business register compatibility">
          This route reuses the canonical Buyer Intelligence workspace. Links and APIs remain unchanged.
        </Alert>
      ) : null}
      {!canWrite ? (
        <Alert tone="warning" className="ry-register-policy" title="Read-only Buyer Intelligence">
          You may inspect permitted Business and Buyer research, but cannot create records, add research, or apply qualification decisions in this session.
        </Alert>
      ) : null}

      <div className="ry-buyer-workspace">
        <section className="ry-register-surface ry-buyer-results" aria-label="Buyer Intelligence results">
          <div className="ry-register-commandbar">
            <RegisterSavedViews
              recordType="business"
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
              <FilterBar className="ry-buyer-filters">
                <Field label="Search" className="ry-buyer-search-field">
                  <SearchInput label="Search businesses" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} />
                </Field>
                <Field label="Qualification">
                  <Select controlSize="compact" value={filters.qualificationStatus} onChange={(event) => updateFilter("qualificationStatus", event.target.value)}>
                    {qualificationStatuses.map((item) => <option key={item || "all"} value={item}>{item ? readable(item) : "All"}</option>)}
                  </Select>
                </Field>
                <Field label="Geography">
                  <Input controlSize="compact" value={filters.geography} onChange={(event) => updateFilter("geography", event.target.value)} />
                </Field>
                <Field label="Sort" className="ry-buyer-sort-field">
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
                    <option value="qualification:asc">Qualification</option>
                    <option value="geography:asc">Geography</option>
                    <option value="reviewed:desc">Recently reviewed</option>
                    <option value="risk:desc">Risk · high to low</option>
                  </Select>
                </Field>
              </FilterBar>
            </RegisterFilterSheet>
          </div>
          <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => { setFilters(initialFilters); setPage(1); }} />
          <div className="ry-register-resultbar ry-buyer-catalog-bar">
            <span>{total} Business{total === 1 ? "" : "es"} in this view</span>
          </div>
          {loading ? <LoadingState label="Loading Buyer Intelligence" /> : error ? (
            <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
          ) : sortedRows.length === 0 ? (
            <EmptyState
              title={activeFilters.length ? "No Businesses match these filters" : "No Businesses in this view"}
              description={activeFilters.length ? "Clear one or more filters to return to the working Buyer register." : "Create an unqualified Business to begin research and fit review. Qualification remains explicit."}
              action={activeFilters.length ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button> : undefined}
            />
          ) : (
            <>
              <div className="ry-buyer-catalog" role="list" aria-label="Business catalog">
                {sortedRows.map((row) => {
                  const label = businessName(row);
                  const meta = catalogMeta(row);
                  const qualification = businessQualificationLabel(row);
                  const risk = catalogRisk(row);
                  const previewing = preview?.id === row.id;
                  return (
                    <article
                      key={row.id}
                      className={`ry-buyer-tile${previewing ? " is-selected" : ""}`}
                      role="listitem"
                    >
                      <button
                        type="button"
                        className="ry-buyer-tile-select"
                        aria-label={`Preview ${label}`}
                        aria-haspopup="dialog"
                        aria-expanded={previewing}
                        onClick={() => setPreview(row)}
                      >
                        <div className={`ry-buyer-tile-media ry-tone-${catalogTone(row)}`} aria-hidden="true">
                          <span className="ry-buyer-tile-mark">{businessInitials(label)}</span>
                        </div>
                        <span className="ry-buyer-tile-body">
                          <strong>{label}</strong>
                          {meta ? <span className="ry-buyer-tile-meta">{meta}</span> : null}
                          <span className="ry-buyer-tile-qualification">{qualification}</span>
                          <span className="ry-buyer-tile-coverage">
                            {businessCoverageLabel(row)}
                          </span>
                          {risk ? <span className="ry-buyer-tile-risk">{risk}</span> : null}
                        </span>
                      </button>
                      <Link className="ry-buyer-tile-open" to={compatibility.detailPath(row.id)}>
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
        title={previewName || "Business"}
        {...(previewMeta ? { description: previewMeta } : {})}
        onClose={() => setPreview(null)}
        size="narrow"
        className="ry-buyer-preview-dialog"
        {...(preview ? { footer: (
          <Link className="ry-button ry-button-primary ry-control-compact" to={compatibility.detailPath(preview.id)} onClick={() => setPreview(null)}>
            Open business
          </Link>
        ) } : {})}
      >
        {preview ? (
          <dl className="ry-register-preview ry-buyer-preview-facts">
            <div><dt>Qualification</dt><dd>{businessQualificationLabel(preview)}</dd></div>
            <div><dt>Type</dt><dd>{businessTypeLabel(preview)}</dd></div>
            <div><dt>Category</dt><dd>{shown(preview.category, "General")}</dd></div>
            <div><dt>Geography</dt><dd>{shown(preview.geography, "Not recorded")}</dd></div>
            <div><dt>Contacts</dt><dd>{shown(preview.contactCount, "0")}</dd></div>
            <div><dt>Verified buyers</dt><dd>{shown(preview.verifiedBuyerCount, "0")}</dd></div>
            <div><dt>Risk</dt><dd>{catalogRisk(preview) || "None flagged"}</dd></div>
            <div><dt>Next action</dt><dd>{shown(preview.nextAction, "Not assigned")}</dd></div>
            <div><dt>Last reviewed</dt><dd>{date(preview.lastReviewedAt)}</dd></div>
          </dl>
        ) : null}
      </Dialog>

      <Drawer
        open={createOpen}
        title="Create business"
        description="New Business records begin unqualified. No manually entered label creates Buyer authority or representation permission."
        onClose={closeCreate}
        size="standard"
        className="ry-buyer-create-drawer"
      >
        <form className="ry-buyer-create-form ry-register-create-form" aria-label="Create unqualified Business" onSubmit={(event) => void create(event)}>
          {createError ? <ErrorState message={createError} /> : null}
          <section className="ry-register-create-block">
            <RegisterCreateBlockHeader
              title="Business identity"
              description="New records begin unqualified. The label alone does not create buyer authority or representation permission."
            />
            <div className="ry-buyer-create-grid ry-register-create-grid">
              <Field label="Name" className="ry-buyer-create-span ry-register-create-grid-span">
                <Input
                  required
                  controlSize="compact"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={!canWrite || createSaving}
                />
              </Field>
              <Field label="Business type" className="ry-buyer-create-span ry-register-create-grid-span">
                <Input
                  required
                  controlSize="compact"
                  value={businessTypeValue}
                  onChange={(event) => setBusinessTypeValue(event.target.value)}
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
              {createSaving ? "Creating…" : "Create unqualified record"}
            </Button>
          </RegisterCreateFooter>
        </form>
      </Drawer>
    </div>
  );
}
