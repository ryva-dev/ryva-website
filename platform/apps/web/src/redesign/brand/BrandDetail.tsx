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
  brandField,
  brandFields,
  brandIdentity,
  brandName,
  brandStage,
  canonicalBrandPaths,
  date,
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
  const [evidenceClass, setEvidenceClass] = useState("unknown");
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
    const unknown = evidenceClass === "unknown";
    try {
      await api(`/api/records/brand/${id}/evidence`, {
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
      await api(`/api/intelligence/brand/${id}/observations`, {
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
          body: { title: nextAction, priority: "medium", createdReason: "Human qualification decision", mandatoryGate: true }
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
      setStatusMessage("Human qualification decision was applied.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Human decision could not be applied.");
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
      { label: loading ? "Loading Brand" : "Brand unavailable" }
    ]} />
  );

  if (!detail && loading) {
    return (
      <div className="page ry-relationship-page ry-brand-page">
        {loadingTrail}
        <IdentityHeader eyebrow="Brand Intelligence" title="Loading Brand" status={<StatusLabel value="loading" />} />
        <LoadingState label="Loading Brand relationship" />
      </div>
    );
  }

  if (!detail || !record) {
    return (
      <div className="page ry-relationship-page ry-brand-page">
        {loadingTrail}
        <IdentityHeader eyebrow="Brand Intelligence" title="Brand unavailable" />
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

  const tabs: RelationshipTab[] = [
    { id: "overview", label: "Overview" },
    { id: "products", label: "Products", count: products.length },
    { id: "evidence", label: "Evidence", count: evidence.length },
    { id: "qualification", label: "Qualification", count: decisions.length + stageEvents.length },
    { id: "representation", label: "Representation" },
    { id: "related", label: "Relationships", count: contacts.length },
    { id: "activity", label: "Activity", count: decisions.length + stageEvents.length }
  ];

  const activityEntries = [
    ...stageEvents.map((item) => ({
      id: item.id,
      title: `${readable(shown(item.fromStage, "none"))} → ${readable(shown(item.toStage))}`,
      description: shown(item.reason, "No stage rationale recorded."),
      meta: dateTime(item.occurredAt),
      status: <StatusLabel value={shown(item.toStage)} />
    })),
    ...decisions.map((item) => ({
      id: item.id,
      title: shown(item.outcome, "Decision recorded"),
      description: shown(item.rationale, "No rationale recorded."),
      meta: `${dateTime(item.decidedAt)} · ${shown(item.question, "Qualification decision")}`,
      status: <StatusLabel value={shown(item.status, "issued")} />
    }))
  ];

  const primaryAction = canWrite
    ? <Button onClick={() => { setActionError(""); setActiveTab("qualification"); }}>Review qualification</Button>
    : <Button disabled>Read-only access</Button>;

  const contextContent = (
    <>
      <div className="ry-context-item">
        <strong>Evidence state</strong>
        <EvidenceLabel value={unknownCount > 0 ? "unknown" : evidence.length ? "direct_evidence" : "unknown"} confidence={evidence.length ? "limited" : "insufficient"} freshness={brandField(record, "lastReviewedAt", "last_reviewed_at") ? `Last reviewed ${date(brandField(record, "lastReviewedAt", "last_reviewed_at"))}` : "Not reviewed"} />
        <small>{unknownCount} explicit unknown{unknownCount === 1 ? "" : "s"} · {evidence.length} evidence record{evidence.length === 1 ? "" : "s"}</small>
      </div>
      <div className="ry-context-item">
        <strong>Pipeline stage</strong>
        <StatusLabel value={stage} />
        <small>Human decision required to change Brand qualification.</small>
      </div>
      <div className="ry-context-item">
        <strong>Open risk</strong>
        <RiskIndicator value={risks.some((item) => ["high", "critical"].includes(shown(item.severity))) ? "high" : risks.length ? "medium" : "low"} rationale={`${risks.length} open risk flag${risks.length === 1 ? "" : "s"}.`} />
      </div>
      <div className="ry-context-item">
        <strong>Representation authority</strong>
        <AuthorityIndicator value={authorityStatus} rationale={authorityReason} />
        <small>Representation readiness is not active Agreement authority.</small>
      </div>
      <div className="ry-context-item">
        <strong>Next action</strong>
        <p>{shown(brandField(record, "nextAction", "next_action"), "No next action assigned.")}</p>
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
        eyebrow={`Brand Intelligence · ${readable(identity)}`}
        title={displayName}
        relationship={(
          <span className="ry-relationship-identity-meta">
            <span>{shown(brandField(record, "legalName", "legal_name"), "Legal name not recorded")}</span>
            <span>{readable(stage)}</span>
            <span>{products.length} Product{products.length === 1 ? "" : "s"}</span>
          </span>
        )}
        status={<StatusLabel value={stage} />}
        warning={stopFlag ? <Alert tone="danger" title="Stop flag set">Further advancement is blocked until the stop condition is reviewed.</Alert> : unknownCount > 0 ? <Alert tone="warning" title="Explicit unknowns recorded">{unknownCount} field{unknownCount === 1 ? " remains" : "s remain"} explicitly Unknown. Missing evidence is not negative evidence.</Alert> : undefined}
        nextAction={<span>{canWrite ? "Review evidence and apply a human-owned qualification decision when ready." : session?.access.reason ?? "Read-only Brand inspection."}</span>}
        actions={<>{primaryAction}<Link className="ry-button ry-button-secondary" to={compatibility.registerPath}>Back to register</Link></>}
      />
      {statusMessage ? <p className="ry-relationship-status" role="status">{statusMessage}</p> : null}
      {actionError ? <ErrorState message={actionError} /> : null}
      {!canWrite ? <Alert tone="warning" title="Read-only Brand context">You may inspect permitted Brand context, but cannot add evidence or apply qualification decisions in this session.</Alert> : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Brand relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={<ContextRail title="Brand context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>{contextContent}</ContextRail>}>
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Stored Brand facts" description="Identity and commercial characteristics currently stored for this Brand.">
            <dl className="ry-relationship-facts">
              <div><dt>Public name</dt><dd>{displayName}</dd></div>
              <div><dt>Legal name</dt><dd>{shown(brandField(record, "legalName", "legal_name"), "Not recorded")}</dd></div>
              <div><dt>Identity status</dt><dd><StatusLabel value={identity} /></dd></div>
              <div><dt>Pipeline stage</dt><dd><StatusLabel value={stage} /></dd></div>
              <div><dt>Website</dt><dd>{shown(brandField(record, "website", "website"), "Not recorded")}</dd></div>
              <div><dt>Stop flag</dt><dd>{stopFlag ? "Yes" : "No"}</dd></div>
            </dl>
            {canWrite && identity === "unverified" ? (
              <Button variant="secondary" loading={identityBusy} onClick={() => void markIdentityReviewing()}>Start identity review</Button>
            ) : null}
          </RelationshipSection>
          <RelationshipSection title="Diligence fields" description="Material fields remain evidence-linked when updated through qualification workflows.">
            <dl className="ry-relationship-facts">
              {brandFields.map(([key, label]) => (
                <div key={key}><dt>{label}</dt><dd>{readable(shown(brandField(record, key, key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`))))}</dd></div>
              ))}
            </dl>
            {canWrite ? (
              <form className="ry-brand-field-form" onSubmit={(event) => void updateIntelligence(event)}>
                <Field label="Material field">
                  <Select value={fieldName} onChange={(event) => { setFieldName(event.target.value); setFieldValue(""); }}>
                    {brandFields.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
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

        <RelationshipTabPanel id={tabBaseId} tabId="products" active={activeTab === "products"}>
          <RelationshipSection title="Related Products" description="Product relationships provide commercial context. They do not create Brand authority.">
            {products.length ? (
              <ul className="ry-relationship-evidence-list">
                {products.map((item) => (
                  <li key={item.id}>
                    <Link to={`/products/${item.id}`}><strong>{item.name}</strong></Link>
                    <small>{shown(item.category)} · {readable(shown(item.wholesaleReadiness, "not_reviewed"))}</small>
                    <StatusLabel value={shown(item.status, "discovered")} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact description="No Products are linked to this Brand yet." action={canWrite ? <Link className="ry-button ry-button-secondary" to="/products">Open Product Intelligence</Link> : undefined} />
            )}
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
              <form className="ry-brand-evidence-form" onSubmit={(event) => void addEvidence(event)}>
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
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="qualification" active={activeTab === "qualification"}>
          <RelationshipSection title="Time-bound observations" description="Observations preserve acquisition context. Unknown values remain Unknown.">
            {canWrite ? (
              <form className="ry-brand-observation-form" onSubmit={(event) => void addObservation(event)}>
                <Field label="Metric"><Input required value={observationMetric} onChange={(event) => setObservationMetric(event.target.value)} /></Field>
                <Field label="Value"><Input required value={observationValue} onChange={(event) => setObservationValue(event.target.value)} /></Field>
                <Button type="submit" variant="secondary" loading={observationBusy}>Record observation</Button>
              </form>
            ) : <EmptyState compact description="Observation recording is unavailable in this session." />}
          </RelationshipSection>
          <RelationshipSection title="Human decision gate" description="The server rechecks evidence, risks, next action, and applicable authority before changing stage.">
            <form className="ry-brand-decision-form" onSubmit={(event) => void decide(event)}>
              <Field label="Decision outcome"><Input required value={decisionOutcome} onChange={(event) => setDecisionOutcome(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="Target state">
                <Select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} disabled={!canWrite}>
                  {["researching", "contact_ready", "rejected", "authorized"].map((item) => <option key={item} value={item}>{readable(item)}</option>)}
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
                  </li>
                ))}
              </ul>
            </RelationshipSection>
          ) : null}
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="representation" active={activeTab === "representation"}>
          <RelationshipSection title="Representation readiness versus authority" description="Pipeline readiness is not an Agreement. Active representation authority requires an approved Agreement covering at least one Product.">
            <dl className="ry-relationship-facts">
              <div><dt>Pipeline stage</dt><dd><StatusLabel value={stage} /></dd></div>
              <div><dt>Stored representation status</dt><dd><StatusLabel value={shown(brandField(record, "representationStatus", "representation_status"), "not_established")} /></dd></div>
              <div><dt>Authority</dt><dd><AuthorityIndicator value={authorityStatus} rationale={authorityReason} /></dd></div>
            </dl>
            <Alert title="Authority not established here">
              A Brand record never establishes Product, territory, channel, or Buyer Outreach authority by itself. Open Representation or Agreements when an exact documentary scope exists.
            </Alert>
            <div className="ry-brand-inline-actions">
              <Link className="ry-button ry-button-secondary" to="/representation">Open Representation</Link>
            </div>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="related" active={activeTab === "related"}>
          <RelationshipSection title="Professional contacts" description="Contacts record a professional route. They do not create Brand authority.">
            {contacts.length ? (
              <ul className="ry-relationship-evidence-list">
                {contacts.map((item) => (
                  <li key={item.id}>
                    <Link to={`/contacts/${item.id}`}><strong>{item.name}</strong></Link>
                    <small>{shown(item.role)} · {shown(item.email, "No email")}</small>
                    <StatusLabel value={shown(item.verificationStatus, "unverified")} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact description="No professional contact route recorded." />
            )}
            {canWrite ? (
              <form className="ry-brand-contact-form" onSubmit={(event) => void addContact(event)}>
                <Field label="Name"><Input required value={contactName} onChange={(event) => setContactName(event.target.value)} /></Field>
                <Field label="Role"><Input required value={contactRole} onChange={(event) => setContactRole(event.target.value)} /></Field>
                <Field label="Professional email"><Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></Field>
                <Button type="submit" variant="secondary" loading={contactBusy}>Add unverified contact</Button>
              </form>
            ) : null}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Qualification activity" description="Stage changes and decisions in newest-first order.">
            <ActivityTimeline entries={activityEntries} empty="No Brand qualification activity has been recorded." label={`${displayName} activity timeline`} />
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <StickyMobileAction>
        {primaryAction}
      </StickyMobileAction>
    </div>
  );
}
