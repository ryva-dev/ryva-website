import { Fragment, useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  ActivityTimeline,
  Alert,
  Button,
  Checkbox,
  ConfirmationDialog,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  IdentityHeader,
  Input,
  LoadingState,
  Select,
  StatusLabel,
  TextArea
} from "../../design-system";
import {
  ReviewErrorSummary,
  ReviewOutcome,
  type ReviewReadiness
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
import { authorityBlockedActionReason, authorityBlockedAlertContent, authorityRecoveryLabel } from "../representation/utils";
import {
  conflictStatus,
  dateTime,
  displayBrand,
  displayBusiness,
  defaultNextStage,
  field,
  isTerminalStage,
  overviewTimelineIndex,
  overviewTimelineStages,
  placementStage,
  readable,
  selectableStages,
  shown,
  type Row
} from "./utils";

type PlacementDetail = {
  placement: Row;
  products: Array<{ productId: string }>;
  triangle: Row | null;
  events: Row[];
  conflicts: Row[];
  commercial?: {
    orderId?: string | null;
    orderCount?: number;
    accountId?: string | null;
    accountCount?: number;
    reorderId?: string | null;
    reorderCount?: number;
    protectionId?: string | null;
    protectionCount?: number;
  };
};

type BusinessContext = {
  record?: Row;
  decisions: Row[];
  tasks: Row[];
};

type AuthorityResult = { outcome: string; reasonCodes: string[] };

function DisabledActionHint({ reason, children }: { reason: string; children: ReactNode }) {
  return (
    <span className="ry-disabled-action-hint" title={reason}>
      {children}
    </span>
  );
}

export function PlacementDetailPage() {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const tabBaseId = useId();
  const submissionGuard = useRef(false);

  const [detail, setDetail] = useState<PlacementDetail | null>(null);
  const [business, setBusiness] = useState<BusinessContext | null>(null);
  const [authority, setAuthority] = useState<AuthorityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [contextOpen, setContextOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [alignmentOpen, setAlignmentOpen] = useState(false);
  const [alignmentSaving, setAlignmentSaving] = useState(false);
  const [alignmentError, setAlignmentError] = useState("");
  const [buyerAlignment, setBuyerAlignment] = useState("");
  const [brandAlignment, setBrandAlignment] = useState("");
  const [representativeAlignment, setRepresentativeAlignment] = useState("");
  const [allPartiesAligned, setAllPartiesAligned] = useState(false);
  const [lastOutcome, setLastOutcome] = useState("");

  const requestedStage = searchParams.get("toStage") ?? "";
  const [toStage, setToStage] = useState(() => (
    requestedStage && (selectableStages as readonly string[]).includes(requestedStage)
      ? requestedStage
      : defaultNextStage("identified")
  ));
  const [reason, setReason] = useState("");
  const [decisionId, setDecisionId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [evidenceIds, setEvidenceIds] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const value = await api<PlacementDetail>(`/api/placements/${id}`);
      setDetail(value);
      const businessId = shown(field(value.placement, "businessId", "business_id"));
      const context = await api<BusinessContext>(`/api/records/business/${businessId}`);
      setBusiness(context);
      setDecisionId(String(context.decisions.find((item) => item.status === "issued")?.id ?? ""));
      setTaskId(String(context.tasks.find((item) => !["completed", "canceled"].includes(String(item.status)))?.id ?? ""));
      const evaluated = await api<{ authority: AuthorityResult }>("/api/authority/evaluate", {
        method: "POST",
        body: {
          action: "placement_stage",
          brandId: field(value.placement, "brandId", "brand_id"),
          businessId: field(value.placement, "businessId", "business_id"),
          agreementId: field(value.placement, "agreementId", "agreement_id"),
          productIds: value.products.map((item) => item.productId),
          context: { placementId: id }
        }
      });
      setAuthority(evaluated.authority);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Placement could not be loaded.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (requestedStage && (selectableStages as readonly string[]).includes(requestedStage)) {
      setToStage(requestedStage);
      setActiveTab("case");
    }
  }, [requestedStage]);

  useEffect(() => {
    if (!detail) return;
    if (requestedStage && (selectableStages as readonly string[]).includes(requestedStage)) return;
    setToStage(defaultNextStage(placementStage(detail.placement)));
  }, [detail, requestedStage]);

  useEffect(() => {
    if (window.location.hash === "#stage-review") setActiveTab("case");
  }, [detail]);

  useEffect(() => {
    if (actionError) document.querySelector<HTMLElement>("[data-review-error]")?.focus();
  }, [actionError]);

  async function submitTransition() {
    if (!detail || !canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      await api(`/api/placements/${id}/stage`, {
        method: "POST",
        body: {
          version: detail.placement.version,
          toStage,
          reason,
          decisionId,
          evidenceIds: evidenceIds.split(",").map((item) => item.trim()).filter(Boolean),
          nextActionTaskId: isTerminalStage(toStage) ? null : taskId
        }
      });
      setConfirmationOpen(false);
      setLastOutcome(`${placementStage(detail.placement)} → ${toStage}`);
      setReason("");
      setEvidenceIds("");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Stage transition failed.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
      setConfirmationOpen(false);
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  function onReviewSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setConfirmationOpen(true);
  }

  async function submitValueAlignment(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || alignmentSaving) return;
    setAlignmentSaving(true);
    setAlignmentError("");
    try {
      await api(`/api/placements/${id}/value-alignment`, {
        method: "POST",
        body: {
          buyerValue: buyerAlignment,
          brandValue: brandAlignment,
          representativeValue: representativeAlignment,
          allPartiesReceiveLegitimateValue: allPartiesAligned
        }
      });
      setAlignmentOpen(false);
      setBuyerAlignment("");
      setBrandAlignment("");
      setRepresentativeAlignment("");
      setAllPartiesAligned(false);
      await load();
    } catch (caught) {
      setAlignmentError(caught instanceof Error ? caught.message : "Value alignment could not be recorded.");
    } finally {
      setAlignmentSaving(false);
    }
  }

  if (loading && !detail) {
    return (
      <div className="page ry-relationship-page ry-placement-page">
        <RelationshipTrail items={[{ label: "Placements", to: "/placements" }, { label: "Loading Placement Opportunity" }]} />
        <LoadingState label="Loading Placement Opportunity" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="page ry-relationship-page ry-placement-page">
        <RelationshipTrail items={[{ label: "Placements", to: "/placements" }, { label: "Placement Opportunity unavailable" }]} />
        <IdentityHeader eyebrow="Placement Opportunity" title="Placement unavailable" />
        <ErrorState message={error || "Placement Opportunity not found."} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const placement = detail.placement;
  const stage = placementStage(placement);
  const placementConflict = conflictStatus(placement);
  const brandName = displayBrand(placement);
  const businessName = displayBusiness(placement);
  void ["Complete the missing placement details before advancing this opportunity."];
  const agreementId = shown(field(placement, "agreementId", "agreement_id"));
  const authorityOutcome = authority?.outcome ?? "not_checked";
  const authorized = authorityOutcome === "authorized";
  const authorityBlocked = !authorized && Array.isArray(authority?.reasonCodes) && authority.reasonCodes.length
    ? authorityBlockedAlertContent(authority.reasonCodes)
    : null;
  const authorityBlocksActions = authority !== null && !authorized;
  const blockedActionReason = authorityBlocked
    ? authorityBlockedActionReason(authority!.reasonCodes)
    : "Representation authority is not confirmed for this placement.";
  const stalled = placement.stalled === true;
  const triangle = detail.triangle;
  const productCount = detail.products.length;

  const progression = overviewTimelineStages.map((item, itemIndex) => {
    const currentIndex = overviewTimelineIndex(stage);
    let state = "upcoming";
    if (currentIndex < 0) state = "completed";
    else if (currentIndex >= overviewTimelineStages.length) state = "completed";
    else if (itemIndex < currentIndex) state = "completed";
    else if (itemIndex === currentIndex) state = "current";
    else state = "upcoming";
    return { id: item, label: readable(item), state };
  });

  const commercial = detail.commercial ?? {};
  const orderCount = Number(commercial.orderCount ?? 0);
  const reorderCount = Number(commercial.reorderCount ?? 0);
  const accountId = commercial.accountId ? String(commercial.accountId) : "";
  const orderId = commercial.orderId ? String(commercial.orderId) : "";
  const reorderId = commercial.reorderId ? String(commercial.reorderId) : "";
  const protectionId = commercial.protectionId ? String(commercial.protectionId) : "";
  const placementQuery = `placementId=${encodeURIComponent(id)}`;
  const commercialLinks = [
    {
      id: "orders",
      label: orderCount > 1 ? `Orders (${orderCount})` : "Orders",
      to: orderId && orderCount === 1
        ? `/orders/${orderId}`
        : `/orders?${placementQuery}`
    },
    {
      id: "account",
      label: "Account",
      to: accountId
        ? `/accounts/${accountId}`
        : `/accounts?${placementQuery}`
    },
    {
      id: "reorders",
      label: reorderCount > 1 ? `Reorders (${reorderCount})` : "Reorders",
      to: accountId
        ? (reorderId
          ? `/reorders?accountId=${encodeURIComponent(accountId)}&reorderId=${encodeURIComponent(reorderId)}`
          : `/reorders?accountId=${encodeURIComponent(accountId)}`)
        : `/reorders?${placementQuery}`
    },
    {
      id: "protection",
      label: "Protection",
      to: protectionId
        ? `/protected-accounts/${protectionId}`
        : accountId
          ? `/protected-accounts?accountId=${encodeURIComponent(accountId)}`
          : `/protected-accounts?${placementQuery}`
    }
  ];

  const stageIndex = selectableStages.indexOf(stage as typeof selectableStages[number]);
  const toStageIndex = selectableStages.indexOf(toStage as typeof selectableStages[number]);
  const needsEvidence = isTerminalStage(toStage) || (stageIndex >= 0 && toStageIndex >= 0 && toStageIndex < stageIndex);

  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "You can review this placement, but cannot advance it in this session."] : []),
    ...(!authorized && !["identified", "closed_lost", "disqualified"].includes(toStage) ? ["Confirm agreement coverage"] : []),
    ...(toStage === "qualified" && placementConflict !== "clear" ? ["Resolve conflict"] : []),
    ...(!triangle ? ["Complete value alignment"] : []),
    ...(!decisionId ? ["Select a decision"] : []),
    ...(!isTerminalStage(toStage) && !taskId ? ["Select a next action"] : []),
    ...(needsEvidence && !evidenceIds.trim() ? ["Add supporting evidence"] : []),
    ...(conflict ? ["Reload this placement"] : [])
  ];

  const readinessState: ReviewReadiness = conflict
    ? "stale"
    : !canWrite
      ? "restricted"
      : (!authorized && !["identified", "closed_lost", "disqualified"].includes(toStage))
        || (toStage === "qualified" && placementConflict !== "clear")
        || !triangle
        || !decisionId
        || (!isTerminalStage(toStage) && !taskId)
        || (needsEvidence && !evidenceIds.trim())
        ? "blocked"
        : "requires_review";

  const advanceChecks = [
    {
      id: "coverage",
      ok: authorized || ["identified", "closed_lost", "disqualified"].includes(toStage),
      name: "Agreement coverage",
      status: authorized || ["identified", "closed_lost", "disqualified"].includes(toStage)
        ? "Complete"
        : "Missing"
    },
    {
      id: "conflict",
      ok: placementConflict === "clear" || toStage !== "qualified",
      name: "Conflict review",
      status: placementConflict === "clear" || toStage !== "qualified"
        ? "Complete"
        : "Needs attention"
    },
    {
      id: "alignment",
      ok: Boolean(triangle),
      name: "Value alignment",
      status: triangle ? "Complete" : "Incomplete"
    },
    {
      id: "decision",
      ok: Boolean(decisionId),
      name: "Decision",
      status: decisionId ? "Complete" : "Missing"
    },
    {
      id: "next",
      ok: isTerminalStage(toStage) || Boolean(taskId),
      name: "Next action",
      status: isTerminalStage(toStage) || taskId ? "Complete" : "Required"
    }
  ];

  const advanceBlocked = readinessState === "blocked" || readinessState === "restricted" || readinessState === "stale";
  const advanceLabel = `Advance to ${readable(toStage)}`;

  const activityEntries = [
    ...detail.events.map((item, index) => {
      const fromStage = typeof item.fromStage === "string" ? item.fromStage : "";
      const toStageLabel = readable(shown(item.toStage));
      const reasonText = shown(item.reason, "").trim();
      const transition = fromStage
        ? `${readable(fromStage)} → ${toStageLabel}`
        : null;
      return {
        id: `stage-${shown(item.occurredAt)}-${index}`,
        sortAt: shown(item.occurredAt, ""),
        title: `Stage changed to ${toStageLabel}`,
        description: [transition, reasonText || (fromStage ? "" : "Placement opened.")].filter(Boolean).join(". "),
        meta: dateTime(item.occurredAt),
        status: <StatusLabel value="Stage" />
      };
    }),
    ...(triangle ? [{
      id: `alignment-${shown(field(triangle, "id", "id"), "current")}`,
      sortAt: shown(field(triangle, "updatedAt", "updated_at") ?? field(triangle, "createdAt", "created_at"), ""),
      title: "Value alignment recorded",
      description: "Buyer, brand, and representative value were reviewed.",
      meta: dateTime(field(triangle, "updatedAt", "updated_at") ?? field(triangle, "createdAt", "created_at")),
      status: <StatusLabel value="Alignment" />
    }] : []),
    ...detail.conflicts.map((item, index) => ({
      id: `conflict-${shown(item.id, String(index))}`,
      sortAt: shown(field(item, "createdAt", "created_at") ?? item.created_at, ""),
      title: `Conflict ${readable(shown(item.status))}`,
      description: readable(shown(field(item, "conflictType", "conflict_type"), "review")),
      meta: dateTime(field(item, "createdAt", "created_at") ?? item.created_at),
      status: <StatusLabel value="Conflict" />
    }))
  ]
    .sort((left, right) => String(right.sortAt).localeCompare(String(left.sortAt)))
    .map(({ sortAt, ...entry }) => {
      void sortAt;
      return entry;
    });

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "case", label: "Rationale" },
    { id: "activity", label: "Activity", count: activityEntries.length },
    { id: "outreach", label: "Outreach" },
    { id: "commercial", label: "Commercial" }
  ];

  const primaryAction = canWrite
    ? authorityBlocksActions ? (
      <DisabledActionHint reason={blockedActionReason}>
        <Button disabled title={blockedActionReason}>Advance stage</Button>
      </DisabledActionHint>
    ) : (
      <Button onClick={() => { setActionError(""); setActiveTab("case"); }}>Advance stage</Button>
    )
    : <Button disabled>Read-only access</Button>;

  const outreachAction = authorityBlocksActions ? (
    <DisabledActionHint reason={blockedActionReason}>
      <Button variant="secondary" disabled title={blockedActionReason}>Start outreach</Button>
    </DisabledActionHint>
  ) : (
    <Link className="ry-button ry-button-secondary" to={`/outreach?placementId=${id}`}>Start outreach</Link>
  );

  const recoveryAction = authorityBlocksActions && canWrite ? (
    <Link
      className="ry-button ry-button-primary"
      to={authorityBlocked?.showAgreementLink && agreementId ? `/agreements/${agreementId}` : "/representation"}
    >
      {authorityBlocked ? authorityRecoveryLabel(authority.reasonCodes) : "Resolve agreement coverage"}
    </Link>
  ) : null;

  const headerActions = authorityBlocksActions && canWrite && recoveryAction
    ? <>{recoveryAction}{primaryAction}{outreachAction}</>
    : <>{primaryAction}{outreachAction}</>;

  const agreementStatus = shown(field(placement, "agreementStatus", "agreement_status"), "");
  const agreementMeta = agreementStatus === "active" || (!agreementStatus && authorized)
    ? "Agreement active"
    : agreementStatus
      ? `Agreement ${readable(agreementStatus)}`
      : "Agreement";

  const authorityChannel = shown(field(placement, "authorityChannel", "authority_channel"), "");
  const agreementChannels = placement.agreementChannels ?? placement.channels;
  const coverageChannel = authorityChannel
    ? readable(authorityChannel)
    : (Array.isArray(agreementChannels) && agreementChannels.length
      ? agreementChannels.map((item) => readable(String(item))).join(", ")
      : "Not recorded");

  const territoryScope = (field(placement, "agreementTerritoryScope", "territory_scope")
    ?? placement.agreementTerritoryScope
    ?? {}) as Record<string, unknown>;
  const territoryParts = [
    ...(Array.isArray(territoryScope.countries) ? territoryScope.countries.map(String) : []),
    ...(Array.isArray(territoryScope.regions) ? territoryScope.regions.map(String) : []),
    ...(Array.isArray(territoryScope.states) ? territoryScope.states.map(String) : []),
    typeof territoryScope.label === "string" ? territoryScope.label : "",
    typeof territoryScope.summary === "string" ? territoryScope.summary : ""
  ].filter(Boolean);
  const coverageTerritory = territoryParts.length
    ? territoryParts.join(", ")
    : (typeof territoryScope === "string" && territoryScope
      ? territoryScope
      : "Not recorded");

  const authorityStatusLabel = authorityOutcome === "authorized" ? "Confirmed" : readable(authorityOutcome);
  const conflictStatusLabel = placementConflict === "clear" ? "None" : readable(placementConflict);
  const nextActionStatusLabel = shown(placement.nextAction, "") || "Not assigned";

  const contextContent = (
    <>
      <dl className="ry-placement-status-list">
        <div className="ry-placement-status-row">
          <dt>Stage</dt>
          <dd>{readable(stage)}{stalled ? " · Stalled" : ""}</dd>
        </div>
        <div className="ry-placement-status-row">
          <dt>Authority</dt>
          <dd>{authorityStatusLabel}</dd>
        </div>
        <div className="ry-placement-status-row">
          <dt>Conflict</dt>
          <dd>{conflictStatusLabel}</dd>
        </div>
        <div className="ry-placement-status-row">
          <dt>Next action</dt>
          <dd>{nextActionStatusLabel}</dd>
        </div>
      </dl>
      {activeTab === "case" && advanceBlocked && blockers.length > 0 ? (
        <div className="ry-placement-missing-actions ry-placement-missing-actions-rail" role="status">
          <strong>Still needed</strong>
          <ul>
            {blockers.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="page ry-relationship-page ry-placement-page">
      <RelationshipTrail items={[
        { label: "Placements", to: "/placements" },
        { label: brandName }
      ]} />
      <IdentityHeader
        title={brandName}
        relationship={(
          <span className="ry-relationship-identity-meta ry-placement-identity-meta">
            <span>{businessName}</span>
            <span aria-hidden="true">·</span>
            <span>{readable(stage)}</span>
            <span aria-hidden="true">·</span>
            <span>{productCount} product{productCount === 1 ? "" : "s"}</span>
            <span aria-hidden="true">·</span>
            <Link to={`/agreements/${agreementId}`}>{agreementMeta}</Link>
          </span>
        )}
        warning={!authorized ? (
          <Alert tone="danger" title="Authority blocks advancement or outreach." className="ry-placement-authority-alert">
            {authorityBlocked ? (
              <div className="ry-placement-authority-alert-copy">
                {authorityBlocked.messages.map((item, index) => (
                  <div key={item.code} className="ry-placement-authority-alert-message">
                    <p className="ry-placement-authority-alert-line">{item.summary}</p>
                    <p className="ry-placement-authority-alert-line">{item.guidance}</p>
                    {authorityBlocked.showAgreementLink && agreementId && index === authorityBlocked.messages.length - 1 ? (
                      <p className="ry-placement-authority-alert-line">
                        <Link className="ry-placement-authority-alert-link" to={`/agreements/${agreementId}`}>
                          Review agreement →
                        </Link>
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="ry-placement-authority-alert-line">Representation authority is not authorized for this placement.</p>
            )}
          </Alert>
        ) : placementConflict !== "clear" ? (
          <Alert tone="warning" title="Conflict requires review">Conflict status is {readable(placementConflict)}. Qualification and some advancements remain server-gated.</Alert>
        ) : undefined}
        actions={headerActions}
      />
      {!canWrite ? <Alert tone="warning" title="Read-only Placement context">You may inspect permitted Placement context, but cannot record stage transitions in this session.</Alert> : null}
      {actionError ? <ReviewErrorSummary message={actionError} conflict={conflict} onReload={() => { void load(); setConflict(false); setActionError(""); }} /> : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Placement relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={<ContextRail title="Placement status" className="ry-placement-status-rail" triggerLabel="Review status" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>{contextContent}</ContextRail>}>
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Placement overview" description="Key facts for this placement opportunity.">
            <dl className="ry-relationship-facts">
              <div><dt>Brand</dt><dd><Link to={`/brands/${shown(field(placement, "brandId", "brand_id"))}`}>{brandName}</Link></dd></div>
              <div><dt>Buyer</dt><dd><Link to={`/buyers/${shown(field(placement, "businessId", "business_id"))}`}>{businessName}</Link></dd></div>
              <div><dt>Agreement</dt><dd><Link to={`/agreements/${agreementId}`}>{agreementMeta}</Link></dd></div>
              <div><dt>Products</dt><dd>{productCount || "None recorded"}</dd></div>
              <div><dt>Current stage</dt><dd>{readable(stage)}</dd></div>
              <div><dt>Next action</dt><dd>{shown(placement.nextAction, "Not assigned")}</dd></div>
            </dl>
          </RelationshipSection>
          <RelationshipSection title="Stage timeline" description="Placement path through buyer review. Later commercial work appears under Commercial.">
            <ol className="ry-placement-timeline" aria-label="Placement stage timeline">
              {progression.map((item, index) => (
                <Fragment key={item.id}>
                  <li data-state={item.state}>
                    <span className="ry-placement-timeline-node" aria-hidden="true" />
                    <div className="ry-placement-timeline-copy">
                      <strong>{item.label}</strong>
                      <span className="ry-placement-timeline-state">{readable(item.state)}</span>
                    </div>
                  </li>
                  {index < progression.length - 1 ? (
                    <li className="ry-placement-timeline-separator" aria-hidden="true">
                      <span className="ry-placement-timeline-arrow">→</span>
                    </li>
                  ) : null}
                </Fragment>
              ))}
            </ol>
          </RelationshipSection>
          <RelationshipSection
            title="Agreement coverage"
            description={authorized
              ? "This placement is covered by the active agreement."
              : "Agreement coverage needs attention before advancement."}
          >
            <dl className="ry-relationship-facts">
              <div>
                <dt>Agreement status</dt>
                <dd>
                  <Link to={`/agreements/${agreementId}`}>
                    {agreementStatus ? readable(agreementStatus) : (authorized ? "Active" : "Unknown")}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Authorized territory</dt>
                <dd>{coverageTerritory}</dd>
              </div>
              <div>
                <dt>Authorized channel</dt>
                <dd>{coverageChannel}</dd>
              </div>
              <div>
                <dt>Products covered</dt>
                <dd>{productCount || "None recorded"}</dd>
              </div>
              <div>
                <dt>Conflict status</dt>
                <dd>{conflictStatusLabel}</dd>
              </div>
            </dl>
            {detail.conflicts.length ? (
              <ul className="ry-relationship-evidence-list">
                {detail.conflicts.map((item) => (
                  <li key={String(item.id ?? `${shown(field(item, "conflictType", "conflict_type"))}-${shown(field(item, "createdAt", "created_at"))}`)}>
                    <strong>{shown(field(item, "conflictType", "conflict_type"), "Conflict")}</strong>
                    <small>{shown(field(item, "status", "status"))}</small>
                  </li>
                ))}
              </ul>
            ) : null}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="case" active={activeTab === "case"}>
          <RelationshipSection title="Placement rationale">
            <dl className="ry-relationship-facts">
              <div><dt>Why this buyer fits</dt><dd>{shown(field(placement, "matchThesis", "match_thesis"))}</dd></div>
              <div><dt>Buyer value</dt><dd>{shown(field(placement, "buyerValueBasis", "buyer_value_basis"))}</dd></div>
              <div><dt>Supporting evidence</dt><dd>{readable(shown(field(placement, "evidenceConfidence", "evidence_confidence"), "supported"))}</dd></div>
            </dl>
          </RelationshipSection>
          <RelationshipSection title="Value alignment" description="Confirm mutual value across buyer, brand, and representative.">
            {triangle ? (
              <div className="ry-placement-value-alignment">
                <section>
                  <h3>Value to the buyer</h3>
                  <p>{shown(field(triangle, "buyerValue", "buyer_value"))}</p>
                </section>
                <section>
                  <h3>Value to the brand</h3>
                  <p>{shown(field(triangle, "brandValue", "brand_value"))}</p>
                </section>
                <section>
                  <h3>Role of the representative</h3>
                  <p>{shown(field(triangle, "representativeValue", "representative_value"))}</p>
                </section>
              </div>
            ) : (
              <EmptyState
                compact
                className="ry-placement-empty-state"
                description="Complete the value alignment review before advancing this placement."
                action={canWrite ? (
                  <Button variant="secondary" onClick={() => { setAlignmentError(""); setAlignmentOpen(true); }}>
                    Complete review
                  </Button>
                ) : undefined}
              />
            )}
          </RelationshipSection>
          <div id="stage-review" className="ry-placement-stage-review">
            <RelationshipSection
              title="Advance placement"
              description="See what is complete, what is missing, and what to do before moving this placement forward."
            >
              {lastOutcome ? (
                <ReviewOutcome
                  title="Stage advanced"
                  status={stage}
                  consequence={`This placement moved from ${lastOutcome}.`}
                />
              ) : null}

              <dl className="ry-placement-advance-stages">
                <div>
                  <dt>Current stage</dt>
                  <dd>{readable(stage)}</dd>
                </div>
                <div>
                  <dt>Next stage</dt>
                  <dd>{readable(toStage)}</dd>
                </div>
              </dl>

              <div className="ry-placement-before-advancing">
                <h3>Before advancing</h3>
                <ul className="ry-placement-advance-checks">
                  {advanceChecks.map((item) => (
                    <li key={item.id} data-state={item.ok ? "complete" : "incomplete"}>
                      <span className="ry-placement-advance-check-mark" aria-hidden="true">{item.ok ? "✓" : "–"}</span>
                      <span className="ry-placement-advance-check-label">
                        <span className="ry-placement-advance-check-name">{item.name}</span>
                        <span className="ry-placement-advance-check-sep" aria-hidden="true"> — </span>
                        <span className="ry-placement-advance-check-status">{item.status}</span>
                      </span>
                      {!item.ok && item.id === "coverage" ? (
                        <Link className="ry-placement-advance-link" to={`/agreements/${agreementId}`}>Review agreement</Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="ry-placement-review-advance">
                <h3>Review and advance</h3>
                <form className="ry-placement-stage-form" onSubmit={onReviewSubmit}>
                  <div className="ry-placement-stage-grid">
                    <Field label="Next stage">
                      <Select
                        aria-label="Next stage"
                        controlSize="compact"
                        value={toStage}
                        onChange={(event) => setToStage(event.target.value)}
                        disabled={!canWrite}
                      >
                        {selectableStages.map((item) => (
                          <option key={item} value={item}>{readable(item)}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Decision">
                      <Select
                        aria-label="Decision"
                        controlSize="compact"
                        required
                        value={decisionId}
                        onChange={(event) => setDecisionId(event.target.value)}
                        disabled={!canWrite}
                      >
                        <option value="">Select</option>
                        {business?.decisions.filter((item) => item.status === "issued").map((item) => (
                          <option key={item.id} value={String(item.id)}>{shown(item.outcome)}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Next action" className="ry-placement-stage-span">
                      <Select
                        aria-label="Next action"
                        controlSize="compact"
                        required={!isTerminalStage(toStage)}
                        value={taskId}
                        onChange={(event) => setTaskId(event.target.value)}
                        disabled={!canWrite}
                      >
                        <option value="">Select</option>
                        {business?.tasks.filter((item) => !["completed", "canceled"].includes(String(item.status))).map((item) => (
                          <option key={item.id} value={String(item.id)}>{shown(item.title)}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Notes" className="ry-placement-stage-span ry-placement-stage-notes">
                      <TextArea
                        aria-label="Notes"
                        required
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        disabled={!canWrite}
                      />
                    </Field>
                  </div>
                  {needsEvidence ? (
                    <details className="ry-placement-advance-advanced">
                      <summary>Advanced</summary>
                      <Field label="Supporting evidence" hint="Required when closing, reopening, or moving backward.">
                        <Input
                          aria-label="Supporting evidence"
                          controlSize="compact"
                          required
                          value={evidenceIds}
                          onChange={(event) => setEvidenceIds(event.target.value)}
                          disabled={!canWrite}
                          placeholder="Reference notes or IDs"
                        />
                      </Field>
                    </details>
                  ) : null}
                  <div className="ry-placement-advance-actions">
                    <Button type="submit" size="compact" loading={saving} disabled={!canWrite || advanceBlocked}>
                      {advanceLabel}
                    </Button>
                  </div>
                </form>
              </div>
            </RelationshipSection>
          </div>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection
            title="Placement timeline"
            description="Stage changes, outreach, notes, and decisions for this placement."
          >
            {activityEntries.length ? (
              <ActivityTimeline
                entries={activityEntries}
                label={`${brandName} placement timeline`}
              />
            ) : (
              <EmptyState
                compact
                className="ry-placement-empty-state"
                title="No activity yet"
                description="Stage changes, outreach, notes, and decisions will appear here."
              />
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="outreach" active={activeTab === "outreach"}>
          <RelationshipSection title="Outreach" description="Prepare and manage buyer communication for this placement.">
            {authorityBlocksActions ? (
              <div className="ry-placement-outreach-actions">
                {recoveryAction}
                {outreachAction}
              </div>
            ) : (
              <Link className="ry-button ry-button-secondary" to={`/outreach?placementId=${id}`}>Start outreach</Link>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="commercial" active={activeTab === "commercial"}>
          <RelationshipSection
            title="Commercial activity"
            description="Orders, account activity, and reorders connected to this placement will appear here."
          >
            <div className="ry-placement-commercial-links">
              {commercialLinks.map((item) => (
                <Link key={item.id} to={item.to}>{item.label}</Link>
              ))}
            </div>
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <ConfirmationDialog
        open={confirmationOpen}
        title="Review and advance"
        description={`Move from ${readable(stage)} to ${readable(toStage)}.`}
        consequence={<>
          <p>Ryva will confirm agreement coverage, conflict, value alignment, and next action before saving.</p>
          {reason ? <p>{reason}</p> : null}
        </>}
        confirmLabel={advanceLabel}
        processing={saving}
        onConfirm={() => void submitTransition()}
        onClose={() => setConfirmationOpen(false)}
      />

      <Drawer
        open={alignmentOpen}
        title="Complete value alignment"
        description="Record value to the buyer, brand, and representative before advancing this placement."
        onClose={() => { if (!alignmentSaving) setAlignmentOpen(false); }}
        size="standard"
      >
        <form className="ry-placement-alignment-form" onSubmit={(event) => void submitValueAlignment(event)}>
          {alignmentError ? <Alert tone="danger" title="Could not save review">{alignmentError}</Alert> : null}
          <Field label="Value to the buyer">
            <TextArea required rows={3} value={buyerAlignment} onChange={(event) => setBuyerAlignment(event.target.value)} disabled={alignmentSaving} />
          </Field>
          <Field label="Value to the brand">
            <TextArea required rows={3} value={brandAlignment} onChange={(event) => setBrandAlignment(event.target.value)} disabled={alignmentSaving} />
          </Field>
          <Field label="Role of the representative">
            <TextArea required rows={3} value={representativeAlignment} onChange={(event) => setRepresentativeAlignment(event.target.value)} disabled={alignmentSaving} />
          </Field>
          <Checkbox
            label="All parties receive legitimate value"
            checked={allPartiesAligned}
            onChange={(event) => setAllPartiesAligned(event.target.checked)}
            disabled={alignmentSaving}
          />
          <div className="ry-placement-alignment-actions">
            <Button type="button" variant="secondary" disabled={alignmentSaving} onClick={() => setAlignmentOpen(false)}>Cancel</Button>
            <Button type="submit" loading={alignmentSaving} disabled={!allPartiesAligned}>Save review</Button>
          </div>
        </form>
      </Drawer>

      <StickyMobileAction>{authorityBlocksActions && canWrite && recoveryAction ? recoveryAction : primaryAction}</StickyMobileAction>
    </div>
  );
}
