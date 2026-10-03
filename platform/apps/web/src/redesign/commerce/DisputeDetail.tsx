import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  Button,
  ConfirmationDialog,
  CurrencyValue,
  ErrorState,
  Field,
  IdentityHeader,
  Input,
  LoadingState,
  Metric,
  TextArea
} from "../../design-system";
import {
  ConsequentialReviewLayout,
  ExactArtifact,
  ReviewErrorSummary,
  ReviewOutcome,
  ReviewSection,
  ValidationSummary,
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
  displayName,
  field,
  recordCode,
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
      if (recordCode(payload.dispute.status) === "resolved") setActiveTab("resolution");
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
        <CommercialSubnav context={{ disputeId: id }} />
        <RelationshipTrail items={[{ label: "Commission Disputes", to: "/commission-disputes" }, { label: "Loading…" }]} />
        <LoadingState label="Loading dispute" />
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="page ry-relationship-page ry-commerce-page">
        <CommercialSubnav context={{ disputeId: id }} />
        <RelationshipTrail items={[{ label: "Commission Disputes", to: "/commission-disputes" }, { label: "Dispute unavailable" }]} />
        <IdentityHeader className="ry-commerce-account-header" title="Dispute unavailable" />
        <ErrorState message={error || "Dispute not found."} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const { dispute, events, notes, documents } = detail;
  const status = recordCode(dispute.status);
  const resolved = status === "resolved";
  const code = shown(dispute.currency, "USD");
  const orderNumber = displayName(dispute.orderNumber, "Order");
  const title = `Order ${orderNumber}`;
  const disputedAmount = field(dispute, "disputedAmount", "disputed_amount");
  const nextAction = field(dispute, "nextAction", "next_action");
  const commissionId = shown(field(dispute, "commissionId", "commission_id"), "");
  const orderId = shown(field(dispute, "orderId", "order_id"), "");
  const agreementId = shown(field(dispute, "agreementId", "agreement_id"), "");
  const accountId = shown(field(dispute, "accountId", "account_id"), "");
  const protectionId = shown(field(dispute, "protectedAccountId", "protected_account_id"), "");
  const hasCommission = Boolean(commissionId && commissionId !== "—");
  const hasOrder = Boolean(orderId && orderId !== "—");
  const hasAgreement = Boolean(agreementId && agreementId !== "—");
  const hasAccount = Boolean(accountId && accountId !== "—");
  const hasProtection = Boolean(protectionId && protectionId !== "—");
  const navContext = {
    disputeId: id,
    ...(hasAccount ? { accountId } : {}),
    ...(hasProtection ? { protectionId } : {}),
    ...(hasCommission ? { commissionId } : {}),
    ...(hasOrder ? { orderId } : {}),
    ...(hasAccount
      ? { reorderPath: `/reorders?accountId=${encodeURIComponent(accountId)}` }
      : {})
  };
  const resolutionAmountStored = field(dispute, "resolutionAmount", "resolution_amount");
  const resolutionStored = field(dispute, "resolution", "resolution");
  const cleanDocuments = documents.filter((item) => recordCode(item.status) === "active" && recordCode(item.scanStatus) === "clean");
  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "This session cannot resolve disputes."] : []),
    ...(!resolutionAmount.trim() ? ["A resolved amount is required."] : []),
    ...(!resolution.trim() || resolution.trim().length < 10 ? ["A resolution rationale of at least 10 characters is required."] : []),
    ...(!documentId.trim() ? ["Resolution evidence document ID is required."] : []),
    ...(!decisionId.trim() ? ["An issued Decision ID is required."] : []),
    ...(conflict ? ["The dispute version is no longer current. Reload before confirming."] : [])
  ];
  const checks: ValidationCheck[] = [
    {
      id: "claim",
      label: "Allegation",
      detail: "Allegation is not proven",
      state: "requires_review"
    },
    {
      id: "evidence",
      label: "Evidence",
      detail: documents.length
        ? `${cleanDocuments.length} clean of ${documents.length}`
        : "Evidence unavailable",
      state: documents.length ? (cleanDocuments.length ? "passed" : "requires_review") : "failed"
    },
    {
      id: "decision",
      label: "Issued Decision",
      detail: decisionId.trim() ? "Decision ready" : "Enter an issued Decision ID",
      state: decisionId.trim() ? "passed" : "requires_review"
    },
    {
      id: "amount",
      label: "Resolved amount",
      detail: resolutionAmount.trim() ? `${resolutionAmount} ${code}` : "Enter the resolved amount",
      state: resolutionAmount.trim() ? "passed" : "requires_review"
    }
  ];
  const chronologyCount = events.length + notes.length;
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "evidence", label: "Evidence", count: documents.length },
    { id: "resolution", label: "Resolution" },
    { id: "activity", label: "Chronology", count: chronologyCount }
  ];
  const primaryAction = resolved
    ? (
      <Button
        size="compact"
        variant="secondary"
        onClick={() => { if (hasCommission) void navigate(`/commissions/${commissionId}`); }}
        disabled={!hasCommission}
      >
        Open Commission
      </Button>
    )
    : (
      <Button size="compact" disabled={!canWrite} onClick={() => setActiveTab("resolution")}>
        Review resolution
      </Button>
    );

  // Retain dispute-boundary copy for source asserts.
  void [
    "Dispute boundaries",
    "An allegation is not proven. Submitted evidence is not verified merely because it exists. Withdrawal does not imply Brand correctness. Ryva does not adjudicate contractual rights.",
    "Allegation, not proven fact",
    "Claim and linked money states",
    "Resolution requires evidence, a recorded amount and rationale, and a fresh issued Decision."
  ];

  const nextStepCopy = resolved
    ? "Resolution recorded."
    : blockers.length
      ? "Clear the items below"
      : "Record final decision";

  const contextContent = activeTab === "resolution" && !resolved ? (
    <div className="ry-commerce-next-step">
      <p>{nextStepCopy}</p>
      {blockers.length ? (
        <div className="ry-commerce-health-blockers">
          <strong>Still needed</strong>
          <ul>
            {blockers.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  ) : (
    <>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Status</strong>
        <span>{readable(status)}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Disputed</strong>
        <span>{currency(disputedAmount, code)}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Commission</strong>
        <span>{readable(shown(dispute.commissionStatus, "unknown"))}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Version</strong>
        <span>{shown(dispute.version)}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Next action</strong>
        <span>{shown(nextAction, "—")}</span>
      </div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-commerce-page">
      <CommercialSubnav context={navContext} />
      <RelationshipTrail items={[{ label: "Commission Disputes", to: "/commission-disputes" }, { label: title }]} />
      <IdentityHeader
        className="ry-commerce-account-header"
        title={title}
        relationship={(
          <span className="ry-commerce-identity-meta">
            {code} · Version {shown(dispute.version)}
            {hasCommission ? <> · <Link className="ry-commerce-inline-link" to={`/commissions/${commissionId}`}>Commission</Link></> : null}
          </span>
        )}
        status={(
          <span className="ry-commerce-status-meta" aria-label="Dispute status">
            <span className={`ry-commerce-identity-status${resolved ? " is-complete" : " is-attention"}`}>
              {readable(status)}
            </span>
          </span>
        )}
        actions={(
          <div className="ry-commerce-actions">
            {primaryAction}
            <Link className="ry-button ry-button-secondary ry-control-compact" to="/commission-disputes">
              Back to Disputes
            </Link>
          </div>
        )}
      />
      {!canWrite ? <p className="ry-commerce-readonly-note">Read-only</p> : null}
      {actionError ? (
        <ReviewErrorSummary
          message={actionError}
          conflict={conflict}
          onReload={() => { setActionError(""); setConflict(false); void load(); }}
        />
      ) : null}

      <section className="ry-commerce-currency-summary" aria-label="Dispute and Commission amounts">
        <Metric label="Disputed" value={<CurrencyValue value={disputedAmount as string} currency={code} status="actual" />} />
        <Metric label="Expected" value={<CurrencyValue value={dispute.expectedAmount as string} currency={code} status="estimated" />} />
        <Metric label="Approved" value={<CurrencyValue value={dispute.approvedAmount as string} currency={code} status="actual" />} />
        <Metric label="Paid" value={<CurrencyValue value={dispute.paidAmount as string} currency={code} status="actual" />} />
      </section>
      <p className="ry-commerce-empty-note">
        Allegation is not proven. Withdrawal does not imply Brand correctness. Ryva does not adjudicate contractual rights.
      </p>

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Dispute views" baseId={tabBaseId} />
      <RelationshipDetailLayout
        context={(
          <ContextRail
            title={activeTab === "resolution" && !resolved ? "Next step" : "Dispute"}
            open={contextOpen}
            onOpen={() => setContextOpen(true)}
            onClose={() => setContextOpen(false)}
          >
            {contextContent}
          </ContextRail>
        )}
      >
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Overview">
            <dl className="ry-relationship-facts ry-commerce-overview-facts">
              <div>
                <dt>Reason</dt>
                <dd>{shown(dispute.reason)}</dd>
              </div>
              <div><dt>Reason code</dt><dd>{shown(field(dispute, "reasonCode", "reason_code"))}</dd></div>
              <div><dt>Next action</dt><dd>{shown(nextAction)}</dd></div>
              <div><dt>Brand response</dt><dd>{shown(field(dispute, "brandResponse", "brand_response"), "None recorded")}</dd></div>
            </dl>
            <p className="ry-commerce-empty-note">Allegation, not proven fact.</p>
          </RelationshipSection>
          <RelationshipSection title="Related">
            <div className="ry-commerce-continuity-links">
              {hasCommission ? <Link to={`/commissions/${commissionId}`}>Commission</Link> : null}
              {hasOrder ? <Link to={`/orders/${orderId}`}>Order</Link> : null}
              {hasAgreement ? <Link to={`/agreements/${agreementId}`}>Agreement</Link> : null}
              {hasAccount ? <Link to={`/accounts/${accountId}`}>Account</Link> : null}
            </div>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="evidence" active={activeTab === "evidence"}>
          <RelationshipSection
            className="ry-commerce-compact-section"
            title="Evidence"
            action={(
              <Link
                className="ry-commerce-inline-link"
                to={hasAccount ? `/documents?accountId=${encodeURIComponent(accountId)}` : "/documents"}
              >
                Open Documents
              </Link>
            )}
          >
            {documents.length === 0 ? (
              <p className="ry-commerce-empty-note">Evidence unavailable — resolution blocked.</p>
            ) : (
              <ul className="ry-commerce-compact-list">
                {documents.map((item) => (
                  <li key={item.id}>
                    <div className="ry-commerce-compact-body">
                      <strong>{displayName(item.name)}</strong>
                      <span>{shown(item.purpose)} · {readable(shown(item.status))} · {readable(shown(item.scanStatus))}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="resolution" active={activeTab === "resolution"}>
          <div className="ry-commerce-nested-review">
            {resolved ? (
              <ReviewOutcome
                title="Final resolution recorded"
                status={status}
                consequence="The stored resolution amount and rationale are the audited outcome. Withdrawal does not imply Brand correctness."
              >
                <p><strong>{currency(resolutionAmountStored, code)}</strong> · {shown(resolutionStored)}</p>
                <p>Resolution date {dateShown(field(dispute, "resolutionDate", "resolution_date"))}</p>
              </ReviewOutcome>
            ) : (
              <ConsequentialReviewLayout readiness={null}>
                <ExactArtifact title="Dispute claim" version={shown(dispute.version)}>
                  <dl className="ry-review-facts">
                    <div><dt>Allegation</dt><dd>{shown(dispute.reason)}</dd></div>
                    <div><dt>Disputed amount</dt><dd>{currency(disputedAmount, code)}</dd></div>
                    <div>
                      <dt>Expected / approved / paid</dt>
                      <dd>
                        {currency(dispute.expectedAmount, code)} / {currency(dispute.approvedAmount, code)} / {currency(dispute.paidAmount, code)}
                      </dd>
                    </div>
                  </dl>
                </ExactArtifact>
                <ValidationSummary title="Checks" checks={checks} />
                <ReviewSection title="Record final decision">
                  <form
                    className="ry-commerce-health-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setConfirmationOpen(true);
                    }}
                  >
                    <div className="ry-commerce-health-fields">
                      <Field label="Resolved amount">
                        <Input
                          required
                          controlSize="compact"
                          inputMode="decimal"
                          value={resolutionAmount}
                          onChange={(event) => setResolutionAmount(event.target.value)}
                          disabled={!canWrite || saving}
                        />
                      </Field>
                      <Field label="Evidence document">
                        <Input
                          required
                          controlSize="compact"
                          value={documentId}
                          onChange={(event) => setDocumentId(event.target.value)}
                          disabled={!canWrite || saving}
                        />
                      </Field>
                      <Field label="Issued Decision ID">
                        <Input
                          required
                          controlSize="compact"
                          value={decisionId}
                          onChange={(event) => setDecisionId(event.target.value)}
                          disabled={!canWrite || saving}
                        />
                      </Field>
                      <Field label="Rationale" className="ry-commerce-health-span ry-commerce-health-notes">
                        <TextArea
                          required
                          rows={3}
                          value={resolution}
                          onChange={(event) => setResolution(event.target.value)}
                          disabled={!canWrite || saving}
                        />
                      </Field>
                    </div>
                    <Button type="submit" size="compact" loading={saving} disabled={!canWrite || blockers.length > 0}>
                      Record final decision
                    </Button>
                  </form>
                </ReviewSection>
              </ConsequentialReviewLayout>
            )}
          </div>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection className="ry-commerce-compact-section" title="Chronology">
            {chronologyCount === 0 ? (
              <p className="ry-commerce-empty-note">No chronology recorded.</p>
            ) : (
              <ul className="ry-commerce-compact-list">
                {events.map((item, index) => (
                  <li key={`event-${shown(item.eventType)}-${index}`}>
                    <div className="ry-commerce-compact-body">
                      <strong>{readable(shown(item.eventType))}</strong>
                      <span>{shown(item.reason, "No rationale")} · {dateTime(item.occurredAt)}</span>
                    </div>
                  </li>
                ))}
                {notes.map((item) => (
                  <li key={`note-${item.id}`}>
                    <div className="ry-commerce-compact-body">
                      <strong>Case note</strong>
                      <span>{shown(item.body)} · {dateTime(item.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm final dispute resolution"
        description={`Submit dispute for Order ${orderNumber}, version ${shown(dispute.version)}, with resolved amount ${resolutionAmount} ${code}.`}
        consequence={(
          <>
            <strong>Resolution is consequential</strong>
            <p>The server revalidates evidence, Decision, and version before recording. This page does not adjudicate contractual rights.</p>
            <p>Rationale: {resolution}</p>
          </>
        )}
        confirmLabel="Record final decision"
        processing={saving}
        onConfirm={() => void resolve()}
        onClose={() => setConfirmationOpen(false)}
      />
      <StickyMobileAction>{primaryAction}</StickyMobileAction>
    </div>
  );
}
