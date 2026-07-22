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
  Field,
  FilterBar,
  Input,
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
import { date, readable, shown, type Row } from "./utils";

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
  const [channels, setChannels] = useState("independent_retail");
  const [territory, setTerritory] = useState("United States");
  const [objectives, setObjectives] = useState("");
  const [missingTerms, setMissingTerms] = useState("commission timing, termination rights");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "brand", direction: "asc" });
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [opportunityPayload, agreementPayload, brandPayload, contactPayload] = await Promise.all([
        api<{ opportunities: Row[] }>("/api/representation/opportunities"),
        api<{ agreements: Row[] }>("/api/agreements"),
        api<{ records: Row[] }>("/api/records/brand"),
        api<{ records: Row[] }>("/api/records/contact")
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
      return;
    }
    void api<RecordContext>(`/api/records/brand/${brandId}`)
      .then((value) => {
        setContext(value);
        setProductIds(value.related.map((item) => item.id));
        setDecisionId(String(value.decisions.find((item) => item.status === "issued")?.id ?? ""));
        setTaskId(String(value.tasks.find((item) => !["completed", "canceled"].includes(String(item.status)))?.id ?? ""));
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Brand context could not be loaded."));
  }, [brandId]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
    try {
      const result = await api<{ opportunity: Row }>("/api/representation/opportunities", {
        method: "POST",
        body: {
          brandId,
          brandContactId: contactId || null,
          productIds,
          proposedChannels: channels.split(",").map((item) => item.trim()).filter(Boolean),
          proposedTerritory: { description: territory },
          brandObjectives: objectives,
          termsSummary: "",
          missingTerms: missingTerms.split(",").map((item) => item.trim()).filter(Boolean),
          decisionId,
          nextActionTaskId: taskId
        }
      });
      void navigate(`/representation/${result.opportunity.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The opportunity could not be created.");
    } finally {
      setSaving(false);
    }
  }

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
  }

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((item) => {
      if (filters.query && !shown(item.brandName).toLowerCase().includes(filters.query.toLowerCase())) return false;
      if (filters.stage && shown(item.stage) !== filters.stage) return false;
      return true;
    });
  }, [opportunities, filters]);

  const sortedOpportunities = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filteredOpportunities].sort((left, right) => {
      const read = (row: Row, key: string) => {
        if (key === "brand") return shown(row.brandName);
        if (key === "stage") return shown(row.stage);
        if (key === "channels") return shown(row.proposedChannels);
        if (key === "nextAction") return shown(row.nextAction);
        return shown(row[key]);
      };
      return read(left, sort.field).localeCompare(read(right, sort.field)) * direction;
    });
  }, [filteredOpportunities, sort]);

  const activeAgreementCount = agreements.filter((item) => item.status === "active").length;
  const needsReviewCount = agreements.filter((item) => ["reviewing", "pending_approval"].includes(String(item.status))).length;
  const activeFilters = Object.entries(filters)
    .filter(([, value]) => value)
    .map(([id, value]) => ({
      id,
      label: `${id === "query" ? "Search" : readable(id)}: ${readable(String(value))}`
    }));

  return (
    <div className="page ry-register-page ry-representation-page">
      <PageHeader
        eyebrow="Authority workspace"
        title="Representation"
        description="Move from Brand diligence to written, human-approved authority without treating an uploaded agreement as permission."
        action={canWrite ? undefined : <Button disabled>Read-only access</Button>}
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
                  <Field label="Search Brand">
                    <SearchInput label="Search Brand" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} />
                  </Field>
                  <Field label="Stage">
                    <Select controlSize="compact" value={filters.stage} onChange={(event) => updateFilter("stage", event.target.value)}>
                      <option value="">All stages</option>
                      {["contact_ready", "contacted", "conversation", "reviewing_terms", "agreement_draft", "converted", "paused", "rejected"].map((item) => <option key={item} value={item}>{readable(item)}</option>)}
                    </Select>
                  </Field>
                </FilterBar>
              </RegisterFilterSheet>
            </div>
            <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => setFilters(initialFilters)} />
            <div className="ry-register-resultbar">
              <span>{filteredOpportunities.length} Opportunit{filteredOpportunities.length === 1 ? "y" : "ies"} · {activeAgreementCount} active Agreement{activeAgreementCount === 1 ? "" : "s"} · {needsReviewCount} need{needsReviewCount === 1 ? "s" : ""} review</span>
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
              <p className="eyebrow">Pipeline</p>
              <h2>Representation Opportunities</h2>
            </header>
            {sortedOpportunities.length === 0 ? (
              <EmptyState
                title={activeFilters.length ? "No Opportunities match these filters" : undefined}
                description={activeFilters.length ? "Clear one or more filters to return to the working Representation register." : "No Representation Opportunities yet. A Brand must be Contact Ready first."}
                action={activeFilters.length ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button> : undefined}
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
                      <th scope="col" className="ry-register-cell-actions"><span className="sr-only">Review</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOpportunities.map((item) => (
                      <DataRow key={item.id}>
                        {visibleColumns.has("brand") ? <td><strong>{shown(item.brandName)}</strong></td> : null}
                        {visibleColumns.has("stage") ? <td><StatusLabel value={String(item.stage)} /></td> : null}
                        {visibleColumns.has("channels") ? <td>{shown(item.proposedChannels)}</td> : null}
                        {visibleColumns.has("nextAction") ? <td>{shown(item.nextAction, "Not assigned")}</td> : null}
                        <td className="ry-register-cell-actions"><Link to={`/representation/${item.id}`}>Review</Link></td>
                      </DataRow>
                    ))}
                  </tbody>
                </Table>
                <RegisterMobileList label="Representation Opportunities">
                  {sortedOpportunities.map((item) => (
                    <RegisterMobileRow
                      key={item.id}
                      title={shown(item.brandName)}
                      meta={`${readable(shown(item.stage))} · ${shown(item.proposedChannels)} · ${shown(item.nextAction, "No next action")}`}
                      status={<StatusLabel value={String(item.stage)} />}
                      onOpen={() => void navigate(`/representation/${item.id}`)}
                      openLabel={`Review ${shown(item.brandName)} opportunity`}
                    />
                  ))}
                </RegisterMobileList>
              </>
            )}
          </section>

          <section className="panel ry-representation-agreements" aria-label="Representation Agreements">
            <header className="ry-representation-section-heading">
              <p className="eyebrow">Written authority</p>
              <h2>Representation Agreements</h2>
            </header>
            {agreements.length === 0 ? (
              <EmptyState description="No Agreements have been created." />
            ) : (
              <div className="ry-representation-agreement-grid">
                {agreements.map((item) => (
                  <Link className="ry-representation-agreement-card" key={item.id} to={`/agreements/${item.id}`}>
                    <span className="quiet-tag">{shown(item.brandName)}</span>
                    <h3>{shown(item.documentName, "Agreement draft")}</h3>
                    <StatusLabel value={String(item.status)} />
                    <small>{date(item.effectiveAt)} – {date(item.expiresAt)}</small>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="panel ry-representation-create" aria-label="Open a Representation Opportunity">
            <header className="ry-representation-section-heading">
              <p className="eyebrow">Human-owned decision</p>
              <h2>Open a Representation Opportunity</h2>
            </header>
            <form className="ry-representation-create-form" onSubmit={(event) => void create(event)}>
              <Field label="Contact Ready Brand">
                <Select required value={brandId} onChange={(event) => setBrandId(event.target.value)} disabled={!canWrite}>
                  <option value="">Select Brand</option>
                  {brands.filter((item) => item.pipelineStage === "contact_ready").map((item) => <option key={item.id} value={String(item.id)}>{String(item.name)}</option>)}
                </Select>
              </Field>
              <Field label="Verified Brand Contact">
                <Select value={contactId} onChange={(event) => setContactId(event.target.value)} disabled={!canWrite}>
                  <option value="">No Contact selected</option>
                  {contacts.filter((item) => item.brandId === brandId && ["verified", "stale"].includes(String(item.verificationStatus))).map((item) => <option key={item.id} value={String(item.id)}>{String(item.name)}</option>)}
                </Select>
              </Field>
              <fieldset className="field span-2 ry-representation-product-scope">
                <legend>Proposed Product scope</legend>
                {context?.related.length ? context.related.map((item) => (
                  <Checkbox
                    key={item.id}
                    label={String(item.name)}
                    checked={productIds.includes(item.id)}
                    disabled={!canWrite}
                    onChange={(event) => setProductIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
                  />
                )) : <small>Select a Brand with Products.</small>}
              </fieldset>
              <Field label="Proposed channels"><Input required value={channels} onChange={(event) => setChannels(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="Proposed territory"><Input required value={territory} onChange={(event) => setTerritory(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="Brand objectives"><TextArea required value={objectives} onChange={(event) => setObjectives(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="Known missing terms"><TextArea value={missingTerms} onChange={(event) => setMissingTerms(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="Issued Brand decision">
                <Select required value={decisionId} onChange={(event) => setDecisionId(event.target.value)} disabled={!canWrite}>
                  <option value="">Select decision</option>
                  {context?.decisions.filter((item) => item.status === "issued").map((item) => <option key={item.id} value={String(item.id)}>{shown(item.outcome)}</option>)}
                </Select>
              </Field>
              <Field label="Owned next action">
                <Select required value={taskId} onChange={(event) => setTaskId(event.target.value)} disabled={!canWrite}>
                  <option value="">Select task</option>
                  {context?.tasks.filter((item) => !["completed", "canceled"].includes(String(item.status))).map((item) => <option key={item.id} value={String(item.id)}>{shown(item.title)}</option>)}
                </Select>
              </Field>
              <div className="ry-representation-create-actions">
                <Button type="submit" loading={saving} disabled={!canWrite || productIds.length === 0}>Open opportunity</Button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
