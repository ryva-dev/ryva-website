import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Select,
  StatusLabel,
  TextArea
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
  accountHealthValues,
  accountStatuses,
  currency,
  dateShown,
  dateTime,
  field,
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
      setStatus(shown(value.account.status, "active"));
      setHealth(shown(value.account.health, "unknown"));
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
        <CommercialSubnav />
        <RelationshipTrail items={[{ label: "Accounts", to: "/accounts" }, { label: "Loading Account relationship" }]} />
        <LoadingState label="Loading Account relationship" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="page ry-relationship-page ry-commerce-page">
        <CommercialSubnav />
        <RelationshipTrail items={[{ label: "Accounts", to: "/accounts" }, { label: "Account unavailable" }]} />
        <PageHeader eyebrow="Account detail" title="Account unavailable" description="The requested operational Account could not be loaded." />
        <ErrorState message={error || "Account not found."} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const account = detail.account;
  const brand = shown(account.brandName, "Brand");
  const business = shown(account.businessName, "Business");
  const currentStatus = shown(account.status);
  const currentHealth = shown(account.health);
  const rationaleValid = healthRationale.trim().length >= 10;
  const endReasonValid = status !== "ended" || Boolean(endedReason.trim());
  const formValid = rationaleValid && endReasonValid;
  const changed = status !== currentStatus
    || health !== currentHealth
    || healthRationale !== shown(field(account, "healthRationale", "health_rationale"), "")
    || (status === "ended" && endedReason !== shown(field(account, "endedReason", "ended_reason"), ""));
  const readinessState: ReviewReadiness = conflict
    ? "stale"
    : !canWrite
      ? "restricted"
      : !formValid
        ? "blocked"
        : "requires_review";
  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "This session cannot record Account reviews."] : []),
    ...(!rationaleValid ? ["Factual health rationale must contain at least 10 characters."] : []),
    ...(!endReasonValid ? ["Ending an Account requires an end reason."] : []),
    ...(conflict ? ["The Account version is no longer current. Reload before reconciling and retrying."] : [])
  ];
  const checks: ValidationCheck[] = [
    {
      id: "rationale",
      label: "Factual health rationale",
      detail: rationaleValid
        ? "A factual rationale is present for the human health judgment."
        : "Enter at least 10 characters of factual rationale.",
      state: rationaleValid ? "passed" : "failed"
    },
    {
      id: "end-reason",
      label: "End reason",
      detail: status === "ended"
        ? (endReasonValid ? "A reason is recorded for ending the Account." : "Ending the Account requires a reason.")
        : "No end reason is required for the selected status.",
      state: endReasonValid ? "passed" : "failed"
    },
    {
      id: "version",
      label: "Current Account version",
      detail: conflict
        ? "The submitted version was stale. Reload and reconcile the current Account."
        : `Version ${shown(account.version)} will be checked by the server.`,
      state: conflict ? "failed" : "passed"
    },
    {
      id: "human",
      label: "Human judgment",
      detail: "Health and status are submitted only after explicit human confirmation.",
      state: "requires_review"
    }
  ];
  const verifiedOrders = detail.orders.filter((order) => shown(field(order, "verificationStatus", "verification_status")) === "verified");
  const protection = detail.protections[0];
  const protectionStatus = protection ? shown(protection.status) : "not_asserted";
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
  const primaryAction = canWrite
    ? <Button onClick={() => { setActionError(""); setActiveTab("health"); }}>Confirm human account review</Button>
    : <Button disabled>Read-only access</Button>;
  const contextContent = (
    <>
      <div className="ry-context-item"><strong>Status</strong><StatusLabel value={currentStatus} /></div>
      <div className="ry-context-item"><strong>Health</strong><StatusLabel value={currentHealth} /><small>{shown(field(account, "healthRationale", "health_rationale"))}</small></div>
      <div className="ry-context-item"><strong>Protection</strong><StatusLabel value={protectionStatus} /><small>Protection must be supported by documented rights.</small></div>
      <div className="ry-context-item"><strong>Actual Orders</strong><p>{verifiedOrders.length} verified</p><small>Order value is not commission owed.</small></div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-commerce-page">
      <CommercialSubnav />
      <RelationshipTrail items={[{ label: "Accounts", to: "/accounts" }, { label: `${brand} → ${business}` }]} />
      <PageHeader
        eyebrow="Account detail"
        title={`${brand} → ${business}`}
        description="Commercial history remains visible after protection or the Brand relationship ends. Health is a human judgment with rationale."
        action={<div className="ry-commerce-actions">{primaryAction}<Link className="ry-button ry-button-secondary" to="/accounts">Back to Accounts</Link></div>}
      />
      {!canWrite ? (
        <Alert tone="warning" title="Read-only Account context">
          You may inspect permitted commercial history, but cannot record an Account status or health review in this session.
        </Alert>
      ) : null}
      <Alert tone="info" title="Commercial boundaries">
        Placement is not Account; Order value is not commission owed.
      </Alert>
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
          <ContextRail title="Account context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>
            {contextContent}
          </ContextRail>
        )}
      >
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Operational Account" description="The Account begins with a documented opening Order and preserves commercial continuity. It does not create contractual or protection rights.">
            <dl className="ry-relationship-facts">
              <div><dt>Brand</dt><dd>{brand}</dd></div>
              <div><dt>Business</dt><dd>{business}</dd></div>
              <div><dt>Status</dt><dd><StatusLabel value={currentStatus} /></dd></div>
              <div><dt>Health</dt><dd><StatusLabel value={currentHealth} /></dd></div>
              <div><dt>Opened</dt><dd>{dateShown(field(account, "openedAt", "opened_at"))}</dd></div>
              <div><dt>Ended</dt><dd>{dateShown(field(account, "endedAt", "ended_at"), "Not ended")}</dd></div>
              <div><dt>Agreement</dt><dd>{agreementId === "—" ? "Not linked" : <Link to={`/agreements/${agreementId}`}>Review Agreement</Link>}</dd></div>
              <div><dt>Placement</dt><dd>{placementId === "—" ? "Not linked" : <Link to={`/placements/${placementId}`}>Review Placement</Link>}</dd></div>
            </dl>
          </RelationshipSection>
          <RelationshipSection title="Commercial continuity" description="Use each register for its own factual workflow and status.">
            <div className="ry-placement-commercial-links">
              <Link to="/protected-accounts">Protected Accounts</Link>
              <Link to="/orders">Orders</Link>
              <Link to="/reorders">Reorders</Link>
              <Link to="/commissions">Commissions</Link>
            </div>
            <p className="ry-commerce-boundary">Projected reorders and Estimated Commissions are not guaranteed revenue.</p>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="health" active={activeTab === "health"}>
          <div id="account-health-review">
            {lastOutcome ? <ReviewOutcome title="Account review recorded" status={currentStatus} consequence={lastOutcome} /> : null}
            <ConsequentialReviewLayout
              readiness={(
                <ReadinessSummary
                  state={readinessState}
                  description="Account health is a human judgment supported by factual rationale. The server validates the current version and any end or reactivation requirements."
                  blockers={blockers}
                  context={(
                    <dl className="ry-review-facts">
                      <div><dt>Current status</dt><dd>{readable(currentStatus)}</dd></div>
                      <div><dt>Current health</dt><dd>{readable(currentHealth)}</dd></div>
                      <div><dt>Version</dt><dd>{shown(account.version)}</dd></div>
                    </dl>
                  )}
                />
              )}
            >
              <ExactArtifact
                title="Exact Account review"
                description="This exact status, health judgment, rationale, and conditional end reason will be recorded together."
                version={shown(account.version)}
              >
                <dl className="ry-review-facts">
                  <div><dt>Status</dt><dd>{readable(status)}</dd></div>
                  <div><dt>Health</dt><dd>{readable(health)}</dd></div>
                  <div><dt>Factual health rationale</dt><dd>{healthRationale || "Not provided"}</dd></div>
                  {status === "ended" ? <div><dt>End reason</dt><dd>{endedReason || "Not provided"}</dd></div> : null}
                </dl>
              </ExactArtifact>
              <ValidationSummary checks={checks} description="Displayed checks summarize the form. The server remains authoritative for version and reactivation requirements." />
              <ReviewSection eyebrow="Human confirmation" title="Review Account status and health" description="Commercial history remains visible after an Account ends. Ending an Account does not silently cancel earned compensation.">
                <form className="form-grid" onSubmit={prepareReview}>
                  <Field label="Status">
                    <Select value={status} onChange={(event) => setStatus(event.target.value)} disabled={!canWrite}>
                      {accountStatuses.map((value) => <option key={value} value={value}>{readable(value)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Health">
                    <Select value={health} onChange={(event) => setHealth(event.target.value)} disabled={!canWrite}>
                      {accountHealthValues.map((value) => <option key={value} value={value}>{readable(value)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Factual health rationale" hint="Record observable facts supporting the human health judgment.">
                    <TextArea required rows={6} value={healthRationale} onChange={(event) => setHealthRationale(event.target.value)} disabled={!canWrite} />
                  </Field>
                  {status === "ended" ? (
                    <Field label="End reason">
                      <TextArea required rows={4} value={endedReason} onChange={(event) => setEndedReason(event.target.value)} disabled={!canWrite} />
                    </Field>
                  ) : null}
                  <Button type="submit" loading={saving} disabled={!canWrite || !formValid || !changed || conflict}>
                    Confirm human account review
                  </Button>
                </form>
              </ReviewSection>
            </ConsequentialReviewLayout>
          </div>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="orders" active={activeTab === "orders"}>
          <RelationshipSection title="Actual Orders" description="Only documented Orders appear here. Placement is not Account; Order value is not commission owed.">
            {detail.orders.length === 0 ? <EmptyState compact description="No Orders are linked to this Account." /> : (
              <div className="record-list">
                {detail.orders.map((order) => (
                  <div className="task-row" key={order.id}>
                    <span>
                      <strong>{shown(field(order, "orderNumber", "order_number"))}</strong>
                      <small>{dateShown(field(order, "orderDate", "order_date"))} · {currency(field(order, "netCommissionable", "net_commissionable"), order.currency)}</small>
                    </span>
                    <StatusLabel value={shown(order.status)} />
                  </div>
                ))}
              </div>
            )}
            <Link className="ry-button ry-button-secondary" to="/orders">Open Orders</Link>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="reorders" active={activeTab === "reorders"}>
          <RelationshipSection title="Reorder continuity" description="Reorder dates and amounts are operational projections until a documented Order exists.">
            {detail.reorders.length === 0 ? <EmptyState compact description="No reorder reviews are linked to this Account." /> : (
              <div className="record-list">
                {detail.reorders.map((reorder) => (
                  <div className="task-row" key={reorder.id}>
                    <span>
                      <strong>{shown(field(reorder, "nextAction", "next_action"), "Review reorder")}</strong>
                      <small>Window {dateShown(field(reorder, "expectedWindowStartsOn", "expected_window_starts_on"))} – {dateShown(field(reorder, "expectedWindowEndsOn", "expected_window_ends_on"))}</small>
                    </span>
                    <StatusLabel value={shown(reorder.status)} />
                  </div>
                ))}
              </div>
            )}
            <p className="ry-commerce-boundary">Projected reorders and Estimated Commissions are not guaranteed revenue.</p>
            <Link className="ry-button ry-button-secondary" to="/reorders">Open Reorders</Link>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="protection" active={activeTab === "protection"}>
          <RelationshipSection title="Documented protection" description="Operational Account status does not create protection. Review the documented basis, scope, dates, and human confirmation separately.">
            {detail.protections.length === 0 ? <EmptyState compact description="No protection is asserted for this Account." /> : (
              <div className="record-list">
                {detail.protections.map((item) => (
                  <div className="task-row" key={item.id}>
                    <span>
                      <strong>{shown(field(item, "scopeSummary", "scope_summary"), "Protection record")}</strong>
                      <small>{dateShown(field(item, "protectionStartsOn", "protection_starts_on"))} – {dateShown(field(item, "protectionEndsOn", "protection_ends_on"))}</small>
                    </span>
                    <StatusLabel value={shown(item.status)} />
                  </div>
                ))}
              </div>
            )}
            <Link className="ry-button ry-button-secondary" to="/protected-accounts">Open Protected Accounts</Link>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Commercial activity" description="Stored Account events and activities remain visible after protection or the Brand relationship ends.">
            {detail.events.length + detail.activities.length === 0 ? <EmptyState compact description="No commercial activity is recorded." /> : (
              <div className="record-list">
                {detail.events.map((event, index) => (
                  <div className="task-row" key={`${shown(field(event, "eventType", "event_type"))}-${index}`}>
                    <span><strong>{readable(shown(field(event, "eventType", "event_type")))}</strong><small>{shown(event.reason)} · {dateTime(field(event, "occurredAt", "occurred_at"))}</small></span>
                  </div>
                ))}
                {detail.activities.map((activity, index) => (
                  <div className="task-row" key={`${shown(field(activity, "activityType", "activity_type"))}-${index}`}>
                    <span><strong>{shown(activity.summary)}</strong><small>{readable(shown(field(activity, "activityType", "activity_type")))} · {dateTime(field(activity, "occurredAt", "occurred_at"))}</small></span>
                    <StatusLabel value={shown(activity.status)} />
                  </div>
                ))}
              </div>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="commissions" active={activeTab === "commissions"}>
          <RelationshipSection title="Commission reconciliation" description="Increment 15 owns commission calculation, approval, disputes, and payment reconciliation. Account status and Order value do not establish commission owed.">
            <p>Review commission records in the dedicated register. This Account view does not calculate or restate commission amounts.</p>
            <p className="ry-commerce-boundary">Projected reorders and Estimated Commissions are not guaranteed revenue.</p>
            <Link className="ry-button ry-button-secondary" to="/commissions">Open Commissions</Link>
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <StickyMobileAction>{primaryAction}</StickyMobileAction>
      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm human Account review"
        description="Record this exact Account status and human health judgment after server validation."
        consequence={(
          <>
            <strong>{brand} → {business}</strong>
            <p>Status: {readable(status)} · Health: {readable(health)}</p>
            <p>Version {shown(account.version)} · {healthRationale}</p>
            {status === "ended" ? <p>End reason: {endedReason}</p> : null}
          </>
        )}
        confirmLabel="Confirm human account review"
        processing={saving}
        onConfirm={() => void submitReview()}
        onClose={() => setConfirmationOpen(false)}
      />
    </div>
  );
}
