import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { ErrorPanel, Field, Loading, PageHeader, StatusPill } from "../components";
import { BrandDetailPage, BrandRegisterPage } from "../redesign/brand";
import { ProductDetailPage, ProductRegisterPage } from "../redesign/product";

type RecordType = "brand" | "product" | "business" | "contact";
type CoreRecord = Record<string, unknown> & { id: string; name: string; version: number };
type SavedView = {
  id: string;
  name: string;
  recordType: string;
  definition: {
    layout: "list" | "card" | "table";
    filters: Array<{ field: string; value: unknown }>;
  };
};
type Context = {
  record: CoreRecord;
  related: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
  risks: Record<string, unknown>[];
  decisions: Record<string, unknown>[];
  notes: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  buyers?: Record<string, unknown>[];
};

const labels: Record<RecordType, string> = {
  brand: "Brands",
  product: "Products",
  business: "Businesses",
  contact: "Contacts"
};
const statuses: Record<RecordType, string[]> = {
  brand: ["discovered", "watchlist", "under_review", "qualified", "rejected", "represented", "archived"],
  product: ["discovered", "watchlist", "under_review", "qualified", "rejected", "represented", "archived"],
  business: ["research", "qualified", "active", "inactive", "closed", "archived"],
  contact: ["unverified", "verified", "stale", "disputed"]
};

function validType(value: string | undefined): value is RecordType {
  return value === "brand" || value === "product" || value === "business" || value === "contact";
}

function display(value: unknown, fallback = "—"): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : fallback;
}

export function RecordsPage() {
  const params = useParams();
  const type = validType(params.type) ? params.type : "brand";
  if (type === "product") {
    return (
      <ProductRegisterPage
        compatibility={{
          registerPath: "/records/product",
          detailPath: (recordId) => `/records/product/${recordId}`,
          showCompatibilityNotice: true
        }}
      />
    );
  }
  if (type === "brand") {
    return (
      <BrandRegisterPage
        compatibility={{
          registerPath: "/records/brand",
          detailPath: (recordId) => `/records/brand/${recordId}`,
          showCompatibilityNotice: true
        }}
      />
    );
  }
  return <GenericRecordsPage type={type} />;
}

function GenericRecordsPage({ type }: { type: Exclude<RecordType, "product" | "brand"> }) {
  const [records, setRecords] = useState<CoreRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [parentId, setParentId] = useState("");
  const [parents, setParents] = useState<CoreRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<"list" | "card" | "table">("list");
  const [viewName, setViewName] = useState("");
  const [views, setViews] = useState<SavedView[]>([]);
  const navigate = useNavigate();

  const load = useCallback(async (q = "", selectedStatus = "") => {
    setLoading(true);
    setError("");
    try {
      const payload = await api<{ records: CoreRecord[] }>(
        `/api/records/${type}?${new URLSearchParams({
          ...(q ? { q } : {}),
          ...(selectedStatus ? { status: selectedStatus } : {})
        }).toString()}`
      );
      setRecords(payload.records);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    setQuery("");
    setStatus("");
    setName("");
    setExtra("");
    setParentId("");
    void load();
    if (type === "contact") {
      void api<{ records: CoreRecord[] }>("/api/records/business")
        .then((result) => setParents(result.records))
        .catch(() => setParents([]));
    }
    void api<{ views: SavedView[] }>("/api/saved-views")
      .then((result) => setViews(result.views.filter((view) => view.recordType === type)))
      .catch(() => setViews([]));
  }, [load, type]);

  async function saveView() {
    if (!viewName) return;
    try {
      await api("/api/saved-views", {
        method: "POST",
        body: {
          recordType: type,
          name: viewName,
          definition: {
            filters: [
              ...(query ? [{ field: "name", operator: "contains" as const, value: query }] : []),
              ...(status ? [{ field: "status", operator: "equals" as const, value: status }] : [])
            ],
            sort: [{ field: "updatedAt", direction: "desc" }],
            layout
          },
          scope: "private"
        }
      });
      const result = await api<{ views: SavedView[] }>("/api/saved-views");
      setViews(result.views.filter((view) => view.recordType === type));
      setViewName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "View could not be saved.");
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    const body: Record<string, unknown> = { name };
    if (type === "business") Object.assign(body, { businessType: extra, category: "General" });
    if (type === "contact") Object.assign(body, { parentType: "business", parentId, role: extra });
    try {
      const result = await api<{ record: CoreRecord }>(`/api/records/${type}`, {
        method: "POST",
        body
      });
      void navigate(`/records/${type}/${result.record.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Record could not be created.");
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Connected record kernel"
        title={labels[type]}
        description={`Workspace-isolated ${type} records with provenance, decisions, risks, tasks, and immutable activity history.`}
      />
      <div className="split-grid records-layout">
        <section className="panel">
          <div className="section-heading"><h2>Records</h2><span>{records.length} shown</span></div>
          <form className="inline-search" onSubmit={(event) => { event.preventDefault(); void load(query, status); }}>
            <input aria-label={`Search ${labels[type]}`} value={query} onChange={(event) => setQuery(event.target.value)} />
            <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses[type].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
            <button className="secondary-button">Filter</button>
          </form>
          <div className="view-controls">
            <label>Layout <select value={layout} onChange={(event) => setLayout(event.target.value as "list" | "card" | "table")}><option value="list">List</option><option value="card">Cards</option><option value="table">Table</option></select></label>
            <label>Saved view <select defaultValue="" onChange={(event) => {
              const selected = views.find((view) => view.id === event.target.value);
              if (!selected) return;
              const savedQuery = selected.definition.filters.find((filter) => filter.field === "name")?.value;
              const savedStatus = selected.definition.filters.find((filter) => filter.field === "status")?.value;
              const nextQuery = typeof savedQuery === "string" ? savedQuery : "";
              const nextStatus = typeof savedStatus === "string" ? savedStatus : "";
              setLayout(selected.definition.layout); setQuery(nextQuery); setStatus(nextStatus);
              void load(nextQuery, nextStatus);
            }}><option value="">Select…</option>{views.map((view) => <option value={view.id} key={view.id}>{view.name}</option>)}</select></label>
            <label>New view name <input value={viewName} onChange={(event) => setViewName(event.target.value)} /></label>
            <button className="text-button" type="button" disabled={!viewName.trim()} onClick={() => void saveView()}>Save current view</button>
          </div>
          {loading ? <Loading /> : null}
          {error ? <ErrorPanel message={error} /> : null}
          {!loading && records.length === 0 ? <p className="empty-state">No {labels[type].toLowerCase()} yet. Create the first working record.</p> : null}
          {layout === "table" ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Context</th><th>Status</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td><Link to={`/records/${type}/${record.id}`}>{record.name}</Link></td><td>{display(record.category ?? record.role ?? record.legalName)}</td><td><StatusPill value={display(record.status ?? record.identityStatus ?? record.verificationStatus, "unverified")} /></td></tr>)}</tbody></table></div> :
          <div className={`record-list ${layout === "card" ? "record-cards" : ""}`}>
            {records.map((record) => <Link key={record.id} to={`/records/${type}/${record.id}`}><span><strong>{record.name}</strong><small>{display(record.category ?? record.role ?? record.legalName, "No secondary label")}</small></span><StatusPill value={display(record.status ?? record.identityStatus ?? record.verificationStatus, "unverified")} /></Link>)}
          </div>}
        </section>
        <section className="panel">
          <h2>Create {type}</h2>
          <p>Potential duplicates are checked before creation. No records are silently merged.</p>
          <form onSubmit={(event) => void create(event)}>
            <Field label="Name"><input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
            {type === "contact" ? (
              <Field label="Business">
                <select required value={parentId} onChange={(event) => setParentId(event.target.value)}>
                  <option value="">Select…</option>
                  {parents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
            ) : null}
            <Field label={type === "business" ? "Business type" : "Role"}>
              <input required value={extra} onChange={(event) => setExtra(event.target.value)} />
            </Field>
            <button className="primary-button">Create record</button>
          </form>
        </section>
      </div>
    </div>
  );
}

export function RecordDetailPage() {
  const params = useParams();
  const type = validType(params.type) ? params.type : "brand";
  if (type === "product") {
    return (
      <ProductDetailPage
        compatibility={{
          registerPath: "/records/product",
          detailPath: (recordId) => `/records/product/${recordId}`,
          showCompatibilityNotice: true
        }}
      />
    );
  }
  if (type === "brand") {
    return (
      <BrandDetailPage
        compatibility={{
          registerPath: "/records/brand",
          detailPath: (recordId) => `/records/brand/${recordId}`,
          showCompatibilityNotice: true
        }}
      />
    );
  }
  return <GenericRecordDetailPage type={type} id={params.id ?? ""} />;
}

function GenericRecordDetailPage({ type, id }: { type: Exclude<RecordType, "product" | "brand">; id: string }) {
  const [context, setContext] = useState<Context | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [task, setTask] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [claim, setClaim] = useState("");
  const [risk, setRisk] = useState("");
  const [decision, setDecision] = useState("");
  const [buyerContactId, setBuyerContactId] = useState("");
  const [buyerContext, setBuyerContext] = useState("");
  const [buyerRole, setBuyerRole] = useState("unknown");
  const [authorityEvidence, setAuthorityEvidence] = useState("");
  const [evidenceClass, setEvidenceClass] = useState("unknown");
  const [sources, setSources] = useState<Array<{ id: string; reference: string }>>([]);

  const load = useCallback(async () => {
    try {
      const [record, sourceResult] = await Promise.all([
        api<Context>(`/api/records/${type}/${id}`),
        api<{ sources: Array<{ id: string; reference: string }> }>("/api/sources")
      ]);
      setContext(record);
      setSources(sourceResult.sources);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Record could not be loaded.");
    }
  }, [id, type]);
  useEffect(() => { void load(); }, [load]);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/api/records/${type}/${id}/notes`, { method: "POST", body: { body: note, noteType: "general", pinned: false } });
      setNote(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Note could not be saved."); }
  }
  async function addTask(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/api/records/${type}/${id}/tasks`, { method: "POST", body: { title: task, priority: "medium", createdReason: "Manual follow-up", mandatoryGate: false } });
      setTask(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Task could not be saved."); }
  }
  async function addEvidence(event: FormEvent) {
    event.preventDefault();
    const unknown = evidenceClass === "unknown";
    try {
      await api(`/api/records/${type}/${id}/evidence`, {
        method: "POST",
        body: {
          exactClaim: claim, evidenceClass, verificationStatus: "reviewed",
          sourceId: unknown ? null : sourceId, unknownReason: unknown ? "Required evidence has not been obtained." : null,
          supports: unknown ? "" : claim, doesNotSupport: "", confidence: unknown ? "insufficient" : "limited",
          context: "", limitations: "", contraryEvidence: "", permittedUse: "Internal qualification",
          prohibitedInference: "Do not present beyond the recorded support."
        }
      });
      setClaim(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Evidence could not be saved."); }
  }
  async function addRisk(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/api/records/${type}/${id}/risks`, {
        method: "POST",
        body: { riskType: "commercial", severity: "medium", description: risk, mitigation: "" }
      });
      setRisk(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Risk could not be saved."); }
  }
  async function addDecision(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/api/records/${type}/${id}/decisions`, {
        method: "POST",
        body: {
          question: decision, scope: "Current record context", outcome: "Investigate further",
          rationale: "Additional evidence or human review is required.", confidence: "insufficient",
          nextAction: "Resolve the open evidence gaps.", status: "draft"
        }
      });
      setDecision(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Decision could not be saved."); }
  }
  async function addBuyer(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/api/businesses/${id}/buyers`, {
        method: "POST",
        body: {
          contactId: buyerContactId,
          buyerRole,
          decisionContext: buyerContext,
          authorityEvidence: authorityEvidence || null
        }
      });
      setBuyerContactId(""); setBuyerContext(""); setBuyerRole("unknown"); setAuthorityEvidence(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Business Buyer could not be saved."); }
  }

  const groups = useMemo(() => context ? [
    ["Evidence", context.evidence, "exact_claim"],
    ["Risks", context.risks, "description"],
    ["Decisions", context.decisions, "question"],
    ["Notes", context.notes, "body"],
    ["Tasks", context.tasks, "title"],
    ["Documents", context.documents, "name"],
    ["Timeline", context.activities, "summary"]
  ] as const : [], [context]);

  if (error && !context) return <div className="page"><ErrorPanel message={error} /></div>;
  if (!context) return <Loading label="Loading connected record" />;
  return (
    <div className="page">
      <PageHeader eyebrow={type} title={context.record.name} description="One connected context for provenance, human decisions, risks, work, and history." action={<StatusPill value={display(context.record.status, "active")} />} />
      {error ? <ErrorPanel message={error} /> : null}
      <section className="panel record-summary">
        {Object.entries(context.record).filter(([key]) => !["workspaceId", "customFields"].includes(key)).slice(0, 12).map(([key, value]) => (
          <div key={key}><small>{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).toLowerCase()}</small><strong>{display(value)}</strong></div>
        ))}
      </section>
      <section className="panel relationship-panel">
        <div className="section-heading"><h2>Relationships</h2><span>{context.related.length} connected</span></div>
        {context.related.length === 0 ? <p className="empty-state">No connected records yet.</p> : (
          <div className="record-list">{context.related.map((item) => <Link key={display(item.id)} to={`/records/${display(item.type)}/${display(item.id)}`}><span><strong>{display(item.name)}</strong><small>{display(item.type)}</small></span></Link>)}</div>
        )}
      </section>
      {type === "business" ? <section className="panel">
        <div className="section-heading"><h2>Business Buyers</h2><span>{context.buyers?.length ?? 0} qualified roles</span></div>
        <ul className="plain-list">{context.buyers?.map((buyer) => <li key={display(buyer.id)}><span><strong>{display(buyer.name)}</strong><small>{display(buyer.buyerRole)} · {display(buyer.decisionContext)}</small></span></li>)}</ul>
        <form className="form-grid" onSubmit={(event) => void addBuyer(event)}>
          <Field label="Business contact"><select required value={buyerContactId} onChange={(event) => setBuyerContactId(event.target.value)}><option value="">Select…</option>{context.related.filter((item) => item.type === "contact").map((item) => <option key={display(item.id)} value={display(item.id)}>{display(item.name)}</option>)}</select></Field>
          <Field label="Buyer role"><select value={buyerRole} onChange={(event) => setBuyerRole(event.target.value)}><option value="unknown">Unknown</option><option value="influencer">Influencer</option><option value="evaluator">Evaluator</option><option value="decision_maker">Decision maker</option><option value="authorized_purchaser">Authorized purchaser</option></select></Field>
          <Field label="Decision context"><input required value={buyerContext} onChange={(event) => setBuyerContext(event.target.value)} /></Field>
          <Field label="Authority evidence" hint="Required when claiming decision-making or purchasing authority."><input required={buyerRole === "decision_maker" || buyerRole === "authorized_purchaser"} value={authorityEvidence} onChange={(event) => setAuthorityEvidence(event.target.value)} /></Field>
          <div className="form-actions"><button className="secondary-button">Add Buyer role</button></div>
        </form>
      </section> : null}
      <div className="three-grid record-actions">
        <form className="panel" onSubmit={(event) => void addEvidence(event)}>
          <h2>Add evidence</h2>
          <Field label="Exact claim"><textarea required value={claim} onChange={(event) => setClaim(event.target.value)} /></Field>
          <Field label="Classification"><select value={evidenceClass} onChange={(event) => setEvidenceClass(event.target.value)}>
            {["verified_fact","direct_evidence","strong_proxy","weak_proxy","estimate","assumption","model_generated_inference","unknown"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
          </select></Field>
          {evidenceClass !== "unknown" ? <Field label="Source"><select required value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Select source…</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.reference}</option>)}</select></Field> : null}
          <button className="primary-button">Record evidence</button>
        </form>
        <form className="panel" onSubmit={(event) => void addNote(event)}><h2>Add note</h2><Field label="Note"><textarea required value={note} onChange={(event) => setNote(event.target.value)} /></Field><button className="primary-button">Add note</button></form>
        <form className="panel" onSubmit={(event) => void addTask(event)}><h2>Add task</h2><Field label="Required action"><input required value={task} onChange={(event) => setTask(event.target.value)} /></Field><button className="primary-button">Create task</button></form>
        <form className="panel" onSubmit={(event) => void addRisk(event)}><h2>Flag risk</h2><Field label="Risk description"><textarea required value={risk} onChange={(event) => setRisk(event.target.value)} /></Field><button className="primary-button">Record risk</button></form>
        <form className="panel" onSubmit={(event) => void addDecision(event)}><h2>Draft decision</h2><Field label="Decision question"><textarea required value={decision} onChange={(event) => setDecision(event.target.value)} /></Field><button className="primary-button">Save draft</button></form>
      </div>
      <div className="two-grid artifact-grid">
        {groups.map(([title, items, field]) => <section className="panel" key={title}><h2>{title}</h2>{items.length === 0 ? <p className="empty-state">Nothing recorded.</p> : <ul className="plain-list">{items.map((item) => <li key={display(item.id)}><span>{display(item[field], "Recorded event")}</span>{item.status ? <StatusPill value={display(item.status)} /> : null}</li>)}</ul>}</section>)}
      </div>
    </div>
  );
}
