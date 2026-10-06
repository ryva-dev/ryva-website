import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ApiProblem } from "../api";
import { appPath } from "../appBase";
import { useAuth } from "../auth";
import { Field } from "../components";
import { shellDocumentTitle } from "../redesign/shell/navigation";
import fabricVisual from "./assets/login-fabric.png";
import "./login.css";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedNext = searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.title = shellDocumentTitle("/login");
  }, []);

  if (!auth.loading && auth.session && !submitting && !redirecting) {
    return <Navigate to={next ?? appPath("/")} replace />;
  }

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
      if (result.mfaSetupRequired) {
        setRedirecting(true);
        void navigate("/mfa-setup");
        return;
      }
      const current = await auth.refresh();
      setRedirecting(true);
      if (next) void navigate(next);
      else if (current?.user.role === "admin") void navigate(appPath("/admin"));
      else if (current?.user.role === "support") void navigate(appPath("/access"));
      else if (current?.access.capabilities.includes("operational:read")) void navigate(appPath("/"));
      else if (current?.access.canAccessProgram) void navigate(appPath("/program"));
      else void navigate(appPath("/access"));
    } catch (caught) {
      setRedirecting(false);
      setError(caught instanceof ApiProblem ? caught.message : "Sign in could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="ry-auth-page" data-clarity-mask="true">
      <section className="ry-auth-editorial" aria-label="Step inside the world of brand placement.">
        <div className="ry-auth-editorial-visual" aria-hidden="true">
          <img className="ry-auth-editorial-fold" src={fabricVisual} alt="" decoding="async" />
        </div>
        <div className="ry-auth-editorial-inner">
          <p className="ry-auth-wordmark">ryva</p>
          <div className="ry-auth-editorial-copy">
            <h1 className="ry-auth-headline">
              <span className="ry-auth-headline-line ry-auth-headline-line-lead">Step inside the world of</span>
              <span className="ry-auth-headline-line ry-auth-headline-line-accent">brand placement.</span>
            </h1>
            <p className="ry-auth-lede">
              Shape the future of brands, buyers, and retail growth.
            </p>
          </div>
        </div>
      </section>

      <section className="ry-auth-panel">
        <form className="ry-auth-form" onSubmit={(event) => void submit(event)}>
          <header className="ry-auth-form-header">
            <h2>{mfaRequired ? "Verify your sign-in" : "Welcome back"}</h2>
            <p>
              {mfaRequired
                ? "Enter the six-digit code from your authenticator."
                : "Sign in to continue your Ryva experience."}
            </p>
          </header>

          {!mfaRequired ? (
            <>
              <Field label="Email">
                <input
                  className="ry-auth-input"
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder="name@company.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <div className="ry-auth-password-block">
                <div className="ry-auth-password-field">
                  <Field label="Password">
                    <input
                      className="ry-auth-input"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </Field>
                  <button
                    type="button"
                    className="ry-auth-password-toggle"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <Link className="ry-auth-forgot" to="/forgot-password">
                  Forgot password?
                </Link>
              </div>
            </>
          ) : (
            <Field label="Verification code">
              <input
                className="ry-auth-input"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                required
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
              />
            </Field>
          )}

          {error ? <p className="form-error ry-auth-error" role="alert">{error}</p> : null}

          <button className="ry-auth-submit" disabled={submitting} type="submit">
            {submitting ? "Checking…" : mfaRequired ? "Verify and continue" : "Sign in"}
          </button>

          {!mfaRequired ? (
            <>
              <div className="ry-auth-divider" aria-hidden="true">
                <span>or</span>
              </div>
              <p className="ry-auth-secondary">
                New to Ryva?{" "}
                <a href="https://ryva.com" id="learn-more">
                  Learn more
                </a>
              </p>
            </>
          ) : null}
        </form>
      </section>
    </main>
  );
}
