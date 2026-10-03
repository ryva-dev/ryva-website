import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
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
  Table,
  TextArea
} from "../../design-system";
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
import { agreementDocumentMeta, agreementDocumentTitle, agreementStatusDisplay, brandNameTitle, channelsLabel, date, displayBrandName, documentNameTitle, readable, shown, stageDisplayLabel, type Row } from "./utils";

const AGREEMENT_PAGE_SIZE = 12;
const OPPORTUNITY_BRAND_STAGES = new Set(["contact_ready", "contacted", "conversation", "reviewing_terms"]);

const CHANNEL_OPTIONS = [
  { value: "independent_retail", label: "Independent retail" },
  { value: "specialty_retail", label: "Specialty retail" },
  { value: "regional_chains", label: "Regional chains" },
  { value: "national_retail", label: "National retail" },
  { value: "hospitality", label: "Hospitality" },
  { value: "ecommerce", label: "Ecommerce" }
] as const;

const TERRITORY_OPTIONS = [
  "United States",
  "Canada",
  "United Kingdom",
  "European Union",
  "Mexico",
  "Australia"
] as const;

const TERM_OPTIONS = [
  { id: "commission_timing", label: "Commission timing" },
  { id: "termination_rights", label: "Termination rights" },
  { id: "payment_terms", label: "Payment terms" },
  { id: "exclusivity", label: "Exclusivity" },
  { id: "account_protection", label: "Account protection" }
] as const;

function brandPipelineStage(item: Row): string {
  return shown(item.pipelineStage ?? item.pipeline_stage, "discovered");
}

function brandMonogram(name: string): string {
  const parts = name.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

function StageLabel({ stage }: { stage: string }) {
  return (
    <span className={`ry-representation-stage ry-representation-stage-${stage}`}>
      {stageDisplayLabel(stage)}
    </span>
  );
}

function AgreementStatusLabel({ item }: { item: Row }) {
  const { tone, label } = agreementStatusDisplay(item);
  return (
    <span className={`ry-representation-status ry-representation-status-${tone}`}>
      <span className="ry-representation-status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function NextActionCell({ item }: { item: Row }) {
  const action = shown(item.nextAction, "").trim();
  if (action) {
    return (
      <Link
        className="ry-representation-next-action"
        to={`/representation/${item.id}`}
        title={action}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {action}
      </Link>
    );
  }
  return (
    <Link
      className="ry-representation-next-action ry-representation-next-action-empty"
      to={`/representation/${item.id}#assign-next-action`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      Add next action
    </Link>
  );
}

type RecordContext = {
  record: Row;
  related: Row[];
  decisions: Row[];
  tasks: Row[];
};

const initialFilters: RegisterFilterValue = {
  query: "",
  stage: ""
};

const columnOptions = [
  { id: "brand", label: "Brand", required: true },
  { id: "stage", label: "Stage" },
  { id: "channels", label: "Channels" },
  { id: "nextAction", label: "Next action" }
];

export function RepresentationRegisterPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [opportunities, setOpportunities] = useState<Row[]>([]);
  const [agreements, setAgreements] = useState<Row[]>([]);
  const [brands, setBrands] = useState<Row[]>([]);
  const [contacts, setContacts] = useState<Row[]>([]);
  const [brandId, setBrandId] = useState("");
  const [context, setContext] = useState<RecordContext | null>(null);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [contactId, setContactId] = useState("");
  const [decisionId, setDecisionId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [channels, setChannels] = useState<string[]>(["independent_retail"]);
  const [territory, setTerritory] = useState<string>("United States");
  const [objectives, setObjectives] = useState("");
  const [missingTermIds, setMissingTermIds] = useState<string[]>(["commission_timing", "termination_rights"]);
  const [productQuery, setProductQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "brand", direction: "asc" });
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [agreementPage, setAgreementPage] = useState(1);
  const [showAllAgreements, setShowAllAgreements] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [opportunityPayload, agreementPayload, brandPayload, contactPayload] = await Promise.all([
        api<{ opportunities: Row[] }>("/api/representation/opportunities"),
        api<{ agreements: Row[] }>("/api/agreements"),
        api<{ records: Row[] }>("/api/records/brand?limit=100"),
        api<{ records: Row[] }>("/api/records/contact?limit=100")
      ]);
      setOpportunities(opportunityPayload.opportunities);
      setAgreements(agreementPayload.agreements);
      setBrands(brandPayload.records);
      setContacts(contactPayload.records);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Representation records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!brandId) {
      setContext(null);
      setProductIds([]);
      setContactId("");
      setDecisionId("");
      setTaskId("");
      setProductQuery("");
      return;
    }
    setContactId("");
    void api<RecordContext>(`/api/records/brand/${brandId}`)
      .then((value) => {
        setContext(value);
        setProductIds([]);
        setDecisionId(String(value.decisions.find((item) => item.status === "issued")?.id ?? ""));
        setTaskId(String(value.tasks.find((item) => !["completed", "canceled"].includes(String(item.status)))?.id ?? ""));
      })
      .catch((caught) => setCreateError(caught instanceof Error ? caught.message : "Brand context could not be loaded."));
  }, [brandId]);

  function resetCreateForm() {
    setBrandId("");
    setContext(null);
    setProductIds([]);
    setContactId("");
    setDecisionId("");
    setTaskId("");
    setChannels(["independent_retail"]);
    setTerritory("United States");
    setObjectives("");
    setMissingTermIds(["commission_timing", "termination_rights"]);
    setProductQuery("");
    setCreateError("");
  }

  function openCreate() {
    setCreateError("");
    setCreateOpen(true);
  }

  function closeCreate() {
    if (saving) return;
    setCreateOpen(false);
    resetCreateForm();
  }

  async function submitOpportunity(options?: { stay?: boolean }) {
    if (!canWrite) return;
    setSaving(true);
    setCreateError("");
    try {
      const missingTerms = TERM_OPTIONS
        .filter((term) => missingTermIds.includes(term.id))
        .map((term) => term.label);
      const result = await api<{ opportunity: Row }>("/api/representation/opportunities", {
        method: "POST",
        body: {
          brandId,
          brandContactId: contactId || null,
          productIds,
          proposedChannels: channels,
          proposedTerritory: { description: territory },
          brandObjectives: objectives,
          termsSummary: "",
          missingTerms,
          decisionId,
          nextActionTaskId: taskId
        }
      });
      if (options?.stay) {
        resetCreateForm();
        await load();
      } else {
        setCreateOpen(false);
        void navigate(`/representation/${result.opportunity.id}`);
      }
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "The opportunity could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    await submitOpportunity();
  }

  function toggleChannel(value: string) {
    setChannels((current) => (
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    ));
  }

  function toggleMissingTerm(id: string) {
    setMissingTermIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  }

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
  }

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((item) => {
      if (filters.query && !`${displayBrandName(item.brandName)} ${shown(item.brandName)}`.toLowerCase().includes(filters.query.toLowerCase())) return false;
      if (filters.stage && shown(item.stage) !== filters.stage) return false;
      return true;
    });
  }, [opportunities, filters]);

  const sortedOpportunities = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filteredOpportunities].sort((left, right) => {
      const read = (row: Row, key: string) => {
        if (key === "brand") return displayBrandName(row.brandName);
        if (key === "stage") return shown(row.stage);
        if (key === "channels") return channelsLabel(row.proposedChannels);
        if (key === "nextAction") return shown(row.nextAction, "Add next action");
        return shown(row[key]);
      };
      return read(left, sort.field).localeCompare(read(right, sort.field)) * direction;
    });
  }, [filteredOpportunities, sort]);

  const activeAgreementCount = agreements.filter((item) => item.status === "active").length;
  const needsReviewCount = agreements.filter((item) => ["reviewing", "pending_approval"].includes(String(item.status))).length;
  const agreementPageCount = Math.max(1, Math.ceil(agreements.length / AGREEMENT_PAGE_SIZE));
  const currentAgreementPage = Math.min(agreementPage, agreementPageCount);
  const visibleAgreements = showAllAgreements
    ? agreements
    : agreements.slice(
      (currentAgreementPage - 1) * AGREEMENT_PAGE_SIZE,
      currentAgreementPage * AGREEMENT_PAGE_SIZE
    );
  const canExpandAgreements = agreements.length > AGREEMENT_PAGE_SIZE;
  const activeFilters = Object.entries(filters)
    .filter(([, value]) => value)
    .map(([id, value]) => ({
      id,
      label: `${id === "query" ? "Search" : readable(id)}: ${readable(String(value))}`
    }));

  const readyBrands = brands.filter((item) => OPPORTUNITY_BRAND_STAGES.has(brandPipelineStage(item)));
  const blockedBrandCount = brands.length - readyBrands.length;
  const selectedBrand = readyBrands.find((item) => String(item.id) === brandId) ?? null;
  const selectedBrandName = selectedBrand ? displayBrandName(selectedBrand.name) : "";
  const brandContacts = contacts.filter((item) => item.brandId === brandId && ["verified", "stale"].includes(String(item.verificationStatus)));
  const selectedContact = brandContacts.find((item) => String(item.id) === contactId) ?? null;
  const brandProducts = context?.related ?? [];
  const filteredProducts = brandProducts.filter((item) => {
    if (!productQuery.trim()) return true;
    return String(item.name).toLowerCase().includes(productQuery.trim().toLowerCase());
  });
  const unresolvedTerms = TERM_OPTIONS.filter((term) => missingTermIds.includes(term.id));
  const canSubmit = Boolean(canWrite && brandId && productIds.length > 0 && channels.length > 0 && territory && objectives.trim() && decisionId && taskId);
  const showScope = Boolean(brandId);
  const showTerms = Boolean(brandId && productIds.length > 0 && channels.length > 0 && territory);
  const createStep = !showScope ? 1 : !showTerms ? 2 : 3;

  return (
    <div className="page ry-register-page ry-representation-page">
      <PageHeader
        title="Representation"
        description="Move from Brand diligence to written authority without treating an uploaded agreement as permission."
        action={canWrite ? <Button onClick={openCreate}>Open opportunity</Button> : <Button disabled>Read-only access</Button>}
      />
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}
      {!canWrite ? (
        <Alert tone="warning" className="ry-register-policy" title="Read-only Representation workspace">
          You may inspect permitted Representation Opportunities and Agreements, but cannot open a new opportunity in this session.
        </Alert>
      ) : null}
      {loading ? <LoadingState label="Loading representation authority" /> : (
        <>
          <section className="ry-register-surface" aria-label="Representation Opportunities">
            <div className="ry-register-commandbar">
              <RegisterSavedViews
                recordType="representation_opportunity"
                filters={filters}
                sort={sort}
                canWrite={Boolean(canWrite)}
                onApply={(nextFilters, nextSort) => {
                  setFilters({ ...initialFilters, ...nextFilters });
                  setSort(nextSort);
                }}
              />
              <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
                <FilterBar>
                  <Field label="Search brands and agreements">
                    <SearchInput label="Search brands and agreements" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} />
                  </Field>
                  <Field label="Stage">
                    <Select controlSize="compact" value={filters.stage} onChange={(event) => updateFilter("stage", event.target.value)}>
                      <option value="">All stages</option>
                      {["contact_ready", "contacted", "conversation", "reviewing_terms", "agreement_draft", "converted", "paused", "rejected"].map((item) => <option key={item} value={item}>{stageDisplayLabel(item)}</option>)}
                    </Select>
                  </Field>
                </FilterBar>
              </RegisterFilterSheet>
            </div>
            <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => setFilters(initialFilters)} />
            <div className="ry-register-resultbar">
              <span>{filteredOpportunities.length} opportunit{filteredOpportunities.length === 1 ? "y" : "ies"} · {activeAgreementCount} active agreement{activeAgreementCount === 1 ? "" : "s"} · {needsReviewCount} needing review</span>
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
            <header className="ry-representation-section-heading">
              <h2>Representation Opportunities</h2>
            </header>
            {sortedOpportunities.length === 0 ? (
              <EmptyState
                title={activeFilters.length ? "No Opportunities match these filters" : undefined}
                description={activeFilters.length ? "Clear one or more filters to return to the working Representation register." : "No Representation Opportunities yet. A Brand must be Contact Ready first."}
                action={
                  activeFilters.length
                    ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button>
                    : canWrite
                      ? <Button onClick={openCreate}>Open opportunity</Button>
                      : undefined
                }
              />
            ) : (
              <>
                <Table caption="Representation Opportunities" compact={density === "compact"}>
                  <thead>
                    <tr>
                      {visibleColumns.has("brand") ? <SortableHeader field="brand" label="Brand" sort={sort} onSort={setSort} /> : null}
                      {visibleColumns.has("stage") ? <SortableHeader field="stage" label="Stage" sort={sort} onSort={setSort} /> : null}
                      {visibleColumns.has("channels") ? <SortableHeader field="channels" label="Channels" sort={sort} onSort={setSort} /> : null}
                      {visibleColumns.has("nextAction") ? <SortableHeader field="nextAction" label="Next action" sort={sort} onSort={setSort} /> : null}
                      <th scope="col" className="ry-register-cell-actions"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOpportunities.map((item) => (
                      <DataRow
                        key={item.id}
                        className="ry-representation-row"
                        tabIndex={0}
                        aria-label={`Open ${displayBrandName(item.brandName)} opportunity`}
                        onClick={() => void navigate(`/representation/${item.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void navigate(`/representation/${item.id}`);
                          }
                        }}
                      >
                        {visibleColumns.has("brand") ? (
                          <td>
                            <strong title={brandNameTitle(item.brandName)}>{displayBrandName(item.brandName)}</strong>
                          </td>
                        ) : null}
                        {visibleColumns.has("stage") ? <td><StageLabel stage={String(item.stage)} /></td> : null}
                        {visibleColumns.has("channels") ? <td>{channelsLabel(item.proposedChannels)}</td> : null}
                        {visibleColumns.has("nextAction") ? <td className="ry-representation-col-next"><NextActionCell item={item} /></td> : null}
                        <td className="ry-register-cell-actions">
                          <Link
                            className="ry-representation-open"
                            to={`/representation/${item.id}`}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            Open <span aria-hidden="true">→</span>
                          </Link>
                        </td>
                      </DataRow>
                    ))}
                  </tbody>
                </Table>
                <RegisterMobileList label="Representation Opportunities">
                  {sortedOpportunities.map((item) => (
                    <RegisterMobileRow
                      key={item.id}
                      title={displayBrandName(item.brandName)}
                      meta={`${stageDisplayLabel(shown(item.stage))} · ${channelsLabel(item.proposedChannels)} · ${shown(item.nextAction, "Add next action")}`}
                      status={<StageLabel stage={String(item.stage)} />}
                      onOpen={() => void navigate(`/representation/${item.id}`)}
                      openLabel={`Open ${displayBrandName(item.brandName)} opportunity`}
                    />
                  ))}
                </RegisterMobileList>
              </>
            )}
          </section>

          <section id="representation-agreements" className="ry-register-surface ry-representation-agreements" aria-label="Representation Agreements">
            <header className="ry-representation-section-heading">
              <h2>Representation Agreements</h2>
              {canExpandAgreements ? (
                <button
                  type="button"
                  className="ry-representation-section-link"
                  onClick={() => {
                    setShowAllAgreements((current) => !current);
                    if (showAllAgreements) setAgreementPage(1);
                  }}
                >
                  {showAllAgreements ? "Show fewer" : <>View all {agreements.length} agreements <span aria-hidden="true">→</span></>}
                </button>
              ) : null}
            </header>
            <div className="ry-register-resultbar">
              <span>{agreements.length} agreement{agreements.length === 1 ? "" : "s"} · {activeAgreementCount} active · {needsReviewCount} needing review</span>
            </div>
            {agreements.length === 0 ? (
              <EmptyState description="No Agreements have been created." />
            ) : (
              <>
                <Table caption="Representation Agreements" compact={density === "compact"}>
                  <thead>
                    <tr>
                      <th scope="col">Brand</th>
                      <th scope="col">Status</th>
                      <th scope="col">Effective</th>
                      <th scope="col">Expires</th>
                      <th scope="col">Document</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAgreements.map((item) => (
                      <DataRow
                        key={item.id}
                        className="ry-representation-row"
                        tabIndex={0}
                        aria-label={`Open ${displayBrandName(item.brandName)} agreement`}
                        onClick={() => void navigate(`/agreements/${item.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void navigate(`/agreements/${item.id}`);
                          }
                        }}
                      >
                        <td>
                          <strong title={brandNameTitle(item.brandName)}>{displayBrandName(item.brandName)}</strong>
                        </td>
                        <td><AgreementStatusLabel item={item} /></td>
                        <td className="ry-representation-col-term">{date(item.effectiveAt)}</td>
                        <td className="ry-representation-col-term">{date(item.expiresAt)}</td>
                        <td className="ry-representation-col-document">
                          {item.sourceDocumentId ? (
                            <Link
                              className="ry-representation-document-link"
                              to={`/agreements/${item.id}`}
                              title={documentNameTitle(item.documentName) ?? "Open representation agreement"}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <span className="ry-representation-document-action">
                                <svg className="ry-representation-document-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M6 3h9l3 3v15H6z" />
                                  <path d="M9 11h6M9 15h6" />
                                </svg>
                                <span className="ry-representation-document-title">{agreementDocumentTitle()}</span>
                              </span>
                              <small className="ry-representation-document-meta">{agreementDocumentMeta(item.updatedAt)}</small>
                            </Link>
                          ) : (
                            <span className="ry-representation-document-empty">
                              <span className="ry-representation-document-title">No document</span>
                              <small className="ry-representation-document-meta">Add in agreement review</small>
                            </span>
                          )}
                        </td>
                      </DataRow>
                    ))}
                  </tbody>
                </Table>
                <RegisterMobileList label="Representation Agreements">
                  {visibleAgreements.map((item) => (
                    <RegisterMobileRow
                      key={item.id}
                      title={displayBrandName(item.brandName)}
                      meta={`${agreementStatusDisplay(item).label} · ${date(item.effectiveAt)} – ${date(item.expiresAt)}`}
                      status={<AgreementStatusLabel item={item} />}
                      onOpen={() => void navigate(`/agreements/${item.id}`)}
                      openLabel={`Open ${displayBrandName(item.brandName)} agreement`}
                    />
                  ))}
                </RegisterMobileList>
                {!showAllAgreements && agreements.length > AGREEMENT_PAGE_SIZE ? (
                  <RegisterPagination
                    page={currentAgreementPage}
                    pageCount={agreementPageCount}
                    total={agreements.length}
                    pageSize={AGREEMENT_PAGE_SIZE}
                    onPage={setAgreementPage}
                  />
                ) : null}
              </>
            )}
          </section>

        </>
      )}

      <Drawer
        open={createOpen}
        title="Open a Representation Opportunity"
        description="Pick a Contact Ready Brand, define commercial scope, and open the opportunity without treating an upload as permission."
        onClose={closeCreate}
        size="wide"
        className="ry-representation-create-drawer"
      >
            <form className="ry-representation-create-form ry-register-create-form" aria-label="Open a Representation Opportunity" onSubmit={(event) => void create(event)}>
              {createError ? <ErrorState message={createError} /> : null}
              <div className="ry-representation-create-progress ry-register-create-progress" aria-label={`Step ${createStep} of 3`}>
                <span className={`ry-representation-create-step ry-register-create-step${createStep >= 1 ? " is-active" : ""}${createStep > 1 ? " is-complete" : ""}`}>Brand</span>
                <span className={`ry-representation-create-step ry-register-create-step${createStep >= 2 ? " is-active" : ""}${createStep > 2 ? " is-complete" : ""}`}>Scope</span>
                <span className={`ry-representation-create-step ry-register-create-step${createStep >= 3 ? " is-active" : ""}`}>Terms</span>
              </div>

              <section className="ry-representation-create-block ry-register-create-block" aria-labelledby="rep-create-brand-heading">
                <header className="ry-representation-create-block-header ry-register-create-block-header">
                  <h3 id="rep-create-brand-heading">Brand and contact</h3>
                  <p>Pick a brand that’s ready for outreach, then the contact who owns the conversation.</p>
                </header>
                <div className="ry-representation-create-identity">
                  <Field label="Brand" className="ry-representation-create-brand-field">
                    <Select
                      required
                      controlSize="compact"
                      value={brandId}
                      onChange={(event) => setBrandId(event.target.value)}
                      disabled={!canWrite || readyBrands.length === 0}
                    >
                      <option value="">
                        {readyBrands.length === 0 ? "No eligible brands yet" : "Select brand"}
                      </option>
                      {readyBrands.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {displayBrandName(item.name)}
                          {shown(item.legalName) !== "—" ? ` · ${shown(item.legalName)}` : ""}
                          {` · ${stageDisplayLabel(brandPipelineStage(item))}`}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Brand contact" className="ry-representation-create-contact-field">
                    <Select
                      controlSize="compact"
                      value={contactId}
                      onChange={(event) => setContactId(event.target.value)}
                      disabled={!canWrite || !brandId}
                    >
                      <option value="">{brandId ? "No contact selected" : "Select a brand first"}</option>
                      {brandContacts.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {String(item.name)}
                          {shown(item.verificationStatus) === "verified" ? " · Verified" : " · Stale"}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {selectedBrand ? (
                  <div className="ry-representation-create-summary" aria-live="polite">
                    <span className="ry-representation-create-monogram" aria-hidden="true">{brandMonogram(selectedBrandName)}</span>
                    <div className="ry-representation-create-summary-copy">
                      <strong title={brandNameTitle(selectedBrand.name)}>{selectedBrandName}</strong>
                      <span>
                        {selectedContact
                          ? `${String(selectedContact.name)} · ${shown(selectedContact.verificationStatus) === "verified" ? "Verified contact" : "Stale contact"}`
                          : "No brand contact selected"}
                      </span>
                    </div>
                    <dl className="ry-representation-create-summary-meta">
                      <div>
                        <dt>Products</dt>
                        <dd>{brandProducts.length}</dd>
                      </div>
                      <div>
                        <dt>Relationship</dt>
                        <dd>{stageDisplayLabel(brandPipelineStage(selectedBrand))}</dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <p className="ry-representation-create-hint ry-register-create-hint">
                    {readyBrands.length === 0 ? (
                      <>
                        {brands.length === 0
                          ? "Start by creating a brand, then bring it through diligence until it’s ready for outreach. "
                          : `${blockedBrandCount} brand${blockedBrandCount === 1 ? " isn’t" : "s aren’t"} ready for outreach yet. `}
                        <Link className="ry-representation-create-hint-link ry-register-create-hint-link" to="/brands">
                          Go to brands
                        </Link>
                        {brands.length === 0 ? " to create one." : " to continue."}
                      </>
                    ) : (
                      "Select a brand to continue with products and channels."
                    )}
                  </p>
                )}
              </section>

              {showScope ? (
                <section className="ry-representation-create-block ry-register-create-block is-revealed" aria-labelledby="rep-create-scope-heading">
                  <header className="ry-representation-create-block-header ry-register-create-block-header">
                    <h3 id="rep-create-scope-heading">Commercial scope</h3>
                    <p>Set the products, sales channels, and territory this opportunity covers.</p>
                  </header>
                  <div className="ry-representation-create-scope">
                    <div className="ry-representation-create-scope-main">
                      <div className="ry-field ry-representation-create-products">
                        <span className="ry-field-label">Products in scope</span>
                        <div className="ry-representation-product-multiselect">
                          <SearchInput
                            label="Search products"
                            controlSize="compact"
                            value={productQuery}
                            onChange={(event) => setProductQuery(event.target.value)}
                            onClear={() => setProductQuery("")}
                            disabled={!canWrite}
                            placeholder="Search products"
                          />
                          <div className="ry-representation-product-options" role="group" aria-label="Products in scope">
                            {filteredProducts.length === 0 ? (
                              <small>{brandProducts.length ? "No products match this search." : "This Brand has no Products yet."}</small>
                            ) : (
                              filteredProducts.map((item) => (
                                <label key={item.id} className="ry-representation-product-option">
                                  <input
                                    type="checkbox"
                                    checked={productIds.includes(item.id)}
                                    disabled={!canWrite}
                                    onChange={(event) => setProductIds((current) => (
                                      event.target.checked
                                        ? [...current, item.id]
                                        : current.filter((id) => id !== item.id)
                                    ))}
                                  />
                                  <span>{String(item.name)}</span>
                                </label>
                              ))
                            )}
                          </div>
                          <small className="ry-representation-product-count">
                            {productIds.length} product{productIds.length === 1 ? "" : "s"} selected
                          </small>
                        </div>
                      </div>

                      <fieldset className="ry-representation-create-channels">
                        <legend>Sales channels</legend>
                        <div className="ry-representation-channel-list" role="group" aria-label="Sales channels">
                          {CHANNEL_OPTIONS.map((option) => {
                            const selected = channels.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                className={`ry-representation-channel-option${selected ? " is-selected" : ""}`}
                                aria-pressed={selected}
                                disabled={!canWrite}
                                onClick={() => toggleChannel(option.value)}
                              >
                                <span className="ry-representation-channel-check" aria-hidden="true">{selected ? "✓" : ""}</span>
                                <span>{option.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                    </div>

                    <div className="ry-representation-create-scope-meta">
                      <Field label="Territory" className="ry-representation-create-territory">
                        <Select
                          required
                          controlSize="compact"
                          value={territory}
                          onChange={(event) => setTerritory(event.target.value)}
                          disabled={!canWrite}
                        >
                          {TERRITORY_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </Select>
                      </Field>

                      <Field label="Opportunity goals" className="ry-representation-create-goals">
                        <TextArea
                          required
                          rows={3}
                          value={objectives}
                          onChange={(event) => setObjectives(event.target.value)}
                          disabled={!canWrite}
                          placeholder="What commercial outcome should this opportunity pursue?"
                        />
                      </Field>
                    </div>
                  </div>
                  {!showTerms ? (
                    <p className="ry-representation-create-hint ry-register-create-hint">Choose products and at least one sales channel to continue to terms.</p>
                  ) : null}
                </section>
              ) : null}

              {showTerms ? (
                <section className="ry-representation-create-block ry-register-create-block is-revealed" aria-labelledby="rep-create-terms-heading">
                  <header className="ry-representation-create-block-header ry-register-create-block-header">
                    <h3 id="rep-create-terms-heading">Terms and next step</h3>
                    <p>Flag terms that still need work, then choose the brand decision and next action.</p>
                  </header>
                  <div className="ry-representation-create-terms">
                    <div className="ry-representation-create-terms-list">
                      <div className="ry-representation-create-readiness" aria-live="polite">
                        <strong>
                          {unresolvedTerms.length === 0
                            ? "No terms marked unresolved"
                            : `${unresolvedTerms.length} term${unresolvedTerms.length === 1 ? "" : "s"} still unresolved`}
                        </strong>
                      </div>
                      <fieldset className="ry-representation-term-list">
                        <legend className="sr-only">Terms still needed</legend>
                        <p className="ry-representation-term-list-label">Terms still needed</p>
                        {TERM_OPTIONS.map((term) => {
                          const unresolved = missingTermIds.includes(term.id);
                          return (
                            <label key={term.id} className={`ry-representation-term-option${unresolved ? " is-unresolved" : ""}`}>
                              <input
                                type="checkbox"
                                checked={unresolved}
                                disabled={!canWrite}
                                onChange={() => toggleMissingTerm(term.id)}
                              />
                              <span className="ry-representation-term-status" aria-hidden="true">{unresolved ? "Needs term" : "Resolved"}</span>
                              <span className="ry-representation-term-name">{term.label}</span>
                            </label>
                          );
                        })}
                      </fieldset>
                    </div>
                    <div className="ry-representation-create-next">
                      <Field label="Brand decision">
                        <Select
                          required
                          controlSize="compact"
                          value={decisionId}
                          onChange={(event) => setDecisionId(event.target.value)}
                          disabled={!canWrite}
                        >
                          <option value="">Select decision</option>
                          {context?.decisions.filter((item) => item.status === "issued").map((item) => (
                            <option key={item.id} value={String(item.id)}>{shown(item.outcome)}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Next action">
                        <Select
                          required
                          controlSize="compact"
                          value={taskId}
                          onChange={(event) => setTaskId(event.target.value)}
                          disabled={!canWrite}
                        >
                          <option value="">Select task</option>
                          {context?.tasks.filter((item) => !["completed", "canceled"].includes(String(item.status))).map((item) => (
                            <option key={item.id} value={String(item.id)}>{shown(item.title)}</option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  </div>
                </section>
              ) : null}

              <div className="ry-representation-create-footer ry-register-create-footer">
                <Button type="button" variant="tertiary" size="compact" disabled={!canWrite || saving} onClick={closeCreate}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  loading={saving}
                  disabled={!canSubmit}
                  onClick={() => void submitOpportunity({ stay: true })}
                >
                  Save draft
                </Button>
                <Button type="submit" size="compact" loading={saving} disabled={!canSubmit}>
                  Open opportunity
                </Button>
              </div>
            </form>
      </Drawer>

    </div>
  );
}
