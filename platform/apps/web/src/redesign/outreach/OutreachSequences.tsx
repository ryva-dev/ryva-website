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
  StatusLabel
} from "../../design-system";
import { shown, type Row } from "./utils";

export function OutreachSequencesPage() {
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [sequences, setSequences] = useState<Row[]>([]);
  const [templates, setTemplates] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [templateVersionId, setTemplateVersionId] = useState("");
  const [delayMinutes, setDelayMinutes] = useState(1440);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sequencePayload, templatePayload] = await Promise.all([
        api<{ sequences: Row[] }>("/api/outreach/sequences"),
        api<{ templates: Row[] }>("/api/outreach/templates")
      ]);
      setSequences(sequencePayload.sequences);
      setTemplates(templatePayload.templates);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sequences could not be loaded.");
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
      await api("/api/outreach/sequences", {
        method: "POST",
        body: {
          name,
          purpose,
          steps: [
            {
              stepType: "email",
              delayMinutes: 0,
              templateVersionId,
              instructions: "Personalize, revalidate evidence, and obtain exact approval."
            },
            {
              stepType: "task",
              delayMinutes,
              taskTitle: "Review response and prepare follow-up",
              instructions: "Stop on reply, opt-out, conflict, or authority change."
            }
          ]
        }
      });
      setName("");
      setPurpose("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sequence could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page ry-outreach-page">
      <PageHeader
        eyebrow="Outreach Center"
        title="Human-controlled sequences"
        description="Sequences schedule reviewable work and stop automatically on reply, opt-out, conflict, access restriction, or invalid authority. They never auto-send."
        action={<Link className="ry-button ry-button-secondary" to="/outreach">Back to outreach</Link>}
      />
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}
      {!canWrite ? (
        <Alert tone="warning" title="Read-only sequences">
          You may inspect sequences, but cannot create enrollable plans in this session.
        </Alert>
      ) : null}
      <Alert tone="info" title="Sequence is not a sent message">
        Sequence logic schedules human review work. It is distinct from an already scheduled, approved, queued, or sent Outreach artifact, and does not invent performance statistics.
      </Alert>

      {loading ? <LoadingState label="Loading sequences" /> : (
        <div className="ry-outreach-workspace">
          <section className="panel" aria-label="Sequences">
            <header className="ry-outreach-section-heading">
              <p className="eyebrow">Library</p>
              <h2>Sequences</h2>
            </header>
            {sequences.length === 0 ? (
              <EmptyState description="No sequences yet." />
            ) : (
              <div className="ry-outreach-library-grid">
                {sequences.map((item) => (
                  <article className="ry-outreach-library-card" key={item.id}>
                    <StatusLabel value={shown(item.status)} />
                    <h3>{shown(item.name)}</h3>
                    <p>{shown(item.purpose)}</p>
                    <small>{shown(item.stepCount)} steps · {shown(item.activeEnrollments)} active</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel" aria-label="Create a two-step sequence">
            <header className="ry-outreach-section-heading">
              <p className="eyebrow">Create</p>
              <h2>Create a two-step sequence</h2>
            </header>
            <form className="ry-outreach-sequence-form" onSubmit={(event) => void create(event)}>
              <Field label="Name"><Input required value={name} onChange={(event) => setName(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="Purpose"><Input required value={purpose} onChange={(event) => setPurpose(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="First-step email template">
                <Select required value={templateVersionId} onChange={(event) => setTemplateVersionId(event.target.value)} disabled={!canWrite}>
                  <option value="">Select</option>
                  {templates.filter((item) => item.channel === "email").map((item) => (
                    <option key={shown(item.versionId)} value={shown(item.versionId)}>{shown(item.name)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Follow-up review delay (minutes)">
                <Input type="number" min={0} value={delayMinutes} onChange={(event) => setDelayMinutes(Number(event.target.value))} disabled={!canWrite} />
              </Field>
              <Button type="submit" loading={saving} disabled={!canWrite}>{saving ? "Creating…" : "Create sequence"}</Button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
