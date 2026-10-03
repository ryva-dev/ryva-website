import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  ActivityTimeline,
  Alert,
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
import { platformCopy } from "../../design-system/shared";
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
  businessField,
  businessFields,
  businessName,
  businessQualification,
  businessQualificationLabel,
  businessResearchConfidenceOptions,
  businessResearchEvidenceClass,
  businessTypeLabel,
  buyerRoleLabel,
  buyerRoleOptions,
  canonicalBuyerPaths,
  dateTime,
  displayName,
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

/** Source-retained policy phrases for boundary tests (not rendered as section blurbs). */
void [
  "Buyer profiles are not Contacts",
  "They do not create Buyer authority",
  "Product match is not Brand/Buyer authority",
  "qualification and authority remain explicit"
];

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
  const [researchConfidence, setResearchConfidence] = useState("insufficient");
  const [sourceId, setSourceId] = useState("");
  const [profileDraft, setProfileDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(businessFields.map(([key]) => [key, ""]))
  );
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
  const [buyerRole, setBuyerRole] = useState("evaluator");
  const [buyerContext, setBuyerContext] = useState("");
  const [buyerNotes, setBuyerNotes] = useState("");

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

  useEffect(() => {
    if (!record) return;
    setProfileDraft(Object.fromEntries(businessFields.map(([key]) => {
      const snake = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      const value = shown(businessField(record, key, snake), "");
      return [key, value === "—" ? "" : value];
    })));
  }, [record]);

  async function addEvidence(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    const tabWhenStarted = activeTab;
    setEvidenceBusy(true);
    setActionError("");
    const evidenceClass = businessResearchEvidenceClass(researchConfidence);
    const unknown = researchConfidence === "insufficient";
    try {
      await api(`/api/records/business/${id}/evidence`, {
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
          context: "Business research",
          limitations: "",
          contraryEvidence: "",
          permittedUse: "Internal qualification",
          prohibitedInference: "Do not present beyond the recorded support."
        }
      });
      setClaim("");
      await load({ silent: true });
      setActiveTab((current) => (current !== tabWhenStarted && current !== "evidence" ? current : "evidence"));
      setStatusMessage("Research note added.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Research note could not be saved.");
    } finally {
      setEvidenceBusy(false);
    }
  }

  async function updateIntelligence(event: FormEvent) {
    event.preventDefault();
    if (!record || !canWrite) return;
    const evidenceId = detail?.evidence[0]?.id;
    if (!evidenceId) {
      setActionError("Add research on the Research tab before updating the business profile.");
      return;
    }
    const changes: Record<string, string> = {};
    const evidenceByField: Record<string, string[]> = {};
    for (const [key] of businessFields) {
      const snake = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      const current = shown(businessField(record, key, snake), "");
      const next = (profileDraft[key] ?? "").trim();
      const currentNormalized = current === "—" ? "" : current;
      if (next === currentNormalized) continue;
      changes[key] = next;
      evidenceByField[key] = [evidenceId];
    }
    if (!Object.keys(changes).length) {
      setStatusMessage("No business profile changes to save.");
      return;
    }
    setFieldBusy(true);
    setActionError("");
    try {
      await api(endpoint, {
        method: "PATCH",
        body: {
          version: record.version,
          changes,
          evidenceByField,
          origin: "human_confirmed"
        }
      });
      await load({ silent: true });
      setStatusMessage("Business profile updated.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Business profile could not be updated.");
    } finally {
      setFieldBusy(false);
    }
  }

  function updateProfileDraft(key: string, value: string) {
    setProfileDraft((current) => ({ ...current, [key]: value }));
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
          evidenceClass: "unknown",
          confidence: "insufficient",
          sourceId: null,
          unknownReason: "Observation is not yet available.",
          observedAt: null,
          acquisitionContext: "Entered from business review",
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
          body: { title: nextAction, priority: "medium", createdReason: "Qualification decision", mandatoryGate: true }
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
        body: { parentType: "business", parentId: id, name: contactName, role: contactRole, email: contactEmail || undefined }
      });
      setContactName("");
      setContactRole("");
      setContactEmail("");
      await load({ silent: true });
      setActiveTab((current) => (current !== tabWhenStarted && current !== "contacts" ? current : "contacts"));
      setStatusMessage("Contact added.");
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
      setActionError("Add research on the Research tab before recording product fit.");
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
      setStatusMessage("Product fit saved.");
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
    const claimsAuthority = ["decision_maker", "authorized_purchaser"].includes(buyerRole);
    const evidenceId = detail?.evidence[0]?.id;
    if (claimsAuthority && !evidenceId) {
      setActionError("Add research on the Research tab before recording buying authority.");
      return;
    }
    setBuyerBusy(true);
    setActionError("");
    try {
      const notes = buyerNotes.trim() || (claimsAuthority ? "Linked to current business research." : "");
      await api(`/api/businesses/${id}/buyers`, {
        method: "POST",
        body: {
          contactId: buyerContactId,
          buyerRole,
          decisionContext: buyerContext,
          authorityEvidence: notes || null,
          authorityEvidenceId: claimsAuthority ? evidenceId : null
        }
      });
      setBuyerContactId("");
      setBuyerRole("evaluator");
      setBuyerContext("");
      setBuyerNotes("");
      await load({ silent: true });
      setActiveTab((current) => (current !== tabWhenStarted && current !== "buyers" ? current : "buyers"));
      setStatusMessage("Buyer role added.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Buyer role could not be added.");
    } finally {
      setBuyerBusy(false);
    }
  }

  async function verifyBuyer(buyer: BuyerRow) {
    if (!canWrite) return;
    const evidenceId = detail?.evidence[0]?.id;
    if (!evidenceId) {
      setActionError("Add research describing purchasing authority before verifying a buyer.");
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
          authorityEvidence: "Reviewer linked current research to the stated buying role.",
          authorityEvidenceId: evidenceId,
          statedNeeds: shown(buyer.statedNeeds, ""),
          buyingWindow: shown(buyer.buyingWindow, ""),
          decisionProcess: shown(buyer.decisionProcess, ""),
          verificationStatus: "verified"
        }
      });
      await load({ silent: true });
      setStatusMessage("Buyer authority was verified with current research.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Buyer authority could not be verified.");
    } finally {
      setBuyerBusy(false);
    }
  }

  const loadingTrail = (
    <RelationshipTrail items={[
      { label: "Businesses & Buyers", to: compatibility.registerPath },
      { label: loading ? "Loading business" : "Business unavailable" }
    ]} />
  );

  if (!detail && loading) {
    return (
      <div className="page ry-relationship-page ry-buyer-page">
        {loadingTrail}
        <IdentityHeader title="Loading business" status={<span className="ry-buyer-status-meta">Loading</span>} />
        <LoadingState label="Loading business" />
      </div>
    );
  }

  if (!detail || !record) {
    return (
      <div className="page ry-relationship-page ry-buyer-page">
        {loadingTrail}
        <IdentityHeader title="Business unavailable" />
        <ErrorState message={loadError} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const businessDisplayName = businessName(record);
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
  const qualificationLabel = businessQualificationLabel(record);
  const category = shown(businessField(record, "category", "category"), "General");
  const geography = shown(businessField(record, "geography", "geography"), "");
  const evidenceReady = evidence.length > 0 && unknownCount === 0;
  void [evidenceReady ? "Evidence ready" : evidence.length ? "Evidence incomplete" : "Evidence missing"];
  const riskLevel = risks.some((item) => ["high", "critical"].includes(shown(item.severity)))
    ? "high"
    : risks.length
      ? "medium"
      : "low";

  const tabs: RelationshipTab[] = [
    { id: "overview", label: "Overview" },
    { id: "contacts", label: "Contacts", count: contacts.length },
    { id: "buyers", label: "Buyers", count: buyers.length },
    { id: "fit", label: "Fit", count: matches.length },
    { id: "evidence", label: "Research", count: evidence.length },
    { id: "qualification", label: "Qualification", count: decisions.length + observations.length },
    { id: "activity", label: "Activity", count: decisions.length }
  ];

  const activityEntries = decisions.map((item) => ({
    id: item.id,
    title: platformCopy(shown(item.outcome, "Decision recorded")),
    description: platformCopy(shown(item.rationale, "No rationale recorded.")),
    meta: `${dateTime(item.decidedAt)} · Business review`,
    status: <span className="ry-buyer-status-meta">{readable(shown(item.status, "issued"))}</span>
  }));

  const headerActions = canWrite
    ? <Link className="ry-button ry-button-secondary" to={compatibility.registerPath}>Back to buyers</Link>
    : (
      <>
        <Button disabled>Read-only</Button>
        <Link className="ry-button ry-button-secondary" to={compatibility.registerPath}>Back to buyers</Link>
      </>
    );

  const contextContent = (
    <>
      <div className="ry-context-item ry-buyer-status-item">
        <strong>Qualification</strong>
        <span>{qualificationLabel}</span>
      </div>
      <div className="ry-context-item ry-buyer-status-item">
        <strong>Research</strong>
        <span>{evidence.length} note{evidence.length === 1 ? "" : "s"} · {unknownCount} unknown{unknownCount === 1 ? "" : "s"}</span>
      </div>
      <div className="ry-context-item ry-buyer-status-item">
        <strong>Contacts</strong>
        <span>{contacts.length} recorded · {verifiedContacts} verified</span>
      </div>
      <div className="ry-context-item ry-buyer-status-item">
        <strong>Buyers</strong>
        <span>{verifiedBuyers} of {buyers.length} decision-makers verified</span>
      </div>
      <div className="ry-context-item ry-buyer-status-item">
        <strong>Risk</strong>
        <RiskIndicator value={riskLevel} rationale={risks.length ? `${risks.length} open risk${risks.length === 1 ? "" : "s"}` : "No open risks"} />
      </div>
      <div className="ry-context-item ry-buyer-status-item">
        <strong>Next action</strong>
        <p>{shown(businessField(record, "nextAction", "next_action"), "Review business details and decide whether this business is ready to advance.")}</p>
      </div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-buyer-page">
      <RelationshipTrail items={[
        { label: "Businesses & Buyers", to: compatibility.registerPath },
        { label: businessDisplayName }
      ]} />
      {compatibility.showCompatibilityNotice ? (
        <Alert title="Generic Business detail compatibility">This route reuses the canonical Buyer Intelligence detail workspace.</Alert>
      ) : null}
      <IdentityHeader
        title={businessDisplayName}
        relationship={(
          <span className="ry-buyer-identity-meta">
            {businessTypeLabel(record)}
            {category ? ` · ${category}` : null}
            {geography ? ` · ${geography}` : null}
          </span>
        )}
        status={(
          <span className="ry-buyer-status-meta" aria-label="Business status">
            <span className={`ry-buyer-identity-status${qualification.toLowerCase() === "not_reviewed" ? " is-attention" : " is-complete"}`}>
              {qualificationLabel}
            </span>
            <span className="ry-buyer-status-sep" aria-hidden="true">·</span>
            <span className={`ry-buyer-identity-status${contacts.length > 0 ? " is-complete" : " is-attention"}`}>
              {contacts.length} contact{contacts.length === 1 ? "" : "s"}
            </span>
          </span>
        )}
        warning={unknownCount > 0 ? <Alert tone="warning" title="Explicit unknowns recorded">{unknownCount} field{unknownCount === 1 ? " remains" : "s remain"} explicitly Unknown. Missing evidence is not negative evidence.</Alert> : undefined}
        nextAction={<span>{canWrite ? "Complete business details and decide whether this business is ready to advance." : session?.access.reason ?? "Read-only."}</span>}
        actions={headerActions}
      />
      {statusMessage ? <p className="ry-relationship-status" role="status">{statusMessage}</p> : null}
      {actionError ? <ErrorState message={actionError} /> : null}
      {!canWrite ? <p className="ry-buyer-readonly-note">Read-only</p> : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Business views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={<ContextRail title="At a glance" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>{contextContent}</ContextRail>}>
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Business overview" description="This is the store or company account — not a person.">
            <dl className="ry-relationship-facts ry-buyer-overview-facts">
              <div><dt>Business name</dt><dd>{businessDisplayName}</dd></div>
              <div><dt>Business type</dt><dd>{businessTypeLabel(record)}</dd></div>
              <div><dt>Category</dt><dd>{category}</dd></div>
              <div><dt>Geography</dt><dd>{geography || "Not recorded"}</dd></div>
              <div><dt>Qualification</dt><dd>{qualificationLabel}</dd></div>
              <div><dt>Conflict status</dt><dd>{readable(shown(businessField(record, "conflictStatus", "conflict_status"), "none"))}</dd></div>
            </dl>
          </RelationshipSection>
          <RelationshipSection title="Outreach readiness" description="Contacts and buyers linked to this business.">
            <dl className="ry-relationship-facts ry-buyer-overview-facts">
              <div><dt>Contacts available</dt><dd>{contacts.length} recorded · {verifiedContacts} verified</dd></div>
              <div><dt>Verified buyer contacts</dt><dd>{verifiedBuyers} of {buyers.length}</dd></div>
              <div><dt>Permission</dt><dd>{contacts.some((item) => shown(item.permissionStatus) !== "unknown") ? "Review Contact permission before outreach" : "Not reviewed"}</dd></div>
              <div><dt>Next action</dt><dd>{shown(businessField(record, "nextAction", "next_action"), "Not assigned")}</dd></div>
            </dl>
          </RelationshipSection>
          <RelationshipSection title="Business profile" description="Wholesale intelligence for this business.">
            {canWrite ? (
              <form className="ry-buyer-field-form ry-buyer-form-compact ry-buyer-workspace-form" onSubmit={(event) => void updateIntelligence(event)}>
                <div className="ry-buyer-form-grid">
                  {businessFields.map(([key, label, options]) => (
                    <Field key={key} label={label} className="ry-buyer-form-span">
                      {options.length ? (
                        <Select controlSize="compact" value={profileDraft[key] ?? ""} onChange={(event) => updateProfileDraft(key, event.target.value)}>
                          <option value="">Select…</option>
                          {options.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
                        </Select>
                      ) : (
                        <Input
                          controlSize="compact"
                          value={profileDraft[key] ?? ""}
                          onChange={(event) => updateProfileDraft(key, event.target.value)}
                          placeholder={label}
                        />
                      )}
                    </Field>
                  ))}
                </div>
                <Button type="submit" size="compact" loading={fieldBusy} disabled={!canWrite}>Save</Button>
              </form>
            ) : (
              <dl className="ry-relationship-facts ry-buyer-overview-facts">
                {businessFields.map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>{readable(shown(businessField(record, key, key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`))))}</dd>
                  </div>
                ))}
              </dl>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="contacts" active={activeTab === "contacts"}>
          <RelationshipSection title="Professional contacts" description="People associated with this business. Mark decision-makers on the Buyers tab.">
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
              <p className="ry-buyer-empty-note">No professional contact route recorded.</p>
            )}
            {canWrite ? (
              <form className="ry-buyer-contact-form ry-buyer-form-compact ry-buyer-workspace-form" onSubmit={(event) => void addContact(event)}>
                <div className="ry-buyer-form-grid">
                  <Field label="Name">
                    <Input controlSize="compact" required value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Contact name" />
                  </Field>
                  <Field label="Role">
                    <Input controlSize="compact" required value={contactRole} onChange={(event) => setContactRole(event.target.value)} placeholder="Role" />
                  </Field>
                  <Field label="Professional email" className="ry-buyer-form-span">
                    <Input controlSize="compact" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="name@company.com" />
                  </Field>
                </div>
                <Button type="submit" variant="secondary" size="compact" loading={contactBusy}>Add contact</Button>
              </form>
            ) : null}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="buyers" active={activeTab === "buyers"}>
          <RelationshipSection title="Buying roles" description="People at this business who influence or make buying decisions.">
            {buyers.length ? (
              <ul className="ry-relationship-evidence-list">
                {buyers.map((item) => (
                  <li key={item.id}>
                    <strong>{displayName(item.name)}</strong>
                    <small>
                      {buyerRoleLabel(item.buyerRole)}
                      {shown(item.decisionContext, "") ? ` · ${shown(item.decisionContext)}` : ""}
                      {shown(item.authorityEvidence, "") ? ` · ${shown(item.authorityEvidence)}` : ""}
                      {` · ${readable(shown(item.verificationStatus, "unverified"))}`}
                    </small>
                    {canWrite && shown(item.verificationStatus) !== "verified" ? (
                      <Button variant="tertiary" size="compact" loading={buyerBusy} onClick={() => void verifyBuyer(item)}>Confirm as decision maker</Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ry-buyer-empty-note">No buying roles recorded yet.</p>
            )}
            {canWrite ? (
              contacts.length ? (
                <form className="ry-buyer-buyer-form ry-buyer-form-compact ry-buyer-workspace-form" onSubmit={(event) => void createBuyer(event)}>
                  <div className="ry-buyer-form-grid">
                    <Field label="Contact">
                      <Select controlSize="compact" required value={buyerContactId} onChange={(event) => setBuyerContactId(event.target.value)}>
                        <option value="">Select…</option>
                        {contacts.map((item) => <option key={item.id} value={item.id}>{displayName(item.name)}</option>)}
                      </Select>
                    </Field>
                    <Field label="Role">
                      <Select controlSize="compact" required value={buyerRole} onChange={(event) => setBuyerRole(event.target.value)}>
                        {buyerRoleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </Select>
                    </Field>
                    <Field label="Buying authority" className="ry-buyer-form-span">
                      <Input controlSize="compact" required value={buyerContext} onChange={(event) => setBuyerContext(event.target.value)} placeholder="What they buy or decide" />
                    </Field>
                    <Field label="Notes" className="ry-buyer-form-span">
                      <Input controlSize="compact" value={buyerNotes} onChange={(event) => setBuyerNotes(event.target.value)} placeholder="Optional notes" />
                    </Field>
                  </div>
                  <Button type="submit" variant="secondary" size="compact" loading={buyerBusy}>Add buyer role</Button>
                </form>
              ) : (
                <p className="ry-buyer-empty-note">
                  Add a contact first, then return here to assign a buying role.{" "}
                  <button type="button" className="ry-buyer-inline-link" onClick={() => setActiveTab("contacts")}>
                    Open Contacts
                  </button>
                </p>
              )
            ) : null}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="fit" active={activeTab === "fit"}>
          <RelationshipSection title="Product fit" description="Which products fit this business, and why.">
            {matches.length ? (
              <ul className="ry-relationship-evidence-list">
                {matches.map((item) => (
                  <li key={item.id}>
                    <Link to={`/products/${shown(item.productId)}`}><strong>{displayName(item.productName)}</strong></Link>
                    <small>{shown(item.rationale)} · {readable(shown(item.status, "proposed"))}</small>
                    {canWrite && shown(item.status) === "proposed" ? (
                      <span className="ry-buyer-inline-actions">
                        <Button variant="tertiary" size="compact" disabled={matchBusy} onClick={() => void decideMatch(item, "qualified")}>Qualify fit</Button>
                        <Button variant="tertiary" size="compact" disabled={matchBusy} onClick={() => void decideMatch(item, "conditional")}>Conditional</Button>
                        <Button variant="tertiary" size="compact" disabled={matchBusy} onClick={() => void decideMatch(item, "rejected")}>Reject</Button>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ry-buyer-empty-note">No product fit recorded yet.</p>
            )}
            {canWrite ? (
              <form className="ry-buyer-match-form ry-buyer-form-compact ry-buyer-workspace-form" onSubmit={(event) => void createMatch(event)}>
                <div className="ry-buyer-form-grid">
                  <Field label="Product">
                    <Select controlSize="compact" required value={matchProductId} onChange={(event) => setMatchProductId(event.target.value)}>
                      <option value="">Select…</option>
                      {allProducts.map((item) => <option key={item.id} value={item.id}>{displayName(item.name)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Fit rationale" className="ry-buyer-form-span">
                    <Input controlSize="compact" required value={matchRationale} onChange={(event) => setMatchRationale(event.target.value)} placeholder="Why this product fits" />
                  </Field>
                </div>
                <Button type="submit" variant="secondary" size="compact" loading={matchBusy}>Save product fit</Button>
              </form>
            ) : null}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="evidence" active={activeTab === "evidence"}>
          <RelationshipSection title="Research" description="Notes, sources, and confidence about this business.">
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
              <p className="ry-buyer-empty-note">No research recorded yet.</p>
            )}
            {canWrite ? (
              <form className="ry-buyer-evidence-form ry-buyer-form-compact ry-buyer-workspace-form" onSubmit={(event) => void addEvidence(event)}>
                <div className="ry-buyer-form-grid">
                  <Field label="Research note" className="ry-buyer-form-span">
                    <Input controlSize="compact" required value={claim} onChange={(event) => setClaim(event.target.value)} placeholder="What you learned about this business" />
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
                      {businessResearchConfidenceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                  </Field>
                </div>
                <Button type="submit" variant="secondary" size="compact" loading={evidenceBusy}>Add research note</Button>
              </form>
            ) : null}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="qualification" active={activeTab === "qualification"}>
          <div className="ry-buyer-review">
            <RelationshipSection title="Business updates">
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
                <p className="ry-buyer-empty-note">No observations recorded.</p>
              )}
              {canWrite ? (
                <form className="ry-buyer-observation-form ry-buyer-form-compact ry-buyer-workspace-form" onSubmit={(event) => void addObservation(event)}>
                  <div className="ry-buyer-form-grid">
                    <Field label="Metric">
                      <Input controlSize="compact" required value={observationMetric} onChange={(event) => setObservationMetric(event.target.value)} placeholder="What changed" />
                    </Field>
                    <Field label="Value">
                      <Input controlSize="compact" required value={observationValue} onChange={(event) => setObservationValue(event.target.value)} placeholder="Observed value" />
                    </Field>
                  </div>
                  <Button type="submit" variant="secondary" size="compact" loading={observationBusy}>Save update</Button>
                </form>
              ) : null}
            </RelationshipSection>
            <RelationshipSection title="Qualification review" description="Decide whether this business is ready to advance.">
              <p className="ry-buyer-review-status">
                Current stage: {qualificationLabel}
                <span aria-hidden="true"> · </span>
                Next stage: {businessQualificationLabel({ qualificationStatus: nextStatus })}
              </p>
              <form className="ry-buyer-decision-form ry-buyer-form-compact ry-buyer-workspace-form" onSubmit={(event) => void decide(event)}>
                <div className="ry-buyer-form-grid">
                  <Field label="Review outcome" className="ry-buyer-form-span">
                    <Input controlSize="compact" required value={decisionOutcome} onChange={(event) => setDecisionOutcome(event.target.value)} disabled={!canWrite} placeholder="Review outcome" />
                  </Field>
                  <Field label="Next stage">
                    <Select controlSize="compact" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} disabled={!canWrite}>
                      {["researching", "conditional", "qualified", "rejected"].map((item) => (
                        <option key={item} value={item}>{businessQualificationLabel({ qualificationStatus: item })}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Rationale" className="ry-buyer-form-span">
                    <Input controlSize="compact" required value={decisionRationale} onChange={(event) => setDecisionRationale(event.target.value)} disabled={!canWrite} placeholder="Why this review outcome" />
                  </Field>
                  {nextStatus !== "rejected" ? (
                    <Field label="Next action" className="ry-buyer-form-span">
                      <Input controlSize="compact" required value={nextAction} onChange={(event) => setNextAction(event.target.value)} disabled={!canWrite} placeholder="What happens next" />
                    </Field>
                  ) : null}
                </div>
                <Button type="submit" size="compact" loading={decisionBusy} disabled={!canWrite}>Save review</Button>
              </form>
            </RelationshipSection>
            {risks.length ? (
              <RelationshipSection title="Open risks">
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

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Activity">
            <ActivityTimeline entries={activityEntries} empty="No business activity has been recorded." label={`${businessDisplayName} activity timeline`} />
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>
    </div>
  );
}
