import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
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
  RegisterCreateBlockHeader,
  RegisterCreateFooter,
  RegisterFilterSheet,
  RegisterMobileList,
  RegisterMobileRow,
  RegisterPagination,
  RegisterSavedViews,
  SortableHeader,
  type RegisterFilterValue,
  type RegisterSort
} from "../register/Register";
import { brandNameTitle } from "../brand/utils";
import {
  conflictStatus,
  authorityCheckLabel,
  conflictCheckLabel,
  statusChecksClear,
  nextActionLabel,
  displayName,
  displayNameTitle,
  displayBrand,
  displayBusiness,
  date,
  field,
  isTerminalStage,
  kanbanLaneForStage,
  kanbanLanes,
  kanbanMoveStages,
  pipelineBoardStages,
  placementStage,
  placementStageTone,
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
  { id: "conflict", label: "Status checks" },
  { id: "nextAction", label: "Next action" }
];

const PAGE_SIZE = 20;

function NextActionCell({ item }: { item: Row }) {
  const label = nextActionLabel(item);
  const empty = label === "Add next action";
  return (
    <Link
      className={`ry-placement-next-action${empty ? " is-empty" : ""}`}
      to={`/placements/${item.id}`}
      title={shown(item.nextAction, label)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  );
}

type ViewMode = "table" | "kanban";

const KANBAN_VISIBLE_CARDS = 5;
const PLACEMENT_VIEW_STORAGE_KEY = "ryva.placement.register.view";

function readStoredPlacementView(userId?: string): ViewMode {
  try {
    const key = userId ? `${PLACEMENT_VIEW_STORAGE_KEY}.${userId}` : PLACEMENT_VIEW_STORAGE_KEY;
    const saved = window.localStorage.getItem(key);
    if (saved === "table" || saved === "kanban") return saved;
    if (userId) {
      const shared = window.localStorage.getItem(PLACEMENT_VIEW_STORAGE_KEY);
      if (shared === "table" || shared === "kanban") return shared;
    }
  } catch {
    /* ignore storage failures */
  }
  return "table";
}

function writeStoredPlacementView(view: ViewMode, userId?: string) {
  try {
    const key = userId ? `${PLACEMENT_VIEW_STORAGE_KEY}.${userId}` : PLACEMENT_VIEW_STORAGE_KEY;
    window.localStorage.setItem(key, view);
  } catch {
    /* ignore storage failures */
  }
}

export function PlacementRegisterPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const userId = session?.user.id;
  const [placements, setPlacements] = useState<Row[]>([]);
  const [agreements, setAgreements] = useState<Row[]>([]);
  const [businesses, setBusinesses] = useState<Row[]>([]);
  const [agreementId, setAgreementId] = useState("");
  const [agreement, setAgreement] = useState<AgreementDetail | null>(null);
  const [eligibleBusinessIds, setEligibleBusinessIds] = useState<Set<string> | null>(null);
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
  const [view, setView] = useState<ViewMode>(() => readStoredPlacementView(userId));
  const [page, setPage] = useState(1);
  const [dragId, setDragId] = useState("");
  const [dropLaneId, setDropLaneId] = useState("");
  const [expandedLanes, setExpandedLanes] = useState<Record<string, boolean>>({});
  const dragGhostRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setView(readStoredPlacementView(userId));
  }, [userId]);

  function selectView(next: ViewMode) {
    setView(next);
    writeStoredPlacementView(next, userId);
  }

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
      setEligibleBusinessIds(null);
      return;
    }
    void api<AgreementDetail>(`/api/agreements/${agreementId}`)
      .then(setAgreement)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Agreement scope could not be loaded."));
  }, [agreementId]);

  useEffect(() => {
    const productIds = agreement?.products ?? [];
    if (!agreementId || productIds.length === 0) {
      setEligibleBusinessIds(agreementId ? new Set() : null);
      return;
    }
    let cancelled = false;
    void Promise.all(
      productIds.map((productId) =>
        api<{ matches: Row[] }>(`/api/intelligence/products/${productId}`)
          .then((result) => result.matches ?? [])
          .catch(() => [] as Row[])
      )
    ).then((groups) => {
      if (cancelled) return;
      const ids = new Set<string>();
      for (const matches of groups) {
        for (const match of matches) {
          if (["qualified", "conditional"].includes(String(match.status))) {
            ids.add(String(match.businessId));
          }
        }
      }
      setEligibleBusinessIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [agreementId, agreement?.products]);

  useEffect(() => {
    if (!businessId) {
      setBusiness(null);
      return;
    }
    if (eligibleBusinessIds && !eligibleBusinessIds.has(businessId)) {
      setBusinessId("");
      setDecisionId("");
      setBusiness(null);
      return;
    }
    void api<BusinessContext>(`/api/records/business/${businessId}`).then((value) => {
      setBusiness(value);
      setDecisionId(String(value.decisions.find((item) => item.status === "issued")?.id ?? ""));
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Buyer context could not be loaded."));
  }, [businessId, eligibleBusinessIds]);

  const agreementBusinesses = useMemo(() => {
    if (!agreementId || !eligibleBusinessIds) return [];
    return businesses.filter((item) => eligibleBusinessIds.has(String(item.id)));
  }, [agreementId, businesses, eligibleBusinessIds]);

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
      const haystack = `${displayBrand(item)} ${shown(item.brandName)} ${displayBusiness(item)} ${shown(item.businessName)} ${shown(item.nextAction)} ${placementStage(item)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [filters, placements]);

  const sorted = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) => {
      const value = (item: Row) => {
        if (sort.field === "business") return displayBusiness(item).toLowerCase();
        if (sort.field === "stage") return placementStage(item);
        if (sort.field === "conflict") return conflictStatus(item);
        if (sort.field === "nextAction") return nextActionLabel(item).toLowerCase();
        return displayBrand(item).toLowerCase();
      };
      return value(left).localeCompare(value(right)) * direction;
    });
  }, [filtered, sort]);

  useEffect(() => {
    setPage(1);
  }, [filters, sort.field, sort.direction]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = sorted.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(sorted.length, currentPage * PAGE_SIZE);
  const paged = useMemo(
    () => sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sorted, currentPage]
  );

  const activeFilters = Object.entries(filters)
    .filter(([, value]) => Boolean(value))
    .map(([id, value]) => ({
      id,
      label: `${id === "query" ? "Search" : readable(id)}: ${readable(String(value))}`
    }));

  const openCount = placements.filter((item) => !isTerminalStage(placementStage(item))).length;
  const stalledCount = placements.filter((item) => item.stalled === true).length;
  const conflictCount = placements.filter((item) => conflictStatus(item) !== "clear").length;

  const laneGroups = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const lane of kanbanLanes) {
      groups.set(lane.id, []);
    }
    for (const item of sorted) {
      const lane = kanbanLaneForStage(placementStage(item));
      const list = groups.get(lane.id) ?? [];
      list.push(item);
      groups.set(lane.id, list);
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

  function onCardDragStart(event: DragEvent<HTMLElement>, placementId: string) {
    if (!canWrite) return;
    setDragId(placementId);
    setDropLaneId("");
    event.dataTransfer.setData("text/plain", placementId);
    event.dataTransfer.effectAllowed = "move";
    const card = event.currentTarget.closest(".ry-placement-kanban-card");
    if (!(card instanceof HTMLElement)) return;
    dragGhostRef.current?.remove();
    const ghost = card.cloneNode(true) as HTMLElement;
    ghost.classList.add("is-drag-ghost");
    ghost.style.width = `${card.offsetWidth}px`;
    ghost.setAttribute("aria-hidden", "true");
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    const rect = card.getBoundingClientRect();
    event.dataTransfer.setDragImage(
      ghost,
      Math.min(Math.max(event.clientX - rect.left, 12), card.offsetWidth - 12),
      Math.min(Math.max(event.clientY - rect.top, 12), 28)
    );
  }

  function onCardDragEnd() {
    dragGhostRef.current?.remove();
    dragGhostRef.current = null;
    setDragId("");
    setDropLaneId("");
  }

  function onLaneDragOver(event: DragEvent, laneId: string) {
    if (!canWrite || !dragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropLaneId !== laneId) setDropLaneId(laneId);
  }

  function onLaneDragLeave(event: DragEvent<HTMLElement>, laneId: string) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    if (dropLaneId === laneId) setDropLaneId("");
  }

  function onLaneDrop(event: DragEvent, laneId: string) {
    event.preventDefault();
    const placementId = event.dataTransfer.getData("text/plain") || dragId;
    setDragId("");
    setDropLaneId("");
    if (!placementId || !canWrite) return;
    const current = placements.find((item) => item.id === placementId);
    if (!current) return;
    const lane = kanbanLanes.find((item) => item.id === laneId);
    if (!lane) return;
    const currentStage = placementStage(current);
    if ((lane.stages as readonly string[]).includes(currentStage)) return;
    proposeStageMove(placementId, lane.dropStage);
  }

  const issuedDecisions = business?.decisions.filter((item) => item.status === "issued") ?? [];
  const agreementChannels = Array.isArray(agreement?.agreement.channels)
    ? (agreement.agreement.channels as string[])
    : [];

  const createForm = (
    <form className="ry-placement-create-form ry-register-create-form" onSubmit={(event) => void create(event)}>
      <section className="ry-register-create-block">
        <RegisterCreateBlockHeader
          title="Authority and buyer"
          description="Choose an active agreement, authorized channel, qualified buyer, and buyer decision."
        />
        <div className="ry-placement-create-grid ry-register-create-grid">
        <div className="ry-placement-create-field">
          <Field label="Active Agreement">
            <Select
              required
              controlSize="compact"
              value={agreementId}
              onChange={(event) => { setAgreementId(event.target.value); setChannel(""); setBusinessId(""); setDecisionId(""); }}
              disabled={!canWrite || agreements.length === 0}
            >
              <option value="">{agreements.length === 0 ? "No active agreements" : "Select current authority"}</option>
              {agreements.map((item) => (
                <option key={item.id} value={item.id}>{displayBrand({ brandName: item.brandName })} · {date(item.expiresAt)}</option>
              ))}
            </Select>
          </Field>
          {agreements.length === 0 ? (
            <p className="ry-placement-create-hint ry-register-create-hint">
              Activate a representation agreement first, then return here.{" "}
              <Link className="ry-placement-create-hint-link ry-register-create-hint-link" to="/representation">Open representation</Link>
            </p>
          ) : null}
        </div>

        <div className="ry-placement-create-field">
          <Field label="Authorized channel">
            <Select
              required
              controlSize="compact"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              disabled={!canWrite || !agreementId || agreementChannels.length === 0}
            >
              <option value="">
                {!agreementId
                  ? "Select an agreement first"
                  : agreementChannels.length === 0
                    ? "No channels on agreement"
                    : "Select channel"}
              </option>
              {agreementChannels.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </Field>
        </div>

        <div className="ry-placement-create-field">
          <Field label="Qualified Business Buyer">
            <Select
              required
              controlSize="compact"
              value={businessId}
              onChange={(event) => setBusinessId(event.target.value)}
              disabled={!canWrite || !agreementId || agreementBusinesses.length === 0}
            >
              <option value="">
                {!agreementId
                  ? "Select an agreement first"
                  : eligibleBusinessIds == null
                    ? "Loading matched buyers…"
                    : agreementBusinesses.length === 0
                      ? "No matched businesses"
                      : "Select Business"}
              </option>
              {agreementBusinesses.map((item) => (
                <option key={item.id} value={item.id}>{displayName(item.name)}</option>
              ))}
            </Select>
          </Field>
          {agreementId && eligibleBusinessIds && agreementBusinesses.length === 0 ? (
            <p className="ry-placement-create-hint ry-register-create-hint">
              Only buyers with a qualified product match for this agreement’s products can be selected.{" "}
              <Link className="ry-placement-create-hint-link ry-register-create-hint-link" to="/buyers">Open buyers</Link>
            </p>
          ) : null}
        </div>

        <div className="ry-placement-create-field">
          <Field label="Buyer decision">
            <Select
              required
              controlSize="compact"
              value={decisionId}
              onChange={(event) => setDecisionId(event.target.value)}
              disabled={!canWrite || !businessId || issuedDecisions.length === 0}
            >
              <option value="">
                {!businessId
                  ? "Select a business first"
                  : issuedDecisions.length === 0
                    ? "No buyer decisions"
                    : "Select decision"}
              </option>
              {issuedDecisions.map((item) => (
                <option key={item.id} value={String(item.id)}>{shown(item.outcome)}</option>
              ))}
            </Select>
          </Field>
          {businessId && issuedDecisions.length === 0 ? (
            <p className="ry-placement-create-hint ry-register-create-hint">
              Add a buyer decision for this buyer first, then return here.{" "}
              <Link className="ry-placement-create-hint-link ry-register-create-hint-link" to={`/buyers/${businessId}`}>Open buyer</Link>
            </p>
          ) : null}
        </div>
        </div>
      </section>

      <section className="ry-register-create-block">
        <RegisterCreateBlockHeader
          title="Placement rationale"
          description="Capture why this opportunity makes sense for the buyer, brand, and representative."
        />
      <div className="ry-placement-create-grid ry-placement-create-notes ry-register-create-grid">
        <Field label="Why this buyer fits">
          <TextArea required rows={1} value={matchThesis} onChange={(event) => setMatchThesis(event.target.value)} disabled={!canWrite} />
        </Field>
        <Field label="Concrete Buyer value">
          <TextArea required rows={1} value={buyerValue} onChange={(event) => setBuyerValue(event.target.value)} disabled={!canWrite} />
        </Field>
        {([
          ["brandValue", "Brand value"], ["brandObligations", "Brand obligations"], ["brandRisks", "Brand risks"],
          ["buyerObligations", "Buyer obligations"], ["buyerRisks", "Buyer risks"],
          ["representativeValue", "Representative value"], ["representativeObligations", "Representative obligations"],
          ["representativeRisks", "Representative risks"]
        ] as const).map(([key, label]) => (
          <Field key={key} label={label}>
            <TextArea
              required
              rows={1}
              value={partyText[key]}
              onChange={(event) => setPartyText((current) => ({ ...current, [key]: event.target.value }))}
              disabled={!canWrite}
            />
          </Field>
        ))}
      </div>
      </section>

      <div className="ry-placement-create-footer">
        <Checkbox
          label="I confirm that Brand, Business Buyer, and Representative can each receive legitimate value."
          checked={allValue}
          disabled={!canWrite}
          onChange={(event) => setAllValue(event.target.checked)}
        />
        <RegisterCreateFooter className="ry-placement-create-actions">
          <Button type="button" variant="tertiary" size="compact" disabled={saving} onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button type="submit" size="compact" loading={saving} disabled={!canWrite || !allValue}>Create Placement</Button>
        </RegisterCreateFooter>
      </div>
    </form>
  );

  return (
    <div className="page ry-register-page ry-placement-page">
      <PageHeader
        title="Placement Opportunities"
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
            <p className="ry-placement-summary-note">Review active placement opportunities and resolve stalled or conflicting records.</p>
          </section>

          <section className="ry-register-surface" aria-label="Placement pipeline">
            <div className="ry-register-commandbar ry-placement-commandbar">
              <div className="ry-placement-commandbar-tools">
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
                  <button
                    type="button"
                    className={`ry-placement-view-option${view === "table" ? " is-active" : ""}`}
                    aria-pressed={view === "table"}
                    onClick={() => selectView("table")}
                  >
                    Table
                  </button>
                  <button
                    type="button"
                    className={`ry-placement-view-option${view === "kanban" ? " is-active" : ""}`}
                    aria-pressed={view === "kanban"}
                    onClick={() => selectView("kanban")}
                  >
                    Kanban
                  </button>
                </div>
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
              <span>
                {sorted.length === 0
                  ? "0 Placements"
                  : view === "table"
                    ? `${pageStart}–${pageEnd} of ${sorted.length} Placement${sorted.length === 1 ? "" : "s"}`
                    : `${sorted.length} Placement${sorted.length === 1 ? "" : "s"}`}
              </span>
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
                        {visibleColumns.has("conflict") ? <SortableHeader field="conflict" label="Status checks" sort={sort} onSort={setSort} /> : null}
                        {visibleColumns.has("nextAction") ? <SortableHeader field="nextAction" label="Next action" sort={sort} onSort={setSort} /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((item) => (
                        <DataRow
                          key={item.id}
                          className="ry-placement-row"
                          tabIndex={0}
                          aria-label={`Open ${displayBrand(item)} → ${displayBusiness(item)}`}
                          onClick={() => void navigate(`/placements/${item.id}`)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              void navigate(`/placements/${item.id}`);
                            }
                          }}
                        >
                          {visibleColumns.has("brand") ? (
                            <td><strong title={brandNameTitle(field(item, "brandName", "brand_name"))}>{displayBrand(item)}</strong></td>
                          ) : null}
                          {visibleColumns.has("business") ? (
                            <td title={displayNameTitle(field(item, "businessName", "business_name"))}>{displayBusiness(item)}</td>
                          ) : null}
                          {visibleColumns.has("stage") ? (
                            <td>
                              <StatusLabel
                                value={placementStage(item)}
                                label={readable(placementStage(item))}
                                tone={placementStageTone(placementStage(item))}
                              />
                            </td>
                          ) : null}
                          {visibleColumns.has("conflict") ? (
                            <td>
                              <span
                                className={`ry-placement-status-checks${statusChecksClear(item) ? " is-clear" : ""}`}
                              >
                                {authorityCheckLabel(item)}
                                <span aria-hidden="true"> · </span>
                                {conflictCheckLabel(item)}
                              </span>
                            </td>
                          ) : null}
                          {visibleColumns.has("nextAction") ? (
                            <td className="ry-placement-col-next"><NextActionCell item={item} /></td>
                          ) : null}
                        </DataRow>
                      ))}
                    </tbody>
                  </Table>
                  {sorted.length > PAGE_SIZE ? (
                    <RegisterPagination
                      page={currentPage}
                      pageCount={pageCount}
                      total={sorted.length}
                      pageSize={PAGE_SIZE}
                      onPage={setPage}
                    />
                  ) : null}
                </div>

                <div className={view === "kanban" ? "ry-placement-kanban" : "ry-placement-kanban ry-placement-view-hidden"} hidden={view !== "kanban"} aria-label="Placement Kanban board">
                  <p className="ry-placement-kanban-note">Drag a placement to another stage. Ryva will ask you to confirm the change before moving it.</p>
                  <div className="ry-placement-kanban-board">
                    {kanbanLanes.map((lane) => {
                      const rows = laneGroups.get(lane.id) ?? [];
                      const expanded = expandedLanes[lane.id] === true;
                      const visibleRows = expanded ? rows : rows.slice(0, KANBAN_VISIBLE_CARDS);
                      const hiddenCount = rows.length - visibleRows.length;
                      return (
                        <section
                          key={lane.id}
                          className={`ry-placement-kanban-column${dropLaneId === lane.id ? " is-drop-target" : ""}${dragId ? " is-droppable" : ""}`}
                          aria-label={`${lane.label} column`}
                          onDragOver={(event) => onLaneDragOver(event, lane.id)}
                          onDragLeave={(event) => onLaneDragLeave(event, lane.id)}
                          onDrop={(event) => onLaneDrop(event, lane.id)}
                        >
                          <header title={lane.description}>
                            <h2>
                              {lane.label}
                              <span className="ry-placement-kanban-count" aria-label={`${rows.length} placements`}>
                                {rows.length}
                              </span>
                            </h2>
                          </header>
                          <ul>
                            {visibleRows.map((item) => {
                              const stage = placementStage(item);
                              const authorityLabel = authorityCheckLabel(item);
                              const conflictLabel = conflictCheckLabel(item);
                              const authorityOk = shown(field(item, "agreementStatus", "agreement_status"), "") === "active";
                              const conflictOk = conflictStatus(item) === "clear";
                              const stalled = item.stalled === true;
                              const brand = displayBrand(item);
                              const business = displayBusiness(item);
                              const nextAction = nextActionLabel(item);
                              const showAuthority = !authorityOk;
                              const showConflict = !conflictOk;
                              const hasIndicators = stalled || showAuthority || showConflict;
                              const statusBits = [
                                stalled ? "Stalled" : "",
                                showAuthority ? authorityLabel : "",
                                showConflict ? conflictLabel : ""
                              ].filter(Boolean);
                              return (
                                <li key={item.id}>
                                  <article
                                    className={`ry-placement-kanban-card${dragId === item.id ? " is-dragging" : ""}`}
                                    aria-label={[`${brand} to ${business}`, nextAction, ...statusBits].filter(Boolean).join(". ")}
                                  >
                                    {canWrite ? (
                                      <span
                                        className="ry-placement-kanban-drag"
                                        draggable
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Drag ${brand} to ${business} to another lane`}
                                        title="Drag to another lane"
                                        onDragStart={(event) => {
                                          event.stopPropagation();
                                          onCardDragStart(event, item.id);
                                        }}
                                        onDragEnd={onCardDragEnd}
                                        onClick={(event) => event.preventDefault()}
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter" || event.key === " ") event.preventDefault();
                                        }}
                                      >
                                        <span aria-hidden="true" className="ry-placement-kanban-drag-glyph">⋮⋮</span>
                                      </span>
                                    ) : null}
                                    <div className="ry-placement-kanban-card-body">
                                      <div className="ry-placement-kanban-card-top">
                                        <div className="ry-placement-kanban-card-main">
                                          <span className="ry-placement-kanban-parties">
                                            <strong className="ry-placement-kanban-brand" title={brandNameTitle(field(item, "brandName", "brand_name")) || undefined}>
                                              {brand}
                                            </strong>
                                            <span className="ry-placement-kanban-business" title={displayNameTitle(field(item, "businessName", "business_name")) || undefined}>
                                              {business}
                                            </span>
                                          </span>
                                          <span className="ry-placement-kanban-next">{nextAction}</span>
                                        </div>
                                        <div className="ry-placement-kanban-card-actions">
                                          {canWrite ? (
                                            <details className="ry-placement-kanban-card-menu">
                                              <summary aria-label={`Move ${brand} to ${business} to a stage`}>
                                                <span aria-hidden="true" className="ry-placement-kanban-card-menu-glyph">···</span>
                                              </summary>
                                              <div className="ry-placement-kanban-card-menu-panel" role="menu">
                                                <p className="ry-placement-kanban-card-menu-label">Propose stage</p>
                                                {kanbanMoveStages.filter((itemStage) => itemStage !== stage).map((itemStage) => (
                                                  <button
                                                    key={itemStage}
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => proposeStageMove(item.id, itemStage)}
                                                  >
                                                    {readable(itemStage)}
                                                  </button>
                                                ))}
                                              </div>
                                            </details>
                                          ) : null}
                                          <Link
                                            to={`/placements/${item.id}`}
                                            className="ry-placement-kanban-open"
                                            aria-label={`Open ${brand} to ${business}`}
                                            title="Open placement"
                                          >
                                            <span aria-hidden="true">→</span>
                                          </Link>
                                        </div>
                                      </div>
                                      {hasIndicators ? (
                                        <div className="ry-placement-kanban-indicators" aria-label="Status checks">
                                          {stalled ? (
                                            <span className="ry-placement-kanban-ind is-stalled">Stalled</span>
                                          ) : null}
                                          {showAuthority ? (
                                            <span className="ry-placement-kanban-ind is-authority" title={authorityLabel}>
                                              {authorityLabel}
                                            </span>
                                          ) : null}
                                          {showConflict ? (
                                            <span className="ry-placement-kanban-ind is-conflict" title={conflictLabel}>
                                              {conflictLabel}
                                            </span>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  </article>
                                </li>
                              );
                            })}
                          </ul>
                          {hiddenCount > 0 ? (
                            <button
                              type="button"
                              className="ry-placement-kanban-more"
                              onClick={() => setExpandedLanes((current) => ({ ...current, [lane.id]: true }))}
                            >
                              Show {hiddenCount} more
                            </button>
                          ) : null}
                          {expanded && rows.length > KANBAN_VISIBLE_CARDS ? (
                            <button
                              type="button"
                              className="ry-placement-kanban-more"
                              onClick={() => setExpandedLanes((current) => ({ ...current, [lane.id]: false }))}
                            >
                              Show fewer
                            </button>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                </div>

                <div className="ry-placement-mobile-groups" aria-label="Stage-grouped Placement list">
                  {kanbanLanes.map((lane) => {
                    const rows = laneGroups.get(lane.id) ?? [];
                    if (!rows.length) return null;
                    return (
                      <section key={lane.id} className="ry-placement-mobile-group">
                        <header>
                          <h2>
                            {lane.label}
                            <span className="ry-placement-kanban-count" aria-label={`${rows.length} placements`}>
                              {rows.length}
                            </span>
                          </h2>
                        </header>
                        <RegisterMobileList label={`${lane.label} Placements`}>
                          {rows.map((item) => (
                            <RegisterMobileRow
                              key={item.id}
                              title={`${displayBrand(item)} → ${displayBusiness(item)}`}
                              meta={`${readable(placementStage(item))} · ${authorityCheckLabel(item)} · ${conflictCheckLabel(item)} · ${nextActionLabel(item)}${item.stalled === true ? " · stalled" : ""}`}
                              status={<StatusLabel value={placementStage(item)} label={readable(placementStage(item))} tone={placementStageTone(placementStage(item))} />}
                              onOpen={() => void navigate(`/placements/${item.id}`)}
                              openLabel={`Review ${displayBrand(item)} Placement`}
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
        </>
      )}

      <Drawer
        open={createOpen}
        title="Create a Placement Opportunity"
        description="Choose an active agreement, a qualified buyer, and a clear next step. Authority and three-party value are checked before this placement is saved."
        onClose={() => setCreateOpen(false)}
        size="wide"
      >
        {createForm}
      </Drawer>
    </div>
  );
}
