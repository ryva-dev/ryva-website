import { Link } from "react-router-dom";
import { appPath } from "../../appBase";
import { useAuth } from "../../auth";
import { Alert, PageHeader, StatusLabel } from "../../design-system";

const explanations: Record<string, string> = {
  account_only: "Your Ryva account is active, but The Ryva Program has not been granted to this account.",
  program_incomplete: "Your Program access is active. Complete The Ryva Program before entering the operating platform.",
  pro_trial_active: "Program completion started your complimentary Ryva Pro access period.",
  pro_subscription_active: "Your Program completion and Ryva Pro subscription currently unlock the operating platform.",
  pro_subscription_paid_through: "Your Ryva Pro cancellation is recorded and operating access remains available through the paid-through date.",
  pro_inactive: "Your Program remains available, but the completion-based Ryva Pro period has ended and no valid Pro subscription is active.",
  operating_access: "Your current Program and Ryva Pro entitlements unlock the operating platform.",
  staff: "Your staff access is governed independently by least-privilege controls.",
  account_blocked: "This account or workspace is not currently active."
};

export function AccessWorkspacePage() {
  const { session } = useAuth();
  if (!session) return null;
  const access = session.access;
  return <div className="page ry-settings-page">
    <PageHeader
      eyebrow="Access review"
      title="Your Ryva access"
      description="Program completion, the completion-based Ryva Pro period, and subscription access are evaluated by the server on every secure request."
    />
    <div className="ry-settings-card-grid">
      <section className="panel ry-settings-panel emphasis-panel">
        <p className="eyebrow">Current access</p>
        <StatusLabel value={access.mode} />
        <h2>{access.reason.replaceAll("_", " ")}</h2>
        <p>{explanations[access.reason] ?? "Review the entitlement details below."}</p>
        {access.isProTrialActive && access.proTrialEndsAt ? (
          <Alert tone="info" title="Ryva Pro access period">
            Operating access is available through {new Date(access.proTrialEndsAt).toLocaleDateString()}.
          </Alert>
        ) : null}
        <div className="ry-settings-actions">
          {access.canAccessProgram ? <Link className="ry-button ry-button-primary" to={appPath("/program")}>Open Program area</Link> : null}
          {access.isProgramCompleted && !access.canAccessOperatingPlatform ? <Link className="ry-button ry-button-secondary" to={appPath("/subscription/activate")}>Review Ryva Pro</Link> : null}
        </div>
      </section>
      <section className="panel ry-settings-panel">
        <p className="eyebrow">Product entitlements</p>
        <dl className="ry-settings-facts">
          <div><dt>Program access</dt><dd>{access.canAccessProgram ? "Active" : "Not active"}</dd></div>
          <div><dt>Program completion</dt><dd>{access.programCompletedAt ? new Date(access.programCompletedAt).toLocaleString() : "Not completed"}</dd></div>
          <div><dt>Ryva Pro state</dt><dd>{access.proAccessState.replaceAll("_", " ")}</dd></div>
          <div><dt>Operating platform</dt><dd>{access.canAccessOperatingPlatform ? "Available" : "Locked"}</dd></div>
        </dl>
      </section>
    </div>
  </div>;
}
