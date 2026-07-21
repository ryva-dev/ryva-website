import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiProblem } from "../api";
import { useAuth } from "../auth";
import { ErrorPanel, Field, Loading, PageHeader, StatusPill } from "../components";
import {
  AIRecommendation,
  Alert,
  ApprovalPanel,
  AuditHistory,
  AuthorityIndicator,
  Button,
  ConfirmationDialog,
  Drawer,
  ErrorState,
  EvidenceLabel,
  IdentityHeader,
  LoadingState,
  Radio,
  StatusLabel,
  TextArea
} from "../design-system";
import { useLoad } from "../hooks";
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
} from "../redesign/consequential/ConsequentialReview";
import { RelationshipTrail } from "../redesign/relationship/RelationshipDetail";

type Row = Record<string, unknown> & { id: string };
type AiStatus = {
  enabled: boolean;
  reason: string;
  provider: {
    provider: string;
    model: string;
    modelVersion: string;
    retentionMode: string;
    trainingAllowed: false;
    configured: boolean;
  };
  workspacePreferences: Record<string, unknown>;
  policyVersion: string;
  manualFallback: boolean;
  numericalScoring: false;
  autonomousActions: false;
};
type SuggestionDetail = {
  suggestion: Row;
  statements: Row[];
  sources: Row[];
  actions: Row[];
};

const useCases = [
  ["product_research","Product research summary"],
  ["brand_research","Brand research summary"],
  ["business_research","Business-buyer summary"],
  ["evidence_summary","Evidence summary"],
  ["missing_evidence","Missing-evidence review"],
  ["product_comparison","Product comparison explanation"],
  ["brand_comparison","Brand comparison explanation"],
  ["business_fit","Business-fit explanation"],
  ["outreach_personalization","Outreach personalization"],
  ["email_draft","Email draft"],
  ["follow_up_draft","Follow-up draft"],
  ["call_preparation","Call preparation"],
  ["objection_guidance","Objection-handling suggestions"],
  ["meeting_preparation","Meeting preparation"],
  ["pipeline_summary","Pipeline summary"],
  ["stalled_opportunity","Stalled-opportunity review"],
  ["reorder_review","Reorder review"],
  ["commission_explanation","Commission explanation"],
  ["agreement_summary","Agreement summary"],
  ["document_extraction","Document extraction candidates"],
  ["duplicate_detection","Duplicate explanation"],
  ["next_best_action","Next-best-action options"],
  ["weekly_briefing","Weekly priority briefing"],
  ["daily_briefing","Daily homepage briefing"],
  ["account_summary","Account relationship summary"],
  ["dispute_summary","Commission dispute summary"],
  ["relationship_closure","Relationship closure checklist"],
  ["contact_role","Contact-role verification steps"]
] as const;

const targetTypes = [
  "product","brand","business","contact","placement_opportunity",
  "representation_agreement","product_comparison","account","order","reorder",
  "commission","commission_dispute","document","workspace"
];

function shown(value: unknown, fallback = "—"): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function items(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function listOrEmpty(values: string[], empty: string) {
  return values.length
    ? <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul>
    : <p className="empty">{empty}</p>;
}

export function AiCopilotPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [useCase, setUseCase] = useState(search.get("useCase") ?? "next_best_action");
  const [targetType, setTargetType] = useState(search.get("targetType") ?? "workspace");
  const [targetId, setTargetId] = useState(search.get("targetId") ?? session?.user.workspaceId ?? "");
  const [instruction, setInstruction] = useState("");
  const [creating, setCreating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const status = useLoad(() => api<AiStatus>("/api/ai/status"), []);
  const suggestions = useLoad(
    () => api<{ suggestions: Row[] }>("/api/ai/suggestions?limit=100"),
    []
  );
  const canGenerate = status.data?.enabled &&
    status.data.provider.configured &&
    status.data.workspacePreferences.enabled === true;

  useEffect(() => {
    if (targetType === "workspace" && session?.user.workspaceId) {
      setTargetId(session.user.workspaceId);
    }
  }, [targetType, session?.user.workspaceId]);

  async function generate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setGenerationError("");
    try {
      const detail = await api<SuggestionDetail>("/api/ai/generate", {
        method: "POST",
        body: { useCase, targetType, targetId, instruction }
      });
      void navigate(`/copilot/${detail.suggestion.id}`);
    } catch (caught) {
      setGenerationError(
        caught instanceof Error ? caught.message : "AI assistance could not complete this request."
      );
    } finally {
      setCreating(false);
    }
  }

  return <div className="page">
    <PageHeader
      eyebrow="Evidence-first copilot"
      title="Responsible AI Assistance"
      description="Generate reviewable research, preparation, extraction, explanation, and next-action suggestions. Ryva AI cannot send, approve, negotiate, score, or change a consequential record."
    />
    {status.loading ? <Loading label="Checking AI policy and provider" /> : null}
    {status.error ? <ErrorPanel message={status.error} /> : null}
    {status.data ? <section className="ai-policy-banner" aria-label="AI operating boundary">
      <div><strong>{canGenerate ? "AI assistance available" : "Manual workflow available"}</strong>
        <p>{canGenerate
          ? `${status.data.provider.provider} · ${status.data.provider.model} · ${status.data.provider.retentionMode.replaceAll("_", " ")}`
          : status.data.workspacePreferences.enabled !== true
            ? "AI is off for this workspace. Existing records and manual workflows remain fully usable."
            : "The provider is unavailable or generation is disabled. No target record is affected."}</p>
      </div>
      {!canGenerate && status.data.workspacePreferences.enabled !== true
        ? <Link className="secondary-button" to="/settings">Review AI preferences</Link>
        : null}
      <span className="quiet-tag">No training · no tools · no hidden scores</span>
    </section> : null}
    {generationError ? <ErrorPanel message={generationError} /> : null}
    <section className="panel">
      <div className="section-heading"><div><p className="eyebrow">New suggestion</p><h2>Choose one bounded purpose</h2></div></div>
      <form className="form-grid" onSubmit={(event) => void generate(event)}>
        <Field label="AI assistance type"><select value={useCase} onChange={(event) => setUseCase(event.target.value)}>
          {useCases.map(([value,label]) => <option value={value} key={value}>{label}</option>)}
        </select></Field>
        <Field label="Supporting record type"><select value={targetType} onChange={(event) => setTargetType(event.target.value)}>
          {targetTypes.map((value) => <option value={value} key={value}>{value.replaceAll("_", " ")}</option>)}
        </select></Field>
        <Field label="Supporting record ID" hint="Ryva packages only authorized records and evidence from this workspace.">
          <input required value={targetId} onChange={(event) => setTargetId(event.target.value)} />
        </Field>
        <Field label="Optional review instruction" hint="Instructions cannot override Ryva policy or grant tools.">
          <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)}
            placeholder="Focus the explanation on known evidence, contrary evidence, and the next human review." />
        </Field>
        <div className="form-actions">
          <button className="primary-button" disabled={!canGenerate || creating}>
            {creating ? "Generating reviewable suggestion…" : "Generate suggestion"}
          </button>
        </div>
      </form>
    </section>
    <section className="panel">
      <div className="section-heading"><div><p className="eyebrow">Review history</p><h2>Suggestions and human dispositions</h2></div></div>
      {suggestions.loading ? <Loading label="Loading suggestion history" /> : null}
      {suggestions.error ? <ErrorPanel message={suggestions.error} /> : null}
      {suggestions.data?.suggestions.length
        ? <div className="record-list">{suggestions.data.suggestions.map((item) =>
          <Link className="list-row" to={`/copilot/${item.id}`} key={item.id}>
            <span><strong>{shown(item.title)}</strong>
              <small>{shown(item.suggestionType).replaceAll("_", " ")} · {shown(item.targetType).replaceAll("_", " ")} · {new Date(shown(item.generatedAt)).toLocaleString()}</small>
            </span>
            <span className="status-cluster"><StatusPill value={shown(item.confidence)} /><StatusPill value={shown(item.status)} /></span>
          </Link>)}</div>
        : <p className="empty">No AI suggestions yet. Manual research and record workflows remain available.</p>}
    </section>
  </div>;
}

export function AiSuggestionPage() {
  const { suggestionId = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const detail = useLoad(
    () => api<SuggestionDetail>(`/api/ai/suggestions/${suggestionId}`),
    [suggestionId]
  );
  const [draft, setDraft] = useState("");
  const [reason, setReason] = useState("");
  const [instruction, setInstruction] = useState("");
  const [decision, setDecision] = useState<"accepted" | "edited" | "rejected" | "">("");
  const [feedbackAction, setFeedbackAction] = useState<"feedback" | "reported_problem">("feedback");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [regenerationOpen, setRegenerationOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Row | null>(null);
  const initializedSuggestion = useRef("");
  const submissionGuard = useRef(false);
  useEffect(() => {
    if (detail.data && initializedSuggestion.current !== suggestionId) {
      initializedSuggestion.current = suggestionId;
      setDraft(shown(detail.data.suggestion.currentContent, ""));
    }
  }, [detail.data, suggestionId]);

  useEffect(() => {
    if (actionError) document.querySelector<HTMLElement>("[data-review-error]")?.focus();
  }, [actionError]);

  async function act(action: "accepted" | "edited" | "rejected" | "feedback" | "reported_problem") {
    if (!detail.data || !canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      const updated = await api<SuggestionDetail>(
        `/api/ai/suggestions/${suggestionId}/actions`,
        {
          method: "POST",
          body: {
            version: Number(detail.data.suggestion.version),
            action,
            finalContent: action === "edited" ? draft : null,
            reasonCategory: reason || null,
            note: reason,
            selectedFields: []
          }
        }
      );
      detail.setData(updated);
      setConfirmationOpen(false);
      setFeedbackOpen(false);
      setDecision("");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Review action could not be recorded.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
      setConfirmationOpen(false);
      setFeedbackOpen(false);
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  async function regenerate() {
    if (!instruction.trim() || !canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    try {
      const regenerated = await api<SuggestionDetail>(
        `/api/ai/suggestions/${suggestionId}/regenerate`,
        { method: "POST", body: { instruction } }
      );
      void navigate(`/copilot/${regenerated.suggestion.id}`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Suggestion could not be regenerated.");
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  const loadingTrail = <RelationshipTrail items={[{ label: "AI Copilot", to: "/copilot" }, { label: detail.loading ? "Loading suggestion" : "Suggestion unavailable" }]} />;
  if (detail.loading) return <div className="page ry-consequential-page">{loadingTrail}<IdentityHeader eyebrow="Consequential review · AI-assisted" title="Loading suggestion" status={<StatusLabel value="loading" />} /><LoadingState label="Loading exact AI artifact and review context" /></div>;
  if (detail.error || !detail.data) return <div className="page ry-consequential-page">{loadingTrail}<IdentityHeader eyebrow="Consequential review · AI-assisted" title="Suggestion unavailable" /><ErrorState message={detail.error || "Suggestion not found."} action={<Button variant="secondary" onClick={() => void detail.reload()}>Try again</Button>} /></div>;
  const { suggestion, statements, sources, actions } = detail.data;
  const extraction = suggestion.structuredPayload as Record<string, unknown> | undefined;
  const fieldCandidates = Array.isArray(extraction?.fieldCandidates)
    ? extraction.fieldCandidates as Array<Record<string, unknown>>
    : [];
  const status = shown(suggestion.status);
  const final = ["accepted","rejected","expired"].includes(status);
  const currentContent = shown(suggestion.currentContent, "");
  const edited = draft !== currentContent;
  const unsupportedStatements = statements.filter((statement) => !Array.isArray(statement.citations) || statement.citations.length === 0);
  const targetType = shown(suggestion.targetType);
  const targetId = shown(suggestion.targetId);
  const targetRoute: Record<string, string> = {
    product: `/products/${targetId}`, brand: `/brands/${targetId}`, business: `/buyers/${targetId}`,
    contact: `/contacts/${targetId}`, placement_opportunity: `/placements/${targetId}`,
    representation_agreement: `/agreements/${targetId}`, product_comparison: `/products/comparisons/${targetId}`,
    account: `/accounts/${targetId}`, order: `/orders/${targetId}`, reorder: "/reorders",
    commission: `/commissions/${targetId}`, commission_dispute: `/commission-disputes/${targetId}`,
    document: "/documents"
  };
  const selectedExactContent = decision === "edited" ? draft : currentContent;
  const readinessState: ReviewReadiness = conflict ? "stale" : !canWrite ? "restricted" : final ? "completed" : "requires_review";
  const blockers = [
    ...(conflict ? ["The server reported that this version changed. Reload before another disposition."] : []),
    ...(!canWrite ? [session?.access.reason ?? "This session cannot record a disposition."] : []),
    ...(final ? ["A final human disposition already exists. Only feedback or problem reporting remains available."] : []),
    ...(unsupportedStatements.length ? [`${unsupportedStatements.length} material statement${unsupportedStatements.length === 1 ? " has" : "s have"} no supporting citation and must remain Unknown.`] : []),
    ...(items(suggestion.missingEvidence).length ? ["The suggestion declares missing evidence that must not be treated as negative evidence."] : [])
  ];
  const validationChecks: ValidationCheck[] = [
    { id: "artifact", label: "Exact artifact", detail: currentContent ? `Stored suggestion version ${shown(suggestion.version)} is visible.` : "No stored content is available.", state: currentContent ? "passed" : "failed" },
    { id: "citations", label: "Statement citations", detail: unsupportedStatements.length ? `${unsupportedStatements.length} statement(s) have no citation and remain Unknown.` : "Every material statement has at least one stored citation.", state: unsupportedStatements.length ? "requires_review" : "passed" },
    { id: "limitations", label: "Known gaps", detail: `${items(suggestion.missingEvidence).length} missing-evidence item(s), ${items(suggestion.limitations).length} limitation(s), and ${items(suggestion.contraryEvidence).length} contrary-evidence item(s) are disclosed.`, state: items(suggestion.missingEvidence).length || items(suggestion.limitations).length ? "requires_review" : "passed" },
    { id: "authority", label: "Authority", detail: "This suggestion and its validation do not establish authority or permit any target action.", state: "requires_review" },
    { id: "version", label: "Current loaded version", detail: conflict ? "The server rejected this loaded version as stale." : `Version ${shown(suggestion.version)} is the version that will be submitted.`, state: conflict ? "failed" : "passed" }
  ];
  const auditEntries = actions.map((action) => ({
    id: action.id,
    action: shown(action.action).replaceAll("_", " "),
    actor: `actor ${shown(action.actorUserId)}`,
    outcome: <StatusLabel value={shown(action.action)} />,
    timestamp: new Date(shown(action.createdAt)).toLocaleString(),
    detail: shown(action.note, "No rationale recorded")
  }));
  const latestFinal = [...actions].reverse().find((action) => ["accepted","rejected"].includes(shown(action.action)));

  function openConfirmation() {
    if (!decision || !reason.trim() || final || !canWrite) return;
    setActionError("");
    setConfirmationOpen(true);
  }

  return <div className="page ry-consequential-page">
    <RelationshipTrail items={[{ label: "AI Copilot", to: "/copilot" }, { label: shown(suggestion.title) }]} />
    <IdentityHeader
      eyebrow="Consequential review · AI-assisted"
      title={shown(suggestion.title)}
      relationship={<span className="ry-relationship-identity-meta"><span>{shown(suggestion.suggestionType).replaceAll("_", " ")}</span>{targetRoute[targetType] ? <Link to={targetRoute[targetType]}>{targetType.replaceAll("_", " ")} · {targetId}</Link> : <span>{targetType.replaceAll("_", " ")} · {targetId}</span>}<span>Version {shown(suggestion.version)}</span></span>}
      status={<StatusLabel value={status} />}
      warning={<AIRecommendation title="AI-originated artifact" status={status} limitations={<span><strong>No provider training, tools, or external actions.</strong> AI cannot approve, execute, contact, negotiate, qualify, score, or establish authority.</span>}><span>Generated by {shown(suggestion.provider)} · {shown(suggestion.model)} · {shown(suggestion.modelVersion)} under {shown(suggestion.policyVersion)}.</span></AIRecommendation>}
      nextAction={<span>{final ? "Inspect the recorded disposition and immutable history." : !canWrite ? "Review the permitted evidence and history in read-only mode." : "Review the exact stored artifact, evidence gaps, and consequence before choosing a human disposition."}</span>}
      actions={<Button variant="secondary" onClick={() => void navigate("/copilot")}>All suggestions</Button>}
    />
    {actionError ? <ReviewErrorSummary message={actionError} conflict={conflict} onReload={() => { void detail.reload(); setConflict(false); setActionError(""); }} /> : null}
    {!canWrite ? <Alert tone="warning" title="Read-only consequential review">The suggestion and permitted evidence remain inspectable, but this session cannot record a disposition, feedback, or revision.</Alert> : null}
    <ConsequentialReviewLayout readiness={<>
      <ReadinessSummary state={readinessState} description={<><span>No target state changed.</span> {final ? "The final human disposition is recorded." : "A qualified human must inspect the exact artifact and stored evidence before deciding."}</>} blockers={blockers} context={<dl className="ry-review-facts"><div><dt>Human decision owner</dt><dd>{session?.user.name ?? "Authorized workspace reviewer"}</dd></div><div><dt>Confidence subject</dt><dd>{shown(suggestion.confidenceSubject)}</dd></div><div><dt>Generated</dt><dd>{new Date(shown(suggestion.generatedAt)).toLocaleString()}</dd></div><div><dt>Freshness</dt><dd>{suggestion.completedAt ? new Date(shown(suggestion.completedAt)).toLocaleString() : "Completion time unavailable"}</dd></div></dl>} />
      <AuthorityIndicator value="not_established" rationale="Recommendation and validation never create authority." />
    </>}>
      {final ? <ReviewOutcome title="Human disposition recorded" status={status} consequence="The reviewed content status changed only. No target record, authority, outreach, placement, or financial state changed.">{latestFinal ? <p>{shown(latestFinal.note, "No rationale recorded")}</p> : null}</ReviewOutcome> : null}
      <ExactArtifact title="Stored suggestion artifact" description="This is the exact current stored content. Accepting reviews this version; saving an edit submits the exact revision shown in the decision input below." version={shown(suggestion.version)}>{currentContent}</ExactArtifact>
      <ValidationSummary checks={validationChecks} description="These checks explain the stored review package. They do not approve the suggestion or create authority." />
      <ReviewSection eyebrow="Evidence and classifications" title="Classification and citations" description="Every material statement remains visibly classified. Missing citations remain Unknown rather than becoming negative evidence.">
        <div className="ai-statement-list">{statements.map((statement) => {
        const citations = Array.isArray(statement.citations) ? statement.citations as Row[] : [];
        return <article key={statement.id}>
          <div className="record-heading"><strong>{shown(statement.statementText)}</strong>
            <EvidenceLabel value={shown(statement.classification)} confidence={shown(statement.confidence)} />
          </div>
          {citations.length ? <p>{citations.map((citation) =>
            <a href={`#source-${shown(citation.ordinal)}`} key={shown(citation.contextItemId)}>
              [{shown(citation.ordinal)}] {shown(citation.label)}
            </a>)}</p> : <p className="warning-text">No supporting citation. This statement is Unknown.</p>}
        </article>;
      })}</div></ReviewSection>
    {fieldCandidates.length ? <ReviewSection eyebrow="Uncommitted extraction" title="Field candidates requiring human review">
      <p>Nothing below has been applied to an Agreement, Order, protection record, Commission, or other material field.</p>
      <div className="record-list">{fieldCandidates.map((candidate, index) =>
        <article className="list-row" key={`${shown(candidate.field)}-${index}`}>
          <span><strong>{shown(candidate.field)}</strong><small>{shown(candidate.sourceLocation)} · human review required</small></span>
          <code>{shown(candidate.value)}</code>
        </article>)}</div>
    </ReviewSection> : null}
    <ReviewSection eyebrow="Known gaps" title="Missing, limiting, and contrary evidence">
      <div className="three-column-grid">
        <article><h3>Missing evidence</h3>{listOrEmpty(items(suggestion.missingEvidence), "No missing evidence was declared. Review sources before relying on that absence.")}</article>
        <article><h3>Known limitations</h3>{listOrEmpty(items(suggestion.limitations), "No limitations were returned; this does not imply certainty.")}</article>
        <article><h3>Contrary evidence</h3>{listOrEmpty(items(suggestion.contraryEvidence), "No contrary evidence was packaged. Confirm the evidence set is complete.")}</article>
      </div>
    </ReviewSection>
    <ReviewSection eyebrow="Supporting records used" title="Inspectable source package">
      {sources.length ? <div className="ai-source-list">{sources.map((source) =>
        <article id={`source-${shown(source.ordinal)}`} key={source.id}>
          <div className="record-heading"><span><strong>[{shown(source.ordinal)}] {shown(source.label)}</strong>
            <small>{shown(source.recordType).replaceAll("_", " ")} · {shown(source.recordId)}</small></span>
            <EvidenceLabel value={shown(source.evidenceClass)} freshness={source.freshnessAt ? `Freshness ${new Date(shown(source.freshnessAt)).toLocaleString()}` : "Freshness unknown"} />
          </div>
          <p>{shown(source.contentExcerpt)}</p>
          <p><strong>Source limitations:</strong> {shown(source.limitations, "None recorded")}</p>
          <Button variant="tertiary" onClick={() => setSelectedSource(source)}>Inspect evidence record</Button>
        </article>)}</div>
        : <p className="empty">No supporting records were available. Material claims must remain Unknown.</p>}
    </ReviewSection>
    {!final ? <ApprovalPanel
      title="Record the human disposition"
      readiness={<p>The stored artifact, version, evidence gaps, and no-target-change boundary remain visible above. No option is preselected.</p>}
      consequence={<p>Accepting or editing changes only this suggestion’s reviewed-content status. Rejecting records non-use. None of these actions executes the suggestion.</p>}
      rationale={<>
        <fieldset className="ry-consequence-radio-group"><legend>Human disposition</legend>
          <Radio name="ai-decision" value="accepted" checked={decision === "accepted"} onChange={() => setDecision("accepted")} label="Accept stored artifact" description={`Accept exact stored version ${shown(suggestion.version)} as reviewed content only.`} disabled={!canWrite || saving} />
          <Radio name="ai-decision" value="edited" checked={decision === "edited"} onChange={() => setDecision("edited")} label="Save human revision" description="Record the exact edited content below as the reviewed version." disabled={!canWrite || saving || !edited || !draft.trim()} />
          <Radio name="ai-decision" value="rejected" checked={decision === "rejected"} onChange={() => setDecision("rejected")} label="Reject suggestion" description="Record that this suggestion should not be used." disabled={!canWrite || saving} />
        </fieldset>
        <Field label="Exact human revision" hint="Used only when Save human revision is selected."><TextArea rows={7} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!canWrite || saving} /></Field>
        <Field label="Decision rationale" required hint="Explain why this exact artifact is accepted, revised, or rejected."><TextArea required rows={4} value={reason} onChange={(event) => setReason(event.target.value)} disabled={!canWrite || saving} /></Field>
      </>}
      actions={<><Button disabled={!canWrite || !decision || !reason.trim() || (decision === "edited" && (!edited || !draft.trim()))} onClick={openConfirmation}>Review final consequence</Button><Button variant="secondary" disabled={!canWrite || saving} onClick={() => setRegenerationOpen(true)}>Create revised suggestion</Button><Button variant="tertiary" disabled={!canWrite || saving} onClick={() => setFeedbackOpen(true)}>Feedback or problem</Button></>}
      processing={saving}
    /> : <ReviewSection title="Additional human feedback" description="A final disposition cannot be repeated, but the existing API permits feedback or problem reporting without changing it."><Button variant="secondary" disabled={!canWrite || saving} onClick={() => setFeedbackOpen(true)}>Record feedback or problem</Button></ReviewSection>}
    <ReviewSection eyebrow="Immutable review history" title="Disposition and feedback">
      <AuditHistory entries={auditEntries} label={`${shown(suggestion.title)} review history`} />
    </ReviewSection>
    </ConsequentialReviewLayout>

    <ConfirmationDialog open={confirmationOpen} title="Confirm human disposition" description={`You are reviewing suggestion version ${shown(suggestion.version)}. This cannot execute the suggestion or change its target.`} consequence={<><strong>{decision === "accepted" ? "Accept stored artifact as reviewed content" : decision === "edited" ? "Save the exact human revision as reviewed content" : "Reject this suggestion"}</strong><pre className="ry-confirmation-artifact">{selectedExactContent}</pre><p>Rationale: {reason}</p></>} confirmLabel={decision === "rejected" ? "Confirm rejection" : "Confirm reviewed content"} confirmVariant={decision === "rejected" ? "destructive" : "primary"} processing={saving} onClose={() => setConfirmationOpen(false)} onConfirm={() => { if (decision) void act(decision); }} />
    <Drawer open={Boolean(selectedSource)} title={selectedSource ? `[${shown(selectedSource.ordinal)}] ${shown(selectedSource.label)}` : "Evidence record"} description="Stored evidence context used by this suggestion; it does not independently approve the recommendation." onClose={() => setSelectedSource(null)} size="standard">
      {selectedSource ? <dl className="ry-review-facts"><div><dt>Record</dt><dd>{shown(selectedSource.recordType)} · {shown(selectedSource.recordId)}</dd></div><div><dt>Evidence class</dt><dd><EvidenceLabel value={shown(selectedSource.evidenceClass)} /></dd></div><div><dt>Freshness</dt><dd>{selectedSource.freshnessAt ? new Date(shown(selectedSource.freshnessAt)).toLocaleString() : "Unknown"}</dd></div><div><dt>Permitted use</dt><dd>{shown(selectedSource.permittedUse, "Not recorded")}</dd></div><div><dt>Content excerpt</dt><dd>{shown(selectedSource.contentExcerpt)}</dd></div><div><dt>Limitations</dt><dd>{shown(selectedSource.limitations, "None recorded")}</dd></div></dl> : null}
    </Drawer>
    <Drawer open={feedbackOpen} title="Record feedback or a problem" description="This records a human action without changing the final disposition or any target record." onClose={() => setFeedbackOpen(false)} size="narrow">
      <fieldset className="ry-consequence-radio-group"><legend>Feedback type</legend><Radio name="feedback-action" value="feedback" checked={feedbackAction === "feedback"} onChange={() => setFeedbackAction("feedback")} label="Feedback" description="Record review feedback." /><Radio name="feedback-action" value="reported_problem" checked={feedbackAction === "reported_problem"} onChange={() => setFeedbackAction("reported_problem")} label="Report problem" description="Flag a quality, evidence, or policy problem." /></fieldset>
      <Field label="Feedback note" required><TextArea required rows={5} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
      <Button loading={saving} disabled={!reason.trim()} onClick={() => void act(feedbackAction)}>Record human feedback</Button>
    </Drawer>
    <Drawer open={regenerationOpen} title="Create a revised child suggestion" description="The original artifact and review history remain immutable and visible." onClose={() => setRegenerationOpen(false)} size="narrow">
      <Field label="Revision instruction" required hint="Instructions cannot override Ryva policy or grant tools."><TextArea required rows={6} value={instruction} onChange={(event) => setInstruction(event.target.value)} /></Field>
      <Button loading={saving} disabled={!instruction.trim()} onClick={() => void regenerate()}>Generate child suggestion</Button>
    </Drawer>
  </div>;
}

export function AiBriefingPanel() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const status = useLoad(() => api<AiStatus>("/api/ai/status"), []);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState("");
  const available = useMemo(() => Boolean(
    status.data?.enabled &&
    status.data.provider.configured &&
    status.data.workspacePreferences.enabled === true
  ), [status.data]);

  async function generate(useCase: "daily_briefing" | "weekly_briefing") {
    if (!session) return;
    setCreating(useCase);
    setError("");
    try {
      const result = await api<SuggestionDetail>("/api/ai/generate", {
        method: "POST",
        body: {
          useCase,
          targetType: "workspace",
          targetId: session.user.workspaceId,
          instruction: "Prioritize trust, authority, commitments, Buyer value, and missing evidence. Do not rank by commission."
        }
      });
      void navigate(`/copilot/${result.suggestion.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Briefing could not be generated.");
    } finally {
      setCreating("");
    }
  }

  return <section className="panel">
    <div className="record-heading"><div><p className="eyebrow">Explainable briefing</p><h2>AI priority review</h2></div><Link to="/copilot">Copilot history</Link></div>
    <p>Briefings use current Ryva tasks, risks, opportunities, reorders, and commissions. They cannot create work, hide blockers, or elevate commission over fit and trust.</p>
    {error ? <ErrorPanel message={error} /> : null}
    {!available ? <p className="empty">AI briefing is unavailable or disabled. The deterministic Home actions above remain current and usable.</p> : null}
    <div className="button-row">
      <button className="secondary-button" disabled={!available || Boolean(creating)}
        onClick={() => void generate("daily_briefing")}>{creating === "daily_briefing" ? "Generating…" : "Draft daily briefing"}</button>
      <button className="secondary-button" disabled={!available || Boolean(creating)}
        onClick={() => void generate("weekly_briefing")}>{creating === "weekly_briefing" ? "Generating…" : "Draft weekly priorities"}</button>
    </div>
  </section>;
}
