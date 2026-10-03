import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiProblem } from "../api";

type IdentityContext = {
  legalDocuments: {
    terms: { url: string; version: string };
    privacy: { url: string; version: string };
  };
};

export function CreateAccountPage() {
  const [context, setContext] = useState<IdentityContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    document.title = "Create your Ryva account · Ryva";
    void api<IdentityContext>("/api/identity/context")
      .then(setContext)
      .catch((caught) => setContextError(caught instanceof ApiProblem ? caught.message : "Account creation is temporarily unavailable."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    try {
      await api("/api/identity/register", {
        method: "POST",
        body: {
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          password: form.get("password"),
          passwordConfirmation: form.get("passwordConfirmation"),
          termsAccepted: form.get("legalConsentAccepted") === "on",
          privacyAcknowledged: form.get("legalConsentAccepted") === "on",
          termsVersion: context.legalDocuments.terms.version,
          privacyVersion: context.legalDocuments.privacy.version
        }
      });
      setCreated(true);
    } catch (caught) {
      setError(caught instanceof ApiProblem ? caught.message : "Your account could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="ry-mkt-band-cream">
    <div className="ry-mkt-section ry-mkt-identity-page">
      <p className="ry-mkt-kicker">Customer identity</p>
      <h1 className="ry-mkt-display">Create your Ryva account.</h1>
      <p className="ry-mkt-lede">This creates your secure identity only. It does not purchase or unlock a Ryva product.</p>
      {created ? <div className="ry-mkt-identity-panel" role="status">
        <h2>Account created</h2>
        <p>Your account is ready. Product access is granted separately.</p>
        <Link className="ry-mkt-btn ry-mkt-btn-primary" to="/login?next=/checkout">Continue to sign in and checkout</Link>
      </div> : null}
      {!created && contextError ? <p className="ry-mkt-identity-error" role="alert">{contextError}</p> : null}
      {!created && context ? <form className="ry-mkt-identity-panel ry-mkt-identity-form" onSubmit={(event) => void submit(event)}>
        <div className="ry-mkt-identity-name-row">
          <label>First name<input name="firstName" autoComplete="given-name" required maxLength={80} /></label>
          <label>Last name<input name="lastName" autoComplete="family-name" required maxLength={80} /></label>
        </div>
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete="new-password" minLength={14} maxLength={256} required /><small>Use at least 14 characters.</small></label>
        <label>Confirm password<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={14} maxLength={256} required /></label>
        <label className="ry-mkt-identity-check"><input name="legalConsentAccepted" type="checkbox" required /> <span>I agree to Ryva’s <a href={context.legalDocuments.terms.url} target="_blank" rel="noreferrer">Terms of Service</a> and acknowledge the <a href={context.legalDocuments.privacy.url} target="_blank" rel="noreferrer">Privacy Policy</a>.</span></label>
        {error ? <p className="ry-mkt-identity-error" role="alert">{error}</p> : null}
        <button className="ry-mkt-btn ry-mkt-btn-primary" disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</button>
        <p className="ry-mkt-enroll-signin">Already have an account? <Link to="/login">Sign in</Link></p>
      </form> : null}
    </div>
  </section>;
}
