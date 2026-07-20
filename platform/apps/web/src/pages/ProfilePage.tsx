import { type FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorPanel, Field, Loading, PageHeader } from "../components";
import { useLoad } from "../hooks";

type Profile = {
  userId: string;
  workspaceId: string;
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
const split = (value: string) =>
  [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];

export function ProfilePage() {
  const { session, refresh } = useAuth();
  const canWrite = session?.access.capabilities.includes("profile:write") ?? false;
  const workspaceId = session?.user.workspaceId ?? "";
  const state = useLoad(
    () => api<{ profile: Profile }>(`/api/workspaces/${workspaceId}/profile`),
    [workspaceId]
  );
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const profile = state.data?.profile;
    if (!profile) return;
    setForm({
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
  }, [state.data]);

  function field(name: string) {
    return {
      value: form[name] ?? "",
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((current) => ({ ...current, [name]: event.target.value }))
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!state.data) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const result = await api<{ profile: Profile }>(`/api/workspaces/${workspaceId}/profile`, {
        method: "PUT",
        body: {
          version: state.data.profile.version,
          name: form.name ?? "",
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

  return (
    <div className="page">
      <PageHeader
        eyebrow="Professional identity"
        title="Profile"
        description="These settings provide regional context and, where approved, your external communication identity."
      />
      {state.loading ? <Loading label="Loading profile" /> : null}
      {state.error ? <ErrorPanel message={state.error} /> : null}
      {error ? <ErrorPanel message={error} /> : null}
      {state.data ? (
        <form className="panel form-grid" onSubmit={(event) => void submit(event)}>
          <Field label="Full name"><input required maxLength={120} autoComplete="name" {...field("name")} /></Field>
          <Field label="Email" hint="Verified account email cannot be changed here.">
            <input value={state.data.profile.email} disabled />
          </Field>
          <Field label="Professional title"><input maxLength={120} {...field("professionalTitle")} /></Field>
          <Field label="Outreach name"><input maxLength={120} {...field("outreachName")} /></Field>
          <Field label="Time zone"><input required maxLength={100} placeholder="America/New_York" {...field("timeZone")} /></Field>
          <Field label="Currency"><input required pattern="[A-Z]{3}" maxLength={3} {...field("currency")} /></Field>
          <Field label="Locale"><input required maxLength={20} placeholder="en-US" {...field("locale")} /></Field>
          <Field label="Experience">
            <select {...field("experienceLevel")}>
              <option value="not_set">Not set</option>
              <option value="new">New to placement</option>
              <option value="developing">Developing practice</option>
              <option value="experienced">Experienced representative</option>
            </select>
          </Field>
          <Field label="Category interests" hint="Comma-separated"><input {...field("categoryInterests")} /></Field>
          <Field label="Business types" hint="Comma-separated"><input {...field("businessTypeInterests")} /></Field>
          <Field label="Geographic preferences" hint="Comma-separated"><input {...field("geographicPreferences")} /></Field>
          <Field label="Outreach signature" hint="Captured with future approved sends.">
            <textarea rows={5} maxLength={4000} {...field("outreachSignature")} />
          </Field>
          <div className="form-actions">
            <button className="primary-button" disabled={saving || !canWrite}>
              {saving ? "Saving…" : canWrite ? "Save profile" : "Read-only access"}
            </button>
            {saved ? <span className="success-message" role="status">Profile saved.</span> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
