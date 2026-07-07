import { useEffect, useState, type FormEvent } from "react";

type AuthMode = "login" | "register" | "reset-request" | "reset-complete";

type AuthModalProps = {
  error: string;
  loading: boolean;
  onClose: () => void;
  onCompletePasswordReset: (input: { password: string; token: string }) => Promise<void>;
  onGoogleAuth?: () => void;
  onLogin: (input: { email: string; password: string }) => Promise<void>;
  onRegister: (input: { email: string; name: string; password: string }) => Promise<void>;
  onRequestPasswordReset: (input: { email: string }) => Promise<void>;
  resetToken: string | null;
};

export function AuthModal({
  error,
  loading,
  onClose,
  onCompletePasswordReset,
  onGoogleAuth,
  onLogin,
  onRegister,
  onRequestPasswordReset,
  resetToken,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(resetToken ? "reset-complete" : "login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isResetComplete = mode === "reset-complete";
  const isResetRequest = mode === "reset-request";
  const showGoogle = isLogin || isRegister;

  useEffect(() => {
    if (resetToken) setMode("reset-complete");
  }, [resetToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "login") return void onLogin({ email, password });
    if (mode === "register") return void onRegister({ email, name, password });
    if (mode === "reset-complete" && resetToken) return void onCompletePasswordReset({ password, token: resetToken });
    await onRequestPasswordReset({ email });
  }

  const title = isLogin
    ? "Welcome back"
    : isRegister
      ? "Create your account"
      : isResetComplete
        ? "Choose a new password"
        : "Reset your password";

  const cta = loading
    ? "Working…"
    : isLogin
      ? "Sign in"
      : isRegister
        ? "Create account"
        : isResetComplete
          ? "Set password"
          : "Send reset link";

  return (
    <div aria-labelledby="auth-title" aria-modal="true" className="ro-modal-scrim" role="dialog" onClick={onClose}>
      <div className="rauth" onClick={(e) => e.stopPropagation()}>
        <div className="rauth-head">
          <span className="rauth-brand">Ryva<span>.</span></span>
          <button aria-label="Close" className="rauth-close" onClick={onClose} type="button">×</button>
        </div>

        <h3 id="auth-title" className="rauth-title">{title}</h3>
        {(isLogin || isRegister) && (
          <p className="rauth-sub">{isLogin ? "Sign in to your office." : "Start hiring digital workers in minutes."}</p>
        )}

        {showGoogle && (
          <>
            <button
              type="button"
              className="rauth-google"
              onClick={() => { onGoogleAuth ? onGoogleAuth() : (window.location.href = "/api/auth/google"); }}
            >
              <svg viewBox="0 0 18 18" width="17" height="17" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
              </svg>
              Continue with Google
            </button>
            <div className="rauth-or"><span>or</span></div>
          </>
        )}

        <form className="rauth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <label className="ro-field"><span>Full name</span>
              <input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus />
            </label>
          )}
          {!isResetComplete && (
            <label className="ro-field"><span>Email</span>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </label>
          )}
          {!isResetRequest && (
            <label className="ro-field"><span>{isResetComplete ? "New password" : "Password"}</span>
              <input minLength={8} required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isRegister ? "At least 8 characters" : "••••••••"} />
            </label>
          )}

          {error && <p className="ro-error">{error}</p>}

          <button className="r-btn r-btn-accent rauth-submit" disabled={loading} type="submit">{cta}</button>
        </form>

        <div className="rauth-links">
          {!isResetComplete && (
            <button className="rauth-link" onClick={() => setMode(isResetRequest ? "login" : "reset-request")} type="button">
              {isResetRequest ? "Back to sign in" : "Forgot password?"}
            </button>
          )}
          {!isResetRequest && !isResetComplete && (
            <button className="rauth-link" onClick={() => setMode(isLogin ? "register" : "login")} type="button">
              {isLogin ? "Need an account? Create one" : "Already have an account? Sign in"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
