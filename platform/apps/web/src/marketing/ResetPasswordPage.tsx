import { type FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiProblem } from "../api";

export function ResetPasswordPage() {
  const [search] = useSearchParams();
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const token = search.get("token") ?? "";

  useEffect(() => {
    document.title = "Choose a new password · Ryva";
    void api("/api/identity/csrf").then(() => setReady(true)).catch(() => setError("Password recovery is temporarily unavailable."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      await api("/api/identity/password-reset/confirm", {
        method: "POST",
        body: { token, password: form.get("password"), passwordConfirmation: form.get("passwordConfirmation") }
      });
      setComplete(true);
    } catch (caught) {
      setError(caught instanceof ApiProblem ? caught.message : "Your password could not be reset.");
    }
  }

  return <section className="ry-mkt-band-cream"><div className="ry-mkt-section ry-mkt-identity-page">
    <h1 className="ry-mkt-display">Choose a new password.</h1>
    {complete ? <div className="ry-mkt-identity-panel" role="status"><h2>Password updated</h2><p>All existing sessions have been signed out.</p><Link className="ry-mkt-btn ry-mkt-btn-primary" to="/login">Sign in</Link></div> :
      <form className="ry-mkt-identity-panel ry-mkt-identity-form" onSubmit={(event) => void submit(event)}>
        {!token ? <p className="ry-mkt-identity-error" role="alert">This password-reset link is invalid.</p> : null}
        <label>New password<input name="password" type="password" autoComplete="new-password" minLength={14} maxLength={256} required /><small>Use at least 14 characters.</small></label>
        <label>Confirm new password<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={14} maxLength={256} required /></label>
        {error ? <p className="ry-mkt-identity-error" role="alert">{error}</p> : null}
        <button className="ry-mkt-btn ry-mkt-btn-primary" disabled={!ready || !token}>Update password</button>
      </form>}
  </div></section>;
}
