import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorPanel, Loading, PageHeader, StatusPill } from "../components";
import { useLoad } from "../hooks";

type CredentialResponse = {
  credential: {
    credentialType: string;
    credentialNumberMasked: string;
    status: string;
    issuedAt: string | null;
    expiresAt: string | null;
    verifiedAt: string;
    renewalUrl: string | null;
  } | null;
};

const explanations: Record<string, string> = {
  credential_missing: "Link and verify an eligible Ryva credential before entering the operating system.",
  credential_expired_grace:
    "Your credential has expired. Your records remain available read-only during the renewal grace period.",
  credential_expired:
    "The renewal grace period has ended. Operational records are restricted until certification is renewed.",
  credential_suspended:
    "Operational action is paused while your credential is suspended. Contact certification support for next steps.",
  credential_revoked:
    "Ryva Pro access is blocked because the credential authority reports this credential as revoked.",
  credential_surrendered:
    "Operational access ended when the credential was surrendered.",
  subscription_missing:
    "Your credential is eligible. Activate a subscription to enter Ryva Pro.",
  subscription_read_only:
    "Billing access is read-only. Resolve billing to restore operational action.",
  eligible: "Your credential and subscription are eligible.",
  staff: "Your staff access is governed by least-privilege operational controls."
};

export function AccessPage() {
  const { session } = useAuth();
  const credential = useLoad(() => api<CredentialResponse>("/api/certification"), []);
  if (!session) return null;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Access review"
        title="Your Ryva Pro access"
        description="Certification and subscription are evaluated independently on every secure request."
      />
      <section className="split-grid">
        <article className="panel emphasis-panel">
          <p className="eyebrow">Current access</p>
          <StatusPill value={session.access.mode} />
          <h2>{session.access.reason.replaceAll("_", " ")}</h2>
          <p>{explanations[session.access.reason] ?? "Review the details below before continuing."}</p>
          {session.access.graceEndsAt ? (
            <p className="date-callout">
              Review date: <strong>{new Date(session.access.graceEndsAt).toLocaleDateString()}</strong>
            </p>
          ) : null}
          <div className="button-row">
            {session.access.mode === "subscription_required" ? (
              <Link className="primary-button" to="/subscription/activate">Activate subscription</Link>
            ) : null}
            <Link className="secondary-button" to="/certification">Review certification</Link>
          </div>
        </article>
        <article className="panel">
          <p className="eyebrow">Credential on record</p>
          {credential.loading ? <Loading label="Loading credential" /> : null}
          {credential.error ? <ErrorPanel message={credential.error} /> : null}
          {credential.data?.credential ? (
            <dl className="detail-list">
              <div><dt>Credential</dt><dd>{credential.data.credential.credentialType}</dd></div>
              <div><dt>Identifier</dt><dd>{credential.data.credential.credentialNumberMasked}</dd></div>
              <div><dt>Status</dt><dd><StatusPill value={credential.data.credential.status} /></dd></div>
              <div>
                <dt>Last verified</dt>
                <dd>{new Date(credential.data.credential.verifiedAt).toLocaleString()}</dd>
              </div>
            </dl>
          ) : !credential.loading ? (
            <div className="empty-state">
              <h3>No credential linked</h3>
              <p>Credential linking requires a trusted certification-authority record.</p>
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
