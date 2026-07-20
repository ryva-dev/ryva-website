import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { ErrorPanel, Field, Loading, PageHeader, StatusPill } from "../components";

type Row = Record<string, unknown> & { id: string; name?: string; version?: number };
type RecordContext = {
  record: Row;
  related: Row[];
  decisions: Row[];
  tasks: Row[];
};

function shown(value: unknown, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.join(", ") || fallback;
  return fallback;
}

function date(value: unknown): string {
  return typeof value === "string" && value ? new Date(value).toLocaleDateString() : "Not set";
}

export function RepresentationPage() {
  const navigate = useNavigate();
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

  const load = useCallback(async () => {
    setLoading(true);
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

  return (
    <div className="page">
      <PageHeader
        eyebrow="Authority workspace"
        title="Representation"
        description="Move from Brand diligence to written, human-approved authority without treating an uploaded agreement as permission."
      />
      {error ? <ErrorPanel message={error} /> : null}
      {loading ? <Loading label="Loading representation authority" /> : (
        <>
          <section className="metric-row">
            <article className="metric"><span>Opportunities</span><strong>{opportunities.length}</strong></article>
            <article className="metric"><span>Active agreements</span><strong>{agreements.filter((item) => item.status === "active").length}</strong></article>
            <article className="metric"><span>Needs review</span><strong>{agreements.filter((item) => ["reviewing", "pending_approval"].includes(String(item.status))).length}</strong></article>
          </section>
          <section className="panel">
            <div className="record-heading"><div><p className="eyebrow">Pipeline</p><h2>Representation Opportunities</h2></div></div>
            {opportunities.length === 0 ? <p className="empty">No Representation Opportunities yet. A Brand must be Contact Ready first.</p> : (
              <div className="table-wrap"><table><thead><tr><th>Brand</th><th>Stage</th><th>Channels</th><th>Next action</th><th /></tr></thead>
                <tbody>{opportunities.map((item) => <tr key={item.id}>
                  <td>{shown(item.brandName)}</td><td><StatusPill value={String(item.stage)} /></td>
                  <td>{shown(item.proposedChannels)}</td><td>{shown(item.nextAction)}</td>
                  <td><Link to={`/representation/${item.id}`}>Review</Link></td>
                </tr>)}</tbody>
              </table></div>
            )}
          </section>
          <section className="panel">
            <p className="eyebrow">Written authority</p><h2>Representation Agreements</h2>
            {agreements.length === 0 ? <p className="empty">No Agreements have been created.</p> : (
              <div className="card-grid">{agreements.map((item) => <Link className="record-card" key={item.id} to={`/agreements/${item.id}`}>
                <span className="quiet-tag">{shown(item.brandName)}</span><h3>{shown(item.documentName, "Agreement draft")}</h3>
                <StatusPill value={String(item.status)} /><small>{date(item.effectiveAt)} – {date(item.expiresAt)}</small>
              </Link>)}</div>
            )}
          </section>
          <section className="panel">
            <p className="eyebrow">Human-owned decision</p><h2>Open a Representation Opportunity</h2>
            <form className="form-grid" onSubmit={(event) => void create(event)}>
              <Field label="Contact Ready Brand"><select required value={brandId} onChange={(event) => setBrandId(event.target.value)}>
                <option value="">Select Brand</option>{brands.filter((item) => item.pipelineStage === "contact_ready").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></Field>
              <Field label="Verified Brand Contact"><select value={contactId} onChange={(event) => setContactId(event.target.value)}>
                <option value="">No Contact selected</option>{contacts.filter((item) => item.brandId === brandId && ["verified", "stale"].includes(String(item.verificationStatus))).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></Field>
              <fieldset className="field span-2"><legend>Proposed Product scope</legend>
                {context?.related.length ? context.related.map((item) => <label className="check-row" key={item.id}><input type="checkbox" checked={productIds.includes(item.id)} onChange={(event) => setProductIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />{item.name}</label>) : <small>Select a Brand with Products.</small>}
              </fieldset>
              <Field label="Proposed channels"><input required value={channels} onChange={(event) => setChannels(event.target.value)} /></Field>
              <Field label="Proposed territory"><input required value={territory} onChange={(event) => setTerritory(event.target.value)} /></Field>
              <Field label="Brand objectives"><textarea required value={objectives} onChange={(event) => setObjectives(event.target.value)} /></Field>
              <Field label="Known missing terms"><textarea value={missingTerms} onChange={(event) => setMissingTerms(event.target.value)} /></Field>
              <Field label="Issued Brand decision"><select required value={decisionId} onChange={(event) => setDecisionId(event.target.value)}>
                <option value="">Select decision</option>{context?.decisions.filter((item) => item.status === "issued").map((item) => <option key={item.id} value={item.id}>{shown(item.outcome)}</option>)}
              </select></Field>
              <Field label="Owned next action"><select required value={taskId} onChange={(event) => setTaskId(event.target.value)}>
                <option value="">Select task</option>{context?.tasks.filter((item) => !["completed", "canceled"].includes(String(item.status))).map((item) => <option key={item.id} value={item.id}>{shown(item.title)}</option>)}
              </select></Field>
              <div className="button-row span-2"><button className="primary-button" disabled={saving || productIds.length === 0}>{saving ? "Opening…" : "Open opportunity"}</button></div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}

type OpportunityDetail = {
  opportunity: Row;
  products: Row[];
  events: Row[];
  documents: Row[];
};

export function RepresentationDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [context, setContext] = useState<RecordContext | null>(null);
  const [stage, setStage] = useState("reviewing_terms");
  const [reason, setReason] = useState("");
  const [decisionId, setDecisionId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const value = await api<OpportunityDetail>(`/api/representation/opportunities/${id}`);
      setDetail(value);
      const brandContext = await api<RecordContext>(`/api/records/brand/${shown(value.opportunity.brandId)}`);
      setContext(brandContext);
      setDecisionId(String(brandContext.decisions.find((item) => item.status === "issued")?.id ?? ""));
      setTaskId(String(brandContext.tasks.find((item) => !["completed", "canceled"].includes(String(item.status)))?.id ?? ""));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Opportunity could not be loaded.");
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function upload() {
    if (!file || !detail) return;
    setSaving(true);
    setError("");
    try {
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))]
        .map((value) => value.toString(16).padStart(2, "0")).join("");
      const created = await api<{ document: Row; upload: { url: string } }>("/api/documents", {
        method: "POST",
        body: {
          subjectType: "representation_opportunity", subjectId: detail.opportunity.id,
          name: file.name, documentType: "representation_agreement_original",
          mediaType: file.type || "application/pdf", byteSize: file.size, sha256: digest,
          confidentiality: "restricted"
        }
      });
      await api(created.upload.url, { method: "PUT", headers: { "content-type": file.type || "application/pdf" }, body: file });
      setFile(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Agreement original could not be uploaded.");
    } finally {
      setSaving(false);
    }
  }

  async function transition(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setSaving(true);
    try {
      await api(`/api/representation/opportunities/${id}/stage`, {
        method: "POST",
        body: { version: detail.opportunity.version, toStage: stage, reason, decisionId, nextActionTaskId: stage === "rejected" ? null : taskId }
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stage could not be changed.");
    } finally { setSaving(false); }
  }

  async function createAgreementFromOriginal(documentId: string) {
    setSaving(true);
    try {
      const result = await api<{ agreement: Row }>("/api/agreements", {
        method: "POST", body: { representationOpportunityId: id, sourceDocumentId: documentId }
      });
      void navigate(`/agreements/${result.agreement.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agreement could not be created.");
    } finally { setSaving(false); }
  }

  if (!detail && !error) return <Loading label="Loading Representation Opportunity" />;
  return <div className="page">
    <PageHeader eyebrow="Representation Opportunity" title={shown(detail?.opportunity.brandName, "Representation review")} description="Written terms, original documents, decisions, and next actions remain connected and auditable." />
    {error ? <ErrorPanel message={error} /> : null}
    {detail ? <>
      <section className="metric-row">
        <article className="metric"><span>Stage</span><StatusPill value={String(detail.opportunity.stage)} /></article>
        <article className="metric"><span>Products</span><strong>{detail.products.length}</strong></article>
        <article className="metric"><span>Originals</span><strong>{detail.documents.length}</strong></article>
      </section>
      <section className="panel"><h2>Proposed scope</h2>
        <dl className="detail-grid"><div><dt>Products</dt><dd>{detail.products.map((item) => item.name).join(", ")}</dd></div>
          <div><dt>Channels</dt><dd>{shown(detail.opportunity.proposedChannels)}</dd></div>
          <div><dt>Territory</dt><dd>{JSON.stringify(detail.opportunity.proposedTerritory)}</dd></div>
          <div><dt>Missing terms</dt><dd>{shown(detail.opportunity.missingTerms)}</dd></div></dl>
      </section>
      <section className="panel"><p className="eyebrow">Immutable evidence</p><h2>Agreement original</h2>
        <p>Uploading does not create authority. The original remains quarantined until the configured scanner marks it clean.</p>
        <div className="button-row"><input aria-label="Agreement original" type="file" accept=".pdf,.docx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <button className="secondary-button" type="button" disabled={!file || saving} onClick={() => void upload()}>Upload original</button></div>
        {detail.documents.map((item) => <div className="list-row" key={item.id}><span><strong>{item.name}</strong><small>{shown(item.sha256)}</small></span>
          <StatusPill value={`${shown(item.status)}_${shown(item.scanStatus)}`} />
          {item.status === "active" && item.scanStatus === "clean" ? <button className="text-button" disabled={saving} onClick={() => void createAgreementFromOriginal(item.id)}>Create Agreement</button> : null}</div>)}
      </section>
      <section className="panel"><h2>Change stage</h2><form className="form-grid" onSubmit={(event) => void transition(event)}>
        <Field label="Stage"><select value={stage} onChange={(event) => setStage(event.target.value)}>
          {["contact_ready","contacted","conversation","reviewing_terms","agreement_draft","paused","rejected"].map((item) => <option key={item}>{item}</option>)}
        </select></Field>
        <Field label="Human decision"><select required value={decisionId} onChange={(event) => setDecisionId(event.target.value)}>
          <option value="">Select</option>{context?.decisions.filter((item) => item.status === "issued").map((item) => <option key={item.id} value={item.id}>{shown(item.outcome)}</option>)}
        </select></Field>
        <Field label="Next action"><select required={stage !== "rejected"} value={taskId} onChange={(event) => setTaskId(event.target.value)}>
          <option value="">Select</option>{context?.tasks.filter((item) => !["completed","canceled"].includes(String(item.status))).map((item) => <option key={item.id} value={item.id}>{shown(item.title)}</option>)}
        </select></Field>
        <Field label="Reason"><textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
        <button className="primary-button" disabled={saving}>Record stage</button>
      </form></section>
      <section className="panel"><h2>History</h2>{detail.events.map((item, index) => <div className="timeline-item" key={`${shown(item.occurredAt)}-${index}`}><StatusPill value={String(item.toStage)} /><p>{shown(item.reason)}</p><small>{date(item.occurredAt)}</small></div>)}</section>
    </> : null}
  </div>;
}

type AgreementDetail = {
  agreement: Row;
  products: string[];
  restrictions: Row[];
  candidates: Row[];
  versions: Row[];
  authorityDigest: string;
};

export function AgreementDetailPage() {
  const { id = "" } = useParams();
  const [detail, setDetail] = useState<AgreementDetail | null>(null);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [candidateField, setCandidateField] = useState("commissionBasis");
  const [candidateValue, setCandidateValue] = useState("");
  const [sourceLocation, setSourceLocation] = useState("");
  const [ambiguous, setAmbiguous] = useState(false);
  const [approvalId, setApprovalId] = useState("");
  const [businesses, setBusinesses] = useState<Row[]>([]);
  const [restrictionType, setRestrictionType] = useState("house_account_exclusion");
  const [restrictionBusinessId, setRestrictionBusinessId] = useState("");
  const [restrictionLocation, setRestrictionLocation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try { setDetail(await api<AgreementDetail>(`/api/agreements/${id}`)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Agreement could not be loaded."); }
  }, [id]);
  useEffect(() => {
    void load();
    void api<{ records: Row[] }>("/api/records/business")
      .then((result) => setBusinesses(result.records))
      .catch(() => setBusinesses([]));
  }, [load]);

  async function saveTerms(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setSaving(true); setError("");
    try {
      const normalized: Record<string, unknown> = { ...changes };
      if (changes.channels) normalized.channels = changes.channels.split(",").map((item) => item.trim()).filter(Boolean);
      if (changes.territoryScope) normalized.territoryScope = { description: changes.territoryScope };
      if (changes.commissionRate) normalized.commissionRate = Number(changes.commissionRate) / 100;
      await api(`/api/agreements/${id}`, { method: "PATCH", body: { version: detail.agreement.version, changes: normalized } });
      setChanges({}); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Terms could not be saved."); }
    finally { setSaving(false); }
  }

  async function proposeCandidate(event: FormEvent) {
    event.preventDefault();
    if (!detail?.agreement.sourceDocumentId) return;
    setSaving(true);
    try {
      await api(`/api/agreements/${id}/term-candidates`, { method: "POST", body: {
        sourceDocumentId: detail.agreement.sourceDocumentId, fieldName: candidateField,
        proposedValue: candidateValue, sourceLocation, evidenceExcerpt: "",
        evidenceClass: "direct_evidence", confidence: "supported", origin: "user_entered",
        material: true, ambiguous, specialistReviewRequired: ambiguous
      } });
      setCandidateValue(""); setSourceLocation(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Candidate could not be recorded."); }
    finally { setSaving(false); }
  }

  async function reviewCandidate(item: Row, decision: "confirmed" | "rejected") {
    setSaving(true);
    try {
      await api(`/api/agreement-term-candidates/${item.id}`, { method: "PATCH", body: {
        version: item.version, decision, reviewNotes: `Human ${decision} after comparing the cited original.`
      } });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Candidate review failed."); }
    finally { setSaving(false); }
  }

  async function requestApproval() {
    setSaving(true);
    try {
      const result = await api<{ approval: Row }>(`/api/agreements/${id}/approval`, {
        method: "POST", body: { scope: "Current written Product, channel, territory, account, commission, and termination terms only." }
      });
      setApprovalId(result.approval.id); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Approval could not be requested."); }
    finally { setSaving(false); }
  }

  async function activate() {
    setSaving(true);
    try {
      await api(`/api/agreements/${id}/activate`, {
        method: "POST", body: { approvalId, decision: "approved", conditions: "Authority limited to the reviewed written scope." }
      });
      setApprovalId(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Agreement could not be activated."); }
    finally { setSaving(false); }
  }

  async function end(status: "suspended" | "ended") {
    if (!detail) return;
    setSaving(true);
    try {
      await api(`/api/agreements/${id}/status`, {
        method: "POST", body: { version: detail.agreement.version, status, reason: `Human recorded ${status} authority after reviewing current contractual status.` }
      });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Agreement status could not be changed."); }
    finally { setSaving(false); }
  }

  async function addRestriction(event: FormEvent) {
    event.preventDefault();
    if (!detail?.agreement.sourceDocumentId || !restrictionBusinessId) return;
    const business = businesses.find((item) => item.id === restrictionBusinessId);
    setSaving(true);
    try {
      await api(`/api/agreements/${id}/account-restrictions`, {
        method: "POST",
        body: {
          restrictionType, businessId: restrictionBusinessId,
          accountName: shown(business?.name), productIds: detail.products,
          channels: Array.isArray(detail.agreement.channels) ? detail.agreement.channels : [],
          territoryScope: detail.agreement.territoryScope ?? {},
          sourceDocumentId: detail.agreement.sourceDocumentId,
          sourceLocation: restrictionLocation
        }
      });
      setRestrictionBusinessId(""); setRestrictionLocation(""); await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Written account restriction could not be recorded.");
    } finally { setSaving(false); }
  }

  if (!detail && !error) return <Loading label="Loading Agreement authority" />;
  const agreement = detail?.agreement;
  return <div className="page">
    <PageHeader eyebrow="Representation Agreement" title={shown(agreement?.brandName, "Agreement")} description="Material terms are evidence-linked, editable, and non-authoritative until exact-artifact human approval." />
    {error ? <ErrorPanel message={error} /> : null}
    {detail && agreement ? <>
      <section className="metric-row">
        <article className="metric"><span>Authority</span><StatusPill value={String(agreement.status)} /></article>
        <article className="metric"><span>Original</span><strong>{shown(agreement.documentStatus)}</strong><small>{shown(agreement.documentScanStatus)}</small></article>
        <article className="metric"><span>Ambiguity</span><StatusPill value={String(agreement.legalAmbiguityStatus)} /></article>
      </section>
      <section className="panel"><h2>Reviewed written scope</h2>
        <dl className="detail-grid">
          <div><dt>Effective</dt><dd>{date(agreement.effectiveAt)}</dd></div><div><dt>Expires</dt><dd>{date(agreement.expiresAt)}</dd></div>
          <div><dt>Channels</dt><dd>{shown(agreement.channels)}</dd></div><div><dt>Products</dt><dd>{detail.products.length}</dd></div>
          <div><dt>Territory</dt><dd>{JSON.stringify(agreement.territoryScope)}</dd></div><div><dt>Commission</dt><dd>{shown(agreement.commissionBasis)} {agreement.commissionRate ? `· ${Number(agreement.commissionRate) * 100}%` : ""}</dd></div>
          <div><dt>Opening orders</dt><dd>{shown(agreement.openingOrderRights)}</dd></div><div><dt>Reorders</dt><dd>{shown(agreement.reorderRights)}</dd></div>
          <div><dt>Protected-account basis</dt><dd>{shown(agreement.protectedAccountRules)}</dd></div><div><dt>House accounts</dt><dd>{shown(agreement.houseAccountRules)}</dd></div>
          <div><dt>Termination</dt><dd>{shown(agreement.terminationTerms)}</dd></div><div><dt>Post-termination commission</dt><dd>{shown(agreement.postTerminationCommissionRights)}</dd></div>
        </dl>
      </section>
      {["draft","reviewing","pending_approval"].includes(String(agreement.status)) ? <section className="panel">
        <h2>Edit material terms</h2><form className="form-grid" onSubmit={(event) => void saveTerms(event)}>
          {([
            ["effectiveAt","Effective date/time","datetime-local"],["expiresAt","Expiration date/time","datetime-local"],
            ["channels","Channels (comma separated)","text"],["territoryScope","Territory scope","text"],
            ["authoritySummary","Authority summary","text"],["commissionBasis","Commission basis","text"],
            ["commissionRate","Commission rate (%)","number"],["commissionCurrency","Commission currency","text"],
            ["commissionTiming","Commission timing","text"],["openingOrderRights","Opening-order rights","text"],
            ["reorderRights","Reorder rights","text"],["protectedAccountRules","Protected-account rules","text"],
            ["houseAccountRules","House-account exclusions","text"],["terminationTerms","Termination terms","text"],
            ["postTerminationCommissionRights","Post-termination commission rights","text"],
            ["renewalReviewAt","Renewal review date/time","datetime-local"]
          ] as const).map(([key,label,type]) => <Field key={key} label={label}><input type={type} value={changes[key] ?? ""} onChange={(event) => setChanges((current) => ({ ...current, [key]: type === "datetime-local" && event.target.value ? new Date(event.target.value).toISOString() : event.target.value }))} /></Field>)}
          <button className="primary-button" disabled={saving || Object.keys(changes).length === 0}>Save reviewed terms</button>
        </form>
      </section> : null}
      <section className="panel"><p className="eyebrow">Extraction review</p><h2>Evidence-linked term candidates</h2>
        <p>AI may later suggest candidates, but it cannot approve or interpret them. This interface records manual/imported candidates only.</p>
        {detail.candidates.map((item) => <div className="list-row" key={item.id}>
          <span><strong>{shown(item.fieldName)}</strong><small>{shown(item.proposedValue)} · {shown(item.sourceLocation)}</small></span>
          <StatusPill value={String(item.status)} />
          {item.status === "proposed" ? <span><button className="text-button" onClick={() => void reviewCandidate(item, "confirmed")}>Confirm</button><button className="text-button" onClick={() => void reviewCandidate(item, "rejected")}>Reject</button></span> : null}
        </div>)}
        {["draft","reviewing"].includes(String(agreement.status)) ? <form className="form-grid" onSubmit={(event) => void proposeCandidate(event)}>
          <Field label="Material field"><select value={candidateField} onChange={(event) => setCandidateField(event.target.value)}>
            {["effectiveAt","expiresAt","channels","territoryScope","commissionBasis","commissionTiming","openingOrderRights","reorderRights","protectedAccountRules","houseAccountRules","terminationTerms","postTerminationCommissionRights"].map((item) => <option key={item}>{item}</option>)}
          </select></Field>
          <Field label="Extracted value"><input required value={candidateValue} onChange={(event) => setCandidateValue(event.target.value)} /></Field>
          <Field label="Document page/section"><input required value={sourceLocation} onChange={(event) => setSourceLocation(event.target.value)} /></Field>
          <label className="check-row"><input type="checkbox" checked={ambiguous} onChange={(event) => setAmbiguous(event.target.checked)} />Legal ambiguity requires review</label>
          <button className="secondary-button" disabled={saving}>Record candidate</button>
        </form> : null}
      </section>
      <section className="panel"><p className="eyebrow">Human authority</p><h2>Approval and lifecycle</h2>
        <p>Digest: <code>{detail.authorityDigest}</code></p>
        <div className="button-row">
          {["draft","reviewing"].includes(String(agreement.status)) ? <button className="primary-button" disabled={saving} onClick={() => void requestApproval()}>Request exact-scope approval</button> : null}
          {agreement.status === "pending_approval" ? <><input aria-label="Approval ID" placeholder="Approval ID from this review" value={approvalId} onChange={(event) => setApprovalId(event.target.value)} /><button className="primary-button" disabled={!approvalId || saving} onClick={() => void activate()}>Human approve and activate</button></> : null}
          {agreement.status === "active" ? <><button className="secondary-button" onClick={() => void end("suspended")}>Suspend authority</button><button className="danger-button" onClick={() => void end("ended")}>End authority</button></> : null}
        </div>
      </section>
      <section className="panel"><h2>Written account restrictions</h2>
        {detail.restrictions.length === 0 ? <p className="empty">None recorded. The platform does not infer account protection.</p> : detail.restrictions.map((item) => <div className="list-row" key={item.id}><span><strong>{shown(item.accountName)}</strong><small>{shown(item.sourceLocation)}</small></span><StatusPill value={String(item.restrictionType)} /></div>)}
        {["draft","reviewing"].includes(String(agreement.status)) ? <form className="form-grid" onSubmit={(event) => void addRestriction(event)}>
          <Field label="Written rule type"><select value={restrictionType} onChange={(event) => setRestrictionType(event.target.value)}>
            <option value="house_account_exclusion">House-account exclusion</option>
            <option value="account_exclusion">Account exclusion</option>
            <option value="protected_account_basis">Protected-account basis</option>
          </select></Field>
          <Field label="Business named in writing"><select required value={restrictionBusinessId} onChange={(event) => setRestrictionBusinessId(event.target.value)}>
            <option value="">Select Business</option>{businesses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></Field>
          <Field label="Original page/section"><input required value={restrictionLocation} onChange={(event) => setRestrictionLocation(event.target.value)} /></Field>
          <button className="secondary-button" disabled={saving}>Record written basis</button>
        </form> : null}
      </section>
      <section className="panel"><h2>Immutable version history</h2>{detail.versions.map((item) => <div className="list-row" key={item.id}><span><strong>Version {shown(item.version)}</strong><small>{shown(item.reason)}</small></span><code>{shown(item.snapshotDigest).slice(0, 12)}…</code></div>)}</section>
    </> : null}
  </div>;
}
