import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  ApprovalPanel,
  AuditHistory,
  AuthorityIndicator,
  Button,
  Checkbox,
  ConfirmationDialog,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  IdentityHeader,
  Input,
  LoadingState,
  Select,
  StatusLabel
} from "../../design-system";
import { useLoad } from "../../hooks";
import {
  ConsequentialReviewLayout,
  ExactArtifact,
  ReadinessSummary,
  ReviewErrorSummary,
  ReviewOutcome,
  ReviewSection,
  ValidationSummary,
  type ReviewReadiness,
  type ValidationCheck
} from "../consequential/ConsequentialReview";
import { RelationshipTrail } from "../relationship/RelationshipDetail";
import { date, dateTime, materialFieldOptions, materialTermFields, pendingApprovalStatus, readable, shown, type Row } from "./utils";

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
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const { data, loading, error, reload } = useLoad(() => api<AgreementDetail>(`/api/agreements/${id}`), [id]);
  const agreement = data?.agreement;

  const [businesses, setBusinesses] = useState<Row[]>([]);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [candidateField, setCandidateField] = useState<string>(materialFieldOptions[0]);
  const [candidateValue, setCandidateValue] = useState("");
  const [sourceLocation, setSourceLocation] = useState("");
  const [ambiguous, setAmbiguous] = useState(false);
  const [restrictionType, setRestrictionType] = useState("house_account_exclusion");
  const [restrictionBusinessId, setRestrictionBusinessId] = useState("");
  const [restrictionLocation, setRestrictionLocation] = useState("");
  const [approvalId, setApprovalId] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const submissionGuard = useRef(false);

  useEffect(() => {
    void api<{ records: Row[] }>("/api/records/business")
      .then((result) => setBusinesses(result.records))
      .catch(() => setBusinesses([]));
  }, []);

  useEffect(() => {
    if (actionError) document.querySelector<HTMLElement>("[data-review-error]")?.focus();
  }, [actionError]);

  async function saveTerms(event: FormEvent) {
    event.preventDefault();
    if (!agreement || !canWrite) return;
    setSaving(true); setActionError(""); setConflict(false);
    try {
      const normalized: Record<string, unknown> = { ...changes };
      if (changes.channels) normalized.channels = changes.channels.split(",").map((item) => item.trim()).filter(Boolean);
      if (changes.territoryScope) normalized.territoryScope = { description: changes.territoryScope };
      if (changes.commissionRate) normalized.commissionRate = Number(changes.commissionRate) / 100;
      await api(`/api/agreements/${id}`, { method: "PATCH", body: { version: agreement.version, changes: normalized } });
      setChanges({});
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Terms could not be saved.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); }
  }

  async function proposeCandidate(event: FormEvent) {
    event.preventDefault();
    if (!agreement?.sourceDocumentId || !canWrite) return;
    setSaving(true); setActionError(""); setConflict(false);
    try {
      await api(`/api/agreements/${id}/term-candidates`, {
        method: "POST", body: {
          sourceDocumentId: agreement.sourceDocumentId, fieldName: candidateField,
          proposedValue: candidateValue, sourceLocation, evidenceExcerpt: "",
          evidenceClass: "direct_evidence", confidence: "supported", origin: "user_entered",
          material: true, ambiguous, specialistReviewRequired: ambiguous
        }
      });
      setCandidateValue(""); setSourceLocation("");
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Candidate could not be recorded.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); }
  }

  async function reviewCandidate(item: Row, decision: "confirmed" | "rejected") {
    if (!canWrite) return;
    setSaving(true); setActionError(""); setConflict(false);
    try {
      await api(`/api/agreement-term-candidates/${item.id}`, {
        method: "PATCH", body: {
          version: item.version, decision, reviewNotes: `Human ${decision} after comparing the cited original.`
        }
      });
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Candidate review failed.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); }
  }

  async function requestApproval() {
    if (!canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true); setActionError(""); setConflict(false);
    try {
      const result = await api<{ approval: Row }>(`/api/agreements/${id}/approval`, {
        method: "POST", body: { scope: "Current written Product, channel, territory, account, commission, and termination terms only." }
      });
      setApprovalId(result.approval.id);
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Approval could not be requested.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); submissionGuard.current = false; }
  }

  async function activate() {
    if (!approvalId || !canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true); setActionError(""); setConflict(false);
    try {
      await api(`/api/agreements/${id}/activate`, {
        method: "POST", body: { approvalId, decision: "approved", conditions: "Authority limited to the reviewed written scope." }
      });
      setConfirmationOpen(false);
      setApprovalId("");
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Agreement could not be activated.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
      setConfirmationOpen(false);
    } finally { setSaving(false); submissionGuard.current = false; }
  }

  async function end(status: "suspended" | "ended") {
    if (!agreement || !canWrite) return;
    setSaving(true); setActionError(""); setConflict(false);
    try {
      await api(`/api/agreements/${id}/status`, {
        method: "POST", body: { version: agreement.version, status, reason: `Human recorded ${status} authority after reviewing current contractual status.` }
      });
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Agreement status could not be changed.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); }
  }

  async function addRestriction(event: FormEvent) {
    event.preventDefault();
    if (!agreement?.sourceDocumentId || !restrictionBusinessId || !canWrite) return;
    const business = businesses.find((item) => item.id === restrictionBusinessId);
    setSaving(true); setActionError(""); setConflict(false);
    try {
      await api(`/api/agreements/${id}/account-restrictions`, {
        method: "POST",
        body: {
          restrictionType, businessId: restrictionBusinessId,
          accountName: shown(business?.name), productIds: data?.products ?? [],
          channels: Array.isArray(agreement.channels) ? agreement.channels : [],
          territoryScope: agreement.territoryScope ?? {},
          sourceDocumentId: agreement.sourceDocumentId,
          sourceLocation: restrictionLocation
        }
      });
      setRestrictionBusinessId(""); setRestrictionLocation("");
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Written account restriction could not be recorded.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); }
  }

  const loadingTrail = <RelationshipTrail items={[{ label: "Representation", to: "/representation" }, { label: loading ? "Loading Agreement review" : "Agreement unavailable" }]} />;
  if (loading) {
    return (
      <div className="page ry-consequential-page ry-representation-page">
        {loadingTrail}
        <IdentityHeader eyebrow="Consequential review · representation authority" title="Loading Agreement review" status={<StatusLabel value="loading" />} />
        <LoadingState label="Loading Agreement authority" />
      </div>
    );
  }
  if (error || !data || !agreement) {
    return (
      <div className="page ry-consequential-page ry-representation-page">
        {loadingTrail}
        <IdentityHeader eyebrow="Consequential review · representation authority" title="Agreement unavailable" />
        <ErrorState message={error || "Representation Agreement not found."} action={<Button variant="secondary" onClick={() => void reload()}>Try again</Button>} />
      </div>
    );
  }

  const status = shown(agreement.status, "draft");
  const pending = pendingApprovalStatus(status);
  const active = status === "active";
  const products = data.products ?? [];
  const restrictions = data.restrictions ?? [];
  const candidates = data.candidates ?? [];
  const versions = data.versions ?? [];
  const documentReady = shown(agreement.documentStatus) === "active" && shown(agreement.documentScanStatus) === "clean";
  const scopeComplete = Boolean(agreement.effectiveAt) && products.length > 0 && Array.isArray(agreement.channels) && agreement.channels.length > 0;
  const pendingCandidates = candidates.filter((item) => item.material && item.status === "proposed");
  const ambiguityResolved = !["review_required", "specialist_required"].includes(shown(agreement.legalAmbiguityStatus));
  const readyForApproval = documentReady && scopeComplete && pendingCandidates.length === 0 && ambiguityResolved;
  const readinessState: ReviewReadiness = conflict ? "stale" : !canWrite ? "restricted" : !pending ? "completed" : readyForApproval ? (approvalId ? "ready" : "requires_review") : "blocked";
  const authorityDigest = data.authorityDigest || "Digest unavailable";
  const representationOpportunityId = shown(agreement.representationOpportunityId, "");

  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "This session cannot record an approval decision."] : []),
    ...(!documentReady ? ["The Agreement original is not both active and clean."] : []),
    ...(!scopeComplete ? ["Effective date, at least one Product, and at least one channel are required."] : []),
    ...(pendingCandidates.length ? [`${pendingCandidates.length} material term candidate(s) require review before approval.`] : []),
    ...(!ambiguityResolved ? [`Legal ambiguity status is ${shown(agreement.legalAmbiguityStatus)} and must be resolved or specialist-reviewed.`] : []),
    ...(!pending ? [`Status ${status.replaceAll("_", " ")} is not eligible for a new approval request.`] : []),
    ...(conflict ? ["The approval reference or exact artifact is no longer current. Reload and prepare a fresh review."] : [])
  ];

  const validationChecks: ValidationCheck[] = [
    { id: "original", label: "Immutable original", detail: documentReady ? `${shown(agreement.documentName)} is active and clean.` : "A clean, active Agreement original is required.", state: documentReady ? "passed" : "failed" },
    { id: "scope", label: "Exact proposed scope", detail: scopeComplete ? `Effective ${date(agreement.effectiveAt)} · ${products.length} Product(s) · ${Array.isArray(agreement.channels) ? agreement.channels.length : 0} channel(s).` : "Effective date, Product scope, and channel scope are all required.", state: scopeComplete ? "passed" : "failed" },
    { id: "candidates", label: "Material term review", detail: pendingCandidates.length ? `${pendingCandidates.length} material candidate(s) remain proposed.` : "No material term candidate is pending review.", state: pendingCandidates.length ? "failed" : "passed" },
    { id: "ambiguity", label: "Legal ambiguity", detail: ambiguityResolved ? "No unresolved legal ambiguity is recorded." : `Status is ${shown(agreement.legalAmbiguityStatus)}.`, state: ambiguityResolved ? "passed" : "failed" },
    { id: "human", label: "Human approval", detail: active ? `Approved ${dateTime(agreement.approvedAt)}.` : approvalId ? "An approval reference is prepared for this exact artifact." : "No approval has been requested for the current artifact.", state: active ? "passed" : "requires_review" }
  ];

  const auditEntries = versions.map((item) => ({
    id: String(item.id),
    action: `Version ${shown(item.version)}`,
    actor: shown(item.changedBy, "Ryva representation record"),
    outcome: <code>{shown(item.snapshotDigest).slice(0, 12)}…</code>,
    timestamp: dateTime(item.changedAt),
    detail: shown(item.reason, "No rationale recorded")
  }));

  const proposedScope = (
    <dl className="ry-review-facts">
      <div><dt>Brand relationship</dt><dd><Link to="/representation">{shown(agreement.brandName)}</Link>{representationOpportunityId ? <> · <Link to={`/representation/${representationOpportunityId}`}>Representation Opportunity</Link></> : null}</dd></div>
      <div><dt>Immutable original</dt><dd><button type="button" className="text-button" onClick={() => setDocumentOpen(true)}>{shown(agreement.documentName, "No original linked")}</button></dd></div>
      <div><dt>Effective</dt><dd>{date(agreement.effectiveAt)}</dd></div>
      <div><dt>Expires</dt><dd>{date(agreement.expiresAt)}</dd></div>
      <div><dt>Channels</dt><dd>{shown(agreement.channels)}</dd></div>
      <div><dt>Products</dt><dd>{products.length}</dd></div>
      <div><dt>Territory</dt><dd><code>{JSON.stringify(agreement.territoryScope ?? {})}</code></dd></div>
      <div><dt>Commission</dt><dd>{shown(agreement.commissionBasis)} {agreement.commissionRate ? `· ${Number(agreement.commissionRate) * 100}%` : ""}</dd></div>
      <div><dt>Opening orders</dt><dd>{shown(agreement.openingOrderRights)}</dd></div>
      <div><dt>Reorders</dt><dd>{shown(agreement.reorderRights)}</dd></div>
      <div><dt>Protected-account basis</dt><dd>{shown(agreement.protectedAccountRules)}</dd></div>
      <div><dt>House accounts</dt><dd>{shown(agreement.houseAccountRules)}</dd></div>
      <div><dt>Termination</dt><dd>{shown(agreement.terminationTerms)}</dd></div>
      <div><dt>Post-termination commission</dt><dd>{shown(agreement.postTerminationCommissionRights)}</dd></div>
      <div><dt>Legal ambiguity</dt><dd><StatusLabel value={shown(agreement.legalAmbiguityStatus, "none")} /></dd></div>
    </dl>
  );

  return (
    <div className="page ry-consequential-page ry-representation-page">
      <RelationshipTrail items={[
        { label: "Representation", to: "/representation" },
        ...(representationOpportunityId ? [{ label: "Opportunity", to: `/representation/${representationOpportunityId}` }] : []),
        { label: `${shown(agreement.brandName)} Agreement` }
      ]} />
      <p className="ry-consequential-intro">Material terms are evidence-linked, editable, and non-authoritative until exact-artifact human approval.</p>
      <IdentityHeader
        eyebrow="Consequential review · representation authority"
        title={`${shown(agreement.brandName)} Agreement`}
        relationship={<span className="ry-relationship-identity-meta"><Link to="/representation">Representation</Link>{representationOpportunityId ? <Link to={`/representation/${representationOpportunityId}`}>Opportunity</Link> : null}<span>Version {shown(agreement.version)}</span></span>}
        status={<StatusLabel value={status} />}
        warning={["suspended", "ended"].includes(status) ? <Alert tone="warning" title="Authority is not current">History and previously earned rights remain visible. Reactivation requires a new reviewed artifact and human approval.</Alert> : !documentReady ? <Alert tone="danger" title="Original unavailable">Approval is blocked until a clean, active Agreement original is linked.</Alert> : undefined}
        nextAction={<span>{active ? "Inspect the exact activated scope and audited human outcome." : !canWrite ? "Inspect the permitted documentary record in read-only mode." : approvalId ? "Choose a human decision for the exact prepared scope." : "Resolve blockers, then prepare this exact scope for human decision."}</span>}
        actions={<Button variant="secondary" onClick={() => void navigate("/representation")}>All Agreements</Button>}
      />
      {actionError ? <ReviewErrorSummary message={actionError} conflict={conflict} onReload={() => { void reload(); setApprovalId(""); setConflict(false); setActionError(""); }} /> : null}
      {!canWrite ? <Alert tone="warning" title="Read-only consequential review">Material terms and permitted history remain inspectable, but this session cannot edit terms or record an approval decision.</Alert> : null}
      <ConsequentialReviewLayout readiness={<>
        <ReadinessSummary state={readinessState} description={active ? "A named human approved the exact material-terms artifact recorded below." : "Editing a material term creates no authority. The server must validate the current artifact before a human decision can activate it."} blockers={blockers} context={<dl className="ry-review-facts"><div><dt>Agreement status</dt><dd>{readable(status)}</dd></div><div><dt>Approval reference</dt><dd>{approvalId || shown(agreement.approvalId, "Not prepared in this session")}</dd></div><div><dt>Artifact digest</dt><dd>{authorityDigest}</dd></div><div><dt>Expires</dt><dd>{date(agreement.expiresAt)}</dd></div></dl>} />
        <AuthorityIndicator value={active ? "established" : status === "suspended" ? "suspended" : status === "ended" ? "ended" : "not_established"} rationale="Only an active Agreement carrying this exact digest establishes current representation authority. Draft, reviewing, and pending states create no authority." />
      </>}>
        {active ? <ReviewOutcome title="Representation authority activated" status={status} consequence={`Only the exact scope identified by digest ${authorityDigest} is recorded as active. Ryva created no independent contractual right.`}><p>Approved by: {shown(agreement.approvedBy, "Not recorded")} · {dateTime(agreement.approvedAt)}</p></ReviewOutcome> : null}
        <ExactArtifact title="Proposed material terms scope" description="This exact stored scope—not the relationship label or a summary—is the artifact submitted to the existing server-side approval process." version={`${shown(agreement.version)} · digest ${authorityDigest}`}>{proposedScope}</ExactArtifact>
        <ValidationSummary checks={validationChecks} description="Displayed checks summarize stored facts. The existing server revalidates the original, scope, candidates, ambiguity, and artifact digest at submission." />
        <ReviewSection eyebrow="Authority and consequence" title="What this decision can establish" description="Representation Opportunity readiness, Agreement drafting, and active authority remain separate records and decisions.">
          <ul className="ry-review-list">
            <li><strong>Draft/Reviewing</strong><span>Material terms may be edited. No authority exists yet.</span></li>
            <li><strong>Approval requested</strong><span>The server prepares a Human Approval tied to the current exact artifact digest. It does not activate authority.</span></li>
            <li><strong>Human approve and activate</strong><span>Only the exact displayed scope becomes active representation authority.</span></li>
            <li><strong>Downstream use</strong><span>Placement, outreach, and commission workflows must continue to use their own validators.</span></li>
          </ul>
        </ReviewSection>
        {pending && !approvalId ? (
          <ApprovalPanel
            title="Prepare exact scope for human decision"
            readiness={<p>{readyForApproval ? "The displayed artifact can be submitted to the existing server validator." : "Resolve every failed validation before requesting approval."}</p>}
            consequence={<p>This creates a requested Human Approval tied to the current exact artifact digest. It does not activate representation authority.</p>}
            actions={<Button loading={saving} disabled={!canWrite || !readyForApproval} onClick={() => void requestApproval()}>Request exact-scope approval</Button>}
            processing={saving}
          />
        ) : null}
        {pending && approvalId ? (
          <ApprovalPanel
            title="Record the human approval decision"
            readiness={<p>The server prepared approval {approvalId} for the exact current artifact. It will revalidate the digest, scope, and ambiguity before recording the decision.</p>}
            consequence={<p>Approval activates only the displayed material-terms scope with conditions: "Authority limited to the reviewed written scope." It creates no additional right.</p>}
            actions={<Button disabled={!canWrite || saving} onClick={() => setConfirmationOpen(true)}>Human approve and activate</Button>}
            processing={saving}
          />
        ) : null}
        {pending ? (
          <ReviewSection title="Edit material terms" description="Editing any material field returns this Agreement to Reviewing and clears a prior approval reference.">
            <form className="form-grid ry-representation-terms-form" onSubmit={(event) => void saveTerms(event)}>
              {materialTermFields.map(([key, label, type]) => (
                <Field key={key} label={label}>
                  <Input
                    type={type}
                    value={changes[key] ?? ""}
                    disabled={!canWrite}
                    onChange={(event) => setChanges((current) => ({ ...current, [key]: type === "datetime-local" && event.target.value ? new Date(event.target.value).toISOString() : event.target.value }))}
                  />
                </Field>
              ))}
              <Button type="submit" loading={saving} disabled={!canWrite || Object.keys(changes).length === 0}>Save reviewed terms</Button>
            </form>
          </ReviewSection>
        ) : null}
        <ReviewSection eyebrow="Extraction review" title="Evidence-linked term candidates" description="AI may later suggest candidates, but it cannot approve or interpret them. This interface records manual/imported candidates only.">
          {candidates.length === 0 ? (
            <EmptyState compact description="No candidate has been recorded." />
          ) : (
            <ul className="ry-relationship-evidence-list">
              {candidates.map((item) => (
                <li key={item.id}>
                  <strong>{shown(item.fieldName)}</strong>
                  <small>{shown(item.proposedValue)} · {shown(item.sourceLocation)}</small>
                  <StatusLabel value={String(item.status)} />
                  {item.status === "proposed" && canWrite ? (
                    <span className="ry-button-group">
                      <Button variant="tertiary" disabled={saving} onClick={() => void reviewCandidate(item, "confirmed")}>Confirm</Button>
                      <Button variant="tertiary" disabled={saving} onClick={() => void reviewCandidate(item, "rejected")}>Reject</Button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {["draft", "reviewing"].includes(status) && canWrite ? (
            <form className="form-grid ry-representation-candidate-form" onSubmit={(event) => void proposeCandidate(event)}>
              <Field label="Material field">
                <Select value={candidateField} onChange={(event) => setCandidateField(event.target.value)}>
                  {materialFieldOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              </Field>
              <Field label="Extracted value"><Input required value={candidateValue} onChange={(event) => setCandidateValue(event.target.value)} /></Field>
              <Field label="Document page/section"><Input required value={sourceLocation} onChange={(event) => setSourceLocation(event.target.value)} /></Field>
              <Checkbox label="Legal ambiguity requires review" checked={ambiguous} onChange={(event) => setAmbiguous(event.target.checked)} />
              <Button variant="secondary" disabled={saving}>Record candidate</Button>
            </form>
          ) : null}
        </ReviewSection>
        <ReviewSection title="Written account restrictions" description="The platform does not infer account protection. Only a written rule cited to the immutable original is recorded here.">
          {restrictions.length === 0 ? (
            <EmptyState compact description="None recorded. The platform does not infer account protection." />
          ) : (
            <ul className="ry-relationship-evidence-list">
              {restrictions.map((item) => (
                <li key={item.id}>
                  <strong>{shown(item.accountName)}</strong>
                  <small>{shown(item.sourceLocation)}</small>
                  <StatusLabel value={String(item.restrictionType)} />
                </li>
              ))}
            </ul>
          )}
          {["draft", "reviewing"].includes(status) && canWrite ? (
            <form className="form-grid ry-representation-restriction-form" onSubmit={(event) => void addRestriction(event)}>
              <Field label="Written rule type">
                <Select value={restrictionType} onChange={(event) => setRestrictionType(event.target.value)}>
                  <option value="house_account_exclusion">House-account exclusion</option>
                  <option value="account_exclusion">Account exclusion</option>
                  <option value="protected_account_basis">Protected-account basis</option>
                </Select>
              </Field>
              <Field label="Business named in writing">
                <Select required value={restrictionBusinessId} onChange={(event) => setRestrictionBusinessId(event.target.value)}>
                  <option value="">Select Business</option>
                  {businesses.map((item) => <option key={item.id} value={String(item.id)}>{String(item.name)}</option>)}
                </Select>
              </Field>
              <Field label="Original page/section"><Input required value={restrictionLocation} onChange={(event) => setRestrictionLocation(event.target.value)} /></Field>
              <Button variant="secondary" disabled={saving}>Record written basis</Button>
            </form>
          ) : null}
        </ReviewSection>
        {active ? (
          <ReviewSection title="Lifecycle" description="Suspending or ending authority preserves history and commercial continuity tasks.">
            <div className="ry-button-group">
              <Button variant="secondary" disabled={!canWrite || saving} onClick={() => void end("suspended")}>Suspend authority</Button>
              <Button variant="destructive" disabled={!canWrite || saving} onClick={() => void end("ended")}>End authority</Button>
            </div>
          </ReviewSection>
        ) : null}
        <ReviewSection title="Immutable version history">
          <AuditHistory entries={auditEntries} empty="No Agreement version has been recorded." label={`${shown(agreement.brandName)} Agreement version history`} />
        </ReviewSection>
      </ConsequentialReviewLayout>
      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm human approval and activation"
        description={`You are deciding approval ${approvalId} against artifact digest ${authorityDigest}.`}
        consequence={<><strong>Human approve and activate exact scope</strong><p>The server may activate only the exact displayed scope after revalidation.</p><p>Conditions: Authority limited to the reviewed written scope.</p></>}
        confirmLabel="Human approve and activate"
        confirmVariant="primary"
        processing={saving}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={() => void activate()}
      />
      <Drawer open={documentOpen} title={shown(agreement.documentName, "Agreement original")} description="Stored original-document metadata. The immutable original remains governed by the existing Documents workflow." onClose={() => setDocumentOpen(false)} size="standard">
        <dl className="ry-review-facts">
          <div><dt>Document status</dt><dd><StatusLabel value={shown(agreement.documentStatus)} /></dd></div>
          <div><dt>Scan status</dt><dd><StatusLabel value={shown(agreement.documentScanStatus)} /></dd></div>
          <div><dt>SHA-256</dt><dd><code>{shown(agreement.documentSha256)}</code></dd></div>
          <div><dt>Source document ID</dt><dd>{shown(agreement.sourceDocumentId)}</dd></div>
        </dl>
        <Link className="ry-button ry-button-secondary" to="/documents">Open Documents register</Link>
      </Drawer>
    </div>
  );
}
