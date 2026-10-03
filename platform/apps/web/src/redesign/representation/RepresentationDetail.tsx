import { useCallback, useEffect, useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  ActivityTimeline,
  Alert,
  AuthorityIndicator,
  Button,
  Drawer,
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
import { brandNameTitle, channelsLabel, dateTime, displayBrandName, displayProductName, opportunityStages, readable, shown, stageDisplayLabel, territoryLabel, type Row } from "./utils";

const AGREEMENT_MAX_BYTES = 20 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

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
  const location = useLocation();
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
  const [stageOpen, setStageOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (location.hash !== "#assign-next-action" || !detail || !canWrite) return;
    setStage(shown(detail.opportunity.stage, "identified"));
    setStageOpen(true);
    const timer = window.setTimeout(() => {
      const field = document.getElementById("representation-next-action");
      if (!(field instanceof HTMLSelectElement)) return;
      field.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [location.hash, detail, canWrite]);

  function acceptAgreementFile(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    const name = next.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setError("Use a PDF or DOCX agreement file.");
      setFile(null);
      return;
    }
    if (next.size > AGREEMENT_MAX_BYTES) {
      setError(`Agreement files must be ${formatFileSize(AGREEMENT_MAX_BYTES)} or smaller.`);
      setFile(null);
      return;
    }
    setError("");
    setFile(next);
  }

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
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load({ silent: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The agreement could not be uploaded.");
    } finally {
      setSaving(false);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!canWrite || saving) return;
    setDragActive(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (!canWrite || saving) return;
    acceptAgreementFile(event.dataTransfer.files?.[0] ?? null);
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
      setReason("");
      setStageOpen(false);
      await load({ silent: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stage could not be changed.");
    } finally { setSaving(false); }
  }

  function openStageChange() {
    setError("");
    if (detail) setStage(shown(detail.opportunity.stage, "identified"));
    setStageOpen(true);
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

  const brandName = displayBrandName(detail.opportunity.brandName, "Representation review");
  const brandTitle = brandNameTitle(detail.opportunity.brandName);
  const brandId = shown(detail.opportunity.brandId);
  const currentStage = shown(detail.opportunity.stage, "identified");
  const issuedDecisions = context?.decisions.filter((item) => item.status === "issued") ?? [];
  const openTasks = context?.tasks.filter((item) => !["completed", "canceled"].includes(String(item.status))) ?? [];
  const events = detail.events ?? [];
  const documents = detail.documents ?? [];
  const products = detail.products ?? [];

  const tabs: RelationshipTab[] = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Agreement", count: documents.length },
    { id: "scope", label: "Scope" },
    { id: "activity", label: "History", count: events.length }
  ];

  const activityEntries = events.map((item, index) => ({
    id: `${shown(item.occurredAt)}-${index}`,
    title: `${readable(shown(item.fromStage, "none"))} → ${readable(shown(item.toStage))}`,
    description: shown(item.reason, "No stage rationale recorded."),
    meta: dateTime(item.occurredAt),
    status: <StatusLabel value={shown(item.toStage)} />
  }));

  const primaryAction = canWrite
    ? <Button onClick={openStageChange}>Change stage</Button>
    : <Button disabled>Read-only access</Button>;

  const missingTermsLabel = (() => {
    const value = detail.opportunity.missingTerms;
    if (Array.isArray(value)) {
      const labels = value.map((item) => String(item).trim()).filter(Boolean);
      return labels.length ? labels.join(", ") : "None recorded";
    }
    const text = shown(value, "").trim();
    return text && text !== "—" ? text : "None recorded";
  })();

  const contextContent = (
    <div className="ry-representation-status-panel">
      <dl className="ry-representation-status-list">
        <div>
          <dt>Stage</dt>
          <dd>
            <span className={`ry-representation-status-mark ry-representation-status-mark-${currentStage}`} aria-hidden="true" />
            <span>{stageDisplayLabel(currentStage)}</span>
          </dd>
        </div>
        <div>
          <dt>Authority</dt>
          <dd>
            <span className="ry-representation-status-mark is-warning" aria-hidden="true" />
            <span>Not established</span>
          </dd>
        </div>
        <div>
          <dt>Next action</dt>
          <dd>
            <span className={`ry-representation-status-mark${shown(detail.opportunity.nextAction, "").trim() ? " is-ready" : ""}`} aria-hidden="true" />
            <span>{shown(detail.opportunity.nextAction, "Not assigned")}</span>
          </dd>
        </div>
        <div>
          <dt>Missing terms</dt>
          <dd>
            <span className={`ry-representation-status-mark${missingTermsLabel === "None recorded" ? " is-ready" : " is-warning"}`} aria-hidden="true" />
            <span>{missingTermsLabel}</span>
          </dd>
        </div>
      </dl>
      <details className="ry-representation-status-why">
        <summary>Authority is established only after an agreement is reviewed and approved.</summary>
        <p>An uploaded original never establishes representation authority on its own. Only an active agreement, reviewed and approved through exact-artifact review, does.</p>
      </details>
    </div>
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
        relationship={`${products.length === 1 ? "1 product" : `${products.length} products`} · ${
          documents.length === 0
            ? "No original agreement uploaded"
            : documents.length === 1
              ? "1 original agreement uploaded"
              : `${documents.length} original agreements uploaded`
        }`}
        warning={currentStage === "rejected" ? <Alert tone="danger" title="Opportunity rejected">This Representation Opportunity is closed.</Alert> : undefined}
        nextAction={(
          <span>
            {canWrite
              ? "Review scope, upload the agreement, and record the brand decision."
              : session?.access.reason ?? "Read-only inspection."}
          </span>
        )}
        actions={<>{primaryAction}<Link className="ry-button ry-button-secondary" to="/representation">Back to Representation</Link></>}
      />
      {error ? <ErrorState message={error} /> : null}
      {!canWrite ? <Alert tone="warning" title="Read-only Representation context">You may inspect permitted Representation context, but cannot upload originals, create an Agreement, or change stage in this session.</Alert> : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Representation relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={<ContextRail title="Representation status" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>{contextContent}</ContextRail>}>
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Representation overview" description="Review the proposed scope, agreement status, decisions, and next action.">
            <dl className="ry-relationship-facts ry-representation-overview-facts">
              <div><dt>Brand</dt><dd title={brandTitle}>{brandName}</dd></div>
              <div>
                <dt>Stage</dt>
                <dd>
                  <span className={`ry-representation-stage ry-representation-stage-${currentStage}`}>
                    {stageDisplayLabel(currentStage)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Products in scope</dt>
                <dd title={products.map((item) => shown(item.name)).join(", ") || undefined}>
                  {products.map((item) => displayProductName(item.name)).join(", ") || "None recorded"}
                </dd>
              </div>
              <div><dt>Next action</dt><dd>{shown(detail.opportunity.nextAction, "Not assigned")}</dd></div>
            </dl>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="documents" active={activeTab === "documents"}>
          <RelationshipSection
            title="Representation agreement"
            description="Uploading does not create authority. The file stays quarantined until scanning marks it clean."
          >
            <AuthorityIndicator
              value="not_established"
              rationale="Uploading an agreement does not activate representation authority. It must still be reviewed and approved."
            />
            {canWrite ? (
              <div className="ry-representation-upload">
                <div
                  className={`ry-representation-dropzone${dragActive ? " is-active" : ""}${file ? " has-file" : ""}`}
                  onDragEnter={onDragOver}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => {
                    if (!canWrite || saving) return;
                    fileInputRef.current?.click();
                  }}
                >
                  <input
                    ref={fileInputRef}
                    className="ry-representation-dropzone-input"
                    aria-label="Representation agreement"
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    disabled={saving}
                    onChange={(event) => acceptAgreementFile(event.target.files?.[0] ?? null)}
                  />
                  <p className="ry-representation-dropzone-title">Drag and drop the signed agreement here</p>
                  <p className="ry-representation-dropzone-meta">PDF or DOCX · Maximum file size {formatFileSize(AGREEMENT_MAX_BYTES)}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    disabled={saving}
                    onClick={(event) => {
                      event.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    Browse files
                  </Button>
                </div>
                <div className="ry-representation-upload-status" aria-live="polite">
                  {saving ? (
                    <span>Uploading agreement…</span>
                  ) : file ? (
                    <>
                      <span>Ready to upload · {file.name} · {formatFileSize(file.size)}</span>
                      <Button type="button" size="compact" disabled={saving} onClick={() => void upload()}>
                        Upload agreement
                      </Button>
                    </>
                  ) : (
                    <span>No file selected yet.</span>
                  )}
                </div>
              </div>
            ) : null}
            {documents.length === 0 ? (
              <EmptyState compact description="No agreement uploaded yet." />
            ) : (
              <ul className="ry-relationship-evidence-list">
                {documents.map((item) => (
                  <li key={item.id}>
                    <strong title={shown(item.name)}>{shown(item.name)}</strong>
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
          <RelationshipSection
            title="Proposed scope"
            description="Proposed scope guides diligence. It becomes written agreement scope only after an agreement is approved."
          >
            <dl className="ry-relationship-facts ry-representation-scope-facts">
              <div>
                <dt>Products in scope</dt>
                <dd title={products.map((item) => shown(item.name)).join(", ") || undefined}>
                  {products.map((item) => displayProductName(item.name)).join(", ") || "None recorded"}
                </dd>
              </div>
              <div>
                <dt>Sales channels</dt>
                <dd>{channelsLabel(detail.opportunity.proposedChannels)}</dd>
              </div>
              <div>
                <dt>Territory</dt>
                <dd>{territoryLabel(detail.opportunity.proposedTerritory)}</dd>
              </div>
              <div>
                <dt>Terms still needed</dt>
                <dd>
                  {Array.isArray(detail.opportunity.missingTerms)
                    ? (detail.opportunity.missingTerms.map((item) => String(item).trim()).filter(Boolean).join(", ") || "None recorded")
                    : shown(detail.opportunity.missingTerms, "None recorded")}
                </dd>
              </div>
              <div className="ry-representation-scope-goals">
                <dt>Opportunity goals</dt>
                <dd>{shown(detail.opportunity.brandObjectives, "None recorded")}</dd>
              </div>
            </dl>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection
            title="Stage history"
            {...(activityEntries.length ? { description: "Newest stage updates appear first." } : {})}
            {...(!activityEntries.length ? { className: "ry-representation-history-empty" } : {})}
          >
            {activityEntries.length === 0 ? (
              <EmptyState
                compact
                title="No stage changes yet"
                description="Stage updates and decisions will appear here once recorded."
              />
            ) : (
              <ActivityTimeline entries={activityEntries} label={`${brandName} stage history`} />
            )}
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>

      <StickyMobileAction>
        {primaryAction}
      </StickyMobileAction>

      <Drawer
        open={stageOpen}
        size="narrow"
        className="ry-representation-stage-drawer"
        title="Change stage"
        description="Confirm the decision, next action, and reason for this stage change."
        onClose={() => setStageOpen(false)}
      >
        <form id="assign-next-action" className="ry-representation-stage-form" onSubmit={(event) => void transition(event)}>
          <p className="ry-representation-stage-current">
            Current stage: <strong>{stageDisplayLabel(currentStage)}</strong>
          </p>
          <Field label="New stage">
            <Select value={stage} onChange={(event) => setStage(event.target.value)} disabled={!canWrite}>
              {opportunityStages.map((item) => <option key={item} value={item}>{stageDisplayLabel(item)}</option>)}
            </Select>
          </Field>
          <div className="ry-representation-stage-related">
            <Field label="Brand decision">
              <Select
                required
                value={decisionId}
                onChange={(event) => setDecisionId(event.target.value)}
                disabled={!canWrite || issuedDecisions.length === 0}
              >
                <option value="">{issuedDecisions.length === 0 ? "No issued decisions" : "Select decision"}</option>
                {issuedDecisions.map((item) => (
                  <option key={item.id} value={String(item.id)}>{shown(item.outcome)}</option>
                ))}
              </Select>
            </Field>
            {issuedDecisions.length === 0 && brandId ? (
              <p className="ry-representation-stage-field-hint">
                Add a brand decision in qualification first, then return here.{" "}
                <Link className="ry-representation-stage-field-hint-link" to={`/brands/${brandId}`}>
                  Open brand
                </Link>
              </p>
            ) : null}
            <Field label="Next action">
              <Select
                id="representation-next-action"
                required={stage !== "rejected"}
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
                disabled={!canWrite || (openTasks.length === 0 && stage !== "rejected")}
              >
                <option value="">{openTasks.length === 0 ? "No open tasks" : "Select next action"}</option>
                {openTasks.map((item) => (
                  <option key={item.id} value={String(item.id)}>{shown(item.title)}</option>
                ))}
              </Select>
            </Field>
            {openTasks.length === 0 && stage !== "rejected" ? (
              <p className="ry-representation-stage-field-hint">
                Add a task for this brand first, then return here.{" "}
                <Link className="ry-representation-stage-field-hint-link" to="/tasks">
                  Open tasks
                </Link>
                {brandId ? (
                  <>
                    {" · "}
                    <Link className="ry-representation-stage-field-hint-link" to={`/brands/${brandId}`}>
                      Open brand
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <Field label="Reason for change">
            <TextArea
              required
              rows={3}
              placeholder="Briefly explain why the stage is changing."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={!canWrite}
            />
          </Field>
          <div className="ry-representation-stage-actions">
            <Button type="button" variant="tertiary" size="compact" disabled={saving} onClick={() => setStageOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="compact" loading={saving} disabled={!canWrite}>Save stage change</Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
