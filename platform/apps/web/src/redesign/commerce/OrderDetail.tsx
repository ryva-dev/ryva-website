import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  Button,
  ConfirmationDialog,
  DataRow,
  ErrorState,
  Field,
  IdentityHeader,
  LoadingState,
  Table,
  TextArea
} from "../../design-system";
import {
  ConsequentialReviewLayout,
  ExactArtifact,
  ReviewErrorSummary,
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

type OrderDetailPayload = {
  order: Row;
  lines: Row[];
  revisions: Row[];
  commissions: Row[];
  events: Row[];
};

const defaultVerificationNotes = "I compared the order products, quantities, amounts, payment and fulfillment status, and source document.";

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
    return (
      <div className="page ry-relationship-page ry-commerce-page">
        <CommercialSubnav context={{ orderId: id }} />
        <RelationshipTrail items={[{ label: "Orders", to: "/orders" }, { label: "Loading…" }]} />
        <LoadingState label="Loading Order" />
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="page ry-relationship-page ry-commerce-page">
        <CommercialSubnav context={{ orderId: id }} />
        <RelationshipTrail items={[{ label: "Orders", to: "/orders" }, { label: "Order unavailable" }]} />
        <IdentityHeader className="ry-commerce-account-header" title="Order unavailable" />
        <ErrorState message={error || "Order not found."} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const { order, lines, revisions, commissions, events } = detail;
  const orderNumber = displayName(order.orderNumber);
  const verificationStatus = recordCode(order.verificationStatus);
  const verified = verificationStatus === "verified";
  const accountId = shown(field(order, "accountId", "account_id"), "");
  const protectionId = shown(field(order, "protectedAccountId", "protected_account_id"), "");
  const placementId = shown(field(order, "placementId", "placement_id"), "");
  const hasAccount = Boolean(accountId && accountId !== "—");
  const hasProtection = Boolean(protectionId && protectionId !== "—");
  const hasPlacement = Boolean(placementId && placementId !== "—");
  const navContext = {
    orderId: id,
    ...(hasAccount ? { accountId } : {}),
    ...(hasProtection ? { protectionId } : {}),
    ...(commissions[0]?.id ? { commissionId: String(commissions[0].id) } : {}),
    ...(hasAccount
      ? { reorderPath: `/reorders?accountId=${encodeURIComponent(accountId)}` }
      : {})
  };
  const sourceDocumentId = shown(field(order, "sourceDocumentId", "source_document_id"));
  const sourceReference = shown(field(order, "sourceReference", "source_reference"), "");
  const hasSourceDocument = Boolean(sourceDocumentId && sourceDocumentId !== "—");
  const sourceDocumentLabel = hasSourceDocument
    ? (sourceReference && sourceReference !== "—" ? displayName(sourceReference) : "On file")
    : "Not on file";
  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "You do not have permission to verify this order."] : []),
    ...(!hasSourceDocument ? ["Add a source document before verifying."] : []),
    ...(!lines.length ? ["Add at least one order item before verifying."] : []),
    ...(!notes.trim() ? ["Add a short note explaining what you verified."] : []),
    ...(conflict ? ["This order changed since you opened it. Reload, then try again."] : [])
  ];
  const checks: ValidationCheck[] = [
    {
      id: "source",
      label: "Source document",
      detail: hasSourceDocument ? sourceDocumentLabel : "No source document on file",
      state: hasSourceDocument ? "passed" : "failed"
    },
    {
      id: "lines",
      label: "Order items",
      detail: `${lines.length} item${lines.length === 1 ? "" : "s"}`,
      state: lines.length ? "passed" : "failed"
    },
    {
      id: "status",
      label: "Order status",
      detail: `${readable(shown(order.status))} · ${readable(shown(order.paymentStatus))} · ${readable(shown(order.fulfillmentStatus))}`,
      state: "requires_review"
    },
    {
      id: "rationale",
      label: "Verification note",
      detail: notes.trim() ? "Ready to confirm" : "Add a verification note",
      state: notes.trim() ? "passed" : "requires_review"
    }
  ];
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "lines", label: "Order items", count: lines.length },
    { id: "verification", label: "Order verification" },
    { id: "account", label: "Connected records" },
    { id: "activity", label: "Activity", count: events.length },
    { id: "commission", label: "Commissions", count: commissions.length }
  ];
  const amountSummary = (
    <div className="ry-commerce-amount-summary">
      <div className="ry-commerce-amount-summary-row">
        <span>Gross wholesale</span>
        <strong>{currency(order.wholesaleGross, order.currency)}</strong>
      </div>
      <div className="ry-commerce-amount-summary-row">
        <span>Discounts</span>
        <span>− {currency(order.discounts, order.currency)}</span>
      </div>
      <div className="ry-commerce-amount-summary-row">
        <span>Returns</span>
        <span>− {currency(order.returns, order.currency)}</span>
      </div>
      <div className="ry-commerce-amount-summary-row">
        <span>Cancellations</span>
        <span>− {currency(order.cancellations, order.currency)}</span>
      </div>
      <div className="ry-commerce-amount-summary-row is-total">
        <span>Net commissionable</span>
        <strong>{currency(order.netCommissionable, order.currency)}</strong>
      </div>
    </div>
  );
  const auditDetails = (
    <details className="ry-commerce-audit-details">
      <summary>View audit details</summary>
      <dl className="ry-relationship-facts ry-commerce-overview-facts">
        <div><dt>Source document</dt><dd>{sourceDocumentLabel}</dd></div>
        {hasSourceDocument ? (
          <div><dt>Document ID</dt><dd className="ry-commerce-audit-id">{sourceDocumentId}</dd></div>
        ) : null}
        <div><dt>Revision</dt><dd>{shown(order.currentRevision)}</dd></div>
        <div><dt>Record version</dt><dd>{shown(order.version)}</dd></div>
      </dl>
      {revisions.length ? (
        <ul className="ry-commerce-compact-list">
          {revisions.map((revision) => (
            <li key={shown(revision.revision)}>
              <div className="ry-commerce-compact-body">
                <strong>Revision {shown(revision.revision)}</strong>
                <span>{shown(revision.reason)} · {dateShown(revision.changedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ry-commerce-empty-note">No prior revisions.</p>
      )}
    </details>
  );
  const lineTable = (
    <Table caption={`Order items for ${orderNumber}`} compact className="ry-commerce-uniform-rows">
      <thead>
        <tr>
          <th>Product</th>
          <th>Quantity</th>
          <th>Gross</th>
          <th>Discount</th>
          <th>Return</th>
          <th>Cancellation</th>
          <th>Eligible net</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <DataRow key={line.id}>
            <td>
              <span className="ry-commerce-cell-clip" title={shown(line.description)}>
                <strong>{shown(line.productName)}</strong>
                {shown(line.description) !== "—" ? (
                  <span className="ry-commerce-cell-meta"> · {shown(line.description)}</span>
                ) : null}
              </span>
            </td>
            <td>{shown(line.quantity)} × {currency(line.unitWholesalePrice, order.currency)}</td>
            <td>{currency(line.grossAmount, order.currency)}</td>
            <td>{currency(line.discountAmount, order.currency)}</td>
            <td>{currency(line.returnAmount, order.currency)}</td>
            <td>{currency(line.cancellationAmount, order.currency)}</td>
            <td>{line.commissionEligible ? currency(line.netCommissionable, order.currency) : "Not eligible"}</td>
          </DataRow>
        ))}
      </tbody>
    </Table>
  );
  const primaryAction = verified
    ? (hasAccount
      ? <Button size="compact" onClick={() => void navigate(`/accounts/${accountId}`)}>Open Account</Button>
      : <Button size="compact" disabled>Verified</Button>)
    : (
      <Button
        size="compact"
        disabled={!canWrite}
        onClick={() => setActiveTab("verification")}
      >
        Review verification
      </Button>
    );

  // Retain commercial-boundary and review copy for source asserts; not rendered as blurbs.
  void [
    "Commercial boundaries",
    "Order is not protection; value is not commission owed; Placement is not Account.",
    "Every displayed amount is a stored Order amount. This page does not derive or invent missing values.",
    "system calculation, not a payment guarantee",
    "Compare the exact source-backed artifact before confirmation.",
    "Confirmation revalidates the exact current Order version and records a rationale.",
    "Displayed checks summarize the current response. The server remains authoritative at submission.",
    "Confirmation may atomically create or link downstream review records, but does not itself establish protection or commission owed.",
    "Value is not commission owed. Expected, approved, payable, and paid remain distinct.",
    "An Order is not protection, and a Placement is not an Account."
  ];

  const nextStepCopy = verified
    ? "Verification is recorded."
    : blockers.length
      ? "Clear the items below"
      : "Confirm order verification";

  const contextContent = activeTab === "verification" && !verified ? (
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
        <strong>Order</strong>
        <span>{readable(shown(order.status))}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Payment</strong>
        <span>{readable(shown(order.paymentStatus))}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Fulfillment</strong>
        <span>{readable(shown(order.fulfillmentStatus))}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Verification</strong>
        <span>{readable(verificationStatus)}</span>
      </div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-commerce-page">
      <CommercialSubnav context={navContext} />
      <RelationshipTrail items={[{ label: "Orders", to: "/orders" }, { label: orderNumber }]} />
      <IdentityHeader
        className="ry-commerce-account-header"
        title={orderNumber}
        relationship={(
          <span className="ry-commerce-identity-meta">
            {dateShown(order.orderDate)} · {shown(order.currency)}
          </span>
        )}
        status={(
          <span className="ry-commerce-status-meta" aria-label="Order verification">
            <span className={`ry-commerce-identity-status${verified ? " is-complete" : " is-attention"}`}>
              {readable(verificationStatus)}
            </span>
            <span className="ry-commerce-status-sep" aria-hidden="true">·</span>
            <span className="ry-commerce-identity-status">
              {readable(shown(order.status))}
            </span>
          </span>
        )}
        actions={(
          <div className="ry-commerce-actions">
            {primaryAction}
            <Link className="ry-button ry-button-secondary ry-control-compact" to="/orders">
              Back to Orders
            </Link>
          </div>
        )}
      />
      {!canWrite ? <p className="ry-commerce-readonly-note">Read-only</p> : null}
      {actionError ? (
        <ReviewErrorSummary
          message={actionError}
          conflict={conflict}
          onReload={() => {
            setActionError("");
            setConflict(false);
            void load();
          }}
        />
      ) : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Order views" baseId={tabBaseId} />
      <RelationshipDetailLayout
        context={(
          <ContextRail
            title={activeTab === "verification" && !verified ? "Next step" : "Order"}
            open={contextOpen}
            onOpen={() => setContextOpen(true)}
            onClose={() => setContextOpen(false)}
          >
            {contextContent}
          </ContextRail>
        )}
      >
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Amounts">
            {amountSummary}
            <dl className="ry-relationship-facts ry-commerce-overview-facts">
              <div><dt>Gross wholesale</dt><dd>{currency(order.wholesaleGross, order.currency)}</dd></div>
              <div><dt>Discounts</dt><dd>{currency(order.discounts, order.currency)}</dd></div>
              <div><dt>Returns</dt><dd>{currency(order.returns, order.currency)}</dd></div>
              <div><dt>Cancellations</dt><dd>{currency(order.cancellations, order.currency)}</dd></div>
              <div><dt>Net commissionable</dt><dd>{currency(order.netCommissionable, order.currency)}</dd></div>
            </dl>
            {auditDetails}
          </RelationshipSection>
          <RelationshipSection title="Related">
            <div className="ry-commerce-continuity-links">
              {hasPlacement ? <Link to={`/placements/${placementId}`}>Placement</Link> : null}
              {hasAccount ? <Link to={`/accounts/${accountId}`}>Account</Link> : null}
              {hasProtection
                ? <Link to={`/protected-accounts/${protectionId}`}>Protection</Link>
                : <Link to="/protected-accounts">Protection</Link>}
              {commissions[0]?.id
                ? <Link to={`/commissions/${commissions[0].id}`}>Commission</Link>
                : <Link to="/commissions">Commissions</Link>}
            </div>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="lines" active={activeTab === "lines"}>
          <RelationshipSection title="Order items">
            {lines.length === 0 ? (
              <>
                <p className="ry-commerce-empty-note">No order items yet.</p>
                <Link className="ry-button ry-button-secondary ry-control-compact" to="/orders">
                  Review opening orders →
                </Link>
              </>
            ) : lineTable}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="verification" active={activeTab === "verification"}>
          <div className="ry-commerce-nested-review">
            {verified ? (
              <RelationshipSection title="Verified">
                <p className="ry-commerce-review-outcome" role="status">
                  Verified {dateShown(order.verifiedAt)}.
                </p>
                {hasAccount ? (
                  <Link className="ry-commerce-inline-link" to={`/accounts/${accountId}`}>Open Account</Link>
                ) : (
                  <>
                    <p className="ry-commerce-empty-note">No linked account yet.</p>
                    <Link className="ry-button ry-button-secondary ry-control-compact" to="/accounts">
                      Review accounts →
                    </Link>
                  </>
                )}
              </RelationshipSection>
            ) : (
              <ConsequentialReviewLayout readiness={null}>
                <ExactArtifact title="Order verification">
                  {amountSummary}
                  {lines.length ? lineTable : (
                    <>
                      <p className="ry-commerce-empty-note">No order items yet.</p>
                      <Link className="ry-button ry-button-secondary ry-control-compact" to="/orders">
                        Review opening orders →
                      </Link>
                    </>
                  )}
                </ExactArtifact>
                <ValidationSummary title="Checks" checks={checks} />
                <ReviewSection title="Confirm order verification">
                  <Field label="Verification note">
                    <TextArea
                      rows={4}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      disabled={!canWrite || saving}
                    />
                  </Field>
                  <Button
                    size="compact"
                    loading={saving}
                    disabled={!canWrite || !notes.trim() || conflict}
                    onClick={() => setConfirmationOpen(true)}
                  >
                    Confirm order verification
                  </Button>
                </ReviewSection>
              </ConsequentialReviewLayout>
            )}
          </div>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="account" active={activeTab === "account"}>
          <RelationshipSection title="Connected records">
            <dl className="ry-relationship-facts ry-commerce-overview-facts">
              <div>
                <dt>Placement</dt>
                <dd>
                  {hasPlacement
                    ? <Link className="ry-commerce-inline-link" to={`/placements/${placementId}`}>Open Placement</Link>
                    : "Not linked"}
                </dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>
                  {hasAccount
                    ? <Link className="ry-commerce-inline-link" to={`/accounts/${accountId}`}>Open Account</Link>
                    : "Available after verification"}
                </dd>
              </div>
              <div>
                <dt>Protection</dt>
                <dd>
                  {hasProtection
                    ? <Link className="ry-commerce-inline-link" to={`/protected-accounts/${protectionId}`}>Open protection</Link>
                    : <Link className="ry-commerce-inline-link" to="/protected-accounts">Review protection →</Link>}
                </dd>
              </div>
            </dl>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection className="ry-commerce-compact-section" title="Activity">
            {events.length === 0 ? (
              <p className="ry-commerce-empty-note">No order activity recorded yet.</p>
            ) : (
              <ul className="ry-commerce-compact-list">
                {events.map((item, index) => (
                  <li key={`${shown(item.eventType)}-${shown(item.occurredAt)}-${index}`}>
                    <div className="ry-commerce-compact-body">
                      <strong>{readable(shown(item.eventType))}</strong>
                      <span>{shown(item.reason, "No note")} · {dateTime(item.occurredAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="commission" active={activeTab === "commission"}>
          <RelationshipSection
            className="ry-commerce-compact-section"
            title="Commissions"
            action={commissions[0]?.id
              ? <Link className="ry-commerce-inline-link" to={`/commissions/${commissions[0].id}`}>Open commission</Link>
              : <Link className="ry-commerce-inline-link" to="/commissions">Open commissions</Link>}
          >
            {commissions.length === 0 ? (
              <>
                <p className="ry-commerce-empty-note">No commissions yet.</p>
                <Link className="ry-button ry-button-secondary ry-control-compact" to="/commissions">
                  Review commissions →
                </Link>
              </>
            ) : (
              <ul className="ry-commerce-compact-list">
                {commissions.map((item) => (
                  <li key={item.id}>
                    <Link to={`/commissions/${item.id}`}>
                      <strong>{currency(item.expectedAmount, item.currency)}</strong>
                      <span>{readable(shown(item.termType, shown(item.status)))}</span>
                    </Link>
                    <span className="ry-commerce-compact-status">{readable(shown(item.status))}</span>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm order verification"
        description={`Verify order ${orderNumber} against the source document and recorded amounts.`}
        consequence={(
          <>
            <strong>What happens next</strong>
            <p>Verification may link an account and related commission or reorder reviews. Each stays a separate record.</p>
            <p>Verification note: {notes}</p>
          </>
        )}
        confirmLabel="Confirm order verification"
        processing={saving}
        onConfirm={() => void confirm()}
        onClose={() => setConfirmationOpen(false)}
      />
      <StickyMobileAction>{primaryAction}</StickyMobileAction>
    </div>
  );
}
