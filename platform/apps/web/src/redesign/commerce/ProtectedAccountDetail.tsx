import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  ApprovalPanel,
  AuditHistory,
  AuthorityIndicator,
  Button,
  ConfirmationDialog,
  Drawer,
  ErrorState,
  Field,
  IdentityHeader,
  LoadingState,
  Radio,
  StatusLabel,
  TextArea
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
import { dateShown, shown, type Row } from "./utils";

export function ProtectedAccountDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const { data, loading, error, reload } = useLoad(
    () => api<Record<string, unknown>>(`/api/protected-accounts/${id}`), [id]
  );
  const protection = data?.protection as Row | undefined;
  const [approvalId, setApprovalId] = useState("");
  const [condition, setCondition] = useState("Approved only as the reviewed document states; Ryva creates no independent rights.");
  const [decision, setDecision] = useState<"approved" | "rejected" | "changes_required" | "">("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const submissionGuard = useRef(false);

  useEffect(() => {
    if (actionError) document.querySelector<HTMLElement>("[data-review-error]")?.focus();
  }, [actionError]);

  async function requestApproval() {
    if (!canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true); setActionError("");
    setConflict(false);
    try {
      const result = await api<{ approval: Row }>(`/api/protected-accounts/${id}/approval`, { method: "POST" });
      setApprovalId(result.approval.id); await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Approval could not be requested.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); submissionGuard.current = false; }
  }
  async function decide() {
    if (!approvalId || !decision || !canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true); setActionError("");
    setConflict(false);
    try {
      await api(`/api/protected-accounts/${id}/approval/${approvalId}`, {
        method: "POST", body: { decision, conditions: condition }
      });
      setConfirmationOpen(false);
      setApprovalId("");
      setDecision("");
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Protection decision could not be recorded.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
      setConfirmationOpen(false);
    } finally { setSaving(false); submissionGuard.current = false; }
  }
  const loadingTrail = <RelationshipTrail items={[{ label: "Protected Accounts", to: "/protected-accounts" }, { label: loading ? "Loading protection review" : "Protection unavailable" }]} />;
  if (loading) return <div className="page ry-consequential-page">{loadingTrail}<IdentityHeader eyebrow="Consequential review · documentary protection" title="Loading protection review" status={<StatusLabel value="loading" />} /><LoadingState label="Loading exact documentary scope and approval context" /></div>;
  if (error || !protection) return <div className="page ry-consequential-page">{loadingTrail}<IdentityHeader eyebrow="Consequential review · documentary protection" title="Protection unavailable" /><ErrorState message={error || "Protection record not found."} action={<Button variant="secondary" onClick={() => void reload()}>Try again</Button>} /></div>;
  const events = (data?.events ?? []) as Row[];
  const documents = (data?.documents ?? []) as Row[];
  const conflicts = (data?.conflicts ?? []) as Row[];
  const status = shown(protection.status);
  const pending = status === "pending";
  const active = status === "active" || status === "expiring";
  const ended = ["expired","released","ended"].includes(status);
  const documentedBasis = shown(protection.supporting_basis_status) === "documented";
  const documentReady = shown(protection.basisDocumentStatus) === "active" && shown(protection.basisDocumentScanStatus) === "clean";
  const conflictItems = conflicts.filter((item) => ["possible","blocking"].includes(shown(item.status)));
  const exactDigest = shown(protection.rights_digest, "Digest unavailable");
  const readinessState: ReviewReadiness = conflict ? "stale" : !canWrite ? "restricted" : active ? "completed" : pending && documentedBasis && documentReady && conflictItems.length === 0 ? (approvalId ? "ready" : "requires_review") : "blocked";
  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "This session cannot record a protection decision."] : []),
    ...(!documentedBasis ? ["The supporting basis is not classified as documented."] : []),
    ...(!documentReady ? ["The basis document is not both active and clean."] : []),
    ...(conflictItems.length ? [`${conflictItems.length} unresolved conflict signal(s) require resolution before activation.`] : []),
    ...(!pending && !active ? [`Status ${status.replaceAll("_", " ")} is not eligible for initial approval.`] : []),
    ...(conflict ? ["The approval reference or exact artifact is no longer current. Reload and prepare a fresh review."] : [])
  ];
  const validationChecks: ValidationCheck[] = [
    { id: "basis", label: "Documentary basis", detail: documentedBasis ? "The stored basis classification is documented." : `Stored basis status is ${shown(protection.supporting_basis_status)}.`, state: documentedBasis ? "passed" : "failed" },
    { id: "document", label: "Immutable source availability", detail: documentReady ? `${shown(protection.basisDocumentName)} is active and clean.` : "A clean, active basis document is required.", state: documentReady ? "passed" : "failed" },
    { id: "scope", label: "Exact proposed scope", detail: `Version ${shown(protection.version)} and rights digest ${exactDigest} identify the proposed artifact.`, state: exactDigest === "Digest unavailable" ? "failed" : "passed" },
    { id: "conflicts", label: "Conflict review", detail: conflictItems.length ? `${conflictItems.length} possible or blocking conflict(s) remain.` : "No possible or blocking Placement conflict is returned with this review.", state: conflictItems.length ? "failed" : "passed" },
    { id: "agreement", label: "Agreement authority", detail: "An Agreement reference is stored, but this page response does not independently establish current representation authority.", state: "requires_review" },
    { id: "human", label: "Human confirmation", detail: protection.human_confirmed ? `Confirmed ${dateShown(protection.approval_date)}.` : "No active human confirmation is recorded.", state: protection.human_confirmed ? "passed" : "requires_review" }
  ];
  const auditEntries = events.map((item, index) => ({
    id: `${shown(item.eventType)}-${shown(item.occurredAt)}-${index}`,
    action: shown(item.eventType).replaceAll("_", " ").replaceAll(".", " · "),
    actor: shown(item.origin, "Ryva commercial record"),
    outcome: <StatusLabel value={shown(item.eventType).split(".").at(-1) ?? "recorded"} />,
    timestamp: item.occurredAt ? new Date(shown(item.occurredAt)).toLocaleString() : "Time not recorded",
    detail: shown(item.reason, "No rationale recorded")
  }));
  const proposedScope = <dl className="ry-review-facts">
    <div><dt>Account relationship</dt><dd><Link to={`/accounts/${shown(protection.account_id)}`}>{shown(protection.brandName)} → {shown(protection.businessName)}</Link></dd></div>
    <div><dt>Basis document</dt><dd><button type="button" className="text-button" onClick={() => setDocumentOpen(true)}>{shown(protection.basisDocumentName)}</button></dd></div>
    <div><dt>Scope summary</dt><dd>{shown(protection.scope_summary)}</dd></div>
    <div><dt>Products</dt><dd>{Array.isArray(protection.product_ids) ? protection.product_ids.join(", ") : "No Product scope recorded"}</dd></div>
    <div><dt>Channels</dt><dd>{Array.isArray(protection.channels) ? protection.channels.join(", ") : "No channel scope recorded"}</dd></div>
    <div><dt>Territory</dt><dd><code>{JSON.stringify(protection.territory_scope ?? {})}</code></dd></div>
    <div><dt>Term</dt><dd>{dateShown(protection.protection_starts_on)} – {dateShown(protection.protection_ends_on)} · {shown(protection.protection_term)}</dd></div>
    <div><dt>Commission rights</dt><dd>{shown(protection.commission_rights)}</dd></div>
    <div><dt>Reorder rights</dt><dd>{shown(protection.reorder_rights)}</dd></div>
    <div><dt>House-account exclusions</dt><dd>{shown(protection.house_account_exclusions, "None documented")}</dd></div>
    <div><dt>Release terms</dt><dd>{shown(protection.release_terms, "None documented")}</dd></div>
    <div><dt>Conflict notes</dt><dd>{shown(protection.conflict_notes, "No conflict notes recorded")}</dd></div>
  </dl>;
  const decisionLabel = decision === "approved" ? "Activate exactly documented protection" : decision === "rejected" ? "Reject this protection proposal" : "Require changes before a new decision";

  return <div className="page ry-consequential-page">
    <RelationshipTrail items={[{ label: "Protected Accounts", to: "/protected-accounts" }, { label: `${shown(protection.brandName)} → ${shown(protection.businessName)}` }]} />
    <IdentityHeader
      eyebrow="Consequential review · documentary protection"
      title={`${shown(protection.brandName)} → ${shown(protection.businessName)}`}
      relationship={<span className="ry-relationship-identity-meta"><Link to={`/accounts/${shown(protection.account_id)}`}>Account</Link><Link to={`/agreements/${shown(protection.agreement_id)}`}>Governing Agreement reference</Link><span>Version {shown(protection.version)}</span></span>}
      status={<StatusLabel value={status} />}
      warning={ended ? <Alert tone="warning" title="Rights are not current">History and previously earned rights remain visible. Renewal requires new evidence and approval through the later commercial workflow.</Alert> : !documentReady ? <Alert tone="danger" title="Supporting document unavailable">Activation is blocked until a clean, active basis document is linked.</Alert> : undefined}
      nextAction={<span>{active ? "Inspect the exact activated scope and audited human outcome." : !canWrite ? "Inspect the permitted documentary record in read-only mode." : approvalId ? "Choose a human decision for the exact prepared scope." : "Resolve blockers, then prepare this exact scope for human decision."}</span>}
      actions={<Button variant="secondary" onClick={() => void navigate("/protected-accounts")}>All protection reviews</Button>}
    />
    {actionError ? <ReviewErrorSummary message={actionError} conflict={conflict} onReload={() => { void reload(); setApprovalId(""); setConflict(false); setActionError(""); }} /> : null}
    {!canWrite ? <Alert tone="warning" title="Read-only consequential review">Documentary scope and permitted history remain inspectable, but this session cannot request or record protection approval.</Alert> : null}
    <ConsequentialReviewLayout readiness={<>
      <ReadinessSummary state={readinessState} description={active ? "A named human approved the exact documentary artifact recorded below." : "A proposal creates no protection. The server must validate the current artifact before a human decision can activate it."} blockers={blockers} context={<dl className="ry-review-facts"><div><dt>Proposal status</dt><dd>{status}</dd></div><div><dt>Approval reference</dt><dd>{approvalId || shown(protection.approval_id, "Not prepared in this session")}</dd></div><div><dt>Artifact digest</dt><dd>{exactDigest}</dd></div><div><dt>Protection expiry</dt><dd>{dateShown(protection.protection_ends_on)}</dd></div></dl>} />
      <AuthorityIndicator value="requires_review" rationale="The Agreement reference and relationship do not independently establish current authority on this page." />
    </>}>
      {active ? <ReviewOutcome title="Documentary protection activated" status={status} consequence={`Only the exact scope identified by digest ${exactDigest} is recorded as active. Ryva created no independent contractual right.`}><p>Human confirmation: {protection.human_confirmed ? `recorded ${dateShown(protection.approval_date)}` : "not recorded"}</p></ReviewOutcome> : null}
      <ExactArtifact title="Proposed documentary protection scope" description="This exact stored scope—not the relationship label or a summary—is the artifact submitted to the existing server-side approval process." version={`${shown(protection.version)} · digest ${exactDigest}`}>{proposedScope}</ExactArtifact>
      <ValidationSummary checks={validationChecks} description="Displayed checks summarize stored facts. The existing server revalidates the document, overlap, current approval, and artifact digest at submission." />
      <ReviewSection eyebrow="Authority and consequence" title="What this decision can establish" description="Protection, representation authority, and Agreement authority remain separate records and decisions.">
        <ul className="ry-review-list"><li><strong>Proposal</strong><span>Pending scope is a review record only and creates no rights.</span></li><li><strong>Protected Account decision</strong><span>Approval may activate only the exact documentary scope after server validation.</span></li><li><strong>Representation and Agreement authority</strong><span>References remain inspectable, but their current authority is not inferred here.</span></li><li><strong>Downstream use</strong><span>Outreach and commission workflows must continue to use their own validators.</span></li></ul>
      </ReviewSection>
      {pending && !approvalId ? <ApprovalPanel title="Prepare exact scope for human decision" readiness={<p>{documentedBasis && documentReady && conflictItems.length === 0 ? "The displayed artifact can be submitted to the existing server validator." : "Resolve every failed validation before requesting approval."}</p>} consequence={<p>This creates a requested Human Approval tied to the current exact artifact digest. It does not activate protection.</p>} actions={<Button loading={saving} disabled={!canWrite || !documentedBasis || !documentReady || conflictItems.length > 0} onClick={() => void requestApproval()}>Request exact-scope approval</Button>} processing={saving} /> : null}
      {pending && approvalId ? <ApprovalPanel
        title="Record the human protection decision"
        readiness={<p>The server prepared approval {approvalId} for the exact current artifact. It will revalidate the digest and conflicts before recording the decision.</p>}
        consequence={<p>Approval activates only the displayed documentary scope. Rejection or required changes leave the proposal pending and create no protection.</p>}
        rationale={<><fieldset className="ry-consequence-radio-group"><legend>Human decision</legend><Radio name="protection-decision" value="approved" checked={decision === "approved"} onChange={() => setDecision("approved")} label="Approve exact scope" description="Activate only the prepared documentary artifact." disabled={saving} /><Radio name="protection-decision" value="changes_required" checked={decision === "changes_required"} onChange={() => setDecision("changes_required")} label="Require changes" description="Keep protection pending and require a new reviewed artifact." disabled={saving} /><Radio name="protection-decision" value="rejected" checked={decision === "rejected"} onChange={() => setDecision("rejected")} label="Reject proposal" description="Record rejection; no protection becomes active." disabled={saving} /></fieldset><Field label="Decision rationale or conditions" required><TextArea required rows={5} value={condition} onChange={(event) => setCondition(event.target.value)} disabled={saving} /></Field></>}
        actions={<Button disabled={!decision || !condition.trim()} onClick={() => setConfirmationOpen(true)}>Review final consequence</Button>}
        processing={saving}
      /> : null}
      <ReviewSection eyebrow="Immutable commercial history" title="Protection events">
        <AuditHistory entries={auditEntries} empty="No protection event has been recorded." label={`${shown(protection.brandName)} and ${shown(protection.businessName)} protection history`} />
      </ReviewSection>
    </ConsequentialReviewLayout>
    <ConfirmationDialog open={confirmationOpen} title="Confirm documentary protection decision" description={`You are deciding approval ${approvalId} against artifact digest ${exactDigest}.`} consequence={<><strong>{decisionLabel}</strong><p>{decision === "approved" ? "The server may activate only the exact displayed scope after revalidation." : "The proposal remains pending and no protection becomes active."}</p><p>Rationale or conditions: {condition}</p></>} confirmLabel={decision === "approved" ? "Confirm exact-scope approval" : decision === "rejected" ? "Confirm rejection" : "Require changes"} confirmVariant={decision === "approved" ? "primary" : "destructive"} processing={saving} onClose={() => setConfirmationOpen(false)} onConfirm={() => void decide()} />
    <Drawer open={documentOpen} title={shown(protection.basisDocumentName)} description="Stored basis-document metadata. The immutable original remains governed by the existing Documents workflow." onClose={() => setDocumentOpen(false)} size="standard">
      <dl className="ry-review-facts"><div><dt>Document status</dt><dd><StatusLabel value={shown(protection.basisDocumentStatus)} /></dd></div><div><dt>Scan status</dt><dd><StatusLabel value={shown(protection.basisDocumentScanStatus)} /></dd></div><div><dt>Supporting-basis status</dt><dd><StatusLabel value={shown(protection.supporting_basis_status)} /></dd></div><div><dt>Basis document ID</dt><dd>{shown(protection.basis_document_id)}</dd></div></dl>
      {documents.length ? <ReviewSection title="Linked documentary records"> <ul className="ry-review-list">{documents.map((document) => <li key={document.id}><strong>{shown(document.name)}</strong><span>{shown(document.purpose)} · {shown(document.status)} · {shown(document.scanStatus)}</span></li>)}</ul></ReviewSection> : null}
      <Link className="secondary-button" to="/documents">Open Documents register</Link>
    </Drawer>
  </div>;
}
