import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { ErrorPanel, Field, Loading, PageHeader, StatusPill } from "../components";

type Row = Record<string, unknown> & { id: string; name?: string; version?: number };
type AgreementDetail = { agreement: Row; products: string[] };
type BusinessContext = { decisions: Row[]; tasks: Row[] };

function shown(value: unknown, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return fallback;
}

function date(value: unknown): string {
  return typeof value === "string" && value ? new Date(value).toLocaleDateString() : "Not set";
}

export function PlacementPage() {
  const navigate = useNavigate();
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

  const load = useCallback(async () => {
    setLoading(true);
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
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!agreementId) return setAgreement(null);
    void api<AgreementDetail>(`/api/agreements/${agreementId}`).then(setAgreement).catch((caught) => setError(caught instanceof Error ? caught.message : "Agreement scope could not be loaded."));
  }, [agreementId]);
  useEffect(() => {
    if (!businessId) return setBusiness(null);
    void api<BusinessContext>(`/api/records/business/${businessId}`).then((value) => {
      setBusiness(value);
      setDecisionId(String(value.decisions.find((item) => item.status === "issued")?.id ?? ""));
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Buyer context could not be loaded."));
  }, [businessId]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!agreement) return;
    setSaving(true); setError("");
    try {
      const result = await api<{ placement: Row }>("/api/placements", {
        method: "POST",
        body: {
          agreementId, businessId, productIds: agreement.products, channel,
          matchThesis, buyerValueBasis: buyerValue, evidenceConfidence: "supported",
          decisionId,
          triangle: {
            ...partyText,
            brandWarningSigns: "", buyerValue, buyerWarningSigns: "",
            representativeWarningSigns: "", allPartiesReceiveLegitimateValue: allValue
          }
        }
      });
      void navigate(`/placements/${result.placement.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Placement could not be created.");
    } finally { setSaving(false); }
  }

  return <div className="page">
    <PageHeader eyebrow="Placement CRM" title="Placement Opportunities" description="Qualitative, evidence-led Product-to-Business work governed by current written authority and three-party value." />
    {error ? <ErrorPanel message={error} /> : null}
    {loading ? <Loading label="Loading placement work" /> : <>
      <section className="metric-row">
        <article className="metric"><span>Open</span><strong>{placements.filter((item) => !["closed_lost","disqualified"].includes(String(item.stage))).length}</strong></article>
        <article className="metric"><span>Stalled</span><strong>{placements.filter((item) => item.stalled === true).length}</strong></article>
        <article className="metric"><span>Conflict review</span><strong>{placements.filter((item) => item.conflictStatus !== "clear").length}</strong></article>
      </section>
      <section className="panel"><h2>Pipeline</h2>
        {placements.length === 0 ? <p className="empty">No Placement Opportunities. Create one only when authority and Buyer value are supportable.</p> :
          <div className="table-wrap"><table><thead><tr><th>Brand</th><th>Business</th><th>Stage</th><th>Authority/conflict</th><th>Next action</th><th /></tr></thead>
            <tbody>{placements.map((item) => <tr key={item.id}>
              <td>{shown(item.brandName)}</td><td>{shown(item.businessName)}</td>
              <td><StatusPill value={String(item.stage)} />{item.stalled === true ? <span className="quiet-tag">stalled</span> : null}</td>
              <td><StatusPill value={String(item.conflictStatus)} /></td><td>{shown(item.nextAction)}</td>
              <td><Link to={`/placements/${item.id}`}>Review</Link></td>
            </tr>)}</tbody>
          </table></div>}
      </section>
      <section className="panel"><p className="eyebrow">Human qualification</p><h2>Create a Placement Opportunity</h2>
        <form className="form-grid" onSubmit={(event) => void create(event)}>
          <Field label="Active Agreement"><select required value={agreementId} onChange={(event) => { setAgreementId(event.target.value); setChannel(""); }}>
            <option value="">Select current authority</option>{agreements.map((item) => <option key={item.id} value={item.id}>{shown(item.brandName)} · {date(item.expiresAt)}</option>)}
          </select></Field>
          <Field label="Authorized channel"><select required value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="">Select channel</option>{Array.isArray(agreement?.agreement.channels) ? (agreement.agreement.channels as string[]).map((item) => <option key={item}>{item}</option>) : null}
          </select></Field>
          <Field label="Qualified Business Buyer"><select required value={businessId} onChange={(event) => setBusinessId(event.target.value)}>
            <option value="">Select Business</option>{businesses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></Field>
          <Field label="Issued human decision"><select required value={decisionId} onChange={(event) => setDecisionId(event.target.value)}>
            <option value="">Select decision</option>{business?.decisions.filter((item) => item.status === "issued").map((item) => <option key={item.id} value={item.id}>{shown(item.outcome)}</option>)}
          </select></Field>
          <Field label="Match thesis"><textarea required value={matchThesis} onChange={(event) => setMatchThesis(event.target.value)} /></Field>
          <Field label="Concrete Buyer value"><textarea required value={buyerValue} onChange={(event) => setBuyerValue(event.target.value)} /></Field>
          {([
            ["brandValue","Brand value"],["brandObligations","Brand obligations"],["brandRisks","Brand risks"],
            ["buyerObligations","Buyer obligations"],["buyerRisks","Buyer risks"],
            ["representativeValue","Representative value"],["representativeObligations","Representative obligations"],
            ["representativeRisks","Representative risks"]
          ] as const).map(([key,label]) => <Field key={key} label={label}><textarea required value={partyText[key]} onChange={(event) => setPartyText((current) => ({ ...current, [key]: event.target.value }))} /></Field>)}
          <label className="check-row span-2"><input type="checkbox" checked={allValue} onChange={(event) => setAllValue(event.target.checked)} />I confirm that Brand, Business Buyer, and Representative can each receive legitimate value.</label>
          <div className="button-row span-2"><button className="primary-button" disabled={saving || !allValue}>{saving ? "Creating…" : "Create Placement"}</button></div>
        </form>
      </section>
    </>}
  </div>;
}

type PlacementDetail = {
  placement: Row;
  products: Array<{ productId: string }>;
  triangle: Row | null;
  events: Row[];
  conflicts: Row[];
};

export function PlacementDetailPage() {
  const { id = "" } = useParams();
  const [detail, setDetail] = useState<PlacementDetail | null>(null);
  const [business, setBusiness] = useState<BusinessContext | null>(null);
  const [toStage, setToStage] = useState("qualified");
  const [reason, setReason] = useState("");
  const [decisionId, setDecisionId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [evidenceIds, setEvidenceIds] = useState("");
  const [authority, setAuthority] = useState<{ outcome: string; reasonCodes: string[] } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      const value = await api<PlacementDetail>(`/api/placements/${id}`);
      setDetail(value);
      const context = await api<BusinessContext>(`/api/records/business/${shown(value.placement.business_id)}`);
      setBusiness(context);
      setDecisionId(String(context.decisions.find((item) => item.status === "issued")?.id ?? ""));
      setTaskId(String(context.tasks.find((item) => !["completed","canceled"].includes(String(item.status)))?.id ?? ""));
      const evaluated = await api<{ authority: { outcome: string; reasonCodes: string[] } }>("/api/authority/evaluate", {
        method: "POST", body: {
          action: "placement_stage", brandId: value.placement.brand_id,
          businessId: value.placement.business_id, agreementId: value.placement.agreement_id,
          productIds: value.products.map((item) => item.productId), context: { placementId: id }
        }
      });
      setAuthority(evaluated.authority);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Placement could not be loaded.");
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function transition(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setSaving(true);
    try {
      await api(`/api/placements/${id}/stage`, {
        method: "POST", body: {
          version: detail.placement.version, toStage, reason, decisionId,
          evidenceIds: evidenceIds.split(",").map((item) => item.trim()).filter(Boolean),
          nextActionTaskId: ["closed_lost","disqualified"].includes(toStage) ? null : taskId
        }
      });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Stage transition failed."); }
    finally { setSaving(false); }
  }

  if (!detail && !error) return <Loading label="Loading Placement Opportunity" />;
  return <div className="page">
    <PageHeader eyebrow="Placement Opportunity" title={detail ? `${shown(detail.placement.brandName)} → ${shown(detail.placement.businessName)}` : "Placement"} description="Every advancement rechecks authority, conflict state, three-party value, human decision, and next action." action={<Link className="secondary-button" to={`/outreach?placementId=${id}`}>Open Outreach</Link>} />
    {error ? <ErrorPanel message={error} /> : null}
    {detail ? <>
      <section className="metric-row">
        <article className="metric"><span>Stage</span><StatusPill value={String(detail.placement.stage)} /></article>
        <article className="metric"><span>Authority</span><StatusPill value={authority?.outcome ?? "not_checked"} /></article>
        <article className="metric"><span>Conflict</span><StatusPill value={String(detail.placement.conflict_status)} /></article>
      </section>
      {authority && authority.outcome !== "authorized" ? <section className="state-panel error-panel" role="alert"><strong>Authority blocks advancement or outreach.</strong><p>{Array.isArray(authority.reasonCodes) ? authority.reasonCodes.join(", ") : ""}</p></section> : null}
      <section className="panel"><h2>Opportunity basis</h2><dl className="detail-grid">
        <div><dt>Match thesis</dt><dd>{shown(detail.placement.match_thesis)}</dd></div>
        <div><dt>Buyer value</dt><dd>{shown(detail.placement.buyer_value_basis)}</dd></div>
        <div><dt>Evidence confidence</dt><dd>{shown(detail.placement.evidence_confidence)}</dd></div>
        <div><dt>Next action</dt><dd>{shown(detail.placement.nextAction)}</dd></div>
      </dl></section>
      <section className="panel"><p className="eyebrow">Relationship Triangle</p><h2>Legitimate value and obligations</h2>
        {detail.triangle ? <dl className="detail-grid">
          <div><dt>Brand value</dt><dd>{shown(detail.triangle.brand_value)}</dd></div>
          <div><dt>Brand risks</dt><dd>{shown(detail.triangle.brand_risks)}</dd></div>
          <div><dt>Buyer value</dt><dd>{shown(detail.triangle.buyer_value)}</dd></div>
          <div><dt>Buyer risks</dt><dd>{shown(detail.triangle.buyer_risks)}</dd></div>
          <div><dt>Representative value</dt><dd>{shown(detail.triangle.representative_value)}</dd></div>
          <div><dt>Representative risks</dt><dd>{shown(detail.triangle.representative_risks)}</dd></div>
        </dl> : <p className="empty">Relationship Triangle review is missing; progression is not allowed.</p>}
      </section>
      <section className="panel"><h2>Stage confirmation</h2><form className="form-grid" onSubmit={(event) => void transition(event)}>
        <Field label="Next stage"><select value={toStage} onChange={(event) => setToStage(event.target.value)}>
          {["identified","qualified","prepared","contacted","engaged","information_sample_sent","buyer_review","terms_order_discussion","closed_lost","disqualified"].map((item) => <option key={item}>{item}</option>)}
        </select></Field>
        <Field label="Fresh human decision"><select required value={decisionId} onChange={(event) => setDecisionId(event.target.value)}>
          <option value="">Select</option>{business?.decisions.filter((item) => item.status === "issued").map((item) => <option key={item.id} value={item.id}>{shown(item.outcome)}</option>)}
        </select></Field>
        <Field label="Next action"><select required={!["closed_lost","disqualified"].includes(toStage)} value={taskId} onChange={(event) => setTaskId(event.target.value)}>
          <option value="">Select</option>{business?.tasks.filter((item) => !["completed","canceled"].includes(String(item.status))).map((item) => <option key={item.id} value={item.id}>{shown(item.title)}</option>)}
        </select></Field>
        <Field label="Reason"><textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
        <Field label="Evidence IDs for backward/closure/reopen"><input value={evidenceIds} onChange={(event) => setEvidenceIds(event.target.value)} /></Field>
        <button className="primary-button" disabled={saving}>Record human-confirmed stage</button>
      </form></section>
      <section className="panel"><h2>Stage history</h2>{detail.events.map((item, index) => <div className="timeline-item" key={`${shown(item.occurredAt)}-${index}`}><StatusPill value={String(item.toStage)} /><p>{shown(item.reason)}</p><small>{date(item.occurredAt)}</small></div>)}</section>
    </> : null}
  </div>;
}
