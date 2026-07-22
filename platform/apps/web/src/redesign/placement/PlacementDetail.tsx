import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  ActivityTimeline,
  Alert,
  ApprovalPanel,
  AuthorityIndicator,
  Button,
  ConfirmationDialog,
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
import {
  authorityTone,
  conflictStatus,
  dateTime,
  field,
  isTerminalStage,
  placementStage,
  progressionStages,
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
};

type BusinessContext = {
  record?: Row;
  decisions: Row[];
  tasks: Row[];
};

type AuthorityResult = { outcome: string; reasonCodes: string[] };

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
  const [lastOutcome, setLastOutcome] = useState("");

  const requestedStage = searchParams.get("toStage") ?? "";
  const [toStage, setToStage] = useState(requestedStage && (selectableStages as readonly string[]).includes(requestedStage) ? requestedStage : "qualified");
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
      setActiveTab("stage");
    }
  }, [requestedStage]);

  useEffect(() => {
    if (window.location.hash === "#stage-review") setActiveTab("stage");
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
  const brandName = shown(placement.brandName);
  const businessName = shown(placement.businessName);
  const agreementId = shown(field(placement, "agreementId", "agreement_id"));
  const authorityOutcome = authority?.outcome ?? "not_checked";
  const authorized = authorityOutcome === "authorized";
  const stalled = placement.stalled === true;
  const triangle = detail.triangle;
  const productCount = detail.products.length;

  const progression = progressionStages.map((item) => {
    const currentIndex = progressionStages.indexOf(stage as typeof progressionStages[number]);
    const itemIndex = progressionStages.indexOf(item);
    let state = "unavailable";
    if (isTerminalStage(stage)) state = itemIndex <= Math.max(currentIndex, 0) ? "completed" : "not_applicable";
    else if (item === stage) state = "current";
    else if (currentIndex >= 0 && itemIndex < currentIndex) state = "completed";
    else if (["opening_order", "active_account", "reorder_management"].includes(item)) state = "unavailable";
    else state = "upcoming";
    return { id: item, label: readable(item), state };
  });

  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "This session cannot record a Placement stage transition."] : []),
    ...(!authorized && !["identified", "closed_lost", "disqualified"].includes(toStage) ? [`Representation authority is ${readable(authorityOutcome)}. Forward stages require authorized written scope.`] : []),
    ...(toStage === "qualified" && placementConflict !== "clear" ? ["Account conflict must be clear before qualification."] : []),
    ...(!triangle ? ["Relationship Triangle review is missing; progression is not allowed."] : []),
    ...(conflict ? ["The Placement version or related artifact is no longer current. Reload before retrying."] : [])
  ];

  const readinessState: ReviewReadiness = conflict
    ? "stale"
    : !canWrite
      ? "restricted"
      : (!authorized && !["identified", "closed_lost", "disqualified"].includes(toStage)) || (toStage === "qualified" && placementConflict !== "clear") || !triangle
        ? "blocked"
        : "requires_review";

  const validationChecks: ValidationCheck[] = [
    {
      id: "authority",
      label: "Representation authority",
      detail: authorized
        ? "Current Agreement scope authorizes Placement advancement for the evaluated Products and channel."
        : `Authority outcome is ${readable(authorityOutcome)}. ${Array.isArray(authority?.reasonCodes) ? authority.reasonCodes.join(", ") : "No reason codes."}`,
      state: authorized ? "passed" : "failed"
    },
    {
      id: "conflict",
      label: "Conflict status",
      detail: placementConflict === "clear" ? "No unresolved Placement conflict is recorded." : `Conflict status is ${readable(placementConflict)}.`,
      state: placementConflict === "clear" ? "passed" : "failed"
    },
    {
      id: "triangle",
      label: "Relationship Triangle",
      detail: triangle ? "A current three-party value review is linked." : "Triangle review is missing.",
      state: triangle ? "passed" : "failed"
    },
    {
      id: "decision",
      label: "Human decision",
      detail: decisionId ? "An issued decision is selected for this transition." : "Select an issued human decision.",
      state: decisionId ? "passed" : "requires_review"
    },
    {
      id: "next",
      label: "Next action",
      detail: isTerminalStage(toStage) ? "Terminal stages do not require a next action." : (taskId ? "A next action task is selected." : "A next action is required for non-terminal stages."),
      state: isTerminalStage(toStage) || taskId ? "passed" : "requires_review"
    }
  ];

  const activityEntries = detail.events.map((item, index) => ({
    id: `${shown(item.occurredAt)}-${index}`,
    title: `${readable(shown(item.fromStage, "start"))} → ${readable(shown(item.toStage))}`,
    description: shown(item.reason, "No rationale recorded"),
    meta: dateTime(item.occurredAt),
    status: <StatusLabel value={shown(item.toStage)} />
  }));

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "fit", label: "Fit & evidence" },
    { id: "authority", label: "Authority" },
    { id: "stage", label: "Stage review" },
    { id: "activity", label: "Activity", count: detail.events.length },
    { id: "outreach", label: "Outreach" },
    { id: "commercial", label: "Commercial" }
  ];

  const primaryAction = canWrite
    ? <Button onClick={() => { setActionError(""); setActiveTab("stage"); }}>Review stage change</Button>
    : <Button disabled>Read-only access</Button>;

  const contextContent = (
    <>
      <div className="ry-context-item">
        <strong>Stage</strong>
        <StatusLabel value={stage} />
        {stalled ? <small>Stalled flag is server-computed from overdue or missing next action. It is not a stage.</small> : null}
      </div>
      <div className="ry-context-item">
        <strong>Authority</strong>
        <AuthorityIndicator
          value={authorityOutcome}
          tone={authorityTone(authorityOutcome)}
          rationale="Placement stage does not create Representation authority. Only the evaluated Agreement scope does."
        />
      </div>
      <div className="ry-context-item">
        <strong>Conflict</strong>
        <StatusLabel value={placementConflict} />
      </div>
      <div className="ry-context-item">
        <strong>Next action</strong>
        <p>{shown(placement.nextAction, "No next action assigned.")}</p>
      </div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-placement-page">
      <RelationshipTrail items={[
        { label: "Placements", to: "/placements" },
        { label: `${brandName} → ${businessName}` }
      ]} />
      <IdentityHeader
        eyebrow="Placement Opportunity"
        title={`${brandName} → ${businessName}`}
        relationship={(
          <span className="ry-relationship-identity-meta">
            <span>{readable(stage)}</span>
            <span>{productCount} Product{productCount === 1 ? "" : "s"}</span>
            <Link to={`/agreements/${agreementId}`}>Agreement</Link>
          </span>
        )}
        status={<StatusLabel value={stage} />}
        warning={!authorized ? (
          <Alert tone="danger" title="Authority blocks advancement or outreach.">
            {Array.isArray(authority?.reasonCodes) ? authority.reasonCodes.join(", ") : "Representation authority is not authorized for this Placement."}
          </Alert>
        ) : placementConflict !== "clear" ? (
          <Alert tone="warning" title="Conflict requires review">Conflict status is {readable(placementConflict)}. Qualification and some advancements remain server-gated.</Alert>
        ) : undefined}
        nextAction={<span>{canWrite ? "Recheck authority, triangle, decision, and next action before any stage change." : session?.access.reason ?? "Read-only Placement inspection."}</span>}
        actions={<>{primaryAction}<Link className="ry-button ry-button-secondary" to={`/outreach?placementId=${id}`}>Open Outreach</Link></>}
      />
      {!canWrite ? <Alert tone="warning" title="Read-only Placement context">You may inspect permitted Placement context, but cannot record stage transitions in this session.</Alert> : null}
      {actionError ? <ReviewErrorSummary message={actionError} conflict={conflict} onReload={() => { void load(); setConflict(false); setActionError(""); }} /> : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Placement relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={<ContextRail title="Placement context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>{contextContent}</ContextRail>}>
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Placement identity" description="Every advancement rechecks authority, conflict state, three-party value, human decision, and next action.">
            <dl className="ry-relationship-facts">
              <div><dt>Brand</dt><dd><Link to={`/brands/${shown(field(placement, "brandId", "brand_id"))}`}>{brandName}</Link></dd></div>
              <div><dt>Business</dt><dd><Link to={`/buyers/${shown(field(placement, "businessId", "business_id"))}`}>{businessName}</Link></dd></div>
              <div><dt>Stage</dt><dd><StatusLabel value={stage} /></dd></div>
              <div><dt>Agreement</dt><dd><Link to={`/agreements/${agreementId}`}>Open Agreement</Link></dd></div>
              <div><dt>Products in scope</dt><dd>{productCount || "None recorded"}</dd></div>
              <div><dt>Next action</dt><dd>{shown(placement.nextAction, "Not assigned")}</dd></div>
            </dl>
          </RelationshipSection>
          <RelationshipSection title="Documented progression" description="Connected progression uses only the existing stage model. Opening Order and later stages require Order or Account workflows.">
            <ol className="ry-placement-progression" aria-label="Placement progression">
              {progression.map((item) => (
                <li key={item.id} data-state={item.state}>
                  <StatusLabel value={item.state} label={readable(item.state)} />
                  <span>{item.label}</span>
                </li>
              ))}
            </ol>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="fit" active={activeTab === "fit"}>
          <RelationshipSection title="Opportunity basis" description="Fit language is qualitative. The platform does not invent probability, expected value, or scores.">
            <dl className="ry-relationship-facts">
              <div><dt>Match thesis</dt><dd>{shown(field(placement, "matchThesis", "match_thesis"))}</dd></div>
              <div><dt>Buyer value</dt><dd>{shown(field(placement, "buyerValueBasis", "buyer_value_basis"))}</dd></div>
              <div><dt>Evidence confidence</dt><dd>{shown(field(placement, "evidenceConfidence", "evidence_confidence"))}</dd></div>
            </dl>
          </RelationshipSection>
          <RelationshipSection title="Relationship Triangle" description="Legitimate value and obligations for Brand, Business Buyer, and Representative.">
            {triangle ? (
              <dl className="ry-relationship-facts">
                <div><dt>Brand value</dt><dd>{shown(field(triangle, "brandValue", "brand_value"))}</dd></div>
                <div><dt>Brand risks</dt><dd>{shown(field(triangle, "brandRisks", "brand_risks"))}</dd></div>
                <div><dt>Buyer value</dt><dd>{shown(field(triangle, "buyerValue", "buyer_value"))}</dd></div>
                <div><dt>Buyer risks</dt><dd>{shown(field(triangle, "buyerRisks", "buyer_risks"))}</dd></div>
                <div><dt>Representative value</dt><dd>{shown(field(triangle, "representativeValue", "representative_value"))}</dd></div>
                <div><dt>Representative risks</dt><dd>{shown(field(triangle, "representativeRisks", "representative_risks"))}</dd></div>
              </dl>
            ) : (
              <EmptyState compact description="Relationship Triangle review is missing; progression is not allowed." />
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="authority" active={activeTab === "authority"}>
          <RelationshipSection title="Representation and Agreement authority" description="Authority is evaluated from the linked Agreement. Placement stage never overrides or creates authority.">
            <AuthorityIndicator
              value={authorityOutcome}
              tone={authorityTone(authorityOutcome)}
              rationale="Only an active, in-scope Agreement with clean original and human approval establishes current representation authority for Placement advancement."
            />
            <dl className="ry-relationship-facts">
              <div><dt>Agreement</dt><dd><Link to={`/agreements/${agreementId}`}>Review exact Agreement scope</Link></dd></div>
              <div><dt>Conflict</dt><dd><StatusLabel value={placementConflict} /></dd></div>
              <div><dt>Reason codes</dt><dd>{Array.isArray(authority?.reasonCodes) && authority.reasonCodes.length ? authority.reasonCodes.join(", ") : "None recorded"}</dd></div>
              <div><dt>Products evaluated</dt><dd>{productCount}</dd></div>
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

        <RelationshipTabPanel id={tabBaseId} tabId="stage" active={activeTab === "stage"}>
          <div id="stage-review" className="ry-placement-stage-review">
            {lastOutcome ? <ReviewOutcome title="Stage transition recorded" status={stage} consequence={`Human-confirmed transition ${lastOutcome} was accepted by the server and audited.`} /> : null}
            <ConsequentialReviewLayout readiness={<>
              <ReadinessSummary
                state={readinessState}
                description="Stage changes are consequential. Dragging a Kanban card or choosing a stage only opens this review. The server revalidates authority, conflict, triangle prerequisites, decision, and next action."
                blockers={blockers}
                context={<dl className="ry-review-facts"><div><dt>Current stage</dt><dd>{readable(stage)}</dd></div><div><dt>Proposed stage</dt><dd>{readable(toStage)}</dd></div><div><dt>Version</dt><dd>{shown(placement.version)}</dd></div></dl>}
              />
              <AuthorityIndicator value={authorityOutcome} tone={authorityTone(authorityOutcome)} rationale="Forward stages require authorized Representation scope. Identified and terminal outcomes remain separately gated." />
            </>}>
              <ExactArtifact
                title="Exact Placement stage change"
                description="This exact Placement version and proposed stage—not a summary card—are submitted to the existing server-side transition validator."
                version={`Version ${shown(placement.version)} · ${brandName} → ${businessName}`}
              >
                <dl className="ry-review-facts">
                  <div><dt>From</dt><dd>{readable(stage)}</dd></div>
                  <div><dt>To</dt><dd>{readable(toStage)}</dd></div>
                  <div><dt>Agreement</dt><dd><Link to={`/agreements/${agreementId}`}>{agreementId}</Link></dd></div>
                  <div><dt>Products</dt><dd>{productCount}</dd></div>
                  <div><dt>Conflict</dt><dd>{readable(placementConflict)}</dd></div>
                </dl>
              </ExactArtifact>
              <ValidationSummary checks={validationChecks} description="Displayed checks summarize stored facts. The server revalidates on submission. Visual availability of a stage does not mean the server will permit it." />
              <ReviewSection eyebrow="Human confirmation" title="Record stage transition" description="Opening Order, Active Account, and Reorder management cannot be selected here; those stages require later Order or Account workflows.">
                <form className="ry-placement-stage-form" onSubmit={onReviewSubmit}>
                  <Field label="Next stage">
                    <Select value={toStage} onChange={(event) => setToStage(event.target.value)} disabled={!canWrite}>
                      {selectableStages.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Fresh human decision">
                    <Select required value={decisionId} onChange={(event) => setDecisionId(event.target.value)} disabled={!canWrite}>
                      <option value="">Select</option>
                      {business?.decisions.filter((item) => item.status === "issued").map((item) => <option key={item.id} value={String(item.id)}>{shown(item.outcome)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Next action">
                    <Select required={!isTerminalStage(toStage)} value={taskId} onChange={(event) => setTaskId(event.target.value)} disabled={!canWrite}>
                      <option value="">Select</option>
                      {business?.tasks.filter((item) => !["completed", "canceled"].includes(String(item.status))).map((item) => <option key={item.id} value={String(item.id)}>{shown(item.title)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Reason"><TextArea required value={reason} onChange={(event) => setReason(event.target.value)} disabled={!canWrite} /></Field>
                  <Field label="Evidence IDs for backward/closure/reopen"><Input value={evidenceIds} onChange={(event) => setEvidenceIds(event.target.value)} disabled={!canWrite} /></Field>
                  <ApprovalPanel
                    title="Confirm Placement stage change"
                    readiness={<p>{readable(readinessState)}. Blockers listed in the readiness rail remain authoritative.</p>}
                    consequence={<p>Recording this transition submits version {shown(placement.version)} from {readable(stage)} to {readable(toStage)}. No Outreach, Order, or Representation authority is created by this action alone.</p>}
                    rationale={<p>Reason and, when required, evidence IDs are preserved if the server rejects the transition.</p>}
                    processing={saving}
                    actions={<Button type="submit" loading={saving} disabled={!canWrite || readinessState === "stale"}>Prepare confirmation</Button>}
                  />
                </form>
              </ReviewSection>
            </ConsequentialReviewLayout>
          </div>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Stage history" description="Newest-first audited stage events.">
            <ActivityTimeline entries={activityEntries} empty="No stage change has been recorded." label={`${brandName} Placement activity`} />
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="outreach" active={activeTab === "outreach"}>
          <RelationshipSection title="Outreach context" description="Increment 13 owns the Outreach Center. Placement readiness does not authorize Outreach.">
            <p>Open the Outreach workspace with this Placement preselected. Exact-artifact approval, permission, suppression, and channel rules remain separately enforced.</p>
            <Link className="ry-button ry-button-secondary" to={`/outreach?placementId=${id}`}>Open Outreach</Link>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="commercial" active={activeTab === "commercial"}>
          <RelationshipSection title="Commercial context" description="Increment 14 owns Accounts, Orders, Reorders, and Protection. Placement stage does not invent revenue or order outcomes.">
            <p>Opening Order and later commercial stages advance only through Order or Account workflows. Use existing commercial routes when those records exist.</p>
            <div className="ry-placement-commercial-links">
              <Link to="/orders">Orders</Link>
              <Link to="/accounts">Accounts</Link>
            </div>
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <ConfirmationDialog
        open={confirmationOpen}
        title="Confirm Placement stage change"
        description={`Submit the exact transition from ${readable(stage)} to ${readable(toStage)} for server validation.`}
        consequence={<>
          <strong>Human-confirmed stage change</strong>
          <p>Version {shown(placement.version)} will be revalidated for authority, conflict, triangle prerequisites, decision, and next action.</p>
          <p>Reason: {reason || "Not provided"}</p>
        </>}
        confirmLabel="Record human-confirmed stage"
        processing={saving}
        onConfirm={() => void submitTransition()}
        onClose={() => setConfirmationOpen(false)}
      />

      <StickyMobileAction>{primaryAction}</StickyMobileAction>
    </div>
  );
}
