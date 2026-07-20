import { useState } from "react";
import { api } from "../api";
import { ErrorPanel, Loading, PageHeader, StatusPill } from "../components";
import { useLoad } from "../hooks";

type Subscription = {
  status: string;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAt: string | null;
  pastDueSince: string | null;
  priceId: string | null;
  hasCustomer: boolean;
};

export function SubscriptionPage({ activation = false }: { activation?: boolean }) {
  const state = useLoad(
    () => api<{ subscription: Subscription | null; access: { credentialStatus: string | null } }>("/api/subscription"),
    []
  );
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function open(kind: "checkout" | "portal") {
    setWorking(true);
    setError("");
    try {
      const result = await api<{ url: string }>(`/api/subscription/${kind}`, { method: "POST" });
      window.location.assign(result.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Billing could not be opened.");
      setWorking(false);
    }
  }

  const subscription = state.data?.subscription;
  return (
    <div className="page">
      <PageHeader
        eyebrow={activation ? "Activate access" : "Account"}
        title={activation ? "Ryva Pro subscription" : "Subscription"}
        description={
          activation
            ? "Subscription activation follows certification verification. Billing never overrides a credential restriction."
            : "Review your last verified billing entitlement and manage payment through the secure provider."
        }
      />
      {state.loading ? <Loading label="Loading subscription" /> : null}
      {state.error ? <ErrorPanel message={state.error} /> : null}
      {error ? <ErrorPanel message={error} /> : null}
      {!state.loading ? (
        <section className="panel">
          <div className="record-heading">
            <div>
              <p className="eyebrow">Billing entitlement</p>
              <h2>{subscription ? "Ryva Pro" : "No active subscription"}</h2>
            </div>
            <StatusPill value={subscription?.status ?? "not_active"} />
          </div>
          <dl className="detail-grid">
            <div><dt>Credential eligibility</dt><dd>{state.data?.access.credentialStatus ?? "Not verified"}</dd></div>
            <div><dt>Billing status</dt><dd>{subscription?.status.replaceAll("_", " ") ?? "Not active"}</dd></div>
            <div>
              <dt>Current period ends</dt>
              <dd>{subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "Not available"}</dd>
            </div>
            <div>
              <dt>Cancellation date</dt>
              <dd>{subscription?.cancelAt ? new Date(subscription.cancelAt).toLocaleDateString() : "Not scheduled"}</dd>
            </div>
          </dl>
          <div className="button-row">
            {!subscription || ["none", "ended"].includes(subscription.status) ? (
              <button className="primary-button" disabled={working} onClick={() => void open("checkout")}>
                {working ? "Opening…" : "Continue to secure checkout"}
              </button>
            ) : subscription.hasCustomer ? (
              <button className="primary-button" disabled={working} onClick={() => void open("portal")}>
                {working ? "Opening…" : "Manage billing"}
              </button>
            ) : null}
          </div>
          <p className="fine-print">
            Payment state is activated only after a signed provider event is reconciled.
          </p>
        </section>
      ) : null}
    </div>
  );
}
