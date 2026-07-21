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
  businessField,
  businessFields,
  businessName,
  businessQualification,
  businessType,
  canonicalBuyerPaths,
  date,
  dateTime,
  readable,
  shown,
  type BuyerCompatibility,
  type BuyerRow
} from "./utils";

type Source = { id: string; reference: string; status?: string };
type Detail = {
  business: BuyerRow;
  contacts: BuyerRow[];
  buyers: BuyerRow[];
  evidence: BuyerRow[];
  risks: BuyerRow[];
  decisions: BuyerRow[];
  matches: BuyerRow[];
  observations?: BuyerRow[];
  unknowns: BuyerRow[];
  conflictScope?: string;
};

export function BuyerDetailPage({
  compatibility = canonicalBuyerPaths
}: {
  compatibility?: BuyerCompatibility;
}) {
  const id = useParams().id ?? "";
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const tabBaseId = `buyer-${useId().replaceAll(":", "")}`;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [allProducts, setAllProducts] = useState<BuyerRow[]>([]);
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
  const [buyerBusy, setBuyerBusy] = useState(false);
  const [matchBusy, setMatchBusy] = useState(false);
  const [claim, setClaim] = useState("");
  const [evidenceClass, setEvidenceClass] = useState("unknown");
  const [sourceId, setSourceId] = useState("");
  const [fieldName, setFieldName] = useState<string>(businessFields[0][0]);
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
  const [matchProductId, setMatchProductId] = useState("");
  const [matchRationale, setMatchRationale] = useState("");
  const [buyerContactId, setBuyerContactId] = useState("");
  const [buyerContext, setBuyerContext] = useState("");

  const endpoint = `/api/intelligence/businesses/${id}`;
  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setLoadError("");
    try {
      const [payload, sourcePayload, productPayload] = await Promise.all([
        api<Detail>(endpoint),
        api<{ sources: Source[] }>("/api/sources"),
        api<{ records: BuyerRow[] }>("/api/records/product")
      ]);
      setDetail(payload);
      setSources(sourcePayload.sources);
      setAllProducts(productPayload.records);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "The Business could not be loaded.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);

  const record = detail?.business;
  const selectedField = businessFields.find(([key]) => key === fieldName) ?? businessFields[0];

  async function addEvidence(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    const tabWhenStarted = activeTab;
    setEvidenceBusy(true);
    setActionError("");
    const unknown = evidenceClass === "unknown";
    try {
      await api(`/api/records/business/${id}/evidence`, {
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
    setFieldBusy(true);
    setActionError("");
    try {
      await api(endpoint, {
        method: "PATCH",
        body: {
          version: record.version,
          changes: { [fieldName]: fieldValue },
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
      await api(`/api/intelligence/business/${id}/observations`, {
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
      const decision = await api<{ decision: { id: string } }>(`/api/records/business/${id}/decisions`, {
        method: "POST",
        body: {
          question: `Should this business move to ${nextStatus.replaceAll("_", " ")}?`,
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
        const task = await api<{ task: { id: string } }>(`/api/records/business/${id}/tasks`, {
          method: "POST",
          body: { title: nextAction, priority: "medium", createdReason: "Human qualification decision", mandatoryGate: true }
        });
        taskId = task.task.id;
      }
      await api(`${endpoint}/qualification`, {
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

  async function addContact(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    const tabWhenStarted = activeTab;
    setContactBusy(true);
    setActionError("");
    try {
      await api("/api/records/contact", {
        method: "POST",
        body: { parentType: "business", parentId: id, name: contactName, role: contactRole, email: contactEmail || undefined }
      });
      setContactName("");
      setContactRole("");
      setContactEmail("");
      await load({ silent: true });
      setActiveTab((current) => (current !== tabWhenStarted && current !== "contacts" ? current : "contacts"));
      setStatusMessage("Unverified professional contact was recorded.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Contact could not be added.");
    } finally {
      setContactBusy(false);
    }
  }

  async function createMatch(event: FormEvent) {
    event.preventDefault();
    if (!record || !canWrite) return;
    const evidenceId = detail?.evidence[0]?.id;
    if (!evidenceId) {
      setActionError("Business evidence is required before recording a match.");
      return;
    }
    const tabWhenStarted = activeTab;
    setMatchBusy(true);
    setActionError("");
    try {
      await api("/api/intelligence/matches", {
        method: "POST",
        body: {
          productId: matchProductId,
          businessId: id,
          context: {
            channel: "physical retail",
            geography: shown(businessField(record, "geography", "geography"), "not specified"),
            buyerType: shown(businessField(record, "businessType", "business_type"), "business buyer"),
            priceBand: shown(businessField(record, "pricePositioning", "price_positioning"), "unknown"),
            period: "current"
          },
          rationale: matchRationale,
          confidence: "limited",
          materialStatements: [{ statement: matchRationale, classification: "human_judgment" }],
          evidenceIds: [evidenceId],
          missingEvidence: ["Product-side evidence must also be reviewed."],
          contraryEvidence: "",
          origin: "user_entered"
        }
      });
      setMatchRationale("");
      await load({ silent: true });
      setActiveTab((current) => (current !== tabWhenStarted && current !== "fit" ? current : "fit"));
      setStatusMessage("Product match was recorded.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Match review could not be created.");
    } finally {
      setMatchBusy(false);
    }
  }

  async function decideMatch(match: BuyerRow, status: "qualified" | "conditional" | "rejected") {
    if (!canWrite) return;
    setMatchBusy(true);
    setActionError("");
    try {
      const decision = await api<{ decision: { id: string } }>(`/api/records/business/${id}/decisions`, {
        method: "POST",
        body: {
          question: "Does this Product fit the Business in the recorded context?",
          scope: "Product–Business match evidence and explicit context",
          outcome: status,
          rationale: shown(match.rationale),
          confidence: shown(match.confidence, "limited"),
          nextAction: status === "rejected" ? "" : "Validate the remaining match evidence.",
          status: "issued"
        }
      });
      let taskId: string | null = null;
      if (status !== "rejected") {
        const task = await api<{ task: { id: string } }>(`/api/records/business/${id}/tasks`, {
          method: "POST",
          body: { title: "Validate the remaining match evidence", priority: "medium", createdReason: "Product match decision", mandatoryGate: true }
        });
        taskId = task.task.id;
      }
      await api(`/api/intelligence/matches/${match.id}`, {
        method: "PATCH",
        body: { version: match.version, status, decisionId: decision.decision.id, nextActionTaskId: taskId }
      });
      await load({ silent: true });
      setStatusMessage("Match decision was applied.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Match decision could not be applied.");
    } finally {
      setMatchBusy(false);
    }
  }

  async function createBuyer(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    const tabWhenStarted = activeTab;
    setBuyerBusy(true);
    setActionError("");
    try {
      await api(`/api/businesses/${id}/buyers`, {
        method: "POST",
        body: {
          contactId: buyerContactId,
          buyerRole: "evaluator",
          decisionContext: buyerContext,
          authorityEvidence: null,
          authorityEvidenceId: null
        }
      });
      setBuyerContactId("");
      setBuyerContext("");
      await load({ silent: true });
      setActiveTab((current) => (current !== tabWhenStarted && current !== "buyers" ? current : "buyers"));
      setStatusMessage("Buyer context was recorded.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Buyer context could not be created.");
    } finally {
      setBuyerBusy(false);
    }
  }

  async function verifyBuyer(buyer: BuyerRow) {
    if (!canWrite) return;
    const evidenceId = detail?.evidence[0]?.id;
    if (!evidenceId) {
      setActionError("Record Business evidence describing purchasing authority before verifying a Buyer.");
      return;
    }
    setBuyerBusy(true);
    setActionError("");
    try {
      await api(`/api/businesses/${id}/buyers/${buyer.id}`, {
        method: "PATCH",
        body: {
          version: buyer.version,
          buyerRole: "decision_maker",
          decisionContext: shown(buyer.decisionContext, "Current category purchasing decision"),
          authorityEvidence: "Human reviewer linked the current Evidence Record to the stated decision context.",
          authorityEvidenceId: evidenceId,
          statedNeeds: shown(buyer.statedNeeds, ""),
          buyingWindow: shown(buyer.buyingWindow, ""),
          decisionProcess: shown(buyer.decisionProcess, ""),
          verificationStatus: "verified"
        }
      });
      await load({ silent: true });
      setStatusMessage("Buyer authority was verified with current evidence.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Buyer authority could not be verified.");
    } finally {
      setBuyerBusy(false);
    }
  }

  const loadingTrail = (
    <RelationshipTrail items={[
      { label: "Businesses & Buyers", to: compatibility.registerPath },
      { label: loading ? "Loading Business" : "Business unavailable" }
    ]} />
  );

  if (!detail && loading) {
    return (
      <div className="page ry-relationship-page ry-buyer-page">
        {loadingTrail}
        <IdentityHeader eyebrow="Buyer Intelligence" title="Loading Business" status={<StatusLabel value="loading" />} />
        <LoadingState label="Loading Business relationship" />
      </div>
    );
  }

  if (!detail || !record) {
    return (
      <div className="page ry-relationship-page ry-buyer-page">
        {loadingTrail}
        <IdentityHeader eyebrow="Buyer Intelligence" title="Business unavailable" />
        <ErrorState message={loadError} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const displayName = businessName(record);
  const qualification = businessQualification(record);
  const evidence = detail.evidence ?? [];
  const contacts = detail.contacts ?? [];
  const buyers = detail.buyers ?? [];
  const decisions = detail.decisions ?? [];
  const risks = detail.risks ?? [];
  const matches = detail.matches ?? [];
  const observations = detail.observations ?? [];
  const unknownCount = detail.unknowns?.length ?? 0;
  const verifiedContacts = contacts.filter((item) => shown(item.verificationStatus) === "verified").length;
  const verifiedBuyers = buyers.filter((item) => shown(item.verificationStatus) === "verified").length;

  const tabs: RelationshipTab[] = [
    { id: "overview", label: "Overview" },
    { id: "contacts", label: "Contacts", count: contacts.length },
    { id: "buyers", label: "Buyers", count: buyers.length },
    { id: "fit", label: "Fit", count: matches.length },
    { id: "evidence", label: "Evidence", count: evidence.length },
    { id: "qualification", label: "Qualification", count: decisions.length + observations.length },
    { id: "activity", label: "Activity", count: decisions.length }
  ];

  const activityEntries = decisions.map((item) => ({
    id: item.id,
    title: shown(item.outcome, "Decision recorded"),
    description: shown(item.rationale, "No rationale recorded."),
    meta: `${dateTime(item.decidedAt)} · ${shown(item.question, "Qualification decision")}`,
    status: <StatusLabel value={shown(item.status, "issued")} />
  }));

  const primaryAction = canWrite
    ? <Button onClick={() => { setActionError(""); setActiveTab("qualification"); }}>Review qualification</Button>
    : <Button disabled>Read-only access</Button>;

  const contextContent = (
    <>
      <div className="ry-context-item">
        <strong>Evidence state</strong>
        <EvidenceLabel value={unknownCount > 0 ? "unknown" : evidence.length ? "direct_evidence" : "unknown"} confidence={evidence.length ? "limited" : "insufficient"} freshness={businessField(record, "lastReviewedAt", "last_reviewed_at") ? `Last reviewed ${date(businessField(record, "lastReviewedAt", "last_reviewed_at"))}` : "Not reviewed"} />
        <small>{unknownCount} explicit unknown{unknownCount === 1 ? "" : "s"} · {evidence.length} evidence record{evidence.length === 1 ? "" : "s"}</small>
      </div>
      <div className="ry-context-item">
        <strong>Qualification</strong>
        <StatusLabel value={qualification} />
        <small>Qualification and authority are human-owned.</small>
      </div>
      <div className="ry-context-item">
        <strong>Contact coverage</strong>
        <StatusLabel value={contacts.length ? "recorded" : "none"} />
        <small>{contacts.length} Contact{contacts.length === 1 ? "" : "s"} · {verifiedContacts} verified</small>
      </div>
      <div className="ry-context-item">
        <strong>Verified buyers</strong>
        <StatusLabel value={verifiedBuyers > 0 ? "verified" : "unverified"} />
        <small>{verifiedBuyers} of {buyers.length} Buyer role{buyers.length === 1 ? "" : "s"} verified</small>
      </div>
      <div className="ry-context-item">
        <strong>Open risk</strong>
        <RiskIndicator value={risks.some((item) => ["high", "critical"].includes(shown(item.severity))) ? "high" : risks.length ? "medium" : "low"} rationale={`${risks.length} open risk flag${risks.length === 1 ? "" : "s"}.`} />
      </div>
      <div className="ry-context-item">
        <strong>Conflict scope</strong>
        <p>{shown(detail.conflictScope, "Current workspace records only.")}</p>
      </div>
      <div className="ry-context-item">
        <strong>Representation authority</strong>
        <AuthorityIndicator value="not_established" rationale="Representation authority is not established by a Business record." />
      </div>
      <div className="ry-context-item">
        <strong>Next action</strong>
        <p>{shown(businessField(record, "nextAction", "next_action"), "No next action assigned.")}</p>
      </div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-buyer-page">
      <RelationshipTrail items={[
        { label: "Businesses & Buyers", to: compatibility.registerPath },
        { label: displayName }
      ]} />
      {compatibility.showCompatibilityNotice ? (
        <Alert title="Generic Business detail compatibility">This route reuses the canonical Buyer Intelligence detail workspace.</Alert>
      ) : null}
      <IdentityHeader
        eyebrow={`Buyer Intelligence · ${readable(qualification)}`}
        title={displayName}
        relationship={(
          <span className="ry-relationship-identity-meta">
            <span>{businessType(record)}</span>
            <span>{shown(businessField(record, "category", "category"), "General")}</span>
            <span>{shown(businessField(record, "geography", "geography"), "Geography not recorded")}</span>
          </span>
        )}
        status={<StatusLabel value={qualification} />}
        warning={unknownCount > 0 ? <Alert tone="warning" title="Explicit unknowns recorded">{unknownCount} field{unknownCount === 1 ? " remains" : "s remain"} explicitly Unknown. Missing evidence is not negative evidence.</Alert> : undefined}
        nextAction={<span>{canWrite ? "Review evidence and apply a human-owned qualification decision when ready." : session?.access.reason ?? "Read-only Business inspection."}</span>}
        actions={<>{primaryAction}<Link className="ry-button ry-button-secondary" to={compatibility.registerPath}>Back to register</Link></>}
      />
      <p className="ry-relationship-policy">Material fields remain evidence-linked. AI may organize or suggest future inputs, but qualification and authority are human-owned.</p>
      {statusMessage ? <p className="ry-relationship-status" role="status">{statusMessage}</p> : null}
      {actionError ? <ErrorState message={actionError} /> : null}
      {!canWrite ? <Alert tone="warning" title="Read-only Buyer context">You may inspect permitted Business and Buyer context, but cannot add evidence or apply qualification decisions in this session.</Alert> : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Business relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={<ContextRail title="Business context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>{contextContent}</ContextRail>}>
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Stored Business facts" description="Organization characteristics currently stored for this Business.">
            <dl className="ry-relationship-facts">
              <div><dt>Business name</dt><dd>{displayName}</dd></div>
              <div><dt>Business type</dt><dd>{businessType(record)}</dd></div>
              <div><dt>Category</dt><dd>{shown(businessField(record, "category", "category"), "General")}</dd></div>
              <div><dt>Geography</dt><dd>{shown(businessField(record, "geography", "geography"), "Not recorded")}</dd></div>
              <div><dt>Qualification</dt><dd><StatusLabel value={qualification} /></dd></div>
              <div><dt>Conflict status</dt><dd><StatusLabel value={shown(businessField(record, "conflictStatus", "conflict_status"), "none")} /></dd></div>
            </dl>
          </RelationshipSection>
          <RelationshipSection title="Call preparation" description="Summarize Contact verification, permission context, and next action before outreach. Contacts do not create Buyer authority.">
            <dl className="ry-relationship-facts">
              <div><dt>Professional contacts</dt><dd>{contacts.length} recorded · {verifiedContacts} verified</dd></div>
              <div><dt>Verified Buyer roles</dt><dd>{verifiedBuyers} of {buyers.length}</dd></div>
              <div><dt>Permission status</dt><dd>{contacts.some((item) => shown(item.permissionStatus) !== "unknown") ? "Review Contact permission before outreach" : "Not reviewed"}</dd></div>
              <div><dt>Next action</dt><dd>{shown(businessField(record, "nextAction", "next_action"), "Not assigned")}</dd></div>
            </dl>
            <AuthorityIndicator value="not_established" rationale="Representation authority is not established by a Business record." />
          </RelationshipSection>
          <RelationshipSection title="Diligence fields" description="Material fields remain evidence-linked when updated through qualification workflows.">
            <dl className="ry-relationship-facts">
              {businessFields.map(([key, label]) => (
                <div key={key}><dt>{label}</dt><dd>{readable(shown(businessField(record, key, key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`))))}</dd></div>
              ))}
            </dl>
            {canWrite ? (
              <form className="ry-buyer-field-form" onSubmit={(event) => void updateIntelligence(event)}>
                <Field label="Material field">
                  <Select value={fieldName} onChange={(event) => { setFieldName(event.target.value); setFieldValue(""); }}>
                    {businessFields.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
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

        <RelationshipTabPanel id={tabBaseId} tabId="contacts" active={activeTab === "contacts"}>
          <RelationshipSection title="Professional contacts" description="Contacts record an individual professional route. They do not create Buyer authority.">
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
              <form className="ry-buyer-contact-form" onSubmit={(event) => void addContact(event)}>
                <Field label="Name"><Input required value={contactName} onChange={(event) => setContactName(event.target.value)} /></Field>
                <Field label="Role"><Input required value={contactRole} onChange={(event) => setContactRole(event.target.value)} /></Field>
                <Field label="Professional email"><Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></Field>
                <Button type="submit" variant="secondary" loading={contactBusy}>Add unverified contact</Button>
              </form>
            ) : null}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="buyers" active={activeTab === "buyers"}>
          <RelationshipSection title="Buyer profiles and authority" description="Buyer profiles are not Contacts. Verifying Buyer authority requires Business evidence linked to the stated decision context.">
            {buyers.length ? (
              <ul className="ry-relationship-evidence-list">
                {buyers.map((item) => (
                  <li key={item.id}>
                    <strong>{shown(item.name)}</strong>
                    <small>{shown(item.buyerRole)} · {shown(item.decisionContext)}</small>
                    <StatusLabel value={shown(item.verificationStatus, "unverified")} />
                    {canWrite && shown(item.verificationStatus) !== "verified" ? (
                      <Button variant="tertiary" size="compact" loading={buyerBusy} onClick={() => void verifyBuyer(item)}>Verify as decision maker with current evidence</Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact description="No Buyer context has been recorded." />
            )}
            {canWrite ? (
              <form className="ry-buyer-buyer-form" onSubmit={(event) => void createBuyer(event)}>
                <Field label="Professional Contact">
                  <Select required value={buyerContactId} onChange={(event) => setBuyerContactId(event.target.value)}>
                    <option value="">Select…</option>
                    {contacts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </Select>
                </Field>
                <Field label="Decision context"><TextArea required rows={3} value={buyerContext} onChange={(event) => setBuyerContext(event.target.value)} /></Field>
                <Button type="submit" variant="secondary" loading={buyerBusy}>Add unverified evaluator context</Button>
              </form>
            ) : null}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="fit" active={activeTab === "fit"}>
          <RelationshipSection title="Product match reviews" description="Product match is not Brand/Buyer authority. Fit reviews require explicit Business and Product evidence.">
            {matches.length ? (
              <ul className="ry-relationship-evidence-list">
                {matches.map((item) => (
                  <li key={item.id}>
                    <Link to={`/products/${shown(item.productId)}`}><strong>{shown(item.productName)}</strong></Link>
                    <small>{shown(item.rationale)}</small>
                    <StatusLabel value={shown(item.status, "proposed")} />
                    {canWrite && shown(item.status) === "proposed" ? (
                      <span className="ry-buyer-inline-actions">
                        <Button variant="tertiary" size="compact" disabled={matchBusy} onClick={() => void decideMatch(item, "qualified")}>Qualify match</Button>
                        <Button variant="tertiary" size="compact" disabled={matchBusy} onClick={() => void decideMatch(item, "conditional")}>Conditional</Button>
                        <Button variant="tertiary" size="compact" disabled={matchBusy} onClick={() => void decideMatch(item, "rejected")}>Reject</Button>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact description="No context-specific Product match reviewed." />
            )}
            {canWrite ? (
              <form className="ry-buyer-match-form" onSubmit={(event) => void createMatch(event)}>
                <Field label="Product">
                  <Select required value={matchProductId} onChange={(event) => setMatchProductId(event.target.value)}>
                    <option value="">Select…</option>
                    {allProducts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </Select>
                </Field>
                <Field label="Fit rationale"><TextArea required rows={4} value={matchRationale} onChange={(event) => setMatchRationale(event.target.value)} /></Field>
                <Button type="submit" variant="secondary" loading={matchBusy}>Record proposed match</Button>
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
              <form className="ry-buyer-evidence-form" onSubmit={(event) => void addEvidence(event)}>
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
              <form className="ry-buyer-observation-form" onSubmit={(event) => void addObservation(event)}>
                <Field label="Metric"><Input required value={observationMetric} onChange={(event) => setObservationMetric(event.target.value)} /></Field>
                <Field label="Value"><Input required value={observationValue} onChange={(event) => setObservationValue(event.target.value)} /></Field>
                <Button type="submit" variant="secondary" loading={observationBusy}>Record observation</Button>
              </form>
            ) : null}
          </RelationshipSection>
          <RelationshipSection title="Human decision gate" description="The server rechecks evidence, risks, next action, and applicable authority before changing qualification.">
            <form className="ry-buyer-decision-form" onSubmit={(event) => void decide(event)}>
              <Field label="Decision outcome"><Input required value={decisionOutcome} onChange={(event) => setDecisionOutcome(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="Target state">
                <Select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} disabled={!canWrite}>
                  {["researching", "conditional", "qualified", "rejected"].map((item) => <option key={item} value={item}>{readable(item)}</option>)}
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

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Qualification activity" description="Decisions in newest-first order.">
            <ActivityTimeline entries={activityEntries} empty="No Business qualification activity has been recorded." label={`${displayName} activity timeline`} />
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <StickyMobileAction>
        {primaryAction}
      </StickyMobileAction>
    </div>
  );
}
