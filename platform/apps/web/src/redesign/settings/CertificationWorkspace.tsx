import { useState } from "react";
import { api } from "../../api";
import { Alert, Button, ErrorState, LoadingState, PageHeader, StatusLabel } from "../../design-system";
import { useLoad } from "../../hooks";

type Credential = { credentialType: string; credentialNumberMasked: string; status: string; issuedAt: string | null; expiresAt: string | null; verifiedAt: string; providerReference: string; renewalUrl: string | null };

export function CertificationWorkspacePage() {
  const state = useLoad(() => api<{ credential: Credential | null; access: { graceEndsAt: string | null } }>("/api/certification"), []);
  const [actionError, setActionError] = useState(""); const [refreshing, setRefreshing] = useState(false);
  const credential = state.data?.credential;
  async function refresh() {
    setRefreshing(true); setActionError("");
    try { await api("/api/certification/refresh", { method: "POST" }); await state.reload(); }
    catch (caught) { setActionError(caught instanceof Error ? caught.message : "Refresh could not be completed."); }
    finally { setRefreshing(false); }
  }
  if (state.loading && !state.data) return <div className="page ry-settings-page"><PageHeader eyebrow="Professional standing" title="Certification" description="Loading trusted certification information." /><LoadingState label="Loading certification" /></div>;
  if (state.error && !state.data) return <div className="page ry-settings-page"><PageHeader eyebrow="Professional standing" title="Certification" description="Certification could not be loaded." /><ErrorState message={state.error} action={<Button variant="secondary" onClick={() => void state.reload()}>Try again</Button>} /></div>;
  return <div className="page ry-settings-page">
    <PageHeader eyebrow="Professional standing" title="Certification" description="Ryva displays the credential authority's last trusted status. Certification is not represented as government licensing." action={credential ? <Button variant="secondary" loading={refreshing} onClick={() => void refresh()}>Refresh verification</Button> : undefined} />
    {actionError ? <Alert tone="danger" title="Refresh unavailable">{actionError}</Alert> : null}
    {credential ? <section className="panel ry-settings-panel"><header className="ry-settings-record-heading"><div><p className="eyebrow">Verified credential</p><h2>{credential.credentialType}</h2></div><StatusLabel value={credential.status} /></header><dl className="ry-settings-facts"><div><dt>Credential number</dt><dd>{credential.credentialNumberMasked}</dd></div><div><dt>Issued</dt><dd>{credential.issuedAt ? new Date(credential.issuedAt).toLocaleDateString() : "Not supplied"}</dd></div><div><dt>Expires</dt><dd>{credential.expiresAt ? new Date(credential.expiresAt).toLocaleDateString() : "Not supplied"}</dd></div><div><dt>Last verified</dt><dd>{new Date(credential.verifiedAt).toLocaleString()}</dd></div><div><dt>Provider reference</dt><dd>{credential.providerReference}</dd></div><div><dt>Grace review</dt><dd>{state.data?.access.graceEndsAt ? new Date(state.data.access.graceEndsAt).toLocaleDateString() : "Not applicable"}</dd></div></dl>{credential.renewalUrl ? <a className="ry-button ry-button-primary" href={credential.renewalUrl} rel="noreferrer">Open renewal</a> : null}</section> : <section className="panel ry-settings-panel"><Alert tone="info" title="No verified credential">Contact certification support to link the correct credential identity.</Alert></section>}
  </div>;
}
