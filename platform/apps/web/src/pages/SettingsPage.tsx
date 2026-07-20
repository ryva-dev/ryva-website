import { type FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorPanel, Field, Loading, PageHeader } from "../components";
import { useLoad } from "../hooks";

type Settings = {
  workspaceId: string;
  quietHours: Record<string, unknown>;
  notificationPreferences: Record<string, unknown>;
  taskDefaults: Record<string, unknown>;
  aiPreferences: Record<string, unknown>;
  version: number;
};

type SessionItem = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
  current: boolean;
};

function stringSetting(value: unknown, fallback: string): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

export function SettingsPage() {
  const { session } = useAuth();
  const canWrite = session?.access.capabilities.includes("settings:write") ?? false;
  const workspaceId = session?.user.workspaceId ?? "";
  const settings = useLoad(
    () => api<{ settings: Settings }>(`/api/workspaces/${workspaceId}/settings`),
    [workspaceId]
  );
  const sessions = useLoad(() => api<{ sessions: SessionItem[] }>("/api/sessions"), []);
  const [form, setForm] = useState({
    quietStart: "20:00",
    quietEnd: "08:00",
    emailNotifications: true,
    overdueReminder: true,
    staleDays: "7",
    aiEnabled: false
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closureReason,setClosureReason]=useState("");
  const [closureExport,setClosureExport]=useState(true);
  const [closureStatus,setClosureStatus]=useState("");

  useEffect(() => {
    const value = settings.data?.settings;
    if (!value) return;
    setForm({
      quietStart: stringSetting(value.quietHours.start, "20:00"),
      quietEnd: stringSetting(value.quietHours.end, "08:00"),
      emailNotifications: value.notificationPreferences.email !== false,
      overdueReminder: value.notificationPreferences.overdue !== false,
      staleDays: stringSetting(value.taskDefaults.staleDays, "7"),
      aiEnabled: value.aiPreferences.enabled === true
    });
  }, [settings.data]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings.data) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const result = await api<{ settings: Settings }>(
        `/api/workspaces/${workspaceId}/settings`,
        {
          method: "PUT",
          body: {
            version: settings.data.settings.version,
            quietHours: { start: form.quietStart, end: form.quietEnd },
            notificationPreferences: {
              email: form.emailNotifications,
              overdue: form.overdueReminder
            },
            taskDefaults: { staleDays: Number(form.staleDays) },
            aiPreferences: {
              enabled: form.aiEnabled,
              providerTrainingAllowed: false,
              evidenceCitationsRequired: true,
              numericalScoringAllowed: false,
              autonomousActionsAllowed: false
            }
          }
        }
      );
      settings.setData(result);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(id: string) {
    setError("");
    try {
      await api<void>(`/api/sessions/${id}`, { method: "DELETE" });
      await sessions.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Session could not be revoked.");
    }
  }
  async function requestClosure(){
    setError("");setClosureStatus("");
    try{
      const result=await api<{status:string}>("/api/account-closure",{
        method:"POST",body:{reason:closureReason,requestExport:closureExport}
      });
      setClosureStatus(result.status);
    }catch(caught){
      setError(caught instanceof Error?caught.message:"Account closure could not be requested.");
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workspace controls"
        title="Settings"
        description="Set regional and attention defaults, review secure sessions, and keep mandatory controls intact."
      />
      {settings.loading ? <Loading label="Loading settings" /> : null}
      {settings.error ? <ErrorPanel message={settings.error} /> : null}
      {error ? <ErrorPanel message={error} /> : null}
      {settings.data ? (
        <form className="panel" onSubmit={(event) => void save(event)}>
          <div className="section-heading">
            <div><p className="eyebrow">Attention defaults</p><h2>Working preferences</h2></div>
          </div>
          <div className="form-grid">
            <Field label="Quiet hours start"><input type="time" value={form.quietStart} onChange={(event) => setForm({ ...form, quietStart: event.target.value })} /></Field>
            <Field label="Quiet hours end"><input type="time" value={form.quietEnd} onChange={(event) => setForm({ ...form, quietEnd: event.target.value })} /></Field>
            <Field label="Default stalled threshold">
              <select value={form.staleDays} onChange={(event) => setForm({ ...form, staleDays: event.target.value })}>
                <option value="3">3 days</option><option value="7">7 days</option><option value="10">10 days</option><option value="14">14 days</option>
              </select>
            </Field>
            <div className="field checkbox-group">
              <span>Notifications</span>
              <label><input type="checkbox" checked={form.emailNotifications} onChange={(event) => setForm({ ...form, emailNotifications: event.target.checked })} /> Email operational notices</label>
              <label><input type="checkbox" checked={form.overdueReminder} onChange={(event) => setForm({ ...form, overdueReminder: event.target.checked })} /> Overdue action reminders</label>
            </div>
          </div>
          <div className="locked-setting">
            <div><strong>Evidence-first AI assistance</strong><p>Suggestions retain sources, classifications, limitations, model metadata, and human review history. Manual workflows remain available.</p></div>
            <label><input type="checkbox" checked={form.aiEnabled}
              onChange={(event) => setForm({ ...form, aiEnabled: event.target.checked })} />
              Enable reviewable suggestions
            </label>
          </div>
          <div className="form-actions">
            <button className="primary-button" disabled={saving || !canWrite}>
              {saving ? "Saving…" : canWrite ? "Save settings" : "Read-only access"}
            </button>
            {saved ? <span className="success-message" role="status">Settings saved.</span> : null}
          </div>
        </form>
      ) : null}
      <section className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">Security</p><h2>Active sessions</h2></div>
        </div>
        {sessions.loading ? <Loading label="Loading sessions" /> : null}
        {sessions.error ? <ErrorPanel message={sessions.error} /> : null}
        <div className="session-list">
          {sessions.data?.sessions.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.current ? "This session" : "Signed-in session"}</strong>
                <small>{item.userAgent ?? "Unknown client"}</small>
                <small>Last seen {new Date(item.lastSeenAt).toLocaleString()}</small>
              </div>
              <button className="text-button danger-text" onClick={() => void revoke(item.id)}>
                {item.current ? "Sign out this session" : "Revoke"}
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Privacy and portability</p>
          <h2>Account closure request</h2></div></div>
        <p>Closure is a reviewed, reversible request. Active legal holds, contractual rights, commercial history, and required audit records are preserved.</p>
        <Field label="Reason for closure"><textarea rows={3} value={closureReason}
          onChange={event=>setClosureReason(event.target.value)} /></Field>
        <label className="check-row"><input type="checkbox" checked={closureExport}
          onChange={event=>setClosureExport(event.target.checked)} />
          <span>Prepare my data export before closure review</span></label>
        <button className="secondary-button" disabled={!canWrite||closureReason.trim().length<10}
          onClick={()=>void requestClosure()}>Request account closure review</button>
        {closureStatus?<p className="success-message" role="status">Request recorded: {closureStatus.replaceAll("_"," ")}.</p>:null}
      </section>
    </div>
  );
}
