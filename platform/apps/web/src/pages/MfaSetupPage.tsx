import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiProblem } from "../api";

export function MfaSetupPage() {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    document.title = "Set up multi-factor authentication · Ryva";
    void api<{ qrCodeDataUrl: string }>("/api/auth/mfa/enrollment")
      .then((result) => setQrCodeDataUrl(result.qrCodeDataUrl))
      .catch((caught) => setError(caught instanceof ApiProblem ? caught.message : "Multi-factor setup is unavailable."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      await api("/api/auth/mfa/enrollment/confirm", { method: "POST", body: { code: form.get("code") } });
      setComplete(true);
    } catch (caught) {
      setError(caught instanceof ApiProblem ? caught.message : "The verification code could not be confirmed.");
    }
  }

  return <main className="ry-auth-page ry-auth-setup-page">
    <section className="ry-auth-panel ry-auth-setup-panel">
      <div className="ry-auth-form">
        <header className="ry-auth-form-header"><h1>Secure your staff account</h1><p>Scan the QR code with your authenticator, then enter the six-digit code to confirm setup.</p></header>
        {complete ? <div role="status"><h2>Multi-factor authentication is active</h2><p>Your temporary setup challenge has been consumed.</p><Link to="/login">Return to sign in</Link></div> : null}
        {!complete && qrCodeDataUrl ? <form onSubmit={(event) => void submit(event)}>
          <img className="ry-auth-mfa-qr" src={qrCodeDataUrl} alt="Authenticator setup QR code" />
          <label className="ry-auth-mfa-code">Verification code<input name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required /></label>
          {error ? <p className="ry-auth-error" role="alert">{error}</p> : null}
          <button className="ry-auth-submit">Confirm setup</button>
        </form> : null}
        {!complete && !qrCodeDataUrl && error ? <p className="ry-auth-error" role="alert">{error}</p> : null}
      </div>
    </section>
  </main>;
}
