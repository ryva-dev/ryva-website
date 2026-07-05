import { useEffect, useState, type FormEvent } from "react";

type AuthMode = "login" | "register" | "reset-request" | "reset-complete";

type AuthModalProps = {
  error: string;
  loading: boolean;
  onClose: () => void;
  onCompletePasswordReset: (input: { password: string; token: string }) => Promise<void>;
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
  onLogin,
  onRegister,
  onRequestPasswordReset,
  resetToken
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(resetToken ? "reset-complete" : "login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isResetComplete = mode === "reset-complete";
  const isResetRequest = mode === "reset-request";

  useEffect(() => {
    if (resetToken) {
      setMode("reset-complete");
    }
  }, [resetToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "login") {
      await onLogin({ email, password });
      return;
    }

    if (mode === "register") {
      await onRegister({ email, name, password });
      return;
    }

    if (mode === "reset-complete" && resetToken) {
      await onCompletePasswordReset({ password, token: resetToken });
      return;
    }

    await onRequestPasswordReset({ email });
  }

  return (
    <div aria-labelledby="auth-title" aria-modal="true" className="modal-backdrop" role="dialog">
      <div className="auth-modal">
        <div className="auth-modal-main">
          <div className="auth-modal-head">
            <div>
              <p className="auth-section-label">{isLogin ? "Sign in" : isRegister ? "Register" : "Password reset"}</p>
              <h3>{isLogin ? "Welcome back" : isRegister ? "Set up your account" : isResetComplete ? "Enter a replacement password" : "Request a reset link"}</h3>
            </div>
            <button aria-label="Close auth dialog" className="icon-button" onClick={onClose} type="button">
              ×
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister ? (
              <label>
                <span>Full name</span>
                <input required type="text" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
            ) : null}

            {!isResetComplete ? (
              <label>
                <span>Email address</span>
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
            ) : null}

            {!isResetRequest ? (
              <label>
                <span>{isResetComplete ? "New password" : "Password"}</span>
                <input
                  minLength={8}
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            ) : null}

            {error ? <p className="form-error">{error}</p> : null}

            <button className="button button-primary auth-submit" disabled={loading} type="submit">
              {loading
                ? "Working..."
                : isLogin
                  ? "Sign in"
                  : isRegister
                    ? "Create account"
                    : isResetComplete
                      ? "Set password"
                      : "Send reset link"}
            </button>
          </form>

          <div className="auth-footer-links">
            {!isResetComplete ? (
              <button className="auth-text-link" onClick={() => setMode(isResetRequest ? "login" : "reset-request")} type="button">
                {isResetRequest ? "Back to sign in" : "Forgot password?"}
              </button>
            ) : null}
            {!isResetRequest && !isResetComplete ? (
              <button className="auth-text-link" onClick={() => setMode(isLogin ? "register" : "login")} type="button">
                {isLogin ? "Need an account? Create one" : "Already have an account? Sign in"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
