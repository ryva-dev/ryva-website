import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Alert, Button, ErrorState, LoadingState, PageHeader, StatusLabel } from "../../design-system";
import { useLoad } from "../../hooks";

type CredentialResponse = { credential: { credentialType: string; credentialNumberMasked: string; status: string; issuedAt: string | null; expiresAt: string | null; verifiedAt: string; renewalUrl: string | null } | null };

const explanations: Record<string, string> = {
  credential_missing: "Link and verify an eligible Ryva credential before entering the operating system.",
  credential_expired_grace: "Your credential has expired. Your records remain available read-only during the renewal grace period.",
  credential_expired: "The renewal grace period has ended. Operational records are restricted until certification is renewed.",
  credential_suspended: "Operational action is paused while your credential is suspended. Contact certification support for next steps.",
  credential_revoked: "Ryva Pro access is blocked because the credential authority reports this credential as revoked.",
  credential_surrendered: "Operational access ended when the credential was surrendered.",
  subscription_missing: "Your credential is eligible. Activate a subscription to enter Ryva Pro.",
  subscription_read_only: "Billing access is read-only. Resolve billing to restore operational action.",
  eligible: "Your credential and subscription are eligible.",
  staff: "Your staff access is governed by least-privilege operational controls."
};

export function AccessWorkspacePage() {
  const { session } = useAuth();
  const credential = useLoad(() => api<CredentialResponse>("/api/certification"), []);
  if (!session) return null;
  return <div className="page ry-settings-page">
    <PageHeader eyebrow="Access review" title="Your Ryva Pro access" description="Certification and subscription are evaluated independently on every secure request." />
    <div className="ry-settings-card-grid">
      <section className="panel ry-settings-panel emphasis-panel">
        <p className="eyebrow">Current access</p><StatusLabel value={session.access.mode} /><h2>{session.access.reason.replaceAll("_", " ")}</h2>
        <p>{explanations[session.access.reason] ?? "Review the details below before continuing."}</p>
        {session.access.graceEndsAt ? <Alert tone="warning" title="Review date">{new Date(session.access.graceEndsAt).toLocaleDateString()}</Alert> : null}
        <div className="ry-settings-actions">{session.access.mode === "subscription_required" ? <Link className="ry-button ry-button-primary" to="/subscription/activate">Activate subscription</Link> : null}<Link className="ry-button ry-button-secondary" to="/certification">Review certification</Link></div>
      </section>
      <section className="panel ry-settings-panel">
        <p className="eyebrow">Credential on record</p>
        {credential.loading ? <LoadingState label="Loading credential" /> : null}
        {credential.error ? <ErrorState message={credential.error} action={<Button variant="secondary" onClick={() => void credential.reload()}>Try again</Button>} /> : null}
        {credential.data?.credential ? <dl className="ry-settings-facts"><div><dt>Credential</dt><dd>{credential.data.credential.credentialType}</dd></div><div><dt>Identifier</dt><dd>{credential.data.credential.credentialNumberMasked}</dd></div><div><dt>Status</dt><dd><StatusLabel value={credential.data.credential.status} /></dd></div><div><dt>Last verified</dt><dd>{new Date(credential.data.credential.verifiedAt).toLocaleString()}</dd></div></dl> : !credential.loading && !credential.error ? <Alert tone="info" title="No credential linked">Credential linking requires a trusted certification-authority record.</Alert> : null}
      </section>
    </div>
  </div>;
}
