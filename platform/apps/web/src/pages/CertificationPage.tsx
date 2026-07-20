import { useState } from "react";
import { api } from "../api";
import { ErrorPanel, Loading, PageHeader, StatusPill } from "../components";
import { useLoad } from "../hooks";

type Credential = {
  credentialType: string;
  credentialNumberMasked: string;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  verifiedAt: string;
  providerReference: string;
  renewalUrl: string | null;
};

export function CertificationPage() {
  const state = useLoad(
    () => api<{ credential: Credential | null; access: { graceEndsAt: string | null } }>("/api/certification"),
    []
  );
  const [actionError, setActionError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const credential = state.data?.credential;

  async function refresh() {
    setRefreshing(true);
    setActionError("");
    try {
      await api("/api/certification/refresh", { method: "POST" });
      await state.reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Refresh could not be completed.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Professional standing"
        title="Certification"
        description="Ryva displays the credential authority's last trusted status. Certification is not represented as government licensing."
        action={
          credential ? (
            <button className="secondary-button" disabled={refreshing} onClick={() => void refresh()}>
              {refreshing ? "Refreshing…" : "Refresh verification"}
            </button>
          ) : undefined
        }
      />
      {state.loading ? <Loading label="Loading certification" /> : null}
      {state.error ? <ErrorPanel message={state.error} /> : null}
      {actionError ? <ErrorPanel message={actionError} /> : null}
      {credential ? (
        <section className="panel">
          <div className="record-heading">
            <div>
              <p className="eyebrow">Verified credential</p>
              <h2>{credential.credentialType}</h2>
            </div>
            <StatusPill value={credential.status} />
          </div>
          <dl className="detail-grid">
            <div><dt>Credential number</dt><dd>{credential.credentialNumberMasked}</dd></div>
            <div><dt>Issued</dt><dd>{credential.issuedAt ? new Date(credential.issuedAt).toLocaleDateString() : "Not supplied"}</dd></div>
            <div><dt>Expires</dt><dd>{credential.expiresAt ? new Date(credential.expiresAt).toLocaleDateString() : "Not supplied"}</dd></div>
            <div><dt>Last verified</dt><dd>{new Date(credential.verifiedAt).toLocaleString()}</dd></div>
            <div><dt>Provider reference</dt><dd className="monospace">{credential.providerReference}</dd></div>
            <div>
              <dt>Grace review</dt>
              <dd>{state.data?.access.graceEndsAt ? new Date(state.data.access.graceEndsAt).toLocaleDateString() : "Not applicable"}</dd>
            </div>
          </dl>
          {credential.renewalUrl ? (
            <a className="primary-button inline-button" href={credential.renewalUrl} rel="noreferrer">
              Open renewal
            </a>
          ) : null}
        </section>
      ) : !state.loading ? (
        <section className="panel empty-state">
          <h2>No verified credential</h2>
          <p>Contact certification support to link the correct credential identity.</p>
        </section>
      ) : null}
    </div>
  );
}
