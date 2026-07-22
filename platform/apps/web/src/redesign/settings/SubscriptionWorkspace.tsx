import { useState } from "react";
import { api } from "../../api";
import { Alert, Button, ErrorState, LoadingState, PageHeader, StatusLabel } from "../../design-system";
import { useLoad } from "../../hooks";

type Subscription = { status: string; currentPeriodEnd: string | null; trialEnd: string | null; cancelAt: string | null; pastDueSince: string | null; priceId: string | null; hasCustomer: boolean };

export function SubscriptionWorkspacePage({ activation = false }: { activation?: boolean }) {
  const state = useLoad(() => api<{ subscription: Subscription | null; access: { credentialStatus: string | null } }>("/api/subscription"), []);
  const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  async function open(kind: "checkout" | "portal") {
    setWorking(true); setError("");
    try { const result = await api<{ url: string }>(`/api/subscription/${kind}`, { method: "POST" }); window.location.assign(result.url); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Billing could not be opened."); setWorking(false); }
  }
  const subscription = state.data?.subscription;
  if (state.loading && !state.data) return <div className="page ry-settings-page"><PageHeader eyebrow={activation ? "Activate access" : "Account"} title={activation ? "Ryva Pro subscription" : "Subscription"} description="Loading billing entitlement." /><LoadingState label="Loading subscription" /></div>;
  if (state.error && !state.data) return <div className="page ry-settings-page"><PageHeader eyebrow={activation ? "Activate access" : "Account"} title={activation ? "Ryva Pro subscription" : "Subscription"} description="Billing entitlement could not be loaded." /><ErrorState message={state.error} action={<Button variant="secondary" onClick={() => void state.reload()}>Try again</Button>} /></div>;
  return <div className="page ry-settings-page">
    <PageHeader eyebrow={activation ? "Activate access" : "Account"} title={activation ? "Ryva Pro subscription" : "Subscription"} description={activation ? "Subscription activation follows certification verification. Billing never overrides a credential restriction." : "Review your last verified billing entitlement and manage payment through the secure provider."} />
    {error ? <Alert tone="danger" title="Billing unavailable">{error}</Alert> : null}
    <section className="panel ry-settings-panel"><header className="ry-settings-record-heading"><div><p className="eyebrow">Billing entitlement</p><h2>{subscription ? "Ryva Pro" : "No active subscription"}</h2></div><StatusLabel value={subscription?.status ?? "not_active"} /></header><dl className="ry-settings-facts"><div><dt>Credential eligibility</dt><dd>{state.data?.access.credentialStatus ?? "Not verified"}</dd></div><div><dt>Billing status</dt><dd>{subscription?.status.replaceAll("_", " ") ?? "Not active"}</dd></div><div><dt>Current period ends</dt><dd>{subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "Not available"}</dd></div><div><dt>Cancellation date</dt><dd>{subscription?.cancelAt ? new Date(subscription.cancelAt).toLocaleDateString() : "Not scheduled"}</dd></div></dl><div className="ry-settings-actions">{!subscription || ["none", "ended"].includes(subscription.status) ? <Button loading={working} onClick={() => void open("checkout")}>Continue to secure checkout</Button> : subscription.hasCustomer ? <Button loading={working} onClick={() => void open("portal")}>Manage billing</Button> : null}</div><p className="ry-settings-fine-print">Payment state is activated only after a signed provider event is reconciled.</p></section>
  </div>;
}
