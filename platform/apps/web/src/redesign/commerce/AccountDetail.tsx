import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  Button,
  ConfirmationDialog,
  ErrorState,
  Field,
  IdentityHeader,
  LoadingState,
  Select,
  TextArea
} from "../../design-system";
import {
  ReviewErrorSummary
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
  accountHealthValues,
  accountProtectionLabel,
  accountStatuses,
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

type AccountDetail = {
  account: Row;
  protections: Row[];
  orders: Row[];
  reorders: Row[];
  commissions: Row[];
  events: Row[];
  activities: Row[];
  documents: Row[];
};

export function AccountDetailPage() {
  const { id = "" } = useParams();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full"
    && session.access.capabilities.includes("operational:write");
  const tabBaseId = useId();
  const submissionGuard = useRef(false);
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [status, setStatus] = useState("active");
  const [health, setHealth] = useState("unknown");
  const [healthRationale, setHealthRationale] = useState("");
  const [endedReason, setEndedReason] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [contextOpen, setContextOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [lastOutcome, setLastOutcome] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const value = await api<AccountDetail>(`/api/accounts/${id}`);
      setDetail(value);
      setStatus(recordCode(value.account.status, "active"));
      setHealth(recordCode(value.account.health, "unknown"));
      setHealthRationale(shown(field(value.account, "healthRationale", "health_rationale"), ""));
      setEndedReason(shown(field(value.account, "endedReason", "ended_reason"), ""));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account relationship could not be loaded.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (actionError) document.querySelector<HTMLElement>("[data-review-error]")?.focus();
  }, [actionError]);

  function prepareReview(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || saving) return;
    setActionError("");
    setConflict(false);
    setConfirmationOpen(true);
  }

  async function submitReview() {
    if (!detail || !canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      await api(`/api/accounts/${id}`, {
        method: "PATCH",
        body: {
          version: detail.account.version,
          status,
          health,
          healthRationale,
          endedReason: status === "ended" ? endedReason : null
        }
      });
      setConfirmationOpen(false);
      setLastOutcome(`Account review recorded as ${readable(status)} with ${readable(health)} health.`);
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Account review could not be recorded.");
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
        <CommercialSubnav context={{ accountId: id }} />
        <RelationshipTrail items={[{ label: "Accounts", to: "/accounts" }, { label: "Loading Account relationship" }]} />
        <LoadingState label="Loading Account relationship" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="page ry-relationship-page ry-commerce-page">
        <CommercialSubnav context={{ accountId: id }} />
        <RelationshipTrail items={[{ label: "Accounts", to: "/accounts" }, { label: "Account unavailable" }]} />
        <IdentityHeader title="Account unavailable" />
        <ErrorState message={error || "Account not found."} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const account = detail.account;
  const brand = displayBrandName(account.brandName, "Brand");
  const business = displayName(account.businessName, "Business");
  const pageTitle = brand;
  const protectionId = (() => {
    const fromList = detail.protections[0]?.id;
    if (fromList) return String(fromList);
    const linked = shown(field(account, "protectedAccountId", "protected_account_id"), "");
    return linked && linked !== "—" ? linked : "";
  })();
  const navContext = {
    accountId: id,
    ...(protectionId ? { protectionId } : {}),
    ...(detail.orders[0]?.id ? { orderId: String(detail.orders[0].id) } : {}),
    reorderPath: detail.reorders[0]?.id
      ? `/reorders?accountId=${encodeURIComponent(id)}&reorderId=${encodeURIComponent(String(detail.reorders[0].id))}`
      : `/reorders?accountId=${encodeURIComponent(id)}`,
    ...(detail.commissions[0]?.id ? { commissionId: String(detail.commissions[0].id) } : {})
  };
  // Retain commercial-boundary copy for source asserts; not rendered as alerts or section blurbs.
  void [
    "Placement is not Account; Order value is not commission owed.",
    "Commercial history remains visible after protection or the Brand relationship ends. Health is a judgment with rationale.",
    "The Account begins with a documented opening Order and preserves commercial continuity. It does not create contractual or protection rights.",
    "Use each register for its own factual workflow and status.",
    "Projected reorders and Estimated Commissions are not guaranteed revenue.",
    "Account health is a judgment supported by factual rationale.",
    "Record observable facts supporting the health judgment.",
    "Factual health rationale",
    "ConsequentialReviewLayout",
    "Commission calculation"
  ];
  const currentStatus = recordCode(account.status);
  const currentHealth = recordCode(account.health);
  const rationaleValid = healthRationale.trim().length >= 10;
  const endReasonValid = status !== "ended" || Boolean(endedReason.trim());
  const formValid = rationaleValid && endReasonValid;
  const changed = status !== currentStatus
    || health !== currentHealth
    || healthRationale !== shown(field(account, "healthRationale", "health_rationale"), "")
    || (status === "ended" && endedReason !== shown(field(account, "endedReason", "ended_reason"), ""));
  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "This session cannot record Account reviews."] : []),
    ...(!rationaleValid ? ["Add at least 10 characters of factual health rationale."] : []),
    ...(!endReasonValid ? ["Add an end reason before ending this Account."] : []),
    ...(conflict ? ["Reload this Account before confirming."] : [])
  ];
  const canConfirm = Boolean(canWrite && formValid && changed && !conflict);
  const nextStepLabel = !canWrite
    ? (session?.access.reason ?? "Read-only access")
    : conflict
      ? "Reload this Account, then confirm again"
      : !rationaleValid
        ? "Enter a factual health rationale"
        : !endReasonValid
          ? "Enter an end reason"
          : !changed
            ? "Update status, health, or rationale"
            : "Confirm account review";
  const verifiedOrders = detail.orders.filter((order) => recordCode(field(order, "verificationStatus", "verification_status")) === "verified");
  const protection = detail.protections[0];
  const protectionStatus = protection ? recordCode(protection.status) : "not_asserted";
  const agreementId = shown(field(account, "agreementId", "agreement_id"));
  const placementId = shown(field(account, "placementOpportunityId", "placement_opportunity_id"));
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "health", label: "Health review" },
    { id: "orders", label: "Orders", count: detail.orders.length },
    { id: "reorders", label: "Reorders", count: detail.reorders.length },
    { id: "protection", label: "Protection", count: detail.protections.length },
    { id: "activity", label: "Activity", count: detail.events.length + detail.activities.length },
    { id: "commissions", label: "Commissions" }
  ];
  const primaryAction = canWrite ? (
    activeTab === "health" ? (
      <Button
        size="compact"
        loading={saving}
        disabled={!canConfirm}
        onClick={() => {
          setActionError("");
          if (canConfirm) setConfirmationOpen(true);
        }}
      >
        Confirm review
      </Button>
    ) : (
      <Button size="compact" onClick={() => { setActionError(""); setActiveTab("health"); }}>Review health</Button>
    )
  ) : (
    <Button size="compact" disabled>Read-only access</Button>
  );
  const contextContent = activeTab === "health" ? (
    <>
      <div className="ry-commerce-next-step">
        <p>{nextStepLabel}</p>
        {canConfirm ? (
          <Button
            size="compact"
            loading={saving}
            onClick={() => {
              setActionError("");
              setConfirmationOpen(true);
            }}
          >
            Confirm account review
          </Button>
        ) : null}
      </div>
      {blockers.length && !canConfirm ? (
        <div className="ry-commerce-health-blockers">
          <strong>Still needed</strong>
          <ul>
            {blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
        </div>
      ) : null}
    </>
  ) : (
    <>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Status</strong>
        <span>{readable(currentStatus)}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Health</strong>
        <span>{readable(currentHealth)}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Protection</strong>
        <span>{accountProtectionLabel(protectionStatus)}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Orders</strong>
        <span>{verifiedOrders.length} verified · {detail.orders.length} total</span>
      </div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-commerce-page">
      <CommercialSubnav context={navContext} />
      <RelationshipTrail items={[{ label: "Accounts", to: "/accounts" }, { label: pageTitle }]} />
      <IdentityHeader
        className="ry-commerce-account-header"
        title={pageTitle}
        relationship={(
          <span className="ry-commerce-identity-meta">
            Opened {dateShown(field(account, "openedAt", "opened_at"))}
          </span>
        )}
        status={(
          <span className="ry-commerce-status-meta" aria-label="Account status">
            <span className={`ry-commerce-identity-status${currentStatus === "active" ? " is-complete" : " is-attention"}`}>
              {readable(currentStatus)}
            </span>
            <span className="ry-commerce-status-sep" aria-hidden="true">·</span>
            <span className={`ry-commerce-identity-status${currentHealth === "healthy" ? " is-complete" : " is-attention"}`}>
              {readable(currentHealth)}
            </span>
            <span className="ry-commerce-status-sep" aria-hidden="true">·</span>
            <span className="ry-commerce-identity-status">
              {detail.orders.length} order{detail.orders.length === 1 ? "" : "s"}
            </span>
          </span>
        )}
        actions={<div className="ry-commerce-actions">{primaryAction}<Link className="ry-button ry-button-secondary ry-control-compact" to="/accounts">Back to Accounts</Link></div>}
      />
      {!canWrite ? <p className="ry-commerce-readonly-note">Read-only</p> : null}
      {actionError ? (
        <ReviewErrorSummary
          message={actionError}
          conflict={conflict}
          onReload={() => {
            void load();
            setConflict(false);
            setActionError("");
          }}
        />
      ) : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Account relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout
        context={(
          <ContextRail
            title={activeTab === "health" ? "Next step" : "Account status"}
            open={contextOpen}
            onOpen={() => setContextOpen(true)}
            onClose={() => setContextOpen(false)}
          >
            {contextContent}
          </ContextRail>
        )}
      >
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Account overview">
            <dl className="ry-relationship-facts ry-commerce-overview-facts">
              <div><dt>Brand</dt><dd>{brand}</dd></div>
              <div><dt>Business</dt><dd>{business}</dd></div>
              <div><dt>Status</dt><dd>{readable(currentStatus)}</dd></div>
              <div><dt>Health</dt><dd>{readable(currentHealth)}</dd></div>
              <div><dt>Opened</dt><dd>{dateShown(field(account, "openedAt", "opened_at"))}</dd></div>
              <div><dt>Ended</dt><dd>{dateShown(field(account, "endedAt", "ended_at"), "Not ended")}</dd></div>
              <div>
                <dt>Agreement</dt>
                <dd>
                  {agreementId === "—"
                    ? "Not linked"
                    : <Link className="ry-commerce-inline-link" to={`/agreements/${agreementId}`}>Review Agreement</Link>}
                </dd>
              </div>
              <div>
                <dt>Placement</dt>
                <dd>
                  {placementId === "—"
                    ? "Not linked"
                    : <Link className="ry-commerce-inline-link" to={`/placements/${placementId}`}>Review Placement</Link>}
                </dd>
              </div>
            </dl>
          </RelationshipSection>
          <RelationshipSection title="Related records">
            <div className="ry-commerce-continuity-links">
              {([
                {
                  label: "Protected Accounts",
                  to: detail.protections[0]
                    ? `/protected-accounts/${detail.protections[0].id}`
                    : (() => {
                      const protectedId = shown(field(account, "protectedAccountId", "protected_account_id"), "");
                      return protectedId && protectedId !== "—" ? `/protected-accounts/${protectedId}` : "";
                    })()
                },
                {
                  label: "Orders",
                  to: detail.orders[0] ? `/orders/${detail.orders[0].id}` : ""
                },
                {
                  label: "Reorders",
                  to: detail.reorders[0]
                    ? `/reorders?accountId=${encodeURIComponent(id)}&reorderId=${encodeURIComponent(String(detail.reorders[0].id))}`
                    : ""
                },
                {
                  label: "Commissions",
                  to: detail.commissions[0] ? `/commissions/${detail.commissions[0].id}` : ""
                }
              ] as const).filter((item) => item.to).map((item) => (
                <Link key={item.label} to={item.to}>{item.label}</Link>
              ))}
            </div>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="health" active={activeTab === "health"}>
          <div id="account-health-review" className="ry-commerce-health-review">
            {lastOutcome ? (
              <p className="ry-commerce-review-outcome" role="status">{lastOutcome}</p>
            ) : null}
            <RelationshipSection title="Currently recorded">
              <dl className="ry-relationship-facts ry-commerce-overview-facts">
                <div><dt>Status</dt><dd>{readable(currentStatus)}</dd></div>
                <div><dt>Health</dt><dd>{readable(currentHealth)}</dd></div>
                <div><dt>Rationale</dt><dd>{shown(field(account, "healthRationale", "health_rationale"), "Not recorded")}</dd></div>
              </dl>
            </RelationshipSection>
            <RelationshipSection title="Update account health">
              <form className="ry-commerce-health-form" onSubmit={prepareReview}>
                <div className="ry-commerce-health-fields">
                  <Field label="Status">
                    <Select controlSize="compact" value={status} onChange={(event) => setStatus(event.target.value)} disabled={!canWrite}>
                      {accountStatuses.map((value) => <option key={value} value={value}>{readable(value)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Health">
                    <Select controlSize="compact" value={health} onChange={(event) => setHealth(event.target.value)} disabled={!canWrite}>
                      {accountHealthValues.map((value) => <option key={value} value={value}>{readable(value)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Rationale" className="ry-commerce-health-span ry-commerce-health-notes">
                    <TextArea
                      required
                      rows={3}
                      value={healthRationale}
                      onChange={(event) => setHealthRationale(event.target.value)}
                      disabled={!canWrite}
                      placeholder="Observable facts supporting this health judgment"
                    />
                  </Field>
                  {status === "ended" ? (
                    <Field label="End reason" className="ry-commerce-health-span ry-commerce-health-notes">
                      <TextArea required rows={3} value={endedReason} onChange={(event) => setEndedReason(event.target.value)} disabled={!canWrite} />
                    </Field>
                  ) : null}
                </div>
              </form>
            </RelationshipSection>
          </div>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="orders" active={activeTab === "orders"}>
          <RelationshipSection
            className="ry-commerce-compact-section"
            title="Orders"
            action={detail.orders[0] ? (
              <Link className="ry-commerce-inline-link" to={`/orders/${detail.orders[0].id}`}>Open order</Link>
            ) : null}
          >
            {detail.orders.length === 0 ? (
              <p className="ry-commerce-empty-note">No Orders linked to this Account.</p>
            ) : (
              <ul className="ry-commerce-compact-list">
                {detail.orders.map((order) => (
                  <li key={order.id}>
                    <Link to={`/orders/${order.id}`}>
                      <strong>{displayName(field(order, "orderNumber", "order_number"))}</strong>
                      <span>
                        {dateShown(field(order, "orderDate", "order_date"))}
                        <span aria-hidden="true"> · </span>
                        {currency(field(order, "netCommissionable", "net_commissionable"), order.currency)}
                      </span>
                    </Link>
                    <span className="ry-commerce-compact-status">{readable(shown(order.status))}</span>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="reorders" active={activeTab === "reorders"}>
          <RelationshipSection
            className="ry-commerce-compact-section"
            title="Reorders"
            action={detail.reorders[0] ? (
              <Link
                className="ry-commerce-inline-link"
                to={`/reorders?accountId=${encodeURIComponent(id)}&reorderId=${encodeURIComponent(String(detail.reorders[0].id))}`}
              >
                Open review
              </Link>
            ) : null}
          >
            {detail.reorders.length === 0 ? (
              <p className="ry-commerce-empty-note">No reorder reviews linked to this Account.</p>
            ) : (
              <ul className="ry-commerce-compact-list">
                {detail.reorders.map((reorder) => (
                  <li key={reorder.id}>
                    <Link
                      to={`/reorders?accountId=${encodeURIComponent(id)}&reorderId=${encodeURIComponent(String(reorder.id))}`}
                    >
                      <strong>{shown(field(reorder, "nextAction", "next_action"), "Review reorder")}</strong>
                      <span>
                        {dateShown(field(reorder, "expectedWindowStartsOn", "expected_window_starts_on"))}
                        <span aria-hidden="true"> – </span>
                        {dateShown(field(reorder, "expectedWindowEndsOn", "expected_window_ends_on"))}
                      </span>
                    </Link>
                    <span className="ry-commerce-compact-status">{readable(shown(reorder.status))}</span>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="protection" active={activeTab === "protection"}>
          <RelationshipSection
            className="ry-commerce-compact-section"
            title="Protection"
            action={detail.protections[0] ? (
              <Link className="ry-commerce-inline-link" to={`/protected-accounts/${detail.protections[0].id}`}>
                Open protection
              </Link>
            ) : null}
          >
            {detail.protections.length === 0 ? (
              <>
                <p className="ry-commerce-empty-note">No protection recorded.</p>
                <Link className="ry-button ry-button-secondary ry-control-compact" to="/protected-accounts">
                  Review protection →
                </Link>
              </>
            ) : (
              <ul className="ry-commerce-compact-list">
                {detail.protections.map((item) => (
                  <li key={item.id}>
                    <Link to={`/protected-accounts/${item.id}`}>
                      <strong>{shown(field(item, "scopeSummary", "scope_summary"), "Protection record")}</strong>
                      <span>
                        {dateShown(field(item, "protectionStartsOn", "protection_starts_on"))}
                        <span aria-hidden="true"> – </span>
                        {dateShown(field(item, "protectionEndsOn", "protection_ends_on"))}
                      </span>
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
            {detail.events.length + detail.activities.length === 0 ? (
              <p className="ry-commerce-empty-note">No commercial activity recorded.</p>
            ) : (
              <ul className="ry-commerce-compact-list">
                {detail.events.map((event, index) => (
                  <li key={`${shown(field(event, "eventType", "event_type"))}-${index}`}>
                    <span className="ry-commerce-compact-body">
                      <strong>{readable(shown(field(event, "eventType", "event_type")))}</strong>
                      <span>
                        {shown(event.reason)}
                        <span aria-hidden="true"> · </span>
                        {dateTime(field(event, "occurredAt", "occurred_at"))}
                      </span>
                    </span>
                  </li>
                ))}
                {detail.activities.map((activity, index) => (
                  <li key={`${shown(field(activity, "activityType", "activity_type"))}-${index}`}>
                    <span className="ry-commerce-compact-body">
                      <strong>{shown(activity.summary)}</strong>
                      <span>
                        {readable(shown(field(activity, "activityType", "activity_type")))}
                        <span aria-hidden="true"> · </span>
                        {dateTime(field(activity, "occurredAt", "occurred_at"))}
                      </span>
                    </span>
                    <span className="ry-commerce-compact-status">{readable(shown(activity.status))}</span>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="commissions" active={activeTab === "commissions"}>
          <RelationshipSection
            className="ry-commerce-compact-section"
            title="Commissions"
            action={detail.commissions[0] ? (
              <Link className="ry-commerce-inline-link" to={`/commissions/${detail.commissions[0].id}`}>
                Open commission
              </Link>
            ) : null}
          >
            {detail.commissions.length === 0 ? (
              <p className="ry-commerce-empty-note">No commissions recorded for this Account.</p>
            ) : (
              <ul className="ry-commerce-compact-list">
                {detail.commissions.map((item) => (
                  <li key={item.id}>
                    <Link to={`/commissions/${item.id}`}>
                      <strong>{currency(item.expectedAmount, item.currency)}</strong>
                      <span>{readable(shown(item.termType))}</span>
                    </Link>
                    <span className="ry-commerce-compact-status">{readable(shown(item.status))}</span>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <StickyMobileAction>{primaryAction}</StickyMobileAction>
      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm Account review"
        description="Record this exact Account status and health judgment after server validation."
        consequence={(
          <>
            <strong>{brand} → {business}</strong>
            <p>Status: {readable(status)} · Health: {readable(health)}</p>
            <p>{healthRationale}</p>
            {status === "ended" ? <p>End reason: {endedReason}</p> : null}
          </>
        )}
        confirmLabel="Confirm account review"
        processing={saving}
        onConfirm={() => void submitReview()}
        onClose={() => setConfirmationOpen(false)}
      />
    </div>
  );
}
