import { type FormEvent, useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  Checkbox,
  ConfirmationDialog,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Switch,
  Tabs,
  TextArea
} from "../../design-system";
import { useLoad } from "../../hooks";

type Settings = { workspaceId: string; quietHours: Record<string, unknown>; notificationPreferences: Record<string, unknown>; taskDefaults: Record<string, unknown>; aiPreferences: Record<string, unknown>; version: number };
type SessionItem = { id: string; createdAt: string; lastSeenAt: string; expiresAt: string; userAgent: string | null; current: boolean };

const stringSetting = (value: unknown, fallback: string) => typeof value === "string" || typeof value === "number" ? String(value) : fallback;

export function SettingsWorkspacePage() {
  const { session } = useAuth();
  const canWrite = session?.access.capabilities.includes("settings:write") ?? false;
  const workspaceId = session?.user.workspaceId ?? "";
  const settings = useLoad(() => api<{ settings: Settings }>(`/api/workspaces/${workspaceId}/settings`), [workspaceId]);
  const sessions = useLoad(() => api<{ sessions: SessionItem[] }>("/api/sessions"), []);
  const [activeSection, setActiveSection] = useState("preferences");
  const [form, setForm] = useState({ quietStart: "20:00", quietEnd: "08:00", emailNotifications: true, overdueReminder: true, staleDays: "7", aiEnabled: false });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<SessionItem | null>(null);
  const [closureReason, setClosureReason] = useState("");
  const [closureExport, setClosureExport] = useState(true);
  const [closureStatus, setClosureStatus] = useState("");
  const [closureOpen, setClosureOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const value = settings.data?.settings;
    if (!value) return;
    setForm({
      quietStart: stringSetting(value.quietHours.start, "20:00"), quietEnd: stringSetting(value.quietHours.end, "08:00"),
      emailNotifications: value.notificationPreferences.email !== false, overdueReminder: value.notificationPreferences.overdue !== false,
      staleDays: stringSetting(value.taskDefaults.staleDays, "7"), aiEnabled: value.aiPreferences.enabled === true
    });
  }, [settings.data]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings.data || !canWrite) return;
    setSaving(true); setSaved(false); setError("");
    try {
      const result = await api<{ settings: Settings }>(`/api/workspaces/${workspaceId}/settings`, {
        method: "PUT",
        body: {
          version: settings.data.settings.version,
          quietHours: { start: form.quietStart, end: form.quietEnd },
          notificationPreferences: { email: form.emailNotifications, overdue: form.overdueReminder },
          taskDefaults: { staleDays: Number(form.staleDays) },
          aiPreferences: { enabled: form.aiEnabled, providerTrainingAllowed: false, evidenceCitationsRequired: true, numericalScoringAllowed: false, autonomousActionsAllowed: false }
        }
      });
      settings.setData(result); setSaved(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Settings could not be saved."); }
    finally { setSaving(false); }
  }

  async function revoke() {
    if (!sessionToRevoke) return;
    setError("");
    try { await api<void>(`/api/sessions/${sessionToRevoke.id}`, { method: "DELETE" }); setSessionToRevoke(null); await sessions.reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Session could not be revoked."); }
  }

  async function requestClosure() {
    if (!canWrite) return;
    setClosing(true); setError(""); setClosureStatus("");
    try {
      const result = await api<{ status: string }>("/api/account-closure", { method: "POST", body: { reason: closureReason, requestExport: closureExport } });
      setClosureStatus(result.status); setClosureOpen(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Account closure could not be requested."); }
    finally { setClosing(false); }
  }

  if (settings.loading && !settings.data) return <div className="page ry-settings-page"><PageHeader eyebrow="Workspace controls" title="Settings" description="Loading workspace controls." /><LoadingState label="Loading settings" /></div>;
  if (settings.error && !settings.data) return <div className="page ry-settings-page"><PageHeader eyebrow="Workspace controls" title="Settings" description="Workspace controls could not be loaded." /><ErrorState message={settings.error} action={<Button variant="secondary" onClick={() => void settings.reload()}>Try again</Button>} /></div>;

  return (
    <div className="page ry-settings-page">
      <PageHeader eyebrow="Workspace controls" title="Settings" description="Set regional and attention defaults, review secure sessions, and keep mandatory controls intact." />
      {!canWrite ? <Alert tone="warning" title="Read-only settings">You may review controls, but this session cannot save workspace settings or request closure.</Alert> : null}
      {error ? <Alert tone="danger" title="Action unavailable">{error}</Alert> : null}
      <Tabs label="Settings sections" className="ry-settings-tabs">
        {["preferences", "ai", "sessions", "closure"].map((id) => <button key={id} type="button" className={activeSection === id ? "active" : ""} onClick={() => setActiveSection(id)}>{({ preferences: "Preferences", ai: "AI assistance", sessions: "Sessions & security", closure: "Account closure" })[id]}</button>)}
      </Tabs>
      {activeSection === "preferences" && settings.data ? <form className="panel ry-settings-panel" onSubmit={(event) => void save(event)}>
        <header className="ry-settings-section-heading"><p className="eyebrow">Attention defaults</p><h2>Working preferences</h2></header>
        <div className="ry-settings-form-grid">
          <Field label="Quiet hours start"><Input type="time" value={form.quietStart} onChange={(event) => setForm({ ...form, quietStart: event.target.value })} disabled={!canWrite} /></Field>
          <Field label="Quiet hours end"><Input type="time" value={form.quietEnd} onChange={(event) => setForm({ ...form, quietEnd: event.target.value })} disabled={!canWrite} /></Field>
          <Field label="Default stalled threshold"><Select value={form.staleDays} onChange={(event) => setForm({ ...form, staleDays: event.target.value })} disabled={!canWrite}><option value="3">3 days</option><option value="7">7 days</option><option value="10">10 days</option><option value="14">14 days</option></Select></Field>
          <div className="ry-settings-choice-group"><span>Notifications</span><Checkbox label="Email operational notices" checked={form.emailNotifications} onChange={(event) => setForm({ ...form, emailNotifications: event.target.checked })} disabled={!canWrite} /><Checkbox label="Overdue action reminders" checked={form.overdueReminder} onChange={(event) => setForm({ ...form, overdueReminder: event.target.checked })} disabled={!canWrite} /></div>
        </div>
        <div className="ry-settings-actions"><Button type="submit" loading={saving} disabled={!canWrite}>{canWrite ? "Save settings" : "Read-only access"}</Button>{saved ? <span role="status">Settings saved.</span> : null}</div>
      </form> : null}
      {activeSection === "ai" ? <form className="panel ry-settings-panel" onSubmit={(event) => void save(event)}><header className="ry-settings-section-heading"><p className="eyebrow">Reviewable assistance</p><h2>Evidence-first AI assistance</h2></header><Alert tone="info" title="Human control remains independent">Suggestions retain sources, classifications, limitations, model metadata, and human review history. Manual workflows remain available.</Alert><Switch label="Enable reviewable suggestions" description="Provider training, numerical scoring, and autonomous actions remain disabled." checked={form.aiEnabled} onChange={(event) => setForm({ ...form, aiEnabled: event.target.checked })} disabled={!canWrite} /><div className="ry-settings-actions"><Button type="submit" loading={saving} disabled={!canWrite}>{canWrite ? "Save settings" : "Read-only access"}</Button>{saved ? <span role="status">Settings saved.</span> : null}</div></form> : null}
      {activeSection === "sessions" ? <section className="panel ry-settings-panel"><header className="ry-settings-section-heading"><p className="eyebrow">Security</p><h2>Active sessions</h2></header>{sessions.loading ? <LoadingState label="Loading sessions" /> : null}{sessions.error ? <ErrorState message={sessions.error} action={<Button variant="secondary" onClick={() => void sessions.reload()}>Try again</Button>} /> : null}<div className="ry-settings-session-list">{sessions.data?.sessions.map((item) => <article key={item.id}><div><strong>{item.current ? "This session" : "Signed-in session"}</strong><small>{item.userAgent ?? "Unknown client"}</small><small>Last seen {new Date(item.lastSeenAt).toLocaleString()}</small></div><Button variant="destructive" onClick={() => setSessionToRevoke(item)}>{item.current ? "Sign out this session" : "Revoke"}</Button></article>)}</div></section> : null}
      {activeSection === "closure" ? <section className="panel ry-settings-panel"><header className="ry-settings-section-heading"><p className="eyebrow">Privacy and portability</p><h2>Account closure request</h2></header><p>Closure is a reviewed, reversible request. Active legal holds, contractual rights, commercial history, and required audit records are preserved.</p><Field label="Reason for closure"><TextArea rows={3} value={closureReason} onChange={(event) => setClosureReason(event.target.value)} disabled={!canWrite} /></Field><Checkbox label="Prepare my data export before closure review" checked={closureExport} onChange={(event) => setClosureExport(event.target.checked)} disabled={!canWrite} /><div className="ry-settings-actions"><Button variant="secondary" disabled={!canWrite || closureReason.trim().length < 10} onClick={() => setClosureOpen(true)}>Request account closure review</Button>{closureStatus ? <span role="status">Request recorded: {closureStatus.replaceAll("_", " ")}.</span> : null}</div></section> : null}
      <ConfirmationDialog open={Boolean(sessionToRevoke)} title="Revoke this session?" description="This device will need to sign in again to continue." consequence={<p>{sessionToRevoke?.userAgent ?? "Unknown client"}</p>} confirmLabel={sessionToRevoke?.current ? "Sign out this session" : "Revoke"} confirmVariant="destructive" onConfirm={() => void revoke()} onClose={() => setSessionToRevoke(null)} />
      <ConfirmationDialog open={closureOpen} title="Request account closure review?" description="Ryva will record a reviewed, reversible closure request." consequence={<p>{closureExport ? "A data export will be prepared before review." : "No data export has been requested."}</p>} confirmLabel="Request account closure review" confirmVariant="destructive" processing={closing} onConfirm={() => void requestClosure()} onClose={() => setClosureOpen(false)} />
    </div>
  );
}
