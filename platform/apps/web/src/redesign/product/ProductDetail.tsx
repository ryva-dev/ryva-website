import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  ActivityTimeline,
  Alert,
  AuthorityIndicator,
  Button,
  EmptyState,
  ErrorState,
  EvidenceLabel,
  Field,
  IdentityHeader,
  Input,
  LoadingState,
  RiskIndicator,
  Select,
  StatusLabel,
  TextArea
} from "../../design-system";
import {
  ContextRail,
  RelationshipDetailLayout,
  RelationshipSection,
  RelationshipTabPanel,
  RelationshipTabs,
  RelationshipTrail,
  StickyMobileAction,
  type RelationshipTab
} from "../relationship/RelationshipDetail";
import {
  canonicalProductPaths,
  date,
  dateTime,
  productFields,
  readable,
  shown,
  type ProductCompatibility,
  type ProductRow
} from "./utils";

type Source = { id: string; reference: string; status?: string };
type Detail = {
  product: ProductRow;
  evidence: ProductRow[];
  risks: ProductRow[];
  decisions: ProductRow[];
  observations: ProductRow[];
  recommendations: ProductRow[];
  matches: ProductRow[];
  unknowns: ProductRow[];
  unsupportedClaims: ProductRow[];
};

export function ProductDetailPage({
  compatibility = canonicalProductPaths
}: {
  compatibility?: ProductCompatibility;
}) {
  const id = useParams().id ?? "";
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const tabBaseId = `product-${useId().replaceAll(":", "")}`;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [observationBusy, setObservationBusy] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [fieldBusy, setFieldBusy] = useState(false);
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [contextOpen, setContextOpen] = useState(false);
  const [claim, setClaim] = useState("");
  const [evidenceClass, setEvidenceClass] = useState("unknown");
  const [sourceId, setSourceId] = useState("");
  const [fieldName, setFieldName] = useState<string>(productFields[0][0]);
  const [fieldValue, setFieldValue] = useState("");
  const [observationMetric, setObservationMetric] = useState("");
  const [observationValue, setObservationValue] = useState("");
  const [decisionOutcome, setDecisionOutcome] = useState("Investigate further");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextStatus, setNextStatus] = useState("under_review");
  const [recommendationCategory, setRecommendationCategory] = useState("");
  const [recommendationRationale, setRecommendationRationale] = useState("");

  const endpoint = `/api/intelligence/products/${id}`;
  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setLoadError("");
    try {
      const [payload, sourcePayload] = await Promise.all([
        api<Detail>(endpoint),
        api<{ sources: Source[] }>("/api/sources")
      ]);
      setDetail(payload);
      setSources(sourcePayload.sources);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "The Product could not be loaded.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);

  const record = detail?.product;
  const selectedField = productFields.find(([key]) => key === fieldName) ?? productFields[0];

  async function addEvidence(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    const tabWhenStarted = activeTab;
    setEvidenceBusy(true);
    setActionError("");
    const unknown = evidenceClass === "unknown";
    try {
      await api(`/api/records/product/${id}/evidence`, {
        method: "POST",
        body: {
          exactClaim: claim,
          evidenceClass,
          verificationStatus: "reviewed",
          sourceId: unknown ? null : sourceId,
          unknownReason: unknown ? "Required evidence has not been obtained." : null,
          supports: unknown ? "" : claim,
          doesNotSupport: "",
          confidence: unknown ? "insufficient" : "limited",
          context: "Phase 3 intelligence review",
          limitations: "",
          contraryEvidence: "",
          permittedUse: "Internal qualification",
          prohibitedInference: "Do not present beyond the recorded support."
        }
      });
      setClaim("");
      await load({ silent: true });
      // Do not steal focus if the representative moved to another tab while save/reload ran.
      setActiveTab((current) => (current !== tabWhenStarted && current !== "evidence" ? current : "evidence"));
      setStatusMessage("Evidence was recorded.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Evidence could not be saved.");
    } finally {
      setEvidenceBusy(false);
    }
  }

  async function updateIntelligence(event: FormEvent) {
    event.preventDefault();
    if (!record || !canWrite) return;
    const evidenceId = detail?.evidence[0]?.id;
    if (!evidenceId) {
      setActionError("Record evidence or an explicit Unknown record before updating a material field.");
      return;
    }
    const value: unknown = fieldValue;
    setFieldBusy(true);
    setActionError("");
    try {
      await api(endpoint, {
        method: "PATCH",
        body: {
          version: record.version,
          changes: { [fieldName]: value },
          evidenceByField: { [fieldName]: [evidenceId] },
          origin: "human_confirmed"
        }
      });
      setFieldValue("");
      await load({ silent: true });
      setStatusMessage("Evidence-linked field was updated.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Intelligence could not be updated.");
    } finally {
      setFieldBusy(false);
    }
  }

  async function addObservation(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    const tabWhenStarted = activeTab;
    setObservationBusy(true);
    setActionError("");
    try {
      await api(`/api/intelligence/product/${id}/observations`, {
        method: "POST",
        body: {
          metricCode: observationMetric,
          value: observationValue,
          evidenceClass,
          confidence: evidenceClass === "unknown" ? "insufficient" : "limited",
          sourceId: evidenceClass === "unknown" ? null : sourceId,
          unknownReason: evidenceClass === "unknown" ? "Observation is not yet available." : null,
          observedAt: evidenceClass === "unknown" ? null : new Date().toISOString(),
          acquisitionContext: "Human-entered Phase 3 research",
          limitations: "",
          origin: "user_entered"
        }
      });
      setObservationMetric("");
      setObservationValue("");
      await load({ silent: true });
      setActiveTab((current) => (current !== tabWhenStarted && current !== "qualification" ? current : "qualification"));
      setStatusMessage("Observation was recorded.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Observation could not be saved.");
    } finally {
      setObservationBusy(false);
    }
  }

  async function decide(event: FormEvent) {
    event.preventDefault();
    if (!record || !canWrite) return;
    setDecisionBusy(true);
    setActionError("");
    try {
      const decision = await api<{ decision: { id: string } }>(`/api/records/product/${id}/decisions`, {
        method: "POST",
        body: {
          question: `Should this product move to ${nextStatus.replaceAll("_", " ")}?`,
          scope: "Current evidence, risks, unknowns, and relationship value",
          outcome: decisionOutcome,
          rationale: decisionRationale,
          confidence: "limited",
          nextAction,
          status: "issued"
        }
      });
      let taskId: string | null = null;
      if (nextStatus !== "rejected") {
        const task = await api<{ task: { id: string } }>(`/api/records/product/${id}/tasks`, {
          method: "POST",
          body: { title: nextAction, priority: "medium", createdReason: "Human qualification decision", mandatoryGate: true }
        });
        taskId = task.task.id;
      }
      await api(`${endpoint}/status`, {
        method: "POST",
        body: {
          version: record.version,
          toStatus: nextStatus,
          decisionId: decision.decision.id,
          nextActionTaskId: taskId
        }
      });
      setDecisionRationale("");
      setNextAction("");
      await load({ silent: true });
      setStatusMessage("Human qualification decision was applied.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Human decision could not be applied.");
    } finally {
      setDecisionBusy(false);
    }
  }

  async function createRecommendation(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    const evidenceId = detail?.evidence[0]?.id;
    if (!evidenceId) {
      setActionError("Product evidence is required before recommending a Buyer category.");
      return;
    }
    const tabWhenStarted = activeTab;
    setRecommendationBusy(true);
    setActionError("");
    try {
      await api(`/api/intelligence/products/${id}/buyer-categories`, {
        method: "POST",
        body: {
          buyerCategory: recommendationCategory,
          rationale: recommendationRationale,
          confidence: "limited",
          evidenceIds: [evidenceId],
          missingEvidence: ["Confirm fit against a specific Business Buyer."],
          contraryEvidence: "",
          origin: "user_entered"
        }
      });
      setRecommendationCategory("");
      setRecommendationRationale("");
      await load({ silent: true });
      setActiveTab((current) => (current !== tabWhenStarted && current !== "related" ? current : "related"));
      setStatusMessage("Buyer category recommendation was proposed for human review.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Recommendation could not be recorded.");
    } finally {
      setRecommendationBusy(false);
    }
  }

  async function decideRecommendation(recommendation: ProductRow, status: "confirmed" | "rejected") {
    if (!canWrite) return;
    setRecommendationBusy(true);
    setActionError("");
    try {
      await api(`/api/intelligence/buyer-categories/${recommendation.id}`, {
        method: "PATCH",
        body: { version: recommendation.version, status }
      });
      await load({ silent: true });
      setStatusMessage(`Recommendation ${status}.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Recommendation decision could not be applied.");
    } finally {
      setRecommendationBusy(false);
    }
  }

  const loadingTrail = (
    <RelationshipTrail items={[
      { label: "Products", to: compatibility.registerPath },
      { label: loading ? "Loading Product" : "Product unavailable" }
    ]} />
  );

  if (!detail && loading) {
    return (
      <div className="page ry-relationship-page ry-product-page">
        {loadingTrail}
        <IdentityHeader eyebrow="Product Intelligence" title="Loading Product" status={<StatusLabel value="loading" />} />
        <LoadingState label="Loading Product relationship" />
      </div>
    );
  }

  if (!detail || !record) {
    return (
      <div className="page ry-relationship-page ry-product-page">
        {loadingTrail}
        <IdentityHeader eyebrow="Product Intelligence" title="Product unavailable" />
        <ErrorState message={loadError} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const status = shown(record.status, "discovered");
  const brandId = shown(record.brandId ?? record.brand_id, "");
  const brandName = shown(record.brandName ?? record.brand_name, "Brand unavailable");
  const evidence = detail.evidence;
  const observations = detail.observations ?? [];
  const recommendations = detail.recommendations ?? [];
  const matches = detail.matches ?? [];
  const decisions = detail.decisions ?? [];
  const risks = detail.risks ?? [];
  const unknownCount = detail.unknowns?.length ?? 0;

  const tabs: RelationshipTab[] = [
    { id: "overview", label: "Overview" },
    { id: "evidence", label: "Evidence", count: evidence.length },
    { id: "qualification", label: "Qualification", count: observations.length + decisions.length },
    { id: "related", label: "Related", count: recommendations.length + matches.length },
    { id: "activity", label: "Activity", count: decisions.length }
  ];

  const activityEntries = [
    ...decisions.map((item) => ({
      id: item.id,
      title: shown(item.outcome, "Decision recorded"),
      description: shown(item.rationale, "No rationale recorded."),
      meta: `${dateTime(item.decidedAt)} · ${shown(item.question, "Qualification decision")}`,
      status: <StatusLabel value={shown(item.status, "issued")} />
    })),
    ...observations.map((item) => ({
      id: item.id,
      title: shown(item.metricCode, "Observation"),
      description: `${shown(item.value, "unknown")} · ${shown(item.acquisitionContext, "Context not recorded")}`,
      meta: dateTime(item.observedAt, "Observation time not recorded"),
      status: <EvidenceLabel value={shown(item.evidenceClass, "unknown")} confidence={shown(item.confidence, "insufficient")} />
    }))
  ];

  const primaryAction = canWrite
    ? <Button onClick={() => { setActionError(""); setActiveTab("qualification"); }}>Review qualification</Button>
    : <Button disabled>Read-only access</Button>;

  const contextContent = (
    <>
      <div className="ry-context-item">
        <strong>Evidence state</strong>
        <EvidenceLabel value={unknownCount > 0 ? "unknown" : evidence.length ? "direct_evidence" : "unknown"} confidence={evidence.length ? "limited" : "insufficient"} freshness={record.lastReviewedAt ? `Last reviewed ${date(record.lastReviewedAt)}` : "Not reviewed"} />
        <small>{unknownCount} explicit unknown{unknownCount === 1 ? "" : "s"} · {evidence.length} evidence record{evidence.length === 1 ? "" : "s"}</small>
      </div>
      <div className="ry-context-item">
        <strong>Qualification</strong>
        <StatusLabel value={status} />
        <small>Human decision required to change Product qualification.</small>
      </div>
      <div className="ry-context-item">
        <strong>Open risk</strong>
        <RiskIndicator value={risks.some((item) => ["high", "critical"].includes(shown(item.severity))) ? "high" : risks.length ? "medium" : "low"} rationale={`${risks.length} open risk flag${risks.length === 1 ? "" : "s"}.`} />
      </div>
      <div className="ry-context-item">
        <strong>Brand relation</strong>
        {brandId ? <Link to={`/brands/${brandId}`}>{brandName}</Link> : brandName}
        <small>Brand context does not authorize outreach or representation.</small>
      </div>
      <div className="ry-context-item">
        <strong>Authority boundary</strong>
        <AuthorityIndicator value="not_established" rationale="Product qualification does not create representation or Buyer Outreach authority." />
      </div>
      <div className="ry-context-item">
        <strong>Next action</strong>
        <p>{shown(record.nextAction, "No next action assigned.")}</p>
      </div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-product-page">
      <RelationshipTrail items={[
        { label: "Products", to: compatibility.registerPath },
        ...(brandId ? [{ label: brandName, to: `/brands/${brandId}` }] : []),
        { label: record.name }
      ]} />
      {compatibility.showCompatibilityNotice ? (
        <Alert title="Generic Product detail compatibility">This route reuses the canonical Product Intelligence detail workspace.</Alert>
      ) : null}
      <IdentityHeader
        eyebrow={`Product Intelligence · ${shown(record.category)}`}
        title={record.name}
        relationship={(
          <span className="ry-relationship-identity-meta">
            {brandId ? <Link to={`/brands/${brandId}`}>{brandName}</Link> : <span>{brandName}</span>}
            <span>{readable(status)}</span>
            <span>{shown(record.consumerPrice, "Price not recorded")}{record.currency ? ` ${shown(record.currency)}` : ""}</span>
          </span>
        )}
        status={<StatusLabel value={status} />}
        warning={unknownCount > 0 ? <Alert tone="warning" title="Explicit unknowns recorded">{unknownCount} field{unknownCount === 1 ? " remains" : "s remain"} explicitly Unknown. Missing evidence is not negative evidence.</Alert> : undefined}
        nextAction={<span>{canWrite ? "Review evidence and apply a human-owned qualification decision when ready." : session?.access.reason ?? "Read-only Product inspection."}</span>}
        actions={<>{primaryAction}<Link className="ry-button ry-button-secondary" to={compatibility.registerPath}>Back to register</Link></>}
      />
      {statusMessage ? <p className="ry-relationship-status" role="status">{statusMessage}</p> : null}
      {actionError ? <ErrorState message={actionError} /> : null}
      {!canWrite ? <Alert tone="warning" title="Read-only Product context">You may inspect permitted Product context, but cannot add evidence or apply qualification decisions in this session.</Alert> : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Product relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={<ContextRail title="Product context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>{contextContent}</ContextRail>}>
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Stored Product facts" description="Commercial characteristics currently stored for this Product. Derived or missing values remain labeled.">
            <dl className="ry-relationship-facts">
              <div><dt>Category</dt><dd>{shown(record.category)}</dd></div>
              <div><dt>Consumer price</dt><dd>{record.consumerPrice ? `${shown(record.consumerPrice)} ${shown(record.currency, "")}`.trim() : "Not recorded"}</dd></div>
              <div><dt>Review volume</dt><dd>{shown(record.reviewVolume, "Not recorded")}</dd></div>
              <div><dt>Review quality summary</dt><dd>{shown(record.reviewQualitySummary, "Not recorded")}</dd></div>
              <div><dt>Sales evidence summary</dt><dd>{shown(record.salesEvidenceSummary, "Not recorded")}</dd></div>
              <div><dt>Physical retail presence</dt><dd>{readable(shown(record.physicalRetailPresence, "unknown"))}</dd></div>
              <div><dt>Identity status</dt><dd><StatusLabel value={shown(record.identityStatus, "unverified")} /></dd></div>
              <div><dt>Monitoring status</dt><dd>{readable(shown(record.monitoringStatus, "not monitored"))}</dd></div>
            </dl>
          </RelationshipSection>
          <RelationshipSection title="Commercial readiness" description="Readiness fields remain evidence-linked when updated through qualification workflows.">
            <dl className="ry-relationship-facts">
              {productFields.map(([key, label]) => (
                <div key={key}><dt>{label}</dt><dd>{readable(shown(record[key]))}</dd></div>
              ))}
            </dl>
            {canWrite ? (
              <form className="ry-product-field-form" onSubmit={(event) => void updateIntelligence(event)}>
                <Field label="Material field">
                  <Select value={fieldName} onChange={(event) => { setFieldName(event.target.value); setFieldValue(""); }}>
                    {productFields.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </Select>
                </Field>
                <Field label="Reviewed value" hint="The newest Evidence Record will be linked to this field.">
                  {selectedField[2].length ? (
                    <Select required value={fieldValue} onChange={(event) => setFieldValue(event.target.value)}>
                      <option value="">Select…</option>
                      {selectedField[2].map((item) => <option key={item} value={item}>{readable(item)}</option>)}
                    </Select>
                  ) : (
                    <TextArea required rows={3} value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} />
                  )}
                </Field>
                <Button type="submit" loading={fieldBusy} disabled={!canWrite}>Save evidence-linked field</Button>
              </form>
            ) : null}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="evidence" active={activeTab === "evidence"}>
          <RelationshipSection title="Evidence register" description="Sourced claims and explicit Unknown records. A Source records provenance; it does not establish truth by itself.">
            {evidence.length ? (
              <ul className="ry-relationship-evidence-list">
                {evidence.map((item) => (
                  <li key={item.id}>
                    <strong>{shown(item.exactClaim)}</strong>
                    <EvidenceLabel value={shown(item.evidenceClass, "unknown")} confidence={shown(item.confidence, "insufficient")} freshness={dateTime(item.observedAt, "Observation time not recorded")} />
                    <small>{shown(item.sourceReference, shown(item.unknownReason, "No source linked"))}</small>
                    <small>{shown(item.limitations, "No limitation recorded")}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact description="No evidence has been recorded. Begin with a sourced claim or an explicit Unknown." />
            )}
            {canWrite ? (
              <form className="ry-product-evidence-form" onSubmit={(event) => void addEvidence(event)}>
                <Field label="Exact claim or unknown"><TextArea required rows={3} value={claim} onChange={(event) => setClaim(event.target.value)} /></Field>
                <Field label="Classification">
                  <Select value={evidenceClass} onChange={(event) => setEvidenceClass(event.target.value)}>
                    <option value="unknown">Unknown</option>
                    <option value="verified_fact">Verified fact</option>
                    <option value="direct_evidence">Direct evidence</option>
                    <option value="strong_proxy">Strong proxy</option>
                    <option value="weak_proxy">Weak proxy</option>
                    <option value="estimate">Estimate</option>
                    <option value="assumption">Assumption</option>
                  </Select>
                </Field>
                {evidenceClass !== "unknown" ? (
                  <Field label="Source">
                    <Select required value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                      <option value="">Select…</option>
                      {sources.map((item) => <option key={item.id} value={item.id}>{item.reference}</option>)}
                    </Select>
                  </Field>
                ) : null}
                <Button type="submit" variant="secondary" loading={evidenceBusy}>Add evidence</Button>
              </form>
            ) : null}
          </RelationshipSection>
          {detail.unsupportedClaims?.length ? (
            <RelationshipSection title="Unsupported or weak inference" description="These classifications require explicit human review before use in qualification.">
              <ul className="ry-relationship-evidence-list">
                {detail.unsupportedClaims.map((item) => (
                  <li key={item.id}><strong>{shown(item.exactClaim)}</strong><EvidenceLabel value={shown(item.evidenceClass, "weak_proxy")} /></li>
                ))}
              </ul>
            </RelationshipSection>
          ) : null}
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="qualification" active={activeTab === "qualification"}>
          <RelationshipSection title="Time-bound observations" description="Observations preserve acquisition context. Unknown values remain Unknown and are not treated as zero.">
            {observations.length ? (
              <ul className="ry-relationship-evidence-list">
                {observations.map((item) => (
                  <li key={item.id}>
                    <strong>{shown(item.metricCode)}</strong>
                    <span>{shown(item.value, "unknown")}</span>
                    <EvidenceLabel value={shown(item.evidenceClass, "unknown")} confidence={shown(item.confidence, "insufficient")} />
                    <small>{shown(item.acquisitionContext)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact description="No observations recorded." />
            )}
            {canWrite ? (
              <form className="ry-product-observation-form" onSubmit={(event) => void addObservation(event)}>
                <Field label="Metric"><Input required value={observationMetric} onChange={(event) => setObservationMetric(event.target.value)} /></Field>
                <Field label="Value"><Input required value={observationValue} onChange={(event) => setObservationValue(event.target.value)} /></Field>
                <Button type="submit" variant="secondary" loading={observationBusy}>Record observation</Button>
              </form>
            ) : null}
          </RelationshipSection>
          <RelationshipSection title="Human decision gate" description="The server rechecks evidence, risks, next action, and applicable authority before changing qualification.">
            <form className="ry-product-decision-form" onSubmit={(event) => void decide(event)}>
              <Field label="Decision outcome"><Input required value={decisionOutcome} onChange={(event) => setDecisionOutcome(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="Target state">
                <Select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} disabled={!canWrite}>
                  {["watchlist", "under_review", "qualified", "rejected", "represented"].map((item) => <option key={item} value={item}>{readable(item)}</option>)}
                </Select>
              </Field>
              <Field label="Rationale"><TextArea required rows={4} value={decisionRationale} onChange={(event) => setDecisionRationale(event.target.value)} disabled={!canWrite} /></Field>
              {nextStatus !== "rejected" ? (
                <Field label="Required next action"><Input required value={nextAction} onChange={(event) => setNextAction(event.target.value)} disabled={!canWrite} /></Field>
              ) : null}
              <Button type="submit" loading={decisionBusy} disabled={!canWrite}>Record and apply human decision</Button>
            </form>
          </RelationshipSection>
          {risks.length ? (
            <RelationshipSection title="Open risk flags" description="Risk severity is shown with explanatory context; color is not the only signal.">
              <ul className="ry-relationship-evidence-list">
                {risks.map((item) => (
                  <li key={item.id}>
                    <strong>{readable(shown(item.riskType, "risk"))}</strong>
                    <RiskIndicator value={shown(item.severity, "medium")} rationale={shown(item.description, "No description recorded.")} />
                    <small>{shown(item.mitigation, "No mitigation recorded")}</small>
                  </li>
                ))}
              </ul>
            </RelationshipSection>
          ) : null}
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="related" active={activeTab === "related"}>
          <RelationshipSection title="Buyer-category recommendations" description="Recommendations require human confirmation. Product fit does not create Buyer fit.">
            {recommendations.length ? (
              <ul className="ry-relationship-evidence-list">
                {recommendations.map((item) => (
                  <li key={item.id}>
                    <strong>{shown(item.buyerCategory)}</strong>
                    <small>{shown(item.rationale)}</small>
                    <StatusLabel value={shown(item.status, "proposed")} />
                    {canWrite && item.status === "proposed" ? (
                      <span className="ry-product-inline-actions">
                        <Button variant="tertiary" size="compact" disabled={recommendationBusy} onClick={() => void decideRecommendation(item, "confirmed")}>Confirm</Button>
                        <Button variant="tertiary" size="compact" disabled={recommendationBusy} onClick={() => void decideRecommendation(item, "rejected")}>Reject</Button>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact description="No Buyer-category recommendations recorded." />
            )}
            {canWrite ? (
              <form className="ry-product-recommendation-form" onSubmit={(event) => void createRecommendation(event)}>
                <Field label="Buyer category"><Input required value={recommendationCategory} onChange={(event) => setRecommendationCategory(event.target.value)} /></Field>
                <Field label="Evidence-based rationale"><TextArea required rows={3} value={recommendationRationale} onChange={(event) => setRecommendationRationale(event.target.value)} /></Field>
                <Button type="submit" variant="secondary" loading={recommendationBusy}>Propose category for human review</Button>
              </form>
            ) : null}
          </RelationshipSection>
          <RelationshipSection title="Business match reviews" description="Context-specific Product–Business fit reviews. Comparison or match review does not authorize outreach.">
            {matches.length ? (
              <ul className="ry-relationship-evidence-list">
                {matches.map((item) => (
                  <li key={item.id}>
                    <strong>{shown(item.businessName)}</strong>
                    <small>{shown(item.rationale)}</small>
                    <StatusLabel value={shown(item.status, "proposed")} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact description="No context-specific Business matches reviewed." />
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Qualification activity" description="Decisions and observations in newest-first order.">
            <ActivityTimeline entries={activityEntries} empty="No Product qualification activity has been recorded." label={`${record.name} activity timeline`} />
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <StickyMobileAction>
        {primaryAction}
      </StickyMobileAction>
    </div>
  );
}
