import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Alert, Button, ErrorState, Field, Input, LoadingState, PageHeader, Select, TextArea } from "../../design-system";
import { useLoad } from "../../hooks";

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

const join = (values: string[]) => values.join(", ");
const split = (value: string) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];

function defaultDisplayName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

export function ProfileWorkspacePage() {
  const { session, refresh } = useAuth();
  const canWrite = session?.access.capabilities.includes("profile:write") ?? false;
  const workspaceId = session?.user.workspaceId ?? "";
  const state = useLoad(() => api<{ profile: Profile }>(`/api/workspaces/${workspaceId}/profile`), [workspaceId]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const profile = state.data?.profile;
    if (!profile) return;
    setForm({
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      name: profile.name,
      timeZone: profile.timeZone,
      locale: profile.locale,
      professionalTitle: profile.professionalTitle,
      outreachName: profile.outreachName,
      outreachSignature: profile.outreachSignature,
      currency: profile.currency,
      categoryInterests: join(profile.categoryInterests),
      businessTypeInterests: join(profile.businessTypeInterests),
      geographicPreferences: join(profile.geographicPreferences),
      experienceLevel: profile.experienceLevel
    });
    setDisplayNameTouched(false);
  }, [state.data]);

  function field(name: string) {
    return {
      value: form[name] ?? "",
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((current) => ({ ...current, [name]: event.target.value }))
    };
  }

  function updateNamePart(part: "firstName" | "lastName", value: string) {
    setForm((current) => {
      const next = { ...current, [part]: value };
      if (!displayNameTouched) {
        next.name = defaultDisplayName(
          part === "firstName" ? value : current.firstName ?? "",
          part === "lastName" ? value : current.lastName ?? ""
        );
      }
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!state.data || !canWrite) return;
    setSaving(true);
    setError("");
    setSaved(false);
    const firstName = (form.firstName ?? "").trim();
    const lastName = (form.lastName ?? "").trim();
    const name = ((form.name ?? "").trim() || defaultDisplayName(firstName, lastName));
    try {
      const result = await api<{ profile: Profile }>(`/api/workspaces/${workspaceId}/profile`, {
        method: "PUT",
        body: {
          version: state.data.profile.version,
          firstName,
          lastName,
          name,
          timeZone: form.timeZone ?? "",
          locale: form.locale ?? "",
          professionalTitle: form.professionalTitle ?? "",
          outreachName: form.outreachName ?? "",
          outreachSignature: form.outreachSignature ?? "",
          currency: form.currency ?? "",
          categoryInterests: split(form.categoryInterests ?? ""),
          businessTypeInterests: split(form.businessTypeInterests ?? ""),
          geographicPreferences: split(form.geographicPreferences ?? ""),
          experienceLevel: form.experienceLevel ?? "not_set",
          workingHours: state.data.profile.workingHours
        }
      });
      state.setData(result);
      await refresh();
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (state.loading && !state.data) {
    return (
      <div className="page ry-settings-page ry-settings-page-wide">
        <PageHeader title="Profile" />
        <LoadingState label="Loading profile" />
      </div>
    );
  }

  if (state.error && !state.data) {
    return (
      <div className="page ry-settings-page ry-settings-page-wide">
        <PageHeader title="Profile" />
        <ErrorState message={state.error} action={<Button variant="secondary" onClick={() => void state.reload()}>Try again</Button>} />
      </div>
    );
  }

  return (
    <div className="page ry-settings-page ry-settings-page-wide">
      <PageHeader title="Profile" />
      {!canWrite ? <Alert tone="warning" title="Read-only profile">You may review this profile, but this session cannot change it.</Alert> : null}
      {error ? <Alert tone="danger" title="Profile unavailable">{error}</Alert> : null}

      {state.data ? (
        <form className="ry-settings-panel" onSubmit={(event) => void submit(event)}>
          <header className="ry-settings-section-heading">
            <h2>Identity</h2>
            <p className="ry-settings-fine-print">Account identity from signup. Display name is how you appear across Ryva.</p>
          </header>
          <div className="ry-settings-form-grid">
            <Field label="First name" required>
              <Input
                required
                maxLength={80}
                autoComplete="given-name"
                controlSize="compact"
                value={form.firstName ?? ""}
                onChange={(event) => updateNamePart("firstName", event.target.value)}
                disabled={!canWrite}
              />
            </Field>
            <Field label="Last name">
              <Input
                maxLength={80}
                autoComplete="family-name"
                controlSize="compact"
                value={form.lastName ?? ""}
                onChange={(event) => updateNamePart("lastName", event.target.value)}
                disabled={!canWrite}
              />
            </Field>
            <Field className="ry-settings-span-2" label="Display name" required>
              <Input
                required
                maxLength={120}
                autoComplete="nickname"
                controlSize="compact"
                value={form.name ?? ""}
                onChange={(event) => {
                  setDisplayNameTouched(true);
                  setForm((current) => ({ ...current, name: event.target.value }));
                }}
                disabled={!canWrite}
              />
            </Field>
            <Field label="Email" hint="Used to sign in. Verified login email cannot be changed here.">
              <Input value={state.data.profile.email} controlSize="compact" disabled />
            </Field>
            <Field label="Professional title">
              <Input maxLength={120} controlSize="compact" {...field("professionalTitle")} disabled={!canWrite} />
            </Field>
            <Field label="Outreach name">
              <Input maxLength={120} controlSize="compact" {...field("outreachName")} disabled={!canWrite} />
            </Field>
          </div>

          <header className="ry-settings-section-heading">
            <h2>Regional defaults</h2>
          </header>
          <div className="ry-settings-form-grid">
            <Field label="Time zone" required>
              <Input required maxLength={100} placeholder="America/New_York" controlSize="compact" {...field("timeZone")} disabled={!canWrite} />
            </Field>
            <Field label="Currency" required>
              <Input required pattern="[A-Z]{3}" maxLength={3} controlSize="compact" {...field("currency")} disabled={!canWrite} />
            </Field>
            <Field label="Locale" required>
              <Input required maxLength={20} placeholder="en-US" controlSize="compact" {...field("locale")} disabled={!canWrite} />
            </Field>
            <Field label="Experience">
              <Select controlSize="compact" {...field("experienceLevel")} disabled={!canWrite}>
                <option value="not_set">Not set</option>
                <option value="new">New to placement</option>
                <option value="developing">Developing practice</option>
                <option value="experienced">Experienced representative</option>
              </Select>
            </Field>
          </div>

          <header className="ry-settings-section-heading">
            <h2>Focus areas</h2>
          </header>
          <div className="ry-settings-form-grid">
            <Field label="Category interests" hint="Comma-separated">
              <Input controlSize="compact" {...field("categoryInterests")} disabled={!canWrite} />
            </Field>
            <Field label="Business types" hint="Comma-separated">
              <Input controlSize="compact" {...field("businessTypeInterests")} disabled={!canWrite} />
            </Field>
            <Field className="ry-settings-span-2" label="Geographic preferences" hint="Comma-separated">
              <Input controlSize="compact" {...field("geographicPreferences")} disabled={!canWrite} />
            </Field>
            <Field className="ry-settings-span-2" label="Outreach signature" hint="Used with approved outreach sends.">
              <TextArea rows={4} maxLength={4000} {...field("outreachSignature")} disabled={!canWrite} />
            </Field>
          </div>

          <div className="ry-settings-actions">
            <Button type="submit" loading={saving} disabled={!canWrite}>
              {canWrite ? "Save profile" : "Read-only access"}
            </Button>
            {saved ? <span role="status">Profile saved.</span> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
