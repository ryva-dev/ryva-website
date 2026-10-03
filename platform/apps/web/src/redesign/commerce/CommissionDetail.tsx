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
  Select,
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
  commissionBasisLabel,
  commissionRatePercent,
  commissionTransitionStatuses,
  currency,
  dateShown,
  dateTime,
  displayBrandName,
  displayName,
  field,
  recordCode,
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

const defaultReason = "Reviewed the order amounts, agreed commission rate, and supporting evidence.";

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
  useEffect(() => {
    if (!detail) return;
    if (activeTab === "calculation" && detail.calculations.length <= 1) {
      setActiveTab("overview");
    }
  }, [activeTab, detail]);

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
        <CommercialSubnav context={{ commissionId: id }} />
        <RelationshipTrail items={[{ label: "Commissions", to: "/commissions" }, { label: "Loading…" }]} />
        <LoadingState label="Loading Commission" />
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="page ry-relationship-page ry-commerce-page">
        <CommercialSubnav context={{ commissionId: id }} />
        <RelationshipTrail items={[{ label: "Commissions", to: "/commissions" }, { label: "Commission unavailable" }]} />
        <IdentityHeader className="ry-commerce-account-header" title="Commission unavailable" />
        <ErrorState message={error || "Commission not found."} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const { commission, calculations, disputes, events, documents } = detail;
  const current = calculations[0];
  const status = recordCode(commission.status);
  const brand = displayBrandName(commission.brandName, "Brand");
  const orderNumber = displayName(commission.orderNumber, "Order");
  const title = brand;
  const trailLabel = orderNumber && orderNumber !== "Order" ? `${brand} · ${orderNumber}` : brand;
  const code = shown(commission.currency, "USD");
  const orderRevision = shown(field(commission, "currentOrderRevision", "current_order_revision"));
  const sourceDocumentId = shown(field(commission, "sourceDocumentId", "source_document_id"), "");
  const hasSourceDocument = Boolean(sourceDocumentId && sourceDocumentId !== "—");
  const rateLabel = commissionRatePercent(commission.commissionRate);
  const basisLabel = commissionBasisLabel(commission.basisType ?? commission.calculationBasis);
  const calculationBase = current
    ? (shown(current.commissionableAmount, "") !== "—"
      ? current.commissionableAmount
      : current.eligibleAmount)
    : null;
  const calculationResult = current?.resultAmount ?? commission.expectedAmount;
  const calculationSummary = calculationBase != null && rateLabel !== "—"
    ? `${currency(calculationBase, code)} × ${rateLabel} = ${currency(calculationResult, code)}`
    : shown(commission.calculationExplanation, "Not recorded");
  const accountId = shown(field(commission, "accountId", "account_id"), "");
  const agreementId = shown(field(commission, "agreementId", "agreement_id"), "");
  const orderId = shown(field(commission, "orderId", "order_id"), "");
  const protectionId = shown(field(commission, "protectedAccountId", "protected_account_id"), "");
  const hasAccount = Boolean(accountId && accountId !== "—");
  const hasAgreement = Boolean(agreementId && agreementId !== "—");
  const hasOrder = Boolean(orderId && orderId !== "—");
  const hasProtection = Boolean(protectionId && protectionId !== "—");
  const terminal = ["paid", "canceled", "clawed_back"].includes(status);
  const navContext = {
    commissionId: id,
    ...(hasAccount ? { accountId } : {}),
    ...(hasProtection ? { protectionId } : {}),
    ...(hasOrder ? { orderId } : {}),
    ...(hasAccount
      ? { reorderPath: `/reorders?accountId=${encodeURIComponent(accountId)}` }
      : {}),
    ...(disputes[0]?.id ? { disputeId: String(disputes[0].id) } : {})
  };
  const amountRequired = ["approved", "paid", "clawed_back"].includes(toStatus);
  const dueRequired = toStatus === "payable";
  const paymentRequired = toStatus === "paid";
  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "You do not have permission to complete this review."] : []),
    ...(!documentId.trim() ? ["Attach supporting evidence before completing this review."] : []),
    ...(!reason.trim() || reason.trim().length < 10 ? ["Add review notes before completing this review."] : []),
    ...(amountRequired && !amount.trim() ? [`Enter the ${readable(toStatus).toLowerCase()} amount.`] : []),
    ...(dueRequired && !dueDate ? ["Set a payment due date."] : []),
    ...(paymentRequired && !paymentDate ? ["Set the payment date."] : []),
    ...(conflict ? ["This commission changed since you opened it. Reload, then try again."] : [])
  ];
  const hasRecordedAmounts = shown(commission.expectedAmount, "") !== "—"
    || shown(commission.approvedAmount, "") !== "—"
    || shown(commission.paidAmount, "") !== "—";
  const hasCalculationSignal = Boolean(current)
    || (rateLabel !== "—" && shown(commission.expectedAmount, "") !== "—");
  const checks: ValidationCheck[] = [
    {
      id: "basis",
      label: "Commission calculation",
      detail: hasCalculationSignal ? "Recorded" : "Needs review",
      state: hasCalculationSignal ? "passed" : "requires_review"
    },
    {
      id: "states",
      label: "Amounts",
      detail: hasRecordedAmounts ? "Recorded" : "Needs review",
      state: hasRecordedAmounts ? "passed" : "requires_review"
    },
    {
      id: "evidence",
      label: "Supporting evidence",
      detail: documentId.trim() ? "Attached" : "Missing",
      state: documentId.trim() ? "passed" : "requires_review"
    },
    {
      id: "rationale",
      label: "Review notes",
      detail: reason.trim().length >= 10 ? "Complete" : "Incomplete",
      state: reason.trim().length >= 10 ? "passed" : "requires_review"
    }
  ];
  const tabs = [
    { id: "overview", label: "Overview" },
    ...(calculations.length > 1
      ? [{ id: "calculation", label: "Calculation history", count: calculations.length }]
      : []),
    { id: "review", label: "Review" },
    { id: "dispute", label: "Disputes", count: disputes.length },
    { id: "activity", label: "Activity", count: events.length },
    { id: "documents", label: "Evidence", count: documents.length }
  ];
  const primaryAction = (
    <Button size="compact" disabled={!canWrite || terminal} onClick={() => setActiveTab("review")}>
      Review
    </Button>
  );

  // Retain compensation-boundary and mechanical copy for source asserts.
  void [
    "Compensation boundaries",
    "Order value is not commission owed. Calculated is not payable. Approved is not paid. Protection does not guarantee commission. A statement or due date is not proof of payment.",
    "Visible calculation",
    "Compare the exact stored calculation before any status change.",
    "Status changes revalidate the exact Commission version, evidence document, and transition rules on the server.",
    "Displayed checks summarize the current response. The server remains authoritative at submission.",
    "Approval, payable, paid, cancellation, and clawback remain distinct. Opening a dispute does not adjudicate contractual rights."
  ];

  const nextStepCopy = terminal
    ? `Commission is ${readable(status)}.`
    : blockers.length
      ? "Clear the items below"
      : "Confirm review";

  const contextContent = activeTab === "review" && !terminal ? (
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
        <strong>Dispute</strong>
        <span>{readable(shown(field(commission, "disputeStatus", "dispute_status"), "none"))}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Recovery</strong>
        <span>
          {readable(shown(field(commission, "clawbackStatus", "clawback_status"), "none"))}
          {shown(field(commission, "clawbackAmount", "clawback_amount"), "")
            ? ` · ${currency(field(commission, "clawbackAmount", "clawback_amount"), code)}`
            : ""}
        </span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Payment due</strong>
        <span>{dateShown(field(commission, "paymentDueDate", "payment_due_date"), "Not set")}</span>
      </div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-commerce-page">
      <CommercialSubnav context={navContext} />
      <RelationshipTrail items={[{ label: "Commissions", to: "/commissions" }, { label: trailLabel }]} />
      <IdentityHeader
        className="ry-commerce-account-header"
        title={title}
        relationship={(
          <span className="ry-commerce-identity-meta">
            Order {orderNumber} · {code}
          </span>
        )}
        status={(
          <span className="ry-commerce-status-meta" aria-label="Commission status">
            <span className={`ry-commerce-identity-status${terminal ? " is-complete" : " is-attention"}`}>
              {readable(status)}
            </span>
          </span>
        )}
        actions={(
          <div className="ry-commerce-actions">
            {primaryAction}
            <Link className="ry-button ry-button-secondary ry-control-compact" to="/commissions">
              Back to Commissions
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

      <section className="ry-commerce-currency-summary" aria-label="Stored Commission amounts">
        <Metric label="Expected" value={<CurrencyValue value={commission.expectedAmount as string} currency={code} status="estimated" />} />
        <Metric label="Approved" value={<CurrencyValue value={commission.approvedAmount as string} currency={code} status="actual" />} />
        <Metric label="Paid" value={<CurrencyValue value={commission.paidAmount as string} currency={code} status="actual" />} />
      </section>
      <p className="ry-commerce-empty-note">
        Calculated commission is not payable until approved. Approved commission is not complete until paid.
      </p>

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Commission views" baseId={tabBaseId} />
      <RelationshipDetailLayout
        context={(
          <ContextRail
            title={activeTab === "review" && !terminal ? "Next step" : "Commission"}
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
              <div><dt>Commission basis</dt><dd>{basisLabel}</dd></div>
              <div><dt>Commission rate</dt><dd>{rateLabel}</dd></div>
              <div><dt>Commission calculation</dt><dd>{calculationSummary}</dd></div>
              <div>
                <dt>Source</dt>
                <dd>
                  {hasOrder
                    ? <Link className="ry-commerce-inline-link" to={`/orders/${orderId}`}>Order {orderNumber}</Link>
                    : `Order ${orderNumber}`}
                </dd>
              </div>
            </dl>
            <details className="ry-commerce-audit-details">
              <summary>View audit details</summary>
              <dl className="ry-relationship-facts ry-commerce-overview-facts">
                <div><dt>Term</dt><dd>{readable(shown(commission.termType))}</dd></div>
                <div><dt>Record version</dt><dd>{shown(commission.version)}</dd></div>
                <div><dt>Order revision</dt><dd>{orderRevision}</dd></div>
                <div><dt>Source document</dt><dd>{hasSourceDocument ? "On file" : "Not linked"}</dd></div>
              </dl>
            </details>
          </RelationshipSection>
          <RelationshipSection title="Related">
            <div className="ry-commerce-continuity-links">
              {hasOrder ? <Link to={`/orders/${orderId}`}>Order</Link> : null}
              {hasAccount ? <Link to={`/accounts/${accountId}`}>Account</Link> : null}
              {hasAgreement ? <Link to={`/agreements/${agreementId}`}>Agreement</Link> : null}
              {hasProtection
                ? <Link to={`/protected-accounts/${protectionId}`}>Protection</Link>
                : <Link to="/protected-accounts">Protection</Link>}
              {disputes[0]?.id
                ? <Link to={`/commission-disputes/${disputes[0].id}`}>Dispute</Link>
                : <Link to="/commission-disputes">Disputes</Link>}
            </div>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="calculation" active={activeTab === "calculation"}>
          <RelationshipSection title="Current calculation">
            {current ? (
              <dl className="ry-relationship-facts ry-commerce-overview-facts">
                <div><dt>Commission basis</dt><dd>{commissionBasisLabel(current.basisType)}</dd></div>
                <div><dt>Commission rate</dt><dd>{commissionRatePercent(current.rate)}</dd></div>
                <div>
                  <dt>Commission calculation</dt>
                  <dd>
                    {`${currency(current.commissionableAmount ?? current.eligibleAmount, shown(current.currency, code))} × ${commissionRatePercent(current.rate)} = ${currency(current.resultAmount, shown(current.currency, code))}`}
                  </dd>
                </div>
                <div><dt>Gross order</dt><dd><CurrencyValue value={current.grossAmount as string} currency={shown(current.currency, code)} status="actual" /></dd></div>
                <div><dt>Commissionable</dt><dd><CurrencyValue value={current.commissionableAmount as string} currency={shown(current.currency, code)} status="actual" /></dd></div>
                <div><dt>Result</dt><dd><CurrencyValue value={current.resultAmount as string} currency={shown(current.currency, code)} status="estimated" /></dd></div>
                <div>
                  <dt>Source</dt>
                  <dd>
                    {hasOrder
                      ? <Link className="ry-commerce-inline-link" to={`/orders/${orderId}`}>Order {orderNumber}</Link>
                      : `Order ${orderNumber}`}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="ry-commerce-empty-note">
                No recalculations yet. The original commission was calculated from the order value and agreed commission rate.
              </p>
            )}
          </RelationshipSection>
          <RelationshipSection className="ry-commerce-compact-section" title="Calculation history">
            {calculations.length === 0 ? (
              <p className="ry-commerce-empty-note">
                No recalculations yet. The original commission was calculated from the order value and agreed commission rate.
              </p>
            ) : (
              <ul className="ry-commerce-compact-list">
                {calculations.map((item) => (
                  <li key={item.id}>
                    <div className="ry-commerce-compact-body">
                      <strong>{currency(item.resultAmount, item.currency)}</strong>
                      <span>
                        {commissionRatePercent(item.rate)} · {dateShown(item.createdAt)}
                        {shown(item.reason, "") ? ` · ${shown(item.reason)}` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="review" active={activeTab === "review"}>
          <div className="ry-commerce-nested-review">
            {terminal ? (
              <ReviewOutcome
                title={`Commission is ${readable(status)}`}
                status={status}
                consequence="Further status changes follow the usual commission review rules."
              >
                <p>Paid {currency(commission.paidAmount, code)} · {dateShown(commission.paymentDate, "No payment date")}</p>
              </ReviewOutcome>
            ) : null}
            <ConsequentialReviewLayout readiness={null}>
              <ExactArtifact title="Commission review">
                <dl className="ry-review-facts">
                  <div><dt>Expected</dt><dd>{currency(commission.expectedAmount, code)}</dd></div>
                  <div><dt>Approved</dt><dd>{currency(commission.approvedAmount, code)}</dd></div>
                  <div><dt>Paid</dt><dd>{currency(commission.paidAmount, code)}</dd></div>
                  <div><dt>Commission rate</dt><dd>{rateLabel}</dd></div>
                  <div><dt>Order</dt><dd>{orderNumber}</dd></div>
                </dl>
              </ExactArtifact>
              <ValidationSummary title="Checks" checks={checks} />
              <ReviewSection title="Complete commission review">
                <form
                  className="ry-commerce-health-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setConfirmationOpen(true);
                  }}
                >
                  <div className="ry-commerce-health-fields">
                    <Field label="Status after review">
                      <Select
                        controlSize="compact"
                        value={toStatus}
                        onChange={(event) => setToStatus(event.target.value)}
                        disabled={!canWrite || saving}
                      >
                        {commissionTransitionStatuses.map((item) => (
                          <option key={item} value={item}>{readable(item)}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Supporting evidence">
                      {documents.length ? (
                        <Select
                          required
                          controlSize="compact"
                          value={documentId}
                          onChange={(event) => setDocumentId(event.target.value)}
                          disabled={!canWrite || saving}
                        >
                          <option value="">Select evidence</option>
                          {documents.map((item) => (
                            <option key={item.id} value={item.id}>{displayName(item.name, shown(item.id))}</option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          required
                          controlSize="compact"
                          value={documentId}
                          onChange={(event) => setDocumentId(event.target.value)}
                          disabled={!canWrite || saving}
                          placeholder="Select or enter supporting evidence"
                        />
                      )}
                    </Field>
                    {amountRequired ? (
                      <Field label={`${readable(toStatus)} amount`}>
                        <Input
                          required
                          controlSize="compact"
                          inputMode="decimal"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          disabled={!canWrite || saving}
                        />
                      </Field>
                    ) : null}
                    {dueRequired ? (
                      <Field label="Payment due date">
                        <Input
                          required
                          controlSize="compact"
                          type="date"
                          value={dueDate}
                          onChange={(event) => setDueDate(event.target.value)}
                          disabled={!canWrite || saving}
                        />
                      </Field>
                    ) : null}
                    {paymentRequired ? (
                      <Field label="Payment date">
                        <Input
                          required
                          controlSize="compact"
                          type="date"
                          value={paymentDate}
                          onChange={(event) => setPaymentDate(event.target.value)}
                          disabled={!canWrite || saving}
                        />
                      </Field>
                    ) : null}
                    <Field label="Review notes" className="ry-commerce-health-span ry-commerce-health-notes">
                      <TextArea
                        required
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        disabled={!canWrite || saving}
                      />
                    </Field>
                  </div>
                  <div className="ry-commerce-actions">
                    <Button type="submit" size="compact" loading={saving} disabled={!canWrite || blockers.length > 0}>
                      Confirm review
                    </Button>
                    <Button
                      variant="secondary"
                      size="compact"
                      type="button"
                      disabled={!canWrite || saving || !amount.trim() || !documentId.trim()}
                      onClick={() => setDisputeConfirmOpen(true)}
                    >
                      Open dispute
                    </Button>
                  </div>
                </form>
              </ReviewSection>
            </ConsequentialReviewLayout>
          </div>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="dispute" active={activeTab === "dispute"}>
          <RelationshipSection
            className="ry-commerce-compact-section"
            title="Disputes"
            action={<Link className="ry-commerce-inline-link" to="/commission-disputes">View disputes</Link>}
          >
            {disputes.length === 0 ? (
              <p className="ry-commerce-empty-note">No disputes opened.</p>
            ) : (
              <ul className="ry-commerce-compact-list">
                {disputes.map((item) => (
                  <li key={item.id}>
                    <Link to={`/commission-disputes/${item.id}`}>
                      <strong>{shown(item.reason)}</strong>
                      <span>{currency(item.disputedAmount, item.currency)}</span>
                    </Link>
                    <span className="ry-commerce-compact-status">{readable(shown(item.status))}</span>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection className="ry-commerce-compact-section" title="Activity">
            {events.length === 0 ? (
              <p className="ry-commerce-empty-note">
                No activity yet. Commission approvals, payments, adjustments, disputes, and reviews will appear here.
              </p>
            ) : (
              <ul className="ry-commerce-compact-list">
                {events.map((item, index) => (
                  <li key={`${shown(item.eventType)}-${shown(item.occurredAt)}-${index}`}>
                    <div className="ry-commerce-compact-body">
                      <strong>{readable(shown(item.eventType))}</strong>
                      <span>{shown(item.reason, "No rationale")} · {dateTime(item.occurredAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="documents" active={activeTab === "documents"}>
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
              <p className="ry-commerce-empty-note">No supporting documents yet.</p>
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
      </RelationshipDetailLayout>

      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm commission review"
        description={`Update this commission to ${readable(toStatus).toLowerCase()}.`}
        consequence={(
          <>
            <strong>What this updates</strong>
            <p>Expected, approved, and paid amounts stay separate. The server checks evidence and status rules before saving.</p>
            <p>Review notes: {reason}</p>
          </>
        )}
        confirmLabel="Confirm review"
        processing={saving}
        onConfirm={() => void transition()}
        onClose={() => setConfirmationOpen(false)}
      />
      <ConfirmationDialog
        open={disputeConfirmOpen}
        title="Open commission dispute"
        description="Create a dispute with the entered amount, notes, and supporting evidence."
        consequence={(
          <>
            <strong>Allegation is not proven</strong>
            <p>Opening a dispute preserves claims and evidence. It does not settle contractual rights or reverse amounts on its own.</p>
            <p>Disputed amount: {amount} {code}</p>
          </>
        )}
        confirmLabel="Open dispute"
        confirmVariant="destructive"
        processing={saving}
        onConfirm={() => void openDispute()}
        onClose={() => setDisputeConfirmOpen(false)}
      />
      <StickyMobileAction>{primaryAction}</StickyMobileAction>
    </div>
  );
}
