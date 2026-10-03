import { type FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  Checkbox,
  ConfirmationDialog,
  Dialog,
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
import { formatSessionClient, formatSessionWhen } from "./sessionPresentation";

type Settings = {
  workspaceId: string;
  quietHours: Record<string, unknown>;
  notificationPreferences: Record<string, unknown>;
  taskDefaults: Record<string, unknown>;
  aiPreferences: Record<string, unknown>;
  version: number;
};

type Profile = {
  userId: string;
  workspaceId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  timeZone: string;
  locale: string;
  professionalTitle: string;
  outreachName: string;
  outreachSignature: string;
  currency: string;
  categoryInterests: string[];
  businessTypeInterests: string[];
  geographicPreferences: string[];
  experienceLevel: string;
  workingHours: Record<string, unknown>;
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

const stringSetting = (value: unknown, fallback: string) =>
  typeof value === "string" || typeof value === "number" ? String(value) : fallback;

const sections = [
  { id: "profile", label: "Profile & account" },
  { id: "preferences", label: "Preferences" },
  { id: "ai", label: "AI assistance" },
  { id: "security", label: "Security" },
  { id: "closure", label: "Account closure" }
] as const;

type SectionId = (typeof sections)[number]["id"];

function defaultDisplayName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

export function SettingsWorkspacePage() {
  const { session, refresh } = useAuth();
  const canWriteSettings = session?.access.capabilities.includes("settings:write") ?? false;
  const canWriteProfile = session?.access.capabilities.includes("profile:write") ?? false;
  const canReadProfile = session?.access.capabilities.includes("profile:read") ?? false;
  const workspaceId = session?.user.workspaceId ?? "";

  const settings = useLoad(
    () => api<{ settings: Settings }>(`/api/workspaces/${workspaceId}/settings`),
    [workspaceId]
  );
  const profile = useLoad(
    () =>
      canReadProfile
        ? api<{ profile: Profile }>(`/api/workspaces/${workspaceId}/profile`)
        : Promise.resolve(null),
    [workspaceId, canReadProfile]
  );
  const sessions = useLoad(() => api<{ sessions: SessionItem[] }>("/api/sessions"), []);

  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const [form, setForm] = useState({
    quietStart: "20:00",
    quietEnd: "08:00",
    emailNotifications: true,
    overdueReminder: true,
    staleDays: "7",
    aiEnabled: false
  });
  const [identity, setIdentity] = useState({ firstName: "", lastName: "", displayName: "" });
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<SessionItem | null>(null);
  const [closureReason, setClosureReason] = useState("");
  const [closureExport, setClosureExport] = useState(true);
  const [closureStatus, setClosureStatus] = useState("");
  const [closureOpen, setClosureOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({ newEmail: "", currentPassword: "" });
  const [emailError, setEmailError] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

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

  useEffect(() => {
    const value = profile.data?.profile;
    if (!value) return;
    setIdentity({
      firstName: value.firstName ?? "",
      lastName: value.lastName ?? "",
      displayName: value.name ?? ""
    });
    setDisplayNameTouched(false);
  }, [profile.data]);

  const orderedSessions = useMemo(() => {
    const list = sessions.data?.sessions ?? [];
    return [...list].sort((a, b) => Number(b.current) - Number(a.current));
  }, [sessions.data]);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!settings.data || !canWriteSettings) return;
    setSaving(true);
    setSaved("");
    setError("");
    try {
      const result = await api<{ settings: Settings }>(`/api/workspaces/${workspaceId}/settings`, {
        method: "PUT",
        body: {
          version: settings.data.settings.version,
          quietHours: { start: form.quietStart, end: form.quietEnd },
          notificationPreferences: { email: form.emailNotifications, overdue: form.overdueReminder },
          taskDefaults: { staleDays: Number(form.staleDays) },
          aiPreferences: {
            enabled: form.aiEnabled,
            providerTrainingAllowed: false,
            evidenceCitationsRequired: true,
            numericalScoringAllowed: false,
            autonomousActionsAllowed: false
          }
        }
      });
      settings.setData(result);
      setSaved(activeSection === "ai" ? "AI settings saved." : "Preferences saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function saveIdentity(event: FormEvent) {
    event.preventDefault();
    if (!profile.data || !canWriteProfile) return;
    setSaving(true);
    setSaved("");
    setError("");
    const firstName = identity.firstName.trim();
    const lastName = identity.lastName.trim();
    const composed = defaultDisplayName(firstName, lastName);
    const displayName = (displayNameTouched ? identity.displayName : identity.displayName || composed).trim() || composed;
    try {
      const current = profile.data.profile;
      const result = await api<{ profile: Profile }>(`/api/workspaces/${workspaceId}/profile`, {
        method: "PUT",
        body: {
          version: current.version,
          firstName,
          lastName,
          name: displayName,
          timeZone: current.timeZone,
          locale: current.locale,
          professionalTitle: current.professionalTitle,
          outreachName: current.outreachName,
          outreachSignature: current.outreachSignature,
          currency: current.currency,
          categoryInterests: current.categoryInterests,
          businessTypeInterests: current.businessTypeInterests,
          geographicPreferences: current.geographicPreferences,
          experienceLevel: current.experienceLevel,
          workingHours: current.workingHours
        }
      });
      profile.setData(result);
      await refresh();
      setSaved("Profile saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function revoke() {
    if (!sessionToRevoke) return;
    setError("");
    try {
      await api<void>(`/api/sessions/${sessionToRevoke.id}`, { method: "DELETE" });
      setSessionToRevoke(null);
      await sessions.reload();
      if (sessionToRevoke.current) await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Session could not be revoked.");
    }
  }

  async function requestClosure() {
    if (!canWriteSettings) return;
    setClosing(true);
    setError("");
    setClosureStatus("");
    try {
      const result = await api<{ status: string }>("/api/account-closure", {
        method: "POST",
        body: { reason: closureReason, requestExport: closureExport }
      });
      setClosureStatus(result.status);
      setClosureOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account closure could not be requested.");
    } finally {
      setClosing(false);
    }
  }

  function openPasswordDialog() {
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordError("");
    setPasswordOpen(true);
  }

  function closePasswordDialog() {
    if (passwordSaving) return;
    setPasswordOpen(false);
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordError("");
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!canWriteProfile) return;
    setPasswordError("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    if (passwordForm.newPassword.length < 14) {
      setPasswordError("New password must be at least 14 characters.");
      return;
    }
    setPasswordSaving(true);
    try {
      await api<void>("/api/auth/password", {
        method: "POST",
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        }
      });
      setPasswordOpen(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSaved("Password updated.");
    } catch (caught) {
      setPasswordError(caught instanceof Error ? caught.message : "Password could not be changed.");
    } finally {
      setPasswordSaving(false);
    }
  }

  function openEmailDialog() {
    setEmailForm({
      newEmail: profile.data?.profile.email ?? "",
      currentPassword: ""
    });
    setEmailError("");
    setEmailOpen(true);
  }

  function closeEmailDialog() {
    if (emailSaving) return;
    setEmailOpen(false);
    setEmailForm({ newEmail: "", currentPassword: "" });
    setEmailError("");
  }

  async function changeEmail(event: FormEvent) {
    event.preventDefault();
    if (!canWriteProfile || !profile.data) return;
    setEmailError("");
    setEmailSaving(true);
    try {
      const result = await api<{ email: string }>("/api/auth/email", {
        method: "POST",
        body: {
          currentPassword: emailForm.currentPassword,
          newEmail: emailForm.newEmail.trim()
        }
      });
      profile.setData({
        profile: { ...profile.data.profile, email: result.email }
      });
      await refresh();
      setEmailOpen(false);
      setEmailForm({ newEmail: "", currentPassword: "" });
      setSaved("Email updated.");
    } catch (caught) {
      setEmailError(caught instanceof Error ? caught.message : "Email could not be changed.");
    } finally {
      setEmailSaving(false);
    }
  }

  function updateFirstName(value: string) {
    setIdentity((current) => {
      const next = { ...current, firstName: value };
      if (!displayNameTouched) {
        next.displayName = defaultDisplayName(value, current.lastName);
      }
      return next;
    });
  }

  function updateLastName(value: string) {
    setIdentity((current) => {
      const next = { ...current, lastName: value };
      if (!displayNameTouched) {
        next.displayName = defaultDisplayName(current.firstName, value);
      }
      return next;
    });
  }

  if (settings.loading && !settings.data) {
    return (
      <div className="page ry-settings-page">
        <PageHeader title="Settings" />
        <LoadingState label="Loading settings" />
      </div>
    );
  }

  if (settings.error && !settings.data) {
    return (
      <div className="page ry-settings-page">
        <PageHeader title="Settings" />
        <ErrorState
          message={settings.error}
          action={
            <Button variant="secondary" onClick={() => void settings.reload()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page ry-settings-page">
      <PageHeader title="Settings" />
      {!canWriteSettings && activeSection !== "profile" ? (
        <Alert tone="warning" title="Read-only settings">
          You may review controls, but this session cannot save workspace settings or request closure.
        </Alert>
      ) : null}
      {!canWriteProfile && activeSection === "profile" ? (
        <Alert tone="warning" title="Read-only profile">
          You may review this account, but this session cannot change it.
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="danger" title="Action unavailable">
          {error}
        </Alert>
      ) : null}
      {saved === "Password updated." ? (
        <Alert tone="success" title="Password updated">
          Your password has been changed for this account.
        </Alert>
      ) : null}
      {saved === "Email updated." ? (
        <Alert tone="success" title="Email updated">
          Use your new email the next time you sign in.
        </Alert>
      ) : null}

      <Tabs label="Settings sections" className="ry-settings-tabs">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={activeSection === section.id ? "active" : ""}
            onClick={() => {
              setActiveSection(section.id);
              setSaved("");
              setError("");
            }}
          >
            {section.label}
          </button>
        ))}
      </Tabs>

      {activeSection === "profile" ? (
        <div className="ry-settings-stack">
          {profile.loading && !profile.data ? <LoadingState label="Loading account" /> : null}
          {profile.error && !profile.data ? (
            <ErrorState
              message={profile.error}
              action={
                <Button variant="secondary" onClick={() => void profile.reload()}>
                  Try again
                </Button>
              }
            />
          ) : null}
          {profile.data ? (
            <>
              <form className="ry-settings-panel" onSubmit={(event) => void saveIdentity(event)}>
                <header className="ry-settings-section-heading">
                  <p className="ry-settings-kicker">Profile &amp; account</p>
                  <h2>Personal information</h2>
                  <p className="ry-settings-fine-print">
                    This is the same account identity created when you joined Ryva. Display name is how you appear across the workspace.
                  </p>
                </header>
                <div className="ry-settings-form-grid">
                  <Field label="First name" required>
                    <Input
                      required
                      maxLength={80}
                      autoComplete="given-name"
                      controlSize="compact"
                      value={identity.firstName}
                      onChange={(event) => updateFirstName(event.target.value)}
                      disabled={!canWriteProfile}
                    />
                  </Field>
                  <Field label="Last name">
                    <Input
                      maxLength={80}
                      autoComplete="family-name"
                      controlSize="compact"
                      value={identity.lastName}
                      onChange={(event) => updateLastName(event.target.value)}
                      disabled={!canWriteProfile}
                    />
                  </Field>
                  <Field className="ry-settings-span-2" label="Display name" required hint="Defaults to first and last name. Used throughout Ryva.">
                    <Input
                      required
                      maxLength={120}
                      autoComplete="nickname"
                      controlSize="compact"
                      value={identity.displayName}
                      onChange={(event) => {
                        setDisplayNameTouched(true);
                        setIdentity((current) => ({ ...current, displayName: event.target.value }));
                      }}
                      disabled={!canWriteProfile}
                    />
                  </Field>
                </div>
                <div className="ry-settings-actions">
                  <Button type="submit" loading={saving} disabled={!canWriteProfile}>
                    {canWriteProfile ? "Save changes" : "Read-only access"}
                  </Button>
                  {saved === "Profile saved." ? <span role="status">{saved}</span> : null}
                </div>
              </form>

              <section className="ry-settings-panel ry-settings-panel-soft">
                <header className="ry-settings-section-heading">
                  <h2>Login email</h2>
                  <p className="ry-settings-fine-print">Used to sign in and receive important account notices.</p>
                </header>
                <div className="ry-settings-credential-row">
                  <div>
                    <strong className="ry-settings-credential-value">{profile.data.profile.email}</strong>
                    <small className="ry-settings-muted">Requires your current password to change.</small>
                  </div>
                  <Button variant="secondary" disabled={!canWriteProfile} onClick={openEmailDialog}>
                    Change email
                  </Button>
                </div>
              </section>

              <section className="ry-settings-panel ry-settings-panel-soft">
                <header className="ry-settings-section-heading">
                  <h2>Password</h2>
                  <p className="ry-settings-fine-print">Protect your account with a strong password.</p>
                </header>
                <div className="ry-settings-credential-row">
                  <div>
                    <strong className="ry-settings-credential-value" aria-hidden="true">
                      ••••••••••••
                    </strong>
                    <small className="ry-settings-muted">Requires your current password to change.</small>
                  </div>
                  <Button variant="secondary" disabled={!canWriteProfile} onClick={openPasswordDialog}>
                    Change password
                  </Button>
                </div>
              </section>
            </>
          ) : null}
        </div>
      ) : null}

      {activeSection === "preferences" && settings.data ? (
        <form className="ry-settings-panel" onSubmit={(event) => void saveSettings(event)}>
          <header className="ry-settings-section-heading">
            <p className="ry-settings-kicker">Preferences</p>
            <h2>Working hours &amp; workflow</h2>
            <p className="ry-settings-fine-print">Quiet hours mute non-urgent notices. Workflow defaults guide when work is considered stalled.</p>
          </header>

          <div className="ry-settings-subsection">
            <h3>Quiet hours</h3>
            <div className="ry-settings-form-grid">
              <Field label="Start">
                <Input
                  type="time"
                  controlSize="compact"
                  value={form.quietStart}
                  onChange={(event) => setForm({ ...form, quietStart: event.target.value })}
                  disabled={!canWriteSettings}
                />
              </Field>
              <Field label="End">
                <Input
                  type="time"
                  controlSize="compact"
                  value={form.quietEnd}
                  onChange={(event) => setForm({ ...form, quietEnd: event.target.value })}
                  disabled={!canWriteSettings}
                />
              </Field>
            </div>
          </div>

          <div className="ry-settings-subsection">
            <h3>Workflow defaults</h3>
            <div className="ry-settings-form-grid">
              <Field label="Default stalled threshold">
                <Select
                  controlSize="compact"
                  value={form.staleDays}
                  onChange={(event) => setForm({ ...form, staleDays: event.target.value })}
                  disabled={!canWriteSettings}
                >
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="10">10 days</option>
                  <option value="14">14 days</option>
                </Select>
              </Field>
            </div>
          </div>

          <div className="ry-settings-subsection">
            <h3>Notifications</h3>
            <fieldset className="ry-settings-choice-group">
              <legend className="sr-only">Notification preferences</legend>
              <Checkbox
                label="Email operational notices"
                checked={form.emailNotifications}
                onChange={(event) => setForm({ ...form, emailNotifications: event.target.checked })}
                disabled={!canWriteSettings}
              />
              <Checkbox
                label="Overdue action reminders"
                checked={form.overdueReminder}
                onChange={(event) => setForm({ ...form, overdueReminder: event.target.checked })}
                disabled={!canWriteSettings}
              />
            </fieldset>
          </div>

          <div className="ry-settings-actions">
            <Button type="submit" loading={saving} disabled={!canWriteSettings}>
              {canWriteSettings ? "Save preferences" : "Read-only access"}
            </Button>
            {saved === "Preferences saved." ? <span role="status">{saved}</span> : null}
          </div>
        </form>
      ) : null}

      {activeSection === "ai" ? (
        <form className="ry-settings-panel" onSubmit={(event) => void saveSettings(event)}>
          <header className="ry-settings-section-heading">
            <p className="ry-settings-kicker">AI assistance</p>
            <h2>Evidence-first assistance</h2>
            <p className="ry-settings-fine-print">
              Ryva can surface reviewable suggestions while keeping source context and review history attached.
            </p>
          </header>

          <Switch
            label="Reviewable suggestions"
            description="Suggestions remain reviewable by the user. Provider training, autonomous actions, and numerical scoring remain disabled."
            checked={form.aiEnabled}
            onChange={(event) => setForm({ ...form, aiEnabled: event.target.checked })}
            disabled={!canWriteSettings}
          />

          <div className="ry-settings-split-lists" aria-label="AI assistance boundaries">
            <section className="ry-settings-info-block">
              <h3>What Ryva AI can do</h3>
              <ul>
                <li>Surface reviewable suggestions</li>
                <li>Preserve supporting evidence</li>
                <li>Assist with research and workflow decisions</li>
              </ul>
            </section>
            <section className="ry-settings-info-block">
              <h3>What remains manual</h3>
              <ul>
                <li>Final approvals</li>
                <li>Commercial decisions</li>
                <li>Authority / representation decisions</li>
                <li>Irreversible actions</li>
              </ul>
            </section>
          </div>

          <p className="ry-settings-fine-print">Manual workflows remain available. Provider training, numerical scoring, and autonomous actions stay off.</p>

          <div className="ry-settings-actions">
            <Button type="submit" loading={saving} disabled={!canWriteSettings}>
              {canWriteSettings ? "Save AI settings" : "Read-only access"}
            </Button>
            {saved === "AI settings saved." ? <span role="status">{saved}</span> : null}
          </div>
        </form>
      ) : null}

      {activeSection === "security" ? (
        <div className="ry-settings-stack">
          <section className="ry-settings-panel">
            <header className="ry-settings-section-heading">
              <p className="ry-settings-kicker">Security</p>
              <h2>Active sessions</h2>
              <p className="ry-settings-fine-print">Review where this account is signed in and revoke devices you no longer use.</p>
            </header>
            {sessions.loading ? <LoadingState label="Loading sessions" /> : null}
            {sessions.error ? (
              <ErrorState
                message={sessions.error}
                action={
                  <Button variant="secondary" onClick={() => void sessions.reload()}>
                    Try again
                  </Button>
                }
              />
            ) : null}
            <div className="ry-settings-session-list">
              {orderedSessions.map((item) => {
                const client = formatSessionClient(item.userAgent);
                return (
                  <article key={item.id} className={item.current ? "is-current" : undefined}>
                    <div>
                      <strong>{item.current ? "Current session" : "Other session"}</strong>
                      <span className="ry-settings-session-client">{client.label}</span>
                      <small>{item.current ? "Active now" : `Last active ${formatSessionWhen(item.lastSeenAt)}`}</small>
                      {client.detail ? <small className="ry-settings-session-raw">{client.detail}</small> : null}
                    </div>
                    <Button variant="destructive" onClick={() => setSessionToRevoke(item)}>
                      {item.current ? "Sign out this session" : "Revoke"}
                    </Button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="ry-settings-panel ry-settings-panel-soft">
            <header className="ry-settings-section-heading">
              <h2>Account security</h2>
              <p className="ry-settings-fine-print">Protect your account with a strong password.</p>
            </header>
            <div className="ry-settings-credential-row">
              <div>
                <strong>Password</strong>
                <small className="ry-settings-muted">Requires your current password to change.</small>
              </div>
              <Button variant="secondary" disabled={!canWriteProfile} onClick={openPasswordDialog}>
                Change password
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {activeSection === "closure" ? (
        <section className="ry-settings-panel ry-settings-closure">
          <header className="ry-settings-section-heading">
            <p className="ry-settings-kicker">Account closure</p>
            <h2>Account closure</h2>
            <p className="ry-settings-fine-print">
              Closure is a reviewed, reversible request. Legal holds, contractual rights, commercial history, and required audit records are preserved.
            </p>
          </header>
          <Field label="Reason for closure">
            <TextArea
              rows={4}
              value={closureReason}
              onChange={(event) => setClosureReason(event.target.value)}
              disabled={!canWriteSettings}
            />
          </Field>
          <Checkbox
            label="Prepare my data export before closure review"
            checked={closureExport}
            onChange={(event) => setClosureExport(event.target.checked)}
            disabled={!canWriteSettings}
          />
          <div className="ry-settings-actions ry-settings-actions-danger">
            <Button
              className="ry-settings-danger-button"
              variant="secondary"
              disabled={!canWriteSettings || closureReason.trim().length < 10}
              onClick={() => setClosureOpen(true)}
            >
              Request account closure review
            </Button>
            {closureStatus ? (
              <span role="status">Request recorded: {closureStatus.replaceAll("_", " ")}.</span>
            ) : null}
          </div>
        </section>
      ) : null}

      <ConfirmationDialog
        open={Boolean(sessionToRevoke)}
        title="Revoke this session?"
        description="This device will need to sign in again to continue."
        consequence={<p>{formatSessionClient(sessionToRevoke?.userAgent ?? null).label}</p>}
        confirmLabel={sessionToRevoke?.current ? "Sign out this session" : "Revoke"}
        confirmVariant="destructive"
        onConfirm={() => void revoke()}
        onClose={() => setSessionToRevoke(null)}
      />
      <ConfirmationDialog
        open={closureOpen}
        title="Request account closure review?"
        description="Ryva will record a reviewed, reversible closure request."
        consequence={
          <p>{closureExport ? "A data export will be prepared before review." : "No data export has been requested."}</p>
        }
        confirmLabel="Request account closure review"
        confirmVariant="destructive"
        processing={closing}
        onConfirm={() => void requestClosure()}
        onClose={() => setClosureOpen(false)}
      />
      <Dialog
        open={emailOpen}
        title="Change email"
        description="Enter the new address you will use to sign in, then confirm with your current password."
        size="narrow"
        onClose={closeEmailDialog}
        footer={
          <>
            <Button variant="secondary" disabled={emailSaving} onClick={closeEmailDialog}>
              Cancel
            </Button>
            <Button type="submit" form="ry-change-email-form" loading={emailSaving} disabled={!canWriteProfile}>
              Update email
            </Button>
          </>
        }
      >
        <form id="ry-change-email-form" className="ry-settings-password-form" onSubmit={(event) => void changeEmail(event)}>
          {emailError ? <Alert tone="danger" title="Email not updated">{emailError}</Alert> : null}
          <Field label="New email" required>
            <Input
              type="email"
              required
              autoComplete="email"
              controlSize="compact"
              value={emailForm.newEmail}
              onChange={(event) => setEmailForm((current) => ({ ...current, newEmail: event.target.value }))}
              disabled={emailSaving}
            />
          </Field>
          <Field label="Current password" required>
            <Input
              type="password"
              required
              autoComplete="current-password"
              controlSize="compact"
              value={emailForm.currentPassword}
              onChange={(event) => setEmailForm((current) => ({ ...current, currentPassword: event.target.value }))}
              disabled={emailSaving}
            />
          </Field>
        </form>
      </Dialog>
      <Dialog
        open={passwordOpen}
        title="Change password"
        description="Enter your current password, then choose a new one. New passwords must be at least 14 characters."
        size="narrow"
        onClose={closePasswordDialog}
        footer={
          <>
            <Button variant="secondary" disabled={passwordSaving} onClick={closePasswordDialog}>
              Cancel
            </Button>
            <Button type="submit" form="ry-change-password-form" loading={passwordSaving} disabled={!canWriteProfile}>
              Update password
            </Button>
          </>
        }
      >
        <form id="ry-change-password-form" className="ry-settings-password-form" onSubmit={(event) => void changePassword(event)}>
          {passwordError ? <Alert tone="danger" title="Password not updated">{passwordError}</Alert> : null}
          <Field label="Current password" required>
            <Input
              type="password"
              required
              autoComplete="current-password"
              controlSize="compact"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
              disabled={passwordSaving}
            />
          </Field>
          <Field label="New password" required hint="At least 14 characters.">
            <Input
              type="password"
              required
              minLength={14}
              maxLength={256}
              autoComplete="new-password"
              controlSize="compact"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
              disabled={passwordSaving}
            />
          </Field>
          <Field label="Confirm new password" required>
            <Input
              type="password"
              required
              minLength={14}
              maxLength={256}
              autoComplete="new-password"
              controlSize="compact"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              disabled={passwordSaving}
            />
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
