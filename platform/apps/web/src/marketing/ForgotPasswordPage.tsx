import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiProblem } from "../api";

export function ForgotPasswordPage() {
  const [ready, setReady] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Forgot password · Ryva";
    void api("/api/identity/csrf").then(() => setReady(true)).catch(() => setError("Password recovery is temporarily unavailable."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      await api("/api/identity/password-reset/request", { method: "POST", body: { email: form.get("email") } });
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof ApiProblem ? caught.message : "Password recovery is temporarily unavailable.");
    }
  }

  return <section className="ry-mkt-band-cream"><div className="ry-mkt-section ry-mkt-identity-page">
    <h1 className="ry-mkt-display">Reset your password.</h1>
    <p className="ry-mkt-lede">Enter your account email. If an eligible account exists, we’ll send a secure reset link.</p>
    {submitted ? <div className="ry-mkt-identity-panel" role="status"><h2>Check your email</h2><p>If an eligible account exists, password-reset instructions are on their way.</p><Link to="/login">Return to sign in</Link></div> :
      <form className="ry-mkt-identity-panel ry-mkt-identity-form" onSubmit={(event) => void submit(event)}>
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        {error ? <p className="ry-mkt-identity-error" role="alert">{error}</p> : null}
        <button className="ry-mkt-btn ry-mkt-btn-primary" disabled={!ready}>Send reset instructions</button>
        <Link to="/login">Return to sign in</Link>
      </form>}
  </div></section>;
}
