import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorPanel, Field, Loading, PageHeader, StatusPill } from "../components";

type Row = Record<string, unknown> & { id: string; version?: number };
type Placement = Row & { businessId?: string; business_id?: string };
type MessageDetail = {
  message: Row & {
    placementOpportunityId: string;
    recipientAddress: string;
    senderAddress: string;
    subject: string;
    body: string;
    status: string;
    approvalId: string | null;
    approvedDigest: string | null;
    claims: Row[];
    attachments: Row[];
  };
  digest: string;
};

function shown(value: unknown, fallback = "—"): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function splitIds(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function OutreachPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [messages, setMessages] = useState<Row[]>([]);
  const [history, setHistory] = useState<Row[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [contacts, setContacts] = useState<Row[]>([]);
  const [templates, setTemplates] = useState<Row[]>([]);
  const [placementId, setPlacementId] = useState("");
  const [placementProducts, setPlacementProducts] = useState<string[]>([]);
  const [contactId, setContactId] = useState("");
  const [channel, setChannel] = useState<"email" | "social">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [claimText, setClaimText] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [attachmentIds, setAttachmentIds] = useState("");
  const [templateVersionId, setTemplateVersionId] = useState("");
  const [senderAddress, setSenderAddress] = useState(session?.user.email ?? "");
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [callObjective, setCallObjective] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [outreach, activity, placementPayload, contactPayload, templatePayload, configuration] = await Promise.all([
        api<{ messages: Row[] }>("/api/outreach"),
        api<{ history: Row[] }>("/api/outreach/history"),
        api<{ placements: Placement[] }>("/api/placements"),
        api<{ records: Row[] }>("/api/records/contact"),
        api<{ templates: Row[] }>("/api/outreach/templates"),
        api<{ senderAddress: string; providerConfigured: boolean }>("/api/outreach/config")
      ]);
      setMessages(outreach.messages);
      setHistory(activity.history);
      setPlacements(placementPayload.placements);
      setContacts(contactPayload.records);
      setTemplates(templatePayload.templates);
      setSenderAddress(configuration.senderAddress);
      setProviderConfigured(configuration.providerConfigured);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Outreach Center could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!placementId) {
      setPlacementProducts([]);
      return;
    }
    void api<{ products: Array<{ productId: string }> }>(`/api/placements/${placementId}`)
      .then((value) => setPlacementProducts(value.products.map((item) => item.productId)))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Placement context could not be loaded."));
  }, [placementId]);

  const selectedContact = useMemo(
    () => contacts.find((item) => item.id === contactId),
    [contacts, contactId]
  );

  function applyTemplate(id: string) {
    setTemplateVersionId(id);
    const template = templates.find((item) => item.versionId === id);
    if (!template) return;
    setSubject(shown(template.subject, ""));
    setBody(shown(template.body, ""));
    const templateChannel = shown(template.channel);
    if (templateChannel === "email" || templateChannel === "social") setChannel(templateChannel);
  }

  async function createMessage(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const result = await api<{ message: Row }>("/api/outreach", {
        method: "POST",
        body: {
          placementId, contactId, channel,
          senderAddress,
          recipientAddress: channel === "email" ? shown(selectedContact?.email, "") : shown(selectedContact?.name, ""),
          subject, body, productIds: placementProducts,
          claimLinks: claimText ? [{ claimText, productId: placementProducts[0] ?? null, evidenceId: evidenceId || null }] : [],
          attachmentIds: splitIds(attachmentIds),
          templateVersionId: templateVersionId || null
        }
      });
      void navigate(`/outreach/${result.message.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Draft could not be created.");
    } finally { setSaving(false); }
  }

  async function logCall(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      await api("/api/outreach/calls", {
        method: "POST",
        body: {
          placementId, contactId, status: "completed", objective: callObjective,
          preparation: "", questions: [], objectionGuidance: [],
          authorityLimits: "Do not negotiate or promise binding commercial outcomes.",
          voicemailScript: "", notes: callNotes, outcome: callOutcome,
          nextActionTitle: "Review call outcome and choose next action",
          nextActionDueAt: new Date(Date.now() + 86_400_000).toISOString()
        }
      });
      setCallObjective(""); setCallNotes(""); setCallOutcome("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Call could not be logged.");
    } finally { setSaving(false); }
  }

  return <div className="page">
    <PageHeader eyebrow="Outreach Center" title="Human-approved communication" description="Prepare, approve, send, call, and follow up from one authority-checked history. Ryva never sends or calls autonomously." action={<div className="button-row"><Link className="secondary-button" to="/outreach/templates">Templates</Link><Link className="secondary-button" to="/outreach/sequences">Sequences</Link></div>} />
    {error ? <ErrorPanel message={error} /> : null}
    {loading ? <Loading label="Loading outreach work" /> : <>
      <section className="metric-row">
        <article className="metric"><span>Needs approval</span><strong>{messages.filter((item) => item.status === "approval_requested").length}</strong></article>
        <article className="metric"><span>Queued</span><strong>{messages.filter((item) => item.status === "queued").length}</strong></article>
        <article className="metric"><span>Replies</span><strong>{messages.filter((item) => item.status === "replied" || item.direction === "inbound").length}</strong></article>
      </section>
      {!providerConfigured ? <section className="state-panel" role="status"><strong>Email provider unavailable</strong><p>Drafting, review, calls, notes, and templates remain available. Approved email stays queued until a verified provider and worker are configured.</p></section> : null}
      <div className="split-grid">
        <section className="panel">
          <p className="eyebrow">Unified history</p><h2>Communication and activity</h2>
          {history.length === 0 ? <p className="empty">No outreach activity yet. Start from a prepared Placement with current authority.</p> :
            <div className="record-list">{history.map((item) => <div className="task-row" key={`${shown(item.kind)}-${item.id}`}>
              <span><strong>{shown(item.summary)}</strong><small>{shown(item.kind)} · {new Date(shown(item.occurredAt)).toLocaleString()}</small></span>
              <StatusPill value={shown(item.status)} />
            </div>)}</div>}
        </section>
        <section className="panel">
          <p className="eyebrow">Draft</p><h2>Prepare outreach</h2>
          <form className="form-grid" onSubmit={(event) => void createMessage(event)}>
            <Field label="Prepared Placement"><select required value={placementId} onChange={(event) => setPlacementId(event.target.value)}>
              <option value="">Select Placement</option>{placements.filter((item) => ["prepared","contacted","engaged","information_sample_sent","buyer_review","terms_order_discussion"].includes(shown(item.stage))).map((item) => <option value={item.id} key={item.id}>{shown(item.brandName)} → {shown(item.businessName)} · {shown(item.stage)}</option>)}
            </select></Field>
            <Field label="Buyer Contact"><select required value={contactId} onChange={(event) => setContactId(event.target.value)}>
              <option value="">Select Contact</option>{contacts.map((item) => <option value={item.id} key={item.id}>{shown(item.name)} · {shown(item.email, "no email")}</option>)}
            </select></Field>
            <Field label="Channel"><select value={channel} onChange={(event) => setChannel(event.target.value as "email" | "social")}><option value="email">Email</option><option value="social">Social draft</option></select></Field>
            <Field label="Verified sender"><input value={senderAddress} disabled /></Field>
            <Field label="Template"><select value={templateVersionId} onChange={(event) => applyTemplate(event.target.value)}><option value="">No template</option>{templates.filter((item) => item.channel === channel).map((item) => <option key={shown(item.versionId)} value={shown(item.versionId)}>{shown(item.name)} · v{shown(item.currentVersion)}</option>)}</select></Field>
            <Field label="Subject"><input value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
            <Field label="Material claim" hint="Leave blank when no factual claim is made. Unsupported claims block approval."><input value={claimText} onChange={(event) => setClaimText(event.target.value)} /></Field>
            <Field label="Evidence ID"><input value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} /></Field>
            <Field label="Clean attachment IDs" hint="Comma-separated immutable Document IDs."><input value={attachmentIds} onChange={(event) => setAttachmentIds(event.target.value)} /></Field>
            <Field label="Exact body"><textarea required rows={9} value={body} onChange={(event) => setBody(event.target.value)} /></Field>
            <div className="form-actions"><button className="primary-button" disabled={saving || placementProducts.length === 0}>{saving ? "Creating…" : "Create reviewable draft"}</button></div>
          </form>
        </section>
      </div>
      <section className="panel"><p className="eyebrow">Human call workflow</p><h2>Log a call</h2>
        <form className="form-grid" onSubmit={(event) => void logCall(event)}>
          <Field label="Objective"><input required value={callObjective} onChange={(event) => setCallObjective(event.target.value)} /></Field>
          <Field label="Outcome"><input required value={callOutcome} onChange={(event) => setCallOutcome(event.target.value)} /></Field>
          <Field label="Notes"><textarea required value={callNotes} onChange={(event) => setCallNotes(event.target.value)} /></Field>
          <div className="form-actions"><button className="primary-button" disabled={saving || !placementId || !contactId}>Log human-placed call</button></div>
        </form>
      </section>
      <section className="panel"><h2>Messages</h2>
        {messages.length === 0 ? <p className="empty">No drafts, sends, or replies.</p> :
          <div className="table-wrap"><table><thead><tr><th>Buyer</th><th>Channel</th><th>Subject</th><th>Status</th><th /></tr></thead><tbody>
            {messages.map((item) => <tr key={item.id}><td>{shown(item.businessName)}<small>{shown(item.contactName)}</small></td><td>{shown(item.channel)}</td><td>{shown(item.subject, "(no subject)")}</td><td><StatusPill value={shown(item.status)} /></td><td><Link to={`/outreach/${item.id}`}>Review</Link></td></tr>)}
          </tbody></table></div>}
      </section>
    </>}
  </div>;
}

export function OutreachDetailPage() {
  const { id = "" } = useParams();
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [approvalId, setApprovalId] = useState("");
  const [classification, setClassification] = useState("interested");
  const [responseNotes, setResponseNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      const value = await api<MessageDetail>(`/api/outreach/${id}`);
      setDetail(value);
      setApprovalId(value.message.approvalId ?? "");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Message could not be loaded."); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  async function requestApproval() {
    setSaving(true); setError("");
    try {
      const result = await api<{ approval: Row }>(`/api/outreach/${id}/approval`, { method: "POST" });
      setApprovalId(result.approval.id);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Approval could not be requested."); }
    finally { setSaving(false); }
  }
  async function approve() {
    setSaving(true); setError("");
    try {
      await api(`/api/outreach/${id}/approval/${approvalId}`, {
        method: "POST", body: { decision: "approved", conditions: "Approved for this exact recipient, content, attachments, sender, channel and timing only." }
      });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Exact artifact could not be approved."); }
    finally { setSaving(false); }
  }
  async function send() {
    setSaving(true); setError("");
    try { await api(`/api/outreach/${id}/send`, { method: "POST" }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Message could not be queued."); }
    finally { setSaving(false); }
  }
  async function confirmSocialSend() {
    setSaving(true); setError("");
    try {
      await api(`/api/outreach/${id}/confirm-manual-send`, {
        method: "POST",
        body: {
          occurredAt: new Date().toISOString(),
          confirmation: "I personally sent this exact approved social message to the named recipient."
        }
      });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "External social send could not be confirmed."); }
    finally { setSaving(false); }
  }
  async function classifyResponse(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      await api(`/api/outreach/${id}/classify-response`, {
        method: "POST",
        body: {
          classification, notes: responseNotes,
          nextActionTitle: classification === "opt_out" ? null : "Respond to classified Buyer message",
          nextActionDueAt: classification === "opt_out" ? null : new Date(Date.now() + 86_400_000).toISOString()
        }
      });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Response could not be classified."); }
    finally { setSaving(false); }
  }
  if (!detail && !error) return <Loading label="Loading outreach artifact" />;
  return <div className="page">
    <PageHeader eyebrow="Exact outreach artifact" title={detail?.message.subject || "Message review"} description="Recipient, sender, content, claims, attachments, channel and timing are approved together. Any material edit invalidates approval." />
    {error ? <ErrorPanel message={error} /> : null}
    {detail ? <>
      <section className="metric-row">
        <article className="metric"><span>Status</span><StatusPill value={detail.message.status} /></article>
        <article className="metric"><span>Channel</span><strong>{shown(detail.message.channel)}</strong></article>
        <article className="metric"><span>Artifact</span><small>{detail.digest.slice(0, 16)}…</small></article>
      </section>
      <section className="panel"><h2>Exact delivery scope</h2><dl className="detail-grid">
        <div><dt>Recipient</dt><dd>{detail.message.recipientAddress}</dd></div>
        <div><dt>Sender</dt><dd>{detail.message.senderAddress}</dd></div>
        <div><dt>Timing</dt><dd>{shown(detail.message.scheduledAt, "Immediate after approval")}</dd></div>
      </dl><h3>Content</h3><pre className="document-preview">{detail.message.body}</pre></section>
      <div className="split-grid">
        <section className="panel"><h2>Evidence-linked claims</h2>{detail.message.claims.length === 0 ? <p className="empty">No material claims declared.</p> : detail.message.claims.map((item) => <div className="timeline-item" key={item.id}><StatusPill value={shown(item.status)} /><p>{shown(item.claimText)}</p><small>Evidence {shown(item.evidenceId, "missing")}</small></div>)}</section>
        <section className="panel"><h2>Immutable attachments</h2>{detail.message.attachments.length === 0 ? <p className="empty">No attachments.</p> : detail.message.attachments.map((item) => <div className="timeline-item" key={shown(item.documentId)}><StatusPill value={shown(item.scanStatus)} /><p>{shown(item.documentId)}</p><small>{shown(item.sha256).slice(0,16)}…</small></div>)}</section>
      </div>
      <section className="panel"><p className="eyebrow">Consequential action</p><h2>Human approval and send</h2>
        <p>Approval does not send. Queueing revalidates access, authority, recipient permission, conflict state, claims, and attachments. The worker repeats those checks immediately before provider delivery.</p>
        <div className="button-row">
          {detail.message.status === "draft" ? <button className="secondary-button" disabled={saving} onClick={() => void requestApproval()}>Request exact approval</button> : null}
          {detail.message.status === "approval_requested" ? <button className="primary-button" disabled={saving || !approvalId} onClick={() => void approve()}>Approve exact artifact</button> : null}
          {detail.message.status === "approved" && detail.message.channel === "email" ? <button className="primary-button" disabled={saving} onClick={() => void send()}>Queue approved message</button> : null}
          {detail.message.status === "approved" && detail.message.channel === "social" ? <button className="primary-button" disabled={saving} onClick={() => void confirmSocialSend()}>Confirm I sent this exact message</button> : null}
        </div>
      </section>
      {["replied","received"].includes(detail.message.status) ? <section className="panel"><p className="eyebrow">Human-owned response tracking</p><h2>Classify the Buyer response</h2>
        <form className="form-grid" onSubmit={(event) => void classifyResponse(event)}>
          <Field label="Response"><select value={classification} onChange={(event) => setClassification(event.target.value)}>{["interested","not_now","objection","question","opt_out","wrong_contact","not_fit"].map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Response notes"><textarea required value={responseNotes} onChange={(event) => setResponseNotes(event.target.value)} /></Field>
          <div className="form-actions"><button className="primary-button" disabled={saving}>Record human classification</button></div>
        </form>
      </section> : null}
    </> : null}
  </div>;
}

export function OutreachTemplatesPage() {
  const [templates, setTemplates] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("email");
  const [purpose, setPurpose] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [variables, setVariables] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setTemplates((await api<{ templates: Row[] }>("/api/outreach/templates")).templates); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Templates could not be loaded."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/outreach/templates", { method: "POST", body: {
        name, channel, purpose, subject, body, requiredVariables: splitIds(variables),
        requiredComplianceBlocks: channel === "email" ? ["sender_identity", "opt_out"] : []
      } });
      setName(""); setPurpose(""); setSubject(""); setBody(""); setVariables("");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Template could not be saved."); }
  }
  return <div className="page"><PageHeader eyebrow="Outreach Center" title="Versioned templates" description="Reusable starting points never carry approval. Each communication becomes its own evidence-checked, human-approved artifact." action={<Link className="secondary-button" to="/outreach">Back to outreach</Link>} />
    {error ? <ErrorPanel message={error} /> : null}
    <div className="split-grid"><section className="panel"><h2>Template library</h2>{templates.length === 0 ? <p className="empty">No templates yet.</p> : templates.map((item) => <article className="record-card" key={item.id}><StatusPill value={shown(item.channel)} /><h3>{shown(item.name)}</h3><p>{shown(item.purpose)}</p><small>Version {shown(item.currentVersion)}</small></article>)}</section>
    <section className="panel"><h2>Create template</h2><form className="form-grid" onSubmit={(event) => void create(event)}>
      <Field label="Name"><input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Channel"><select value={channel} onChange={(event) => setChannel(event.target.value)}>{["email","social","call","voicemail","objection","follow_up"].map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Purpose"><input required value={purpose} onChange={(event) => setPurpose(event.target.value)} /></Field>
      <Field label="Required variables"><input value={variables} onChange={(event) => setVariables(event.target.value)} placeholder="buyer_name, brand_name" /></Field>
      <Field label="Subject"><input value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
      <Field label="Body"><textarea required rows={9} value={body} onChange={(event) => setBody(event.target.value)} /></Field>
      <div className="form-actions"><button className="primary-button">Create immutable v1</button></div>
    </form></section></div>
  </div>;
}

export function OutreachSequencesPage() {
  const [sequences, setSequences] = useState<Row[]>([]);
  const [templates, setTemplates] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [templateVersionId, setTemplateVersionId] = useState("");
  const [delayMinutes, setDelayMinutes] = useState(1440);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [sequencePayload, templatePayload] = await Promise.all([
        api<{ sequences: Row[] }>("/api/outreach/sequences"),
        api<{ templates: Row[] }>("/api/outreach/templates")
      ]);
      setSequences(sequencePayload.sequences); setTemplates(templatePayload.templates);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Sequences could not be loaded."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/outreach/sequences", { method: "POST", body: {
        name, purpose, steps: [
          { stepType: "email", delayMinutes: 0, templateVersionId, instructions: "Personalize, revalidate evidence, and obtain exact approval." },
          { stepType: "task", delayMinutes, taskTitle: "Review response and prepare follow-up", instructions: "Stop on reply, opt-out, conflict, or authority change." }
        ]
      } });
      setName(""); setPurpose(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Sequence could not be created."); }
  }
  return <div className="page"><PageHeader eyebrow="Outreach Center" title="Human-controlled sequences" description="Sequences schedule reviewable work and stop automatically on reply, opt-out, conflict, access restriction, or invalid authority. They never auto-send." action={<Link className="secondary-button" to="/outreach">Back to outreach</Link>} />
    {error ? <ErrorPanel message={error} /> : null}
    <div className="split-grid"><section className="panel"><h2>Sequences</h2>{sequences.length === 0 ? <p className="empty">No sequences yet.</p> : sequences.map((item) => <article className="record-card" key={item.id}><StatusPill value={shown(item.status)} /><h3>{shown(item.name)}</h3><p>{shown(item.purpose)}</p><small>{shown(item.stepCount)} steps · {shown(item.activeEnrollments)} active</small></article>)}</section>
    <section className="panel"><h2>Create a two-step sequence</h2><form className="form-grid" onSubmit={(event) => void create(event)}>
      <Field label="Name"><input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Purpose"><input required value={purpose} onChange={(event) => setPurpose(event.target.value)} /></Field>
      <Field label="First-step email template"><select required value={templateVersionId} onChange={(event) => setTemplateVersionId(event.target.value)}><option value="">Select</option>{templates.filter((item) => item.channel === "email").map((item) => <option key={shown(item.versionId)} value={shown(item.versionId)}>{shown(item.name)}</option>)}</select></Field>
      <Field label="Follow-up review delay (minutes)"><input type="number" min={0} value={delayMinutes} onChange={(event) => setDelayMinutes(Number(event.target.value))} /></Field>
      <div className="form-actions"><button className="primary-button">Create sequence</button></div>
    </form></section></div>
  </div>;
}
