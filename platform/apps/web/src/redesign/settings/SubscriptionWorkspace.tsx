import { useState } from "react";
import { api, type AccessDecision } from "../../api";
import { Alert, Button, ErrorState, LoadingState, PageHeader, StatusLabel } from "../../design-system";
import { useLoad } from "../../hooks";

type Subscription = { status: string; currentPeriodEnd: string | null; trialEnd: string | null; cancelAt: string | null; pastDueSince: string | null; priceId: string | null; hasCustomer: boolean };
type SubscriptionOffer = {
  priceCents: number;
  currency: string;
  billingCadence: "month";
  termsVersion: string;
  firstChargeAt: string | null;
};

export function SubscriptionWorkspacePage({ activation = false }: { activation?: boolean }) {
  const state = useLoad(() => api<{ subscription: Subscription | null; access: AccessDecision; offer: SubscriptionOffer }>("/api/subscription"), []);
  const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  const [subscriptionConsentAccepted, setSubscriptionConsentAccepted] = useState(false);
  async function open(kind: "checkout" | "portal") {
    setWorking(true); setError("");
    try {
      if (kind === "checkout" && (!subscriptionConsentAccepted || !state.data?.offer)) {
        setError("Accept the subscription terms and recurring billing disclosure before continuing.");
        setWorking(false);
        return;
      }
      const result = await api<{ url: string }>(`/api/subscription/${kind}`, {
        method: "POST",
        ...(kind === "checkout" ? { body: {
          termsAccepted: true,
          recurringBillingAccepted: true,
          cancellationTermsAccepted: true,
          termsVersion: state.data!.offer.termsVersion,
          priceCents: state.data!.offer.priceCents,
          currency: state.data!.offer.currency,
          billingCadence: state.data!.offer.billingCadence
        } } : {})
      });
      window.location.assign(result.url);
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Billing could not be opened."); setWorking(false); }
  }
  const subscription = state.data?.subscription;
  const access = state.data?.access;
  const firstChargeAt = state.data?.offer.firstChargeAt;
  const firstChargeDate = firstChargeAt
    ? new Date(firstChargeAt).toLocaleDateString(undefined, { dateStyle: "long" })
    : null;
  const checkoutEligible = Boolean(access?.canAccessProgram && access.isProgramCompleted);
  if (state.loading && !state.data) return <div className="page ry-settings-page"><PageHeader eyebrow={activation ? "Activate access" : "Account"} title={activation ? "Ryva Pro subscription" : "Subscription"} description="Loading billing entitlement." /><LoadingState label="Loading subscription" /></div>;
  if (state.error && !state.data) return <div className="page ry-settings-page"><PageHeader eyebrow={activation ? "Activate access" : "Account"} title={activation ? "Ryva Pro subscription" : "Subscription"} description="Billing entitlement could not be loaded." /><ErrorState message={state.error} action={<Button variant="secondary" onClick={() => void state.reload()}>Try again</Button>} /></div>;
  return <div className="page ry-settings-page">
    <PageHeader eyebrow={activation ? "Activate access" : "Account"} title={activation ? "Ryva Pro subscription" : "Subscription"} description={activation ? "Ryva Pro is $20 per month after Program completion and requires your explicit authorization." : "Review your last verified Ryva Pro billing entitlement."} />
    {error ? <Alert tone="danger" title="Billing unavailable">{error}</Alert> : null}
    {!checkoutEligible ? <Alert tone="info" title="Program completion required">Complete The Ryva Program before activating Ryva Pro.</Alert> : null}
    <section className="panel ry-settings-panel"><header className="ry-settings-record-heading"><div><p className="eyebrow">Billing entitlement</p><h2>{subscription ? "Ryva Pro" : "No active subscription"}</h2></div><StatusLabel value={subscription?.status ?? "not_active"} /></header><dl className="ry-settings-facts"><div><dt>Program completion</dt><dd>{access?.isProgramCompleted ? "Completed" : "Not completed"}</dd></div><div><dt>Pro access state</dt><dd>{access?.proAccessState.replaceAll("_", " ") ?? "Not active"}</dd></div><div><dt>Billing status</dt><dd>{subscription?.status.replaceAll("_", " ") ?? "Not active"}</dd></div><div><dt>Current period ends</dt><dd>{subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "Not available"}</dd></div><div><dt>Cancellation date</dt><dd>{subscription?.cancelAt ? new Date(subscription.cancelAt).toLocaleDateString() : "Not scheduled"}</dd></div></dl>{checkoutEligible && (!subscription || ["none", "ended"].includes(subscription.status)) ? <div className="ry-settings-subscription-consent"><label><input type="checkbox" checked={subscriptionConsentAccepted} onChange={(event) => setSubscriptionConsentAccepted(event.target.checked)} /> <span>I agree to Ryva’s <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>, authorize a $20 monthly recurring charge until canceled{firstChargeDate ? `, beginning ${firstChargeDate} after my included access ends` : ""}, and understand that cancellation before a scheduled charge prevents that renewal.</span></label></div> : null}<div className="ry-settings-actions">{checkoutEligible && (!subscription || ["none", "ended"].includes(subscription.status)) ? <Button disabled={!subscriptionConsentAccepted} loading={working} onClick={() => void open("checkout")}>Continue to secure checkout</Button> : subscription?.hasCustomer ? <Button loading={working} onClick={() => void open("portal")}>Manage billing</Button> : null}</div><p className="ry-settings-fine-print">Billing access is activated only after a signed provider event is reconciled.</p></section>
  </div>;
}
