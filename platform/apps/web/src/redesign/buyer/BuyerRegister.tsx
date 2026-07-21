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
  businessName,
  businessQualification,
  businessType,
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

const columnOptions = [
  { id: "name", label: "Business", required: true },
  { id: "type", label: "Type" },
  { id: "category", label: "Category" },
  { id: "geography", label: "Geography" },
  { id: "qualification", label: "Qualification" },
  { id: "contacts", label: "Contacts" },
  { id: "verifiedBuyers", label: "Verified buyers" },
  { id: "risk", label: "Risk" },
  { id: "nextAction", label: "Next action" },
  { id: "reviewed", label: "Last reviewed" }
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
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
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
      if (selectedId && !payload.businesses.some((row) => row.id === selectedId)) setSelectedId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Buyer Intelligence records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filters, page, selectedId]);

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
      const result = await api<{ record: BuyerRow }>("/api/records/business", {
        method: "POST",
        body: { name, businessType: businessTypeValue, category: "General" }
      });
      setName("");
      setBusinessTypeValue("");
      void navigate(compatibility.detailPath(result.record.id));
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Business could not be created.");
    }
  }

  const contextRail = selected ? (
    <>
      <div className="ry-context-item">
        <strong>Qualification</strong>
        <StatusLabel value={businessQualification(selected)} />
        <small>Qualification does not create Buyer authority or outreach permission.</small>
      </div>
      <div className="ry-context-item">
        <strong>Contact coverage</strong>
        <EvidenceLabel value={Number(selected.contactCount ?? 0) > 0 ? "direct_evidence" : "unknown"} freshness={selected.lastReviewedAt ? `Last reviewed ${date(selected.lastReviewedAt)}` : "Not reviewed"} />
        <small>{shown(selected.contactCount, "0")} professional Contact{Number(selected.contactCount ?? 0) === 1 ? "" : "s"}. Contacts do not create Buyer authority.</small>
      </div>
      <div className="ry-context-item">
        <strong>Verified buyers</strong>
        <StatusLabel value={Number(selected.verifiedBuyerCount ?? 0) > 0 ? "verified" : "unverified"} />
        <small>{shown(selected.verifiedBuyerCount, "0")} verified Buyer role{Number(selected.verifiedBuyerCount ?? 0) === 1 ? "" : "s"} linked to this Business.</small>
      </div>
      <div className="ry-context-item">
        <strong>Open risk</strong>
        <RiskIndicator value={Number(selected.riskCount ?? 0) > 0 ? "high" : "low"} rationale={`${shown(selected.riskCount, "0")} open risk flag${Number(selected.riskCount ?? 0) === 1 ? "" : "s"}.`} />
      </div>
      <div className="ry-context-item">
        <strong>Conflict</strong>
        <StatusLabel value={shown(selected.conflictStatus, "none")} />
        <small>Conflict review is scoped to workspace records; no ranking or inferred demand.</small>
      </div>
      <div className="ry-context-item">
        <strong>Representation status</strong>
        <AuthorityIndicator value="not_established" rationale="A Business record does not establish representation authority." />
      </div>
      <div className="ry-context-item">
        <strong>Next human-owned action</strong>
        <p>{shown(selected.nextAction, "No next action assigned.")}</p>
      </div>
    </>
  ) : (
    <p>Select a Business to inspect qualification, contact coverage, verified Buyers, risk, conflict, and next action without leaving the register.</p>
  );

  return (
    <div className="page ry-register-page ry-buyer-page">
      <PageHeader
        eyebrow="Phase 3 · Human decision required"
        title="Buyer Intelligence"
        description="Business and Buyer research with explicit authority, fit, evidence, and conflict context."
        action={canWrite ? undefined : <Button disabled>Read-only access</Button>}
      />
      {compatibility.showCompatibilityNotice ? (
        <Alert className="ry-register-policy" title="Generic Business register compatibility">
          This route reuses the canonical Buyer Intelligence workspace. Links and APIs remain unchanged.
        </Alert>
      ) : null}
      <Alert className="ry-register-policy" title="Business, Buyer, and Contact are distinct">
        A Business is an organization. A Buyer is a profile or role linked to a Business. A Contact is an individual person. Contacts do not create Buyer authority, and Buyer records do not create representation authority. No ranking or inferred demand is shown.
      </Alert>
      {!canWrite ? (
        <Alert tone="warning" className="ry-register-policy" title="Read-only Buyer Intelligence">
          You may inspect permitted Business and Buyer research, but cannot create records, add evidence, or apply qualification decisions in this session.
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
              <FilterBar>
                <Field label="Search Businesses">
                  <SearchInput label="Search Businesses" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} />
                </Field>
                <Field label="Qualification status">
                  <Select controlSize="compact" value={filters.qualificationStatus} onChange={(event) => updateFilter("qualificationStatus", event.target.value)}>
                    {qualificationStatuses.map((item) => <option key={item || "all"} value={item}>{item ? readable(item) : "All"}</option>)}
                  </Select>
                </Field>
                <Field label="Geography">
                  <Input controlSize="compact" value={filters.geography} onChange={(event) => updateFilter("geography", event.target.value)} />
                </Field>
              </FilterBar>
            </RegisterFilterSheet>
          </div>
          <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => { setFilters(initialFilters); setPage(1); }} />
          <div className="ry-register-resultbar">
            <span>{total} Business{total === 1 ? "" : "es"} in this view</span>
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
          {loading ? <LoadingState label="Loading Buyer Intelligence" /> : error ? (
            <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
          ) : sortedRows.length === 0 ? (
            <EmptyState
              title={activeFilters.length ? "No Businesses match these filters" : "No Businesses in this view"}
              description={activeFilters.length ? "Clear one or more filters to return to the working Buyer register." : "Create an unqualified Business to begin fit and evidence diligence. Qualification remains human-owned."}
              action={activeFilters.length ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button> : undefined}
            />
          ) : (
            <>
              <Table caption="Buyer Intelligence register" compact={density === "compact"}>
                <thead>
                  <tr>
                    {visibleColumns.has("name") ? <SortableHeader field="name" label="Business" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("type") ? <SortableHeader field="type" label="Type" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("category") ? <SortableHeader field="category" label="Category" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("geography") ? <SortableHeader field="geography" label="Geography" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("qualification") ? <SortableHeader field="qualification" label="Qualification" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("contacts") ? <SortableHeader field="contacts" label="Contacts" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("verifiedBuyers") ? <SortableHeader field="verifiedBuyers" label="Verified buyers" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("risk") ? <SortableHeader field="risk" label="Risk" sort={sort} onSort={setSort} /> : null}
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
                            <strong>{businessName(row)}</strong>
                          </button>
                          <small className="ry-register-cell-meta">{businessType(row)}</small>
                        </td>
                      ) : null}
                      {visibleColumns.has("type") ? <td>{businessType(row)}</td> : null}
                      {visibleColumns.has("category") ? <td>{shown(row.category, "General")}</td> : null}
                      {visibleColumns.has("geography") ? <td>{shown(row.geography, "Not recorded")}</td> : null}
                      {visibleColumns.has("qualification") ? <td><StatusLabel value={businessQualification(row)} /></td> : null}
                      {visibleColumns.has("contacts") ? <td>{shown(row.contactCount, "0")}</td> : null}
                      {visibleColumns.has("verifiedBuyers") ? <td>{shown(row.verifiedBuyerCount, "0")}</td> : null}
                      {visibleColumns.has("risk") ? <td>{shown(row.riskCount, "0")}</td> : null}
                      {visibleColumns.has("nextAction") ? <td>{shown(row.nextAction, "Not assigned")}</td> : null}
                      {visibleColumns.has("reviewed") ? <td>{date(row.lastReviewedAt)}</td> : null}
                    </DataRow>
                  ))}
                </tbody>
              </Table>
              <RegisterMobileList label="Buyer Intelligence results">
                {sortedRows.map((row) => (
                  <RegisterMobileRow
                    key={row.id}
                    title={businessName(row)}
                    meta={`${readable(businessQualification(row))} · ${businessType(row)} · ${shown(row.contactCount, "0")} contacts · ${shown(row.verifiedBuyerCount, "0")} verified buyers`}
                    status={<StatusLabel value={businessQualification(row)} />}
                    onOpen={() => void navigate(compatibility.detailPath(row.id))}
                    openLabel={`Open Business ${businessName(row)}`}
                  />
                ))}
              </RegisterMobileList>
              <RegisterPagination page={Math.min(page, pageCount)} pageCount={pageCount} total={total} onPage={setPage} />
            </>
          )}
        </section>

        <section className="ry-buyer-summary" aria-label="Selected Business summary">
          {selected ? (
            <>
              <div className="ry-buyer-identity-summary">
                <h2><Link to={compatibility.detailPath(selected.id)}>{businessName(selected)}</Link></h2>
                <p className="ry-buyer-identity-meta">{businessType(selected)} · {readable(businessQualification(selected))}</p>
                <dl className="ry-register-preview">
                  <div><dt>Qualification</dt><dd><StatusLabel value={businessQualification(selected)} /></dd></div>
                  <div><dt>Type</dt><dd>{businessType(selected)}</dd></div>
                  <div><dt>Category</dt><dd>{shown(selected.category, "General")}</dd></div>
                  <div><dt>Geography</dt><dd>{shown(selected.geography, "Not recorded")}</dd></div>
                  <div><dt>Contacts</dt><dd>{shown(selected.contactCount, "0")}</dd></div>
                  <div><dt>Verified buyers</dt><dd>{shown(selected.verifiedBuyerCount, "0")}</dd></div>
                  <div><dt>Next action</dt><dd>{shown(selected.nextAction, "Not assigned")}</dd></div>
                  <div><dt>Last reviewed</dt><dd>{date(selected.lastReviewedAt)}</dd></div>
                </dl>
              </div>
              <div className="ry-buyer-summary-actions">
                <Link className="ry-button ry-button-secondary" to={compatibility.detailPath(selected.id)}>Open full detail</Link>
              </div>
            </>
          ) : (
            <EmptyState compact title="No Business selected" description="Select a Business from the results to review qualification, Contacts, verified Buyers, and next action." />
          )}
        </section>

        <div className="ry-buyer-context-rail-desktop">
          <ContextRail title="Business context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>
            {contextRail}
          </ContextRail>
        </div>
      </div>

      <section className="ry-buyer-create panel" aria-label="Create unqualified Business">
        <h2>Create a research record</h2>
        <p>New Business records begin unqualified. No manually entered label creates Buyer authority or representation permission.</p>
        {createError ? <ErrorState message={createError} /> : null}
        <form className="ry-buyer-create-form" onSubmit={(event) => void create(event)}>
          <Field label="Name"><Input required value={name} onChange={(event) => setName(event.target.value)} disabled={!canWrite} /></Field>
          <Field label="Business type"><Input required value={businessTypeValue} onChange={(event) => setBusinessTypeValue(event.target.value)} disabled={!canWrite} /></Field>
          <Button type="submit" disabled={!canWrite}>Create unqualified record</Button>
        </form>
      </section>
    </div>
  );
}
