import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  ActivityTimeline,
  Alert,
  AuthorityIndicator,
  Button,
  EmptyState,
  ErrorState,
  Field,
  IdentityHeader,
  LoadingState,
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
import { dateTime, opportunityStages, readable, shown, type Row } from "./utils";

type RecordContext = {
  record: Row;
  related: Row[];
  decisions: Row[];
  tasks: Row[];
};

type OpportunityDetail = {
  opportunity: Row;
  products: Row[];
  events: Row[];
  documents: Row[];
};

export function RepresentationDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const tabBaseId = `representation-${useId().replaceAll(":", "")}`;
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [context, setContext] = useState<RecordContext | null>(null);
  const [stage, setStage] = useState("reviewing_terms");
  const [reason, setReason] = useState("");
  const [decisionId, setDecisionId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [contextOpen, setContextOpen] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setError("");
    try {
      const value = await api<OpportunityDetail>(`/api/representation/opportunities/${id}`);
      setDetail(value);
      const brandContext = await api<RecordContext>(`/api/records/brand/${shown(value.opportunity.brandId)}`);
      setContext(brandContext);
      setDecisionId(String(brandContext.decisions.find((item) => item.status === "issued")?.id ?? ""));
      setTaskId(String(brandContext.tasks.find((item) => !["completed", "canceled"].includes(String(item.status)))?.id ?? ""));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Opportunity could not be loaded.");
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function upload() {
    if (!file || !detail || !canWrite) return;
    setSaving(true);
    setError("");
    try {
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))]
        .map((value) => value.toString(16).padStart(2, "0")).join("");
      const created = await api<{ document: Row; upload: { url: string } }>("/api/documents", {
        method: "POST",
        body: {
          subjectType: "representation_opportunity", subjectId: detail.opportunity.id,
          name: file.name, documentType: "representation_agreement_original",
          mediaType: file.type || "application/pdf", byteSize: file.size, sha256: digest,
          confidentiality: "restricted"
        }
      });
      await api(created.upload.url, { method: "PUT", headers: { "content-type": file.type || "application/pdf" }, body: file });
      setFile(null);
      await load({ silent: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Agreement original could not be uploaded.");
    } finally {
      setSaving(false);
    }
  }

  async function transition(event: FormEvent) {
    event.preventDefault();
    if (!detail || !canWrite) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/representation/opportunities/${id}/stage`, {
        method: "POST",
        body: { version: detail.opportunity.version, toStage: stage, reason, decisionId, nextActionTaskId: stage === "rejected" ? null : taskId }
      });
      await load({ silent: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stage could not be changed.");
    } finally { setSaving(false); }
  }

  async function createAgreementFromOriginal(documentId: string) {
    if (!canWrite) return;
    setSaving(true);
    setError("");
    try {
      const result = await api<{ agreement: Row }>("/api/agreements", {
        method: "POST", body: { representationOpportunityId: id, sourceDocumentId: documentId }
      });
      void navigate(`/agreements/${result.agreement.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agreement could not be created.");
    } finally { setSaving(false); }
  }

  const loadingTrail = (
    <RelationshipTrail items={[
      { label: "Representation", to: "/representation" },
      { label: !detail && !error ? "Loading Representation Opportunity" : "Representation Opportunity unavailable" }
    ]} />
  );

  if (!detail && !error) {
    return (
      <div className="page ry-relationship-page ry-representation-page">
        {loadingTrail}
        <IdentityHeader eyebrow="Representation Opportunity" title="Loading Representation Opportunity" status={<StatusLabel value="loading" />} />
        <LoadingState label="Loading Representation Opportunity" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page ry-relationship-page ry-representation-page">
        {loadingTrail}
        <IdentityHeader eyebrow="Representation Opportunity" title="Representation Opportunity unavailable" />
        <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const brandName = shown(detail.opportunity.brandName, "Representation review");
  const currentStage = shown(detail.opportunity.stage, "identified");
  const events = detail.events ?? [];
  const documents = detail.documents ?? [];
  const products = detail.products ?? [];

  const tabs: RelationshipTab[] = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Agreements & Documents", count: documents.length },
    { id: "scope", label: "Scope" },
    { id: "activity", label: "Activity", count: events.length }
  ];

  const activityEntries = events.map((item, index) => ({
    id: `${shown(item.occurredAt)}-${index}`,
    title: `${readable(shown(item.fromStage, "none"))} → ${readable(shown(item.toStage))}`,
    description: shown(item.reason, "No stage rationale recorded."),
    meta: dateTime(item.occurredAt),
    status: <StatusLabel value={shown(item.toStage)} />
  }));

  const primaryAction = canWrite
    ? <Button onClick={() => { setError(""); setActiveTab("overview"); }}>Change stage</Button>
    : <Button disabled>Read-only access</Button>;

  const contextContent = (
    <>
      <div className="ry-context-item">
        <strong>Readiness</strong>
        <StatusLabel value={currentStage} />
        <small>Human decision required to change Representation stage.</small>
      </div>
      <div className="ry-context-item">
        <strong>Authority</strong>
        <AuthorityIndicator value="not_established" rationale="An uploaded original never establishes representation authority. Only an active Agreement, reviewed and human-approved through exact-artifact review, does." />
      </div>
      <div className="ry-context-item">
        <strong>Next action</strong>
        <p>{shown(detail.opportunity.nextAction, "No next action assigned.")}</p>
      </div>
      <div className="ry-context-item">
        <strong>Missing terms</strong>
        <p>{shown(detail.opportunity.missingTerms, "None recorded.")}</p>
      </div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-representation-page">
      <RelationshipTrail items={[
        { label: "Representation", to: "/representation" },
        { label: brandName }
      ]} />
      <IdentityHeader
        eyebrow="Representation Opportunity"
        title={brandName}
        relationship={(
          <span className="ry-relationship-identity-meta">
            <span>{readable(currentStage)}</span>
            <span>{products.length} Product{products.length === 1 ? "" : "s"}</span>
            <span>{documents.length} original document{documents.length === 1 ? "" : "s"}</span>
          </span>
        )}
        status={<StatusLabel value={currentStage} />}
        warning={currentStage === "rejected" ? <Alert tone="danger" title="Opportunity rejected">This Representation Opportunity is closed.</Alert> : undefined}
        nextAction={<span>{canWrite ? "Review scope, upload the original, and record a human-owned stage change when ready." : session?.access.reason ?? "Read-only Representation inspection."}</span>}
        actions={<>{primaryAction}<Link className="ry-button ry-button-secondary" to="/representation">Back to register</Link></>}
      />
      {error ? <ErrorState message={error} /> : null}
      {!canWrite ? <Alert tone="warning" title="Read-only Representation context">You may inspect permitted Representation context, but cannot upload originals, create an Agreement, or change stage in this session.</Alert> : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Representation relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={<ContextRail title="Representation context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>{contextContent}</ContextRail>}>
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Connected authority record" description="Written terms, original documents, decisions, and next actions remain connected and auditable.">
            <dl className="ry-relationship-facts">
              <div><dt>Brand</dt><dd>{brandName}</dd></div>
              <div><dt>Stage</dt><dd><StatusLabel value={currentStage} /></dd></div>
              <div><dt>Products</dt><dd>{products.map((item) => item.name).join(", ") || "None recorded"}</dd></div>
              <div><dt>Next action</dt><dd>{shown(detail.opportunity.nextAction, "Not assigned")}</dd></div>
            </dl>
          </RelationshipSection>
          <RelationshipSection title="Change stage" description="The server rechecks the human Brand decision, next action, and version before changing stage.">
            <form className="ry-representation-stage-form" onSubmit={(event) => void transition(event)}>
              <Field label="Stage">
                <Select value={stage} onChange={(event) => setStage(event.target.value)} disabled={!canWrite}>
                  {opportunityStages.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
                </Select>
              </Field>
              <Field label="Human decision">
                <Select required value={decisionId} onChange={(event) => setDecisionId(event.target.value)} disabled={!canWrite}>
                  <option value="">Select</option>
                  {context?.decisions.filter((item) => item.status === "issued").map((item) => <option key={item.id} value={String(item.id)}>{shown(item.outcome)}</option>)}
                </Select>
              </Field>
              <Field label="Next action">
                <Select required={stage !== "rejected"} value={taskId} onChange={(event) => setTaskId(event.target.value)} disabled={!canWrite}>
                  <option value="">Select</option>
                  {context?.tasks.filter((item) => !["completed", "canceled"].includes(String(item.status))).map((item) => <option key={item.id} value={String(item.id)}>{shown(item.title)}</option>)}
                </Select>
              </Field>
              <Field label="Reason"><TextArea required value={reason} onChange={(event) => setReason(event.target.value)} disabled={!canWrite} /></Field>
              <Button type="submit" loading={saving} disabled={!canWrite}>Record stage</Button>
            </form>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="documents" active={activeTab === "documents"}>
          <RelationshipSection title="Agreement original" description="Uploading does not create authority. The original remains quarantined until the configured scanner marks it clean.">
            <AuthorityIndicator value="not_established" rationale="An uploaded or scanned-clean document is never active representation authority by itself." />
            {canWrite ? (
              <div className="ry-representation-upload-row">
                <input aria-label="Agreement original" type="file" accept=".pdf,.docx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                <Button variant="secondary" disabled={!file || saving} onClick={() => void upload()}>Upload original</Button>
              </div>
            ) : null}
            {documents.length === 0 ? (
              <EmptyState compact description="No original document has been uploaded." />
            ) : (
              <ul className="ry-relationship-evidence-list">
                {documents.map((item) => (
                  <li key={item.id}>
                    <strong>{shown(item.name)}</strong>
                    <small>{shown(item.sha256)}</small>
                    <StatusLabel value={`${shown(item.status)}_${shown(item.scanStatus)}`} />
                    {item.status === "active" && item.scanStatus === "clean" && canWrite ? (
                      <Button variant="tertiary" disabled={saving} onClick={() => void createAgreementFromOriginal(item.id)}>Create Agreement</Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="scope" active={activeTab === "scope"}>
          <RelationshipSection title="Proposed scope" description="Proposed scope guides diligence. It is not a written Agreement scope until an Agreement exists and is approved.">
            <dl className="ry-relationship-facts">
              <div><dt>Products</dt><dd>{products.map((item) => item.name).join(", ") || "None recorded"}</dd></div>
              <div><dt>Channels</dt><dd>{shown(detail.opportunity.proposedChannels)}</dd></div>
              <div><dt>Territory</dt><dd>{JSON.stringify(detail.opportunity.proposedTerritory ?? {})}</dd></div>
              <div><dt>Missing terms</dt><dd>{shown(detail.opportunity.missingTerms)}</dd></div>
              <div><dt>Brand objectives</dt><dd>{shown(detail.opportunity.brandObjectives)}</dd></div>
            </dl>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Stage history" description="Stage changes in newest-first order, most recent first.">
            <ActivityTimeline entries={activityEntries} empty="No stage change has been recorded." label={`${brandName} activity timeline`} />
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <StickyMobileAction>
        {primaryAction}
      </StickyMobileAction>
    </div>
  );
}
