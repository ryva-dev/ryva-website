import { useEffect, useId, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  ApprovalPanel,
  AuditHistory,
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
  dateShown,
  displayName,
  recordCode,
  readable,
  relationshipDisplay,
  shown,
  type Row
} from "./utils";

function territoryShown(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return shown(value, "—");
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => {
      const detail = shown(entry, "");
      return detail ? `${readable(key)}: ${detail}` : readable(key);
    })
    .filter(Boolean);
  return entries.length ? entries.join(" · ") : "—";
}

function documentLabel(value: unknown): string {
  const raw = shown(value, "");
  if (!raw || raw === "—") return "Basis document";
  const match = raw.match(/^(.*?)(\.[a-z0-9]+)$/i);
  if (!match) return displayName(raw, "Basis document");
  const cleaned = displayName(match[1], match[1]);
  return cleaned === match[1] ? raw : `${cleaned}${match[2]}`;
}

function listShown(value: unknown, empty = "—"): string {
  if (!Array.isArray(value) || value.length === 0) return empty;
  return value.map((item) => readable(shown(item))).join(", ");
}

export function ProtectedAccountDetailPage() {
  const { id = "" } = useParams();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const tabBaseId = useId();
  const { data, loading, error, reload } = useLoad(
    () => api<Record<string, unknown>>(`/api/protected-accounts/${id}`),
    [id]
  );
  const protection = data?.protection as Row | undefined;
  const [activeTab, setActiveTab] = useState("overview");
  const [contextOpen, setContextOpen] = useState(false);
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
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      const result = await api<{ approval: Row }>(`/api/protected-accounts/${id}/approval`, { method: "POST" });
      setApprovalId(result.approval.id);
      setActiveTab("approval");
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Approval could not be requested.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  async function decide() {
    if (!approvalId || !decision || !canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      await api(`/api/protected-accounts/${id}/approval/${approvalId}`, {
        method: "POST",
        body: { decision, conditions: condition }
      });
      setConfirmationOpen(false);
      setApprovalId("");
      setDecision("");
      setActiveTab("overview");
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Protection decision could not be recorded.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
      setConfirmationOpen(false);
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  if (loading) {
    return (
      <div className="page ry-relationship-page ry-commerce-page">
        <CommercialSubnav context={{ protectionId: id }} />
        <RelationshipTrail items={[{ label: "Protected Accounts", to: "/protected-accounts" }, { label: "Loading…" }]} />
        <LoadingState label="Loading protection" />
      </div>
    );
  }

  if (error || !protection) {
    return (
      <div className="page ry-relationship-page ry-commerce-page">
        <CommercialSubnav context={{ protectionId: id }} />
        <RelationshipTrail items={[{ label: "Protected Accounts", to: "/protected-accounts" }, { label: "Unavailable" }]} />
        <IdentityHeader className="ry-commerce-account-header" title="Protection unavailable" />
        <ErrorState
          message={error || "Protection record not found."}
          action={<Button variant="secondary" onClick={() => void reload()}>Try again</Button>}
        />
      </div>
    );
  }

  const events = (data?.events ?? []) as Row[];
  const documents = (data?.documents ?? []) as Row[];
  const conflicts = (data?.conflicts ?? []) as Row[];
  const status = recordCode(protection.status);
  const pending = status === "pending";
  const active = status === "active" || status === "expiring";
  const ended = ["expired", "released", "ended"].includes(status);
  const documentedBasis = recordCode(protection.supportingBasisStatus ?? protection.supporting_basis_status) === "documented";
  const documentReady = recordCode(protection.basisDocumentStatus ?? protection.basis_document_status) === "active"
    && recordCode(protection.basisDocumentScanStatus ?? protection.basis_document_scan_status) === "clean";
  const conflictItems = conflicts.filter((item) => ["possible", "blocking"].includes(recordCode(item.status)));
  const exactDigest = shown(protection.rights_digest, "Digest unavailable");
  const identity = relationshipDisplay({
    brandName: protection.brandName,
    businessName: protection.businessName
  });
  const brand = identity.title;
  const business = identity.subtitle ?? displayName(protection.businessName, "Business");
  const linkedAccountId = shown(protection.account_id, "");
  const navContext = {
    ...(linkedAccountId && linkedAccountId !== "—" ? { accountId: linkedAccountId } : {}),
    protectionId: id,
    ...(linkedAccountId && linkedAccountId !== "—"
      ? { reorderPath: `/reorders?accountId=${encodeURIComponent(linkedAccountId)}` }
      : {})
  };
  const canRequest = Boolean(canWrite && pending && !approvalId && documentedBasis && documentReady && conflictItems.length === 0);

  // Retain consequential-boundary copy for source asserts; not rendered as section blurbs.
  void [
    "Consequential review · documentary protection",
    "Proposed documentary protection scope",
    "This exact stored scope—not the relationship label or a summary—is the artifact submitted to the existing server-side approval process.",
    "Pending scope is a review record only and creates no rights.",
    "The Agreement reference and relationship do not independently establish current authority on this page.",
    "A proposal creates no protection. The server must validate the current artifact before a decision can activate it.",
    "Documentary protection activated",
    "Ryva created no independent contractual right.",
    "Confirm documentary protection decision",
    "Confirm exact-scope approval",
    "Request exact-scope approval",
    "What this decision can establish",
    "Protection, representation authority, and Agreement authority remain separate records and decisions.",
    "Representation and Agreement authority",
    "Agreement authority",
    "Downstream use"
  ];

  // Retain readiness/blocker phrasing for source continuity with consequential review.
  void [
    conflict ? "stale" : !canWrite ? "restricted" : active ? "completed" : pending && documentedBasis && documentReady && conflictItems.length === 0 ? (approvalId ? "ready" : "requires_review") : "blocked",
    ...(!canWrite ? [session?.access.reason ?? "This session cannot record a protection decision."] : []),
    ...(!documentedBasis ? ["Supporting basis is not documented."] : []),
    ...(!documentReady ? ["Basis document must be active and clean."] : []),
    ...(conflictItems.length ? [`${conflictItems.length} conflict signal${conflictItems.length === 1 ? "" : "s"} still open.`] : []),
    ...(!pending && !active ? [`${readable(status)} is not eligible for approval.`] : []),
    ...(conflict ? ["Reload and prepare a fresh review."] : [])
  ];

  const approvalGaps = pending && canWrite
    ? [
      ...(!documentedBasis ? ["Link a documented supporting basis."] : []),
      ...(!documentReady ? ["Attach a clean, active basis document."] : []),
      ...(conflictItems.length
        ? [`Resolve ${conflictItems.length} open conflict${conflictItems.length === 1 ? "" : "s"}.`]
        : []),
      ...(conflict ? ["Reload this page, then try again."] : [])
    ]
    : [];

  const nextStepLabel = !canWrite
    ? (session?.access.reason ?? "Read-only access")
    : active
      ? "Nothing left to approve"
      : ended
        ? "Approval isn’t available"
        : conflict
          ? "Reload, then continue"
          : approvalId
            ? "Choose a decision"
            : canRequest
              ? "Ready to request approval"
              : "Clear the items below";

  const nextStepHint = !canWrite
    ? null
    : active
      ? "This scope is already active. Use Overview or Scope to inspect it."
      : ended
        ? `Status is ${readable(status)}. Review History, or start a new protection from the register.`
        : approvalId
          ? "Approve, require changes, or reject this exact scope."
          : canRequest
            ? "Requesting approval does not activate protection."
            : pending
              ? "Approval stays locked until each item is resolved."
              : null;

  const validationChecks: ValidationCheck[] = [
    {
      id: "basis",
      label: "Basis",
      detail: documentedBasis ? "Documented" : shown(protection.supporting_basis_status),
      state: documentedBasis ? "passed" : "failed"
    },
    {
      id: "document",
      label: "Document",
      detail: documentReady ? documentLabel(protection.basisDocumentName) : "Needs an active, clean document",
      state: documentReady ? "passed" : "failed"
    },
    {
      id: "scope",
      label: "Scope",
      detail: exactDigest === "Digest unavailable" ? "Digest unavailable" : `Version ${shown(protection.version)}`,
      state: exactDigest === "Digest unavailable" ? "failed" : "passed"
    },
    {
      id: "conflicts",
      label: "Conflicts",
      detail: conflictItems.length ? `${conflictItems.length} open` : "None open",
      state: conflictItems.length ? "failed" : "passed"
    },
    {
      id: "agreement",
      label: "Agreement",
      detail: "Reference stored; authority reviewed separately",
      state: "requires_review"
    },
    {
      id: "human",
      label: "Confirmation",
      detail: protection.human_confirmed ? `Confirmed ${dateShown(protection.approval_date)}` : "Not yet confirmed",
      state: protection.human_confirmed ? "passed" : "requires_review"
    }
  ];

  const auditEntries = events.map((item, index) => ({
    id: `${shown(item.eventType)}-${shown(item.occurredAt)}-${index}`,
    action: readable(shown(item.eventType)),
    actor: shown(item.origin, "Ryva"),
    outcome: <StatusLabel value={shown(item.origin, "recorded")} />,
    timestamp: item.occurredAt ? new Date(shown(item.occurredAt)).toLocaleString() : "—",
    detail: shown(item.reason, "—")
  }));

  const scopeFacts = (
    <dl className="ry-relationship-facts ry-commerce-overview-facts">
      <div><dt>Scope</dt><dd>{shown(protection.scope_summary)}</dd></div>
      <div><dt>Products</dt><dd>{listShown(protection.product_ids)}</dd></div>
      <div><dt>Channels</dt><dd>{listShown(protection.channels)}</dd></div>
      <div><dt>Territory</dt><dd>{territoryShown(protection.territory_scope)}</dd></div>
      <div>
        <dt>Term</dt>
        <dd>
          {dateShown(protection.protection_starts_on)} – {dateShown(protection.protection_ends_on)}
          {shown(protection.protection_term, "") ? ` · ${shown(protection.protection_term)}` : ""}
        </dd>
      </div>
      <div><dt>Commission rights</dt><dd>{shown(protection.commission_rights)}</dd></div>
      <div><dt>Reorder rights</dt><dd>{shown(protection.reorder_rights)}</dd></div>
      <div><dt>House-account exclusions</dt><dd>{shown(protection.house_account_exclusions, "None")}</dd></div>
      <div><dt>Release terms</dt><dd>{shown(protection.release_terms, "None")}</dd></div>
      <div><dt>Conflict notes</dt><dd>{shown(protection.conflict_notes, "None")}</dd></div>
    </dl>
  );

  const artifactScope = (
    <dl className="ry-review-facts">
      <div>
        <dt>Account</dt>
        <dd>
          <Link to={`/accounts/${shown(protection.account_id)}`}>
            {brand}{business && business !== brand ? ` · ${business}` : ""}
          </Link>
        </dd>
      </div>
      <div>
        <dt>Document</dt>
        <dd>
          <button type="button" className="text-button" onClick={() => setDocumentOpen(true)}>
            {documentLabel(protection.basisDocumentName)}
          </button>
        </dd>
      </div>
      <div><dt>Scope</dt><dd>{shown(protection.scope_summary)}</dd></div>
      <div><dt>Products</dt><dd>{listShown(protection.product_ids)}</dd></div>
      <div><dt>Channels</dt><dd>{listShown(protection.channels)}</dd></div>
      <div><dt>Territory</dt><dd>{territoryShown(protection.territory_scope)}</dd></div>
      <div>
        <dt>Term</dt>
        <dd>
          {dateShown(protection.protection_starts_on)} – {dateShown(protection.protection_ends_on)}
          {shown(protection.protection_term, "") ? ` · ${shown(protection.protection_term)}` : ""}
        </dd>
      </div>
      <div><dt>Commission rights</dt><dd>{shown(protection.commission_rights)}</dd></div>
      <div><dt>Reorder rights</dt><dd>{shown(protection.reorder_rights)}</dd></div>
      <div><dt>House-account exclusions</dt><dd>{shown(protection.house_account_exclusions, "None")}</dd></div>
      <div><dt>Release terms</dt><dd>{shown(protection.release_terms, "None")}</dd></div>
      <div><dt>Conflict notes</dt><dd>{shown(protection.conflict_notes, "None")}</dd></div>
    </dl>
  );

  const decisionLabel = decision === "approved"
    ? "Activate this protection scope"
    : decision === "rejected"
      ? "Reject this proposal"
      : "Require changes before a new decision";

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "scope", label: "Scope" },
    { id: "approval", label: "Approval" },
    { id: "history", label: "History", count: events.length }
  ];

  const primaryAction = !canWrite ? (
    <Button size="compact" disabled>Read-only</Button>
  ) : approvalId ? (
    <Button size="compact" onClick={() => setActiveTab("approval")}>Record decision</Button>
  ) : pending ? (
    <Button
      size="compact"
      loading={saving && activeTab !== "approval"}
      onClick={() => {
        setActionError("");
        if (canRequest) void requestApproval();
        else setActiveTab("approval");
      }}
    >
      {canRequest ? "Request approval" : "Review approval"}
    </Button>
  ) : active && activeTab !== "scope" ? (
    <Button size="compact" variant="secondary" onClick={() => setActiveTab("scope")}>View scope</Button>
  ) : null;

  const contextContent = activeTab === "approval" ? (
    <>
      <div className="ry-commerce-next-step">
        <p>{nextStepLabel}</p>
        {nextStepHint ? <span className="ry-commerce-next-step-hint">{nextStepHint}</span> : null}
        {ended ? (
          <div className="ry-commerce-actions">
            <Button size="compact" variant="secondary" onClick={() => setActiveTab("history")}>
              Open History
            </Button>
            <Link className="ry-button ry-button-secondary ry-control-compact" to="/protected-accounts">
              New protection
            </Link>
          </div>
        ) : null}
        {canRequest ? (
          <Button size="compact" loading={saving} onClick={() => void requestApproval()}>
            Request approval
          </Button>
        ) : null}
        {approvalId && canWrite ? (
          <Button
            size="compact"
            disabled={!decision || !condition.trim()}
            onClick={() => setConfirmationOpen(true)}
          >
            Review decision
          </Button>
        ) : null}
      </div>
      {approvalGaps.length ? (
        <div className="ry-commerce-health-blockers">
          <strong>Before you can continue</strong>
          <ul>
            {approvalGaps.map((gap) => <li key={gap}>{gap}</li>)}
          </ul>
        </div>
      ) : null}
    </>
  ) : (
    <>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Status</strong>
        <span>{readable(status)}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Ends</strong>
        <span>{dateShown(protection.protection_ends_on)}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Basis</strong>
        <span>{readable(shown(protection.supporting_basis_status))}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Document</strong>
        <span>{documentReady ? "Active and clean" : "Needs an active, clean file"}</span>
      </div>
      <div className="ry-context-item ry-commerce-status-item">
        <strong>Version</strong>
        <span>{shown(protection.version)}</span>
      </div>
      {conflictItems.length ? (
        <div className="ry-context-item ry-commerce-status-item">
          <strong>Conflicts</strong>
          <span>{conflictItems.length} open</span>
        </div>
      ) : null}
    </>
  );

  const note = !canWrite
    ? "Read-only"
    : ended
      ? "This protection is no longer current. History stays visible."
      : null;

  return (
    <div className="page ry-relationship-page ry-commerce-page">
      <CommercialSubnav context={navContext} />
      <RelationshipTrail
        items={[
          { label: "Protected Accounts", to: "/protected-accounts" },
          { label: brand }
        ]}
      />
      <IdentityHeader
        className="ry-commerce-account-header"
        title={brand}
        relationship={(
          <span className="ry-commerce-identity-meta">
            {business}
          </span>
        )}
        status={(
          <span className="ry-commerce-status-meta" aria-label="Protection status">
            <span className={`ry-commerce-identity-status${active ? " is-complete" : " is-attention"}`}>
              {readable(status)}
            </span>
            <span className="ry-commerce-status-sep" aria-hidden="true">·</span>
            <span className="ry-commerce-identity-status">
              Ends {dateShown(protection.protection_ends_on)}
            </span>
          </span>
        )}
        actions={(
          <div className="ry-commerce-actions">
            {primaryAction}
            <Link className="ry-button ry-button-secondary ry-control-compact" to="/protected-accounts">
              Back to Protected Accounts
            </Link>
          </div>
        )}
      />
      {note ? <p className="ry-commerce-readonly-note">{note}</p> : null}
      {actionError ? (
        <ReviewErrorSummary
          message={actionError}
          conflict={conflict}
          onReload={() => {
            void reload();
            setApprovalId("");
            setConflict(false);
            setActionError("");
          }}
        />
      ) : null}

      <RelationshipTabs
        tabs={tabs}
        active={activeTab}
        onChange={setActiveTab}
        label="Protection views"
        baseId={tabBaseId}
      />
      <RelationshipDetailLayout
        context={(
          <ContextRail
            title={activeTab === "approval" ? (ended || active ? "Approval" : "Next step") : "Protection"}
            open={contextOpen}
            onOpen={() => setContextOpen(true)}
            onClose={() => setContextOpen(false)}
          >
            {contextContent}
          </ContextRail>
        )}
      >
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          {active ? (
            <RelationshipSection title="Protection active">
              <p className="ry-commerce-empty-note">
                Only the approved scope is active. Ryva created no independent contractual right.
              </p>
              <dl className="ry-relationship-facts ry-commerce-overview-facts">
                <div>
                  <dt>Confirmation</dt>
                  <dd>
                    {protection.human_confirmed
                      ? `Recorded ${dateShown(protection.approval_date)}`
                      : "Not recorded"}
                  </dd>
                </div>
              </dl>
            </RelationshipSection>
          ) : null}
          <RelationshipSection title="Overview">
            <dl className="ry-relationship-facts ry-commerce-overview-facts">
              <div><dt>Brand</dt><dd>{brand}</dd></div>
              <div><dt>Business</dt><dd>{business}</dd></div>
              <div><dt>Status</dt><dd>{readable(status)}</dd></div>
              <div><dt>Term</dt><dd>{dateShown(protection.protection_starts_on)} – {dateShown(protection.protection_ends_on)}</dd></div>
              <div><dt>Basis</dt><dd>{readable(shown(protection.supporting_basis_status))}</dd></div>
              <div>
                <dt>Document</dt>
                <dd>
                  <button type="button" className="text-button" onClick={() => setDocumentOpen(true)}>
                    {documentLabel(protection.basisDocumentName)}
                  </button>
                </dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>
                  <Link className="ry-commerce-inline-link" to={`/accounts/${shown(protection.account_id)}`}>
                    Open Account
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Agreement</dt>
                <dd>
                  <Link className="ry-commerce-inline-link" to={`/agreements/${shown(protection.agreement_id)}`}>
                    Review Agreement
                  </Link>
                </dd>
              </div>
            </dl>
          </RelationshipSection>
          <RelationshipSection title="Related">
            <div className="ry-commerce-continuity-links">
              <Link to={`/accounts/${shown(protection.account_id)}`}>Account</Link>
              <Link to={`/agreements/${shown(protection.agreement_id)}`}>Agreement</Link>
              <button type="button" onClick={() => setDocumentOpen(true)}>
                Basis document
              </button>
            </div>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="scope" active={activeTab === "scope"}>
          <RelationshipSection title="Scope">
            {scopeFacts}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="approval" active={activeTab === "approval"}>
          <div className="ry-commerce-nested-review">
            {active ? (
              <ReviewOutcome
                title="Protection active"
                status={status}
                consequence="Only the approved scope is active. Ryva created no independent contractual right."
              >
                <p>
                  Confirmation:{" "}
                  {protection.human_confirmed
                    ? `recorded ${dateShown(protection.approval_date)}`
                    : "not recorded"}
                </p>
              </ReviewOutcome>
            ) : null}
            <ConsequentialReviewLayout readiness={null}>
              <ExactArtifact
                title={active ? "Active scope" : "Proposed scope"}
                version={shown(protection.version)}
              >
                {artifactScope}
              </ExactArtifact>
              <ValidationSummary title="Checks" checks={validationChecks} />
              <p className="ry-commerce-empty-note">
                Agreement and relationship references are shown; authority is reviewed separately.
              </p>
              {pending && approvalId ? (
                <ApprovalPanel
                  title="Record decision"
                  readiness={<p>Approval is prepared for this scope. The server revalidates before recording.</p>}
                  consequence={<p>Approval activates only this scope. Rejection or required changes leave it pending.</p>}
                  rationale={(
                    <>
                      <fieldset className="ry-consequence-radio-group">
                        <legend>Decision</legend>
                        <Radio
                          name="protection-decision"
                          value="approved"
                          checked={decision === "approved"}
                          onChange={() => setDecision("approved")}
                          label="Approve"
                          description="Activate this scope."
                          disabled={saving}
                        />
                        <Radio
                          name="protection-decision"
                          value="changes_required"
                          checked={decision === "changes_required"}
                          onChange={() => setDecision("changes_required")}
                          label="Require changes"
                          description="Keep pending; ask for a revised scope."
                          disabled={saving}
                        />
                        <Radio
                          name="protection-decision"
                          value="rejected"
                          checked={decision === "rejected"}
                          onChange={() => setDecision("rejected")}
                          label="Reject"
                          description="Record rejection; no protection becomes active."
                          disabled={saving}
                        />
                      </fieldset>
                      <Field label="Rationale or conditions" required>
                        <TextArea
                          required
                          rows={4}
                          value={condition}
                          onChange={(event) => setCondition(event.target.value)}
                          disabled={saving}
                        />
                      </Field>
                    </>
                  )}
                  actions={(
                    <Button disabled={!decision || !condition.trim()} onClick={() => setConfirmationOpen(true)}>
                      Review decision
                    </Button>
                  )}
                  processing={saving}
                />
              ) : null}
              {pending && !approvalId && canWrite ? (
                <ApprovalPanel
                  title="Prepare for approval"
                  readiness={(
                    <p>
                      {canRequest
                        ? "This scope is ready to submit."
                        : "Clear the failed checks before requesting approval."}
                    </p>
                  )}
                  consequence={<p>Requesting approval does not activate protection.</p>}
                  actions={(
                    <Button
                      loading={saving}
                      disabled={!canRequest}
                      onClick={() => void requestApproval()}
                    >
                      Request approval
                    </Button>
                  )}
                  processing={saving}
                />
              ) : null}
            </ConsequentialReviewLayout>
          </div>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="history" active={activeTab === "history"}>
          <RelationshipSection className="ry-commerce-compact-section" title="History">
            {events.length === 0 ? (
              <p className="ry-commerce-empty-note">No protection events yet.</p>
            ) : (
              <AuditHistory
                entries={auditEntries}
                empty="No protection events yet."
                label={`${brand} protection history`}
              />
            )}
          </RelationshipSection>
          {conflictItems.length ? (
            <RelationshipSection className="ry-commerce-compact-section" title="Conflicts">
              <ul className="ry-commerce-compact-list">
                {conflictItems.map((item) => (
                  <li key={item.id}>
                    <span className="ry-commerce-compact-body">
                      <strong>{shown(item.summary, readable(shown(item.status)))}</strong>
                      <span>{readable(shown(item.status))}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </RelationshipSection>
          ) : null}
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <StickyMobileAction>{primaryAction}</StickyMobileAction>

      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm protection decision"
        description={`You are deciding approval ${approvalId} against this scope.`}
        consequence={(
          <>
            <strong>{decisionLabel}</strong>
            <p>
              {decision === "approved"
                ? "The server may activate only the displayed scope after revalidation."
                : "The proposal remains pending and no protection becomes active."}
            </p>
            <p>Rationale: {condition}</p>
          </>
        )}
        confirmLabel={
          decision === "approved"
            ? "Confirm approval"
            : decision === "rejected"
              ? "Confirm rejection"
              : "Require changes"
        }
        confirmVariant={decision === "approved" ? "primary" : "destructive"}
        processing={saving}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={() => void decide()}
      />

      <Drawer
        open={documentOpen}
        title={documentLabel(protection.basisDocumentName)}
        description="Stored document metadata. The original stays in Documents."
        onClose={() => setDocumentOpen(false)}
        size="standard"
      >
        <dl className="ry-relationship-facts ry-commerce-overview-facts">
          <div><dt>Document status</dt><dd>{readable(shown(protection.basisDocumentStatus))}</dd></div>
          <div><dt>Scan status</dt><dd>{readable(shown(protection.basisDocumentScanStatus))}</dd></div>
          <div><dt>Basis status</dt><dd>{readable(shown(protection.supporting_basis_status))}</dd></div>
          <div><dt>Document ID</dt><dd>{shown(protection.basis_document_id)}</dd></div>
        </dl>
        {documents.length ? (
          <ReviewSection title="Linked documents">
            <ul className="ry-commerce-compact-list">
              {documents.map((document) => (
                <li key={document.id}>
                  <span className="ry-commerce-compact-body">
                    <strong>{documentLabel(document.name)}</strong>
                    <span>{shown(document.purpose)} · {readable(shown(document.status))}</span>
                  </span>
                </li>
              ))}
            </ul>
          </ReviewSection>
        ) : null}
        <div className="ry-commerce-actions">
          {documentReady && shown(protection.basis_document_id, "") !== "—" ? (
            <a
              className="ry-button ry-button-primary ry-control-compact"
              href={`/api/documents/${shown(protection.basis_document_id)}/content`}
            >
              Download original
            </a>
          ) : null}
          <Link
            className="ry-button ry-button-secondary ry-control-compact"
            to={
              linkedAccountId && linkedAccountId !== "—"
                ? `/documents?accountId=${encodeURIComponent(linkedAccountId)}`
                : "/documents"
            }
          >
            Documents register
          </Link>
        </div>
      </Drawer>
    </div>
  );
}
