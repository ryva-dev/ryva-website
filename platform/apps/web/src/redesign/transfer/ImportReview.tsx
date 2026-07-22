import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api";
import {
  Alert,
  Button,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Metric,
  PageHeader,
  Select,
  StatusLabel,
  Table,
  TextArea
} from "../../design-system";
import {
  ConsequentialReviewLayout,
  ExactArtifact,
  ReadinessSummary,
  ReviewOutcome,
  ReviewSection,
  ValidationSummary,
  type ValidationCheck
} from "../consequential/ConsequentialReview";
type Preview = {
  id: string;
  summary: {
    total: number; valid: number; errors: number; duplicates: number;
    creates: number; prospectiveCreates: number; duplicateReviewRequired: number; reviewOnly: boolean;
    authorityImplications: string[];
    provenance: { sourceId: string | null; observedAt: string | null; origin: string; verificationStatus: string };
  };
  rows: Array<{ rowNumber: number; normalized: Record<string, string>; errors: string[]; duplicateCandidates: unknown[] }>;
};
type Source = { id: string; reference: string };

const optionalFields: Record<string, string[]> = {
  brand: ["website", "ownershipSummary", "wholesaleStatus", "distributionSummary", "operationsSummary", "inventoryCapability", "fulfillmentNotes"],
  product: ["summary", "consumerPrice", "currency", "reviewVolume", "reviewQualitySummary", "salesEvidenceSummary", "trendDirection", "repeatPurchaseHypothesis", "differentiation", "physicalRetailPresence", "packagingReadiness", "wholesaleReadiness", "inventoryNotes", "fulfillmentNotes", "returnsNotes"],
  business: ["website", "geography", "assortmentSummary", "targetCustomerSummary", "pricePositioning", "currentVendorsSummary", "fitRationale"],
  contact: ["email", "phone", "professionalHandle", "seniority"],
  representation_opportunity: ["brandContactId", "proposedTerritory", "brandObjectives", "termsSummary", "missingTerms"],
  placement_opportunity: ["channel", "territory", "fitRationale"],
  business_buyer: ["decisionContext", "authorityEvidence"], source: ["url", "ownerOrProvider"],
  evidence: ["sourceId", "observedAt", "limitations"], task: ["priority", "dueAt"],
  protected_account: ["scopeSummary", "protectionStartsOn", "protectionEndsOn"],
  order: ["agreementId", "accountId", "orderDate", "sourceReference"],
  reorder: ["expectedWindowStartsOn", "expectedWindowEndsOn", "nextAction"],
  commission: ["accountId", "commissionRate", "calculationBasis"]
};

const initialMappings: Record<string, Record<string, string>> = {
  brand: { name: "name" }, product: { name: "name", category: "category", brandId: "brandId" },
  business: { name: "name", businessType: "businessType", category: "category" },
  contact: { name: "name", role: "role", parentType: "parentType", parentId: "parentId" },
  business_buyer: { contactId: "contactId", businessId: "businessId", buyerRole: "buyerRole" },
  source: { sourceType: "sourceType", reference: "reference" },
  evidence: { subjectType: "subjectType", subjectId: "subjectId", exactClaim: "exactClaim", evidenceClass: "evidenceClass" },
  task: { subjectType: "subjectType", subjectId: "subjectId", title: "title" },
  representation_opportunity: { brandId: "brandId" },
  placement_opportunity: { brandId: "brandId", businessId: "businessId", productIds: "productIds" },
  protected_account: { brandId: "brandId", businessId: "businessId", agreementId: "agreementId" },
  order: { orderNumber: "orderNumber", brandId: "brandId", businessId: "businessId", currency: "currency", wholesaleGross: "wholesaleGross" },
  reorder: { accountId: "accountId", priorOrderId: "priorOrderId" },
  commission: { orderId: "orderId", agreementId: "agreementId", currency: "currency", expectedAmount: "expectedAmount" }
};

export function ImportReviewPage() {
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
  const [committed, setCommitted] = useState<Record<string, number> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approving, setApproving] = useState(false);

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
          recordType, sourceName: "Manual CSV preview", sourceId: sourceId || null,
          observedAt: observedAt ? new Date(observedAt).toISOString() : null,
          csv, idempotencyKey: crypto.randomUUID(),
          mapping: Object.fromEntries(Object.entries(mapping).filter(([, source]) => source).map(([target, source]) => [source, target]))
        }
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import could not be previewed.");
    }
  }

  async function approve() {
    if (!preview) return;
    setApproving(true);
    setError("");
    try {
      const result = await api<{ result: Record<string, number> }>(`/api/data-imports/${preview.id}/approve`, {
        method: "POST",
        body: {
          reason: approvalReason,
          sourceDigest: await crypto.subtle.digest("SHA-256", new TextEncoder().encode(csv))
            .then((value) => Array.from(new Uint8Array(value)).map((byte) => byte.toString(16).padStart(2, "0")).join("")),
          expectedRowCount: preview.summary.total, expectedCreateCount: preview.summary.creates,
          expectedReviewCount: preview.summary.duplicates, confirmation: "APPROVE IMPORT"
        }
      });
      setCommitted(result.result);
      setConfirmOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import could not be committed.");
      setConfirmOpen(false);
    } finally {
      setApproving(false);
    }
  }

  const validationChecks: ValidationCheck[] = preview ? [
    { id: "rows", label: "Valid rows", detail: `${preview.summary.valid} of ${preview.summary.total} rows passed validation.`, state: preview.summary.errors ? "failed" : "passed" },
    { id: "duplicates", label: "Duplicate review", detail: `${preview.summary.duplicateReviewRequired} row(s) require duplicate review.`, state: preview.summary.duplicates ? "requires_review" : "passed" },
    { id: "authority", label: "Authority boundary", detail: preview.summary.reviewOnly ? "This type remains review-only and cannot create operational authority." : "Creates remain subject to the approved preview.", state: "requires_review" }
  ] : [];
  const approvalBlocked = !preview || preview.summary.errors > 0 || approvalReason.trim().length < 10;

  return (
    <div className="page ry-transfer-page">
      <PageHeader eyebrow="Controlled ingestion" title="Import and review" description="Map, validate, preview, and explicitly approve a transactional import." />
      <ReviewSection eyebrow="Setup" title="Map source data" description="The preview is bound to the CSV, mapping, and source context below.">
        <form className="ry-transfer-form" onSubmit={(event) => void submit(event)}>
          <Field label="Record type"><Select value={recordType} onChange={(event) => { const next = event.target.value; setRecordType(next); setMapping(initialMappings[next] ?? {}); }}>
            {Object.keys(initialMappings).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
          </Select></Field>
          <div className="ry-transfer-grid">
            {Object.entries(mapping).map(([target, source]) => <Field key={target} label={`${target} source column`}><Input required value={source} onChange={(event) => setMapping((current) => ({ ...current, [target]: event.target.value }))} /></Field>)}
          </div>
          <div className="ry-transfer-grid">
            <Field label="Evidence Source" hint="Optional for preview."><Select value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Not linked yet</option>{sources.map((item) => <option key={item.id} value={item.id}>{item.reference}</option>)}</Select></Field>
            <Field label="Source observed at"><Input type="datetime-local" value={observedAt} onChange={(event) => setObservedAt(event.target.value)} /></Field>
            <Field label="Additional mapped field"><Select value={optionalTarget} onChange={(event) => setOptionalTarget(event.target.value)}><option value="">Select…</option>{optionalFields[recordType]?.filter((item) => !(item in mapping)).map((item) => <option key={item}>{item}</option>)}</Select></Field>
            <Field label="CSV column"><Input value={optionalColumn} onChange={(event) => setOptionalColumn(event.target.value)} /></Field>
          </div>
          <Button type="button" variant="secondary" disabled={!optionalTarget || !optionalColumn} onClick={() => { setMapping((current) => ({ ...current, [optionalTarget]: optionalColumn })); setOptionalTarget(""); setOptionalColumn(""); }}>Add mapping</Button>
          <Field label="CSV" hint="First row must contain mapped required columns. Up to 5,000 rows."><TextArea rows={10} required value={csv} onChange={(event) => setCsv(event.target.value)} /></Field>
          <Button type="submit">Validate preview</Button>
        </form>
      </ReviewSection>
      {error ? <ErrorState message={error} /> : null}
      {preview ? (
        <ConsequentialReviewLayout readiness={<ReadinessSummary state={committed ? "completed" : approvalBlocked ? "blocked" : "requires_review"} description="This import remains uncommitted until the exact preview receives explicit human approval." blockers={approvalBlocked && !committed ? ["Resolve validation errors and provide an approval rationale of at least 10 characters."] : []} context={<dl className="ry-review-facts"><div><dt>Preview</dt><dd>{preview.id}</dd></div><div><dt>Source</dt><dd>{preview.summary.provenance.origin}</dd></div></dl>} />}>
          <ReviewSection title="Validation result" description="Validation distinguishes valid records from duplicate candidates before any commit.">
            <div className="ry-transfer-metrics"><Metric label="Rows" value={preview.summary.total} /><Metric label="Valid" value={preview.summary.valid} /><Metric label="Duplicate candidates" value={preview.summary.duplicates} /></div>
            <p><StatusLabel value="requires_review" label="awaiting explicit approval" /> {preview.summary.provenance.origin}, {preview.summary.provenance.verificationStatus}. {preview.summary.prospectiveCreates} prospective creates.</p>
            {preview.summary.reviewOnly ? <Alert tone="warning" title="Review-only type">Valid rows will be staged for human adoption and will not create operational authority.</Alert> : null}
            <Table caption="Import preview rows"><thead><tr><th>Row</th><th>Name</th><th>Errors</th><th>Duplicates</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.normalized.name}</td><td>{row.errors.join(", ") || "None"}</td><td>{row.duplicateCandidates.length}</td></tr>)}</tbody></Table>
          </ReviewSection>
          <ExactArtifact title="Exact import preview" description="This preview ID, CSV digest, row count, and mapping are revalidated when committed." version={preview.id} code>{csv}</ExactArtifact>
          <ValidationSummary checks={validationChecks} description="The server remains authoritative when the approval is submitted." />
          {committed ? <ReviewOutcome title="Import committed." status="completed" consequence="The approved preview has been committed and row outcomes are available for audit."><p>{Object.entries(committed).map(([key, value]) => `${key}: ${value}`).join(" · ")} · <a href={`/api/data-imports/${preview.id}/report`}>Download row outcome report</a></p></ReviewOutcome> : (
            <ReviewSection eyebrow="Consequential review" title="Approve exact preview" description="Approval binds your rationale to the exact CSV preview.">
              <Field label="Approval rationale" hint="Explain why this exact preview should be committed." required><TextArea rows={3} value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} /></Field>
              <Button disabled={approvalBlocked} onClick={() => setConfirmOpen(true)}>Approve exact preview and commit</Button>
            </ReviewSection>
          )}
        </ConsequentialReviewLayout>
      ) : <EmptyState compact description="Validate a mapped CSV to create an exact preview for review." />}
      <ConfirmationDialog open={confirmOpen} title="Confirm import commit" description={`Approve preview ${preview?.id ?? ""} with ${preview?.summary.total ?? 0} rows.`} consequence={<><p>This commits only the exact preview after the server recomputes its SHA-256 source digest and expected counts.</p><p>Rationale: {approvalReason}</p></>} confirmLabel="Approve exact preview and commit" processing={approving} onConfirm={() => void approve()} onClose={() => setConfirmOpen(false)} />
    </div>
  );
}
