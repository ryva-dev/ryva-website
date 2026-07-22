import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  ActivityTimeline,
  Alert,
  Button,
  ConfirmationDialog,
  CurrencyValue,
  EmptyState,
  ErrorState,
  Field,
  IdentityHeader,
  LoadingState,
  StatusLabel,
  TextArea,
  Input
} from "../../design-system";
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
import {
  ContextRail,
  RelationshipDetailLayout,
  RelationshipSection,
  RelationshipTabPanel,
  RelationshipTabs,
  RelationshipTrail,
  StickyMobileAction
} from "../relationship/RelationshipDetail";
import { CommercialSubnav } from "./CommercialSubnav";
import {
  currency,
  dateShown,
  dateTime,
  field,
  readable,
  shown,
  type Row
} from "./utils";

type DisputeDetailPayload = {
  dispute: Row;
  events: Row[];
  notes: Row[];
  documents: Row[];
};

export function DisputeDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full"
    && session.access.capabilities.includes("operational:write");
  const tabBaseId = useId();
  const submissionGuard = useRef(false);
  const [detail, setDetail] = useState<DisputeDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [contextOpen, setContextOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [resolutionAmount, setResolutionAmount] = useState("");
  const [resolution, setResolution] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [decisionId, setDecisionId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await api<DisputeDetailPayload>(`/api/commission-disputes/${id}`);
      setDetail(payload);
      if (shown(payload.dispute.status) === "resolved") setActiveTab("resolution");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Dispute could not be loaded.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (actionError) document.querySelector<HTMLElement>("[data-review-error]")?.focus();
  }, [actionError]);

  async function resolve() {
    if (!detail || !canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      await api(`/api/commission-disputes/${id}/resolve`, {
        method: "POST",
        body: {
          version: detail.dispute.version,
          resolutionAmount,
          resolution,
          resolutionDate: new Date().toISOString().slice(0, 10),
          evidenceDocumentId: documentId,
          finalDecisionId: decisionId
        }
      });
      setConfirmationOpen(false);
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Dispute could not be resolved.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
      setConfirmationOpen(false);
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  if (loading && !detail) {
    return (
      <div className="page ry-relationship-page ry-commerce-page">
        <CommercialSubnav />
        <RelationshipTrail items={[{ label: "Commission Disputes", to: "/commission-disputes" }, { label: "Loading dispute" }]} />
        <LoadingState label="Loading dispute evidence" />
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="page ry-relationship-page ry-commerce-page">
        <CommercialSubnav />
        <RelationshipTrail items={[{ label: "Commission Disputes", to: "/commission-disputes" }, { label: "Dispute unavailable" }]} />
        <IdentityHeader eyebrow="Dispute case" title="Dispute unavailable" />
        <ErrorState message={error || "Dispute not found."} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const { dispute, events, notes, documents } = detail;
  const status = shown(dispute.status);
  const resolved = status === "resolved";
  const code = shown(dispute.currency, "USD");
  const orderNumber = shown(dispute.orderNumber);
  const title = `Order ${orderNumber}`;
  const disputedAmount = field(dispute, "disputedAmount", "disputed_amount");
  const nextAction = field(dispute, "nextAction", "next_action");
  const commissionId = shown(field(dispute, "commissionId", "commission_id"), "");
  const orderId = shown(field(dispute, "orderId", "order_id"), "");
  const agreementId = shown(field(dispute, "agreementId", "agreement_id"), "");
  const resolutionAmountStored = field(dispute, "resolutionAmount", "resolution_amount");
  const resolutionStored = field(dispute, "resolution", "resolution");
  const cleanDocuments = documents.filter((item) => shown(item.status) === "active" && shown(item.scanStatus) === "clean");
  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "This session cannot resolve disputes."] : []),
    ...(!resolutionAmount.trim() ? ["A resolved amount is required."] : []),
    ...(!resolution.trim() || resolution.trim().length < 10 ? ["A resolution rationale of at least 10 characters is required."] : []),
    ...(!documentId.trim() ? ["Resolution evidence document ID is required."] : []),
    ...(!decisionId.trim() ? ["An issued human Decision ID is required."] : []),
    ...(conflict ? ["The dispute version is no longer current. Reload before confirming."] : [])
  ];
  const readiness: ReviewReadiness = conflict
    ? "stale"
    : resolved
      ? "completed"
      : !canWrite
        ? "restricted"
        : blockers.length
          ? "blocked"
          : "requires_review";
  const checks: ValidationCheck[] = [
    {
      id: "claim",
      label: "Allegation versus proof",
      detail: "The stored reason is an allegation. It is not treated as proven fact on this page.",
      state: "requires_review"
    },
    {
      id: "evidence",
      detail: documents.length
        ? `${documents.length} linked document(s); ${cleanDocuments.length} active and clean. Presence is not verification.`
        : "Evidence unavailable — resolution is blocked until evidence is linked and current.",
      label: "Submitted evidence",
      state: documents.length ? (cleanDocuments.length ? "passed" : "requires_review") : "failed"
    },
    {
      id: "decision",
      label: "Issued human Decision",
      detail: decisionId.trim() ? `Decision ${decisionId} will be revalidated by the server.` : "Enter an issued human Decision ID.",
      state: decisionId.trim() ? "passed" : "requires_review"
    },
    {
      id: "amount",
      label: "Resolved amount",
      detail: resolutionAmount.trim() ? `Proposed resolution amount ${resolutionAmount} ${code}.` : "Enter the resolved amount.",
      state: resolutionAmount.trim() ? "passed" : "requires_review"
    }
  ];
  const activityEntries = [
    ...events.map((item, index) => ({
      id: `event-${shown(item.eventType)}-${index}`,
      title: readable(shown(item.eventType)),
      description: shown(item.reason, "No rationale recorded"),
      meta: dateTime(item.occurredAt),
      status: <StatusLabel value={shown(item.eventType).split(".").at(-1) ?? "recorded"} />
    })),
    ...notes.map((item) => ({
      id: `note-${item.id}`,
      title: "Case note",
      description: shown(item.body),
      meta: dateTime(item.createdAt),
      status: <StatusLabel value={shown(item.noteType, "note")} />
    }))
  ];
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "evidence", label: "Evidence", count: documents.length },
    { id: "resolution", label: "Resolution" },
    { id: "activity", label: "Chronology", count: events.length + notes.length }
  ];
  const primaryAction = resolved
    ? <Button variant="secondary" onClick={() => { if (commissionId) void navigate(`/commissions/${commissionId}`); }}>Open Commission</Button>
    : <Button disabled={!canWrite} onClick={() => setActiveTab("resolution")}>Review final resolution</Button>;

  return (
    <div className="page ry-relationship-page ry-commerce-page">
      <CommercialSubnav />
      <RelationshipTrail items={[{ label: "Commission Disputes", to: "/commission-disputes" }, { label: title }]} />
      <IdentityHeader
        eyebrow="Dispute case"
        title={title}
        relationship={(
          <span className="ry-relationship-identity-meta">
            <span>Version {shown(dispute.version)}</span>
            <span>{code}</span>
            {commissionId ? <Link to={`/commissions/${commissionId}`}>Commission</Link> : null}
          </span>
        )}
        status={<StatusLabel value={status} />}
        warning={(
          <Alert tone="warning" title="Dispute boundaries">
            An allegation is not proven. Submitted evidence is not verified merely because it exists.
            Withdrawal does not imply Brand correctness. Ryva does not adjudicate contractual rights.
          </Alert>
        )}
        nextAction={<span>{resolved ? "Inspect the recorded human resolution and chronology." : shown(nextAction, "Resolve blockers, then record a final human decision.")}</span>}
        actions={primaryAction}
      />
      {!canWrite ? <Alert tone="warning" title="Read-only dispute review">{session?.access.reason ?? "This session cannot resolve or mutate disputes."}</Alert> : null}
      {actionError ? (
        <ReviewErrorSummary
          message={actionError}
          conflict={conflict}
          onReload={() => { setActionError(""); setConflict(false); void load(); }}
        />
      ) : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Dispute relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout
        context={(
          <ContextRail title="Dispute context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>
            <div className="ry-context-item"><strong>Status</strong><StatusLabel value={status} /></div>
            <div className="ry-context-item"><strong>Disputed amount</strong><CurrencyValue value={disputedAmount as string} currency={code} status="actual" /></div>
            <div className="ry-context-item"><strong>Commission status</strong><StatusLabel value={shown(dispute.commissionStatus, "unknown")} /></div>
            <div className="ry-context-item"><strong>Links</strong>
              <p className="ry-commerce-actions">
                {commissionId ? <Link to={`/commissions/${commissionId}`}>Commission</Link> : null}
                {orderId ? <Link to={`/orders/${orderId}`}>Order</Link> : null}
                {agreementId ? <Link to={`/agreements/${agreementId}`}>Agreement</Link> : null}
              </p>
            </div>
          </ContextRail>
        )}
      >
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Claim and linked money states" description="Expected, approved, and paid remain distinct from the disputed allegation amount.">
            <dl className="ry-relationship-facts">
              <div><dt>Reason</dt><dd>{shown(dispute.reason)}<small>Allegation, not proven fact</small></dd></div>
              <div><dt>Reason code</dt><dd>{shown(field(dispute, "reasonCode", "reason_code"))}</dd></div>
              <div><dt>Disputed amount</dt><dd><CurrencyValue value={disputedAmount as string} currency={code} status="actual" /></dd></div>
              <div><dt>Expected / approved / paid</dt><dd>{currency(dispute.expectedAmount, code)} / {currency(dispute.approvedAmount, code)} / {currency(dispute.paidAmount, code)}</dd></div>
              <div><dt>Next action</dt><dd>{shown(nextAction)}</dd></div>
              <div><dt>Brand response</dt><dd>{shown(field(dispute, "brandResponse", "brand_response"), "No counterparty response recorded")}</dd></div>
            </dl>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="evidence" active={activeTab === "evidence"}>
          <RelationshipSection title="Submitted evidence package" description="Linked documents remain inspectable. Presence is not verification; scan and document status stay distinct.">
            {documents.length ? (
              <ul className="ry-relationship-evidence-list">
                {documents.map((item) => (
                  <li key={item.id}>
                    <strong>{shown(item.name)}</strong>
                    <small>{shown(item.purpose)} · document {shown(item.status)} · scan {shown(item.scanStatus)}</small>
                  </li>
                ))}
              </ul>
            ) : <EmptyState compact description="Evidence unavailable — resolution blocked" />}
            <Link className="ry-button ry-button-secondary" to="/documents">Open Documents</Link>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="resolution" active={activeTab === "resolution"}>
          {resolved ? (
            <ReviewOutcome
              title="Final human resolution recorded"
              status={status}
              consequence="The stored resolution amount and rationale are the audited outcome. Withdrawal or prior claims do not invent Brand correctness."
            >
              <p><strong>{currency(resolutionAmountStored, code)}</strong> · {shown(resolutionStored)}</p>
              <p>Resolution date {dateShown(field(dispute, "resolutionDate", "resolution_date"))}</p>
            </ReviewOutcome>
          ) : (
            <ConsequentialReviewLayout
              readiness={(
                <ReadinessSummary
                  state={readiness}
                  description="Resolution requires evidence, a recorded amount and rationale, and a fresh issued human Decision. The server revalidates before recording."
                  blockers={blockers}
                  context={(
                    <dl className="ry-review-facts">
                      <div><dt>Dispute</dt><dd>{title}</dd></div>
                      <div><dt>Version</dt><dd>{shown(dispute.version)}</dd></div>
                      <div><dt>Disputed amount</dt><dd>{currency(disputedAmount, code)}</dd></div>
                    </dl>
                  )}
                />
              )}
            >
              <ExactArtifact
                title="Exact dispute claim artifact"
                description="The disputed amount, allegation, and linked Commission money states below are submitted with the resolution."
                version={shown(dispute.version)}
              >
                <dl className="ry-review-facts">
                  <div><dt>Allegation</dt><dd>{shown(dispute.reason)}</dd></div>
                  <div><dt>Disputed amount</dt><dd>{currency(disputedAmount, code)}</dd></div>
                  <div><dt>Expected / approved / paid</dt><dd>{currency(dispute.expectedAmount, code)} / {currency(dispute.approvedAmount, code)} / {currency(dispute.paidAmount, code)}</dd></div>
                </dl>
              </ExactArtifact>
              <ValidationSummary checks={checks} description="Displayed checks summarize the current response. The server remains authoritative at submission." />
              <ReviewSection
                eyebrow="Final human resolution"
                title="Record final human decision"
                description="Resolution does not imply Brand correctness on withdrawal of other claims. Financial consequence is only what the server records."
              >
                <form className="ry-commerce-review-form" onSubmit={(event) => { event.preventDefault(); setConfirmationOpen(true); }}>
                  <Field label="Resolved amount">
                    <Input required inputMode="decimal" value={resolutionAmount} onChange={(event) => setResolutionAmount(event.target.value)} disabled={!canWrite || saving} />
                  </Field>
                  <Field label="Resolution rationale">
                    <TextArea required rows={5} value={resolution} onChange={(event) => setResolution(event.target.value)} disabled={!canWrite || saving} />
                  </Field>
                  <Field label="Resolution evidence document ID">
                    <Input required value={documentId} onChange={(event) => setDocumentId(event.target.value)} disabled={!canWrite || saving} />
                  </Field>
                  <Field label="Issued human Decision ID">
                    <Input required value={decisionId} onChange={(event) => setDecisionId(event.target.value)} disabled={!canWrite || saving} />
                  </Field>
                  <Button type="submit" loading={saving} disabled={!canWrite || blockers.length > 0}>Record final human decision</Button>
                </form>
              </ReviewSection>
            </ConsequentialReviewLayout>
          )}
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Immutable chronology" description="Claims, evidence, communications, and decisions remain ordered as stored events and notes.">
            <ActivityTimeline entries={activityEntries} empty="No dispute chronology has been recorded." label={`${title} chronology`} />
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm final dispute resolution"
        description={`Submit dispute for Order ${orderNumber}, version ${shown(dispute.version)}, with resolved amount ${resolutionAmount} ${code}.`}
        consequence={(
          <>
            <strong>Human resolution is consequential</strong>
            <p>The server revalidates evidence, Decision, and version before recording. This page does not adjudicate contractual rights.</p>
            <p>Rationale: {resolution}</p>
          </>
        )}
        confirmLabel="Record final human decision"
        processing={saving}
        onConfirm={() => void resolve()}
        onClose={() => setConfirmationOpen(false)}
      />
      <StickyMobileAction>{primaryAction}</StickyMobileAction>
    </div>
  );
}
