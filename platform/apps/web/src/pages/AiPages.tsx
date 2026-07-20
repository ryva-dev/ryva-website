import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorPanel, Field, Loading, PageHeader, StatusPill } from "../components";
import { useLoad } from "../hooks";

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
  const detail = useLoad(
    () => api<SuggestionDetail>(`/api/ai/suggestions/${suggestionId}`),
    [suggestionId]
  );
  const [draft, setDraft] = useState("");
  const [reason, setReason] = useState("");
  const [instruction, setInstruction] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  useEffect(() => {
    if (detail.data) setDraft(shown(detail.data.suggestion.currentContent, ""));
  }, [detail.data]);

  async function act(action: "accepted" | "edited" | "rejected" | "feedback" | "reported_problem") {
    if (!detail.data) return;
    setSaving(true);
    setActionError("");
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
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Review action could not be recorded.");
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    if (!instruction.trim()) return;
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
    }
  }

  if (detail.loading) return <div className="page"><Loading label="Loading AI provenance and review history" /></div>;
  if (detail.error || !detail.data) return <div className="page"><ErrorPanel message={detail.error || "Suggestion not found."} /></div>;
  const { suggestion, statements, sources, actions } = detail.data;
  const extraction = suggestion.structuredPayload as Record<string, unknown> | undefined;
  const fieldCandidates = Array.isArray(extraction?.fieldCandidates)
    ? extraction.fieldCandidates as Array<Record<string, unknown>>
    : [];
  const final = ["accepted","rejected","expired"].includes(shown(suggestion.status));

  return <div className="page">
    <PageHeader
      eyebrow="Reviewable AI suggestion"
      title={shown(suggestion.title)}
      description="Inspect every material statement, source, classification, limitation, model run, and human action before deciding whether any content is useful."
      action={<Link className="secondary-button" to="/copilot">All suggestions</Link>}
    />
    {actionError ? <ErrorPanel message={actionError} /> : null}
    <section className="metric-row">
      <article className="metric"><span>Review state</span><StatusPill value={shown(suggestion.status)} /><small>No target state changed</small></article>
      <article className="metric"><span>Evidence confidence</span><StatusPill value={shown(suggestion.confidence)} /><small>{shown(suggestion.confidenceSubject)}</small></article>
      <article className="metric"><span>Generated</span><strong>{new Date(shown(suggestion.generatedAt)).toLocaleString()}</strong><small>{shown(suggestion.provider)} · {shown(suggestion.model)} · {shown(suggestion.modelVersion)}</small></article>
    </section>
    <section className="ai-review-grid">
      <article className="panel">
        <p className="eyebrow">Editable proposal</p><h2>Suggested content</h2>
        <textarea className="ai-content-editor" value={draft}
          onChange={(event) => setDraft(event.target.value)} disabled={final} />
        <p className="form-hint">Accepting records your review only. It does not create a Task, send a message, approve authority, change a stage, qualify a record, or alter financial state.</p>
        <Field label="Review reason or feedback"><textarea value={reason} onChange={(event) => setReason(event.target.value)}
          placeholder="Why was this useful, edited, rejected, or problematic?" /></Field>
        <div className="form-actions">
          <button className="primary-button" disabled={saving || final} onClick={() => void act("accepted")}>Accept as reviewed content</button>
          <button className="secondary-button" disabled={saving || final || draft === shown(suggestion.currentContent, "")} onClick={() => void act("edited")}>Save human edit</button>
          <button className="text-button danger-text" disabled={saving || final} onClick={() => void act("rejected")}>Reject</button>
          <button className="text-button" disabled={saving} onClick={() => void act("feedback")}>Record feedback</button>
          <button className="text-button" disabled={saving} onClick={() => void act("reported_problem")}>Report problem</button>
        </div>
      </article>
      <aside className="panel">
        <p className="eyebrow">Run provenance</p><h2>Model and policy</h2>
        <dl className="definition-list">
          <div><dt>Use case</dt><dd>{shown(suggestion.suggestionType).replaceAll("_", " ")}</dd></div>
          <div><dt>Target</dt><dd>{shown(suggestion.targetType).replaceAll("_", " ")} · {shown(suggestion.targetId)}</dd></div>
          <div><dt>Provider/model</dt><dd>{shown(suggestion.provider)} · {shown(suggestion.model)} · {shown(suggestion.modelVersion)}</dd></div>
          <div><dt>Template</dt><dd>{shown(suggestion.promptTemplateKey)} v{shown(suggestion.promptTemplateVersion)}</dd></div>
          <div><dt>Policy</dt><dd>{shown(suggestion.policyVersion)}</dd></div>
          <div><dt>Retention</dt><dd>{shown(suggestion.providerRetentionMode).replaceAll("_", " ")}</dd></div>
          <div><dt>Latency</dt><dd>{shown(suggestion.latencyMs)} ms</dd></div>
        </dl>
        <strong>No provider training, tools, or external actions</strong>
      </aside>
    </section>
    <section className="panel">
      <p className="eyebrow">Material statement review</p><h2>Classification and citations</h2>
      <div className="ai-statement-list">{statements.map((statement) => {
        const citations = Array.isArray(statement.citations) ? statement.citations as Row[] : [];
        return <article key={statement.id}>
          <div className="record-heading"><strong>{shown(statement.statementText)}</strong>
            <span className="status-cluster"><StatusPill value={shown(statement.classification)} /><StatusPill value={shown(statement.confidence)} /></span>
          </div>
          {citations.length ? <p>{citations.map((citation) =>
            <a href={`#source-${shown(citation.ordinal)}`} key={shown(citation.contextItemId)}>
              [{shown(citation.ordinal)}] {shown(citation.label)}
            </a>)}</p> : <p className="warning-text">No supporting citation. This statement is Unknown.</p>}
        </article>;
      })}</div>
    </section>
    {fieldCandidates.length ? <section className="panel">
      <p className="eyebrow">Uncommitted extraction</p><h2>Field candidates requiring human review</h2>
      <p>Nothing below has been applied to an Agreement, Order, protection record, Commission, or other material field.</p>
      <div className="record-list">{fieldCandidates.map((candidate, index) =>
        <article className="list-row" key={`${shown(candidate.field)}-${index}`}>
          <span><strong>{shown(candidate.field)}</strong><small>{shown(candidate.sourceLocation)} · human review required</small></span>
          <code>{shown(candidate.value)}</code>
        </article>)}</div>
    </section> : null}
    <section className="three-column-grid">
      <article className="panel"><h2>Missing evidence</h2>{listOrEmpty(items(suggestion.missingEvidence), "No missing evidence was declared. Review sources before relying on that absence.")}</article>
      <article className="panel"><h2>Known limitations</h2>{listOrEmpty(items(suggestion.limitations), "No limitations were returned; this does not imply certainty.")}</article>
      <article className="panel"><h2>Contrary evidence</h2>{listOrEmpty(items(suggestion.contraryEvidence), "No contrary evidence was packaged. Confirm the evidence set is complete.")}</article>
    </section>
    <section className="panel">
      <p className="eyebrow">Supporting records used</p><h2>Inspectable source package</h2>
      {sources.length ? <div className="ai-source-list">{sources.map((source) =>
        <article id={`source-${shown(source.ordinal)}`} key={source.id}>
          <div className="record-heading"><span><strong>[{shown(source.ordinal)}] {shown(source.label)}</strong>
            <small>{shown(source.recordType).replaceAll("_", " ")} · {shown(source.recordId)}</small></span>
            <StatusPill value={shown(source.evidenceClass)} />
          </div>
          <p>{shown(source.contentExcerpt)}</p>
          <small>Freshness: {source.freshnessAt ? new Date(shown(source.freshnessAt)).toLocaleString() : "Unknown"} · Limitation: {shown(source.limitations, "None recorded")}</small>
        </article>)}</div>
        : <p className="empty">No supporting records were available. Material claims must remain Unknown.</p>}
    </section>
    <section className="panel">
      <p className="eyebrow">Regeneration</p><h2>Create a child suggestion</h2>
      <Field label="New instruction" hint="The original remains immutable and visible.">
        <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} />
      </Field>
      <button className="secondary-button" disabled={saving || !instruction.trim()} onClick={() => void regenerate()}>Regenerate without overwriting</button>
    </section>
    <section className="panel">
      <p className="eyebrow">Human review history</p><h2>Disposition and feedback</h2>
      {actions.length ? actions.map((action) => <article className="timeline-item" key={action.id}>
        <strong>{shown(action.action).replaceAll("_", " ")}</strong>
        <p>{shown(action.note, "No note")}</p>
        <small>{new Date(shown(action.createdAt)).toLocaleString()} · actor {shown(action.actorUserId)}</small>
      </article>) : <p className="empty">No human disposition yet.</p>}
    </section>
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
