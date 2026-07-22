import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Alert, Button, ErrorState, Field, Input, LoadingState, PageHeader, Select, TextArea } from "../../design-system";
import { useLoad } from "../../hooks";

type Profile = { userId: string; workspaceId: string; name: string; email: string; timeZone: string; locale: string; professionalTitle: string; outreachName: string; outreachSignature: string; currency: string; categoryInterests: string[]; businessTypeInterests: string[]; geographicPreferences: string[]; experienceLevel: string; workingHours: Record<string, unknown>; version: number };
const join = (values: string[]) => values.join(", ");
const split = (value: string) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];

export function ProfileWorkspacePage() {
  const { session, refresh } = useAuth();
  const canWrite = session?.access.capabilities.includes("profile:write") ?? false;
  const workspaceId = session?.user.workspaceId ?? "";
  const state = useLoad(() => api<{ profile: Profile }>(`/api/workspaces/${workspaceId}/profile`), [workspaceId]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState(""); const [saved, setSaved] = useState(false); const [saving, setSaving] = useState(false);
  useEffect(() => {
    const profile = state.data?.profile;
    if (!profile) return;
    setForm({ name: profile.name, timeZone: profile.timeZone, locale: profile.locale, professionalTitle: profile.professionalTitle, outreachName: profile.outreachName, outreachSignature: profile.outreachSignature, currency: profile.currency, categoryInterests: join(profile.categoryInterests), businessTypeInterests: join(profile.businessTypeInterests), geographicPreferences: join(profile.geographicPreferences), experienceLevel: profile.experienceLevel });
  }, [state.data]);
  function field(name: string) {
    return {
      value: form[name] ?? "",
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((current) => ({ ...current, [name]: event.target.value }))
    };
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!state.data || !canWrite) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      const result = await api<{ profile: Profile }>(`/api/workspaces/${workspaceId}/profile`, { method: "PUT", body: { version: state.data.profile.version, name: form.name ?? "", timeZone: form.timeZone ?? "", locale: form.locale ?? "", professionalTitle: form.professionalTitle ?? "", outreachName: form.outreachName ?? "", outreachSignature: form.outreachSignature ?? "", currency: form.currency ?? "", categoryInterests: split(form.categoryInterests ?? ""), businessTypeInterests: split(form.businessTypeInterests ?? ""), geographicPreferences: split(form.geographicPreferences ?? ""), experienceLevel: form.experienceLevel ?? "not_set", workingHours: state.data.profile.workingHours } });
      state.setData(result); await refresh(); setSaved(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Profile could not be saved."); }
    finally { setSaving(false); }
  }
  if (state.loading && !state.data) return <div className="page ry-settings-page"><PageHeader eyebrow="Professional identity" title="Profile" description="Loading your professional identity." /><LoadingState label="Loading profile" /></div>;
  if (state.error && !state.data) return <div className="page ry-settings-page"><PageHeader eyebrow="Professional identity" title="Profile" description="Your professional identity could not be loaded." /><ErrorState message={state.error} action={<Button variant="secondary" onClick={() => void state.reload()}>Try again</Button>} /></div>;
  return <div className="page ry-settings-page">
    <PageHeader eyebrow="Professional identity" title="Profile" description="These settings provide regional context and, where approved, your external communication identity." />
    {!canWrite ? <Alert tone="warning" title="Read-only profile">You may review this profile, but this session cannot change it.</Alert> : null}
    {error ? <Alert tone="danger" title="Profile unavailable">{error}</Alert> : null}
    {state.data ? <form className="panel ry-settings-panel ry-settings-form-grid" onSubmit={(event) => void submit(event)}>
      <Field label="Full name" required><Input required maxLength={120} autoComplete="name" {...field("name")} disabled={!canWrite} /></Field>
      <Field label="Email" hint="Verified account email cannot be changed here."><Input value={state.data.profile.email} disabled /></Field>
      <Field label="Professional title"><Input maxLength={120} {...field("professionalTitle")} disabled={!canWrite} /></Field><Field label="Outreach name"><Input maxLength={120} {...field("outreachName")} disabled={!canWrite} /></Field>
      <Field label="Time zone" required><Input required maxLength={100} placeholder="America/New_York" {...field("timeZone")} disabled={!canWrite} /></Field><Field label="Currency" required><Input required pattern="[A-Z]{3}" maxLength={3} {...field("currency")} disabled={!canWrite} /></Field>
      <Field label="Locale" required><Input required maxLength={20} placeholder="en-US" {...field("locale")} disabled={!canWrite} /></Field><Field label="Experience"><Select {...field("experienceLevel")} disabled={!canWrite}><option value="not_set">Not set</option><option value="new">New to placement</option><option value="developing">Developing practice</option><option value="experienced">Experienced representative</option></Select></Field>
      <Field label="Category interests" hint="Comma-separated"><Input {...field("categoryInterests")} disabled={!canWrite} /></Field><Field label="Business types" hint="Comma-separated"><Input {...field("businessTypeInterests")} disabled={!canWrite} /></Field><Field label="Geographic preferences" hint="Comma-separated"><Input {...field("geographicPreferences")} disabled={!canWrite} /></Field>
      <Field label="Outreach signature" hint="Captured with future approved sends."><TextArea rows={5} maxLength={4000} {...field("outreachSignature")} disabled={!canWrite} /></Field>
      <div className="ry-settings-actions"><Button type="submit" loading={saving} disabled={!canWrite}>{canWrite ? "Save profile" : "Read-only access"}</Button>{saved ? <span role="status">Profile saved.</span> : null}</div>
    </form> : null}
  </div>;
}
