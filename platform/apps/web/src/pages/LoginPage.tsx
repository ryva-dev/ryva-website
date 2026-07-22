import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiProblem } from "../api";
import { useAuth } from "../auth";
import { Field } from "../components";
import { shellDocumentTitle } from "../redesign/shell/navigation";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    document.title = shellDocumentTitle("/login");
  }, []);

  if (!auth.loading && auth.session && !submitting && !redirecting) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await auth.login(email, password, mfaRequired ? mfaCode : undefined);
      if (result.mfaRequired) {
        setMfaRequired(true);
        return;
      }
      const current = await auth.refresh();
      setRedirecting(true);
      if (current?.access.mode === "certification_required") void navigate("/access");
      else if (current?.access.mode === "subscription_required") void navigate("/subscription/activate");
      else if (current?.access.mode === "blocked" || current?.access.mode === "restricted") void navigate("/access");
      else void navigate("/");
    } catch (caught) {
      setRedirecting(false);
      setError(caught instanceof ApiProblem ? caught.message : "Sign in could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-context">
        <div className="brand brand-light">
          <span className="brand-mark">R</span>
          <span>
            <strong>Ryva</strong>
            <small>PRO</small>
          </span>
        </div>
        <p className="eyebrow">For certified representatives</p>
        <h1>Commercial clarity, from first signal to lasting account.</h1>
        <p>
          Ryva Pro protects evidence, judgment, relationships, and your next responsible action.
        </p>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <p className="eyebrow">Secure access</p>
          <h2>{mfaRequired ? "Verify your sign-in" : "Welcome back"}</h2>
          <p>
            {mfaRequired
              ? "Enter the six-digit code from your authenticator."
              : "Your certification and subscription will be checked after authentication."}
          </p>
          {!mfaRequired ? (
            <>
              <Field label="Email">
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
            </>
          ) : (
            <Field label="Verification code">
              <input
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                required
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
              />
            </Field>
          )}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="primary-button" disabled={submitting}>
            {submitting ? "Checking…" : mfaRequired ? "Verify and continue" : "Sign in"}
          </button>
          <p className="fine-print">
            Access requires an active eligible Ryva Brand Placement Certification.
          </p>
        </form>
      </section>
    </main>
  );
}
