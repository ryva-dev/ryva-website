import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  ButtonGroup,
  Checkbox,
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
  StatusLabel,
  Table,
  TextArea
} from "../../design-system";
import {
  ActiveFilters,
  RegisterColumnSelector,
  RegisterFilterSheet,
  RegisterMobileList,
  RegisterMobileRow,
  RegisterSavedViews,
  SortableHeader,
  type RegisterFilterValue,
  type RegisterSort
} from "../register/Register";
import {
  conflictStatus,
  date,
  isTerminalStage,
  pipelineBoardStages,
  placementStage,
  readable,
  shown,
  type Row
} from "./utils";

type AgreementDetail = { agreement: Row; products: string[] };
type BusinessContext = { decisions: Row[]; tasks: Row[] };

const initialFilters: RegisterFilterValue = {
  query: "",
  stage: "",
  conflict: "",
  stalled: ""
};

const columnOptions = [
  { id: "brand", label: "Brand", required: true },
  { id: "business", label: "Business", required: true },
  { id: "stage", label: "Stage" },
  { id: "conflict", label: "Authority / conflict" },
  { id: "nextAction", label: "Next action" }
];

type ViewMode = "table" | "kanban";

export function PlacementRegisterPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [placements, setPlacements] = useState<Row[]>([]);
  const [agreements, setAgreements] = useState<Row[]>([]);
  const [businesses, setBusinesses] = useState<Row[]>([]);
  const [agreementId, setAgreementId] = useState("");
  const [agreement, setAgreement] = useState<AgreementDetail | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [business, setBusiness] = useState<BusinessContext | null>(null);
  const [decisionId, setDecisionId] = useState("");
  const [matchThesis, setMatchThesis] = useState("");
  const [buyerValue, setBuyerValue] = useState("");
  const [channel, setChannel] = useState("");
  const [partyText, setPartyText] = useState({
    brandValue: "", brandObligations: "", brandRisks: "",
    buyerObligations: "", buyerRisks: "",
    representativeValue: "", representativeObligations: "", representativeRisks: ""
  });
  const [allValue, setAllValue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "brand", direction: "asc" });
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("table");
  const [dragId, setDragId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [placementPayload, agreementPayload, businessPayload] = await Promise.all([
        api<{ placements: Row[] }>("/api/placements"),
        api<{ agreements: Row[] }>("/api/agreements?status=active"),
        api<{ businesses: Row[] }>("/api/intelligence/businesses?qualificationStatus=qualified")
      ]);
      setPlacements(placementPayload.placements);
      setAgreements(agreementPayload.agreements);
      setBusinesses(businessPayload.businesses);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Placement workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!agreementId) {
      setAgreement(null);
      return;
    }
    void api<AgreementDetail>(`/api/agreements/${agreementId}`)
      .then(setAgreement)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Agreement scope could not be loaded."));
  }, [agreementId]);

  useEffect(() => {
    if (!businessId) {
      setBusiness(null);
      return;
    }
    void api<BusinessContext>(`/api/records/business/${businessId}`).then((value) => {
      setBusiness(value);
      setDecisionId(String(value.decisions.find((item) => item.status === "issued")?.id ?? ""));
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Buyer context could not be loaded."));
  }, [businessId]);

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
  }

  const filtered = useMemo(() => {
    const query = String(filters.query ?? "").trim().toLowerCase();
    return placements.filter((item) => {
      if (filters.stage && placementStage(item) !== filters.stage) return false;
      if (filters.conflict && conflictStatus(item) !== filters.conflict) return false;
      if (filters.stalled === "yes" && item.stalled !== true) return false;
      if (filters.stalled === "no" && item.stalled === true) return false;
      if (!query) return true;
      const haystack = `${shown(item.brandName)} ${shown(item.businessName)} ${shown(item.nextAction)} ${placementStage(item)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [filters, placements]);

  const sorted = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) => {
      const value = (item: Row) => {
        if (sort.field === "business") return shown(item.businessName).toLowerCase();
        if (sort.field === "stage") return placementStage(item);
        if (sort.field === "conflict") return conflictStatus(item);
        if (sort.field === "nextAction") return shown(item.nextAction).toLowerCase();
        return shown(item.brandName).toLowerCase();
      };
      return value(left).localeCompare(value(right)) * direction;
    });
  }, [filtered, sort]);

  const activeFilters = Object.entries(filters)
    .filter(([, value]) => Boolean(value))
    .map(([id, value]) => ({
      id,
      label: `${id === "query" ? "Search" : readable(id)}: ${readable(String(value))}`
    }));

  const openCount = placements.filter((item) => !isTerminalStage(placementStage(item))).length;
  const stalledCount = placements.filter((item) => item.stalled === true).length;
  const conflictCount = placements.filter((item) => conflictStatus(item) !== "clear").length;

  const stageGroups = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const stage of [...pipelineBoardStages, ...(["closed_lost", "disqualified"] as const)]) {
      groups.set(stage, []);
    }
    for (const item of sorted) {
      const stage = placementStage(item);
      const bucket = isTerminalStage(stage) ? stage : (groups.has(stage) ? stage : "identified");
      const list = groups.get(bucket) ?? [];
      list.push(item);
      groups.set(bucket, list);
    }
    return groups;
  }, [sorted]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!agreement || !canWrite) return;
    setSaving(true);
    setError("");
    try {
      const result = await api<{ placement: Row }>("/api/placements", {
        method: "POST",
        body: {
          agreementId,
          businessId,
          productIds: agreement.products,
          channel,
          matchThesis,
          buyerValueBasis: buyerValue,
          evidenceConfidence: "supported",
          decisionId,
          triangle: {
            ...partyText,
            brandWarningSigns: "",
            buyerValue,
            buyerWarningSigns: "",
            representativeWarningSigns: "",
            allPartiesReceiveLegitimateValue: allValue
          }
        }
      });
      setCreateOpen(false);
      void navigate(`/placements/${result.placement.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Placement could not be created.");
    } finally {
      setSaving(false);
    }
  }

  function proposeStageMove(placementId: string, toStage: string) {
    void navigate(`/placements/${placementId}?toStage=${encodeURIComponent(toStage)}#stage-review`);
  }

  function onCardDragStart(event: DragEvent, placementId: string) {
    if (!canWrite) return;
    setDragId(placementId);
    event.dataTransfer.setData("text/plain", placementId);
    event.dataTransfer.effectAllowed = "move";
  }

  function onColumnDrop(event: DragEvent, toStage: string) {
    event.preventDefault();
    const placementId = event.dataTransfer.getData("text/plain") || dragId;
    setDragId("");
    if (!placementId || !canWrite) return;
    const current = placements.find((item) => item.id === placementId);
    if (!current) return;
    if (placementStage(current) === toStage) return;
    proposeStageMove(placementId, toStage);
  }

  const createForm = (
    <form className="ry-placement-create-form" onSubmit={(event) => void create(event)}>
      <Field label="Active Agreement">
        <Select required value={agreementId} onChange={(event) => { setAgreementId(event.target.value); setChannel(""); }} disabled={!canWrite}>
          <option value="">Select current authority</option>
          {agreements.map((item) => <option key={item.id} value={item.id}>{shown(item.brandName)} · {date(item.expiresAt)}</option>)}
        </Select>
      </Field>
      <Field label="Authorized channel">
        <Select required value={channel} onChange={(event) => setChannel(event.target.value)} disabled={!canWrite}>
          <option value="">Select channel</option>
          {Array.isArray(agreement?.agreement.channels) ? (agreement.agreement.channels as string[]).map((item) => <option key={item} value={item}>{item}</option>) : null}
        </Select>
      </Field>
      <Field label="Qualified Business Buyer">
        <Select required value={businessId} onChange={(event) => setBusinessId(event.target.value)} disabled={!canWrite}>
          <option value="">Select Business</option>
          {businesses.map((item) => <option key={item.id} value={item.id}>{shown(item.name)}</option>)}
        </Select>
      </Field>
      <Field label="Issued human decision">
        <Select required value={decisionId} onChange={(event) => setDecisionId(event.target.value)} disabled={!canWrite}>
          <option value="">Select decision</option>
          {business?.decisions.filter((item) => item.status === "issued").map((item) => <option key={item.id} value={String(item.id)}>{shown(item.outcome)}</option>)}
        </Select>
      </Field>
      <Field label="Match thesis"><TextArea required value={matchThesis} onChange={(event) => setMatchThesis(event.target.value)} disabled={!canWrite} /></Field>
      <Field label="Concrete Buyer value"><TextArea required value={buyerValue} onChange={(event) => setBuyerValue(event.target.value)} disabled={!canWrite} /></Field>
      {([
        ["brandValue", "Brand value"], ["brandObligations", "Brand obligations"], ["brandRisks", "Brand risks"],
        ["buyerObligations", "Buyer obligations"], ["buyerRisks", "Buyer risks"],
        ["representativeValue", "Representative value"], ["representativeObligations", "Representative obligations"],
        ["representativeRisks", "Representative risks"]
      ] as const).map(([key, label]) => (
        <Field key={key} label={label}>
          <TextArea required value={partyText[key]} onChange={(event) => setPartyText((current) => ({ ...current, [key]: event.target.value }))} disabled={!canWrite} />
        </Field>
      ))}
      <Checkbox
        label="I confirm that Brand, Business Buyer, and Representative can each receive legitimate value."
        checked={allValue}
        disabled={!canWrite}
        onChange={(event) => setAllValue(event.target.checked)}
      />
      <Button type="submit" loading={saving} disabled={!canWrite || !allValue}>Create Placement</Button>
    </form>
  );

  return (
    <div className="page ry-register-page ry-placement-page">
      <PageHeader
        eyebrow="Placement CRM"
        title="Placement Opportunities"
        description="Qualitative, evidence-led Product-to-Business work governed by current written authority and three-party value."
        action={canWrite
          ? <Button onClick={() => { setError(""); setCreateOpen(true); }}>Create Placement</Button>
          : <Button disabled>Read-only access</Button>}
      />
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}
      {!canWrite ? (
        <Alert tone="warning" className="ry-register-policy" title="Read-only Placement workspace">
          You may inspect permitted Placement Opportunities, but cannot create or move Placements in this session.
        </Alert>
      ) : null}

      {loading ? <LoadingState label="Loading placement work" /> : (
        <>
          <section className="ry-placement-summary" aria-label="Placement pipeline summary">
            <p><strong>{openCount}</strong> open · <strong>{stalledCount}</strong> stalled · <strong>{conflictCount}</strong> conflict review</p>
            <p className="ry-placement-summary-note">Counts reflect stored stages and server-computed stalled/conflict flags. They are not scores or forecasts.</p>
          </section>

          <section className="ry-register-surface" aria-label="Placement pipeline">
            <div className="ry-register-commandbar">
              <RegisterSavedViews
                recordType="placement_opportunity"
                filters={filters}
                sort={sort}
                canWrite={Boolean(canWrite)}
                onApply={(nextFilters, nextSort) => {
                  setFilters({ ...initialFilters, ...nextFilters });
                  setSort(nextSort);
                }}
              />
              <div className="ry-placement-view-switch" role="group" aria-label="Placement view">
                <ButtonGroup>
                  <Button variant={view === "table" ? "primary" : "secondary"} onClick={() => setView("table")}>Table</Button>
                  <Button variant={view === "kanban" ? "primary" : "secondary"} onClick={() => setView("kanban")}>Kanban</Button>
                </ButtonGroup>
              </div>
              <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
                <FilterBar>
                  <Field label="Search Brand or Business">
                    <SearchInput label="Search Brand or Business" controlSize="compact" value={String(filters.query ?? "")} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} />
                  </Field>
                  <Field label="Stage">
                    <Select controlSize="compact" value={String(filters.stage ?? "")} onChange={(event) => updateFilter("stage", event.target.value)}>
                      <option value="">All stages</option>
                      {[...pipelineBoardStages, "closed_lost", "disqualified"].map((item) => <option key={item} value={item}>{readable(item)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Conflict">
                    <Select controlSize="compact" value={String(filters.conflict ?? "")} onChange={(event) => updateFilter("conflict", event.target.value)}>
                      <option value="">All conflict states</option>
                      <option value="clear">Clear</option>
                      <option value="review_required">Review required</option>
                    </Select>
                  </Field>
                  <Field label="Stalled">
                    <Select controlSize="compact" value={String(filters.stalled ?? "")} onChange={(event) => updateFilter("stalled", event.target.value)}>
                      <option value="">Any</option>
                      <option value="yes">Stalled only</option>
                      <option value="no">Not stalled</option>
                    </Select>
                  </Field>
                </FilterBar>
              </RegisterFilterSheet>
            </div>
            <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => setFilters(initialFilters)} />
            <div className="ry-register-resultbar">
              <span>{sorted.length} Placement{sorted.length === 1 ? "" : "s"}</span>
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

            {sorted.length === 0 ? (
              <EmptyState
                title={activeFilters.length ? "No Placements match these filters" : undefined}
                description={activeFilters.length
                  ? "Clear one or more filters to return to the working Placement pipeline."
                  : "No Placement Opportunities. Create one only when authority and Buyer value are supportable."}
                action={activeFilters.length
                  ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button>
                  : (canWrite ? <Button onClick={() => setCreateOpen(true)}>Create Placement</Button> : undefined)}
              />
            ) : (
              <>
                <div className={view === "table" ? "ry-placement-table-view" : "ry-placement-table-view ry-placement-view-hidden"} hidden={view !== "table"}>
                  <Table caption="Placement Opportunities" compact={density === "compact"}>
                    <thead>
                      <tr>
                        {visibleColumns.has("brand") ? <SortableHeader field="brand" label="Brand" sort={sort} onSort={setSort} /> : null}
                        {visibleColumns.has("business") ? <SortableHeader field="business" label="Business" sort={sort} onSort={setSort} /> : null}
                        {visibleColumns.has("stage") ? <SortableHeader field="stage" label="Stage" sort={sort} onSort={setSort} /> : null}
                        {visibleColumns.has("conflict") ? <SortableHeader field="conflict" label="Authority / conflict" sort={sort} onSort={setSort} /> : null}
                        {visibleColumns.has("nextAction") ? <SortableHeader field="nextAction" label="Next action" sort={sort} onSort={setSort} /> : null}
                        <th scope="col" className="ry-register-cell-actions"><span className="sr-only">Review</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((item) => (
                        <DataRow key={item.id}>
                          {visibleColumns.has("brand") ? <td><strong>{shown(item.brandName)}</strong></td> : null}
                          {visibleColumns.has("business") ? <td>{shown(item.businessName)}</td> : null}
                          {visibleColumns.has("stage") ? (
                            <td>
                              <StatusLabel value={placementStage(item)} />
                              {item.stalled === true ? <span className="quiet-tag">stalled</span> : null}
                            </td>
                          ) : null}
                          {visibleColumns.has("conflict") ? <td><StatusLabel value={conflictStatus(item)} /></td> : null}
                          {visibleColumns.has("nextAction") ? <td>{shown(item.nextAction, "Not assigned")}</td> : null}
                          <td className="ry-register-cell-actions"><Link to={`/placements/${item.id}`}>Review</Link></td>
                        </DataRow>
                      ))}
                    </tbody>
                  </Table>
                </div>

                <div className={view === "kanban" ? "ry-placement-kanban" : "ry-placement-kanban ry-placement-view-hidden"} hidden={view !== "kanban"} aria-label="Placement Kanban board">
                  <p className="ry-placement-kanban-note">Dragging a card opens human stage review. The board does not move a Placement until the server accepts the transition.</p>
                  <div className="ry-placement-kanban-board">
                    {[...pipelineBoardStages, "closed_lost", "disqualified"].map((stage) => (
                      <section
                        key={stage}
                        className="ry-placement-kanban-column"
                        aria-label={`${readable(stage)} column`}
                        onDragOver={(event) => { if (canWrite) event.preventDefault(); }}
                        onDrop={(event) => onColumnDrop(event, stage)}
                      >
                        <header>
                          <h2>{readable(stage)}</h2>
                          <span>{(stageGroups.get(stage) ?? []).length}</span>
                        </header>
                        <ul>
                          {(stageGroups.get(stage) ?? []).map((item) => (
                            <li key={item.id}>
                              <article
                                className="ry-placement-kanban-card"
                                draggable={canWrite}
                                onDragStart={(event) => onCardDragStart(event, item.id)}
                                onDragEnd={() => setDragId("")}
                              >
                                <Link to={`/placements/${item.id}`}>
                                  <strong>{shown(item.brandName)} → {shown(item.businessName)}</strong>
                                  <span>{shown(item.nextAction, "No next action")}</span>
                                  <StatusLabel value={conflictStatus(item)} />
                                  {item.stalled === true ? <span className="quiet-tag">stalled</span> : null}
                                </Link>
                                {canWrite ? (
                                  <label className="ry-placement-kanban-move">
                                    <span className="sr-only">Propose stage for {shown(item.brandName)}</span>
                                    <Select
                                      controlSize="compact"
                                      value=""
                                      aria-label={`Propose stage for ${shown(item.brandName)} → ${shown(item.businessName)}`}
                                      onChange={(event) => {
                                        const next = event.target.value;
                                        if (next) proposeStageMove(item.id, next);
                                      }}
                                    >
                                      <option value="">Keyboard move…</option>
                                      {[...pipelineBoardStages, "closed_lost", "disqualified"].filter((itemStage) => itemStage !== placementStage(item)).map((itemStage) => (
                                        <option key={itemStage} value={itemStage}>{readable(itemStage)}</option>
                                      ))}
                                    </Select>
                                  </label>
                                ) : null}
                              </article>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>

                <div className="ry-placement-mobile-groups" aria-label="Stage-grouped Placement list">
                  {[...pipelineBoardStages, "closed_lost", "disqualified"].map((stage) => {
                    const rows = stageGroups.get(stage) ?? [];
                    if (!rows.length) return null;
                    return (
                      <section key={stage} className="ry-placement-mobile-group">
                        <header>
                          <h2>{readable(stage)}</h2>
                          <span>{rows.length}</span>
                        </header>
                        <RegisterMobileList label={`${readable(stage)} Placements`}>
                          {rows.map((item) => (
                            <RegisterMobileRow
                              key={item.id}
                              title={`${shown(item.brandName)} → ${shown(item.businessName)}`}
                              meta={`${readable(conflictStatus(item))} · ${shown(item.nextAction, "No next action")}${item.stalled === true ? " · stalled" : ""}`}
                              status={<StatusLabel value={placementStage(item)} />}
                              onOpen={() => void navigate(`/placements/${item.id}`)}
                              openLabel={`Review ${shown(item.brandName)} Placement`}
                            />
                          ))}
                        </RegisterMobileList>
                      </section>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <section className="panel ry-placement-create-inline" aria-label="Create a Placement Opportunity">
            <header className="ry-placement-section-heading">
              <p className="eyebrow">Human qualification</p>
              <h2>Create a Placement Opportunity</h2>
            </header>
            <p className="ry-placement-create-lead">Creation requires an active Agreement, qualified Business, issued human decision, and confirmed Relationship Triangle legitimacy. Prefer the create drawer on denser viewports.</p>
            {canWrite ? <Button variant="secondary" onClick={() => setCreateOpen(true)}>Open create drawer</Button> : null}
            <div className="ry-placement-create-inline-form">{createForm}</div>
          </section>
        </>
      )}

      <Drawer
        open={createOpen}
        title="Create a Placement Opportunity"
        description="Prerequisite-aware creation. Server validators recheck authority, qualified inputs, and Relationship Triangle value."
        onClose={() => setCreateOpen(false)}
        size="wide"
      >
        {createForm}
      </Drawer>
    </div>
  );
}
