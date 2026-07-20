import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { ErrorPanel, Field, Loading, PageHeader, StatusPill } from "../components";

type Kind = "product" | "brand" | "business";
type Row = Record<string, unknown> & { id: string; name: string; version: number };
type Detail = Record<string, unknown> & {
  product?: Row;
  brand?: Row;
  business?: Row;
  evidence: Row[];
  risks: Row[];
  decisions: Row[];
  unknowns: Row[];
};
type Source = { id: string; reference: string };
type SavedView = {
  id: string;
  name: string;
  recordType: string;
  definition: { filters: Array<{ field: string; value: unknown }> };
};

const configs = {
  product: {
    title: "Product Intelligence",
    description: "Evidence-led Product discovery, diligence, comparison, and human-owned qualification.",
    endpoint: "/api/intelligence/products",
    collection: "products",
    detail: "/products",
    statusKey: "status",
    views: ["discover", "watchlist", "under_review", "qualified", "rejected", "represented", "recently_updated"]
  },
  brand: {
    title: "Brand Intelligence",
    description: "A diligence pipeline that does not imply outreach permission or representation authority.",
    endpoint: "/api/intelligence/brands",
    collection: "brands",
    detail: "/brands",
    statusKey: "pipelineStage",
    views: ["", "discovered", "researching", "contact_ready", "rejected"]
  },
  business: {
    title: "Buyer Intelligence",
    description: "Business and Buyer research with explicit authority, fit, evidence, and conflict context.",
    endpoint: "/api/intelligence/businesses",
    collection: "businesses",
    detail: "/buyers",
    statusKey: "qualificationStatus",
    views: ["", "not_reviewed", "researching", "qualified", "conditional", "rejected"]
  }
} as const;

function shown(value: unknown, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return fallback;
}

function date(value: unknown): string {
  return typeof value === "string" && value ? new Date(value).toLocaleDateString() : "Not reviewed";
}

export function IntelligenceListPage({ kind }: { kind: Kind }) {
  const config = configs[kind];
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [view, setView] = useState(kind === "product" ? "discover" : "");
  const [risk, setRisk] = useState("");
  const [geography, setGeography] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [brandId, setBrandId] = useState("");
  const [brands, setBrands] = useState<Row[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [viewName, setViewName] = useState("");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  const load = useCallback(async (values?: { query?: string; view?: string; risk?: string; geography?: string }) => {
    setLoading(true);
    setError("");
    const next = {
      query: values?.query ?? query,
      view: values?.view ?? view,
      risk: values?.risk ?? risk,
      geography: values?.geography ?? geography
    };
    const params = new URLSearchParams();
    if (next.query) params.set("q", next.query);
    if (kind === "product") params.set("view", next.view || "discover");
    if (kind === "brand" && next.view) params.set("stage", next.view);
    if (kind === "business" && next.view) params.set("qualificationStatus", next.view);
    if (next.risk && kind !== "business") params.set("risk", next.risk);
    if (next.geography && kind === "business") params.set("geography", next.geography);
    try {
      const payload = await api<Record<string, unknown>>(`${config.endpoint}?${params}`);
      setRows((payload[config.collection] as Row[]) ?? []);
      setTotal(Number(payload.total ?? 0));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Intelligence records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [config, geography, kind, query, risk, view]);

  useEffect(() => {
    void load();
    void api<{ views: SavedView[] }>("/api/saved-views")
      .then((result) => setSavedViews(result.views.filter((item) => item.recordType === kind)))
      .catch(() => setSavedViews([]));
    if (kind === "product") {
      void api<{ records: Row[] }>("/api/records/brand").then((result) => setBrands(result.records)).catch(() => setBrands([]));
    }
  }, [kind, load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    const body =
      kind === "product"
        ? { name, brandId, category: extra, summary: "" }
        : kind === "brand"
          ? { name }
          : { name, businessType: extra, category: "General" };
    try {
      const result = await api<{ record: Row }>(`/api/records/${kind}`, { method: "POST", body });
      void navigate(`${config.detail}/${result.record.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Record could not be created.");
    }
  }

  async function saveView() {
    if (!viewName.trim()) return;
    try {
      await api("/api/saved-views", {
        method: "POST",
        body: {
          recordType: kind,
          name: viewName,
          definition: {
            filters: [
              ...(query ? [{ field: "name", operator: "contains", value: query }] : []),
              ...(view ? [{ field: config.statusKey, operator: "equals", value: view }] : []),
              ...(risk ? [{ field: "risk", operator: "equals", value: risk }] : []),
              ...(geography ? [{ field: "geography", operator: "contains", value: geography }] : [])
            ],
            sort: [{ field: "updatedAt", direction: "desc" }],
            layout: "table"
          },
          scope: "private"
        }
      });
      const result = await api<{ views: SavedView[] }>("/api/saved-views");
      setSavedViews(result.views.filter((item) => item.recordType === kind));
      setViewName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Saved view could not be created.");
    }
  }

  function applySaved(id: string) {
    const item = savedViews.find((candidate) => candidate.id === id);
    if (!item) return;
    const lookup = (field: string) => item.definition.filters.find((filter) => filter.field === field)?.value;
    const nextQuery = shown(lookup("name"), "");
    const nextView = shown(lookup(config.statusKey), "");
    const nextRisk = shown(lookup("risk"), "");
    const nextGeography = shown(lookup("geography"), "");
    setQuery(nextQuery); setView(nextView); setRisk(nextRisk); setGeography(nextGeography);
    void load({ query: nextQuery, view: nextView, risk: nextRisk, geography: nextGeography });
  }

  return (
    <div className="page intelligence-page">
      <PageHeader
        eyebrow="Phase 3 · Human decision required"
        title={config.title}
        description={config.description}
        action={kind === "product" && selected.length >= 2
          ? <Link className="primary-button" to={`/products/compare?ids=${selected.join(",")}`}>Compare {selected.length}</Link>
          : undefined}
      />
      {error ? <ErrorPanel message={error} /> : null}
      <section className="panel">
        <div className="view-controls intelligence-filters">
          <Field label="Search"><input value={query} onChange={(event) => setQuery(event.target.value)} /></Field>
          <Field label={kind === "product" ? "View" : kind === "brand" ? "Pipeline stage" : "Qualification"}>
            <select value={view} onChange={(event) => setView(event.target.value)}>
              {config.views.map((item) => <option key={item || "all"} value={item}>{item ? item.replaceAll("_", " ") : "All"}</option>)}
            </select>
          </Field>
          {kind !== "business" ? <Field label="Risk"><select value={risk} onChange={(event) => setRisk(event.target.value)}><option value="">All</option><option>low</option><option>medium</option><option>high</option><option>critical</option></select></Field> : null}
          {kind === "business" ? <Field label="Geography"><input value={geography} onChange={(event) => setGeography(event.target.value)} /></Field> : null}
          <button className="secondary-button" type="button" onClick={() => void load()}>Apply filters</button>
        </div>
        <div className="view-controls saved-view-row">
          <Field label="Saved view"><select defaultValue="" onChange={(event) => applySaved(event.target.value)}><option value="">Select…</option>{savedViews.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="New view name"><input value={viewName} onChange={(event) => setViewName(event.target.value)} /></Field>
          <button className="text-button" type="button" disabled={!viewName.trim()} onClick={() => void saveView()}>Save current filters</button>
        </div>
        <div className="section-heading"><h2>Working records</h2><span>{total} total</span></div>
        {loading ? <Loading label={`Loading ${config.title}`} /> : null}
        {!loading && rows.length === 0 ? <div className="empty-state"><h3>No records match this view</h3><p>Adjust the filters or create a record. Qualification remains a human action after evidence review.</p></div> : null}
        {!loading && rows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr>{kind === "product" ? <th>Compare</th> : null}<th>Name</th><th>Context</th><th>Status</th><th>Evidence gaps</th><th>Risk</th><th>Next action</th><th>Reviewed</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.id}>
                  {kind === "product" ? <td><input aria-label={`Compare ${row.name}`} type="checkbox" checked={selected.includes(row.id)} disabled={!selected.includes(row.id) && selected.length >= 4} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /></td> : null}
                  <td><Link to={`${config.detail}/${row.id}`}><strong>{row.name}</strong></Link><small>{shown(row.brandName ?? row.businessType ?? row.legalName)}</small></td>
                  <td>{shown(row.category ?? row.wholesaleStatus ?? row.geography)}</td>
                  <td><StatusPill value={shown(row[config.statusKey], "not reviewed")} /></td>
                  <td>{shown(row.unknownCount, "0")}</td>
                  <td>{shown(row.criticalRiskCount ?? row.riskCount, "0")} open</td>
                  <td>{shown(row.nextAction, "Not assigned")}</td>
                  <td>{date(row.lastReviewedAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
      </section>
      <section className="panel">
        <h2>Create a research record</h2>
        <p>New records begin unqualified. No imported or manually entered label creates authority.</p>
        <form className="form-grid" onSubmit={(event) => void create(event)}>
          <Field label="Name"><input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
          {kind === "product" ? <Field label="Brand"><select required value={brandId} onChange={(event) => setBrandId(event.target.value)}><option value="">Select…</option>{brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field> : null}
          {kind !== "brand" ? <Field label={kind === "product" ? "Category" : "Business type"}><input required value={extra} onChange={(event) => setExtra(event.target.value)} /></Field> : null}
          <div className="form-actions"><button className="primary-button">Create unqualified record</button></div>
        </form>
      </section>
    </div>
  );
}

const updateFields = {
  product: [
    ["wholesaleReadiness", "Wholesale readiness", ["not_reviewed", "not_ready", "conditional", "ready", "unknown"]],
    ["packagingReadiness", "Packaging readiness", ["not_reviewed", "not_ready", "conditional", "ready", "unknown"]],
    ["trendDirection", "Trend direction", ["rising", "stable", "declining", "volatile", "unknown"]],
    ["differentiation", "Differentiation", []],
    ["fulfillmentNotes", "Fulfillment notes", []]
  ],
  brand: [
    ["wholesaleStatus", "Wholesale status", ["unknown", "not_offered", "inquiry_required", "available", "restricted"]],
    ["communicationCondition", "Communication condition", ["not_reviewed", "concerning", "conditional", "professional"]],
    ["contactPurpose", "Professional contact purpose", []],
    ["operationsSummary", "Operations summary", []],
    ["stopFlag", "Stop flag", ["false", "true"]]
  ],
  business: [
    ["assortmentSummary", "Assortment summary", []],
    ["targetCustomerSummary", "Target customer", []],
    ["pricePositioning", "Price positioning", ["unknown", "value", "mid_market", "premium", "luxury", "mixed"]],
    ["fitRationale", "Fit rationale", []],
    ["currentVendorsSummary", "Current vendors", []]
  ]
} as const;

export function IntelligenceDetailPage({ kind }: { kind: Kind }) {
  const id = useParams().id ?? "";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [allProducts, setAllProducts] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [claim, setClaim] = useState("");
  const [evidenceClass, setEvidenceClass] = useState("unknown");
  const [sourceId, setSourceId] = useState("");
  const [fieldName, setFieldName] = useState<string>(updateFields[kind][0][0]);
  const [fieldValue, setFieldValue] = useState("");
  const [observationMetric, setObservationMetric] = useState("");
  const [observationValue, setObservationValue] = useState("");
  const [decisionOutcome, setDecisionOutcome] = useState("Investigate further");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextStatus, setNextStatus] = useState(kind === "brand" ? "researching" : "researching");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [matchProductId, setMatchProductId] = useState("");
  const [matchRationale, setMatchRationale] = useState("");
  const [buyerContactId, setBuyerContactId] = useState("");
  const [buyerContext, setBuyerContext] = useState("");
  const [recommendationCategory, setRecommendationCategory] = useState("");
  const [recommendationRationale, setRecommendationRationale] = useState("");

  const endpoint = `/api/intelligence/${kind === "business" ? "businesses" : `${kind}s`}/${id}`;
  const load = useCallback(async () => {
    setError("");
    try {
      const [payload, sourcePayload] = await Promise.all([
        api<Detail>(endpoint),
        api<{ sources: Source[] }>("/api/sources")
      ]);
      setDetail(payload);
      setSources(sourcePayload.sources);
      if (kind === "business") {
        const products = await api<{ records: Row[] }>("/api/records/product");
        setAllProducts(products.records);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The intelligence record could not be loaded.");
    }
  }, [endpoint, kind]);
  useEffect(() => { void load(); }, [load]);

  const record = detail?.[kind];
  const selectedField = updateFields[kind].find(([key]) => key === fieldName) ?? updateFields[kind][0];

  async function addEvidence(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const unknown = evidenceClass === "unknown";
    try {
      await api(`/api/records/${kind}/${id}/evidence`, {
        method: "POST",
        body: {
          exactClaim: claim, evidenceClass, verificationStatus: "reviewed",
          sourceId: unknown ? null : sourceId, unknownReason: unknown ? "Required evidence has not been obtained." : null,
          supports: unknown ? "" : claim, doesNotSupport: "", confidence: unknown ? "insufficient" : "limited",
          context: "Phase 3 intelligence review", limitations: "", contraryEvidence: "",
          permittedUse: "Internal qualification", prohibitedInference: "Do not present beyond the recorded support."
        }
      });
      setClaim(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Evidence could not be saved."); }
    finally { setBusy(false); }
  }

  async function updateIntelligence(event: FormEvent) {
    event.preventDefault();
    if (!record) return;
    const evidenceId = detail?.evidence[0]?.id;
    if (!evidenceId) { setError("Record evidence or an explicit Unknown record before updating a material field."); return; }
    let value: unknown = fieldValue;
    if (selectedField[0] === "stopFlag") value = fieldValue === "true";
    setBusy(true); setError("");
    try {
      await api(endpoint, {
        method: "PATCH",
        body: { version: record.version, changes: { [fieldName]: value }, evidenceByField: { [fieldName]: [evidenceId] }, origin: "human_confirmed" }
      });
      setFieldValue(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Intelligence could not be updated."); }
    finally { setBusy(false); }
  }

  async function addObservation(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api(`/api/intelligence/${kind}/${id}/observations`, {
        method: "POST",
        body: {
          metricCode: observationMetric, value: observationValue, evidenceClass,
          confidence: evidenceClass === "unknown" ? "insufficient" : "limited",
          sourceId: evidenceClass === "unknown" ? null : sourceId,
          unknownReason: evidenceClass === "unknown" ? "Observation is not yet available." : null,
          observedAt: evidenceClass === "unknown" ? null : new Date().toISOString(),
          acquisitionContext: "Human-entered Phase 3 research", limitations: "",
          origin: "user_entered"
        }
      });
      setObservationMetric(""); setObservationValue(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Observation could not be saved."); }
    finally { setBusy(false); }
  }

  async function decide(event: FormEvent) {
    event.preventDefault();
    if (!record) return;
    setBusy(true); setError("");
    try {
      const decision = await api<{ decision: { id: string } }>(`/api/records/${kind}/${id}/decisions`, {
        method: "POST",
        body: {
          question: `Should this ${kind} move to ${nextStatus.replaceAll("_", " ")}?`,
          scope: "Current evidence, risks, unknowns, and relationship value",
          outcome: decisionOutcome, rationale: decisionRationale, confidence: "limited",
          nextAction, status: "issued"
        }
      });
      let taskId: string | null = null;
      if (nextStatus !== "rejected") {
        const task = await api<{ task: { id: string } }>(`/api/records/${kind}/${id}/tasks`, {
          method: "POST",
          body: { title: nextAction, priority: "medium", createdReason: "Human qualification decision", mandatoryGate: true }
        });
        taskId = task.task.id;
      }
      const route = kind === "product" ? "status" : kind === "brand" ? "stage" : "qualification";
      const statusKey = kind === "product" ? "toStatus" : kind === "brand" ? "toStage" : "toStatus";
      await api(`${endpoint}/${route}`, {
        method: "POST",
        body: {
          version: record.version, [statusKey]: nextStatus, decisionId: decision.decision.id,
          nextActionTaskId: taskId,
          ...(kind === "brand" ? { reason: decisionRationale } : {})
        }
      });
      setDecisionRationale(""); setNextAction(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Human decision could not be applied."); }
    finally { setBusy(false); }
  }

  async function addContact(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api("/api/records/contact", {
        method: "POST",
        body: { parentType: kind, parentId: id, name: contactName, role: contactRole, email: contactEmail || undefined }
      });
      setContactName(""); setContactRole(""); setContactEmail(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Contact could not be added."); }
    finally { setBusy(false); }
  }

  async function markBrandIdentityReviewing() {
    if (!record || kind !== "brand") return;
    setBusy(true); setError("");
    try {
      await api(`/api/records/brand/${id}`, {
        method: "PATCH",
        body: { version: record.version, changes: { identityStatus: "reviewing" } }
      });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Brand identity review could not be started."); }
    finally { setBusy(false); }
  }

  async function createMatch(event: FormEvent) {
    event.preventDefault();
    const evidenceId = detail?.evidence[0]?.id;
    if (!evidenceId) { setError("Business evidence is required before recording a match."); return; }
    setBusy(true); setError("");
    try {
      await api("/api/intelligence/matches", {
        method: "POST",
        body: {
          productId: matchProductId, businessId: id,
          context: { channel: "physical retail", geography: shown(record?.geography, "not specified"), buyerType: shown(record?.business_type, "business buyer"), priceBand: shown(record?.price_positioning, "unknown"), period: "current" },
          rationale: matchRationale, confidence: "limited",
          materialStatements: [{ statement: matchRationale, classification: "human_judgment" }],
          evidenceIds: [evidenceId], missingEvidence: ["Product-side evidence must also be reviewed."],
          contraryEvidence: "", origin: "user_entered"
        }
      });
      setMatchRationale(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Match review could not be created."); }
    finally { setBusy(false); }
  }

  async function createBuyer(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api(`/api/businesses/${id}/buyers`, {
        method: "POST",
        body: {
          contactId: buyerContactId, buyerRole: "evaluator",
          decisionContext: buyerContext, authorityEvidence: null, authorityEvidenceId: null
        }
      });
      setBuyerContactId(""); setBuyerContext(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Buyer context could not be created."); }
    finally { setBusy(false); }
  }

  async function verifyBuyer(buyer: Row) {
    const evidenceId = detail?.evidence[0]?.id;
    if (!evidenceId) { setError("Record Business evidence describing purchasing authority before verifying a Buyer."); return; }
    setBusy(true); setError("");
    try {
      await api(`/api/businesses/${id}/buyers/${buyer.id}`, {
        method: "PATCH",
        body: {
          version: buyer.version, buyerRole: "decision_maker",
          decisionContext: shown(buyer.decisionContext, "Current category purchasing decision"),
          authorityEvidence: "Human reviewer linked the current Evidence Record to the stated decision context.",
          authorityEvidenceId: evidenceId, statedNeeds: shown(buyer.statedNeeds, ""),
          buyingWindow: shown(buyer.buyingWindow, ""), decisionProcess: shown(buyer.decisionProcess, ""),
          verificationStatus: "verified"
        }
      });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Buyer authority could not be verified."); }
    finally { setBusy(false); }
  }

  async function decideMatch(match: Row, status: "qualified" | "conditional" | "rejected") {
    setBusy(true); setError("");
    try {
      const decision = await api<{ decision: { id: string } }>(`/api/records/business/${id}/decisions`, {
        method: "POST",
        body: {
          question: `Does this Product fit the Business in the recorded context?`,
          scope: "Product–Business match evidence and explicit context",
          outcome: status, rationale: shown(match.rationale),
          confidence: shown(match.confidence, "limited"),
          nextAction: status === "rejected" ? "" : "Validate the remaining match evidence.",
          status: "issued"
        }
      });
      let taskId: string | null = null;
      if (status !== "rejected") {
        const task = await api<{ task: { id: string } }>(`/api/records/business/${id}/tasks`, {
          method: "POST",
          body: { title: "Validate the remaining match evidence", priority: "medium", createdReason: "Product match decision", mandatoryGate: true }
        });
        taskId = task.task.id;
      }
      await api(`/api/intelligence/matches/${match.id}`, {
        method: "PATCH",
        body: { version: match.version, status, decisionId: decision.decision.id, nextActionTaskId: taskId }
      });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Match decision could not be applied."); }
    finally { setBusy(false); }
  }

  async function createRecommendation(event: FormEvent) {
    event.preventDefault();
    const evidenceId = detail?.evidence[0]?.id;
    if (!evidenceId) { setError("Product evidence is required before recommending a Buyer category."); return; }
    setBusy(true); setError("");
    try {
      await api(`/api/intelligence/products/${id}/buyer-categories`, {
        method: "POST",
        body: {
          buyerCategory: recommendationCategory, rationale: recommendationRationale,
          confidence: "limited", evidenceIds: [evidenceId],
          missingEvidence: ["Confirm fit against a specific Business Buyer."],
          contraryEvidence: "", origin: "user_entered"
        }
      });
      setRecommendationCategory(""); setRecommendationRationale(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Recommendation could not be recorded."); }
    finally { setBusy(false); }
  }

  async function decideRecommendation(recommendation: Row, status: "confirmed" | "rejected") {
    setBusy(true); setError("");
    try {
      await api(`/api/intelligence/buyer-categories/${recommendation.id}`, {
        method: "PATCH", body: { version: recommendation.version, status }
      });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Recommendation decision could not be applied."); }
    finally { setBusy(false); }
  }

  if (!detail && !error) return <div className="page"><Loading label="Loading intelligence record" /></div>;
  if (!detail || !record) return <div className="page"><ErrorPanel message={error || "Record unavailable."} /></div>;
  const contacts = (detail.contacts as Row[] | undefined) ?? [];
  const matches = (detail.matches as Row[] | undefined) ?? [];
  const observations = (detail.observations as Row[] | undefined) ?? [];
  const recommendations = (detail.recommendations as Row[] | undefined) ?? [];
  const buyers = (detail.buyers as Row[] | undefined) ?? [];
  const status = shown(record.status ?? record.pipeline_stage ?? record.qualification_status, "not reviewed");

  return (
    <div className="page intelligence-page">
      <PageHeader
        eyebrow={`${kind} intelligence · ${shown(record.brand_name ?? record.business_type ?? record.identity_status)}`}
        title={shown(record.name ?? record.public_name)}
        description="Material fields remain evidence-linked. AI may organize or suggest future inputs, but qualification and authority are human-owned."
        action={<StatusPill value={status} />}
      />
      {error ? <ErrorPanel message={error} /> : null}
      <div className="metric-row">
        <div className="metric"><span>Current state</span><strong>{status.replaceAll("_", " ")}</strong><small>Human decision required to change</small>{kind === "brand" && record.identity_status === "unverified" ? <button disabled={busy} className="text-button" type="button" onClick={() => void markBrandIdentityReviewing()}>Start identity review</button> : null}</div>
        <div className="metric"><span>Evidence</span><strong>{detail.evidence.length}</strong><small>{detail.unknowns.length} explicit unknowns</small></div>
        <div className="metric"><span>Open risk</span><strong>{detail.risks.length}</strong><small>{detail.decisions.length} recorded decisions</small></div>
      </div>
      <div className="two-grid artifact-grid">
        <section className="panel">
          <h2>Intelligence and provenance</h2>
          <dl className="detail-list">
            {updateFields[kind].map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{shown(record[key] ?? record[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)])}</dd></div>)}
          </dl>
          <form onSubmit={(event) => void updateIntelligence(event)}>
            <Field label="Material field"><select value={fieldName} onChange={(event) => { setFieldName(event.target.value); setFieldValue(""); }}>{updateFields[kind].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
            <Field label="Reviewed value" hint="The newest Evidence Record below will be linked to this field.">
              {selectedField[2].length ? <select required value={fieldValue} onChange={(event) => setFieldValue(event.target.value)}><option value="">Select…</option>{selectedField[2].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select> : <textarea required rows={3} value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} />}
            </Field>
            <button disabled={busy} className="primary-button">Save evidence-linked field</button>
          </form>
        </section>
        <section className="panel">
          <h2>Evidence register</h2>
          {detail.evidence.length === 0 ? <div className="empty-state"><p>No evidence has been recorded. Begin with a sourced claim or an explicit Unknown.</p></div> : (
            <ul className="plain-list">{detail.evidence.map((item) => <li key={item.id}><span><strong>{shown(item.exactClaim)}</strong><small>{shown(item.sourceReference, shown(item.unknownReason))} · {date(item.observedAt)}</small><small>{shown(item.limitations, "No limitation recorded")}</small></span><StatusPill value={shown(item.evidenceClass)} /></li>)}</ul>
          )}
          <form onSubmit={(event) => void addEvidence(event)}>
            <Field label="Exact claim or unknown"><textarea required rows={3} value={claim} onChange={(event) => setClaim(event.target.value)} /></Field>
            <Field label="Classification"><select value={evidenceClass} onChange={(event) => setEvidenceClass(event.target.value)}><option value="unknown">Unknown</option><option value="verified_fact">Verified fact</option><option value="direct_evidence">Direct evidence</option><option value="strong_proxy">Strong proxy</option><option value="weak_proxy">Weak proxy</option><option value="estimate">Estimate</option><option value="assumption">Assumption</option></select></Field>
            {evidenceClass !== "unknown" ? <Field label="Source"><select required value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Select…</option>{sources.map((item) => <option key={item.id} value={item.id}>{item.reference}</option>)}</select></Field> : null}
            <button disabled={busy} className="secondary-button">Add evidence</button>
          </form>
        </section>
      </div>
      <div className="two-grid artifact-grid">
        <section className="panel">
          <h2>Time-bound observations</h2>
          <p>Observations keep acquisition context and never silently overwrite prior facts.</p>
          {observations.length ? <ul className="plain-list">{observations.map((item) => <li key={item.id}><span><strong>{shown(item.metricCode)}</strong><small>{shown(item.value)} · {shown(item.acquisitionContext)}</small></span><StatusPill value={shown(item.status)} /></li>)}</ul> : <p className="empty-state">No observations recorded.</p>}
          <form onSubmit={(event) => void addObservation(event)}>
            <Field label="Metric"><input required value={observationMetric} onChange={(event) => setObservationMetric(event.target.value)} /></Field>
            <Field label="Value"><input required value={observationValue} onChange={(event) => setObservationValue(event.target.value)} /></Field>
            <button disabled={busy} className="secondary-button">Record observation</button>
          </form>
        </section>
        <section className="panel">
          <h2>Human decision gate</h2>
          <p>The server rechecks evidence, risks, next action, and applicable authority before changing state.</p>
          <form onSubmit={(event) => void decide(event)}>
            <Field label="Decision outcome"><input required value={decisionOutcome} onChange={(event) => setDecisionOutcome(event.target.value)} /></Field>
            <Field label="Target state"><select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
              {(kind === "product" ? ["watchlist", "under_review", "qualified", "rejected", "represented"] : kind === "brand" ? ["researching", "contact_ready", "rejected", "authorized"] : ["researching", "conditional", "qualified", "rejected"]).map((item) => <option key={item}>{item}</option>)}
            </select></Field>
            <Field label="Rationale"><textarea required rows={4} value={decisionRationale} onChange={(event) => setDecisionRationale(event.target.value)} /></Field>
            {nextStatus !== "rejected" ? <Field label="Required next action"><input required value={nextAction} onChange={(event) => setNextAction(event.target.value)} /></Field> : null}
            <button disabled={busy} className="primary-button">Record and apply human decision</button>
          </form>
        </section>
      </div>
      {(kind === "brand" || kind === "business") ? (
        <div className="two-grid artifact-grid">
          <section className="panel">
            <h2>Professional contacts</h2>
            {contacts.length ? <ul className="plain-list">{contacts.map((item) => <li key={item.id}><span><Link to={`/contacts/${item.id}`}><strong>{item.name}</strong></Link><small>{shown(item.role)} · {shown(item.email)}</small></span><StatusPill value={shown(item.verificationStatus)} /></li>)}</ul> : <p className="empty-state">No professional contact route recorded.</p>}
            <form onSubmit={(event) => void addContact(event)}>
              <Field label="Name"><input required value={contactName} onChange={(event) => setContactName(event.target.value)} /></Field>
              <Field label="Role"><input required value={contactRole} onChange={(event) => setContactRole(event.target.value)} /></Field>
              <Field label="Professional email"><input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></Field>
              <button disabled={busy} className="secondary-button">Add unverified contact</button>
            </form>
          </section>
          <section className="panel">
            <h2>{kind === "business" ? "Product match reviews" : "Products and authority"}</h2>
            {kind === "business" ? (
              <>
                {matches.length ? <ul className="plain-list">{matches.map((item) => <li key={item.id}><span><strong>{shown(item.productName)}</strong><small>{shown(item.rationale)}</small><span className="button-row"><button disabled={busy || item.status !== "proposed"} className="text-button" type="button" onClick={() => void decideMatch(item, "qualified")}>Qualify match</button><button disabled={busy || item.status !== "proposed"} className="text-button" type="button" onClick={() => void decideMatch(item, "conditional")}>Conditional</button><button disabled={busy || item.status !== "proposed"} className="text-button danger-text" type="button" onClick={() => void decideMatch(item, "rejected")}>Reject</button></span></span><StatusPill value={shown(item.status)} /></li>)}</ul> : <p className="empty-state">No context-specific Product match reviewed.</p>}
                <form onSubmit={(event) => void createMatch(event)}>
                  <Field label="Product"><select required value={matchProductId} onChange={(event) => setMatchProductId(event.target.value)}><option value="">Select…</option>{allProducts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
                  <Field label="Fit rationale"><textarea required rows={4} value={matchRationale} onChange={(event) => setMatchRationale(event.target.value)} /></Field>
                  <button disabled={busy} className="secondary-button">Record proposed match</button>
                </form>
              </>
            ) : (
              <>
                <p><strong>Authority not established.</strong> A verified Representation Agreement is required before this Brand can be Authorized or Active.</p>
                <ul className="plain-list">{((detail.products as Row[] | undefined) ?? []).map((item) => <li key={item.id}><Link to={`/products/${item.id}`}>{item.name}</Link><StatusPill value={shown(item.status)} /></li>)}</ul>
              </>
            )}
          </section>
        </div>
      ) : null}
      {kind === "business" ? <section className="panel"><h2>Business Buyers and authority</h2>{buyers.length ? <ul className="plain-list">{buyers.map((item) => <li key={item.id}><span><strong>{shown(item.name)}</strong><small>{shown(item.buyerRole)} · {shown(item.decisionContext)}</small>{item.verificationStatus !== "verified" ? <button disabled={busy} className="text-button" type="button" onClick={() => void verifyBuyer(item)}>Verify as decision maker with current evidence</button> : null}</span><StatusPill value={shown(item.verificationStatus)} /></li>)}</ul> : <p className="empty-state">No Buyer context has been recorded.</p>}<form onSubmit={(event) => void createBuyer(event)}><Field label="Verified professional Contact"><select required value={buyerContactId} onChange={(event) => setBuyerContactId(event.target.value)}><option value="">Select…</option>{contacts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Decision context"><textarea required rows={3} value={buyerContext} onChange={(event) => setBuyerContext(event.target.value)} /></Field><button disabled={busy} className="secondary-button">Add unverified evaluator context</button></form></section> : null}
      {kind === "product" ? <section className="panel"><h2>Buyer-category and Business match review</h2>{recommendations.length === 0 && matches.length === 0 ? <p className="empty-state">No recommendations or context-specific matches have been recorded.</p> : null}<ul className="plain-list">{recommendations.map((item) => <li key={item.id}><span><strong>{shown(item.buyerCategory)}</strong><small>{shown(item.rationale)}</small>{item.status === "proposed" ? <span className="button-row"><button disabled={busy} className="text-button" type="button" onClick={() => void decideRecommendation(item, "confirmed")}>Confirm</button><button disabled={busy} className="text-button danger-text" type="button" onClick={() => void decideRecommendation(item, "rejected")}>Reject</button></span> : null}</span><StatusPill value={shown(item.status)} /></li>)}{matches.map((item) => <li key={item.id}><span><strong>{shown(item.businessName)}</strong><small>{shown(item.rationale)}</small></span><StatusPill value={shown(item.status)} /></li>)}</ul><form onSubmit={(event) => void createRecommendation(event)}><Field label="Buyer category"><input required value={recommendationCategory} onChange={(event) => setRecommendationCategory(event.target.value)} /></Field><Field label="Evidence-based rationale"><textarea required rows={3} value={recommendationRationale} onChange={(event) => setRecommendationRationale(event.target.value)} /></Field><button disabled={busy} className="secondary-button">Propose category for human review</button></form></section> : null}
    </div>
  );
}

export function ProductComparisonPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const comparisonId = useParams().comparisonId;
  const initialIds = new URLSearchParams(location.search).get("ids")?.split(",").filter(Boolean) ?? [];
  const [name, setName] = useState("Product diligence comparison");
  const [context, setContext] = useState({ category: "", geography: "", channel: "physical retail", buyerType: "", period: "current" });
  const [comparison, setComparison] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const products = (comparison?.products as Row[] | undefined) ?? [];
  useEffect(() => {
    if (comparisonId) void api<Record<string, unknown>>(`/api/intelligence/comparisons/${comparisonId}`).then(setComparison).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Comparison unavailable."));
  }, [comparisonId]);
  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api<Record<string, unknown>>("/api/intelligence/comparisons", { method: "POST", body: { name, productIds: initialIds, context } });
      const id = (result.comparison as { id?: string } | undefined)?.id;
      if (id) void navigate(`/products/comparisons/${id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Comparison could not be created."); }
  }
  if (!comparisonId) return <div className="page"><PageHeader eyebrow="Product Intelligence" title="Create comparison" description="Align two to four Products in one explicit context. No score or ranking is calculated." />{error ? <ErrorPanel message={error} /> : null}<section className="panel"><form className="form-grid" onSubmit={(event) => void create(event)}><Field label="Name"><input required value={name} onChange={(event) => setName(event.target.value)} /></Field>{(["category", "geography", "channel", "buyerType", "period"] as const).map((key) => <Field key={key} label={key.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}><input required={key === "channel" || key === "period"} value={context[key]} onChange={(event) => setContext((current) => ({ ...current, [key]: event.target.value }))} /></Field>)}<div className="form-actions"><button className="primary-button">Create aligned comparison</button></div></form></section></div>;
  if (!comparison && !error) return <div className="page"><Loading label="Loading comparison" /></div>;
  const header = comparison?.comparison as Row | undefined;
  return <div className="page"><PageHeader eyebrow="Product Intelligence · No numerical score" title={shown(header?.name, "Product comparison")} description="Unknowns remain Unknown. Evidence counts are not converted into rankings." />{error ? <ErrorPanel message={error} /> : null}<section className="panel table-wrap"><table><thead><tr><th>Product</th><th>Brand</th><th>Readiness</th><th>Trend</th><th>Evidence</th><th>Unknowns</th><th>Risk</th><th>Reviewed</th></tr></thead><tbody>{products.map((item) => <tr key={item.id}><td><Link to={`/products/${item.id}`}><strong>{item.name}</strong></Link></td><td>{shown(item.brandName)}</td><td>{shown(item.wholesaleReadiness)}</td><td>{shown(item.trendDirection)}</td><td>{shown(item.evidenceCount)}</td><td>{shown(item.unknownCount)}</td><td>{shown(item.riskCount)}</td><td>{date(item.lastReviewedAt)}</td></tr>)}</tbody></table></section><section className="panel"><h2>Interpretation limits</h2><ul>{((comparison?.limitations as string[] | undefined) ?? []).map((item) => <li key={item}>{item}</li>)}</ul></section></div>;
}

export function ContactIntelligencePage() {
  const id = useParams().id ?? "";
  const [context, setContext] = useState<{ record: Row } | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [notes, setNotes] = useState("");
  const [observedAt, setObservedAt] = useState(new Date().toISOString().slice(0, 16));
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [record, sourceList] = await Promise.all([api<{ record: Row }>(`/api/records/contact/${id}`), api<{ sources: Source[] }>("/api/sources")]);
      setContext(record); setSources(sourceList.sources);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Contact could not be loaded."); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!context) return;
    try {
      await api(`/api/contacts/${id}/verification`, { method: "PATCH", body: { version: context.record.version, status: "verified", sourceId, observedAt: new Date(observedAt).toISOString(), notes } });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Contact could not be verified."); }
  }
  if (!context && !error) return <div className="page"><Loading label="Loading Contact" /></div>;
  if (!context) return <div className="page"><ErrorPanel message={error} /></div>;
  return <div className="page"><PageHeader eyebrow="Buyer Intelligence · Human verification" title={context.record.name} description="AI and imports may suggest a Contact, but only a human can verify a professional route and its freshness." action={<StatusPill value={shown(context.record.verificationStatus)} />} />{error ? <ErrorPanel message={error} /> : null}<section className="panel"><dl className="detail-grid"><div><dt>Role</dt><dd>{shown(context.record.role)}</dd></div><div><dt>Email</dt><dd>{shown(context.record.email)}</dd></div><div><dt>Last verified</dt><dd>{date(context.record.lastVerifiedAt)}</dd></div></dl><form className="form-grid" onSubmit={(event) => void verify(event)}><Field label="Verification Source"><select required value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Select…</option>{sources.map((item) => <option key={item.id} value={item.id}>{item.reference}</option>)}</select></Field><Field label="Source observed at"><input type="datetime-local" required value={observedAt} onChange={(event) => setObservedAt(event.target.value)} /></Field><Field label="Human verification notes"><textarea required rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field><div className="form-actions"><button className="primary-button">Verify professional route</button></div></form></section></div>;
}
