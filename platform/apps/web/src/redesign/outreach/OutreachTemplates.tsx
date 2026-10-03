import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  TextArea
} from "../../design-system";
import { displayName, displayNameTitle, readable, shown, type Row } from "./utils";

const templateChannels = ["email", "social", "call", "voicemail", "objection", "follow_up"] as const;

const templateUses = [
  "First outreach",
  "Follow-up",
  "Objection reply",
  "Check-in",
  "Closing note",
  "Call prep",
  "Voicemail script"
] as const;

const fillInOptions = [
  { id: "buyer_name", label: "Buyer name" },
  { id: "brand_name", label: "Brand name" },
  { id: "business_name", label: "Business name" },
  { id: "contact_name", label: "Contact name" },
  { id: "product_name", label: "Product name" },
  { id: "sender_name", label: "Your name" }
] as const;

function displayPurpose(value: unknown): string {
  const purpose = shown(value, "").trim();
  if (!purpose) return "First outreach";
  if ((templateUses as readonly string[]).includes(purpose)) return purpose;
  if (/synthetic|acceptance|chromium|browser harness|fixture|test only/i.test(purpose)) {
    return "First outreach";
  }
  return purpose;
}

function emptyForm(channel: string = "email") {
  return {
    name: "",
    channel,
    purpose: "First outreach" as string,
    subject: "",
    body: "",
    fillIns: [] as string[]
  };
}

function formFromTemplate(item: Row) {
  const variables = Array.isArray(item.requiredVariables)
    ? item.requiredVariables.map(String)
    : [];
  return {
    name: displayName(item.name, ""),
    channel: shown(item.channel, "email"),
    purpose: displayPurpose(item.purpose),
    subject: shown(item.subject, ""),
    body: shown(item.body, ""),
    fillIns: variables.filter((id) => fillInOptions.some((option) => option.id === id))
  };
}

export function OutreachTemplatesPage() {
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [templates, setTemplates] = useState<Row[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const templatesByChannel = useMemo(() => {
    const grouped = new Map<string, Row[]>();
    for (const channel of templateChannels) grouped.set(channel, []);
    for (const item of templates) {
      const channel = shown(item.channel, "email");
      const bucket = grouped.get(channel) ?? [];
      bucket.push(item);
      grouped.set(channel, bucket);
    }
    return grouped;
  }, [templates]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await api<{ templates: Row[] }>("/api/outreach/templates");
      const grouped = new Map<string, Row[]>();
      for (const item of payload.templates) {
        const key = `${shown(item.channel)}::${displayName(item.name).toLowerCase()}`;
        const bucket = grouped.get(key) ?? [];
        bucket.push(item);
        grouped.set(key, bucket);
      }
      const keep: Row[] = [];
      const duplicates: Row[] = [];
      for (const bucket of grouped.values()) {
        const sorted = [...bucket].sort((left, right) => {
          const leftTime = Date.parse(shown(left.updatedAt, "")) || 0;
          const rightTime = Date.parse(shown(right.updatedAt, "")) || 0;
          return rightTime - leftTime;
        });
        keep.push(sorted[0]!);
        duplicates.push(...sorted.slice(1));
      }
      if (
        canWrite &&
        duplicates.length > 0
      ) {
        await Promise.allSettled(
          duplicates.map((item) => api(`/api/outreach/templates/${item.id}`, { method: "DELETE" }))
        );
      }
      setTemplates(keep);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Templates could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [canWrite]);

  useEffect(() => { void load(); }, [load]);

  function updateForm(key: keyof ReturnType<typeof emptyForm>, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleFillIn(id: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      fillIns: checked
        ? [...current.fillIns, id]
        : current.fillIns.filter((item) => item !== id)
    }));
  }

  function openCreate(channel = "email") {
    setEditingId(null);
    setForm(emptyForm(channel));
    setDrawerOpen(true);
  }

  function openTemplate(item: Row) {
    setEditingId(item.id);
    setForm(formFromTemplate(item));
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (saving) return;
    setDrawerOpen(false);
    setEditingId(null);
  }

  async function removeTemplate() {
    if (!canWrite || !editingId) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/outreach/templates/${editingId}`, { method: "DELETE" });
      setForm(emptyForm());
      setEditingId(null);
      setDrawerOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Template could not be removed.");
    } finally {
      setSaving(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
    const payload = {
      name: form.name,
      channel: form.channel,
      purpose: form.purpose,
      subject: form.subject,
      body: form.body,
      requiredVariables: form.fillIns,
      requiredComplianceBlocks: form.channel === "email" ? ["sender_identity", "opt_out"] : []
    };
    try {
      if (editingId) {
        await api(`/api/outreach/templates/${editingId}/versions`, {
          method: "POST",
          body: payload
        });
      } else {
        await api("/api/outreach/templates", {
          method: "POST",
          body: payload
        });
      }
      setForm(emptyForm());
      setEditingId(null);
      setDrawerOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Template could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const drawerTitle = editingId ? "Edit template" : "Create template";
  const drawerDescription = editingId
    ? "Review the wording, then save your changes. Earlier copies stay available for messages that already used them."
    : "Draft once, reuse later. Saving keeps this wording as-is for future messages.";

  return (
    <div className="page ry-outreach-page">
      <PageHeader
        title="Templates"
        action={(
          <div className="ry-outreach-header-actions">
            {canWrite ? (
              <Button onClick={() => openCreate()}>Create template</Button>
            ) : (
              <Button disabled>Read-only access</Button>
            )}
            <Link className="ry-button ry-button-secondary" to="/outreach">Back to outreach</Link>
          </div>
        )}
      />
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}
      {!canWrite ? (
        <Alert tone="warning" className="ry-outreach-alert" title="Read-only template library">
          You may inspect templates, but cannot create new ones in this session.
        </Alert>
      ) : null}

      {loading ? <LoadingState label="Loading templates" /> : (
        <section className="ry-register-surface ry-outreach-library" aria-label="Template library">
          <div className="ry-outreach-library-channels">
            {templateChannels.map((channel) => {
              const items = templatesByChannel.get(channel) ?? [];
              return (
                <section key={channel} className="ry-outreach-library-channel" aria-label={`${readable(channel)} templates`}>
                  <header className="ry-outreach-library-channel-heading">
                    <h3>{readable(channel)}</h3>
                    <span>{items.length}</span>
                  </header>
                  {items.length === 0 ? (
                    <EmptyState
                      compact
                      className="ry-outreach-empty"
                      description={`No ${readable(channel).toLowerCase()} templates yet.`}
                      action={canWrite ? (
                        <Button variant="secondary" size="compact" onClick={() => openCreate(channel)}>
                          Create {readable(channel).toLowerCase()} template
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
                          onClick={() => openTemplate(item)}
                        >
                          <h3 title={displayNameTitle(item.name)}>{displayName(item.name)}</h3>
                          <small>{displayPurpose(item.purpose)}</small>
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
        title={drawerTitle}
        description={drawerDescription}
        onClose={closeDrawer}
        size="standard"
        className="ry-outreach-template-drawer"
      >
        <form className="ry-outreach-template-form" onSubmit={(event) => void save(event)}>
          <div className="ry-outreach-template-grid">
            <Field label="Name" className="ry-outreach-prepare-span">
              <Input required controlSize="compact" value={form.name} onChange={(event) => updateForm("name", event.target.value)} disabled={!canWrite || saving} />
            </Field>
            <Field label="Channel">
              <Select controlSize="compact" value={form.channel} onChange={(event) => updateForm("channel", event.target.value)} disabled={!canWrite || saving}>
                {templateChannels.map((item) => (
                  <option key={item} value={item}>{readable(item)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Used for">
              <Select required controlSize="compact" value={form.purpose} onChange={(event) => updateForm("purpose", event.target.value)} disabled={!canWrite || saving}>
                {templateUses.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </Select>
            </Field>
            <fieldset className="ry-outreach-fill-ins ry-outreach-prepare-span">
              <legend>Fill-in names</legend>
              <p>Choose what can be personalized when this template is used.</p>
              <div className="ry-outreach-fill-ins-grid">
                {fillInOptions.map((item) => (
                  <Checkbox
                    key={item.id}
                    label={item.label}
                    checked={form.fillIns.includes(item.id)}
                    disabled={!canWrite || saving}
                    onChange={(event) => toggleFillIn(item.id, event.target.checked)}
                  />
                ))}
              </div>
            </fieldset>
            <Field label="Subject" className="ry-outreach-prepare-span">
              <Input controlSize="compact" value={form.subject} onChange={(event) => updateForm("subject", event.target.value)} disabled={!canWrite || saving} />
            </Field>
            <Field label="Body" className="ry-outreach-prepare-span">
              <TextArea required rows={4} value={form.body} onChange={(event) => updateForm("body", event.target.value)} disabled={!canWrite || saving} />
            </Field>
          </div>
          <div className="ry-outreach-call-actions">
            {editingId && canWrite ? (
              <Button type="button" variant="destructive" size="compact" disabled={saving} onClick={() => void removeTemplate()}>
                Remove
              </Button>
            ) : null}
            <Button type="button" variant="secondary" size="compact" disabled={saving} onClick={closeDrawer}>
              {canWrite ? "Cancel" : "Close"}
            </Button>
            {canWrite ? (
              <Button type="submit" size="compact" loading={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Save template"}
              </Button>
            ) : null}
          </div>
        </form>
      </Drawer>
    </div>
  );
}
