import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select
} from "../../design-system";
import { displayName, displayNameTitle, shown, type Row } from "./utils";

const sequenceUses = [
  "First outreach",
  "Follow-up",
  "Objection reply",
  "Check-in",
  "Closing note"
] as const;

function emptyForm() {
  return {
    name: "",
    purpose: "First outreach" as string,
    templateVersionId: "",
    delayDays: 1
  };
}

function sequencePurpose(value: unknown): string {
  const purpose = shown(value, "").trim();
  if (!purpose) return "First outreach";
  if ((sequenceUses as readonly string[]).includes(purpose)) return purpose;
  if (/synthetic|acceptance|chromium|browser harness|fixture|test only/i.test(purpose)) {
    return "First outreach";
  }
  return purpose;
}

export function OutreachSequencesPage() {
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [sequences, setSequences] = useState<Row[]>([]);
  const [templates, setTemplates] = useState<Row[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const emailTemplates = useMemo(
    () => templates.filter((item) => shown(item.channel) === "email"),
    [templates]
  );

  const sequencesByUse = useMemo(() => {
    const grouped = new Map<string, Row[]>();
    for (const use of sequenceUses) grouped.set(use, []);
    for (const item of sequences) {
      const use = sequencePurpose(item.purpose);
      const key = (sequenceUses as readonly string[]).includes(use) ? use : "First outreach";
      const bucket = grouped.get(key) ?? [];
      bucket.push(item);
      grouped.set(key, bucket);
    }
    return grouped;
  }, [sequences]);

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

  function updateForm(key: keyof ReturnType<typeof emptyForm>, value: string | number) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate(purpose: string = "First outreach") {
    setViewing(null);
    setForm({ ...emptyForm(), purpose });
    setDrawerOpen(true);
  }

  function openSequence(item: Row) {
    setViewing(item);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (saving) return;
    setDrawerOpen(false);
    setViewing(null);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/outreach/sequences", {
        method: "POST",
        body: {
          name: form.name,
          purpose: form.purpose,
          steps: [
            {
              stepType: "email",
              delayMinutes: 0,
              templateVersionId: form.templateVersionId,
              instructions: "Personalize, revalidate evidence, and obtain exact approval."
            },
            {
              stepType: "task",
              delayMinutes: Math.max(0, Number(form.delayDays) || 0) * 1440,
              taskTitle: "Review response and prepare follow-up",
              instructions: "Stop on reply, opt-out, conflict, or authority change."
            }
          ]
        }
      });
      setForm(emptyForm());
      setDrawerOpen(false);
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
        title="Sequences"
        action={(
          <div className="ry-outreach-header-actions">
            {canWrite ? (
              <Button onClick={() => openCreate()}>Create sequence</Button>
            ) : (
              <Button disabled>Read-only access</Button>
            )}
            <Link className="ry-button ry-button-secondary" to="/outreach">Back to outreach</Link>
          </div>
        )}
      />
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}
      {!canWrite ? (
        <Alert tone="warning" className="ry-outreach-alert" title="Read-only sequences">
          You may inspect sequences, but cannot create new ones in this session.
        </Alert>
      ) : null}

      {loading ? <LoadingState label="Loading sequences" /> : (
        <section className="ry-register-surface ry-outreach-library" aria-label="Sequence library">
          <div className="ry-outreach-library-channels">
            {sequenceUses.map((use) => {
              const items = sequencesByUse.get(use) ?? [];
              return (
                <section key={use} className="ry-outreach-library-channel" aria-label={`${use} sequences`}>
                  <header className="ry-outreach-library-channel-heading">
                    <h3>{use}</h3>
                    <span>{items.length}</span>
                  </header>
                  {items.length === 0 ? (
                    <EmptyState
                      compact
                      className="ry-outreach-empty"
                      description={`No ${use.toLowerCase()} sequences yet.`}
                      action={canWrite ? (
                        <Button variant="secondary" size="compact" onClick={() => openCreate(use)}>
                          Create {use.toLowerCase()} sequence
                        </Button>
                      ) : undefined}
                    />
                  ) : (
                    <div className="ry-outreach-library-grid">
                      {items.map((item) => (
                        <button
                          type="button"
                          className="ry-outreach-library-card"
                          key={item.id}
                          onClick={() => openSequence(item)}
                        >
                          <h3 title={displayNameTitle(item.name)}>{displayName(item.name)}</h3>
                          <small className="ry-outreach-sequence-meta">
                            {shown(item.stepCount)} steps · {shown(item.activeEnrollments)} active
                          </small>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      )}

      <Drawer
        open={drawerOpen}
        title={viewing ? "Sequence" : "Create sequence"}
        description={viewing
          ? "A planned path of outreach steps. Approval is still required before any message sends."
          : "Start with an opening email, then a follow-up review. Nothing sends from this plan alone."}
        onClose={closeDrawer}
        size="standard"
        className="ry-outreach-template-drawer"
      >
        {viewing ? (
          <div className="ry-outreach-sequence-view">
            <dl>
              <div>
                <dt>Name</dt>
                <dd title={displayNameTitle(viewing.name)}>{displayName(viewing.name)}</dd>
              </div>
              <div>
                <dt>Used for</dt>
                <dd>{sequencePurpose(viewing.purpose)}</dd>
              </div>
              <div>
                <dt>Steps</dt>
                <dd>{shown(viewing.stepCount)}</dd>
              </div>
              <div>
                <dt>Active now</dt>
                <dd>{shown(viewing.activeEnrollments)}</dd>
              </div>
            </dl>
            <div className="ry-outreach-call-actions">
              <Button type="button" variant="secondary" size="compact" onClick={closeDrawer}>Close</Button>
            </div>
          </div>
        ) : (
          <form className="ry-outreach-template-form" onSubmit={(event) => void create(event)}>
            <div className="ry-outreach-template-grid">
              <Field label="Name" className="ry-outreach-prepare-span">
                <Input required controlSize="compact" value={form.name} onChange={(event) => updateForm("name", event.target.value)} disabled={!canWrite || saving} />
              </Field>
              <Field label="Used for" className="ry-outreach-prepare-span">
                <Select required controlSize="compact" value={form.purpose} onChange={(event) => updateForm("purpose", event.target.value)} disabled={!canWrite || saving}>
                  {sequenceUses.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Opening email" className="ry-outreach-prepare-span">
                <Select required controlSize="compact" value={form.templateVersionId} onChange={(event) => updateForm("templateVersionId", event.target.value)} disabled={!canWrite || saving}>
                  <option value="">Select template</option>
                  {emailTemplates.map((item) => (
                    <option key={shown(item.versionId)} value={shown(item.versionId)} title={displayNameTitle(item.name)}>
                      {displayName(item.name)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Days before follow-up review"
                hint="After the opening email, wait this many days before the review step."
                className="ry-outreach-prepare-span"
              >
                <Input
                  type="number"
                  min={0}
                  controlSize="compact"
                  value={form.delayDays}
                  onChange={(event) => updateForm("delayDays", Number(event.target.value))}
                  disabled={!canWrite || saving}
                />
              </Field>
            </div>
            <div className="ry-outreach-call-actions">
              <Button type="button" variant="secondary" size="compact" disabled={saving} onClick={closeDrawer}>Cancel</Button>
              <Button type="submit" size="compact" loading={saving} disabled={!canWrite || emailTemplates.length === 0}>
                {saving ? "Saving…" : "Save sequence"}
              </Button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
