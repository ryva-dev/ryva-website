import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  ActivityTimeline,
  Alert,
  AuthorityIndicator,
  Button,
  ErrorState,
  EvidenceLabel,
  Field,
  IdentityHeader,
  Input,
  LoadingState,
  RiskIndicator,
  Select
} from "../../design-system";
import {
  ContextRail,
  RelationshipDetailLayout,
  RelationshipSection,
  RelationshipTabPanel,
  RelationshipTabs,
  RelationshipTrail,
  type RelationshipTab
} from "../relationship/RelationshipDetail";
import {
  brandField,
  brandFieldValueLabel,
  brandFieldValuePlaceholder,
  brandFields,
  brandIdentity,
  brandName,
  brandIdentityLabel,
  brandReadinessLabel,
  brandRiskLabel,
  brandStage,
  brandResearchConfidenceOptions,
  brandResearchEvidenceClass,
  brandStageLabel,
  canonicalBrandPaths,
  dateTime,
  readable,
  shown,
  type BrandCompatibility,
  type BrandRow
} from "./utils";

type Source = { id: string; reference: string; status?: string };
type Detail = {
  brand: BrandRow;
  products: BrandRow[];
  contacts: BrandRow[];
  evidence: BrandRow[];
  risks: BrandRow[];
  decisions: BrandRow[];
  stageEvents: BrandRow[];
  unknowns: BrandRow[];
  unsupportedClaims: BrandRow[];
  authority: { status: string; reason: string };
};

export function BrandDetailPage({
  compatibility = canonicalBrandPaths
}: {
  compatibility?: BrandCompatibility;
}) {
  const id = useParams().id ?? "";
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const tabBaseId = `brand-${useId().replaceAll(":", "")}`;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [contextOpen, setContextOpen] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [observationBusy, setObservationBusy] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [fieldBusy, setFieldBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [identityBusy, setIdentityBusy] = useState(false);
  const [claim, setClaim] = useState("");
  const [researchConfidence, setResearchConfidence] = useState("limited");
  const [researchNote, setResearchNote] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [fieldName, setFieldName] = useState<string>(brandFields[0][0]);
  const [fieldValue, setFieldValue] = useState("");
  const [observationMetric, setObservationMetric] = useState("");
  const [observationValue, setObservationValue] = useState("");
  const [decisionOutcome, setDecisionOutcome] = useState("Investigate further");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextStatus, setNextStatus] = useState("researching");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const endpoint = `/api/intelligence/brands/${id}`;
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
      setLoadError(caught instanceof Error ? caught.message : "The Brand could not be loaded.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);

  const record = detail?.brand;
  const selectedField = brandFields.find(([key]) => key === fieldName) ?? brandFields[0];

  async function addEvidence(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    const tabWhenStarted = activeTab;
    setEvidenceBusy(true);
    setActionError("");
    const evidenceClass = brandResearchEvidenceClass(researchConfidence);
    const unknown = researchConfidence === "insufficient";
    try {
      await api(`/api/records/brand/${id}/evidence`, {
        method: "POST",
        body: {
          exactClaim: claim,
          evidenceClass,
          verificationStatus: "reviewed",
          sourceId: unknown ? null : sourceId,
          unknownReason: unknown ? "Not yet verified." : null,
          supports: unknown ? "" : claim,
          doesNotSupport: "",
          confidence: researchConfidence,
          context: "Brand research",
          limitations: researchNote,
          contraryEvidence: "",
          permittedUse: "Internal qualification",
          prohibitedInference: "Do not present beyond the recorded support."
        }
      });
      setClaim("");
      setResearchNote("");
      await load({ silent: true });
      setActiveTab((current) => (current !== tabWhenStarted && current !== "evidence" ? current : "evidence"));
      setStatusMessage("Finding saved.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Finding could not be saved.");
    } finally {
      setEvidenceBusy(false);
    }
  }

  async function updateIntelligence(event: FormEvent) {
    event.preventDefault();
    if (!record || !canWrite) return;
    const evidenceId = detail?.evidence[0]?.id;
    if (!evidenceId) {
      setActionError("Add brand details before updating the wholesale profile.");
      return;
    }
    let value: unknown = fieldValue;
    if (selectedField[0] === "stopFlag") value = fieldValue === "true";
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
      setStatusMessage("Wholesale profile updated.");
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
      await api(`/api/intelligence/brand/${id}/observations`, {
        method: "POST",
        body: {
          metricCode: observationMetric,
          value: observationValue,
          evidenceClass: "direct_evidence",
          confidence: "limited",
          sourceId: null,
          unknownReason: null,
          observedAt: new Date().toISOString(),
          acquisitionContext: "Brand update",
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
      const decision = await api<{ decision: { id: string } }>(`/api/records/brand/${id}/decisions`, {
        method: "POST",
        body: {
          question: `Should this brand move to ${nextStatus.replaceAll("_", " ")}?`,
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
        const task = await api<{ task: { id: string } }>(`/api/records/brand/${id}/tasks`, {
          method: "POST",
          body: { title: nextAction, priority: "medium", createdReason: "Qualification decision", mandatoryGate: true }
        });
        taskId = task.task.id;
      }
      await api(`${endpoint}/stage`, {
        method: "POST",
        body: {
          version: record.version,
          toStage: nextStatus,
          reason: decisionRationale,
          decisionId: decision.decision.id,
          nextActionTaskId: taskId
        }
      });
      setDecisionRationale("");
      setNextAction("");
      await load({ silent: true });
      setStatusMessage("Qualification decision was applied.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Decision could not be applied.");
    } finally {
      setDecisionBusy(false);
    }
  }

  async function addContact(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    const tabWhenStarted = activeTab;
    setContactBusy(true);
    setActionError("");
    try {
      await api("/api/records/contact", {
        method: "POST",
        body: { parentType: "brand", parentId: id, name: contactName, role: contactRole, email: contactEmail || undefined }
      });
      setContactName("");
      setContactRole("");
      setContactEmail("");
      await load({ silent: true });
      setActiveTab((current) => (current !== tabWhenStarted && current !== "related" ? current : "related"));
      setStatusMessage("Unverified professional contact was recorded.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Contact could not be added.");
    } finally {
      setContactBusy(false);
    }
  }

  async function markIdentityReviewing() {
    if (!record || !canWrite) return;
    setIdentityBusy(true);
    setActionError("");
    try {
      await api(`/api/records/brand/${id}`, {
        method: "PATCH",
        body: { version: record.version, changes: { identityStatus: "reviewing" } }
      });
      await load({ silent: true });
      setStatusMessage("Brand identity review was started.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Brand identity review could not be started.");
    } finally {
      setIdentityBusy(false);
    }
  }

  const loadingTrail = (
    <RelationshipTrail items={[
      { label: "Brands", to: compatibility.registerPath },
      { label: loading ? "Loading brand" : "Brand unavailable" }
    ]} />
  );

  if (!detail && loading) {
    return (
      <div className="page ry-relationship-page ry-brand-page">
        {loadingTrail}
        <IdentityHeader title="Loading brand" status={<span className="ry-brand-status-meta">Loading</span>} />
        <LoadingState label="Loading brand" />
      </div>
    );
  }

  if (!detail || !record) {
    return (
      <div className="page ry-relationship-page ry-brand-page">
        {loadingTrail}
        <IdentityHeader title="Brand unavailable" />
        <ErrorState message={loadError} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const displayName = brandName(record);
  const stage = brandStage(record);
  const identity = brandIdentity(record);
  const evidence = detail.evidence ?? [];
  const products = detail.products ?? [];
  const contacts = detail.contacts ?? [];
  const decisions = detail.decisions ?? [];
  const risks = detail.risks ?? [];
  const stageEvents = detail.stageEvents ?? [];
  const unknownCount = detail.unknowns?.length ?? 0;
  const authorityStatus = shown(detail.authority?.status, "not_established");
  const authorityReason = shown(detail.authority?.reason, "A verified Representation Agreement is required before this Brand can be Authorized or Active.");
  const stopFlag = Boolean(brandField(record, "stopFlag", "stop_flag"));
  const legalName = shown(brandField(record, "legalName", "legal_name"), "");
  const website = shown(brandField(record, "website", "website"), "");
  void ["Authority not established here"];

  const tabs: RelationshipTab[] = [
    { id: "overview", label: "Overview" },
    { id: "products", label: "Products", count: products.length },
    { id: "evidence", label: "Brand research", count: evidence.length },
    { id: "qualification", label: "Review", count: decisions.length + stageEvents.length },
    { id: "representation", label: "Representation" },
    { id: "related", label: "Contacts", count: contacts.length },
    { id: "activity", label: "Activity", count: decisions.length + stageEvents.length }
  ];

  const activityEntries = [
    ...stageEvents.map((item) => ({
      id: item.id,
      title: `${readable(shown(item.fromStage, "none"))} → ${readable(shown(item.toStage))}`,
      description: shown(item.reason, "No stage rationale recorded."),
      meta: dateTime(item.occurredAt),
      status: <span className="ry-brand-status-meta">{readable(shown(item.toStage))}</span>,
      sortAt: shown(item.occurredAt, "")
    })),
    ...decisions.map((item) => ({
      id: item.id,
      title: shown(item.outcome, "Decision recorded"),
      description: shown(item.rationale, "No rationale recorded."),
      meta: `${dateTime(item.decidedAt)} · Brand review`,
      status: <span className="ry-brand-status-meta">{readable(shown(item.status, "issued"))}</span>,
      sortAt: shown(item.decidedAt, "")
    }))
  ].sort((left, right) => {
    const leftTime = left.sortAt ? new Date(left.sortAt).getTime() : 0;
    const rightTime = right.sortAt ? new Date(right.sortAt).getTime() : 0;
    return rightTime - leftTime;
  }).map(({ sortAt, ...entry }) => {
    void sortAt;
    return entry;
  });

  const headerActions = canWrite
    ? <Link className="ry-button ry-button-secondary" to={compatibility.registerPath}>Back to brands</Link>
    : (
      <>
        <Button disabled>Read-only</Button>
        <Link className="ry-button ry-button-secondary" to={compatibility.registerPath}>Back to brands</Link>
      </>
    );

  const contextContent = (
    <>
      <div className="ry-context-item ry-brand-status-item">
        <strong>Stage</strong>
        <span>{brandStageLabel(record)}</span>
      </div>
      <div className="ry-context-item ry-brand-status-item">
        <strong>Readiness</strong>
        <span>{brandReadinessLabel(record)}</span>
      </div>
      <div className="ry-context-item ry-brand-status-item">
        <strong>Identity</strong>
        <span>{brandIdentityLabel(record)}</span>
      </div>
      <div className="ry-context-item ry-brand-status-item">
        <strong>Risk</strong>
        <span>{brandRiskLabel(record)}</span>
      </div>
      <div className="ry-context-item ry-brand-status-item">
        <strong>Next action</strong>
        <p>{shown(brandField(record, "nextAction", "next_action"), "Review brand details and decide whether this brand is ready to advance.")}</p>
      </div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-brand-page">
      <RelationshipTrail items={[
        { label: "Brands", to: compatibility.registerPath },
        { label: displayName }
      ]} />
      {compatibility.showCompatibilityNotice ? (
        <Alert title="Generic Brand detail compatibility">This route reuses the canonical Brand Intelligence detail workspace.</Alert>
      ) : null}
      <IdentityHeader
        title={displayName}
        relationship={(
          <span className="ry-brand-identity-meta">
            {legalName || "Legal name not recorded"}
            {website ? ` · ${website}` : null}
            {` · ${products.length} product${products.length === 1 ? "" : "s"}`}
          </span>
        )}
        status={(
          <span className="ry-brand-status-meta" aria-label="Brand summary">
            <span className="ry-brand-register-dimension">{brandStageLabel(record)}</span>
            <span className="ry-brand-status-sep" aria-hidden="true">·</span>
            <span className={`ry-brand-identity-status${brandReadinessLabel(record) === "Needs review" ? " is-attention" : " is-complete"}`}>
              {brandReadinessLabel(record)}
            </span>
          </span>
        )}
        warning={stopFlag ? <Alert tone="danger" title="Stop flag set">Further advancement is blocked until the stop condition is reviewed.</Alert> : unknownCount > 0 ? <Alert tone="warning" title="Explicit unknowns recorded">{unknownCount} field{unknownCount === 1 ? " remains" : "s remain"} explicitly Unknown. Missing evidence is not negative evidence.</Alert> : undefined}
        nextAction={<span>{canWrite ? "Complete brand details and decide whether this brand is ready to advance." : session?.access.reason ?? "Read-only."}</span>}
        actions={headerActions}
      />
      {statusMessage ? <p className="ry-relationship-status" role="status">{statusMessage}</p> : null}
      {actionError ? <ErrorState message={actionError} /> : null}
      {!canWrite ? <p className="ry-brand-readonly-note">Read-only</p> : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Brand views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={<ContextRail title="At a glance" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>{contextContent}</ContextRail>}>
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Brand overview" description="Identity and commercial characteristics for this brand.">
            <dl className="ry-relationship-facts ry-brand-overview-facts">
              <div><dt>Public name</dt><dd>{displayName}</dd></div>
              <div><dt>Legal name</dt><dd>{legalName || "Not recorded"}</dd></div>
              <div><dt>Identity</dt><dd>{readable(identity)}</dd></div>
              <div><dt>Stage</dt><dd>{readable(stage)}</dd></div>
              <div><dt>Website</dt><dd>{website || "Not recorded"}</dd></div>
              <div><dt>Stop flag</dt><dd>{stopFlag ? "Yes" : "No"}</dd></div>
            </dl>
            {canWrite && identity === "unverified" ? (
              <Button variant="secondary" size="compact" loading={identityBusy} onClick={() => void markIdentityReviewing()}>Start identity review</Button>
            ) : null}
          </RelationshipSection>
          <RelationshipSection title="Wholesale profile" description="Wholesale and commercial details for this brand.">
            <dl className="ry-relationship-facts ry-brand-overview-facts">
              {brandFields.map(([key, label]) => (
                <div key={key}><dt>{label}</dt><dd>{readable(shown(brandField(record, key, key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`))))}</dd></div>
              ))}
            </dl>
            {canWrite ? (
              <form className="ry-brand-field-form ry-brand-form-compact ry-brand-workspace-form" onSubmit={(event) => void updateIntelligence(event)}>
                <div className="ry-brand-form-grid">
                  <Field label={selectedField[1]}>
                    <Select controlSize="compact" value={fieldName} onChange={(event) => { setFieldName(event.target.value); setFieldValue(""); }}>
                      {brandFields.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </Select>
                  </Field>
                  <Field label={brandFieldValueLabel(fieldName)} className="ry-brand-form-span">
                    {selectedField[2].length ? (
                      <Select controlSize="compact" required value={fieldValue} onChange={(event) => setFieldValue(event.target.value)}>
                        <option value="">{brandFieldValueLabel(fieldName)}</option>
                        {selectedField[2].map((item) => <option key={item} value={item}>{readable(item)}</option>)}
                      </Select>
                    ) : (
                      <Input controlSize="compact" required value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} placeholder={brandFieldValuePlaceholder(fieldName)} />
                    )}
                  </Field>
                </div>
                <Button type="submit" size="compact" loading={fieldBusy} disabled={!canWrite}>Save</Button>
              </form>
            ) : null}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="products" active={activeTab === "products"}>
          <RelationshipSection title="Related Products" description="Products associated with this brand.">
            {products.length ? (
              <ul className="ry-relationship-evidence-list">
                {products.map((item) => (
                  <li key={item.id}>
                    <Link to={`/products/${item.id}`}><strong>{item.name}</strong></Link>
                    <small>{shown(item.category)} · {readable(shown(item.wholesaleReadiness, "not_reviewed"))} · {readable(shown(item.status, "discovered"))}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ry-brand-empty-note">No products are linked to this brand yet.</p>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="evidence" active={activeTab === "evidence"}>
          <RelationshipSection title="Brand research" description="Add verified information, sources, and notes about this brand.">
            {evidence.length ? (
              <ul className="ry-relationship-evidence-list">
                {evidence.map((item) => (
                  <li key={item.id}>
                    <strong>{shown(item.exactClaim)}</strong>
                    <EvidenceLabel value={shown(item.evidenceClass, "unknown")} confidence={shown(item.confidence, "insufficient")} freshness={dateTime(item.observedAt, "Date not recorded")} />
                    <small>{shown(item.sourceReference, shown(item.unknownReason, "No source linked"))}</small>
                    {shown(item.limitations, "") ? <small>{shown(item.limitations)}</small> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ry-brand-empty-note">No research recorded yet.</p>
            )}
            {canWrite ? (
              <form className="ry-brand-evidence-form ry-brand-form-compact ry-brand-workspace-form" onSubmit={(event) => void addEvidence(event)}>
                <div className="ry-brand-form-grid">
                  <Field label="Finding / detail" className="ry-brand-form-span">
                    <Input controlSize="compact" required value={claim} onChange={(event) => setClaim(event.target.value)} placeholder="What you learned about this brand" />
                  </Field>
                  {researchConfidence !== "insufficient" ? (
                    <Field label="Source">
                      <Select controlSize="compact" required value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                        <option value="">Select source</option>
                        {sources.map((item) => <option key={item.id} value={item.id}>{item.reference}</option>)}
                      </Select>
                    </Field>
                  ) : null}
                  <Field label="Confidence">
                    <Select controlSize="compact" value={researchConfidence} onChange={(event) => setResearchConfidence(event.target.value)}>
                      {brandResearchConfidenceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Note" className="ry-brand-form-span">
                    <Input controlSize="compact" value={researchNote} onChange={(event) => setResearchNote(event.target.value)} placeholder="Optional context or caveat" />
                  </Field>
                </div>
                <Button type="submit" variant="secondary" size="compact" loading={evidenceBusy}>Add finding</Button>
              </form>
            ) : null}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="qualification" active={activeTab === "qualification"}>
          <div className="ry-brand-review">
            <RelationshipSection title="Brand updates" description="Record observations that preserve acquisition context.">
              {canWrite ? (
                <form className="ry-brand-observation-form ry-brand-form-compact ry-brand-workspace-form" onSubmit={(event) => void addObservation(event)}>
                  <div className="ry-brand-form-grid">
                    <Field label="Metric">
                      <Input controlSize="compact" required value={observationMetric} onChange={(event) => setObservationMetric(event.target.value)} placeholder="What changed" />
                    </Field>
                    <Field label="Value">
                      <Input controlSize="compact" required value={observationValue} onChange={(event) => setObservationValue(event.target.value)} placeholder="Observed value" />
                    </Field>
                  </div>
                  <Button type="submit" variant="secondary" size="compact" loading={observationBusy}>Save update</Button>
                </form>
              ) : (
                <p className="ry-brand-empty-note">Observation recording is unavailable in this session.</p>
              )}
            </RelationshipSection>
            <RelationshipSection title="Brand review" description="Decide whether this brand is ready to advance.">
              <p className="ry-brand-review-status">
                Current stage: {brandStageLabel({ pipelineStage: stage })}
                <span aria-hidden="true"> · </span>
                Next stage: {brandStageLabel({ pipelineStage: nextStatus })}
              </p>
              <form className="ry-brand-decision-form ry-brand-form-compact ry-brand-workspace-form" onSubmit={(event) => void decide(event)}>
                <div className="ry-brand-form-grid">
                  <Field label="Review outcome" className="ry-brand-form-span">
                    <Input controlSize="compact" required value={decisionOutcome} onChange={(event) => setDecisionOutcome(event.target.value)} disabled={!canWrite} placeholder="Review outcome" />
                  </Field>
                  <Field label="Next stage">
                    <Select controlSize="compact" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} disabled={!canWrite}>
                      {["researching", "contact_ready", "rejected", "authorized"].map((item) => <option key={item} value={item}>{readable(item)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Rationale" className="ry-brand-form-span">
                    <Input controlSize="compact" required value={decisionRationale} onChange={(event) => setDecisionRationale(event.target.value)} disabled={!canWrite} placeholder="Why this review outcome" />
                  </Field>
                  {nextStatus !== "rejected" ? (
                    <Field label="Next action" className="ry-brand-form-span">
                      <Input controlSize="compact" required value={nextAction} onChange={(event) => setNextAction(event.target.value)} disabled={!canWrite} placeholder="What happens next" />
                    </Field>
                  ) : null}
                </div>
                <Button type="submit" size="compact" loading={decisionBusy} disabled={!canWrite}>Save review</Button>
              </form>
            </RelationshipSection>
            {risks.length ? (
              <RelationshipSection title="Open risks" description="Risk severity includes explanatory context.">
                <ul className="ry-relationship-evidence-list">
                  {risks.map((item) => (
                    <li key={item.id}>
                      <strong>{readable(shown(item.riskType, "risk"))}</strong>
                      <RiskIndicator value={shown(item.severity, "medium")} rationale={shown(item.description, "No description recorded.")} />
                    </li>
                  ))}
                </ul>
              </RelationshipSection>
            ) : null}
          </div>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="representation" active={activeTab === "representation"}>
          <RelationshipSection title="Representation">
            <dl className="ry-relationship-facts ry-brand-overview-facts">
              <div><dt>Stage</dt><dd>{readable(stage)}</dd></div>
              <div><dt>Representation status</dt><dd>{readable(shown(brandField(record, "representationStatus", "representation_status"), "not_established"))}</dd></div>
              <div><dt>Authority</dt><dd><AuthorityIndicator value={authorityStatus} rationale={authorityReason} /></dd></div>
            </dl>
            <Alert title="No representation authority yet.">
              An active agreement is required before this brand can be represented or used for authorized outreach.
            </Alert>
            <div className="ry-brand-inline-actions">
              <Link className="ry-button ry-button-secondary" to="/representation">Open Representation</Link>
            </div>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="related" active={activeTab === "related"}>
          <RelationshipSection title="Contacts" description="Professional contacts associated with this brand.">
            {contacts.length ? (
              <ul className="ry-relationship-evidence-list">
                {contacts.map((item) => (
                  <li key={item.id}>
                    <Link to={`/contacts/${item.id}`}><strong>{item.name}</strong></Link>
                    <small>{shown(item.role)} · {shown(item.email, "No email")} · {readable(shown(item.verificationStatus, "unverified"))}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ry-brand-empty-note">No professional contact route recorded.</p>
            )}
            {canWrite ? (
              <form className="ry-brand-contact-form ry-brand-form-compact ry-brand-workspace-form" onSubmit={(event) => void addContact(event)}>
                <div className="ry-brand-form-grid">
                  <Field label="Name">
                    <Input controlSize="compact" required value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Contact name" />
                  </Field>
                  <Field label="Role">
                    <Input controlSize="compact" required value={contactRole} onChange={(event) => setContactRole(event.target.value)} placeholder="Role" />
                  </Field>
                  <Field label="Professional email" className="ry-brand-form-span">
                    <Input controlSize="compact" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="name@company.com" />
                  </Field>
                </div>
                <Button type="submit" variant="secondary" size="compact" loading={contactBusy}>Add contact</Button>
              </form>
            ) : null}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Activity" description="Stage changes and decisions in newest-first order.">
            <ActivityTimeline entries={activityEntries} empty="No brand activity has been recorded." label={`${displayName} activity timeline`} />
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>
    </div>
  );
}
