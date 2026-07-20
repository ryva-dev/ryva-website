import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import { ErrorPanel, Field, PageHeader } from "../components";

type Preview = {
  id: string;
  summary: {
    total: number; valid: number; errors: number; duplicates: number;
    creates: number; prospectiveCreates: number; duplicateReviewRequired: number; reviewOnly: boolean;
    authorityImplications: string[];
    provenance: { sourceId: string | null; observedAt: string | null; origin: string; verificationStatus: string };
  };
  rows: Array<{ rowNumber: number; normalized: Record<string,string>; errors: string[]; duplicateCandidates: unknown[] }>;
};
type Source = { id: string; reference: string };

const optionalFields: Record<string, string[]> = {
  brand: ["website", "ownershipSummary", "wholesaleStatus", "distributionSummary", "operationsSummary", "inventoryCapability", "fulfillmentNotes"],
  product: ["summary", "consumerPrice", "currency", "reviewVolume", "reviewQualitySummary", "salesEvidenceSummary", "trendDirection", "repeatPurchaseHypothesis", "differentiation", "physicalRetailPresence", "packagingReadiness", "wholesaleReadiness", "inventoryNotes", "fulfillmentNotes", "returnsNotes"],
  business: ["website", "geography", "assortmentSummary", "targetCustomerSummary", "pricePositioning", "currentVendorsSummary", "fitRationale"],
  contact: ["email", "phone", "professionalHandle", "seniority"],
  representation_opportunity: ["brandContactId", "proposedTerritory", "brandObjectives", "termsSummary", "missingTerms"],
  placement_opportunity: ["channel", "territory", "fitRationale"],
  business_buyer: ["decisionContext", "authorityEvidence"],
  source: ["url", "ownerOrProvider"],
  evidence: ["sourceId", "observedAt", "limitations"],
  task: ["priority", "dueAt"],
  protected_account: ["scopeSummary", "protectionStartsOn", "protectionEndsOn"],
  order: ["agreementId", "accountId", "orderDate", "sourceReference"],
  reorder: ["expectedWindowStartsOn", "expectedWindowEndsOn", "nextAction"],
  commission: ["accountId", "commissionRate", "calculationBasis"]
};

const initialMappings: Record<string, Record<string,string>> = {
  brand:{name:"name"},product:{name:"name",category:"category",brandId:"brandId"},
  business:{name:"name",businessType:"businessType",category:"category"},
  contact:{name:"name",role:"role",parentType:"parentType",parentId:"parentId"},
  business_buyer:{contactId:"contactId",businessId:"businessId",buyerRole:"buyerRole"},
  source:{sourceType:"sourceType",reference:"reference"},
  evidence:{subjectType:"subjectType",subjectId:"subjectId",exactClaim:"exactClaim",evidenceClass:"evidenceClass"},
  task:{subjectType:"subjectType",subjectId:"subjectId",title:"title"},
  representation_opportunity:{brandId:"brandId"},
  placement_opportunity:{brandId:"brandId",businessId:"businessId",productIds:"productIds"},
  protected_account:{brandId:"brandId",businessId:"businessId",agreementId:"agreementId"},
  order:{orderNumber:"orderNumber",brandId:"brandId",businessId:"businessId",currency:"currency",wholesaleGross:"wholesaleGross"},
  reorder:{accountId:"accountId",priorOrderId:"priorOrderId"},
  commission:{orderId:"orderId",agreementId:"agreementId",currency:"currency",expectedAmount:"expectedAmount"}
};

export function ImportPage() {
  const [recordType, setRecordType] = useState("brand");
  const [csv, setCsv] = useState("name\n");
  const [mapping, setMapping] = useState<Record<string, string>>({ name: "name" });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [observedAt, setObservedAt] = useState("");
  const [optionalTarget, setOptionalTarget] = useState("");
  const [optionalColumn, setOptionalColumn] = useState("");
  const [approvalReason, setApprovalReason] = useState("");
  const [committed, setCommitted] = useState<Record<string,number> | null>(null);
  useEffect(() => {
    void api<{ sources: Source[] }>("/api/sources").then((result) => setSources(result.sources)).catch(() => setSources([]));
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      setCommitted(null);
      setPreview(await api<Preview>("/api/data-imports/preview", {
        method: "POST",
        body: {
          recordType,
          sourceName: "Manual CSV preview",
          sourceId: sourceId || null,
          observedAt: observedAt ? new Date(observedAt).toISOString() : null,
          csv,idempotencyKey:crypto.randomUUID(),
          mapping: Object.fromEntries(
            Object.entries(mapping).filter(([, source]) => source).map(([target, source]) => [source, target])
          )
        }
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import could not be previewed.");
    }
  }
  async function approve() {
    if (!preview) return;
    setError("");
    try {
      const result=await api<{result:Record<string,number>}>(`/api/data-imports/${preview.id}/approve`,{
        method:"POST",body:{
          reason:approvalReason,sourceDigest:await crypto.subtle.digest("SHA-256",new TextEncoder().encode(csv))
            .then(value=>Array.from(new Uint8Array(value)).map(byte=>byte.toString(16).padStart(2,"0")).join("")),
          expectedRowCount:preview.summary.total,expectedCreateCount:preview.summary.creates,
          expectedReviewCount:preview.summary.duplicates,confirmation:"APPROVE IMPORT"
        }
      });
      setCommitted(result.result);
    } catch(caught) {
      setError(caught instanceof Error?caught.message:"Import could not be committed.");
    }
  }
  return (
    <div className="page">
      <PageHeader eyebrow="Controlled ingestion" title="Import and review" description="Map, validate, preview, and explicitly approve a transactional import. Consequential records remain non-authoritative review items." />
      <section className="panel">
        <form onSubmit={(event) => void submit(event)}>
          <Field label="Record type"><select value={recordType} onChange={(event) => {
            const next = event.target.value;
            setRecordType(next);
            setMapping(initialMappings[next]??{});
          }}>{Object.keys(initialMappings).map(type=><option key={type} value={type}>{type.replaceAll("_"," ")}</option>)}</select></Field>
          <div className="form-grid">
            {Object.entries(mapping).map(([target, source]) => <Field key={target} label={`${target} source column`}><input required value={source} onChange={(event) => setMapping((current) => ({ ...current, [target]: event.target.value }))} /></Field>)}
          </div>
          <div className="form-grid">
            <Field label="Evidence Source" hint="Optional for preview, required before imported assertions can support reviewed facts."><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Not linked yet</option>{sources.map((item) => <option key={item.id} value={item.id}>{item.reference}</option>)}</select></Field>
            <Field label="Source observed at"><input type="datetime-local" value={observedAt} onChange={(event) => setObservedAt(event.target.value)} /></Field>
            <Field label="Additional mapped field"><select value={optionalTarget} onChange={(event) => setOptionalTarget(event.target.value)}><option value="">Select…</option>{optionalFields[recordType]?.filter((item) => !(item in mapping)).map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="CSV column"><input value={optionalColumn} onChange={(event) => setOptionalColumn(event.target.value)} /></Field>
            <div className="form-actions"><button className="text-button" type="button" disabled={!optionalTarget || !optionalColumn} onClick={() => { setMapping((current) => ({ ...current, [optionalTarget]: optionalColumn })); setOptionalTarget(""); setOptionalColumn(""); }}>Add mapping</button></div>
          </div>
          <Field label="CSV" hint="First row must contain the mapped required columns. Up to 5,000 rows; imports never create authority."><textarea rows={10} required value={csv} onChange={(event) => setCsv(event.target.value)} /></Field>
          <button className="primary-button">Validate preview</button>
        </form>
        {error ? <ErrorPanel message={error} /> : null}
      </section>
      {preview ? <section className="panel">
        <h2>Validation result</h2>
        <div className="metric-row">
          <div className="metric"><span>Rows</span><strong>{preview.summary.total}</strong></div>
          <div className="metric"><span>Valid</span><strong>{preview.summary.valid}</strong></div>
          <div className="metric"><span>Duplicate candidates</span><strong>{preview.summary.duplicates}</strong></div>
        </div>
        <p><strong>Import status:</strong> awaiting explicit approval; {preview.summary.provenance.origin}, {preview.summary.provenance.verificationStatus}. {preview.summary.prospectiveCreates} prospective creates; {preview.summary.duplicateReviewRequired} require duplicate review.</p>
        {preview.summary.reviewOnly?<p className="callout"><strong>Review-only type:</strong> Valid rows will be staged for human adoption and will not create operational authority.</p>:null}
        <div className="locked-setting"><div><strong>Authority boundaries</strong><ul>{preview.summary.authorityImplications.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
        <div className="table-wrap"><table><thead><tr><th>Row</th><th>Name</th><th>Errors</th><th>Duplicates</th></tr></thead><tbody>
          {preview.rows.map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.normalized.name}</td><td>{row.errors.join(", ") || "None"}</td><td>{row.duplicateCandidates.length}</td></tr>)}
        </tbody></table></div>
        {!committed?<div className="form-grid">
          <Field label="Approval rationale" hint="Explain why this exact preview should be committed."><textarea rows={3} value={approvalReason} onChange={event=>setApprovalReason(event.target.value)} /></Field>
          <div className="form-actions"><button className="primary-button" disabled={preview.summary.errors>0||approvalReason.trim().length<10} onClick={()=>void approve()}>Approve exact preview and commit</button></div>
        </div>:<div className="success-panel" role="status"><strong>Import committed.</strong> {Object.entries(committed).map(([key,value])=><span key={key}> {key}: {value}.</span>)}{" "}
          <a href={`/api/data-imports/${preview.id}/report`}>Download row outcome report</a>
        </div>}
      </section> : null}
    </div>
  );
}
