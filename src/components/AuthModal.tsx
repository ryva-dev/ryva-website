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
        <div className="auth-modal-head">
          <h2 id="auth-title">
            {mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Create account"
                : mode === "reset-complete"
                  ? "Set new password"
                  : "Reset password"}
          </h2>
          <button aria-label="Close auth dialog" className="icon-button" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="auth-switch">
          <button className={mode === "login" ? "auth-switch-active" : ""} onClick={() => setMode("login")} type="button">
            Sign in
          </button>
          <button
            className={mode === "register" ? "auth-switch-active" : ""}
            onClick={() => setMode("register")}
            type="button"
          >
            Register
          </button>
          <button
            className={mode === "reset-request" || mode === "reset-complete" ? "auth-switch-active" : ""}
            onClick={() => setMode(resetToken ? "reset-complete" : "reset-request")}
            type="button"
          >
            Reset
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <label>
              <span>Name</span>
              <input required type="text" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          ) : null}

          {mode !== "reset-complete" ? (
            <label>
              <span>Email</span>
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
          ) : null}

          {mode !== "reset-request" ? (
            <label>
              <span>{mode === "reset-complete" ? "New password" : "Password"}</span>
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

          <button className="button button-primary" disabled={loading} type="submit">
            {loading
              ? "Working..."
              : mode === "login"
                ? "Sign in"
                : mode === "register"
                  ? "Create account"
                  : mode === "reset-complete"
                    ? "Set password"
                    : "Send reset link"}
          </button>
        </form>
      </div>
    </div>
  );
}
