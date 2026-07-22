import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusLabel,
  TextArea
} from "../../design-system";
import { readable, shown, splitIds, type Row } from "./utils";

export function OutreachTemplatesPage() {
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [templates, setTemplates] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("email");
  const [purpose, setPurpose] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [variables, setVariables] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTemplates((await api<{ templates: Row[] }>("/api/outreach/templates")).templates);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Templates could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/outreach/templates", {
        method: "POST",
        body: {
          name,
          channel,
          purpose,
          subject,
          body,
          requiredVariables: splitIds(variables),
          requiredComplianceBlocks: channel === "email" ? ["sender_identity", "opt_out"] : []
        }
      });
      setName("");
      setPurpose("");
      setSubject("");
      setBody("");
      setVariables("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Template could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page ry-outreach-page">
      <PageHeader
        eyebrow="Outreach Center"
        title="Versioned templates"
        description="Reusable starting points never carry approval. Each communication becomes its own evidence-checked, human-approved artifact."
        action={<Link className="ry-button ry-button-secondary" to="/outreach">Back to outreach</Link>}
      />
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}
      {!canWrite ? (
        <Alert tone="warning" title="Read-only template library">
          You may inspect templates, but cannot create immutable versions in this session.
        </Alert>
      ) : null}
      <Alert tone="info" title="Template is not the exact message">
        A template is reusable content only. Approval applies to a stored Outreach artifact for one Contact, channel, and Placement—not to the template itself across every recipient.
      </Alert>

      {loading ? <LoadingState label="Loading templates" /> : (
        <div className="ry-outreach-workspace">
          <section className="panel" aria-label="Template library">
            <header className="ry-outreach-section-heading">
              <p className="eyebrow">Library</p>
              <h2>Template library</h2>
            </header>
            {templates.length === 0 ? (
              <EmptyState description="No templates yet." />
            ) : (
              <div className="ry-outreach-library-grid">
                {templates.map((item) => (
                  <article className="ry-outreach-library-card" key={item.id}>
                    <StatusLabel value={shown(item.channel)} />
                    <h3>{shown(item.name)}</h3>
                    <p>{shown(item.purpose)}</p>
                    <small>Version {shown(item.currentVersion)}</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel" aria-label="Create template">
            <header className="ry-outreach-section-heading">
              <p className="eyebrow">Create</p>
              <h2>Create template</h2>
            </header>
            <form className="ry-outreach-template-form" onSubmit={(event) => void create(event)}>
              <Field label="Name"><Input required value={name} onChange={(event) => setName(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="Channel">
                <Select value={channel} onChange={(event) => setChannel(event.target.value)} disabled={!canWrite}>
                  {["email", "social", "call", "voicemail", "objection", "follow_up"].map((item) => (
                    <option key={item} value={item}>{readable(item)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Purpose"><Input required value={purpose} onChange={(event) => setPurpose(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="Required variables"><Input value={variables} onChange={(event) => setVariables(event.target.value)} placeholder="buyer_name, brand_name" disabled={!canWrite} /></Field>
              <Field label="Subject"><Input value={subject} onChange={(event) => setSubject(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="Body"><TextArea required rows={9} value={body} onChange={(event) => setBody(event.target.value)} disabled={!canWrite} /></Field>
              <Button type="submit" loading={saving} disabled={!canWrite}>{saving ? "Creating…" : "Create immutable v1"}</Button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
