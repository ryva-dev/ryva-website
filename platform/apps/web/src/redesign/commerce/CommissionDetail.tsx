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
  Metric,
  Select,
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
  commissionTransitionStatuses,
  currency,
  dateShown,
  dateTime,
  field,
  readable,
  shown,
  type Row
} from "./utils";

type CommissionDetailPayload = {
  commission: Row;
  calculations: Row[];
  disputes: Row[];
  events: Row[];
  documents: Row[];
};

const defaultReason = "Human reviewed the Agreement rule, exact Order revision, adjustments, and supporting evidence.";

export function CommissionDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full"
    && session.access.capabilities.includes("operational:write");
  const tabBaseId = useId();
  const submissionGuard = useRef(false);
  const [detail, setDetail] = useState<CommissionDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [contextOpen, setContextOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [disputeConfirmOpen, setDisputeConfirmOpen] = useState(false);
  const [toStatus, setToStatus] = useState("pending_verification");
  const [documentId, setDocumentId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [reason, setReason] = useState(defaultReason);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDetail(await api<CommissionDetailPayload>(`/api/commissions/${id}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Commission could not be loaded.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (actionError) document.querySelector<HTMLElement>("[data-review-error]")?.focus();
  }, [actionError]);

  async function transition() {
    if (!detail || !canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      await api(`/api/commissions/${id}/status`, {
        method: "POST",
        body: {
          version: detail.commission.version,
          toStatus,
          reason,
          sourceDocumentId: documentId,
          verifiedAmount: toStatus === "approved" ? amount : null,
          approvedAmount: toStatus === "approved" ? amount : null,
          paidAmount: toStatus === "paid" ? amount : null,
          paymentDueDate: toStatus === "payable" ? dueDate : null,
          paymentDate: toStatus === "paid" ? paymentDate : null,
          clawbackAmount: toStatus === "clawed_back" ? amount : null
        }
      });
      setConfirmationOpen(false);
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Commission state could not be changed.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
      setConfirmationOpen(false);
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  async function openDispute() {
    if (!detail || !canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      const result = await api<{ dispute: Row }>(`/api/commissions/${id}/disputes`, {
        method: "POST",
        body: {
          reasonCode: "amount_or_eligibility",
          reason,
          disputedAmount: amount,
          evidenceDocumentId: documentId,
          nextAction: "Prepare and approve a factual evidence request to the Brand."
        }
      });
      setDisputeConfirmOpen(false);
      void navigate(`/commission-disputes/${result.dispute.id}`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Dispute could not be opened.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
      setDisputeConfirmOpen(false);
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  if (loading && !detail) {
    return (
      <div className="page ry-relationship-page ry-commerce-page">
        <CommercialSubnav />
        <RelationshipTrail items={[{ label: "Commissions", to: "/commissions" }, { label: "Loading Commission" }]} />
        <LoadingState label="Loading Commission formula and evidence" />
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="page ry-relationship-page ry-commerce-page">
        <CommercialSubnav />
        <RelationshipTrail items={[{ label: "Commissions", to: "/commissions" }, { label: "Commission unavailable" }]} />
        <IdentityHeader eyebrow="Commission detail" title="Commission unavailable" />
        <ErrorState message={error || "Commission not found."} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const { commission, calculations, disputes, events, documents } = detail;
  const current = calculations[0];
  const status = shown(commission.status);
  const title = `${shown(commission.brandName)} · ${shown(commission.orderNumber)}`;
  const code = shown(commission.currency, "USD");
  const accountId = shown(field(commission, "accountId", "account_id"), "");
  const agreementId = shown(field(commission, "agreementId", "agreement_id"), "");
  const orderId = shown(field(commission, "orderId", "order_id"), "");
  const protectionId = shown(field(commission, "protectedAccountId", "protected_account_id"), "");
  const amountRequired = ["approved", "paid", "clawed_back"].includes(toStatus);
  const dueRequired = toStatus === "payable";
  const paymentRequired = toStatus === "paid";
  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "This session cannot change Commission status."] : []),
    ...(!documentId.trim() ? ["A clean evidence document ID is required."] : []),
    ...(!reason.trim() || reason.trim().length < 10 ? ["A factual human rationale of at least 10 characters is required."] : []),
    ...(amountRequired && !amount.trim() ? [`A stored ${readable(toStatus)} amount is required.`] : []),
    ...(dueRequired && !dueDate ? ["A payment due date is required for payable status."] : []),
    ...(paymentRequired && !paymentDate ? ["A payment date is required for paid status."] : []),
    ...(conflict ? ["The Commission version is no longer current. Reload before confirming."] : [])
  ];
  const readiness: ReviewReadiness = conflict
    ? "stale"
    : ["paid", "canceled", "clawed_back"].includes(status) && toStatus === status
      ? "completed"
      : !canWrite
        ? "restricted"
        : blockers.length
          ? "blocked"
          : "requires_review";
  const checks: ValidationCheck[] = [
    {
      id: "basis",
      label: "Stored calculation basis",
      detail: current
        ? `Formula and Order revision ${shown(current.orderRevision)} are returned by the server.`
        : "No current calculation. Commission advancement is blocked until a stored calculation exists.",
      state: current ? "passed" : "failed"
    },
    {
      id: "states",
      label: "Distinct money states",
      detail: `Expected ${currency(commission.expectedAmount, code)}, approved ${currency(commission.approvedAmount, code)}, paid ${currency(commission.paidAmount, code)}. Calculated is not payable; approved is not paid.`,
      state: "requires_review"
    },
    {
      id: "evidence",
      label: "Evidence document",
      detail: documentId.trim() ? `Document ${documentId} will be revalidated by the server.` : "Enter a clean evidence document ID.",
      state: documentId.trim() ? "passed" : "requires_review"
    },
    {
      id: "rationale",
      label: "Human rationale",
      detail: reason.trim().length >= 10 ? "A rationale is ready for confirmation." : "Enter a factual rationale.",
      state: reason.trim().length >= 10 ? "passed" : "requires_review"
    }
  ];
  const activityEntries = events.map((item, index) => ({
    id: `${shown(item.eventType)}-${shown(item.occurredAt)}-${index}`,
    title: readable(shown(item.eventType)),
    description: shown(item.reason, "No rationale recorded"),
    meta: dateTime(item.occurredAt),
    status: <StatusLabel value={shown(item.eventType).split(".").at(-1) ?? "recorded"} />
  }));
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "calculation", label: "Calculation", count: calculations.length },
    { id: "review", label: "Human review" },
    { id: "dispute", label: "Dispute", count: disputes.length },
    { id: "activity", label: "Activity", count: events.length },
    { id: "documents", label: "Evidence", count: documents.length }
  ];
  const primaryAction = (
    <Button disabled={!canWrite} onClick={() => setActiveTab("review")}>
      Review consequential state
    </Button>
  );

  return (
    <div className="page ry-relationship-page ry-commerce-page">
      <CommercialSubnav />
      <RelationshipTrail items={[{ label: "Commissions", to: "/commissions" }, { label: title }]} />
      <IdentityHeader
        eyebrow="Commission detail"
        title={title}
        relationship={(
          <span className="ry-relationship-identity-meta">
            <span>{code}</span>
            <span>Version {shown(commission.version)}</span>
            <span>Order revision {shown(field(commission, "currentOrderRevision", "current_order_revision"))}</span>
          </span>
        )}
        status={<StatusLabel value={status} />}
        warning={(
          <Alert tone="warning" title="Compensation boundaries">
            Order value is not commission owed. Calculated is not payable. Approved is not paid.
            Protection does not guarantee commission. A statement or due date is not proof of payment.
          </Alert>
        )}
        nextAction={<span>{canWrite ? "Compare the exact stored calculation before any human status change." : "Inspect the permitted calculation and history in read-only mode."}</span>}
        actions={primaryAction}
      />
      {!canWrite ? <Alert tone="warning" title="Read-only Commission review">{session?.access.reason ?? "This session cannot approve, mark payable/paid, or open disputes."}</Alert> : null}
      {actionError ? (
        <ReviewErrorSummary
          message={actionError}
          conflict={conflict}
          onReload={() => { setActionError(""); setConflict(false); void load(); }}
        />
      ) : null}

      <section className="ry-commerce-currency-summary" aria-label="Stored Commission amounts">
        <Metric label="Expected" value={<CurrencyValue value={commission.expectedAmount as string} currency={code} status="estimated" />} definition="System calculation. Estimate, not guaranteed income." />
        <Metric label="Approved" value={<CurrencyValue value={commission.approvedAmount as string} currency={code} status="actual" />} definition="Human-confirmed. Approved is not paid." />
        <Metric
          label="Paid"
          value={<CurrencyValue value={commission.paidAmount as string} currency={code} status="actual" />}
          definition={commission.paymentDate ? `Human-confirmed on ${dateShown(commission.paymentDate)}.` : "No payment confirmed. Due date is not receipt."}
        />
      </section>

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Commission relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout
        context={(
          <ContextRail title="Commission context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>
            <div className="ry-context-item"><strong>Status</strong><StatusLabel value={status} /></div>
            <div className="ry-context-item"><strong>Dispute status</strong><StatusLabel value={shown(field(commission, "disputeStatus", "dispute_status"), "none")} /></div>
            <div className="ry-context-item"><strong>Clawback</strong><StatusLabel value={shown(field(commission, "clawbackStatus", "clawback_status"), "none")} /><small>{currency(field(commission, "clawbackAmount", "clawback_amount"), code)}</small></div>
            <div className="ry-context-item"><strong>Payment due</strong><p>{dateShown(field(commission, "paymentDueDate", "payment_due_date"), "Not set")}</p><small>Due date is not payment received</small></div>
            <div className="ry-context-item"><strong>Links</strong>
              <p className="ry-commerce-actions">
                {orderId ? <Link to={`/orders/${orderId}`}>Order</Link> : null}
                {accountId ? <Link to={`/accounts/${accountId}`}>Account</Link> : null}
                {agreementId ? <Link to={`/agreements/${agreementId}`}>Agreement</Link> : null}
                {protectionId ? <Link to={`/protected-accounts/${protectionId}`}>Protection</Link> : <Link to="/protected-accounts">Protection register</Link>}
              </p>
            </div>
          </ContextRail>
        )}
      >
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Stored compensation identity" description="Amounts and statuses below are server-stored. Analytics forecasts and unsupported summaries are outside this page.">
            <dl className="ry-relationship-facts">
              <div><dt>Calculation basis</dt><dd>{shown(commission.calculationBasis)}</dd></div>
              <div><dt>Term / basis / rate</dt><dd>{readable(shown(commission.termType))} · {shown(commission.basisType)} × {shown(commission.commissionRate)}</dd></div>
              <div><dt>Explanation</dt><dd>{shown(commission.calculationExplanation, "No stored explanation")}</dd></div>
              <div><dt>Source document</dt><dd>{shown(field(commission, "sourceDocumentId", "source_document_id"), "Not linked")}</dd></div>
            </dl>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="calculation" active={activeTab === "calculation"}>
          <RelationshipSection title="Visible calculation" description="Displayed formula and inputs come from the current server calculation. This page does not recompute contractual logic.">
            {current ? (
              <>
                <p className="ry-commerce-formula">{shown(current.formula)}</p>
                <dl className="ry-relationship-facts">
                  <div><dt>Gross Order</dt><dd><CurrencyValue value={current.grossAmount as string} currency={shown(current.currency, code)} status="actual" /></dd></div>
                  <div><dt>Eligible amount</dt><dd><CurrencyValue value={current.eligibleAmount as string} currency={shown(current.currency, code)} status="actual" /></dd></div>
                  <div><dt>Discounts / returns / cancellations</dt><dd>{currency(current.discounts, current.currency)} / {currency(current.returns, current.currency)} / {currency(current.cancellations, current.currency)}</dd></div>
                  <div><dt>Commissionable amount</dt><dd><CurrencyValue value={current.commissionableAmount as string} currency={shown(current.currency, code)} status="actual" /></dd></div>
                  <div><dt>Basis and rate</dt><dd>{shown(current.basisType)} · {shown(current.rate)}</dd></div>
                  <div><dt>Result</dt><dd><CurrencyValue value={current.resultAmount as string} currency={shown(current.currency, code)} status="estimated" /></dd></div>
                  <div><dt>Rounding</dt><dd>{shown(current.roundingRule)}</dd></div>
                  <div><dt>Source versions</dt><dd>Agreement {shown(current.agreementId)} · Order revision {shown(current.orderRevision)}</dd></div>
                </dl>
              </>
            ) : <EmptyState compact description="No current calculation. Commission advancement is blocked." />}
          </RelationshipSection>
          <RelationshipSection title="Immutable calculations" description="Prior calculation versions remain reproducible.">
            {calculations.length ? (
              <ul className="ry-relationship-evidence-list">
                {calculations.map((item) => (
                  <li key={item.id}>
                    <strong>Version {shown(item.calculationVersion)} · {currency(item.resultAmount, item.currency)}</strong>
                    <small>{shown(item.reason)} · Order revision {shown(item.orderRevision)} · {dateShown(item.createdAt)}</small>
                  </li>
                ))}
              </ul>
            ) : <EmptyState compact description="No calculation history." />}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="review" active={activeTab === "review"}>
          {["paid", "canceled", "clawed_back"].includes(status) ? (
            <ReviewOutcome
              title={`Commission is ${readable(status)}`}
              status={status}
              consequence="Further transitions remain governed by server rules. Paid does not invent a bank receipt beyond the stored payment date and amount."
            >
              <p>Paid amount {currency(commission.paidAmount, code)} · Payment date {dateShown(commission.paymentDate, "Not recorded")}</p>
            </ReviewOutcome>
          ) : null}
          <ConsequentialReviewLayout
            readiness={(
              <ReadinessSummary
                state={readiness}
                description="Status changes revalidate the exact Commission version, evidence document, and transition rules on the server."
                blockers={blockers}
                context={(
                  <dl className="ry-review-facts">
                    <div><dt>Commission</dt><dd>{title}</dd></div>
                    <div><dt>Version</dt><dd>{shown(commission.version)}</dd></div>
                    <div><dt>Current status</dt><dd>{status}</dd></div>
                    <div><dt>Proposed status</dt><dd>{toStatus}</dd></div>
                  </dl>
                )}
              />
            )}
          >
            <ExactArtifact
              title="Exact stored Commission amounts"
              description="Expected, approved, paid, basis, and rate below are the artifact submitted with the consequential status change."
              version={shown(commission.version)}
            >
              <dl className="ry-review-facts">
                <div><dt>Expected</dt><dd>{currency(commission.expectedAmount, code)}</dd></div>
                <div><dt>Approved</dt><dd>{currency(commission.approvedAmount, code)}</dd></div>
                <div><dt>Paid</dt><dd>{currency(commission.paidAmount, code)}</dd></div>
                <div><dt>Basis / rate</dt><dd>{shown(commission.basisType)} · {shown(commission.commissionRate)}</dd></div>
                {current ? <div><dt>Current formula</dt><dd>{shown(current.formula)}</dd></div> : null}
              </dl>
            </ExactArtifact>
            <ValidationSummary checks={checks} description="Displayed checks summarize the current response. The server remains authoritative at submission." />
            <ReviewSection
              eyebrow="Human confirmation"
              title="Confirm consequential state"
              description="Approval, payable, paid, cancellation, and clawback remain distinct. Opening a dispute does not adjudicate contractual rights."
            >
              <form className="ry-commerce-review-form" onSubmit={(event) => { event.preventDefault(); setConfirmationOpen(true); }}>
                <Field label="Next status">
                  <Select value={toStatus} onChange={(event) => setToStatus(event.target.value)} disabled={!canWrite || saving}>
                    {commissionTransitionStatuses.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
                  </Select>
                </Field>
                <Field label="Clean evidence document ID">
                  <Input required value={documentId} onChange={(event) => setDocumentId(event.target.value)} disabled={!canWrite || saving} />
                </Field>
                {amountRequired ? (
                  <Field label={`${readable(toStatus)} amount`}>
                    <Input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!canWrite || saving} />
                  </Field>
                ) : null}
                {dueRequired ? (
                  <Field label="Payment due date">
                    <Input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={!canWrite || saving} />
                  </Field>
                ) : null}
                {paymentRequired ? (
                  <Field label="Payment date">
                    <Input required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} disabled={!canWrite || saving} />
                  </Field>
                ) : null}
                <Field label="Human rationale">
                  <TextArea required rows={5} value={reason} onChange={(event) => setReason(event.target.value)} disabled={!canWrite || saving} />
                </Field>
                <div className="ry-commerce-actions">
                  <Button type="submit" loading={saving} disabled={!canWrite || blockers.length > 0}>Confirm consequential state</Button>
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={!canWrite || saving || !amount.trim() || !documentId.trim()}
                    onClick={() => setDisputeConfirmOpen(true)}
                  >
                    Open documented dispute
                  </Button>
                </div>
              </form>
            </ReviewSection>
          </ConsequentialReviewLayout>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="dispute" active={activeTab === "dispute"}>
          <RelationshipSection title="Linked disputes" description="An allegation is not proven. Opening a dispute preserves evidence and chronology; Ryva does not adjudicate.">
            {disputes.length ? (
              <ul className="ry-relationship-evidence-list">
                {disputes.map((item) => (
                  <li key={item.id}>
                    <strong>{shown(item.reason)}</strong>
                    <small>{currency(item.disputedAmount, item.currency)} · {shown(item.status)}</small>
                    <Link to={`/commission-disputes/${item.id}`}>Open case</Link>
                  </li>
                ))}
              </ul>
            ) : <EmptyState compact description="No disputes. Open one from a documented variance with evidence." />}
            <Link className="ry-button ry-button-secondary" to="/commission-disputes">Open dispute register</Link>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Payment and adjustment history" description="Stored commercial events for this Commission.">
            <ActivityTimeline entries={activityEntries} empty="No Commission activity has been recorded." label={`${title} activity`} />
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="documents" active={activeTab === "documents"}>
          <RelationshipSection title="Linked evidence" description="Document presence is not verification. Scan and status remain distinct.">
            {documents.length ? (
              <ul className="ry-relationship-evidence-list">
                {documents.map((item) => (
                  <li key={item.id}>
                    <strong>{shown(item.name)}</strong>
                    <small>{shown(item.purpose)} · {shown(item.status)} · {shown(item.scanStatus)}</small>
                  </li>
                ))}
              </ul>
            ) : <EmptyState compact description="No linked commercial documents." />}
            <Link className="ry-button ry-button-secondary" to="/documents">Open Documents</Link>
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm consequential Commission state"
        description={`Submit Commission ${title}, version ${shown(commission.version)}, for transition to ${readable(toStatus)}.`}
        consequence={(
          <>
            <strong>{readable(toStatus)} is distinct from other money states</strong>
            <p>Expected remains an estimate. Approved is not paid. Payable due dates are not receipts. The server revalidates version, evidence, and transition rules.</p>
            <p>Rationale: {reason}</p>
          </>
        )}
        confirmLabel="Confirm consequential state"
        processing={saving}
        onConfirm={() => void transition()}
        onClose={() => setConfirmationOpen(false)}
      />
      <ConfirmationDialog
        open={disputeConfirmOpen}
        title="Open documented Commission dispute"
        description="Create a dispute case with the entered amount, rationale, and evidence document."
        consequence={(
          <>
            <strong>Allegation is not proven</strong>
            <p>Opening a dispute preserves claims and evidence. It does not adjudicate contractual rights or reverse amounts unless stored rules later record that outcome.</p>
            <p>Disputed amount: {amount} {code}</p>
          </>
        )}
        confirmLabel="Open documented dispute"
        confirmVariant="destructive"
        processing={saving}
        onConfirm={() => void openDispute()}
        onClose={() => setDisputeConfirmOpen(false)}
      />
      <StickyMobileAction>{primaryAction}</StickyMobileAction>
    </div>
  );
}
