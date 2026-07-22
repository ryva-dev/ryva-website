import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  ActivityTimeline,
  Alert,
  Button,
  ConfirmationDialog,
  DataRow,
  EmptyState,
  ErrorState,
  Field,
  IdentityHeader,
  LoadingState,
  StatusLabel,
  Table,
  TextArea
} from "../../design-system";
import {
  ConsequentialReviewLayout,
  ExactArtifact,
  ReadinessSummary,
  ReviewErrorSummary,
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

type OrderDetailPayload = {
  order: Row;
  lines: Row[];
  revisions: Row[];
  commissions: Row[];
  events: Row[];
};

const defaultVerificationNotes = "I compared the Order identity, Products, quantities, values, adjustments, payment/fulfillment state, and immutable source.";

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const tabBaseId = useId();
  const submissionGuard = useRef(false);
  const [detail, setDetail] = useState<OrderDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(defaultVerificationNotes);
  const [activeTab, setActiveTab] = useState("overview");
  const [contextOpen, setContextOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDetail(await api<OrderDetailPayload>(`/api/orders/${id}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Order could not be loaded.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (actionError) document.querySelector<HTMLElement>("[data-review-error]")?.focus();
  }, [actionError]);

  async function confirm() {
    if (!detail || !canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      await api(`/api/orders/${id}/confirm`, {
        method: "POST",
        body: { version: detail.order.version, verificationNotes: notes }
      });
      setConfirmationOpen(false);
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Order could not be verified.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
      setConfirmationOpen(false);
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  if (loading && !detail) {
    return <div className="page ry-relationship-page ry-commerce-page"><CommercialSubnav /><RelationshipTrail items={[{ label: "Orders", to: "/orders" }, { label: "Loading Order" }]} /><LoadingState label="Loading Order evidence and calculation" /></div>;
  }
  if (error || !detail) {
    return <div className="page ry-relationship-page ry-commerce-page"><CommercialSubnav /><RelationshipTrail items={[{ label: "Orders", to: "/orders" }, { label: "Order unavailable" }]} /><IdentityHeader eyebrow="Order detail" title="Order unavailable" /><ErrorState message={error || "Order not found."} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /></div>;
  }

  const { order, lines, revisions, commissions, events } = detail;
  const orderNumber = shown(order.orderNumber);
  const verificationStatus = shown(order.verificationStatus);
  const verified = verificationStatus === "verified";
  const accountId = shown(field(order, "accountId", "account_id"), "");
  const protectionId = shown(field(order, "protectedAccountId", "protected_account_id"), "");
  const placementId = shown(field(order, "placementId", "placement_id"), "");
  const sourceDocumentId = shown(field(order, "sourceDocumentId", "source_document_id"));
  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "This session cannot confirm an Order."] : []),
    ...(!sourceDocumentId || sourceDocumentId === "—" ? ["A stored source document is required."] : []),
    ...(!lines.length ? ["At least one stored Order line is required."] : []),
    ...(!notes.trim() ? ["Verification rationale is required."] : []),
    ...(conflict ? ["The Order version is no longer current. Reload before confirming."] : [])
  ];
  const readiness: ReviewReadiness = conflict ? "stale" : verified ? "completed" : !canWrite ? "restricted" : blockers.length ? "blocked" : "requires_review";
  const checks: ValidationCheck[] = [
    { id: "source", label: "Immutable source", detail: sourceDocumentId === "—" ? "No source document is stored." : `Source document ${sourceDocumentId} is stored.`, state: sourceDocumentId === "—" ? "failed" : "passed" },
    { id: "lines", label: "Stored line items", detail: `${lines.length} line item${lines.length === 1 ? "" : "s"} returned for this Order version.`, state: lines.length ? "passed" : "failed" },
    { id: "status", label: "Separate operational states", detail: `Order ${shown(order.status)}, payment ${shown(order.paymentStatus)}, fulfillment ${shown(order.fulfillmentStatus)}, verification ${verificationStatus}.`, state: "requires_review" },
    { id: "rationale", label: "Human verification rationale", detail: notes.trim() ? "A rationale is ready for confirmation." : "Enter a factual comparison rationale.", state: notes.trim() ? "passed" : "requires_review" }
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
    { id: "lines", label: "Lines", count: lines.length },
    { id: "verification", label: "Verification" },
    { id: "account", label: "Account/Protection links" },
    { id: "activity", label: "Activity", count: events.length },
    { id: "commission", label: "Commission context", count: commissions.length }
  ];
  const formula = (
    <p className="formula">
      {currency(order.wholesaleGross, order.currency)} gross − {currency(order.discounts, order.currency)} discounts − {currency(order.returns, order.currency)} returns − {currency(order.cancellations, order.currency)} cancellations = <strong>{currency(order.netCommissionable, order.currency)}</strong>
    </p>
  );
  const lineTable = (
    <Table caption={`Line items for Order ${orderNumber}`}>
      <thead><tr><th>Product</th><th>Quantity</th><th>Gross</th><th>Discount</th><th>Return</th><th>Cancellation</th><th>Eligible net</th></tr></thead>
      <tbody>{lines.map((line) => (
        <DataRow key={line.id}>
          <td>{shown(line.productName)}<small>{shown(line.description)}</small></td>
          <td>{shown(line.quantity)} × {currency(line.unitWholesalePrice, order.currency)}</td>
          <td>{currency(line.grossAmount, order.currency)}</td>
          <td>{currency(line.discountAmount, order.currency)}</td>
          <td>{currency(line.returnAmount, order.currency)}</td>
          <td>{currency(line.cancellationAmount, order.currency)}</td>
          <td>{line.commissionEligible ? currency(line.netCommissionable, order.currency) : "Not eligible"}</td>
        </DataRow>
      ))}</tbody>
    </Table>
  );
  const primaryAction = verified
    ? (accountId ? <Button onClick={() => void navigate(`/accounts/${accountId}`)}>Open Account</Button> : <Button disabled>Verified</Button>)
    : <Button disabled={!canWrite} onClick={() => setActiveTab("verification")}>Review verification</Button>;

  return (
    <div className="page ry-relationship-page ry-commerce-page">
      <CommercialSubnav />
      <RelationshipTrail items={[{ label: "Orders", to: "/orders" }, { label: orderNumber }]} />
      <IdentityHeader
        eyebrow="Order detail"
        title={orderNumber}
        relationship={<span className="ry-relationship-identity-meta"><span>{dateShown(order.orderDate)}</span><span>{shown(order.currency)}</span><span>Version {shown(order.version)}</span></span>}
        status={<StatusLabel value={verificationStatus} />}
        warning={<Alert tone="warning" title="Commercial boundaries">Order is not protection; value is not commission owed; Placement is not Account.</Alert>}
        nextAction={<span>{verified ? "Verification is recorded. Review the linked Account and downstream records separately." : "Compare the exact source-backed artifact before human confirmation."}</span>}
        actions={primaryAction}
      />
      {!canWrite ? <Alert tone="warning" title="Read-only Order review">{session?.access.reason ?? "This session cannot confirm Orders."}</Alert> : null}
      {actionError ? <ReviewErrorSummary message={actionError} conflict={conflict} onReload={() => { setActionError(""); setConflict(false); void load(); }} /> : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Order relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={<ContextRail title="Order context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>
        <div className="ry-context-item"><strong>Order status</strong><StatusLabel value={shown(order.status)} /></div>
        <div className="ry-context-item"><strong>Payment status</strong><StatusLabel value={shown(order.paymentStatus)} /></div>
        <div className="ry-context-item"><strong>Fulfillment status</strong><StatusLabel value={shown(order.fulfillmentStatus)} /></div>
        <div className="ry-context-item"><strong>Verification</strong><StatusLabel value={verificationStatus} /></div>
      </ContextRail>}>
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Explainable Order formula" description="Every displayed amount is a stored Order amount. This page does not derive or invent missing values.">
            {formula}
            <dl className="ry-relationship-facts">
              <div><dt>Gross wholesale</dt><dd>{currency(order.wholesaleGross, order.currency)}</dd></div>
              <div><dt>Discounts</dt><dd>{currency(order.discounts, order.currency)}</dd></div>
              <div><dt>Returns</dt><dd>{currency(order.returns, order.currency)}</dd></div>
              <div><dt>Cancellations</dt><dd>{currency(order.cancellations, order.currency)}</dd></div>
              <div><dt>Net commissionable</dt><dd>{currency(order.netCommissionable, order.currency)} · system calculation, not a payment guarantee</dd></div>
              <div><dt>Source document</dt><dd>{sourceDocumentId}</dd></div>
              <div><dt>Current immutable revision</dt><dd>{shown(order.currentRevision)}</dd></div>
            </dl>
          </RelationshipSection>
          <RelationshipSection title="Revision history" description="Corrections preserve prior immutable revisions.">
            {revisions.length ? <ul className="ry-relationship-evidence-list">{revisions.map((revision) => <li key={shown(revision.revision)}><strong>Revision {shown(revision.revision)}</strong><small>{shown(revision.reason)} · {dateShown(revision.changedAt)}</small></li>)}</ul> : <EmptyState compact description="No prior revisions." />}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="lines" active={activeTab === "lines"}>
          <RelationshipSection title="Line items" description="Stored quantities, prices, adjustments, eligibility, and net amounts for the current revision.">{lineTable}</RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="verification" active={activeTab === "verification"}>
          {verified ? (
            <RelationshipSection title="Verified Order" description={`Verified by a named human on ${dateShown(order.verifiedAt)}.`}>
              {accountId ? <Link className="ry-button ry-button-secondary" to={`/accounts/${accountId}`}>Open Account</Link> : <p>The linked Account is not returned in this response.</p>}
            </RelationshipSection>
          ) : (
            <ConsequentialReviewLayout readiness={<ReadinessSummary state={readiness} description="Confirmation revalidates the exact current Order version and records a human rationale." blockers={blockers} context={<dl className="ry-review-facts"><div><dt>Order</dt><dd>{orderNumber}</dd></div><div><dt>Version</dt><dd>{shown(order.version)}</dd></div><div><dt>Verification</dt><dd>{verificationStatus}</dd></div></dl>} />}>
              <ExactArtifact title="Exact documented Order" description="The current stored lines, totals, and version are the artifact submitted for verification." version={shown(order.version)}>
                {formula}
                {lineTable}
              </ExactArtifact>
              <ValidationSummary checks={checks} description="Displayed checks summarize the current response. The server remains authoritative at submission." />
              <ReviewSection eyebrow="Human confirmation" title="Confirm documented Order" description="Confirmation may atomically create or link downstream review records, but does not itself establish protection or commission owed.">
                <Field label="Verification rationale"><TextArea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!canWrite || saving} /></Field>
                <Button loading={saving} disabled={!canWrite || !notes.trim() || conflict} onClick={() => setConfirmationOpen(true)}>Confirm documented Order</Button>
              </ReviewSection>
            </ConsequentialReviewLayout>
          )}
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="account" active={activeTab === "account"}>
          <RelationshipSection title="Account and protection context" description="These records remain separate. An Order is not protection, and a Placement is not an Account.">
            <dl className="ry-relationship-facts">
              <div><dt>Placement</dt><dd>{placementId ? <Link to={`/placements/${placementId}`}>Open Placement</Link> : "Not linked"}</dd></div>
              <div><dt>Account</dt><dd>{accountId ? <Link to={`/accounts/${accountId}`}>Open Account</Link> : "Created or linked only after accepted verification"}</dd></div>
              <div><dt>Protection</dt><dd>{protectionId ? <Link to={`/protected-accounts/${protectionId}`}>Review rights</Link> : <Link to="/protected-accounts">Open protection register</Link>}</dd></div>
            </dl>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Audit-linked history" description="Stored Order events and their recorded rationales."><ActivityTimeline entries={activityEntries} empty="No Order activity has been recorded." label={`${orderNumber} activity`} /></RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="commission" active={activeTab === "commission"}>
          <RelationshipSection title="Commission context" description="Commission ledgers, calculations, payouts, and disputes live in the Commission workflow. Value is not commission owed. Expected, approved, payable, and paid remain distinct.">
            {commissions.length ? <ul className="ry-relationship-evidence-list">{commissions.map((item) => <li key={item.id}><strong>{currency(item.expectedAmount, item.currency)}</strong><small>{shown(item.calculationExplanation)}</small><Link to={`/commissions/${item.id}`}>Explain</Link></li>)}</ul> : <EmptyState compact description="Commission appears only after verification and a documented rule." />}
            <Link className="ry-button ry-button-secondary" to="/commissions">Open commissions</Link>
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm documented Order"
        description={`Submit Order ${orderNumber}, version ${shown(order.version)}, for server validation and human verification.`}
        consequence={<><strong>Verification is consequential</strong><p>Accepted confirmation may create or link an operational Account, review-required protection basis, Estimated Commission, and Reorder review. Each remains a separate record.</p><p>Verification rationale: {notes}</p></>}
        confirmLabel="Confirm documented Order"
        processing={saving}
        onConfirm={() => void confirm()}
        onClose={() => setConfirmationOpen(false)}
      />
      <StickyMobileAction>{primaryAction}</StickyMobileAction>
    </div>
  );
}
